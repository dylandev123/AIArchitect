import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import type { ArchitecturalIntent } from "../../designEngine";
import type { MassVolume, SiteStrategy } from "../../document";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const intent: ArchitecturalIntent = {
  mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"],
  compositionBias: "asymmetrical", source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "contemporary" },
};
const siteStrategy: SiteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" };
const primaryMass: MassVolume = { id: "mass-0", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0 };

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("mass expansion stage", () => {
  it("stops as soon as the model signals the composition is complete", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A private bedroom wing buffers from the living pavilion.", mass: { name: "Private Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1 }, relationships: [{ kind: "offset-from", target: "mass-0", side: "west", distance: 2 }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The living pavilion and private wing satisfy the brief." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A quiet family house", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.masses[1].position.x).not.toBe(0);
  });

  it("stops at the hard cap when the model never signals done", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    generateText.mockImplementation(() => {
      const idx = generateText.mock.calls.length;
      return Promise.resolve({ output: { decision: "add", reasoning: `Wing ${idx} adds service capacity.`, mass: { name: `Wing ${idx}`, role: "service", width: 5, depth: 5, floors: 1 }, relationships: [{ kind: "separated-from", target: "mass-0", side: "east", distance: 3 }] }, totalUsage: {} });
    });
    const result = await runMassExpansionStage({ brief: "A sprawling estate", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.truncated).toBe(true);
    expect(result.masses.length).toBeLessThanOrEqual(7);
    expect(result.masses.length).toBeGreaterThan(1);
  });

  it("never blocks placement on an unsupported requested operation, and files it as a capability request instead", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "An atrium would bring light into the plan.", mass: { name: "Atrium Wing", role: "connector", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "north", distance: 1 }], requestedOperation: "atrium" }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The plan is complete as designed." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A house with an atrium", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    expect(result.capabilityIntents).toEqual([]);
    expect(result.capabilityRequests).toEqual([{ operation: "atrium", stage: "mass-expansion", desiredBehaviour: "An atrium would bring light into the plan." }]);
  });

  it("recovers from a relationship targeting an unknown mass id via the repair retry, without throwing", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "Guest wing.", mass: { name: "Guest Wing", role: "guest-pavilion", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "not-a-real-mass", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "Guest wing, corrected.", mass: { name: "Guest Wing", role: "guest-pavilion", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The plan is complete as designed." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A house with a guest wing", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    expect(generateText).toHaveBeenCalledTimes(3);
  });
});
