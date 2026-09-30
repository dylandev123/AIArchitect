import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { HousePrimitive } from "@/lib/house/types";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import "@/lib/capabilities/plugins";
import { capabilityRegistry } from "@/lib/capabilities/registry";
import { requestCapability } from "@/lib/capabilities/engine";
import { capabilityById } from "@/lib/library/capabilities";
import type { ArchitecturalIntent } from "../designEngine";
import { designArchitecture } from "../designEngine";
import { compileArchitecture, resolveMasses } from "../compiler";
import { scoreArchitecture } from "../critic";
import type { ArchitecturalDesignDocument, MassVolume, SiteStrategy, VolumePlan } from "../document";
import { completeComposition } from "../stages/compositionCompletion";
import { mergeCapabilityIntents, parameterizeCapabilityIntent, realizeVolumePlan, viewCorner, withVolumePlan, worldSideOf } from "../volumePlan";
import { collectV2Evidence } from "../v2Evidence";
import { runDesignQualityGate } from "../stages/qualityGate";
import { authoredPlan, QUIET_PLAN } from "./authoredFixtures";

/**
 * Regression cover for the V2 capability/authoring fixes the corrected Architecture Review surfaced. Every
 * check is on compiled geometry or deterministic authoring; the only model call (the Geometry Pass) is mocked.
 */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));
