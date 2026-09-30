import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSONParseError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { createTimings } from "@/lib/ai/timing";
import type { ArchitecturalIntent } from "../../designEngine";
import type { MassVolume, SiteStrategy } from "../../document";
import { withVolumePlan } from "../../volumePlan";
import { authoredPlan, QUIET_PLAN, referenceGeometry } from "../../__tests__/authoredFixtures";

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
    expect(generateText.mock.calls[1][0].messages[0].content).toMatch(/cut off at the token limit/);
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

  it("builds an authored response verbatim: canopies and screens carry the architect's own parameters", async () => {
    const authored = referenceGeometry(living, [living], siteStrategy).map((op) => (op.type === "canopy" ? { ...op, width: 5.1, depth: 2.4 } : op));
    generateText.mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: authored }] }, totalUsage: {} });
    const result = await run([living]);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.attempts).toBe(1);
    expect(result.capabilityIntents).toContainEqual({ id: "entry-canopy", stage: "architectural-geometry", parameters: { massId: "mass-0", facade: "north", width: 5.1, depth: 2.4, height: expect.any(Number) } });
    expect(result.capabilityIntents).toContainEqual(expect.objectContaining({ id: "screen-layer", parameters: expect.objectContaining({ massId: "mass-0", facade: "south" }) }));
    const geometry = result.byMassId.get("mass-0")!;
    expect([...geometry.operations, ...geometry.openings]).toHaveLength(authored.filter((op) => op.type !== "canopy" && op.type !== "screen" && op.type !== "sun-fins").length);
  });

  it("sends missing planned glazing, doors, canopies and screens back as repair requests — none is supplied", async () => {
    const reference = referenceGeometry(living, [living], siteStrategy);
    const stripped = reference.filter((op) => op.type !== "door" && op.type !== "canopy" && op.type !== "screen" && !(op.type === "glazing-zone" && op.facade === "east"));
    generateText.mockResolvedValue({ output: { results: [{ massId: "mass-0", operations: stripped }] }, totalUsage: {} });
    const result = await run([living]);
    expect(result.ok).toBe(false);
    const errors = !result.ok ? result.errors.join("\n") : "";
    expect(errors).toMatch(/missing its planned door on the north facade/);
    expect(errors).toMatch(/missing its planned canopy on the north facade/);
    expect(errors).toMatch(/missing its planned screen on the south facade/);
    expect(errors).toMatch(/missing its planned glazing-zone on the east facade/);
    // The recess without its door is also what the compiler would have to build solid.
    expect(errors).toMatch(/entry-recess on the north facade has no authored door/);
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
});
