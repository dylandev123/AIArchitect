import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalIntent } from "../designEngine";
import type { ArchitecturalDesignDocument, MassVolume, SiteStrategy, VolumePlan } from "../document";
import { compileArchitecture, resolveMasses } from "../compiler";
import { completeVolumePlan, conformToPlan, localFacadeToward, realizeVolumePlan, withVolumePlan } from "../volumePlan";
import { roofForMass } from "../stages/roofStage";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const site: SiteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" };
const intent: ArchitecturalIntent = {
  mood: ["calm"], spatialGoals: ["views"], environmentalGoals: ["daylight"], hierarchyGoals: ["dominant living pavilion"],
  compositionBias: "asymmetrical", source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "contemporary" },
};
const pending = { status: "pending" as const };

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

/** Plans only — no hand-authored operations/openings/capabilities. Everything built comes from realizing these. */
function plannedDocument(masses: MassVolume[]): ArchitecturalDesignDocument {
  const resolved = resolveMasses({ siteStrategy: site, massing: { masses } });
  const realized = resolved.map((mass) => ({ mass, r: realizeVolumePlan(mass, resolved, site) }));
  const articulated = realized.map(({ mass, r }) => ({ ...mass, operations: r.operations, openings: r.openings, ...(r.cantilever ? { cantilever: r.cantilever } : {}) }));
  return {
    version: 1, brief: "Planned capability house", siteStrategy: site,
    massing: { composition: "pavilion-cluster", masses: articulated },
    roofs: { recipes: articulated.map((m) => roofForMass(m, "flat", intent)) },
    capabilities: realized.flatMap(({ r }) => r.capabilityIntents),
    facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
  };
}

const plan = (role: MassVolume["role"], overrides: Partial<VolumePlan>) => completeVolumePlan(overrides, role);