beforeEach(() => { generateText.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key"); });

const pending = { status: "pending" as const };
const site: SiteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" };
const intentWith = (spatialGoals: ArchitecturalIntent["spatialGoals"]): ArchitecturalIntent => ({
  mood: ["calm"], spatialGoals, environmentalGoals: ["daylight"], hierarchyGoals: ["living dominates"], compositionBias: "asymmetrical",
  source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "modern tropical" },
});
const mass = (id: string, over: Partial<MassVolume> = {}): MassVolume => ({ id, name: id, role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0, ...over });
/** A volume with a complete authored plan: the role fixture with the given decisions changed. */
const planned = (m: MassVolume, plan: Partial<VolumePlan> = {}) => withVolumePlan(m, authoredPlan(m.role, plan));
/** A volume whose authored plan asks for nothing but the given decisions. */
const quiet = (m: MassVolume, plan: Partial<VolumePlan> = {}) => withVolumePlan(m, { ...QUIET_PLAN, ...plan });
const usage = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test" };

function doc(masses: MassVolume[], capabilities: ArchitecturalDesignDocument["capabilities"] = []): ArchitecturalDesignDocument {
  return {
    version: 1, brief: "test", siteStrategy: site, massing: { composition: "pavilion-cluster", masses }, roofs: { recipes: masses.map((m) => ({ id: `${m.id}-roof`, massId: m.id, kind: "flat" as const })) },
    capabilities, facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
  };
}
/** Every mass's plan as its reference realization — what an architect who authors exactly the reference would build. */
function realized(masses: MassVolume[]): ArchitecturalDesignDocument {
  const resolved = resolveMasses({ siteStrategy: site, massing: { masses } });
  const intents: NonNullable<ArchitecturalDesignDocument["capabilities"]>[number][] = [];
  const built = resolved.map((m) => { const r = realizeVolumePlan(m, resolved, site); intents.push(...r.capabilityIntents); return { ...m, operations: r.operations, openings: r.openings, ...(r.cantilever ? { cantilever: r.cantilever } : {}) }; });
  return doc(built, mergeCapabilityIntents(intents.map((i) => parameterizeCapabilityIntent(i, built, site))));
}
const compile = (d: ArchitecturalDesignDocument) => compileArchitecture(d, { materials: DEFAULT_MATERIALS_CONFIG });
const boxes = (ps: readonly HousePrimitive[]) => ps.filter((p): p is Extract<HousePrimitive, { kind: "box" }> => p.kind === "box");
const review = (d: ArchitecturalDesignDocument) => scoreArchitecture(designArchitecture("test", { environment: "suburban", viewDirection: "south", approachSide: "north" }), JSON.stringify({ architecturalDesignDocument: d }), "test");
const score = (d: ArchitecturalDesignDocument, c: string) => review(d).criteria.find((x) => x.criterion === c)!;

describe("recessed and canopied entries produce a usable main door", () => {
  const recess = { type: "entry-recess" as const, facade: "north" as const, width: 3.2, depth: 1.3 };

  it("never builds a door the architect did not author: a door-less entry recess stays solid and is a blocking finding", () => {
    const authored = doc([mass("living", { operations: [recess] })]);
    const { model, diagnostics } = compile(authored);
    expect(boxes(model.primitives).filter((p) => p.label.endsWith("Glazed Door Panel"))).toEqual([]);
    expect(model.primitives.filter((p) => p.category === "window")).toEqual([]);
    expect(diagnostics!.geometry[0].warnings.join(" ")).toMatch(/entry-recess on the north facade has no authored door/);
    expect(collectV2Evidence(authored)!.glass.filter((g) => g.door)).toEqual([]);
    const gate = runDesignQualityGate(authored, diagnostics!);
    expect(gate.passed).toBe(false);
    expect(gate.blocking.map((c) => c.id)).toContain("requested-geometry-survived-compilation");
  });

  it("compiles exactly the openings that were authored: no role adds glazing, windows or a door", () => {
    for (const role of ["main-living", "bedroom-wing", "guest-pavilion", "entry"] as const) {
      const { model, diagnostics } = compile(doc([mass("m", { role })]));
      expect(model.primitives.filter((p) => p.category === "window"), role).toEqual([]);
      expect(boxes(model.primitives).filter((p) => p.label.includes("Door")), role).toEqual([]);
      expect(diagnostics!.geometry[0].openingsRequested, role).toBe(0);
    }
  });

  it("moves an authored door that overlaps the recess into its back wall, with no facade slivers left beside it", () => {
    const { model } = compile(doc([mass("living", { operations: [recess], openings: [{ type: "door", facade: "north", start: 0.4, end: 0.6, height: 2.3 }] })]));
    const doors = boxes(model.primitives).filter((p) => p.label.endsWith("Glazed Door Panel"));
    expect(doors).toHaveLength(1);
    expect(doors[0].id).toContain("-entry-");
    expect(doors[0].size[1]).toBeCloseTo(2.3 - 0.06, 5);
  });

  it("keeps the upper floor of a two-storey recess solid unless a door is authored there", () => {
    const { model } = compile(doc([mass("living", { floors: 2, operations: [recess], openings: [{ type: "door", facade: "north", start: 0.44, end: 0.56, floors: "ground" }] })]));
    expect(boxes(model.primitives).filter((p) => p.label.endsWith("Glazed Door Panel")).map((p) => p.id)).toEqual([expect.stringMatching(/wall-0-entry/)]);
  });

  it("plans a centred door for canopied and recessed entries, and the review credits the full entry sequence", () => {
    for (const entry of ["canopied", "recessed"] as const) {
      const d = realized([planned(mass("living"), { entry })]);
      const living = d.massing.masses[0];
      expect(living.openings?.filter((o) => o.type === "door")).toEqual([expect.objectContaining({ facade: "north", frame: true })]);
      expect(score(d, "entry-sequence").reason, entry).toMatch(/main door faces the north arrival; a compiled entry recess/);
    }
    expect(score(realized([planned(mass("living"), { entry: "canopied" })]), "entry-sequence").score).toBeGreaterThanOrEqual(0.75);
  });

  it("puts the door on whichever local facade faces the arrival on a rotated volume", () => {
    const d = realized([planned(mass("living", { rotation: Math.PI / 2, placementLocked: true }), { entry: "recessed" })]);
    const door = collectV2Evidence(d)!.glass.find((g) => g.door)!;
    expect(door.side).toBe("north");
  });
});

describe("indoor-outdoor briefs author real open terraces", () => {
  const noTerrace = (m: MassVolume) => planned(m, { outdoor: "none" });

  it("reports an unmet indoor-outdoor program instead of authoring a terrace", () => {
    const masses = resolveMasses({ siteStrategy: site, massing: { masses: [noTerrace(mass("living")), noTerrace(mass("bed", { role: "bedroom-wing", position: { x: -16, z: 0 }, width: 8, depth: 7 }))] } });
    const { masses: out, notes } = completeComposition(masses, intentWith(["indoor-outdoor"]), site);
    expect(out.map((m) => m.plan)).toEqual(masses.map((m) => m.plan));
    expect(notes.join(" ")).toMatch(/no outdoor-room plan; no plan was added/);
  });

  it("leaves the model's own outdoor decisions alone", () => {
    const own = [noTerrace(mass("living")), planned(mass("guest", { role: "guest-pavilion", position: { x: 18, z: 0 }, width: 8, depth: 7 }), { outdoor: "veranda", outdoorSide: "view" })];
    expect(completeComposition(own, intentWith(["indoor-outdoor"]), site).masses.map((m) => m.plan)).toEqual(own.map((m) => m.plan));
    const quiet = [noTerrace(mass("living"))];
    expect(completeComposition(quiet, intentWith(["privacy"]), site).masses[0].plan).toEqual(quiet[0].plan);
  });

  it("asks the Geometry Pass to repair a dropped planned terrace, and fails rather than restoring it", async () => {
    const { runGeometryStage } = await import("../stages/geometryStage");
    const masses = [quiet(mass("mass-0"), { outdoor: "covered-terrace" })];
    const dropped = { output: { results: [{ massId: "mass-0", operations: [
      { type: "recess", facade: "south", start: 0.1, end: 0.4, depth: 1 }, // a plain recess where the terrace was planned
      { type: "glazing-zone", facade: "south", start: 0.5, end: 0.9, heightRatio: 0.85 },
    ] }] }, totalUsage: {} };
    generateText.mockResolvedValue(dropped);
    const result = await runGeometryStage({ brief: "An indoor-outdoor house", intent: intentWith(["indoor-outdoor"]), siteStrategy: site, masses }, createTimings(), 60_000, usage);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect((generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content).toMatch(/repair-required:missing-planned-geometry mass-0\].*outdoor room/);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/missing-planned-geometry/);
    expect(result).not.toHaveProperty("byMassId");
  });

  it("accepts the repair when the Geometry Pass authors the terrace on its second attempt", async () => {
    const { runGeometryStage } = await import("../stages/geometryStage");
    const masses = [quiet(mass("mass-0"), { outdoor: "covered-terrace" })];
    const own = { type: "projection", facade: "south", start: 0.2, end: 0.7, depth: 2.2, open: true };
    generateText
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [own] }] }, totalUsage: {} });
    const result = await runGeometryStage({ brief: "x", intent: intentWith(["indoor-outdoor"]), siteStrategy: site, masses }, createTimings(), 60_000, usage);
    expect(result.ok && result.byMassId.get("mass-0")!.operations).toEqual([expect.objectContaining(own)]);
    expect(result.repairRequests?.join(" ")).toMatch(/missing-planned-geometry/);
  });

  it("keeps a terrace the Geometry Pass authored itself, wherever it put it", async () => {
    const { runGeometryStage } = await import("../stages/geometryStage");
    const masses = [quiet(mass("mass-0"), { outdoor: "covered-terrace" })];
    const own = { type: "recess", facade: "east", start: 0.2, end: 0.8, depth: 2.4, open: true, postSpacing: 2.4 };
    generateText.mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [own] }] }, totalUsage: {} });
    const result = await runGeometryStage({ brief: "x", intent: intentWith(["indoor-outdoor"]), siteStrategy: site, masses }, createTimings(), 60_000, usage);
    expect(result.ok && result.byMassId.get("mass-0")!.operations).toEqual([expect.objectContaining({ facade: "east", open: true })]);
  });
});

