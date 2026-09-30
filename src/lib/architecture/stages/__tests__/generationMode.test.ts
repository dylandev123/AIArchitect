import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { ARCHITECTURE_FIXTURES } from "../../fixtures";
import { architectureGenerationMode } from "../generationMode";

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };

describe("architecture generation routing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("../architectStage");
    vi.doUnmock("../foundationStage");
    vi.doUnmock("../massExpansionStage");
    vi.doUnmock("../geometryStage");
    vi.doUnmock("../roofStage");
  });

  it.each([
    [undefined, "single-architect"],
    ["0", "single-architect"],
    ["false", "single-architect"],
    ["1", "legacy-staged"],
  ] as const)("maps AI_ARCHITECT_LEGACY_PIPELINE=%s to %s", (value, expected) => {
    if (value !== undefined) vi.stubEnv("AI_ARCHITECT_LEGACY_PIPELINE", value);
    expect(architectureGenerationMode()).toBe(expected);
  });

  it("uses only AI Architect by default; Foundation, Mass Expansion, Geometry, and Roof are not invoked", async () => {
    const architect = vi.fn().mockResolvedValue({ ok: true, document: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, attempts: 1, durationMs: 10 });
    const legacyStage = vi.fn().mockRejectedValue(new Error("legacy stage must not run"));
    vi.doMock("../architectStage", () => ({ runArchitectStage: architect }));
    vi.doMock("../foundationStage", () => ({ runFoundationStage: legacyStage }));
    vi.doMock("../massExpansionStage", () => ({ runMassExpansionStage: legacyStage }));
    vi.doMock("../geometryStage", () => ({ runGeometryStage: legacyStage }));
    vi.doMock("../roofStage", () => ({ runRoofCompositionStage: legacyStage }));
    const { runArchitecturePipeline } = await import("../pipeline");

    const result = await runArchitecturePipeline({ brief: "A tropical pavilion", hints: {} }, createTimings(), 60_000, usageMeta);

    expect(result.diagnostics).toEqual([expect.objectContaining({ stage: "architect", generationMode: "single-architect" })]);
    expect(architect).toHaveBeenCalledTimes(1);
    expect(legacyStage).not.toHaveBeenCalled();
  });
});
