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
import { runV2IntegrityGate } from "@/lib/architecture/stages/integrityGate";
import { architectureAuthorityHash } from "@/lib/architecture/stages/authority";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import type { ArchitecturalEditScope } from "@/lib/architecture/stages/architectEditDiff";
import { architectEditOutputSchema } from "@/lib/architecture/stages/architectStage";
import type { SceneEditPlan } from "@/lib/architecture/sceneOperations";

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
const BALCONY_PROMPT = "Add a small modern balcony to the upper-floor front of the house, positioned beneath the large upper front window on the right. Give it a shallow projecting floor slab, a simple glass railing, and enough depth for two people to stand comfortably. Keep the existing window, main entrance, building massing, roof, rooftop gazebo, all other facades, and the entire property unchanged.";

type Project = Record<string, unknown> & { architecturalDesignDocument: ArchitecturalDesignDocument; sitePlan: unknown; outdoorAssetPlacements?: unknown[] };
type Body = Record<string, unknown> & { editScope?: unknown; editPlan?: unknown; json?: string; code?: string; conflicts?: string[]; changes?: string[]; operation?: string; placementIds?: string[] };

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
const architectCalls = () => generateText.mock.calls.map((call) => call[0] as { system: string; messages: { content: string }[]; output: unknown }).filter((call) => stageOf(call.system) === "architect");
/** The mocked Architect returns each document with the edit scope it declares (the only edit permission). */
const answer = (scope: ArchitecturalEditScope | undefined, ...documents: unknown[]) => {
  let turn = 0;
  generateText.mockImplementation(() => Promise.resolve({ output: { document: documents[Math.min(turn++, documents.length - 1)], ...(scope ? { scope } : {}) }, totalUsage: {} }));
};
const answerPlan = (...plans: SceneEditPlan[]) => {
  let turn = 0;
  generateText.mockImplementation(() => Promise.resolve({ output: plans[Math.min(turn++, plans.length - 1)], totalUsage: {} }));
};
const ENTRANCE_SCOPE: ArchitecturalEditScope = { intent: "A deeper covered entry and a framed front door.", targets: [{ element: "mass:mass-0", action: "modify", fields: ["operations", "openings"], facade: "north", openingTypes: ["door"] }] };
const BALCONY_SCOPE: ArchitecturalEditScope = { intent: "An upper-floor front balcony platform.", targets: [{ element: "mass:mass-0", action: "modify", fields: ["operations"], facade: "north", level: "upper" }] };
const ROOF_SCOPE: ArchitecturalEditScope = { intent: "Change the main roof.", targets: [{ element: "mass:mass-0", action: "modify", fields: ["roof"] }] };
const NO_CHANGE_SCOPE: ArchitecturalEditScope = { intent: "The requested capability is not represented by the available architecture vocabulary.", targets: [] };

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

/** A persisted two-storey V2 project with the requested existing upper-front window; no model call creates it. */
function twoStoreyProject(project: Project): Project {
  const next = clone(project);
  const main = next.architecturalDesignDocument.massing.masses[0];
  main.floors = 2;
  main.height = 6.8;
  main.openings = [...(main.openings ?? []), { id: "mass-0:upper-front-window", type: "glazing-zone", facade: "north", start: .6, end: .86, heightRatio: .68, floors: "upper", frame: true }];
  return next;
}

function balconyEdit(current: ArchitecturalDesignDocument): ArchitecturalDesignDocument {
  const doc = clone(current);
  const main = doc.massing.masses[0];
  main.operations = [...(main.operations ?? []), { id: "mass-0:upper-front-balcony", type: "balcony", facade: "north", start: .6, end: .86, depth: 1.65, floors: "upper" }];
  return doc;
}

function repairLegacyBalcony(current: ArchitecturalDesignDocument): ArchitecturalDesignDocument {
  const doc = clone(current);
  const main = doc.massing.masses[0];
  main.operations = (main.operations ?? []).map((operation) => operation.id === "mass-0:upper-front-balcony"
    ? { id: operation.id, type: "balcony" as const, facade: "north" as const, start: .6, end: .86, depth: 1.65, floors: "upper" as const }
    : operation);
  return doc;
}

