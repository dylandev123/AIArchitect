import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { z } from "zod";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalIntent } from "../designEngine";
import { AUTHORED_ROOF_RECIPE_KINDS, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument, type AuthoredRoofRecipe, type MassVolume, type RoofRecipe, type SiteStrategy } from "../document";
import { compileArchitecture, resolveMasses } from "../compiler";
import { buildFloorFootprint } from "../geometry/footprint";
import { realizeVolumePlan, withVolumePlan } from "../volumePlan";
import { architectureAuthorityHash, sitePlanAuthorityHash } from "../stages/authority";
import { roofConflicts } from "../stages/integrityChecks";
import { runV2IntegrityGate } from "../stages/integrityGate";
import { runDesignQualityGate } from "../stages/qualityGate";
import { isV2GenerationFailure } from "../stages/recovery";
import { normalizeSitePlan, sitePlanOperations, sitePlanSchema, type SitePlan } from "../stages/sitePlanStage";
import { sitePlanContextForDocument } from "../sitePlanContext";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { authoredPlan, authoredRoof, QUIET_PLAN, referenceGeometry } from "./authoredFixtures";
import { architectDocument, responderOutputs } from "./v2StageResponder";
import type { architectOutputSchema } from "../stages/architectStage";

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
    ["form move", (op: { type: string }) => op.type === "notch", /notch/],
  ])("sends a missing Geometry-owned planned %s back to the Geometry Pass as repair-required, then fails — never restores it", async (_label, drop, missing) => {
    const { runGeometryStage } = await import("../stages/geometryStage");
    const living = withVolumePlan(mass("mass-0", { width: 16, depth: 10 }), authoredPlan("main-living", { entry: "recessed", form: "l-shape" }));
    const authored = referenceGeometry(living, [living], site).filter((op) => !drop(op as never));
    generateText.mockResolvedValue({ output: { results: [{ massId: "mass-0", operations: authored }] }, totalUsage: {} });
    const result = await runGeometryStage({ brief: "x", intent, siteStrategy: site, masses: [living] }, createTimings(), 60_000, usage);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(messageOf(1)).toMatch(/\[repair-required:/);
    expect(messageOf(1)).toMatch(missing);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("byMassId");
  });

  it("executes the plan's entry door, entry recess and view glazing as the mandatory baseline — the Geometry Pass never has to author them", async () => {
    const { runGeometryStage } = await import("../stages/geometryStage");
    const living = withVolumePlan(mass("mass-0", { width: 16, depth: 10 }), authoredPlan("main-living", { entry: "recessed" }));
    generateText.mockResolvedValue({ output: { results: [{ massId: "mass-0", operations: referenceGeometry(living, [living], site) }] }, totalUsage: {} });
    const result = await runGeometryStage({ brief: "x", intent, siteStrategy: site, masses: [living] }, createTimings(), 60_000, usage);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(generateText).toHaveBeenCalledTimes(1);
    const built = result.byMassId.get("mass-0")!;
    expect(built.operations).toContainEqual(expect.objectContaining({ type: "entry-recess", facade: "north", id: "mass-0:plan:north-entry-recess" }));
    expect(built.openings).toContainEqual(expect.objectContaining({ type: "door", facade: "north", id: "mass-0:plan:north-door" }));
    expect(built.openings).toContainEqual(expect.objectContaining({ type: "glazing-zone", facade: "south", id: "mass-0:plan:south-glazing" }));
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

  it("stops the whole generation when the Architect's roof document fails — no fallback roof reaches the document", async () => {
    const { runArchitecturePipeline } = await import("../stages/pipeline");
    generateText.mockImplementation((options: { system: string }) => {
      const system = options.system;
      const output = system.includes("sole AI Architect")
        ? { document: { ...architectDocument(), roofs: { recipes: [{ id: "bad-roof", massId: "missing-mass", kind: "flat" }] } } }
        : responderOutputs.sitePlan();
      return Promise.resolve({ output, totalUsage: {} });
    });
    const failure = await runArchitecturePipeline({ brief: "A calm pavilion", hints: { viewDirection: "south", approachSide: "north", environment: "beach" } }, createTimings(), 120_000, usage).catch((e: unknown) => e);
    expect(isV2GenerationFailure(failure) && failure.stage).toBe("architect");
    expect(isV2GenerationFailure(failure) && failure.conflicts.join(" ")).toMatch(/roof/);
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
    const a = mass("a", { width: 10, openings: [{ type: "door", facade: "north", start: 0.45, end: 0.55 }] }), b = mass("b", { width: 10, position: { x: 10, z: 0 } });
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

describe("single Architect roof contract", () => {
  const threeMassDocument = (): ArchitecturalDesignDocument => {
    const ground = mass("ground-plinth", { name: "Ground plinth", width: 18, depth: 10 });
    const upper = mass("upper-sleeping-bar", { name: "Upper sleeping bar", role: "bedroom-wing", position: { x: 3, z: 1 }, width: 12, depth: 6, elevation: 3.2 });
    const terrace = mass("rear-terrace-canopy", { name: "Rear terrace canopy", role: "terrace", position: { x: 0, z: 8 }, width: 14, depth: 4 });
    return doc([ground, upper, terrace], [
      { id: "ground-plinth-roof", massId: ground.id, kind: "flat", overhang: .4, pitch: 2 },
      { id: "upper-sleeping-bar-roof", massId: upper.id, kind: "flat", overhang: .4, pitch: 2 },
      { id: "rear-terrace-canopy-roof", massId: terrace.id, kind: "floating-flat", overhang: .6, pitch: 2 },
    ]);
  };

  it("uses the same executable MassVolume shape that compileArchitecture consumes", async () => {
    const { architectOutputSchema } = await import("../stages/architectStage");
    const document = threeMassDocument();
    delete (document as Partial<ArchitecturalDesignDocument>).capabilities;
    expect(architectOutputSchema.safeParse({ document }).success).toBe(true);
    expect(validateArchitecturalDesignDocument(document, { requireRoofForEveryMass: true })).toEqual([]);
    expect(compile(document).errors).toEqual([]);
  });

  it("reports the exact missing executable fields and does not obscure them with downstream roof errors", () => {
    const malformed = threeMassDocument() as unknown as { massing: { masses: Record<string, unknown>[] } };
    malformed.massing.masses[0] = {
      id: "ground-plinth", name: "Ground plinth", role: "main-living",
      dimensions: { width: 18, depth: 10, height: 3.2 }, placement: { x: 0, z: 0 },
    };
    expect(validateArchitecturalDesignDocument(malformed, { requireRoofForEveryMass: true })).toEqual(expect.arrayContaining([
      "mass ground-plinth missing width; expected a finite number",
      "mass ground-plinth missing depth; expected a finite number",
      "mass ground-plinth missing floors; expected a finite number",
      "mass ground-plinth missing position",
      "mass ground-plinth missing elevation; expected a finite number",
      "mass ground-plinth missing rotation; expected a finite number",
    ]));
    expect(validateArchitecturalDesignDocument(malformed).join("\n")).not.toContain("ground-plinth-roof references unknown mass");
  });

  it("identifies the rejected Architect DTO field names instead of calling its masses generic malformed", () => {
    const rejectedShape = threeMassDocument() as unknown as { massing: { masses: Record<string, unknown>[] } };
    rejectedShape.massing.masses[0] = {
      id: "ground-plinth", position: { x: 0, z: 0 }, width: 18, depth: 10, floors: 1, elevation: 0, rotation: 0,
      geometry: { height: 3.25 }, footprintOperations: [],
      openings: [{ operation: "glazing-zone", face: "north", centerOffset: 0 }],
    };
    expect(validateArchitecturalDesignDocument(rejectedShape)).toEqual(expect.arrayContaining([
      "mass ground-plinth missing name",
      "mass ground-plinth missing; expected one of: main-living, bedroom-wing, guest-pavilion, garage, service, connector, terrace, veranda, entry",
      "mass ground-plinth uses unsupported geometry.height; use height",
      "mass ground-plinth uses unsupported footprintOperations; use operations",
      "mass ground-plinth openings[0] missing or invalid type; expected one of: door, glazing-zone, opening-rhythm",
    ]));
  });

  it("sends exact malformed-mass diagnostics and the previous document to the same Architect repair", async () => {
    const { runArchitectStage } = await import("../stages/architectStage");
    const malformed = threeMassDocument() as unknown as { massing: { masses: Record<string, unknown>[] } };
    malformed.massing.masses[0] = { id: "ground-plinth", name: "Ground plinth", role: "main-living", dimensions: { width: 18, depth: 10 } };
    generateText
      .mockResolvedValueOnce({ output: { document: malformed }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { document: threeMassDocument() }, totalUsage: {} });
    await runArchitectStage("Test residence", createTimings(), 60_000, usage);
    expect(messageOf(1)).toContain("mass ground-plinth missing width");
    expect(messageOf(1)).toContain("Previous document");
    expect(messageOf(1)).not.toContain("ground-plinth-roof references unknown mass");
  });

  it("uses only the mocked single Architect call; no legacy architecture stage is invoked", async () => {
    const { runArchitecturePipeline } = await import("../stages/pipeline");
    vi.stubEnv("ARCHITECTURE_LEGACY_STAGED", "0");
    generateText.mockResolvedValue({ output: responderOutputs.architect(), totalUsage: {} });
    const result = await runArchitecturePipeline({ brief: "Test residence", hints: { environment: "beach", viewDirection: "south", approachSide: "north" } }, createTimings(), 60_000, usage);
    expect(result.diagnostics).toEqual([expect.objectContaining({ stage: "architect", generationMode: "single-architect" })]);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect((generateText.mock.calls[0][0] as { system: string }).system).toContain("sole AI Architect");
  });

  it("turns an omitted roofs section into a same-Architect repair with the prior document and exact mass id", async () => {
    const { runArchitectStage } = await import("../stages/architectStage");
    const incomplete = architectDocument() as unknown as Record<string, unknown>;
    delete incomplete.roofs;
    generateText
      .mockResolvedValueOnce({ output: { document: incomplete }, totalUsage: {} })
      .mockResolvedValueOnce({ output: responderOutputs.architect(), totalUsage: {} });

    const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);

    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(messageOf(1)).toContain("missing roof recipe for mass: mass-0");
    expect(messageOf(1)).toContain("Previous document");
    expect(messageOf(1)).toContain("\"mass-0\"");
  });

  it("reports malformed roof containers as validation errors without throwing", () => {
    const incomplete = { ...architectDocument(), roofs: { recipes: {} } };
    expect(() => validateArchitecturalDesignDocument(incomplete, { requireRoofForEveryMass: true })).not.toThrow();
    expect(validateArchitecturalDesignDocument(incomplete, { requireRoofForEveryMass: true })).toEqual(expect.arrayContaining([
      "missing or malformed required section: roofs.recipes",
      "missing roof recipe for mass: mass-0",
    ]));
  });

  it("reproduces the former exact compiler exception from a mocked Architect operation with no facade", () => {
    let thrown: unknown;
    try {
      // This is the raw Architect shape that the old shallow boundary let reach the compiler. The
      // direct call intentionally bypasses document validation so the historical stack stays pinned.
      buildFloorFootprint(18, 10, [{ type: "recess", face: "south", start: .2, end: .8, depth: 1 } as never], 0);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe("Cannot read properties of undefined (reading 'push')");
    expect((thrown as Error).stack).toMatch(/geometry\/footprint\.ts:151/);
  });

  it("turns that malformed Architect document into a same-Architect validation repair before the compiler", async () => {
    const { runArchitectStage } = await import("../stages/architectStage");
    const malformed = architectDocument();
    malformed.massing.masses[0].operations = [{ type: "recess", face: "south", start: .2, end: .8, depth: 1 } as never];
    generateText
      .mockResolvedValueOnce({ output: { document: malformed }, totalUsage: {} })
      .mockResolvedValueOnce({ output: responderOutputs.architect(), totalUsage: {} });

    const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);

    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(messageOf(1)).toContain("mass mass-0 operations[0] missing; expected one of: north, south, east, west");
  });

  it("inspects the latest rejected Architect values and reports their executable mismatches field by field", async () => {
    const rejected = structuredClone(threeMassDocument()) as unknown as { siteStrategy: Record<string, unknown>; facade: Record<string, unknown>; metadata: Record<string, unknown>; massing: { masses: Record<string, unknown>[] }; roofs: { recipes: Record<string, unknown>[] } };
    rejected.siteStrategy.environment = "Level suburban garden plot; all dimensions are meters.";
    rejected.siteStrategy.terrain = "Building platform at elevation 0.00, with the garden falling gently away to the south.";
    rejected.massing.masses[0].relationships = [{ kind: "attached", target: "upper-sleeping-bar", distance: 0, side: "west" }];
    rejected.massing.masses[0].openings = [{ type: "glazing-zone" }];
    rejected.massing.masses[0].plan = { form: "11.6 by 8.0 rectangular primary bar", height: "Two stories", hierarchy: "Primary social volume", viewFacade: "South glazing", arrivalFacade: "North solid", flankFacades: "East windows", entry: "Entrance north", outdoor: "Covered terrace", outdoorSide: "south", roofEdge: "Thin dark parapet line", structure: "Steel frame" };
    rejected.facade.status = "Warm off-white mineral render";
    rejected.metadata.source = "Architect-authored executable residential design";
    rejected.metadata.compiler = "Residential Procedural Architecture Compiler";
    rejected.massing.masses[1].operations = [{ type: "notch", corner: "southeast", width: 1.15, depth: 1.35 }];
    rejected.massing.masses[2].operations = [{ type: "chamfer", corner: "southeast", size: .55 }];
    rejected.roofs.recipes = ["ground-plinth", "upper-sleeping-bar", "rear-terrace-canopy"].map((massId, index) => ({
      id: ["roof-main-living", "roof-bedroom-wing", "roof-rear-terrace"][index], massId, kind: "floating-flat", pitch: .035, orientation: "south", overhang: .45,
      parapet: "0.28 m dark metal parapet", floatingExpression: "45 mm shadow reveal",
    }));
    const errors = validateArchitecturalDesignDocument(rejected, { requireRoofForEveryMass: true });
    expect(errors).toEqual(expect.arrayContaining([
      'mass upper-sleeping-bar operations[0] invalid corner "southeast"; expected one of: nw, ne, se, sw',
      'mass rear-terrace-canopy operations[0] invalid corner "southeast"; expected one of: nw, ne, se, sw',
      'roof roof-main-living invalid orientation "south"; expected a finite number in radians',
      'roof roof-main-living invalid parapet "0.28 m dark metal parapet"; expected { height: number, thickness?: number }',
      'roof roof-main-living unsupported field floatingExpression; use expression',
      'siteStrategy invalid environment "Level suburban garden plot; all dimensions are meters."; expected one of: countryside, beach, cliff, hillside, farm, forest, suburban, urban',
      'mass ground-plinth relationships[0] invalid kind "attached"; expected one of: adjacent-to, connected-to, separated-from, surrounds-courtyard, bridge-between, view-facing, arrival-facing, offset-from, stepped-above, stepped-below',
      'mass ground-plinth openings[0] missing; expected one of: north, south, east, west',
      'mass ground-plinth plan invalid form "11.6 by 8.0 rectangular primary bar"; expected one of: bar, l-shape, prow, setback',
      'facade invalid status "Warm off-white mineral render"; expected "pending"',
      'metadata invalid compiler "Residential Procedural Architecture Compiler"; expected "procedural-architecture-v1"',
    ]));
    const { architectOutputSchema } = await import("../stages/architectStage");
    expect(architectOutputSchema.safeParse({ document: rejected }).success).toBe(false);
  });

  it("accepts every executable operation and roof recipe variant, then compiles the authored document", async () => {
    const variants = AUTHORED_ROOF_RECIPE_KINDS;
    const document = threeMassDocument() as ArchitecturalDesignDocument;
    delete (document as Partial<ArchitecturalDesignDocument>).capabilities;
    const primary = document.massing.masses[0];
    const operations: NonNullable<MassVolume["operations"]> = [
      { type: "recess", facade: "north", start: .1, end: .25, depth: .4, floors: "ground", open: true, postSpacing: 1.2 },
      { type: "projection", facade: "east", start: .3, end: .7, depth: .4, floors: "upper", open: false, postSpacing: 1.1 },
      { type: "notch", corner: "nw", width: .8, depth: .8, floors: "all" },
      { type: "notch", corner: "ne", width: .8, depth: .8 },
      { type: "entry-recess", facade: "south", width: 1.2, depth: .4 },
      { type: "chamfer", corner: "se", size: .6, glazed: true },
      { type: "chamfer", corner: "sw", size: .6 },
    ];
    const openings: NonNullable<MassVolume["openings"]> = [
      { type: "glazing-zone", facade: "south", start: .1, end: .4, heightRatio: .8, frame: true, reveal: .1 },
      { type: "opening-rhythm", facade: "west", count: 2, width: .5, height: 1.2, sill: .8, floors: "upper" },
      { type: "door", facade: "north", start: .45, end: .55, height: 2.3, frame: true, reveal: .05 },
    ];
    const masses = variants.map((kind, index): MassVolume => ({ ...primary, id: `mass-${index}`, name: `Mass ${index}`, position: { x: index * 30, z: 0 }, floors: 2, operations: index === 0 ? operations : [], openings: index === 0 ? openings : [] }));
    document.massing = { composition: "pavilion-cluster", masses };
    document.roofs = { recipes: variants.map((kind, index) => ({ id: `roof-${kind}`, massId: `mass-${index}`, kind, overhang: .4, pitch: kind === "flat" || kind === "floating-flat" ? 2 : 18, orientation: 0, ...(kind === "floating-flat" ? { expression: { verticalGap: .2, thickness: .18, supportStyle: "reveal" as const } } : {}), ...(kind === "flat" ? { parapet: { height: .3, thickness: .15 } } : {}) })) };
    const { architectOutputSchema, ARCHITECT_DOCUMENT_CONTRACT } = await import("../stages/architectStage");
    expect(architectOutputSchema.safeParse({ document }).success).toBe(true);
    expect(validateArchitecturalDesignDocument(document, ARCHITECT_DOCUMENT_CONTRACT)).toEqual([]);
    expect(roofConflicts(document.massing.masses, document.roofs.recipes)).toEqual([]);
    expect(compile(document).errors).toEqual([]);
  });

  it("types the Architect's structured roof output as the canonical AuthoredRoofRecipe", () => {
    expectTypeOf<z.infer<typeof architectOutputSchema>["document"]["roofs"]["recipes"][number]>().toMatchTypeOf<AuthoredRoofRecipe>();
    expect(AUTHORED_ROOF_RECIPE_KINDS).not.toContain("mixed");
  });

  it("accepts the canonical roof contract at every gate: Architect schema, document validation, roofConflicts and the quality gate", async () => {
    const { architectOutputSchema, ARCHITECT_DOCUMENT_CONTRACT } = await import("../stages/architectStage");
    const document = threeMassDocument();
    delete (document as Partial<ArchitecturalDesignDocument>).capabilities;
    document.roofs = { recipes: document.roofs.recipes.map((r, i) => ({ ...r, overhang: i === 1 ? 0 : r.overhang })) };
    expect(architectOutputSchema.safeParse({ document }).success).toBe(true);
    expect(validateArchitecturalDesignDocument(document, ARCHITECT_DOCUMENT_CONTRACT)).toEqual([]);
    expect(roofConflicts(document.massing.masses, document.roofs.recipes)).toEqual([]);
    const compiled = compile(document);
    expect(compiled.errors).toEqual([]);
    expect(runDesignQualityGate(document, compiled.diagnostics!).blocking.filter((c) => c.id.startsWith("roof-integrity-") && !c.passed)).toEqual([]);
  });

  /** The three-mass document with its first roof changed, `undefined` meaning the field is omitted. */
  const rejectedRoof = (change: Record<string, unknown>) => {
    const document = threeMassDocument();
    delete (document as Partial<ArchitecturalDesignDocument>).capabilities;
    const roof: Record<string, unknown> = { ...document.roofs.recipes[0], ...change };
    for (const key of Object.keys(roof)) if (roof[key] === undefined) delete roof[key];
    document.roofs = { recipes: [roof as unknown as RoofRecipe, ...document.roofs.recipes.slice(1)] };
    return document;
  };

  it.each([
    ["missing overhang", { overhang: undefined }, "roof-incomplete"],
    ["missing pitch", { pitch: undefined }, "roof-incomplete"],
    ["\"mixed\"", { kind: "mixed" }, "roof-unbuildable"],
  ] as const)("the blocking roofConflicts check rejects the same %s roof the Architect contract rejects", (_label, change, code) => {
    const document = rejectedRoof(change);
    expect(roofConflicts(document.massing.masses, document.roofs.recipes)).toEqual([expect.objectContaining({ code, massId: "ground-plinth" })]);
  });

  describe.each([
    ["missing overhang", { overhang: undefined }, "roof ground-plinth-roof missing overhang; expected a non-negative finite number in meters"],
    ["missing pitch", { pitch: undefined }, "roof ground-plinth-roof missing pitch; expected a non-negative finite number in degrees"],
    ["the unbuildable \"mixed\" kind", { kind: "mixed" }, `roof ground-plinth-roof invalid kind "mixed"; expected one of: ${AUTHORED_ROOF_RECIPE_KINDS.join(", ")}`],
    ["a negative overhang", { overhang: -0.2 }, "roof ground-plinth-roof invalid overhang -0.2; expected a non-negative finite number in meters"],
    ["a negative pitch", { pitch: -5 }, "roof ground-plinth-roof invalid pitch -5; expected a non-negative finite number in degrees"],
    ["a non-finite pitch", { pitch: Number.NaN }, "roof ground-plinth-roof invalid pitch null; expected a non-negative finite number in degrees"],
  ] as const)("rejects a roof with %s before compilation", (_label, change, validationError) => {
    const rejected = () => rejectedRoof(change);

    it("in the Architect's structured schema and document validation", async () => {
      const { architectOutputSchema, ARCHITECT_DOCUMENT_CONTRACT } = await import("../stages/architectStage");
      expect(architectOutputSchema.safeParse({ document: rejected() }).success).toBe(false);
      expect(validateArchitecturalDesignDocument(rejected(), ARCHITECT_DOCUMENT_CONTRACT)).toEqual([validationError]);
    });

    it("as a same-Architect repair, without compiling the rejected document", async () => {
      const compiler = await import("../compiler");
      const compileSpy = vi.spyOn(compiler, "compileArchitecture");
      try {
        const { runArchitectStage } = await import("../stages/architectStage");
        generateText.mockResolvedValueOnce({ output: { document: rejected() }, totalUsage: {} }).mockResolvedValueOnce({ output: responderOutputs.architect(), totalUsage: {} });
        const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);
        expect(result.ok).toBe(true);
        expect(generateText).toHaveBeenCalledTimes(2);
        expect(messageOf(1)).toContain(validationError);
        expect(compileSpy).toHaveBeenCalledTimes(1);
      } finally {
        compileSpy.mockRestore();
      }
    });
  });

  it("feeds exact corner and roof diagnostics to the bounded same-Architect repair", async () => {
    const { runArchitectStage } = await import("../stages/architectStage");
    const malformed = architectDocument() as unknown as { massing: { masses: Record<string, unknown>[] }; roofs: { recipes: Record<string, unknown>[] } };
    malformed.massing.masses[0].operations = [{ type: "notch", corner: "southeast", width: 1, depth: 1 }];
    malformed.roofs.recipes[0] = { id: "roof-0", massId: "mass-0", kind: "floating-flat", orientation: "south", parapet: "dark edge", floatingExpression: "shadow gap" };
    generateText.mockResolvedValueOnce({ output: { document: malformed }, totalUsage: {} }).mockResolvedValueOnce({ output: responderOutputs.architect(), totalUsage: {} });
    const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);
    expect(result.ok).toBe(true);
    expect(messageOf(1)).toContain('invalid corner "southeast"; expected one of: nw, ne, se, sw');
    expect(messageOf(1)).toContain('roof roof-0 invalid orientation "south"; expected a finite number in radians');
    expect(messageOf(1)).toContain("roof roof-0 unsupported field floatingExpression; use expression");
  });

  it("does not spend a second Architect attempt when deterministic validation code throws", async () => {
    const compiler = await import("../compiler");
    const compileSpy = vi.spyOn(compiler, "compileArchitecture").mockImplementation(() => {
      const intervals: unknown[] | undefined = undefined;
      intervals!.push("unexpected");
      throw new Error("unreachable");
    });
    try {
      const { runArchitectStage } = await import("../stages/architectStage");
      generateText.mockResolvedValue({ output: responderOutputs.architect(), totalUsage: {} });

      const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual([expect.stringContaining("INTERNAL_ERROR: architect validation code threw: Cannot read properties of undefined (reading 'push')")]);
      expect(generateText).toHaveBeenCalledTimes(1);
    } finally {
      compileSpy.mockRestore();
    }
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

  const rooftopDocument = doc([{ ...living, height: 7.1 }]);
  const rooftopAuthority = { architectureHash: architectureAuthorityHash(rooftopDocument), sitePlanHash: sitePlanAuthorityHash(plan) };
  const roofY = () => {
    const plane = compile(rooftopDocument).model.primitives.find((primitive) => primitive.id === "architecture-mass-0-roof-plane")!;
    if (plane.kind !== "box") throw new Error("fixture roof must be a flat roof plane");
    return plane.position[1] + plane.size[1] / 2;
  };
  const rooftopGazebo = (): OutdoorAssetPlacement => ({
    id: "outdoor-v2-a2aec565-f772-446d-b3c9-6dced30e103a", assetId: "gazebo", parentSpaceId: "v2-roof-mass-0", category: "gazebo", role: "gazebo",
    position: [-1.5, roofY(), 3], rotation: [0, 0, 0], scale: 1, dimensions: { width: 4, depth: 4, height: 2.9 },
    support: { kind: "roof", elevation: roofY(), massId: "mass-0" },
    intent: { surface: "roof", massId: "mass-0", centre: { x: -1.5, z: 3 }, yaw: 0, dimensions: { width: 4, depth: 4, height: 2.9 } },
  });
  const sceneCheck = (gate: ReturnType<typeof runV2IntegrityGate>) => gate.checks.find((check) => check.id === "scene-assets-clear-of-building")!;

  it("allows the conceptual live case: an explicitly hosted rooftop gazebo overlaps its host footprint at the roof elevation", () => {
    const gazebo = rooftopGazebo();
    expect(gazebo.position).toEqual([-1.5, 7.35, 3]);
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [gazebo] }, rooftopDocument), brief: rooftopDocument.brief, authority: rooftopAuthority })).passed).toBe(true);
  });

  it("keeps ground assets, unrelated masses, and vertically embedded rooftop assets blocked", () => {
    const rooftop = rooftopGazebo();
    const ground: OutdoorAssetPlacement = { ...rooftop, parentSpaceId: "garden", position: [-1.5, 0, 3], support: { kind: "terrain", elevation: 0 }, intent: { ...rooftop.intent!, surface: "garden", massId: undefined } };
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [ground] }, rooftopDocument), brief: rooftopDocument.brief, authority: rooftopAuthority })).passed).toBe(false);

    const other = { ...living, id: "unrelated", name: "Unrelated Mass", role: "garage" as const, position: { x: -1.5, z: 3 }, width: 4, depth: 4, operations: [], openings: [] };
    const withOther = doc([{ ...living, height: 7.1 }, other]);
    const withOtherAuthority = { architectureHash: architectureAuthorityHash(withOther), sitePlanHash: sitePlanAuthorityHash(plan) };
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [rooftop] }, withOther), brief: withOther.brief, authority: withOtherAuthority })).passed).toBe(false);

    const embedded = { ...rooftop, position: [-1.5, roofY() - 1, 3] as [number, number, number] };
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [embedded] }, rooftopDocument), brief: rooftopDocument.brief, authority: rooftopAuthority })).passed).toBe(false);
  });

  it("compares an architectural edit to the saved baseline without hiding a worsened or malformed rooftop collision", () => {
    const preExisting: OutdoorAssetPlacement = { id: "pre-existing", assetId: "bench", parentSpaceId: "garden", category: "furniture", role: "bench", position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, dimensions: { width: 1, depth: 1, height: 1 } };
    const before = artifact({ outdoorAssetPlacements: [preExisting] });
    const entranceOnly = doc([{ ...living, operations: [{ id: "mass-0:entry", type: "projection", facade: "north", start: .35, end: .65, depth: 2.2, open: true }] }]);
    const entranceAuthority = { architectureHash: architectureAuthorityHash(entranceOnly), sitePlanHash: sitePlanAuthorityHash(plan) };
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [preExisting] }, entranceOnly), brief: d.brief, authority: entranceAuthority, previousJson: before })).passed).toBe(true);

    const edgeAsset: OutdoorAssetPlacement = { ...preExisting, id: "edge", position: [8, 0, 0] };
    const expanded = doc([{ ...living, width: 20 }]);
    const expandedAuthority = { architectureHash: architectureAuthorityHash(expanded), sitePlanHash: sitePlanAuthorityHash(plan) };
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [edgeAsset] }, expanded), brief: d.brief, authority: expandedAuthority, previousJson: artifact({ outdoorAssetPlacements: [edgeAsset] }) })).passed).toBe(false);

    const clearAsset: OutdoorAssetPlacement = { ...preExisting, id: "entry-clear", position: [0, 0, -6.5] };
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [clearAsset] }, entranceOnly), brief: d.brief, authority: entranceAuthority, previousJson: artifact({ outdoorAssetPlacements: [clearAsset] }) })).passed).toBe(false);
    const malformedRooftop = { ...rooftopGazebo(), position: [-1.5, roofY() - 1, 3] as [number, number, number] };
    expect(sceneCheck(runV2IntegrityGate({ json: artifact({ outdoorAssetPlacements: [malformedRooftop] }, rooftopDocument), brief: rooftopDocument.brief, authority: rooftopAuthority, previousJson: artifact({ outdoorAssetPlacements: [malformedRooftop] }, rooftopDocument) })).passed).toBe(false);
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
