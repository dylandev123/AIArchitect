import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { validateArchitecturalDesignDocument } from "../../document";
import { compileArchitecture } from "../../compiler";
import { scoreArchitecture } from "../../critic";
import { QUIET_PLAN } from "../../__tests__/authoredFixtures";
import { isV2GenerationFailure } from "../recovery";

/** Every placed volume authors a complete plan (a missing plan field is a repair request, never a role default). */
const plan = QUIET_PLAN;

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("AI_ARCHITECT_LEGACY_PIPELINE", "1");
});

describe("architecture stage pipeline", () => {
  it("lets two masses independently choose different roof families, and produces a compilable, valid document", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText
      // foundation: intent + site strategy + primary mass in one call
      .mockResolvedValueOnce({ output: {
        intent: { mood: ["drama"], spatialGoals: ["views"], environmentalGoals: ["shelter"], hierarchyGoals: ["dominant living pavilion"], compositionBias: "asymmetrical", style: "contemporary hillside" },
        siteStrategy: { environment: "hillside", viewDirection: "south", arrivalDirection: "north", terrain: "stepped", terrainResponse: "Step the masses down toward the view." },
        primaryMass: { name: "Main Living Pavilion", width: 16, depth: 9, floors: 1, plan, reasoning: "Anchors the composition on the view side." },
      }, totalUsage: {} })
      // mass expansion: one add, then done — pushed back once (the space plan still requires its outdoor
      // pavilion and service spine), and the model insists, so the stage stops and reports why.
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A private bedroom wing steps above and away from the living pavilion.", mass: { name: "Private Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1, plan }, relationships: [{ kind: "stepped-above", target: "mass-0", distance: 2.4 }, { kind: "offset-from", target: "mass-0", side: "west", distance: 1 }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The steep lot only leaves room for two volumes." }, totalUsage: {} })
      // architectural geometry pass: one batched call for every mass
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
      // roof composition: one call for every mass
      .mockResolvedValueOnce({ output: { libraryRecipeId: "seam-library", language: { dominantMassId: "mass-0", family: "floating-flat", concept: "A floating plane over the living pavilion; low sheds beneath it." }, roofs: [
        { massId: "mass-0", kind: "floating-flat", overhang: 1.0, pitch: 2, reasoning: "The dominant volume gets an expressive floating plane toward the view." },
        { massId: "mass-1", kind: "mono-pitch", overhang: 0.5, pitch: 12, reasoning: "The bedroom wing gets a quieter shed roof, distinct from the main pavilion." },
      ] }, totalUsage: {} });

    const result = await runArchitecturePipeline({ brief: "A dramatic hillside residence stepping to a sunset view", hints: { environment: "hillside", viewDirection: "south", approachSide: "north" }, roofRecipes: [{
      id: "seam-library", name: "Standing Seam Hillside", category: "roof", styleTags: [], compatibleScales: [], environmentTags: [],
      parameters: [{ key: "system", value: "standing-seam" }, { key: "overhang", value: 1.1 }], relationships: [], guidance: [], usageCount: 0, successCount: 0, failureCount: 0, approval: "approved", version: 1, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }] }, createTimings(), 120_000, usageMeta);

    expect(result.document.massing.masses).toHaveLength(2);
    const roofKinds = new Set(result.document.roofs.recipes.map((r) => r.kind));
    expect(roofKinds.size).toBe(2);
    expect(roofKinds.has("floating-flat")).toBe(true);
    expect(roofKinds.has("mono-pitch")).toBe(true);
    expect(result.document.roofs.libraryRecipe).toMatchObject({ id: "seam-library", system: "standing-seam", status: "applied" });
    expect(result.document.roofs.system).toEqual({ primary: "standing-seam" });
    expect(result.diagnostics.find((d) => d.stage === "roof-composition")?.warnings).toContain("Applied Roof Recipe: Standing Seam Hillside (seam-library).");

    expect(validateArchitecturalDesignDocument(result.document)).toEqual([]);
    const compiled = compileArchitecture(result.document, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(compiled.errors).toEqual([]);
    expect(compiled.model.primitives.length).toBeGreaterThan(0);

    // The adapter's output must satisfy the same critic every deterministic design already does, without throwing.
    expect(() => scoreArchitecture(result.design, JSON.stringify({}), "A dramatic hillside residence")).not.toThrow();
    expect(result.design.masses).toHaveLength(2);

    // foundation(1) + mass-expansion(3: add, done, insisted done) + architectural-geometry(1) + roof-composition(1) = 6.
    expect(generateText).toHaveBeenCalledTimes(6);
    expect(result.unplacedVolumes.map((v) => v.id)).toEqual(["outdoor-pavilion", "service-spine"]);
    expect(result.unplacedVolumes[0].reason).toContain("The steep lot only leaves room for two volumes.");
    expect(result.diagnostics.map((d) => d.stage)).toEqual(["foundation", "mass-expansion", "architectural-geometry", "roof-composition"]);
    expect(result.diagnostics.every((d) => d.status === "ok")).toBe(true);
  });

  it("reproduces the exact live crash shape (Foundation -> primary mass -> mass-expansion accepts a view-facing bedroom-wing -> 2 masses -> Geometry -> Roof -> Compiler) and completes offline", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText
      // foundation: intent + site strategy + primary mass in one call
      .mockResolvedValueOnce({ output: {
        intent: { mood: ["calm"], spatialGoals: ["privacy", "views"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" },
        siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Keep it level and open toward the view." },
        primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, plan, reasoning: "Anchors the plan." },
      }, totalUsage: {} })
      // mass expansion turn 1: accepts "mass-1" (bedroom-wing) with a view-facing relationship — exactly the
      // live turn that crashed ("[mass-expansion] turn 1 accepted \"mass-1\" (bedroom-wing) — 2 mass(es)
      // accumulated so far", then "Cannot read properties of undefined (reading 'viewDirection')"). The space
      // plan still requires its outdoor pavilion and service spine, so the loop asks on; the model declines
      // twice with a reason, and the stage reports those volumes as unplaced instead of silently stopping.
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A bedroom wing that opens directly onto the view.", mass: { name: "Bedroom Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1, plan }, relationships: [{ kind: "view-facing", target: "mass-0" }, { kind: "adjacent-to", target: "mass-0", side: "west", distance: 2 }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes serve this brief." }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The brief asks only for a home and a bedroom wing." }, totalUsage: {} })
      // architectural geometry pass: one batched call for every mass
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
      // roof composition: one call for every mass
      .mockResolvedValueOnce({ output: { language: { dominantMassId: "mass-0", family: "flat", concept: "Quiet flat planes with one low shed." }, roofs: [
        { massId: "mass-0", kind: "flat", overhang: 0.6, pitch: 2, reasoning: "A quiet flat roof for the main pavilion." },
        { massId: "mass-1", kind: "shed", overhang: 0.5, pitch: 12, reasoning: "A quiet shed roof for the bedroom wing." },
      ] }, totalUsage: {} });

    const result = await runArchitecturePipeline({ brief: "A quiet family home with a bedroom wing facing the view", hints: { environment: "suburban", viewDirection: "south", approachSide: "north" } }, createTimings(), 60_000, usageMeta);

    expect(result.document.massing.masses).toHaveLength(2);
    expect(result.document.massing.masses[1].rotation).toBeCloseTo(0, 5);
    expect(result.massExpansionStopReason).toBe("model-done");
    expect(result.unplacedVolumes.map((v) => v.id)).toEqual(["outdoor-pavilion", "service-spine"]);
    expect(validateArchitecturalDesignDocument(result.document)).toEqual([]);
    const compiled = compileArchitecture(result.document, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(compiled.errors).toEqual([]);
    expect(compiled.model.primitives.length).toBeGreaterThan(0);
    expect(result.diagnostics.every((d) => d.status === "ok")).toBe(true);
    // foundation(1) + mass-expansion(3: add, done, insisted done) + geometry(1) + roof(1).
    expect(generateText).toHaveBeenCalledTimes(6);
  });

  it("fails the generation — never a deterministic flat-roof stand-in — when Roof Composition exhausts its retries, keeping upstream work for Replay", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText
      // foundation: ok
      .mockResolvedValueOnce({ output: {
        intent: { mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" },
        siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Keep it level." },
        primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, plan, reasoning: "Anchors the plan." },
      }, totalUsage: {} })
      // Mass expansion remains AI-completed: an added volume is followed by its explicit done decision.
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A creative studio extends the plan.", mass: { name: "Studio Wing", role: "connector", width: 6, depth: 6, floors: 1, plan }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
      // architectural geometry pass: ok
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [{ type: "glazing-zone", facade: "south", start: 0.2, end: 0.8, heightRatio: 0.6 }] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
      // roof composition: every attempt (including the repair retry) keeps failing validation
      .mockResolvedValue({ output: { roofs: [{ massId: "mass-0", kind: "flat" }] }, totalUsage: {} });

    const snapshots: { articulatedMasses?: unknown[]; roofs?: unknown[] }[] = [];
    const failure = await runArchitecturePipeline({ brief: "A quiet family home with an added creative studio", hints: {} }, createTimings(), 60_000, usageMeta, () => {}, (upstream) => snapshots.push(upstream)).catch((e: unknown) => e);

    expect(isV2GenerationFailure(failure)).toBe(true);
    if (!isV2GenerationFailure(failure)) return;
    expect(failure.stage).toBe("roof-composition");
    expect(failure.outcome).toBe("failed");
    expect(failure.conflicts.join(" ")).toMatch(/roof-incomplete mass-0|Missing a roof for mass "mass-1"/);
    // The earlier stages succeeded as authored (pins the mock queue: 1 foundation + 3 mass-expansion + 1 geometry, each on its first attempt).
    expect(failure.diagnostics.find((d) => d.stage === "mass-expansion")).toMatchObject({ status: "ok", retries: 0 });
    expect(failure.diagnostics.find((d) => d.stage === "architectural-geometry")).toMatchObject({ status: "ok", retries: 0 });
    expect(failure.diagnostics.find((d) => d.stage === "roof-composition")).toMatchObject({ status: "error", outcome: "failed" });
    // What was authored upstream is still available to Replay; no roof was ever invented for it.
    const last = snapshots[snapshots.length - 1];
    expect(last.articulatedMasses).toHaveLength(2);
    expect(last.roofs).toBeUndefined();
  });

  it("fails the generation — no default foundation or massing — when Foundation keeps failing", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText.mockRejectedValue(new Error("model unavailable"));
    const failure = await runArchitecturePipeline({ brief: "A simple family home", hints: {} }, createTimings(), 30_000, usageMeta).catch((e: unknown) => e);
    expect(isV2GenerationFailure(failure) && failure.stage).toBe("foundation");
    expect(isV2GenerationFailure(failure) && failure.conflicts.join(" ")).toContain("model unavailable");
    // Two Foundation attempts and nothing after them.
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  describe("replayArchitectureStage (dev-only)", () => {
    const input = { brief: "A quiet family retreat", hints: {} };

    it("replaying roof-composition alone reuses the cached foundation and masses without calling the model for them", async () => {
      const { runArchitecturePipeline, replayArchitectureStage } = await import("../pipeline");
      generateText
        .mockResolvedValueOnce({ output: {
          intent: { mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" },
          siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Keep it level." },
          primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, plan, reasoning: "Anchors the plan." },
        }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "flat", overhang: 0.6, pitch: 2, reasoning: "A quiet flat roof suits the brief." }] }, totalUsage: {} });
      const first = await runArchitecturePipeline(input, createTimings(), 60_000, usageMeta);
      expect(generateText).toHaveBeenCalledTimes(5);

      generateText.mockReset();
      generateText.mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "butterfly", overhang: 1.1, pitch: 8, reasoning: "Try an expressive butterfly roof instead." }] }, totalUsage: {} });
      const replayed = await replayArchitectureStage("roof-composition", input, first.upstream, createTimings(), 60_000, usageMeta);

      // Only the replayed stage made a model call — foundation and mass-expansion were reused as-is.
      expect(generateText).toHaveBeenCalledTimes(1);
      expect(replayed.document.roofs.recipes[0].kind).toBe("butterfly");
      expect(replayed.document.massing.masses).toEqual(first.document.massing.masses);
      expect(replayed.diagnostics.find((d) => d.stage === "foundation")?.modelCalls).toBe(0);
      expect(replayed.diagnostics.find((d) => d.stage === "mass-expansion")?.modelCalls).toBe(0);
      expect(replayed.diagnostics.find((d) => d.stage === "roof-composition")?.modelCalls).toBe(1);
    });

    it("replaying mass-expansion reuses the cached foundation but recomputes roofs, since they're keyed to the mass list", async () => {
      const { runArchitecturePipeline, replayArchitectureStage } = await import("../pipeline");
      generateText
        .mockResolvedValueOnce({ output: {
          intent: { mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" },
          siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Keep it level." },
          primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, plan, reasoning: "Anchors the plan." },
        }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "flat", overhang: 0.6, pitch: 2, reasoning: "A quiet flat roof suits the brief." }] }, totalUsage: {} });
      const first = await runArchitecturePipeline(input, createTimings(), 60_000, usageMeta);

      generateText.mockReset();
      generateText
        .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A guest wing extends the plan.", mass: { name: "Guest Wing", role: "guest-pavilion", width: 6, depth: 6, floors: 1, plan }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { language: { dominantMassId: "mass-0", family: "flat" }, roofs: [
          { massId: "mass-0", kind: "flat", overhang: 0.6, pitch: 2, reasoning: "Keep the main pavilion quiet." },
          { massId: "mass-1", kind: "shed", overhang: 0.5, pitch: 12, reasoning: "The new guest wing gets its own shed roof." },
        ] }, totalUsage: {} });
      const replayed = await replayArchitectureStage("mass-expansion", input, first.upstream, createTimings(), 60_000, usageMeta);

      expect(generateText).toHaveBeenCalledTimes(5); // 3 for mass-expansion (add, done, insisted done), 1 for the geometry-pass recompute, 1 for the roof recompute it forces
      expect(replayed.document.massing.masses).toHaveLength(2);
      expect(replayed.document.roofs.recipes).toHaveLength(2);
      expect(replayed.diagnostics.find((d) => d.stage === "foundation")?.modelCalls).toBe(0);
    });
  });
});