describe("V2 architectural follow-up edits", { timeout: 60_000 }, () => {
  it("keeps a valid explicitly hosted rooftop gazebo unchanged through an unrelated entrance edit", async () => {
    const generated = parse(await existingProject());
    const before: Project = { ...generated, outdoorAssetPlacements: [rooftopGazebo(generated)] };
    answer(ENTRANCE_SCOPE, entranceEdit(before.architecturalDesignDocument));

    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));

    expect(res.status).toBe(200);
    expect(parse(body.json!).outdoorAssetPlacements).toEqual(before.outdoorAssetPlacements);
    expect(network).not.toHaveBeenCalled();
  });

  it("routes the grand-entrance request to the Architect editing the current document, and saves only the entrance change", async () => {
    const before = parse(await existingProject());
    answer(ENTRANCE_SCOPE, entranceEdit(before.architecturalDesignDocument));
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));

    expect(body.code).toBeUndefined();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ operation: "architecturalEdit", changes: ["main-living.operations: changed", "main-living.facade.north.doors: changed"] });

    // The Architect receives the exact request and a local authoritative slice, never a replacement document dump.
    const calls = architectCalls();
    expect(calls).toHaveLength(1);
    expect(generateText).toHaveBeenCalledTimes(1);
    const message = calls[0].messages[0].content;
    expect(message).toContain(ENTRANCE_PROMPT);
    expect(message).toContain('"contextTier":"local-architecture"');
    expect(message).toContain('"id":"mass:mass-0"');
    expect(message).not.toContain(JSON.stringify({ document: before.architecturalDesignDocument }));
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

  it("saves an upper-front balcony as only the target mass's exterior platform, preserving the entire rest of the project", async () => {
    const before = twoStoreyProject(parse(await existingProject()));
    const beforeJson = JSON.stringify(before);
    const edited = balconyEdit(before.architecturalDesignDocument);
    answer(BALCONY_SCOPE, edited);

    const { res, body } = await edit(BALCONY_PROMPT, beforeJson);

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ operation: "architecturalEdit", changes: ["main-living.operations: changed"] });
    const after = parse(body.json!);
    const [was, now] = [before.architecturalDesignDocument, after.architecturalDesignDocument];
    expect(now.massing.masses[0].operations).toContainEqual(expect.objectContaining({ id: "mass-0:upper-front-balcony", type: "balcony", facade: "north", floors: "upper", depth: 1.65 }));
    expect(now.massing.masses[0].openings).toEqual(was.massing.masses[0].openings);
    expect(now.massing.masses[0].position).toEqual(was.massing.masses[0].position);
    expect(now.massing.masses[0].width).toBe(was.massing.masses[0].width);
    expect(now.massing.masses[0].depth).toBe(was.massing.masses[0].depth);
    expect(now.massing.masses[0].rotation).toBe(was.massing.masses[0].rotation);
    expect(now.massing.masses.slice(1)).toEqual(was.massing.masses.slice(1));
    expect(now.roofs).toEqual(was.roofs);
    expect(now.components).toEqual(was.components);
    expect(after.sitePlan).toEqual(before.sitePlan);
    expect(after.outdoorAssetPlacements).toEqual(before.outdoorAssetPlacements);
    expect(JSON.stringify(after.sitePlan)).toBe(JSON.stringify(before.sitePlan));
    expect(JSON.stringify(after.outdoorAssetPlacements)).toBe(JSON.stringify(before.outdoorAssetPlacements));
    for (const key of ["driveways", "parking", "pools", "patios", "decks", "paths", "landscaping"] as const) expect(JSON.stringify(after[key])).toBe(JSON.stringify(before[key]));
    expect(JSON.parse(JSON.stringify({ houseConfigJson: body.json })).houseConfigJson).toBe(body.json);
    expect(parse(JSON.parse(JSON.stringify({ houseConfigJson: body.json })).houseConfigJson).architecturalDesignDocument).toEqual(edited);
    const reloaded = parse(JSON.parse(JSON.stringify(body.json!)));
    expect(compileArchitecture(after.architecturalDesignDocument, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives)
      .toEqual(compileArchitecture(reloaded.architecturalDesignDocument, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives);
    expect(network).not.toHaveBeenCalled();
  });

  it("safely repairs the saved legacy balcony projection when the exact balcony prompt is run once more", async () => {
    const before = twoStoreyProject(parse(await existingProject()));
    before.architecturalDesignDocument.massing.masses[0].operations = [{ id: "mass-0:upper-front-balcony", type: "projection", facade: "north", start: .6, end: .86, depth: 1.65, floors: "upper" }];
    const repaired = repairLegacyBalcony(before.architecturalDesignDocument);
    answer(BALCONY_SCOPE, repaired);

    const { res, body } = await edit(BALCONY_PROMPT, JSON.stringify(before));

    expect(res.status).toBe(200);
    const now = parse(body.json!).architecturalDesignDocument.massing.masses[0];
    expect(now.operations).toEqual([{ id: "mass-0:upper-front-balcony", type: "balcony", facade: "north", start: .6, end: .86, depth: 1.65, floors: "upper" }]);
    expect(now.openings).toEqual(before.architecturalDesignDocument.massing.masses[0].openings);
  });

  it("still fails a balcony platform that collides with a pre-existing scene object at its upper-floor elevation", async () => {
    const before = twoStoreyProject(parse(await existingProject()));
    // This point is just beyond the saved north facade but inside the proposed platform at the upper-floor slab elevation.
    before.outdoorAssetPlacements = [{
      id: "outdoor-v2-front-object", assetId: "procedural-v2-bench", parentSpaceId: "v2-terrain", category: "furniture", role: "bench",
      position: [4, 3.3, -5.9], rotation: [0, 0, 0], scale: 1, dimensions: { width: .8, depth: .8, height: .8 },
    }];
    const invalid = balconyEdit(before.architecturalDesignDocument);
    const balconyIntegrity = runV2IntegrityGate({ json: JSON.stringify({ ...before, architecturalDesignDocument: invalid }), brief: before.architecturalDesignDocument.brief, authority: { architectureHash: architectureAuthorityHash(invalid), sitePlanHash: JSON.stringify(before.sitePlan) }, previousJson: JSON.stringify(before) }).checks.find((check) => check.id === "scene-assets-clear-of-building");
    expect(balconyIntegrity?.passed).toBe(false);
    answer(BALCONY_SCOPE, invalid, invalid);

    const { res, body } = await edit(BALCONY_PROMPT, JSON.stringify(before));

    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/scene-assets-clear-of-building/);
    expect(architectCalls()).toHaveLength(2);
  });

  it("lets a roof edit intentionally change the roof recipe", async () => {
    const before = parse(await existingProject());
    const edited = withRoof(before.architecturalDesignDocument, { kind: "hip", pitch: 24, overhang: 1.2, expression: undefined });
    answer(ROOF_SCOPE, edited);
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
    answer(ROOF_SCOPE, edited);
    const { res, body } = await edit("Change the roof to a gable roof", JSON.stringify(before));
    expect(res.status).toBe(200);
    expect(body.operation).toBe("architecturalEdit");
    expect(architectCalls()).toHaveLength(1);
  });

  it("gives an invalid edit exactly one bounded repair with the candidate and its exact diagnostics", async () => {
    const before = parse(await existingProject());
    const valid = entranceEdit(before.architecturalDesignDocument);
    const invalid = withDuplicateMass(valid);
    answer(ENTRANCE_SCOPE, invalid, valid);
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

  it("requires the top-level edit scope, repairs with the same envelope, and never persists that transient metadata", async () => {
    const before = parse(await existingProject());
    const edited = entranceEdit(before.architecturalDesignDocument);
    const validEnvelope = { document: edited, scope: ENTRANCE_SCOPE };
    expect(architectEditOutputSchema.safeParse(validEnvelope).success).toBe(true);
    expect(architectEditOutputSchema.safeParse({ document: { ...edited, scope: ENTRANCE_SCOPE } }).success).toBe(false);

    let attempt = 0;
    generateText.mockImplementation(() => Promise.resolve({
      // Reproduces the provider's raw object after the first structured-output rejection: the valid
      // document arrived but its mandatory top-level authorization scope did not.
      output: attempt++ === 0 ? { document: edited } : validEnvelope,
      totalUsage: {},
    }));
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));

    expect(res.status).toBe(200);
    expect(architectCalls()).toHaveLength(2);
    expect(architectCalls()[1].messages[0].content).toContain("scope stays top-level and is required");
    expect(body.editScope).toEqual(ENTRANCE_SCOPE);
    expect(parse(body.json!).architecturalDesignDocument).toEqual(edited);
    expect(parse(body.json!).architecturalDesignDocument).not.toHaveProperty("scope");
  });

  it("fails a second invalid result without returning or mutating the project", async () => {
    const beforeJson = await existingProject();
    const before = parse(beforeJson);
    const invalid = withDuplicateMass(entranceEdit(before.architecturalDesignDocument));
    answer(ENTRANCE_SCOPE, invalid, invalid);
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
    answer(ENTRANCE_SCOPE, rewritten, rewritten);

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
    answer(ENTRANCE_SCOPE, moved, moved);
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/site frame moved/);
  });

  it("does not save a no-op answer", async () => {
    const before = parse(await existingProject());
    answer(NO_CHANGE_SCOPE, before.architecturalDesignDocument);
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
  });

  it("persists the edit: the saved JSON reloads with it, and the next edit starts from the edited document", async () => {
    const before = parse(await existingProject());
    const edited = entranceEdit(before.architecturalDesignDocument);
    answer(ENTRANCE_SCOPE, edited);
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

    // A following architectural edit receives a context slice derived from the edited design.
    // A hip over the new projection would fragment (the quality gate rejects it), so the follow-up roof is a shed.
    const roof = withRoof(edited, { kind: "shed", pitch: 8, expression: undefined });
    answer(ROOF_SCOPE, roof);
    const second = await edit(ROOF_PROMPT, chair.body.json!);
    expect(second.res.status).toBe(200);
    const secondContext = architectCalls()[0].messages[0].content;
    expect(secondContext).toContain('"contextTier":"local-architecture"');
    expect(secondContext).toContain('"id":"mass:mass-0"');
    expect(secondContext).not.toContain(JSON.stringify({ document: edited }));
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

  it("executes the normal Architect operation plan atomically, without a replacement document or noun router", async () => {
    const before = parse(await existingProject());
    const untouched = JSON.stringify({ roofs: before.architecturalDesignDocument.roofs, openings: before.architecturalDesignDocument.massing.masses[0].openings });
    const plan: SceneEditPlan = {
      intent: "Add a covered arrival composition and a free-standing boundary marker.",
      operations: [
        { op: "create", object: { kind: "assembly", massId: "mass-0", assembly: { id: "arrival-cover", intent: "covered arrival composition", parts: [{ id: "cover", type: "slab", facade: "north", start: .38, end: .62, depth: 1.4, host: { kind: "entrance", facade: "north" } }, { id: "cover-edge", type: "railing", slabId: "cover", edges: ["outer"], height: 1.05 }] } } },
        { op: "create", object: { kind: "scene", scene: { id: "boundary-marker", kind: "post", label: "Boundary marker", position: [28, 1, 18], size: [.25, 2, .25] } } },
        { op: "rotate", target: "scene:boundary-marker", rotation: [0, .35, 0] },
        { op: "resize", target: "scene:boundary-marker", size: [.3, 2.2, .3] },
        { op: "changeMaterial", target: "mass:mass-0", material: { color: "#315b48", roughness: .72 } },
        { op: "move", target: "site:landscape:entrance-planting:1", position: [-9, 0, -12] },
      ],
      siteReflow: { elements: [{ id: "site:landscape:entrance-planting:1", action: "move", dependsOn: "mass:mass-0", reason: "The nearby planting bed clears the new arrival composition." }] },
    };
    answerPlan(plan);
    const { res, body } = await edit("Add an arrival composition, a boundary post, and update the exterior finish.", JSON.stringify(before));
    expect(res.status).toBe(200);
    expect(body.editPlan).toEqual(plan);
    expect(body.editScope).toBeUndefined();
    const after = parse(body.json!);
    expect(after.architecturalDesignDocument.massing.masses[0].assemblies?.some((assembly) => assembly.id === "arrival-cover")).toBe(true);
    expect(after.architecturalDesignDocument.sceneObjects).toContainEqual(expect.objectContaining({ id: "boundary-marker", kind: "post", rotation: [0, .35, 0], size: [.3, 2.2, .3] }));
    expect(after.architecturalDesignDocument.materialOverrides).toContainEqual({ target: "mass:mass-0", material: { color: "#315b48", roughness: .72 } });
    expect((after.sitePlan as { landscape: { x: number }[] }).landscape[1].x).toBe(-9);
    expect(JSON.stringify({ roofs: after.architecturalDesignDocument.roofs, openings: after.architecturalDesignDocument.massing.masses[0].openings })).toBe(untouched);
    expect(architectCalls()[0].messages[0].content).toContain("operation-plan contract");
    expect(network).not.toHaveBeenCalled();
  });

  it("accepts an already-satisfied plan without repair, creation, hashes, or save/reload changes", async () => {
    const beforeJson = await existingProject();
    const before = parse(beforeJson);
    const architectureHash = architectureAuthorityHash(before.architecturalDesignDocument);
    const siteHash = JSON.stringify(before.sitePlan);
    answerPlan({
      intent: "Confirm whether the requested condition is present.", status: "already-satisfied",
      rationale: "The requested semantic assembly already exists on the current authoritative scene.", operations: [],
    });

    const { res, body } = await edit("Confirm the existing arrival composition.", beforeJson);

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ outcome: "already-satisfied", changes: [] });
    expect(body.json).toBe(beforeJson);
    expect(architectCalls()).toHaveLength(1);
    expect(architectCalls()[0].system).toContain("already-satisfied");
    const reloaded = parse(JSON.parse(JSON.stringify({ houseConfigJson: body.json })).houseConfigJson);
    expect(architectureAuthorityHash(reloaded.architecturalDesignDocument)).toBe(architectureHash);
    expect(JSON.stringify(reloaded.sitePlan)).toBe(siteHash);
    expect(reloaded.architecturalDesignDocument.sceneObjects).toEqual(before.architecturalDesignDocument.sceneObjects);
  });

  it("accepts a capability-needed plan without repair or an invented substitute", async () => {
    const beforeJson = await existingProject();
    answerPlan({
      intent: "Make the unavailable architectural form.", status: "capability-needed", operations: [],
      capabilityNeeds: [{ capability: "continuous-curved-shell", reason: "The available scene primitives cannot express the requested continuous form." }],
    });
    const { res, body } = await edit("Make a continuous curved shell.", beforeJson);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ outcome: "capability-needed", changes: [], capabilityNeeds: [{ capability: "continuous-curved-shell" }] });
    expect(body.json).toBe(beforeJson);
    expect(architectCalls()).toHaveLength(1);
  });

  it("repairs a genuinely invalid empty plan to an evidence-backed no-op, never a create", async () => {
    const beforeJson = await existingProject();
    answerPlan(
      { intent: "Unsubstantiated empty answer.", operations: [] },
      { intent: "Confirm existing condition.", status: "already-satisfied", rationale: "The requested semantic object is already present.", operations: [] },
    );
    const { res, body } = await edit("Confirm the existing condition.", beforeJson);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ outcome: "already-satisfied", changes: [] });
    expect(body.json).toBe(beforeJson);
    expect(architectCalls()).toHaveLength(2);
    expect((body.editPlan as SceneEditPlan).operations).toEqual([]);
  });

  it("repairs an invalid target from compact structured feedback and commits only the corrected plan", async () => {
    const beforeJson = await existingProject();
    const before = parse(beforeJson);
    answerPlan(
      { intent: "Change a missing target.", operations: [{ op: "changeMaterial", target: "scene:not-present", material: { color: "#315b48" } }] },
      { intent: "Change the available main-mass finish instead.", operations: [{ op: "changeMaterial", target: "mass:mass-0", material: { color: "#315b48" } }] },
    );

    const { res, body } = await edit("Refine the main exterior finish.", beforeJson);

    expect(res.status).toBe(200);
    expect(architectCalls()).toHaveLength(2);
    const repair = architectCalls()[1].messages[0].content;
    expect(repair).toContain('"status":"invalid-plan"');
    expect(repair).toContain('"code":"TARGET_NOT_FOUND"');
    expect(repair).toContain('"availableTargetIds"');
    expect(repair).not.toContain(JSON.stringify({ document: before.architecturalDesignDocument }));
    const after = parse(body.json!);
    expect(after.architecturalDesignDocument.sceneObjects).toEqual(before.architecturalDesignDocument.sceneObjects);
    expect(after.architecturalDesignDocument.materialOverrides).toContainEqual({ target: "mass:mass-0", material: { color: "#315b48" } });
  });

  it("allows two distinct repairs but never carries failed partial operations forward", async () => {
    const beforeJson = await existingProject();
    answerPlan(
      { intent: "Create then wrongly edit a missing scene object.", operations: [{ op: "create", object: { kind: "scene", scene: { id: "discarded-post", kind: "post", label: "Discarded post", position: [25, 1, 18], size: [.2, 2, .2] } } }, { op: "delete", target: "scene:not-present" }] },
      { intent: "Use an invalid size while revising.", operations: [{ op: "create", object: { kind: "scene", scene: { id: "discarded-post", kind: "post", label: "Discarded post", position: [25, 1, 18], size: [.2, 2, .2] } } }, { op: "resize", target: "scene:discarded-post", size: [.2, -2, .2] }] },
      { intent: "Create the requested boundary post.", operations: [{ op: "create", object: { kind: "scene", scene: { id: "final-post", kind: "post", label: "Final post", position: [25, 1, 18], size: [.2, 2, .2] } } }] },
    );

    const { res, body } = await edit("Add one boundary post.", beforeJson);

    expect(res.status).toBe(200);
    expect(architectCalls()).toHaveLength(3);
    const after = parse(body.json!);
    expect(after.architecturalDesignDocument.sceneObjects).toContainEqual(expect.objectContaining({ id: "final-post" }));
    expect(after.architecturalDesignDocument.sceneObjects).not.toContainEqual(expect.objectContaining({ id: "discarded-post" }));
  });

  it("modifies an existing stable target instead of creating a duplicate semantic object", async () => {
    const before = parse(await existingProject());
    answerPlan({ intent: "Refine the existing main mass finish.", operations: [{ op: "changeMaterial", target: "mass:mass-0", material: { color: "#315b48", roughness: .72 } }] });
    const { res, body } = await edit("Improve the existing main facade finish.", JSON.stringify(before));
    expect(res.status).toBe(200);
    expect((body.editPlan as SceneEditPlan).operations).toEqual([expect.objectContaining({ op: "changeMaterial", target: "mass:mass-0" })]);
    const after = parse(body.json!);
    expect(after.architecturalDesignDocument.massing.masses[0].assemblies).toEqual(before.architecturalDesignDocument.massing.masses[0].assemblies);
    expect(after.architecturalDesignDocument.sceneObjects).toEqual(before.architecturalDesignDocument.sceneObjects);
    expect(after.architecturalDesignDocument.materialOverrides).toContainEqual({ target: "mass:mass-0", material: { color: "#315b48", roughness: .72 } });
  });

  it("routes an existing rendered furniture move through the operation plan and persists grounded asset transforms", async () => {
    const before = parse(await existingProject());
    const assets: OutdoorAssetPlacement[] = [
      { id: "existing-chair-a", assetId: "procedural-v2-chair", parentSpaceId: "patio-group", category: "furniture", role: "lounge-armchair", position: [-2, 3, 8], rotation: [0, 0, 0], scale: 1, dimensions: { width: .9, depth: .9, height: .8 }, localBounds: { min: [-.45, 0, -.45], max: [.45, .8, .45] } },
      { id: "existing-table", assetId: "procedural-v2-table", parentSpaceId: "patio-group", category: "furniture", role: "side-table", position: [0, 3, 8], rotation: [0, 0, 0], scale: 1, dimensions: { width: .7, depth: .7, height: .55 }, localBounds: { min: [-.35, 0, -.35], max: [.35, .55, .35] } },
      { id: "existing-chair-b", assetId: "procedural-v2-chair", parentSpaceId: "patio-group", category: "furniture", role: "lounge-armchair", position: [2, 3, 8], rotation: [0, Math.PI, 0], scale: 1, dimensions: { width: .9, depth: .9, height: .8 }, localBounds: { min: [-.45, 0, -.45], max: [.45, .8, .45] } },
    ];
    const project = { ...before, outdoorAssetPlacements: assets };
    answerPlan({ intent: "Ground the existing patio furniture without recreating it.", operations: [
      { op: "move", target: "asset:existing-chair-a", position: [-2, 99, 8] },
      { op: "move", target: "asset:existing-table", position: [0, 99, 8] },
      { op: "move", target: "asset:existing-chair-b", position: [2, 99, 8] },
    ] });

    const prompt = "Move the floating chairs and table down onto the patio so they sit naturally on the ground surface. Keep their general arrangement, scale, and orientation sensible, and do not change the house, windows, roof, pool, landscaping, or other furniture.";
    const { res, body } = await edit(prompt, JSON.stringify(project));

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ operation: "architecturalEdit", changes: ["move asset:existing-chair-a", "move asset:existing-table", "move asset:existing-chair-b"] });
    expect((body.editPlan as SceneEditPlan).operations).toHaveLength(3);
    const after = parse(body.json!);
    expect(after.architecturalDesignDocument).toEqual(project.architecturalDesignDocument);
    expect(after.outdoorAssetPlacements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "existing-chair-a", position: [-2, 0, 8], support: { kind: "patio", elevation: 0 } }),
      expect.objectContaining({ id: "existing-table", position: [0, 0, 8], support: { kind: "patio", elevation: 0 } }),
      expect.objectContaining({ id: "existing-chair-b", position: [2, 0, 8], support: { kind: "patio", elevation: 0 } }),
    ]));
    const call = architectCalls()[0].messages[0].content;
    expect(call).toContain("asset:existing-chair-a");
    expect(call).toContain("semanticType");
    expect(call).not.toContain("addV2Placement");
  });

  it("repairs a meaningless asset detach by moving the same stable target directly", async () => {
    const before = parse(await existingProject());
    const asset: OutdoorAssetPlacement = {
      id: "floating-set-seat", assetId: "procedural-v2-chair", parentSpaceId: "patio-group", category: "furniture", role: "lounge-armchair",
      position: [0, 3, 8], rotation: [0, 0, 0], scale: 1, dimensions: { width: .9, depth: .9, height: .8 },
      localBounds: { min: [-.45, 0, -.45], max: [.45, .8, .45] }, support: { kind: "roof", elevation: 3, massId: "mass-0" },
    };
    const project = { ...before, outdoorAssetPlacements: [asset] };
    answerPlan(
      { intent: "Detach then relocate the set.", operations: [
        { op: "detach", target: "asset:floating-set-seat" },
        { op: "move", target: "asset:floating-set-seat", position: [0, 99, 8] },
      ] } as unknown as SceneEditPlan,
      { intent: "Relocate the supported set directly.", operations: [
        { op: "move", target: "asset:floating-set-seat", position: [0, 99, 8] },
      ] },
    );

    const { res, body } = await edit("Move the existing floating patio set down onto the patio.", JSON.stringify(project));

    expect(res.status).toBe(200);
    expect(architectCalls()).toHaveLength(2);
    const repair = architectCalls()[1].messages[0].content;
    expect(repair).toContain('"code":"UNSUPPORTED_OPERATION"');
    expect(repair).toContain("asset:floating-set-seat");
    expect(parse(body.json!).outdoorAssetPlacements).toEqual(expect.arrayContaining([expect.objectContaining({
      id: "floating-set-seat", position: [0, 0, 8], support: { kind: "patio", elevation: 0 },
    })]));
  });

  it("returns candidate integrity evidence to the same bounded plan-repair loop", async () => {
    const before = parse(await existingProject());
    const asset: OutdoorAssetPlacement = {
      id: "movable-outdoor-seat", assetId: "procedural-v2-chair", parentSpaceId: "garden", category: "furniture", role: "lounge-armchair",
      position: [14, 0, 14], rotation: [0, 0, 0], scale: 1, dimensions: { width: .9, depth: .9, height: .8 },
      localBounds: { min: [-.45, 0, -.45], max: [.45, .8, .45] }, support: { kind: "terrain", elevation: 0 },
    };
    const project = { ...before, outdoorAssetPlacements: [asset] };
    answerPlan(
      { intent: "Move the existing seat, but the first location is invalid.", operations: [{ op: "move", target: "asset:movable-outdoor-seat", position: [0, 99, 0] }] },
      { intent: "Move the existing seat to the covered patio.", operations: [{ op: "move", target: "asset:movable-outdoor-seat", position: [0, 99, 8] }] },
    );

    const { res, body } = await edit("Move the existing seat onto the patio.", JSON.stringify(project));

    expect(res.status).toBe(200);
    expect(architectCalls()).toHaveLength(2);
    const repair = architectCalls()[1].messages[0].content;
    expect(repair).toContain('"code":"COLLISION"');
    expect(repair).toContain("asset:movable-outdoor-seat");
    expect(repair).toContain("mass:mass-0");
    expect(repair).not.toContain('"boundsUsed"');
    expect(parse(body.json!).outdoorAssetPlacements).toEqual(expect.arrayContaining([expect.objectContaining({
      id: "movable-outdoor-seat", position: [0, 0, 8], support: { kind: "patio", elevation: 0 },
    })]));
  });

  it("rolls back every operation when one operation is invalid", async () => {
    const beforeJson = await existingProject();
    answerPlan({ intent: "invalid atomic edit", operations: [
      { op: "create", object: { kind: "scene", scene: { id: "temporary-post", kind: "post", label: "Temporary post", position: [25, 1, 18], size: [.2, 2, .2] } } },
      { op: "delete", target: "scene:not-present" },
    ] });
    const { res, body } = await edit("Add a boundary marker.", beforeJson);
    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/nonexistent/);
    expect(await existingProject()).toBe(beforeJson);
    // Both bounded attempts are built from the single exported operation-plan response schema.
    const calls = architectCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].output).toBeDefined();
    expect(calls[1].output).toBeDefined();
  });

  it.each([
    "add a fence", "add a gate", "create a garden wall", "extend the driveway", "add a covered walkway", "move the pool farther back",
    "add a koi-pond bridge with a lantern arch",
  ])("routes %j to the Architect instead of rejecting its unknown noun", async (prompt) => {
    const before = await existingProject();
    answer(NO_CHANGE_SCOPE, parse(before).architecturalDesignDocument);
    const { res, body } = await edit(prompt, before);
    expect(architectCalls().length).toBeGreaterThan(0);
    expect(architectCalls()[0].messages.at(-1)!.content).toContain(prompt);
    expect(body.code).not.toMatch(/^(UNSUPPORTED_OBJECT|NOT_ADDITIVE)$/);
    // An Architect that cannot express it leaves the project untouched and records a Capability Need, never a substitute.
    expect(res.status).toBe(422);
    expect(body).toMatchObject({ code: "ARCHITECTURAL_EDIT_FAILED", capabilityNeedId: "capability-architect-edit-vocabulary" });
    expect(body.json).toBeUndefined();
    expect(network).not.toHaveBeenCalled();
  });

  it("returns the Architect's declared scope with the accepted change set", async () => {
    const before = parse(await existingProject());
    answer(ENTRANCE_SCOPE, entranceEdit(before.architecturalDesignDocument));
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(200);
    expect(body.editScope).toEqual(ENTRANCE_SCOPE);
  });

  it("rejects a candidate that changes the roof and Site Plan outside its declared entrance scope", async () => {
    const before = parse(await existingProject());
    const overreach = withRoof(entranceEdit(before.architecturalDesignDocument), { kind: "shed", pitch: 8, expression: undefined });
    const movedPool = { ...clone(before.sitePlan as Record<string, unknown>) } as { pool: { distance: number } };
    movedPool.pool.distance += 2;
    generateText.mockImplementation(() => Promise.resolve({ output: { document: overreach, scope: ENTRANCE_SCOPE, sitePlan: movedPool }, totalUsage: {} }));
    const { res, body } = await edit(ENTRANCE_PROMPT, JSON.stringify(before));
    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/main-living\.roof: changed \[UNRELATED\]/);
  });

  it("rejects a changed document that declares no scope", async () => {
    const beforeJson = await existingProject();
    const before = parse(beforeJson);
    answer(undefined, entranceEdit(before.architecturalDesignDocument));
    const { res, body } = await edit(ENTRANCE_PROMPT, beforeJson);
    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/scope.*expected object/);
    expect(await existingProject()).toBe(beforeJson);
  });

  it("applies a declared site-domain edit (move the pool) with its bounded dependent reflow, leaving architecture untouched", async () => {
    const before = parse(await existingProject());
    const plan = clone(before.sitePlan) as { pool: { distance: number }; poolDeck: { z: number } };
    plan.pool.distance += 2;
    plan.poolDeck.z += 2;
    const scope: ArchitecturalEditScope = { intent: "Move the pool farther back.", targets: [{ element: "site:pool", action: "modify" }] };
    const output = {
      document: before.architecturalDesignDocument, sitePlan: plan,
      scope,
      reflow: { elements: [{ id: "site:poolDeck", action: "move", dependsOn: "site:pool", reason: "The deck follows the relocated pool edge." },
        { id: "site:path:outdoor-living>pool:3", action: "reroute", dependsOn: "site:pool", reason: "The terrace-to-pool path follows the pool." }] },
    };
    generateText.mockImplementation(() => Promise.resolve({ output, totalUsage: {} }));
    const { res, body } = await edit("move the pool farther back", JSON.stringify(before));
    expect(body.conflicts).toBeUndefined();
    expect(res.status).toBe(200);
    const after = parse(body.json!);
    // Site Plan normalization replaces only `sitePlan`; it must preserve the required edit envelope scope.
    expect(body.editScope).toEqual(scope);
    expect(after.architecturalDesignDocument).toEqual(before.architecturalDesignDocument);
    expect((after.sitePlan as typeof plan).pool.distance).toBe(plan.pool.distance);
    expect(after.outdoorAssetPlacements).toEqual(before.outdoorAssetPlacements);
  });

  it("keeps the placer's own ARCHITECTURAL_EDIT guard: it still refuses architecture handed to it directly", async () => {
    const { placeV2AdditiveAsset } = await import("@/lib/architecture/v2AdditivePlacement");
    const result = placeV2AdditiveAsset(parse(await existingProject()), ENTRANCE_PROMPT, [], []);
    expect(result).toMatchObject({ ok: false, code: "ARCHITECTURAL_EDIT" });
  });
});