describe("volume plans drive geometry", () => {
  it("rebuilds the capability-house vocabulary from plans alone: prow, covered terrace, canopied entry, pilotis, sun fins, parapets", () => {
    const doc = plannedDocument([
      withVolumePlan({ id: "ground", name: "Ground Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 },
        plan("main-living", { form: "prow", viewFacade: "framed-glass", arrivalFacade: "solid", flankFacades: "shaded-glass", entry: "canopied", outdoor: "covered-terrace", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" })),
      withVolumePlan({ id: "upper", name: "Raised Bedroom Box", role: "bedroom-wing", position: { x: -10, z: -0.75 }, width: 12, depth: 7.5, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "stepped-above", target: "ground", distance: 3.45 }] },
        plan("bedroom-wing", { viewFacade: "fin-screened", arrivalFacade: "slot", flankFacades: "framed-glass", roofEdge: "parapet", structure: "pilotis" })),
      withVolumePlan({ id: "garage", name: "Garage", role: "garage", position: { x: 7.5, z: 0 }, width: 6.5, depth: 6, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "adjacent-to", target: "ground", side: "north", distance: 2.5 }] }, undefined),
    ]);
    const ground = doc.massing.masses.find((m) => m.id === "ground")!;
    expect(ground.operations).toContainEqual({ type: "chamfer", corner: "se", size: 3, glazed: true });
    expect(ground.operations).toContainEqual({ type: "projection", facade: "south", start: 0.05, end: 0.45, depth: 3, open: true, postSpacing: 2.6 });
    expect(ground.operations).toContainEqual(expect.objectContaining({ type: "entry-recess", facade: "north" }));
    // Terrace claims the west half of the view facade, so the framed glazing takes the rest.
    expect(ground.openings).toContainEqual(expect.objectContaining({ type: "glazing-zone", facade: "south", start: 0.49, frame: true }));
    // Solid arrival face, entered through a door centred on the canopied entry recess.
    expect(ground.openings?.filter((o) => o.facade === "north")).toEqual([expect.objectContaining({ type: "door", start: expect.closeTo(0.44, 2), end: expect.closeTo(0.56, 2), frame: true })]);

    const upper = doc.massing.masses.find((m) => m.id === "upper")!;
    expect(upper.openings).toContainEqual(expect.objectContaining({ type: "opening-rhythm", facade: "north", width: 0.6 }));
    expect(doc.roofs.recipes.find((r) => r.massId === "upper")).toMatchObject({ kind: "flat", overhang: 0, parapet: { height: 0.4 } });
    expect(doc.roofs.recipes.find((r) => r.massId === "garage")).toMatchObject({ kind: "flat", overhang: 0 });
    expect(doc.massing.masses.find((m) => m.id === "garage")?.openings).toContainEqual(expect.objectContaining({ type: "door", facade: "north" }));

    const { errors, diagnostics } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(errors).toEqual([]);
    expect(diagnostics?.geometry.flatMap((g) => g.warnings)).toEqual([]);
    const applied = (id: string, massId: string) => diagnostics?.capabilities.find((c) => c.id === id && c.massId === massId)?.status;
    expect(applied("entry-canopy", "ground")).toBe("applied");
    expect(applied("pilotis", "upper")).toBe("applied");
    expect(applied("brise-soleil", "upper")).toBe("applied");
  });

  it("gives different plans genuinely different geometry on the same box", () => {
    const box: MassVolume = { id: "m", name: "Volume", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 10, floors: 2, elevation: 0, rotation: 0 };
    const realize = (p: VolumePlan) => realizeVolumePlan({ ...box, plan: p }, [{ ...box, plan: p }], site);
    const lShape = realize(plan("main-living", { form: "l-shape", outdoor: "covered-terrace" }));
    const setback = realize(plan("main-living", { form: "setback", structure: "cantilever", outdoor: "none" }));
    const closed = realize(plan("service", { outdoor: "none" }));
    expect(lShape.operations.some((o) => o.type === "notch")).toBe(true);
    expect(setback.operations).toContainEqual(expect.objectContaining({ type: "recess", facade: "south", floors: "upper" }));
    expect(setback.cantilever).toEqual({ direction: "south", distance: 2 });
    expect(closed.operations).toEqual([]);
    // Main living is deliberately never allowed to compile as a blank shell, even if a supplied plan is sparse.
    expect(closed.openings.some((o) => o.type === "glazing-zone" && o.heightRatio >= .65)).toBe(true);
  });

  it("adapts a living pavilion's required form, terrace and glazing around a shared view facade", () => {
    const living = withVolumePlan({ id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, {
      form: "l-shape", viewFacade: "framed-glass", arrivalFacade: "solid", outdoor: "covered-terrace", outdoorSide: "view", entry: "canopied",
    });
    // The south neighbour consumes the intended view edge, but leaves both flanks exposed.
    const neighbour: MassVolume = { id: "neighbour", name: "Neighbour", role: "service", position: { x: 0, z: 7 }, width: 8, depth: 4, floors: 1, elevation: 0, rotation: 0 };
    const result = realizeVolumePlan(living, [living, neighbour], site);
    expect(result.operations.some((op) => op.type === "notch")).toBe(true);
    expect(result.operations.some((op) => op.type === "projection" && op.open && op.facade !== "south")).toBe(true);
    expect(result.operations.some((op) => op.type === "entry-recess" && op.facade === "north")).toBe(true);
    expect(result.openings.some((op) => op.type === "glazing-zone" && op.facade !== "south" && op.heightRatio >= .65)).toBe(true);
    expect(result.notes.join(" ")).toContain("shared south facade");
  });

  it("resolves facades against the final rotation, and degrades plugin-bound items on rotated volumes instead of emitting broken intents", () => {
    const rotated: MassVolume = withVolumePlan({ id: "r", name: "Rotated", role: "main-living", position: { x: 0, z: 0 }, width: 12, depth: 8, floors: 1, elevation: 0, rotation: Math.PI / 2 }, { entry: "canopied" });
    expect(localFacadeToward("south", Math.PI / 2)).toBe("west");
    const r = realizeVolumePlan(rotated, [rotated], site);
    expect(r.operations).toContainEqual(expect.objectContaining({ type: "projection", facade: "west", open: true })); // terrace toward the (world-south) view
    expect(r.operations).toContainEqual(expect.objectContaining({ type: "entry-recess", facade: "east" })); // local east faces world north
    expect(r.capabilityIntents.some((c) => c.id === "entry-canopy")).toBe(false);
    expect(r.notes.some((n) => n.includes("entry canopy skipped"))).toBe(true);
  });

  it("lets the plan overrule a Geometry Pass proposal that contradicts it, and restores what the proposal dropped", () => {
    const mass = withVolumePlan({ id: "m", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, { form: "bar", arrivalFacade: "solid" });
    const baseline = realizeVolumePlan(mass, [mass], site);
    const conformed = conformToPlan(mass, [mass], site, baseline, {
      operations: [
        { type: "notch", corner: "nw", width: 4, depth: 3 }, // bar form: no corner cut
        { type: "recess", facade: "south", start: 0.3, end: 0.6, depth: 1 }, // collides with the planned terrace
      ],
      openings: [
        { type: "glazing-zone", facade: "north", start: 0.1, end: 0.9, heightRatio: 0.8 }, // arrival planned solid
        { type: "glazing-zone", facade: "south", start: 0.5, end: 0.95, heightRatio: 0.85 }, // welcome refinement
      ],
    });
    expect(conformed.operations.some((o) => o.type === "notch")).toBe(false);
    expect(conformed.operations.some((o) => o.type === "recess")).toBe(false);
    expect(conformed.operations).toContainEqual(expect.objectContaining({ type: "projection", facade: "south", open: true }));
    expect(conformed.operations).toContainEqual(expect.objectContaining({ type: "entry-recess", facade: "north" }));
    expect(conformed.openings.filter((o) => o.facade === "north").map((o) => o.type)).toEqual(["door"]); // the planned entry door, never the proposed arrival glazing
    expect(conformed.openings.filter((o) => o.facade === "south")).toEqual([{ type: "glazing-zone", facade: "south", start: 0.5, end: 0.95, heightRatio: 0.85, frame: true }]);
    expect(conformed.notes.length).toBe(3);
  });

  it("keeps the model's plan from mass expansion, sets height at placement, and strips an off-vocabulary plan value without a retry", async () => {
    const { runMassExpansionStage } = await import("../stages/massExpansionStage");
    const primaryMass = withVolumePlan({ id: "mass-0", name: "Main Living", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0 }, undefined);
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A low studio pavilion off the living room, glazed toward the garden.", mass: { name: "Studio", role: "guest-pavilion", width: 8, depth: 7, floors: 1, plan: { form: "l-shape", height: "double-height", viewFacade: "curtain-wall", roofEdge: "floating" } }, relationships: [{ kind: "separated-from", target: "mass-0", side: "east", distance: 4 }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Complete." }, totalUsage: {} });
    const result = await runMassExpansionStage({ brief: "A calm house with a studio", intent, siteStrategy: site, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(2);
    const studio = result.masses[1];
    expect(studio.plan).toMatchObject({ form: "l-shape", height: "double-height", roofEdge: "floating", viewFacade: "glass-wall" }); // invalid value → role default
    expect(studio.height).toBeGreaterThan(5);
  });
});

describe("plan fidelity in the design quality gate", () => {
  it("passes a document built from its plans and fails one whose planned elements were stripped", async () => {
    const { runDesignQualityGate } = await import("../stages/qualityGate");
    const doc = plannedDocument([
      withVolumePlan({ id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, { form: "l-shape" }),
    ]);
    const check = (d: ArchitecturalDesignDocument) => {
      const { diagnostics } = compileArchitecture(d, { materials: DEFAULT_MATERIALS_CONFIG });
      return runDesignQualityGate(d, diagnostics!).checks.find((c) => c.id === "plan-realized-living");
    };
    expect(check(doc)?.passed).toBe(true);
    const stripped = { ...doc, massing: { ...doc.massing, masses: doc.massing.masses.map((m) => ({ ...m, operations: [] })) } };
    expect(check(stripped)).toMatchObject({ passed: false, detail: expect.stringContaining("notch") });
  });
});
