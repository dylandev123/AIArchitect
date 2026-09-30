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
    expect(result.stopReason).toBe("hard-cap");
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
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "Extra wing.", mass: { name: "Studio Wing", role: "connector", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "not-a-real-mass", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "Extra wing, corrected.", mass: { name: "Studio Wing", role: "connector", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The plan is complete as designed." }, totalUsage: {} });

    // The model's own "done" remains the only normal completion signal, keeping this test isolated to
    // the repair-retry recovery it exercises.
    const result = await runMassExpansionStage({ brief: "A house with an extra studio wing", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    expect(generateText).toHaveBeenCalledTimes(3);
  });

  it("lets the architect explicitly complete composition after the brief's explicit program is placed", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A guest wing serves visiting family.", mass: { name: "Guest Wing", role: "guest-pavilion", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The guest wing and living pavilion complete this compact composition." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A house with a guest wing", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(result.stopReason).toBe("model-done");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("recovers a degree-like rotationOffset locally, without spending a second model call on a repair retry", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    // Mirrors the live failure: the model emits a degree value (90) for rotationOffset where the schema
    // requires radians in [-π, π]. `generateText` throws the way the AI SDK does when `Output.object`'s
    // internal schema check fails — `NoObjectGeneratedError` wrapping a `TypeValidationError` whose cause
    // carries the raw, still-recoverable value.
    const { NoObjectGeneratedError, TypeValidationError } = await import("ai");
    const rawValue = {
      decision: "add", reasoning: "A garden wing offset from the living pavilion.",
      mass: { name: "Garden Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1 },
      relationships: [{ kind: "offset-from", target: "mass-0", side: "east", distance: 2, rotationOffset: 90 }],
    };
    const typeValidationError = new TypeValidationError({ value: rawValue, cause: new Error("relationships.0.rotationOffset: Too big: expected number to be <=3.141592653589793") });
    generateText
      .mockRejectedValueOnce(new NoObjectGeneratedError({
        message: "No object generated: response did not match schema.", cause: typeValidationError, text: "",
        response: { id: "x", timestamp: new Date(), modelId: "test" },
        usage: { inputTokens: 0, inputTokenDetails: {}, outputTokens: 0, outputTokenDetails: {}, totalTokens: 0 } as ConstructorParameters<typeof NoObjectGeneratedError>[0]["usage"],
        finishReason: "stop",
      }))
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The plan is complete as designed." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A house with a garden wing", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    // rotationOffset 90° recovered as ~π/2 radians, applied onto the target's own rotation (0 here).
    expect(result.masses[1].rotation).toBeCloseTo(Math.PI / 2, 5);
    // Only 2 calls total: the failed-then-recovered turn 1, plus the "done" turn 2 — no repair-retry call
    // was spent recovering the rotation.
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("still goes through the normal repair retry (not a silent guess) for a rotationOffset far too large to be degrees or an overshoot", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A wing with a nonsensical rotation.", mass: { name: "Odd Wing", role: "connector", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east", rotationOffset: 999999 }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "Corrected.", mass: { name: "Odd Wing", role: "connector", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The plan is complete as designed." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A house with an extra wing", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    // The nonsensical value cost a real repair-retry call (3 total), unlike the locally-recoverable case above.
    expect(generateText).toHaveBeenCalledTimes(3);
  });

  it("resolves a view-facing relationship without crashing, using the pipeline's real site strategy (regression: live crash was 'Cannot read properties of undefined (reading viewDirection)')", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    // Mirrors the exact live failure: the model accepted a bedroom wing with a "view-facing" relationship.
    // `resolvedSoFar` (internal to this module) used to resolve that relationship against a stub document
    // missing `siteStrategy` entirely, crashing the instant a mass like this was accepted.
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A bedroom wing that opens directly onto the view.", mass: { name: "Bedroom Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1 }, relationships: [{ kind: "view-facing", target: "mass-0" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The plan is complete as designed." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A house with a bedroom wing facing the view", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    // siteStrategy.viewDirection is "south" ([0,1]) here, so the resolved yaw is 0 — proves it was resolved
    // against the real site strategy, not crashed (or silently left at some other value) on an undefined one.
    expect(result.masses[1].rotation).toBeCloseTo(0, 5);
  });

  it("resolves an arrival-facing relationship without crashing, using the pipeline's real site strategy", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    generateText
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A garage that fronts the arrival court.", mass: { name: "Garage", role: "garage", width: 7, depth: 6, floors: 1 }, relationships: [{ kind: "arrival-facing", target: "mass-0" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The plan is complete as designed." }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A house with a garage facing the arrival court", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(2);
    expect(Number.isFinite(result.masses[1].rotation)).toBe(true);
  });

  it("reports a turn-1 failure as failed, not as hitting the hard cap, and preserves the one accepted mass", async () => {
    const { runMassExpansionStage } = await import("../massExpansionStage");
    // Every attempt (including the repair retry) returns a response missing "mass" for an "add" decision —
    // structurally unusable, so this should exhaust retries and fail on turn 1, before any hard cap is reached.
    generateText.mockResolvedValue({ output: { decision: "add" }, totalUsage: {} });

    const result = await runMassExpansionStage({ brief: "A sprawling estate", intent, siteStrategy, primaryMass }, createTimings(), 60_000, usageMeta);
    expect(result.masses).toHaveLength(1); // only the primary mass — nothing was ever accepted
    expect(result.stopReason).toBe("failed");
    expect(result.hadFailure).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.failedAtTurn).toBe(1);
    expect(result.stopMessage).toBe("mass expansion failed on turn 1; preserving 1 accepted mass");
    expect(result.stopMessage).not.toContain("hard cap");
  });
  describe("space-plan required volumes", () => {
    const addMass = (name: string, role: string, side: string) => ({ output: { decision: "add", reasoning: `${name} serves the plan.`, mass: { name, role, width: 7, depth: 6, floors: 1 }, relationships: [{ kind: "separated-from", target: "mass-0", side, distance: 3 }] }, totalUsage: {} });
    const done = (reasoning: string) => ({ output: { decision: "done", reasoning }, totalUsage: {} });
    const spacePlanVolumes = async () => {
      const { createSpacePlan, selectDesignStrategies } = await import("../../designEngine");
      const { plannedVolumesFromSpacePlan } = await import("../massExpansionStage");
      return plannedVolumesFromSpacePlan(createSpacePlan(intent, selectDesignStrategies(intent)));
    };

    it("derives the four planned volumes from the space plan", async () => {
      expect((await spacePlanVolumes()).map((v) => v.id)).toEqual(["living-pavilion", "private-wing", "outdoor-pavilion", "service-spine"]);
    });

    it("does not stop at 2 masses when the space plan requires 4 — a premature \"done\" is pushed back until every volume is placed", async () => {
      const { runMassExpansionStage } = await import("../massExpansionStage");
      // The live failure: a bedroom wing, then "done" with only 2 of the plan's 4 volumes built.
      generateText
        .mockResolvedValueOnce(addMass("Bedroom Wing", "bedroom-wing", "west"))
        .mockResolvedValueOnce(done("The living pavilion and bedroom wing serve the brief."))
        .mockResolvedValueOnce(addMass("Pool Pavilion", "terrace", "south"))
        .mockResolvedValueOnce(addMass("Service Spine", "garage", "east"))
        .mockResolvedValueOnce(done("The four programmed volumes now form the intended composition."));

      const result = await runMassExpansionStage({ brief: "A family home with bedrooms", intent, siteStrategy, primaryMass, requiredVolumes: await spacePlanVolumes() }, createTimings(), 60_000, usageMeta);

      expect(result.masses.map((m) => m.role)).toEqual(["main-living", "bedroom-wing", "terrace", "garage"]);
      expect(result.stopReason).toBe("model-done");
      expect(result.unplacedVolumes).toEqual([]);
      // Program coverage unlocks, but never substitutes for, the architect's completion decision.
      expect(generateText).toHaveBeenCalledTimes(5);
      const pushBack = generateText.mock.calls[2][0].messages[0].content as string;
      expect(pushBack).toMatch(/You answered "done"/);
      expect(pushBack).toContain("outdoor-pavilion");
      expect(pushBack).toContain("service-spine");
    });

    it("reports each required volume the model explicitly declines to place, with its reason", async () => {
      const { runMassExpansionStage } = await import("../massExpansionStage");
      generateText
        .mockResolvedValueOnce(addMass("Bedroom Wing", "bedroom-wing", "west"))
        .mockResolvedValueOnce(done("Enough."))
        .mockResolvedValueOnce(done("A 12m-wide urban lot leaves no room for a separate service volume or pool pavilion."));

      const result = await runMassExpansionStage({ brief: "A narrow urban home", intent, siteStrategy, primaryMass, requiredVolumes: await spacePlanVolumes() }, createTimings(), 60_000, usageMeta);

      expect(result.masses).toHaveLength(2);
      expect(result.stopReason).toBe("model-done");
      expect(result.unplacedVolumes.map((v) => v.id)).toEqual(["outdoor-pavilion", "service-spine"]);
      for (const v of result.unplacedVolumes) expect(v.reason).toContain("12m-wide urban lot");
      expect(result.stopMessage).toMatch(/2 of 4 required volume\(s\) not placed/);
    });

    it("reports unplaced volumes when a failure, not a decision, stops the loop", async () => {
      const { runMassExpansionStage } = await import("../massExpansionStage");
      generateText
        .mockResolvedValueOnce(addMass("Bedroom Wing", "bedroom-wing", "west"))
        .mockRejectedValue(new Error("provider unavailable"));

      const result = await runMassExpansionStage({ brief: "A family home", intent, siteStrategy, primaryMass, requiredVolumes: await spacePlanVolumes() }, createTimings(), 60_000, usageMeta);

      expect(result.stopReason).toBe("failed");
      expect(result.unplacedVolumes.map((v) => v.id)).toEqual(["outdoor-pavilion", "service-spine"]);
      expect(result.unplacedVolumes[0].reason).toMatch(/failed on turn 2/);
    });
  });
});
