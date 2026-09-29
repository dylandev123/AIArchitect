import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import type { ArchitecturalIntent } from "../../designEngine";
import type { MassVolume } from "../../document";

/**
 * Isolated from pipeline.test.ts: those tests mock only the "ai" module and let every stage module run for
 * real. These tests need to mock individual stage modules directly (a broken Foundation result, a stage that
 * throws a genuine JS bug rather than a model failure) — using `vi.doMock` + `vi.resetModules()` per test so
 * this file never leaks a stage mock into pipeline.test.ts or vice versa.
 */

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };

const intent: ArchitecturalIntent = {
  mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"],
  compositionBias: "asymmetrical", source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "contemporary" },
};
const primaryMass: MassVolume = { id: "mass-0", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0 };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("../foundationStage");
  vi.doUnmock("../massExpansionStage");
  vi.doUnmock("../geometryStage");
  vi.resetModules();
});

describe("pipeline invariants", () => {
  it("throws immediately, before any downstream (AI-costing) stage runs, if Foundation ever produces an incomplete SiteStrategy", async () => {
    // Simulates a future regression in Foundation's own guarantee (toResult in foundationStage.ts) that every
    // branch — ok/recovered/fallback — always returns a complete SiteStrategy. This is the safety net for
    // that guarantee, not a test of foundationStage.ts itself (see foundationStage.test.ts for that).
    vi.doMock("../foundationStage", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../foundationStage")>();
      return {
        ...actual,
        runFoundationStage: vi.fn().mockResolvedValue({
          value: {
            intent,
            // arrivalDirection missing entirely.
            siteStrategy: { environment: "suburban", viewDirection: "south", terrain: "level" },
            terrainResponse: "Kept level.",
            primaryMass,
          },
          status: "ok", attempts: 1, durationMs: 10, recoveredFields: [], defaultedFields: [],
        }),
      };
    });
    const massExpansionSpy = vi.fn();
    vi.doMock("../massExpansionStage", () => ({ runMassExpansionStage: massExpansionSpy }));

    const { runArchitecturePipeline } = await import("../pipeline");
    await expect(
      runArchitecturePipeline({ brief: "A quiet family house", hints: {} }, createTimings(), 60_000, usageMeta)
    ).rejects.toThrow(/invariant violated.*arrivalDirection/i);
    // Mass Expansion (a paid model call) never ran against the broken SiteStrategy.
    expect(massExpansionSpy).not.toHaveBeenCalled();
  });

  it("preserves accepted masses for Replay (via onUpstreamProgress) when a later, purely deterministic stage throws", async () => {
    // Foundation and Mass Expansion run for real (mocked at the "ai" boundary would require its own vi.mock
    // here; instead this test stubs them directly at the stage level, which is cheaper and keeps the focus on
    // what's actually being proven: that upstream progress already reported survives a downstream crash).
    const foundationResult = {
      value: {
        intent,
        siteStrategy: { environment: "suburban" as const, viewDirection: "south" as const, arrivalDirection: "north" as const, terrain: "level" as const },
        terrainResponse: "Kept level.",
        primaryMass,
      },
      status: "ok" as const, attempts: 1, durationMs: 10, recoveredFields: [], defaultedFields: [],
    };
    const bedroomWing: MassVolume = { id: "mass-1", name: "Bedroom Wing", role: "bedroom-wing", position: { x: 10, z: 0 }, width: 9, depth: 7, floors: 1, elevation: 0, rotation: 0 };
    vi.doMock("../foundationStage", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../foundationStage")>();
      return { ...actual, runFoundationStage: vi.fn().mockResolvedValue(foundationResult) };
    });
    vi.doMock("../massExpansionStage", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../massExpansionStage")>();
      return {
        ...actual,
        runMassExpansionStage: vi.fn().mockResolvedValue({
          masses: [primaryMass, bedroomWing], capabilityIntents: [], capabilityRequests: [], log: [],
          stopReason: "model-done", completed: true, stopMessage: "", truncated: false,
          modelCalls: 2, retries: 0, durationMs: 20, hadFailure: false, unplacedVolumes: [],
        }),
      };
    });
    // A genuinely deterministic bug — not a model failure (those degrade to a fallback inside the stage and
    // never throw here) — surfacing as an uncaught throw, same shape as the real viewDirection crash was.
    vi.doMock("../geometryStage", () => ({
      runGeometryStage: vi.fn().mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'someField')")),
    }));

    const { runArchitecturePipeline } = await import("../pipeline");
    const progressSnapshots: { masses?: readonly MassVolume[] }[] = [];
    await expect(
      runArchitecturePipeline(
        { brief: "A quiet family house with a bedroom wing", hints: {} }, createTimings(), 60_000, usageMeta,
        () => {},
        (upstream) => progressSnapshots.push(upstream)
      )
    ).rejects.toThrow(/someField/);

    // The last progress snapshot reported before the crash still has both accepted masses — Replay (route.ts,
    // devSessionCache.ts) resumes from exactly this state instead of repaying for Foundation + Mass Expansion.
    expect(progressSnapshots.length).toBeGreaterThan(0);
    const last = progressSnapshots[progressSnapshots.length - 1];
    expect(last.masses).toHaveLength(2);
    expect(last.masses?.map((m) => m.id)).toEqual(["mass-0", "mass-1"]);
  });
});
