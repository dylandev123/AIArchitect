import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_HOUSE_JSON, DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { modelOutput, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";
import { stageOf, v2StageResponder } from "@/lib/architecture/__tests__/v2StageResponder";
import type { ArchitecturalDesignDocument, MassVolume } from "@/lib/architecture/document";
import type { CuratedAsset } from "@/types/assets";
import { compileArchitecture } from "@/lib/architecture/compiler";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";

/**
 * Architectural follow-up edits through the real route, with every model call stubbed (no live AI, no network):
 * the same Architect edits its saved document, and the result is saved only if it passes every existing check.
 */

const generateText = vi.fn();
const { usageAssessments } = vi.hoisted(() => ({ usageAssessments: [] as unknown[] }));
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({
  withUsageLogging: async (_meta: unknown, run: () => Promise<unknown>, assess?: (outcome: { result: unknown }) => unknown) => {
    const result = await run();
    usageAssessments.push(await assess?.({ result }));
    return result;
  },
}));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (work: () => unknown) => void Promise.resolve(work()) }));
const catalog: { assets: CuratedAsset[]; glbIds: string[] } = { assets: [], glbIds: [] };
vi.mock("@/lib/assets/serverStore", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/assets/serverStore")>()), assetBackend: () => ({ list: async () => catalog }) }));
const network = vi.fn(() => { throw new Error("unexpected network call"); });

const ENTRANCE_PROMPT = "Transform the main entrance into a more impressive grand estate entrance. Add a deeper covered entry, stronger architectural framing around the front door, and a more defined arrival presence. Keep the existing house, pool, gazebo, driveway, windows, and overall layout intact. Only modify what is necessary to improve the entrance.";
const ROOF_PROMPT = "Make the main roof a hipped roof with deeper eaves.";

type Project = Record<string, unknown> & { architecturalDesignDocument: ArchitecturalDesignDocument; sitePlan: unknown; outdoorAssetPlacements?: unknown[] };
type Body = Record<string, unknown> & { json?: string; code?: string; conflicts?: string[]; changes?: string[]; operation?: string; placementIds?: string[] };

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "route-architectural-edit-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal("fetch", network);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  generateText.mockReset();
  usageAssessments.length = 0;
  network.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function post(body: Record<string, unknown>) {
  const { POST } = await import("../route");
  const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify(body) }));
  return { res, body: (await res.json()) as Body };
}
const edit = (prompt: string, currentHouseJson: string) => post({ mode: "edit", projectId: "proj-edit", prompt, currentHouseJson });

const finalAssembly = () => modelOutput({ ops: [{ op: "addPool", value: { wall: "north", offset: 4, distance: 3, width: 10, depth: 5, waterDepth: 1.5 } }] });

