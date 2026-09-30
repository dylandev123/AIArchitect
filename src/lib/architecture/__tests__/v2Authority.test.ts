import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalIntent } from "../designEngine";
import type { ArchitecturalDesignDocument, MassVolume, RoofRecipe, SiteStrategy } from "../document";
import { compileArchitecture, resolveMasses } from "../compiler";
import { realizeVolumePlan, withVolumePlan } from "../volumePlan";
import { architectureAuthorityHash, sitePlanAuthorityHash } from "../stages/authority";
import { runV2IntegrityGate } from "../stages/integrityGate";
import { isV2GenerationFailure } from "../stages/recovery";
import { normalizeSitePlan, sitePlanOperations, sitePlanSchema, type SitePlan } from "../stages/sitePlanStage";
import { sitePlanContextForDocument } from "../sitePlanContext";
import { authoredPlan, authoredRoof, QUIET_PLAN, referenceGeometry } from "./authoredFixtures";
import { responderOutputs } from "./v2StageResponder";

/**
 * Deterministic regressions for V2 AI design authority (no live AI call — every model answer is mocked): the
 * compiler and pipeline execute, normalize and validate what the AI authored, and never author it themselves.
 */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));
beforeEach(() => { generateText.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key"); });

const usage = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test" };
const site: SiteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" };
const intent: ArchitecturalIntent = {
  mood: ["calm"], spatialGoals: ["indoor-outdoor"], environmentalGoals: ["daylight"], hierarchyGoals: ["living dominates"], compositionBias: "asymmetrical",
  source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "modern" },
};
const pending = { status: "pending" as const };
const mass = (id: string, over: Partial<MassVolume> = {}): MassVolume => ({ id, name: id, role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0, ...over });
const doc = (masses: MassVolume[], roofs: RoofRecipe[] = masses.map((m) => authoredRoof(m.id)), capabilities: ArchitecturalDesignDocument["capabilities"] = []): ArchitecturalDesignDocument => ({
  version: 1, brief: "A luxury villa with outdoor living", siteStrategy: site, massing: { composition: "pavilion-cluster", masses }, roofs: { recipes: roofs }, capabilities,
  facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "stage-pipeline", compiler: "procedural-architecture-v1" },
});
const compile = (d: ArchitecturalDesignDocument) => compileArchitecture(d, { materials: DEFAULT_MATERIALS_CONFIG });
const messageOf = (call: number) => (generateText.mock.calls[call][0] as { messages: { content: string }[] }).messages[0].content;

describe("masses: placement is executed from authored relationships, never designed", () => {
  it("does not invent courtyard orientation: wings are not turned toward the void unless the architect turned them", () => {
    const anchor = mass("living", { width: 16 });
    const west = mass("west", { role: "bedroom-wing", width: 6, depth: 12, relationships: [{ kind: "surrounds-courtyard", target: "living", side: "west", distance: 3 }] });
    const east = mass("east", { role: "guest-pavilion", width: 6, depth: 12, relationships: [{ kind: "surrounds-courtyard", target: "living", side: "east", distance: 3, rotationOffset: -Math.PI / 2 }] });
    const resolved = resolveMasses({ siteStrategy: site, massing: { masses: [anchor, west, east] } });
    // Coordinates are still resolved from the authored relationship…
    expect(resolved[1].position.x).toBe(-8 - 3 - 3);
    // …but the unturned wing keeps its authored rotation, and only the explicitly authored one turns.
    expect(resolved[1].rotation).toBe(0);
    expect(resolved[2].rotation).toBeCloseTo(-Math.PI / 2);
    expect(compile(doc(resolved)).diagnostics!.courtyards).toEqual([expect.objectContaining({ anchorMassId: "living", enclosingMassIds: ["west", "east"] })]);
  });

  it("does not let a role invent a plan: an unauthored plan realizes nothing, for any role", () => {
    for (const role of ["main-living", "bedroom-wing", "guest-pavilion", "garage", "service", "connector", "terrace", "entry"] as const) {
      const m = withVolumePlan(mass("m", { role }), undefined);
      const r = realizeVolumePlan(m, [m], site);
      expect([r.operations, r.openings, r.capabilityIntents, m.height], role).toEqual([[], [], [], undefined]);
    }
  });
});

