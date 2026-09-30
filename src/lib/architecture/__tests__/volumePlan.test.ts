import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalIntent } from "../designEngine";
import type { ArchitecturalDesignDocument, MassVolume, SiteStrategy, VolumePlan } from "../document";
import { compileArchitecture, resolveMasses } from "../compiler";
import { completeVolumePlan, localFacadeToward, missingVolumePlanFields, planConformance, realizeVolumePlan, REQUIRED_PLAN_FIELDS, withVolumePlan } from "../volumePlan";
import { authoredPlan, authoredRoof } from "./authoredFixtures";

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
    roofs: { recipes: articulated.map((m) => authoredRoof(m.id)) },
    capabilities: realized.flatMap(({ r }) => r.capabilityIntents),
    facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
  };
}

const plan = authoredPlan;

describe("volume plans drive geometry", () => {
  it("rebuilds the capability-house vocabulary from plans alone: prow, covered terrace, canopied entry, pilotis, sun fins, parapets", () => {
    const doc = plannedDocument([
      withVolumePlan({ id: "ground", name: "Ground Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 },
        plan("main-living", { form: "prow", viewFacade: "framed-glass", arrivalFacade: "solid", flankFacades: "shaded-glass", entry: "canopied", outdoor: "covered-terrace", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" })),
      withVolumePlan({ id: "upper", name: "Raised Bedroom Box", role: "bedroom-wing", position: { x: -10, z: -0.75 }, width: 12, depth: 7.5, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "stepped-above", target: "ground", distance: 3.45 }] },
        plan("bedroom-wing", { viewFacade: "fin-screened", arrivalFacade: "slot", flankFacades: "framed-glass", roofEdge: "parapet", structure: "pilotis" })),
      withVolumePlan({ id: "garage", name: "Garage", role: "garage", position: { x: 7.5, z: 0 }, width: 6.5, depth: 6, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "adjacent-to", target: "ground", side: "north", distance: 2.5 }] }, plan("garage")),
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
    // A plan that authors no glass realizes none — being the main living volume adds nothing to it.
    expect(closed.openings.some((o) => o.type === "glazing-zone")).toBe(false);
  });

  it("never invents a plan from a volume's role: an unauthored plan is the same nothing for every role", () => {
    const volume = (role: MassVolume["role"]): MassVolume => withVolumePlan({ id: role, name: role, role, position: { x: 0, z: 0 }, width: 14, depth: 10, floors: 1, elevation: 0, rotation: 0 }, undefined);
    const living = volume("main-living"), garage = volume("garage"), guest = volume("guest-pavilion");
    expect(living.plan).toEqual(garage.plan);
    expect(living.plan).toEqual(guest.plan);
    expect(living.plan).toEqual(completeVolumePlan(undefined));
    expect(living.plan).toMatchObject({ viewFacade: "solid", arrivalFacade: "solid", flankFacades: "solid", entry: "none", outdoor: "none" });
    expect(living.height).toBeUndefined();
    for (const mass of [living, garage, guest]) {
      const r = realizeVolumePlan(mass, [mass], site);
      expect([r.operations, r.openings, r.capabilityIntents, r.cantilever]).toEqual([[], [], [], undefined]);
    }
    // …and the placing stages are told exactly which fields the architect still owes.
    expect(missingVolumePlanFields(undefined)).toEqual([...REQUIRED_PLAN_FIELDS]);
    expect(missingVolumePlanFields({ ...plan("main-living"), viewFacade: "curtain-wall", entry: undefined })).toEqual(["viewFacade", "entry"]);
    // A partial plan keeps exactly what was authored; nothing role-specific fills the rest.
    expect(withVolumePlan(volume("main-living"), { form: "prow" }).plan).toEqual({ ...completeVolumePlan(undefined), form: "prow" });
  });

  it("reports a blocked authored facade instead of substituting another facade", () => {
    const living = withVolumePlan({ id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, {
      form: "l-shape", viewFacade: "framed-glass", arrivalFacade: "solid", outdoor: "covered-terrace", outdoorSide: "view", entry: "canopied",
    });
    // The south neighbour consumes the intended view edge, but leaves both flanks exposed.
    const neighbour: MassVolume = { id: "neighbour", name: "Neighbour", role: "service", position: { x: 0, z: 7 }, width: 8, depth: 4, floors: 1, elevation: 0, rotation: 0 };
    const result = realizeVolumePlan(living, [living, neighbour], site);
    expect(result.operations.some((op) => op.type === "notch")).toBe(false);
    expect(result.operations.some((op) => op.type === "projection" && op.open)).toBe(false);
    expect(result.operations.some((op) => op.type === "entry-recess" && op.facade === "north")).toBe(true);
    expect(result.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ facade: "south", feature: "l-shape" }), expect.objectContaining({ facade: "south", feature: "covered-terrace" })]));
  });

  it("resolves facades against the final rotation, and degrades plugin-bound items on rotated volumes instead of emitting broken intents", () => {
    const rotated: MassVolume = withVolumePlan({ id: "r", name: "Rotated", role: "main-living", position: { x: 0, z: 0 }, width: 12, depth: 8, floors: 1, elevation: 0, rotation: Math.PI / 2 }, plan("main-living", { entry: "canopied" }));
    expect(localFacadeToward("south", Math.PI / 2)).toBe("west");
    const r = realizeVolumePlan(rotated, [rotated], site);
    expect(r.operations).toContainEqual(expect.objectContaining({ type: "projection", facade: "west", open: true })); // terrace toward the (world-south) view
    expect(r.operations).toContainEqual(expect.objectContaining({ type: "entry-recess", facade: "east" })); // local east faces world north
    expect(r.capabilityIntents.some((c) => c.id === "entry-canopy")).toBe(false);
    expect(r.notes.some((n) => n.includes("entry canopy skipped"))).toBe(true);
  });

  it("measures authored geometry against the plan without touching it: what is missing is reported, never restored", () => {
    const mass = withVolumePlan({ id: "m", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, plan("main-living", { entry: "recessed" }));
    const authored: MassVolume = { ...mass,
      operations: [{ type: "recess", facade: "east", start: 0.3, end: 0.6, depth: 1 }],
      openings: [{ type: "glazing-zone", facade: "south", start: 0.5, end: 0.95, heightRatio: 0.85 }],
    };
    const before = structuredClone(authored);
    const { missing } = planConformance(authored, [authored], site);
    expect(authored).toEqual(before);
    expect(missing).toEqual(expect.arrayContaining([
      expect.stringContaining("the outdoor room (reference: the south facade)"),
      expect.stringContaining("entry-recess on the north facade"),
      expect.stringContaining("door on the north facade"),
      expect.stringContaining("glazing-zone on the east facade"),
    ]));
    expect(missing.some((m) => m.includes("glazing-zone on the south"))).toBe(false);
  });

  it("sends an incomplete or off-vocabulary plan back to the architect instead of defaulting it from the role", async () => {
    const { runMassExpansionStage } = await import("../stages/massExpansionStage");
    const primaryMass = withVolumePlan({ id: "mass-0", name: "Main Living", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0 }, plan("main-living"));
    const studio = (studioPlan: unknown) => ({ output: { decision: "add", reasoning: "A low studio pavilion off the living room, glazed toward the garden.", mass: { name: "Studio", role: "guest-pavilion", width: 8, depth: 7, floors: 1, plan: studioPlan }, relationships: [{ kind: "separated-from", target: "mass-0", side: "east", distance: 4 }] }, totalUsage: {} });
    const authored = plan("guest-pavilion", { form: "l-shape", height: "double-height", viewFacade: "glass-wall", roofEdge: "floating" });
    generateText
      .mockResolvedValueOnce(studio({ form: "l-shape", height: "double-height", viewFacade: "curtain-wall", roofEdge: "floating" }))
      .mockResolvedValueOnce(studio(authored))
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Complete." }, totalUsage: {} });
    const result = await runMassExpansionStage({ brief: "A calm house with a studio", intent, siteStrategy: site, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(3);
    const repair = (generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content;
    expect(repair).toMatch(/repair-required:plan-incomplete/);
    expect(repair).toMatch(/hierarchy, viewFacade, arrivalFacade, flankFacades, entry, outdoor, outdoorSide, structure/);
    expect(result.repairRequests.join(" ")).toMatch(/plan-incomplete/);
    expect(result.masses[1].plan).toEqual(authored);
    expect(result.masses[1].height).toBeGreaterThan(5);
  });
});

describe("plan fidelity in the design quality gate", () => {
  it("passes a document built from its plans and fails one whose planned elements were stripped", async () => {
    const { runDesignQualityGate } = await import("../stages/qualityGate");
    const doc = plannedDocument([
      withVolumePlan({ id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, plan("main-living", { form: "l-shape" })),
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
