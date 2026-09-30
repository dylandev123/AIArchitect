import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSONParseError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { createTimings } from "@/lib/ai/timing";
import type { ArchitecturalIntent } from "../../designEngine";
import type { MassVolume, SiteStrategy } from "../../document";
import { mandatoryBaseline } from "../../planBaseline";
import { withVolumePlan } from "../../volumePlan";
import { authoredPlan, baselineAsOperations, QUIET_PLAN, referenceGeometry } from "../../__tests__/authoredFixtures";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const intent: ArchitecturalIntent = {
  mood: ["calm"], spatialGoals: ["views"], environmentalGoals: ["daylight"], hierarchyGoals: ["living volume dominates"],
  compositionBias: "asymmetrical", source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "contemporary" },
};
const siteStrategy: SiteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" };
const masses: MassVolume[] = [
  withVolumePlan({ id: "mass-0", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0 }, {}),
  withVolumePlan({ id: "mass-1", name: "Bedrooms", role: "bedroom-wing", position: { x: -14, z: 0 }, width: 10, depth: 7, floors: 1, elevation: 0, rotation: 0 }, {}),
  withVolumePlan({ id: "mass-2", name: "Garage", role: "garage", position: { x: 14, z: 0 }, width: 7, depth: 6, floors: 1, elevation: 0, rotation: 0 }, {}),
];

/** Distinctive authored glazing, so its presence proves the model's output was built. (These masses' plans ask for nothing, so any response is complete.) */
const REFINED_GLAZING = { type: "glazing-zone", facade: "south", start: 0.31, end: 0.69, heightRatio: 0.77 };

function noObject(opts: { text?: string; cause?: Error; finishReason: "length" | "stop" }) {
  return new NoObjectGeneratedError({
    message: opts.cause && TypeValidationError.isInstance(opts.cause) ? "No object generated: response did not match schema." : "No object generated: could not parse the response.",
    cause: opts.cause, text: opts.text,
    response: { id: "x", timestamp: new Date(), modelId: "test" },
    usage: { inputTokens: 0, inputTokenDetails: {}, outputTokens: 0, outputTokenDetails: {}, totalTokens: 0 } as ConstructorParameters<typeof NoObjectGeneratedError>[0]["usage"],
    finishReason: opts.finishReason,
  });
}

/** Mirrors the live failure: the response is cut off at the token limit partway through the last mass's operations. */
const truncatedText = JSON.stringify({
  results: [
    { massId: "mass-0", operations: [REFINED_GLAZING] },
    { massId: "mass-1", operations: [{ type: "opening-rhythm", facade: "south", count: 4, width: 1.1, height: 1.4, sill: 0.9 }] },
    { massId: "mass-2", operations: [{ type: "opening-rhythm", facade: "north", count: 3, width: 1.0, height: 1.2, sill: 0.9 }] },
  ],
}).slice(0, -40);

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("architectural geometry stage — structured-output robustness", () => {
  it("fails — building no reference geometry — when both attempts are cut off, retrying with more room", async () => {
    const { runGeometryStage } = await import("../geometryStage");
    const parseError = () => new JSONParseError({ text: truncatedText, cause: new SyntaxError("Unexpected end of JSON input") });
    generateText
      .mockRejectedValueOnce(noObject({ text: truncatedText, cause: parseError(), finishReason: "length" }))
      .mockRejectedValueOnce(noObject({ text: truncatedText, cause: parseError(), finishReason: "length" }));

    const result = await runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses }, createTimings(), 60_000, usageMeta);

    expect(generateText).toHaveBeenCalledTimes(2);
    // A cut-off response is never trusted, in whole or in part, and no baseline stands in for it.
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("byMassId");
    // A cut-off response is retried with more room, not the same budget that just cut it off.
    expect(generateText.mock.calls[1][0].maxOutputTokens).toBeGreaterThan(generateText.mock.calls[0][0].maxOutputTokens);
  });

  it("fails rather than silently dropping an invalid operation when every attempt fails the schema on it", async () => {
    const { runGeometryStage } = await import("../geometryStage");
    const raw = {
      results: [
        { massId: "mass-0", operations: [REFINED_GLAZING, { type: "recess", facade: "south", start: 0.8, end: 0.2, depth: 1 }] },
        { massId: "mass-1", operations: [] },
        { massId: "mass-2", operations: [] },
      ],
    };
    const invalid = () => noObject({ cause: new TypeValidationError({ value: raw, cause: new Error("results.0.operations.1.end: end must be greater than start.") }), finishReason: "stop" });
    generateText.mockRejectedValueOnce(invalid()).mockRejectedValueOnce(invalid());

    const result = await runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses }, createTimings(), 60_000, usageMeta);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/end must be greater than start/);
  });

  it("accepts a clean retry after a cut-off first attempt", async () => {
    const { runGeometryStage } = await import("../geometryStage");
    generateText
      .mockRejectedValueOnce(noObject({ text: truncatedText, cause: new JSONParseError({ text: truncatedText, cause: new SyntaxError("Unexpected end") }), finishReason: "length" }))
      .mockResolvedValueOnce({ output: { results: masses.map((m) => ({ massId: m.id, operations: m.id === "mass-0" ? [REFINED_GLAZING] : [] })) }, totalUsage: {} });

    const result = await runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses }, createTimings(), 60_000, usageMeta);

    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.attempts).toBe(2);
    expect(result.byMassId.get("mass-0")!.openings).toEqual([expect.objectContaining({ start: 0.31, end: 0.69, heightRatio: 0.77 })]);
    // The repair message tells the model why it failed, so it can answer more compactly.
    expect(generateText.mock.calls[1][0].messages[0].content).toMatch(/exhausted the output budget before completing the structured result/);
  });

  it("fails when nothing usable came back — the plan's reference is never built in its place", async () => {
    const { runGeometryStage } = await import("../geometryStage");
    generateText.mockRejectedValue(noObject({ text: "I cannot comply", cause: new JSONParseError({ text: "I cannot comply", cause: new SyntaxError("bad") }), finishReason: "stop" }));

    const result = await runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses }, createTimings(), 60_000, usageMeta);

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("byMassId");
  });
});