describe("geometry and facades: the Geometry Pass authors them; nothing is restored or invented", () => {
  it("compiles no glazing, windows or doors the architect did not author — for any role", () => {
    const { model } = compile(doc([mass("living"), mass("bed", { role: "bedroom-wing", position: { x: 20, z: 0 } }), mass("entry", { role: "entry", position: { x: -20, z: 0 } })]));
    expect(model.primitives.filter((p) => p.category === "window")).toEqual([]);
    expect(model.primitives.some((p) => /door/i.test(p.label))).toBe(false);
  });

  it("builds a door-less entry recess solid and blocks it, instead of adding a default door", () => {
    const d = doc([mass("living", { operations: [{ type: "entry-recess", facade: "north", width: 3, depth: 1.2 }] })]);
    const { model, diagnostics } = compile(d);
    expect(model.primitives.some((p) => /door/i.test(p.label))).toBe(false);
    expect(diagnostics!.geometry[0].warnings).toEqual([expect.stringMatching(/no authored door/)]);
  });

  it.each([
    ["terrace", (op: { type: string; open?: boolean }) => op.open === true, /outdoor room/],
    ["entry door", (op: { type: string }) => op.type === "door", /door on the north facade/],
    ["entry recess", (op: { type: string }) => op.type === "entry-recess", /entry-recess on the north facade/],
    ["view glazing", (op: { type: string; facade?: string }) => op.type === "glazing-zone" && op.facade === "south", /glazing-zone on the south facade/],
  ])("sends a missing planned %s back to the Geometry Pass as repair-required, then fails — never restores it", async (_label, drop, missing) => {
    const { runGeometryStage } = await import("../stages/geometryStage");
    const living = withVolumePlan(mass("mass-0", { width: 16, depth: 10 }), authoredPlan("main-living", { entry: "recessed" }));
    const authored = referenceGeometry(living, [living], site).filter((op) => !drop(op as never));
    generateText.mockResolvedValue({ output: { results: [{ massId: "mass-0", operations: authored }] }, totalUsage: {} });
    const result = await runGeometryStage({ brief: "x", intent, siteStrategy: site, masses: [living] }, createTimings(), 60_000, usage);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(messageOf(1)).toMatch(/\[repair-required:/);
    expect(messageOf(1)).toMatch(missing);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("byMassId");
  });
});

describe("roofs: Roof Composition authors every recipe", () => {
  const living = withVolumePlan(mass("mass-0"), QUIET_PLAN);
  const roofCtx = { intent, siteStrategy: site, masses: [living] };

  it("never turns an invalid or missing recipe into a flat fallback: it is repaired or the stage fails", async () => {
    const { runRoofCompositionStage } = await import("../stages/roofStage");
    generateText.mockResolvedValue({ output: { roofs: [{ massId: "mass-0", kind: "mixed", overhang: 0.5, pitch: 10 }] }, totalUsage: {} });
    const unbuildable = await runRoofCompositionStage(roofCtx, createTimings(), 60_000, usage);
    expect(unbuildable.ok).toBe(false);
    expect(messageOf(1)).toMatch(/repair-required:roof-unbuildable mass-0/);

    generateText.mockReset();
    generateText.mockResolvedValue({ output: { roofs: [] }, totalUsage: {} });
    const missing = await runRoofCompositionStage(roofCtx, createTimings(), 60_000, usage);
    expect(missing.ok).toBe(false);
    expect(missing).not.toHaveProperty("value");
  });

  it("stops the whole generation when roofs fail — no fallback roof reaches the document", async () => {
    const { runArchitecturePipeline } = await import("../stages/pipeline");
    generateText.mockImplementation((options: { system: string }) => {
      const system = options.system;
      const output = system.includes("three foundational decisions") ? responderOutputs.foundation()
        : system.includes("one volume at a time") ? responderOutputs.massExpansion()
        : system.includes("authoring the built form") ? responderOutputs.geometry()
        : { roofs: [{ massId: "mass-0", kind: "flat" }] };
      return Promise.resolve({ output, totalUsage: {} });
    });
    const failure = await runArchitecturePipeline({ brief: "A calm pavilion", hints: { viewDirection: "south", approachSide: "north", environment: "beach" } }, createTimings(), 120_000, usage).catch((e: unknown) => e);
    expect(isV2GenerationFailure(failure) && failure.stage).toBe("roof-composition");
    expect(isV2GenerationFailure(failure) && failure.conflicts.join(" ")).toMatch(/roof-incomplete/);
  });

  it("never lets a library recipe overwrite the authored kind, pitch or overhang after authorship", async () => {
    const { runRoofCompositionStage } = await import("../stages/roofStage");
    const authored = { massId: "mass-0", kind: "shed", overhang: 0.45, pitch: 9 };
    const recipe = { id: "hip-lib", name: "Library Hip", category: "roof", styleTags: [], compatibleScales: [], environmentTags: [], parameters: [{ key: "system", value: "standing-seam" }, { key: "kind", value: "hip" }, { key: "pitch", value: 35 }, { key: "overhang", value: 2 }], relationships: [], guidance: [], usageCount: 0, successCount: 0, failureCount: 0, approval: "approved", version: 1, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" } as never;
    generateText.mockResolvedValueOnce({ output: { libraryRecipeId: "hip-lib", roofs: [authored] }, totalUsage: {} });
    const result = await runRoofCompositionStage({ ...roofCtx, approvedRecipes: [recipe] }, createTimings(), 60_000, usage);
    expect(result.ok && result.value).toEqual([{ id: "mass-0-roof", massId: "mass-0", kind: "shed", overhang: 0.45, pitch: 9 }]);
  });

  it("allows an intent-preserving eave trim (a normalization) and blocks one that would change the roof", () => {
    const a = mass("a", { width: 10 }), b = mass("b", { width: 10, position: { x: 10, z: 0 } });
    const trimmed = compile(doc([a, b], [authoredRoof("a", { overhang: 0.6 }), authoredRoof("b", { overhang: 0.5 })]));
    expect(trimmed.diagnostics!.roofClearance).toEqual([
      expect.objectContaining({ massId: "a", authored: 0.6, cleared: 0.3, preservesLanguage: true }),
      expect.objectContaining({ massId: "b", authored: 0.5, cleared: 0.3, preservesLanguage: true }),
    ]);
    const gate = (d: ArchitecturalDesignDocument) => import("../stages/qualityGate").then(({ runDesignQualityGate }) => runDesignQualityGate(d, compile(d).diagnostics!));
    return Promise.all([
      gate(doc([a, b], [authoredRoof("a", { overhang: 0.6 }), authoredRoof("b", { overhang: 0.5 })])).then((g) => expect(g.blocking).toEqual([])),
      gate(doc([a, b], [authoredRoof("a", { overhang: 1.5, kind: "floating-flat" }), authoredRoof("b")])).then((g) => expect(g.blocking.map((c) => c.id)).toContain("roof-integrity-a")),
    ]);
  });
});

describe("site plan: execution only — snapping and routing stay allowed", () => {
  const living = { ...mass("mass-0", { width: 18, depth: 10 }), operations: [], openings: [{ type: "door" as const, facade: "north" as const, start: 0.45, end: 0.55 }] };
  const d = doc([living]);
  const ctx = sitePlanContextForDocument(d.brief, d)!;

  it("snaps path end points to the geometry they name and carries a building-crossing path around it, keeping its end points", () => {
    const plan: SitePlan = sitePlanSchema.parse(normalizeSitePlan(responderOutputs.sitePlan(), ctx));
    // Snapped: the entrance path starts at the actual door, the terrace path at the terrace.
    const entranceToTerrace = plan.paths.find((p) => p.from === "entrance")!;
    expect([entranceToTerrace.x1, entranceToTerrace.z1]).toEqual([0, -5]);
    const executed = sitePlanOperations(plan, ctx.masses).filter((op) => op.op === "addPath").map((op) => op.value as { x1: number; z1: number; x2: number; z2: number });
    expect(executed.length).toBeGreaterThan(plan.paths.length);
    const detour = executed.filter((p) => !plan.paths.some((q) => q.x1 === p.x1 && q.z1 === p.z1 && q.x2 === p.x2 && q.z2 === p.z2));
    expect([detour[0].x1, detour[0].z1]).toEqual([entranceToTerrace.x1, entranceToTerrace.z1]);
    expect([detour[detour.length - 1].x2, detour[detour.length - 1].z2]).toEqual([entranceToTerrace.x2, entranceToTerrace.z2]);
  });
});

describe("the final integrity gate inspects the saved artifact", () => {
  const living = { ...withVolumePlan(mass("mass-0", { width: 18, depth: 10 }), QUIET_PLAN), operations: [], openings: [{ type: "door" as const, facade: "north" as const, start: 0.45, end: 0.55 }] };
  const d = doc([living]);
  const ctx = sitePlanContextForDocument(d.brief, d)!;
  const plan: SitePlan = sitePlanSchema.parse(normalizeSitePlan(responderOutputs.sitePlan(), ctx));
  const keys: Record<string, string> = { addDriveway: "driveways", addParking: "parking", addPool: "pools", addPatio: "patios", addDeck: "decks", addPath: "paths", addLandscape: "landscaping" };
  /** The project JSON Final Assembly would save: the document, the canonical plan, and the plan executed into site features. */
  const artifact = (overrides: Record<string, unknown> = {}, document: ArchitecturalDesignDocument = d, sitePlan: SitePlan = plan) => {
    const root: Record<string, unknown> = { architecturalDesignDocument: document, sitePlan };
    for (const op of sitePlanOperations(sitePlan, sitePlanContextForDocument(document.brief, document)!.masses)) { const key = keys[op.op]; root[key] = [...((root[key] as unknown[]) ?? []), { id: `${key}-x`, ...(op.value as object) }]; }
    return JSON.stringify({ ...root, ...overrides });
  };
  const authority = { architectureHash: architectureAuthorityHash(d), sitePlanHash: sitePlanAuthorityHash(plan) };

  it("passes a faithful artifact, reporting routing as a normalization", () => {
    const gate = runV2IntegrityGate({ json: artifact(), brief: d.brief, authority });
    expect(gate.blocking).toEqual([]);
    expect(gate.outcome).toBe("normalized");
    expect(gate.normalizations.join(" ")).toMatch(/routed around the building/);
  });

  it("blocks unauthorized downstream mutation of the architecture or the Site Plan", () => {
    const moved = { ...d, massing: { ...d.massing, masses: [{ ...living, width: 20 }] } };
    const blocked = runV2IntegrityGate({ json: artifact({ architecturalDesignDocument: moved }), brief: d.brief, authority });
    expect(blocked.passed).toBe(false);
    expect(blocked.blocking.map((c) => c.id)).toContain("authority-architecture");
    const replanned = runV2IntegrityGate({ json: artifact({ sitePlan: { ...plan, pool: { ...plan.pool, width: 6 } } }), brief: d.brief, authority });
    expect(replanned.blocking.map((c) => c.id)).toEqual(expect.arrayContaining(["authority-site-plan", "authority-site-geometry"]));
  });

  it("blocks a missing canonical Site Plan, a pool built inside a building mass, and a scene asset placed inside one", () => {
    expect(runV2IntegrityGate({ json: artifact({ sitePlan: undefined }), brief: d.brief, authority }).blocking.map((c) => c.id)).toContain("site-plan-canonical");
    // A pavilion standing exactly where the authored pool is executed (south wall + 9m, 14m wide).
    const withPavilion = doc([living, { ...withVolumePlan(mass("mass-1", { role: "guest-pavilion", width: 8, depth: 6, position: { x: 0, z: 17 } }), QUIET_PLAN), operations: [], openings: [] }]);
    const collided = runV2IntegrityGate({ json: artifact({}, withPavilion), brief: d.brief, authority: { ...authority, architectureHash: architectureAuthorityHash(withPavilion) } });
    expect(collided.blocking.map((c) => c.id)).toEqual(["site-plan-integrity", "site-path-clear-of-building"]);
    expect(collided.blocking[0].detail).toMatch(/The pool runs .*into building mass "mass-1"/);
    const asset = { id: "a", assetId: "lounger", parentSpaceId: "s", category: "furniture", role: "sun-lounger", position: [0, 0, 0], rotation: [0, 0, 0], dimensions: { width: 1, depth: 2, height: 0.5 } };
    expect(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [asset] }), brief: d.brief, authority }).blocking.map((c) => c.id)).toContain("scene-assets-clear-of-building");
  });

  it("blocks missing planned geometry and material mass collisions in the saved document", () => {
    const planned = withVolumePlan(mass("mass-0", { width: 18, depth: 10 }), authoredPlan("main-living"));
    const withoutPlanGeometry = doc([{ ...planned, operations: [], openings: [{ type: "door", facade: "north", start: 0.45, end: 0.55 }] }]);
    const gate1 = runV2IntegrityGate({ json: JSON.stringify({ ...JSON.parse(artifact()), architecturalDesignDocument: withoutPlanGeometry }), brief: d.brief, authority: { ...authority, architectureHash: architectureAuthorityHash(withoutPlanGeometry) } });
    expect(gate1.blocking.map((c) => c.id)).toContain("plan-realized-mass-0");
    const collided = doc([living, { ...mass("mass-1", { role: "bedroom-wing", position: { x: 4, z: 1 } }), operations: [] }]);
    const gate2 = runV2IntegrityGate({ json: JSON.stringify({ ...JSON.parse(artifact()), architecturalDesignDocument: collided }), brief: d.brief, authority: { ...authority, architectureHash: architectureAuthorityHash(collided) } });
    expect(gate2.blocking.map((c) => c.id)).toContain("no-unintentional-overlap");
  });
});
