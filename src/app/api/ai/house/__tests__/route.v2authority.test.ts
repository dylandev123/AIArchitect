import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { modelOutput, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";
import { RESPONDER_PRIMARY, RESPONDER_SITE, stageOf, v2StageResponder } from "@/lib/architecture/__tests__/v2StageResponder";
import { authoredPlan, referenceGeometry } from "@/lib/architecture/__tests__/authoredFixtures";
import { withVolumePlan } from "@/lib/architecture/volumePlan";
import type { MassVolume } from "@/lib/architecture/document";

/**
 * The real generation route end to end with every model call stubbed (no live AI): a V2 generation either
 * finalizes as authored, or does not finalize at all — no legacy site design, no persistence, no `json`.
 */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (work: () => unknown) => void Promise.resolve(work()) }));
/** Lets one test simulate a downstream placement step that puts a scene asset inside the building. */
const placeInsideBuilding = { enabled: false };
vi.mock("@/lib/outdoor/placements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/outdoor/placements")>();
  return {
    ...actual,
    attachOutdoorAssets: (json: string, brief: string, library: never) => {
      const placed = actual.attachOutdoorAssets(json, brief, library);
      if (!placeInsideBuilding.enabled) return placed;
      const root = JSON.parse(placed) as { outdoorAssetPlacements?: unknown[] };
      root.outdoorAssetPlacements = [...(root.outdoorAssetPlacements ?? []), { id: "stray", assetId: "sun-lounger", parentSpaceId: "pool", category: "furniture", role: "sun-lounger", position: [0, 0, 0], rotation: [0, 0, 0], dimensions: { width: 0.8, depth: 2, height: 0.4 } }];
      return JSON.stringify(root);
    },
  };
});

const finalAssembly = () => modelOutput({ ops: [{ op: "addPool", value: { wall: "north", offset: 4, distance: 3, width: 10, depth: 5, waterDepth: 1.5 } }] });

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "route-v2-authority-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  generateText.mockReset();
  placeInsideBuilding.enabled = false;
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function generate() {
  const { POST } = await import("../route");
  const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", projectId: "proj-authority", prompt: VILLA_BRIEF, currentHouseJson: BLANK_HOUSE_JSON }) }));
  return { res, body: (await res.json()) as Record<string, unknown> & { json?: string; code?: string; stage?: string; conflicts?: string[] } };
}
const stagesCalled = () => generateText.mock.calls.map((call) => stageOf((call[0] as { system: string }).system));
const persistedGenerations = async () => (await (await import("@/lib/library/store")).readLibrary()).generations.length;