describe("courtyard authoring and private-wing arrival privacy", () => {
  const anchor = planned(mass("living", { width: 16, depth: 9 }));
  const wing = (id: string, kind: "surrounds-courtyard" | "separated-from" | "adjacent-to", side: "east" | "west" | undefined, over: Partial<MassVolume> = {}) =>
    planned(mass(id, { role: "bedroom-wing", width: 6, depth: 12, relationships: [{ kind, target: "living", ...(side ? { side } : {}), distance: 1 }], ...over }));

  it("reports an incomplete authored courtyard without recruiting or changing wings", () => {
    const { masses, notes } = completeComposition([anchor, wing("west", "surrounds-courtyard", "west"), wing("east", "separated-from", "east", { role: "guest-pavilion" })], intentWith(["privacy"]), site);
    expect(masses).toEqual([anchor, wing("west", "surrounds-courtyard", "west"), wing("east", "separated-from", "east", { role: "guest-pavilion" })]);
    expect(notes.join(" ")).toMatch(/without a usable authored side\/distance/);
  });

  it("reports a missing courtyard side and preserves every authored relationship", () => {
    const locked = wing("west", "surrounds-courtyard", "west", { placementLocked: true, position: { x: -12, z: 0 } });
    const noSide = wing("east", "surrounds-courtyard", undefined);
    const garage = planned(mass("garage", { role: "garage", width: 7, depth: 6, relationships: [{ kind: "adjacent-to", target: "living", side: "north", distance: 2 }] }));
    const { masses, notes } = completeComposition([anchor, locked, noSide, garage], intentWith(["privacy"]), site);
    const inferred = masses.find((m) => m.id === "east")!.relationships![0];
    expect(inferred.side).toBeUndefined();
    expect(notes.join(" ")).toMatch(/without a usable authored side/);
    expect(masses.find((m) => m.id === "west")!.relationships![0].distance).toBe(1);
    expect(masses.find((m) => m.id === "garage")!.relationships![0].kind).toBe("adjacent-to");
  });

  it("is idempotent, so a Replay can re-run it", () => {
    const once = completeComposition([anchor, wing("west", "surrounds-courtyard", "west"), wing("east", "separated-from", "east")], intentWith(["indoor-outdoor", "privacy"]), site).masses;
    expect(completeComposition(once, intentWith(["indoor-outdoor", "privacy"]), site).masses).toEqual(once);
  });

  it("does not change a private wing's authored arrival facade: no privacy sill, no added screen", () => {
    const bed = (arrivalFacade: VolumePlan["arrivalFacade"]) => planned(mass("bed", { role: "bedroom-wing", width: 10, depth: 7 }), { arrivalFacade });
    const punched = realizeVolumePlan(bed("punched"), [bed("punched")], site);
    expect(punched.openings.find((o) => o.facade === "north" && o.type === "opening-rhythm")).toMatchObject({ sill: 0.9, height: 1.4 });
    const glazed = realizeVolumePlan(bed("glass-wall"), [bed("glass-wall")], site);
    expect(glazed.openings.some((o) => o.facade === "north" && o.type === "glazing-zone")).toBe(true);
    expect(glazed.capabilityIntents.filter((i) => i.id === "screen-layer")).toEqual([]);
    expect([...punched.notes, ...glazed.notes].join(" ")).not.toMatch(/privacy/);
  });

  it("builds a private wing's planned arrival-side windows as the baseline, with exactly the Geometry Pass's refinements", async () => {
    const { runGeometryStage } = await import("../stages/geometryStage");
    const masses = [quiet(mass("mass-0", { role: "bedroom-wing", width: 10, depth: 7 }), { arrivalFacade: "punched" })];
    const refined = { count: 4, width: 1.2, height: 1.4, sill: 0.8 };
    generateText.mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [], refinements: [{ id: "mass-0:plan:north-windows", ...refined }] }] }, totalUsage: {} });
    const result = await runGeometryStage({ brief: "x", intent: intentWith(["privacy"]), siteStrategy: site, masses }, createTimings(), 60_000, usage);
    expect(result.ok && result.byMassId.get("mass-0")!.openings).toEqual([{ id: "mass-0:plan:north-windows", type: "opening-rhythm", facade: "north", ...refined }]);
    expect(result.ok && result.capabilityIntents).toEqual([]);
  });
});

