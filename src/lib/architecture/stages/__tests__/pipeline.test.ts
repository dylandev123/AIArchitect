import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { validateArchitecturalDesignDocument } from "../../document";
import { compileArchitecture } from "../../compiler";
import { scoreArchitecture } from "../../critic";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("architecture stage pipeline", () => {
  it("lets two masses independently choose different roof families, and produces a compilable, valid document", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText
      // intent
      .mockResolvedValueOnce({ output: { mood: ["drama"], spatialGoals: ["views"], environmentalGoals: ["shelter"], hierarchyGoals: ["dominant living pavilion"], compositionBias: "asymmetrical", style: "contemporary hillside" }, totalUsage: {} })
      // site strategy
      .mockResolvedValueOnce({ output: { environment: "hillside", viewDirection: "south", arrivalDirection: "north", terrain: "stepped", terrainResponse: "Step the masses down toward the view." }, totalUsage: {} })
      // primary mass
      .mockResolvedValueOnce({ output: { name: "Main Living Pavilion", width: 16, depth: 9, floors: 1, reasoning: "Anchors the composition on the view side." }, totalUsage: {} })
      // mass expansion: one add, then done
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A private bedroom wing steps above and away from the living pavilion.", mass: { name: "Private Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1 }, relationships: [{ kind: "stepped-above", target: "mass-0", distance: 2.4 }, { kind: "offset-from", target: "mass-0", side: "west", distance: 1 }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
      // roof stage, mass-0
      .mockResolvedValueOnce({ output: { kind: "floating-flat", overhang: 1.4, reasoning: "The dominant volume gets an expressive floating plane toward the view." }, totalUsage: {} })
      // roof stage, mass-1
      .mockResolvedValueOnce({ output: { kind: "mono-pitch", overhang: 0.5, reasoning: "The bedroom wing gets a quieter shed roof, distinct from the main pavilion." }, totalUsage: {} });

    const result = await runArchitecturePipeline({ brief: "A dramatic hillside residence stepping to a sunset view", hints: { environment: "hillside", viewDirection: "south", approachSide: "north" } }, createTimings(), 120_000, usageMeta);

    expect(result.document.massing.masses).toHaveLength(2);
    const roofKinds = new Set(result.document.roofs.recipes.map((r) => r.kind));
    expect(roofKinds.size).toBe(2);
    expect(roofKinds.has("floating-flat")).toBe(true);
    expect(roofKinds.has("mono-pitch")).toBe(true);

    expect(validateArchitecturalDesignDocument(result.document)).toEqual([]);
    const compiled = compileArchitecture(result.document, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(compiled.errors).toEqual([]);
    expect(compiled.model.primitives.length).toBeGreaterThan(0);

    // The adapter's output must satisfy the same critic every deterministic design already does, without throwing.
    expect(() => scoreArchitecture(result.design, JSON.stringify({}), "A dramatic hillside residence")).not.toThrow();
    expect(result.design.masses).toHaveLength(2);
  });

  it("falls back to deterministic defaults for a stage that keeps failing validation, without failing the whole generation", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText.mockRejectedValue(new Error("model unavailable"));
    const result = await runArchitecturePipeline({ brief: "A simple family home", hints: {} }, createTimings(), 30_000, usageMeta);
    expect(result.document.massing.masses.length).toBeGreaterThanOrEqual(1);
    expect(validateArchitecturalDesignDocument(result.document)).toEqual([]);
  });
});