/** A real saved project: generated through the route by the stubbed stages, plus an existing gazebo proxy placed by the additive path. */
let savedProject: string | undefined;
async function existingProject(): Promise<string> {
  if (savedProject) return savedProject;
  generateText.mockImplementation(v2StageResponder(finalAssembly));
  const generated = await post({ mode: "generate", projectId: "proj-edit", prompt: VILLA_BRIEF, currentHouseJson: BLANK_HOUSE_JSON });
  expect(generated.res.status).toBe(200);
  const gazebo = await edit("add a modern gazebo in the garden", generated.body.json!);
  expect(gazebo.res.status).toBe(200);
  generateText.mockReset();
  savedProject = gazebo.body.json!;
  return savedProject;
}
const parse = (json: string) => JSON.parse(json) as Project;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Mirrors a saved rooftop placement: host identity is explicit in both support and intent, not inferred from gazebo type. */
function rooftopGazebo(project: Project): OutdoorAssetPlacement {
  const host = project.architecturalDesignDocument.massing.masses[0];
  const plane = compileArchitecture(project.architecturalDesignDocument, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives.find((primitive) => primitive.id === `architecture-${host.id}-roof-plane`);
  if (!plane || plane.kind !== "box") throw new Error("fixture requires a flat host roof");
  const elevation = plane.position[1] + plane.size[1] / 2;
  const centre = { x: host.position.x - 1.5, z: host.position.z + 3 };
  return {
    id: "outdoor-v2-a2aec565-f772-446d-b3c9-6dced30e103a", assetId: "procedural-v2-gazebo", parentSpaceId: `v2-roof-${host.id}`, category: "gazebo", role: "gazebo",
    position: [centre.x, elevation, centre.z], rotation: [0, host.rotation, 0], scale: 1, dimensions: { width: 4, depth: 4, height: 2.9 },
    support: { kind: "roof", elevation, massId: host.id },
    intent: { surface: "roof", massId: host.id, centre, yaw: host.rotation, dimensions: { width: 4, depth: 4, height: 2.9 } },
  };
}

/** The calls the Architect received (system prompt names the sole AI Architect). */
const architectCalls = () => generateText.mock.calls.map((call) => call[0] as { system: string; messages: { content: string }[] }).filter((call) => stageOf(call.system) === "architect");
const answer = (...documents: unknown[]) => {
  let turn = 0;
  generateText.mockImplementation(() => Promise.resolve({ output: { document: documents[Math.min(turn++, documents.length - 1)] }, totalUsage: {} }));
};

/** The localized entrance edit a well-behaved Architect returns: a deeper covered, open-fronted entry porch on the north door, a framed door. */
function entranceEdit(current: ArchitecturalDesignDocument): ArchitecturalDesignDocument {
  const doc = clone(current);
  const main = doc.massing.masses[0];
  main.operations = [...(main.operations ?? []), { id: "mass-0:grand-entry", type: "projection", facade: "north", start: 0.36, end: 0.64, depth: 2.4, open: true, postSpacing: 2.5 }];
  main.openings = (main.openings ?? []).map((o) => (o.type === "door" ? { ...o, start: 0.44, end: 0.56, height: 3, frame: true, reveal: 0.25 } : o));
  return doc;
}
type Recipe = ArchitecturalDesignDocument["roofs"]["recipes"][number];
const withRoof = (doc: ArchitecturalDesignDocument, patch: Partial<Recipe>): ArchitecturalDesignDocument => ({ ...doc, roofs: { recipes: doc.roofs.recipes.map((r, i) => (i === 0 ? { ...r, ...patch } as Recipe : r)) } });
const withDuplicateMass = (doc: ArchitecturalDesignDocument): ArchitecturalDesignDocument => ({ ...doc, massing: { ...doc.massing, masses: [...doc.massing.masses, clone(doc.massing.masses[0])] } });
const doorOf = (doc: ArchitecturalDesignDocument) => doc.massing.masses[0].openings!.find((o) => o.type === "door")!;
const withoutEntrance = (mass: MassVolume) => ({ ...mass, operations: (mass.operations ?? []).filter((o) => o.id !== "mass-0:grand-entry"), openings: (mass.openings ?? []).filter((o) => o.type !== "door") });

describe("V2 architectural follow-up edits", { timeout: 60_000 }, () => {
  it("keeps a valid explicitly hosted rooftop gazebo unchanged through an unrelated entrance edit", async () => {
    const generated = parse(await existingProject());
    const before: Project = { ...generated, outdoorAssetPlacements: [rooftopGazebo(generated)] };
    answer(entranceEdit(before.architecturalDesignDocument));

    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));

    expect(res.status).toBe(200);
    expect(parse(body.json!).outdoorAssetPlacements).toEqual(before.outdoorAssetPlacements);
    expect(network).not.toHaveBeenCalled();
  });

  it("routes the grand-entrance request to the Architect editing the current document, and saves only the entrance change", async () => {
    const before = parse(await existingProject());
    answer(entranceEdit(before.architecturalDesignDocument));
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));

    expect(body.code).toBeUndefined();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ operation: "architecturalEdit", changes: ["main-living.operations: changed", "main-living.facade.north.doors: changed"] });

    // The Architect received the complete current document and the exact request, not a blank/new design.
    const calls = architectCalls();
    expect(calls).toHaveLength(1);
    expect(generateText).toHaveBeenCalledTimes(1);
    const message = calls[0].messages[0].content;
    expect(message).toContain(ENTRANCE_PROMPT);
    expect(message).toContain(JSON.stringify({ document: before.architecturalDesignDocument }));
    expect(calls[0].system).toMatch(/EDIT MODE/);
    expect(calls[0].system).toMatch(/COORDINATES/); // the same contracts as generation
    expect(calls[0].system).toMatch(/SHARED FACADES/);

    const after = parse(body.json!);
    const [was, now] = [before.architecturalDesignDocument, after.architecturalDesignDocument];
    // The intended entrance geometry changed...
    expect(now.massing.masses[0].operations).toContainEqual(expect.objectContaining({ id: "mass-0:grand-entry", type: "projection", facade: "north", open: true, depth: 2.4 }));
    expect(doorOf(now)).toMatchObject({ frame: true, height: 3 });
    expect(doorOf(now)).not.toEqual(doorOf(was));
    // ...and nothing unrelated did: masses, windows/glazing, roofs, site strategy, Site Plan, outdoor placements, executed site.
    expect(withoutEntrance(now.massing.masses[0])).toEqual(withoutEntrance(was.massing.masses[0]));
    expect(now.massing.masses.slice(1)).toEqual(was.massing.masses.slice(1));
    expect(now.roofs).toEqual(was.roofs);
    expect(now.siteStrategy).toEqual(was.siteStrategy);
    expect(now.metadata).toEqual(was.metadata);
    expect(after.sitePlan).toEqual(before.sitePlan);
    expect(after.outdoorAssetPlacements).toEqual(before.outdoorAssetPlacements);
    expect(after.outdoorAssetPlacements!.length).toBeGreaterThan(0);
    for (const key of ["driveways", "parking", "pools", "patios", "decks", "paths", "landscaping"]) expect(after[key]).toEqual(before[key]);
    expect(network).not.toHaveBeenCalled();
  });

  it("lets a roof edit intentionally change the roof recipe", async () => {
    const before = parse(await existingProject());
    const edited = withRoof(before.architecturalDesignDocument, { kind: "hip", pitch: 24, overhang: 1.2, expression: undefined });
    answer(edited);
    const { res, body } = await edit(ROOF_PROMPT, JSON.stringify(before));
    expect(body.code).toBeUndefined();
    expect(res.status).toBe(200);
    expect(body.changes).toEqual(["main-living.roof: changed"]);
    const now = parse(body.json!).architecturalDesignDocument;
    expect(now.roofs.recipes[0]).toMatchObject({ kind: "hip", pitch: 24, overhang: 1.2 });
    expect(now.massing).toEqual(before.architecturalDesignDocument.massing);
  });

  it("routes a change-verb roof request to the Architect too, never to the placer", async () => {
    const before = parse(await existingProject());
    const edited = withRoof(before.architecturalDesignDocument, { kind: "gable", pitch: 30, expression: undefined });
    answer(edited);
    const { res, body } = await edit("Change the roof to a gable roof", JSON.stringify(before));
    expect(res.status).toBe(200);
    expect(body.operation).toBe("architecturalEdit");
    expect(architectCalls()).toHaveLength(1);
  });

  it("gives an invalid edit exactly one bounded repair with the candidate and its exact diagnostics", async () => {
    const before = parse(await existingProject());
    const valid = entranceEdit(before.architecturalDesignDocument);
    const invalid = withDuplicateMass(valid);
    answer(invalid, valid);
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(200);
    const calls = architectCalls();
    expect(calls).toHaveLength(2);
    const repair = calls[1].messages[0].content;
    expect(repair).toMatch(/duplicate mass id/);
    expect(repair).toContain(JSON.stringify(invalid));
    expect(repair).toContain(ENTRANCE_PROMPT);
    expect(parse(body.json!).architecturalDesignDocument.massing.masses).toHaveLength(before.architecturalDesignDocument.massing.masses.length);
  });

  it("fails a second invalid result without returning or mutating the project", async () => {
    const beforeJson = await existingProject();
    const before = parse(beforeJson);
    const invalid = withDuplicateMass(entranceEdit(before.architecturalDesignDocument));
    answer(invalid, invalid);
    const { res, body } = await edit(ENTRANCE_PROMPT, beforeJson);
    expect(res.status).toBe(422);
    expect(body).toMatchObject({ code: "ARCHITECTURAL_EDIT_FAILED", stage: "architect" });
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/duplicate mass id/);
    expect(architectCalls()).toHaveLength(2);
    expect(await existingProject()).toBe(beforeJson);
  });

  it("records bounded rejected-edit evidence with the original/candidate fingerprints, exact errors, and a structural diff", async () => {
    const before = parse(await existingProject());
    const rewritten = entranceEdit(before.architecturalDesignDocument);
    rewritten.massing.masses[0].position.x += 1;
    answer(rewritten, rewritten);

    const { res } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(422);
    const evidence = usageAssessments
      .map((assessment) => (assessment as { candidate?: string } | undefined)?.candidate)
      .filter((candidate): candidate is string => typeof candidate === "string")
      .map((candidate) => JSON.parse(candidate) as { kind?: string; attempt: number; original: { fingerprint: string }; candidate: { fingerprint: string; document: ArchitecturalDesignDocument }; errors: { rejection: string[] }; diff: { path: string }[] })
      .filter((candidate) => candidate.kind === "architectural-edit-rejection");

    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({ attempt: 1, original: { fingerprint: expect.any(String) }, candidate: { fingerprint: expect.any(String), document: rewritten } });
    expect(evidence[0].errors.rejection.join(" ")).toMatch(/site frame moved/);
    expect(evidence[0].diff.map((change) => change.path)).toContain("main-living.position");
  });

  it("refuses an edit that would move the site frame the Site Plan is anchored to, rather than silently moving the pool and driveway", async () => {
    const before = parse(await existingProject());
    const moved = entranceEdit(before.architecturalDesignDocument);
    moved.massing.masses[0].position = { x: moved.massing.masses[0].position.x + 6, z: moved.massing.masses[0].position.z };
    answer(moved, moved);
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/site frame moved/);
  });

  it("does not save a no-op answer", async () => {
    const before = parse(await existingProject());
    answer(before.architecturalDesignDocument);
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
  });

  it("persists the edit: the saved JSON reloads with it, and the next edit starts from the edited document", async () => {
    const before = parse(await existingProject());
    const edited = entranceEdit(before.architecturalDesignDocument);
    answer(edited);
    const first = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(first.res.status).toBe(200);
    // Save/reload through the same serialization the project store persists (houseConfigJson string).
    const reloaded = parse(JSON.parse(JSON.stringify({ houseConfigJson: first.body.json })).houseConfigJson);
    expect(reloaded.architecturalDesignDocument).toEqual(edited);

    // A following additive edit keeps the architectural edit and makes no Architect call.
    generateText.mockReset();
    const chair = await edit("add a lounge chair by the pool", JSON.stringify(reloaded));
    expect(chair.body.code).toBeUndefined();
    expect(chair.res.status).toBe(200);
    expect(generateText).not.toHaveBeenCalled();
    expect(parse(chair.body.json!).architecturalDesignDocument).toEqual(edited);

    // A following architectural edit receives the edited document as its current design.
    // A hip over the new projection would fragment (the quality gate rejects it), so the follow-up roof is a shed.
    const roof = withRoof(edited, { kind: "shed", pitch: 8, expression: undefined });
    answer(roof);
    const second = await edit(ROOF_PROMPT, chair.body.json!);
    expect(second.res.status).toBe(200);
    expect(architectCalls()[0].messages[0].content).toContain(JSON.stringify({ document: edited }));
  });

  it("keeps additive chair and gazebo requests on the existing placement path with zero Architect calls", async () => {
    const before = await existingProject();
    generateText.mockImplementation(() => { throw new Error("unexpected AI call"); });
    for (const prompt of ["add a lounge chair by the pool", "add a modern gazebo in the garden"]) {
      const { res, body } = await edit(prompt, before);
      expect(res.status).toBe(200);
      expect(body.operation).toBe("addV2Placement");
      expect(parse(body.json!).architecturalDesignDocument).toEqual(parse(before).architecturalDesignDocument);
    }
    expect(generateText).not.toHaveBeenCalled();
  });

  it("keeps the placer's own ARCHITECTURAL_EDIT guard: it still refuses architecture handed to it directly", async () => {
    const { placeV2AdditiveAsset } = await import("@/lib/architecture/v2AdditivePlacement");
    const result = placeV2AdditiveAsset(parse(await existingProject()), ENTRANCE_PROMPT, [], []);
    expect(result).toMatchObject({ ok: false, code: "ARCHITECTURAL_EDIT" });
  });
});