describe("corner glazing follows the mass rotation and the view", () => {
  const glazed = (m: MassVolume, corner?: string) => requestCapability({ id: "corner-glazing", stage: "test", parameters: { massId: m.id, ...(corner ? { corner } : {}) } }, { primitives: [], target: m });

  it("builds its panes on the rotated footprint's corner, each facing the rotated facade", () => {
    const m = mass("living", { position: { x: 10, z: 5 }, width: 12, depth: 8, rotation: Math.PI / 2 });
    const out = glazed(m, "se");
    expect(out.status).toBe("applied");
    const mullion = boxes(out.primitives).find((p) => p.id.endsWith("-mullion"))!;
    // Local SE corner (6, 4) turned by +90°: (x·cos + z·sin, −x·sin + z·cos) = (4, −6).
    expect(mullion.position[0]).toBeCloseTo(10 + 4 + 0.018, 1);
    expect(mullion.position[2]).toBeCloseTo(5 - 6 - 0.018, 1);
    const sides = collectV2Evidence(doc([m], [{ id: "corner-glazing", stage: "test", parameters: { massId: "living", corner: "se" } }]))!.glass.map((g) => g.side);
    expect(new Set(sides)).toEqual(new Set([worldSideOf("east", m.rotation), worldSideOf("south", m.rotation)]));
  });

  it("resolves the corner toward the view, avoiding a corner the footprint has cut away", () => {
    const west: SiteStrategy = { ...site, viewDirection: "west" };
    const m = planned(mass("living"));
    expect(viewCorner(m, [m], west)).toMatch(/w$/);
    const notched = { ...m, operations: [{ type: "notch" as const, corner: viewCorner(m, [m], west), width: 3, depth: 3 }] };
    expect(viewCorner(notched, [notched], west)).not.toBe(notched.operations[0].corner);
    expect(parameterizeCapabilityIntent({ id: "corner-glazing", stage: "t", parameters: { massId: "living" } }, [m], west).parameters).toMatchObject({ corner: viewCorner(m, [m], west) });
  });

  it("puts view glazing on the view for a view the old fixed south-east corner missed", () => {
    const north: SiteStrategy = { ...site, viewDirection: "north", arrivalDirection: "south" };
    const m = planned(mass("living"));
    const intent = parameterizeCapabilityIntent({ id: "corner-glazing", stage: "t", parameters: { massId: "living" } }, [m], north);
    const e = collectV2Evidence({ ...doc([mass("living", { openings: [] })], [intent]), siteStrategy: north })!;
    expect(e.glass.some((g) => g.side === "north")).toBe(true);
  });
});

