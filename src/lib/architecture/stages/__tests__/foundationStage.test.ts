import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const ctx = { brief: "A quiet family house", hints: {}, environment: "suburban" as const, viewDirection: "south" as const, arrivalDirection: "north" as const };

const validSiteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Kept level." };
const validPrimaryMass = { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1 };

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
    expect(result.status).toBe("ok");
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
    expect(result.status).toBe("ok");
  });

  it("still produces a complete, valid SiteStrategy (invariant) when the model's siteStrategy is off-vocabulary on every attempt", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    // Every attempt returns a valid intent/primaryMass but an invalid siteStrategy.arrivalDirection
    // ("southeast" isn't a CompassSide) — a real value that field-level `recoverFields` cannot salvage.
    // Downstream stages (mass-expansion, architectural-geometry, roof-composition, the compiler) all read
    // `siteStrategy.viewDirection`/`arrivalDirection` unguarded, so this field must never reach them missing.
    generateText.mockResolvedValue({
      output: {
        intent: { mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" },
        siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "southeast", terrain: "level", terrainResponse: "Kept level." },
        primaryMass: validPrimaryMass,
      },
      totalUsage: {},
    });

    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(result.status).toBe("recovered");
    // The broken field was defaulted (to ctx.arrivalDirection), not left missing or invalid.
    expect(result.defaultedFields).toContain("siteStrategy.arrivalDirection");
    expect(result.value.siteStrategy).toEqual({ environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" });
  });

  it("still produces a complete, valid SiteStrategy (invariant) when every attempt fails outright (network/provider error)", async () => {
    const { runFoundationStage } = await import("../foundationStage");
    generateText.mockRejectedValue(new Error("provider unavailable"));

    const result = await runFoundationStage(ctx, createTimings(), 60_000, usageMeta);
    expect(result.status).toBe("fallback");
    expect(result.value.siteStrategy).toEqual({ environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" });
  });
});