describe("V2 generation finalization authority", () => {
  it("never falls back to legacy site design when the Site Plan cannot be authored: the generation fails, nothing is assembled or saved", async () => {
    // Every Site Plan attempt leaves out required paths; the repair attempt does not fix it.
    generateText.mockImplementation(v2StageResponder(finalAssembly, { sitePlan: () => ({ entrance: { wall: "north", offset: 9 } }) }));
    const { res, body } = await generate();
    expect(res.status).toBe(502);
    expect(body).toMatchObject({ code: "v2-generation-failed", stage: "site-plan", outcome: "failed" });
    expect(body.json).toBeUndefined();
    expect(stagesCalled().filter((s) => s === "sitePlan")).toHaveLength(2);
    // The mandatory final assembly — and with it the legacy scale/site-rule pipeline — never ran.
    expect(stagesCalled()).not.toContain("finalAssembly");
    expect(await persistedGenerations()).toBe(0);
  });

  it("does not finalize when an authoritative architecture stage exhausts its retries", async () => {
    generateText.mockImplementation(v2StageResponder(finalAssembly, { geometry: () => ({ results: [{ massId: "mass-0", operations: [] }] }) }));
    const { res, body } = await generate();
    expect(res.status).toBe(502);
    expect(body).toMatchObject({ code: "v2-generation-failed", stage: "architectural-geometry" });
    expect(body.conflicts?.join(" ")).toMatch(/missing-planned-geometry/);
    expect(stagesCalled()).not.toContain("sitePlan");
    expect(body.json).toBeUndefined();
  });

  it("lets the final integrity gate block persistence and success when the artifact about to be saved fails it", async () => {
    placeInsideBuilding.enabled = true;
    generateText.mockImplementation(v2StageResponder(finalAssembly));
    const { res, body } = await generate();
    expect(res.status).toBe(422);
    expect(body).toMatchObject({ code: "v2-integrity-blocked", stage: "integrity-gate", outcome: "failed" });
    expect(body.conflicts?.join(" ")).toMatch(/scene-assets-clear-of-building/);
    expect(body.json).toBeUndefined();
    expect(body).not.toHaveProperty("intelligence");
    expect(await persistedGenerations()).toBe(0);
  });

  it("completes a valid complex authored V2 composition end to end, exactly as authored", async () => {
    const bedroomPlan = authoredPlan("bedroom-wing");
    const garagePlan = authoredPlan("garage");
    const placed = (id: string, name: string, role: MassVolume["role"], x: number, z: number, width: number, depth: number, plan: typeof bedroomPlan, relationships: MassVolume["relationships"]): MassVolume =>
      withVolumePlan({ id, name, role, position: { x, z }, width, depth, floors: 1, elevation: 0, rotation: 0, placementLocked: true, relationships }, plan);
    const masses = [
      withVolumePlan({ id: "mass-0", name: RESPONDER_PRIMARY.name, role: "main-living", position: { x: 0, z: 0 }, width: RESPONDER_PRIMARY.width, depth: RESPONDER_PRIMARY.depth, floors: 1, elevation: 0, rotation: 0 }, RESPONDER_PRIMARY.plan),
      placed("mass-1", "Bedroom Wing", "bedroom-wing", -16, -1, 10, 7, bedroomPlan, [{ kind: "separated-from", target: "mass-0", side: "west", distance: 2 }]),
      placed("mass-2", "Garage", "garage", -16, -16, 7, 6, garagePlan, [{ kind: "offset-from", target: "mass-1", side: "north", distance: 5 }]),
    ];
    const add = (m: MassVolume) => ({ decision: "add", reasoning: `${m.name} completes the program.`, mass: { name: m.name, role: m.role, width: m.width, depth: m.depth, floors: 1, position: m.position, rotation: 0, plan: m.plan }, relationships: m.relationships });
    const expansion = [add(masses[1]), add(masses[2]), { decision: "done", reasoning: "Living, bedrooms and garage complete the program." }];
    let turn = 0;
    generateText.mockImplementation(v2StageResponder(finalAssembly, {
      massExpansion: () => expansion[Math.min(turn++, expansion.length - 1)],
      geometry: () => ({ results: masses.map((m) => ({ massId: m.id, operations: referenceGeometry(m, masses, RESPONDER_SITE) })) }),
      roofs: () => ({ language: { dominantMassId: "mass-0", family: "floating-flat", concept: "One floating plane; quiet sheds and a flat garage deck beneath it." }, roofs: [
        { massId: "mass-0", kind: "floating-flat", overhang: 0.9, pitch: 2, expression: { verticalGap: 0.25 } },
        { massId: "mass-1", kind: "shed", overhang: 0.5, pitch: 10 },
        { massId: "mass-2", kind: "flat", overhang: 0, pitch: 2, parapet: { height: 0.4 } },
      ] }),
    }));
    const { res, body } = await generate();
    expect(body.code).toBeUndefined();
    expect(res.status).toBe(200);
    const saved = JSON.parse(body.json!) as { architecturalDesignDocument: { massing: { masses: MassVolume[] }; roofs: { recipes: { massId: string; kind: string; overhang: number }[] } }; sitePlan: unknown };
    expect(saved.architecturalDesignDocument.massing.masses.map((m) => [m.id, m.role, m.position])).toEqual(masses.map((m) => [m.id, m.role, m.position]));
    // Built exactly as authored: every authored opening, and the authored roofs untouched.
    for (const m of masses) expect(saved.architecturalDesignDocument.massing.masses.find((s) => s.id === m.id)!.openings?.length).toBe(referenceGeometry(m, masses, RESPONDER_SITE).filter((op) => ["glazing-zone", "opening-rhythm", "door"].includes(op.type)).length);
    expect(saved.architecturalDesignDocument.roofs.recipes.map((r) => [r.massId, r.kind, r.overhang])).toEqual([["mass-0", "floating-flat", 0.9], ["mass-1", "shed", 0.5], ["mass-2", "flat", 0]]);
    expect(saved.sitePlan).toBeDefined();
    const gate = (body.architectureDiagnostics as { stage: string; status: string; outcome?: string }[]).find((d) => d.stage === "quality-gate")!;
    expect(gate.status).toBe("ok");
    expect(["accepted", "normalized"]).toContain(gate.outcome);
    expect(await persistedGenerations()).toBe(1);
  });
});