describe("screen layer is real, rotation-aware V2 geometry", () => {
  const screen = (facade: string, over: Record<string, unknown> = {}) => ({ id: "screen-layer", stage: "test", parameters: { massId: "living", facade, ...over } });

  it("is registered as supported by its plugin and compiles through the capability engine", () => {
    expect(capabilityRegistry.get("screen-layer")?.metadata.status).toBe("supported");
    expect(capabilityById("screen-layer")?.status).toBe("supported");
    const { model, diagnostics } = compile(doc([mass("living", { openings: [{ type: "glazing-zone", facade: "south", start: 0.1, end: 0.9, heightRatio: 0.88 }] })], [screen("south")]));
    expect(diagnostics!.capabilities).toEqual([expect.objectContaining({ id: "screen-layer", status: "applied" })]);
    expect(boxes(model.primitives).filter((p) => p.label.endsWith("Screen Layer · Batten")).length).toBeGreaterThan(20);
  });

  it("falls back — building nothing — when it cannot apply", () => {
    const { diagnostics, model } = compile(doc([mass("living")], [{ id: "screen-layer", stage: "test", parameters: { massId: "living" } }]));
    expect(diagnostics!.capabilities[0].status).toBe("fallback");
    expect(model.primitives.some((p) => p.label.startsWith("Screen Layer"))).toBe(false);
  });

  it("stands in front of the requested world facade on a rotated mass", () => {
    const m = mass("living", { position: { x: 3, z: -2 }, rotation: Math.PI / 2 });
    const out = requestCapability(screen("south", { depth: 0.5 }), { primitives: [], target: m });
    const [wx, wz] = SIDE_VECTOR.south;
    // Rotated 90°, the local west facade (half-width 7) faces world south: battens sit 7 + 0.5 out along +z.
    for (const p of boxes(out.primitives)) expect((p.position[0] - m.position.x) * wx + (p.position[2] - m.position.z) * wz).toBeCloseTo(7.5, 5);
    expect(boxes(out.primitives).every((p) => p.rotation[1] === m.rotation)).toBe(true);
  });

  it("realizes a planned 'screened' facade as glazing plus a compiled screen, and the review credits it", () => {
    const d = realized([planned(mass("living"), { viewFacade: "screened", outdoor: "none" })]);
    expect(d.capabilities).toContainEqual(expect.objectContaining({ id: "screen-layer", parameters: expect.objectContaining({ facade: "south" }) }));
    const e = collectV2Evidence(d)!;
    expect(e.screenElements).toBeGreaterThan(0);
    expect(e.glass.filter((g) => g.side === "south").every((g) => g.screened)).toBe(true);
    expect(score(d, "facade-rhythm").reason).toMatch(/a compiled screen on 1 facade/);
  });

  it("builds sun fins on a rotated volume as a screen layer instead of dropping them to glazing reveals", () => {
    const r = realizeVolumePlan(planned(mass("living", { rotation: 0.6 }), { viewFacade: "fin-screened", outdoor: "none" }), [], site);
    expect(r.capabilityIntents.map((i) => i.id)).toContain("screen-layer");
    expect(r.notes.join(" ")).toMatch(/screen layer/);
  });

  it("keeps one screen per facade when merging intents", () => {
    const merged = mergeCapabilityIntents([screen("south"), screen("north"), screen("south", { depth: 0.4 })]);
    expect(merged.map((i) => i.parameters?.facade).sort()).toEqual(["north", "south"]);
  });
});
