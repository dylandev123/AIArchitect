import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { authoredPlan } from "../../__tests__/authoredFixtures";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const ctx = { brief: "A quiet family house", hints: {}, environment: "suburban" as const, viewDirection: "south" as const, arrivalDirection: "north" as const };

const validSiteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Kept level." };
const validPrimaryMass = { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, plan: authoredPlan("main-living") };
const validIntent = { mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" };

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("foundation stage", () => {
  it("accepts an otherwise-valid response with overflowing goal arrays in a single call, trimming and deduplicating instead of retrying", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    generateText.mockResolvedValueOnce({
      output: {
        intent: {
          // 5 spatialGoals (max 4, with one duplicate), 4 mood (max 3), 4 environmentalGoals (max 3) — all
          // individually valid enum values, just too many of them.
          mood: ["calm", "drama", "intimacy", "grand-entertaining"],
          spatialGoals: ["privacy", "privacy", "views", "shelter", "daylight"],
          environmentalGoals: ["shelter", "cross-ventilation", "daylight", "privacy"],
          hierarchyGoals: ["a", "b", "c", "d", "e"],
          compositionBias: "asymmetrical",
          style: "contemporary",
        },
        siteStrategy: validSiteStrategy,
        primaryMass: validPrimaryMass,
      },
      totalUsage: {},
    });

    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);

    expect(generateText).toHaveBeenCalledTimes(1);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.attempts).toBe(1);
    expect(result.value.intent.mood).toHaveLength(3);
    expect(result.value.intent.spatialGoals).toHaveLength(4);
    expect(result.value.intent.spatialGoals).toEqual(["privacy", "views", "shelter", "daylight"]);
    expect(result.value.intent.environmentalGoals).toHaveLength(3);
  });

  it("still retries a structurally unusable response (off-vocabulary value), rather than pretending normalization fixes everything", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    generateText
      .mockResolvedValueOnce({
        output: {
          intent: {
            mood: ["calm", "expansiveness"], // "expansiveness" isn't in the closed vocabulary — not fixable by capping array length
            spatialGoals: ["privacy"],
            environmentalGoals: ["daylight"],
            hierarchyGoals: ["legible main living volume"],
            compositionBias: "asymmetrical",
            style: "contemporary",
          },
          siteStrategy: validSiteStrategy,
          primaryMass: validPrimaryMass,
        },
        totalUsage: {},
      })
      .mockResolvedValueOnce({
        output: {
          intent: {
            mood: ["calm"],
            spatialGoals: ["privacy"],
            environmentalGoals: ["daylight"],
            hierarchyGoals: ["legible main living volume"],
            compositionBias: "asymmetrical",
            style: "contemporary",
          },
          siteStrategy: validSiteStrategy,
          primaryMass: validPrimaryMass,
        },
        totalUsage: {},
      });

    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });

  it("fails — with no default intent, site strategy or primary mass — when a field stays invalid on every attempt", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    // Every attempt returns a valid intent/primaryMass but an invalid siteStrategy.arrivalDirection
    // ("southeast" isn't a CompassSide). Nothing is salvaged field-by-field and nothing is defaulted.
    generateText.mockResolvedValue({
      output: { intent: validIntent, siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "southeast", terrain: "level", terrainResponse: "Kept level." }, primaryMass: validPrimaryMass },
      totalUsage: {},
    });

    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("value");
    expect(!result.ok && result.errors.join(" ")).toMatch(/arrivalDirection/);
  });

  it("fails — never a generic default pavilion — when every attempt errors outright (network/provider error)", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    generateText.mockRejectedValue(new Error("provider unavailable"));

    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("value");
  });

  it("asks for a repair when the primary mass's plan is incomplete, and accepts the completed plan exactly as authored", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    const authored = authoredPlan("main-living", { form: "prow", roofEdge: "floating" });
    generateText
      .mockResolvedValueOnce({ output: { intent: validIntent, siteStrategy: validSiteStrategy, primaryMass: { ...validPrimaryMass, plan: { form: "prow", viewFacade: "curtain-wall" } } }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { intent: validIntent, siteStrategy: validSiteStrategy, primaryMass: { ...validPrimaryMass, plan: authored } }, totalUsage: {} });

    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect((generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content).toMatch(/repair-required:plan-incomplete.*viewFacade/);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.value.primaryMass.plan).toEqual(authored);
    expect(result.repairRequests?.join(" ")).toMatch(/plan-incomplete/);
  });

  it("fails rather than defaulting when the primary mass never gets a plan at all", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    generateText.mockResolvedValue({ output: { intent: validIntent, siteStrategy: validSiteStrategy, primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1 } }, totalUsage: {} });
    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/plan-incomplete.*form, height, hierarchy/);
  });

  it("asks for a repair when the primary mass cannot carry its own plan (a setback on one floor)", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    generateText.mockResolvedValue({ output: { intent: validIntent, siteStrategy: validSiteStrategy, primaryMass: { ...validPrimaryMass, plan: authoredPlan("main-living", { form: "setback" }) } }, totalUsage: {} });
    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toMatch(/repair-required:plan-unbuildable mass-0\].*setback needs 2\+ floors/);
  });
});