describe("architectural geometry stage — the AI owns the built geometry", () => {
  const living = withVolumePlan({ id: "mass-0", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0 }, authoredPlan("main-living", { viewFacade: "screened" }));
  const run = async (planned: MassVolume[]) => (await import("../geometryStage")).runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses: planned }, createTimings(), 60_000, usageMeta);

  it("builds the mandatory baseline plus the architect's refinements and additions: the canopy carries the refined parameters", async () => {
    const baseline = mandatoryBaseline(living, [living], siteStrategy);
    const canopy = baseline.elements.find((e) => e.kind === "capability" && e.value.id === "entry-canopy")!;
    const authored = referenceGeometry(living, [living], siteStrategy);
    generateText.mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: authored, refinements: [{ id: canopy.id, width: 5.1, depth: 2.4 }] }] }, totalUsage: {} });
    const result = await run([living]);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.attempts).toBe(1);
    expect(result.capabilityIntents).toContainEqual({ id: "entry-canopy", stage: "architectural-geometry", parameters: { massId: "mass-0", facade: "north", width: 5.1, depth: 2.4, height: expect.any(Number) } });
    expect(result.capabilityIntents).toContainEqual(expect.objectContaining({ id: "screen-layer", parameters: expect.objectContaining({ massId: "mass-0", facade: "south" }) }));
    const geometry = result.byMassId.get("mass-0")!;
    // Every baseline element once, under its id, plus exactly the architect's additions.
    expect([...geometry.operations, ...geometry.openings]).toHaveLength(baseline.elements.filter((e) => e.kind !== "capability").length + authored.length);
    expect([...geometry.operations, ...geometry.openings].map((o) => o.id)).toEqual(expect.arrayContaining(baseline.elements.filter((e) => e.kind !== "capability").map((e) => e.id)));
  });

  it("never asks the architect to re-author mandatory glazing, doors, canopies or screens — only its own planned elements are sent back", async () => {
    generateText.mockResolvedValue({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} });
    const result = await run([living]);
    expect(result.ok).toBe(false);
    const errors = !result.ok ? result.errors.join("\n") : "";
    // The outdoor room is the Geometry Pass's to place, so leaving it out is still a repair request…
    expect(errors).toMatch(/missing its planned open \(open:true\) recess or projection/);
    // …but the plan's glazing, entry door, canopy and screen are already built and are never reported missing.
    expect(errors).not.toMatch(/glazing-zone|\bdoor\b|canopy|screen|entry-recess/);
  });

  it("rejects geometry on a wall another volume stands against, and a canopy on a volume turned off the site axes", async () => {
    const left = withVolumePlan({ id: "mass-0", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 10, depth: 8, floors: 1, elevation: 0, rotation: 0 }, QUIET_PLAN);
    const right = withVolumePlan({ id: "mass-1", name: "Studio", role: "guest-pavilion", position: { x: 10, z: 0 }, width: 10, depth: 8, floors: 1, elevation: 0, rotation: 0.4 }, QUIET_PLAN);
    generateText.mockResolvedValue({ output: { results: [
      { massId: "mass-0", operations: [{ type: "glazing-zone", facade: "east", start: 0.2, end: 0.8, heightRatio: 0.8 }] },
      { massId: "mass-1", operations: [{ type: "canopy", facade: "north", width: 3, depth: 1.5 }] },
    ] }, totalUsage: {} });
    const result = await run([left, right]);
    expect(result.ok).toBe(false);
    const errors = !result.ok ? result.errors.join("\n") : "";
    expect(errors).toMatch(/repair-required:shared-wall mass-0\].*east facade/);
    expect(errors).toMatch(/repair-required:unbuildable-geometry mass-1\].*canopy/);
  });

  it("mechanically builds two mandatory north glazing zones and the north entry without asking Geometry to repeat them", async () => {
    const northGlass = withVolumePlan({ id: "mass-0", name: "North-light living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, authoredPlan("main-living", { viewFacade: "solid", arrivalFacade: "glass-wall", flankFacades: "solid", entry: "recessed", outdoor: "none" }));
    generateText.mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} });
    const result = await run([northGlass]);
    if (!result.ok) throw new Error(result.errors.join("; "));
    const openings = result.byMassId.get("mass-0")!.openings;
    expect(openings.filter((o) => o.type === "glazing-zone" && o.facade === "north")).toHaveLength(2);
    expect(openings.filter((o) => o.type === "door" && o.facade === "north")).toHaveLength(1);
    expect(new Set(openings.map((o) => o.id)).size).toBe(openings.length);
  });

  it("rejects moving a mandatory north glazing zone south or repeating mandatory openings", async () => {
    const northGlass = withVolumePlan({ id: "mass-0", name: "North-light living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, authoredPlan("main-living", { viewFacade: "solid", arrivalFacade: "glass-wall", flankFacades: "solid", entry: "recessed", outdoor: "none" }));
    const baseline = mandatoryBaseline(northGlass, [northGlass], siteStrategy);
    const glazing = baseline.elements.find((e) => e.kind === "opening" && e.value.type === "glazing-zone")!;
    const duplicate = baselineAsOperations(northGlass, [northGlass], siteStrategy);
    generateText.mockResolvedValue({ output: { results: [{ massId: "mass-0", operations: duplicate, refinements: [{ id: glazing.id, facade: "south" }] }] }, totalUsage: {} });
    const result = await run([northGlass]);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join("\n")).toMatch(/cannot be moved to the south facade|duplicates the mandatory|overlaps the mandatory/);
  });

  it("keeps planned form and terrace placement flexible while retaining baseline openings", async () => {
    const flexible = withVolumePlan({ id: "mass-0", name: "Flexible living", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0 }, authoredPlan("main-living", { form: "l-shape", outdoor: "covered-terrace", outdoorSide: "view" }));
    generateText.mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [
      { type: "notch", corner: "nw", width: 3, depth: 3 },
      { type: "projection", facade: "east", start: 0.2, end: 0.8, depth: 2, open: true },
      { type: "screen", facade: "west", start: 0.2, end: 0.7, depth: 0.4 },
    ] }] }, totalUsage: {} });
    const result = await run([flexible]);
    if (!result.ok) throw new Error(result.errors.join("; "));
    const geometry = result.byMassId.get("mass-0")!;
    expect(geometry.operations).toEqual(expect.arrayContaining([expect.objectContaining({ type: "notch", corner: "nw" }), expect.objectContaining({ type: "projection", facade: "east", open: true })]));
    expect(geometry.openings.some((o) => o.id?.includes(":plan:"))).toBe(true);
  });

  it("routes an impossible mandatory entry facade to its placing stage without making an AI call", async () => {
    const blocked = withVolumePlan({ id: "mass-0", name: "Blocked entry", role: "main-living", position: { x: 0, z: 0 }, width: 12, depth: 8, floors: 1, elevation: 0, rotation: 0 }, authoredPlan("main-living", { viewFacade: "solid", arrivalFacade: "solid", flankFacades: "solid", entry: "flush", outdoor: "none" }));
    const neighbour: MassVolume = { id: "mass-1", name: "North neighbour", role: "service", position: { x: 0, z: -6 }, width: 8, depth: 4, floors: 1, elevation: 0, rotation: 0 };
    const result = await run([blocked, neighbour]);
    // The entry belongs to the primary plan, but the neighbour that turned its facade into a shared wall was
    // placed by Mass Expansion, so that is the stage that must repair this composition conflict.
    expect(result).toMatchObject({ ok: false, owningStage: "mass-expansion", attempts: 0 });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("accepts a 5.4m notch when it fits the mass, but rejects a notch that exceeds the actual footprint", async () => {
    const roomy = withVolumePlan({ id: "mass-0", name: "Roomy", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 8, floors: 1, elevation: 0, rotation: 0 }, { ...QUIET_PLAN, form: "l-shape" });
    generateText.mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [{ type: "notch", corner: "se", width: 5, depth: 5.4 }] }] }, totalUsage: {} });
    expect((await run([roomy])).ok).toBe(true);
    generateText.mockResolvedValue({ output: { results: [{ massId: "mass-0", operations: [{ type: "notch", corner: "se", width: 5, depth: 8 }] }] }, totalUsage: {} });
    const invalid = await run([roomy]);
    expect(invalid.ok).toBe(false);
    expect(!invalid.ok && invalid.errors.join(" ")).toMatch(/outside its 16.0m × 8.0m footprint/);
  });
});
