import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSONParseError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { createTimings } from "@/lib/ai/timing";
import type { ArchitecturalIntent } from "../../designEngine";
import type { MassVolume, SiteStrategy } from "../../document";
import { withVolumePlan } from "../../volumePlan";

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

/** A distinctive refinement the baseline never produces, so its presence proves the model's output was used. */
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
  it("keeps every intact mass refinement when both attempts are cut off and fail to parse", async () => {
    const { runGeometryStage } = await import("../geometryStage");
    const parseError = () => new JSONParseError({ text: truncatedText, cause: new SyntaxError("Unexpected end of JSON input") });
    generateText
      .mockRejectedValueOnce(noObject({ text: truncatedText, cause: parseError(), finishReason: "length" }))
      .mockRejectedValueOnce(noObject({ text: truncatedText, cause: parseError(), finishReason: "length" }));

    const result = await runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses }, createTimings(), 60_000, usageMeta);

    expect(generateText).toHaveBeenCalledTimes(2);
    // Not the all-baseline fallback: the refinements that came through whole were kept.
    expect(result.hadFailure).toBe(false);
    expect(result.salvage?.salvagedMassIds).toEqual(["mass-0", "mass-1"]);
    // The cut-off last entry is never trusted — that mass gets its plan's baseline instead.
    expect(result.salvage?.baselineMassIds).toEqual(["mass-2"]);
    expect(result.byMassId.get("mass-0")!.openings).toContainEqual(expect.objectContaining({ start: 0.31, end: 0.69, heightRatio: 0.77 }));
    expect(result.byMassId.size).toBe(3);
    // A cut-off response is retried with more room, not the same budget that just cut it off.
    expect(generateText.mock.calls[1][0].maxOutputTokens).toBeGreaterThan(generateText.mock.calls[0][0].maxOutputTokens);
  });

  it("drops only the invalid operation, not the whole response, when every attempt fails the schema on one op", async () => {
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

    expect(result.hadFailure).toBe(false);
    expect(result.salvage).toMatchObject({ salvagedMassIds: ["mass-0", "mass-1", "mass-2"], baselineMassIds: [], droppedOperations: 1 });
    expect(result.byMassId.get("mass-0")!.openings).toContainEqual(expect.objectContaining({ start: 0.31, end: 0.69 }));
  });

  it("accepts a clean retry after a cut-off first attempt", async () => {
    const { runGeometryStage } = await import("../geometryStage");
    generateText
      .mockRejectedValueOnce(noObject({ text: truncatedText, cause: new JSONParseError({ text: truncatedText, cause: new SyntaxError("Unexpected end") }), finishReason: "length" }))
      .mockResolvedValueOnce({ output: { results: masses.map((m) => ({ massId: m.id, operations: m.id === "mass-0" ? [REFINED_GLAZING] : [] })) }, totalUsage: {} });

    const result = await runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses }, createTimings(), 60_000, usageMeta);

    expect(result.hadFailure).toBe(false);
    expect(result.salvage).toBeUndefined();
    expect(result.attempts).toBe(2);
    // The repair message tells the model why it failed, so it can answer more compactly.
    expect(generateText.mock.calls[1][0].messages[0].content).toMatch(/cut off at the token limit/);
  });

  it("still falls back to the full plan baseline when nothing usable came back", async () => {
    const { runGeometryStage } = await import("../geometryStage");
    generateText.mockRejectedValue(noObject({ text: "I cannot comply", cause: new JSONParseError({ text: "I cannot comply", cause: new SyntaxError("bad") }), finishReason: "stop" }));

    const result = await runGeometryStage({ brief: "A calm house", intent, siteStrategy, masses }, createTimings(), 60_000, usageMeta);

    expect(result.hadFailure).toBe(true);
    expect(result.salvage).toBeUndefined();
    expect([...result.byMassId.keys()]).toEqual(["mass-0", "mass-1", "mass-2"]);
  });
});
