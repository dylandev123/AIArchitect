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
      // foundation: intent + site strategy + primary mass in one call
      .mockResolvedValueOnce({ output: {
        intent: { mood: ["drama"], spatialGoals: ["views"], environmentalGoals: ["shelter"], hierarchyGoals: ["dominant living pavilion"], compositionBias: "asymmetrical", style: "contemporary hillside" },
        siteStrategy: { environment: "hillside", viewDirection: "south", arrivalDirection: "north", terrain: "stepped", terrainResponse: "Step the masses down toward the view." },
        primaryMass: { name: "Main Living Pavilion", width: 16, depth: 9, floors: 1, reasoning: "Anchors the composition on the view side." },
      }, totalUsage: {} })
      // mass expansion: one add, then done — pushed back once (the space plan still requires its outdoor
      // pavilion and service spine), and the model insists, so the stage stops and reports why.
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A private bedroom wing steps above and away from the living pavilion.", mass: { name: "Private Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1 }, relationships: [{ kind: "stepped-above", target: "mass-0", distance: 2.4 }, { kind: "offset-from", target: "mass-0", side: "west", distance: 1 }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The steep lot only leaves room for two volumes." }, totalUsage: {} })
      // architectural geometry pass: one batched call for every mass
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
      // roof composition: one call for every mass
      .mockResolvedValueOnce({ output: { libraryRecipeId: "seam-library", language: { dominantMassId: "mass-0", family: "floating-flat", concept: "A floating plane over the living pavilion; low sheds beneath it." }, roofs: [
        { massId: "mass-0", kind: "floating-flat", overhang: 1.4, reasoning: "The dominant volume gets an expressive floating plane toward the view." },
        { massId: "mass-1", kind: "mono-pitch", overhang: 0.5, reasoning: "The bedroom wing gets a quieter shed roof, distinct from the main pavilion." },
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
        primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, reasoning: "Anchors the plan." },
      }, totalUsage: {} })
      // mass expansion turn 1: accepts "mass-1" (bedroom-wing) with a view-facing relationship — exactly the
      // live turn that crashed ("[mass-expansion] turn 1 accepted \"mass-1\" (bedroom-wing) — 2 mass(es)
      // accumulated so far", then "Cannot read properties of undefined (reading 'viewDirection')"). The space
      // plan still requires its outdoor pavilion and service spine, so the loop asks on; the model declines
      // twice with a reason, and the stage reports those volumes as unplaced instead of silently stopping.
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A bedroom wing that opens directly onto the view.", mass: { name: "Bedroom Wing", role: "bedroom-wing", width: 9, depth: 7, floors: 1 }, relationships: [{ kind: "view-facing", target: "mass-0" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes serve this brief." }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "The brief asks only for a home and a bedroom wing." }, totalUsage: {} })
      // architectural geometry pass: one batched call for every mass
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
      // roof composition: one call for every mass
      .mockResolvedValueOnce({ output: { language: { dominantMassId: "mass-0", family: "flat", concept: "Quiet flat planes with one low shed." }, roofs: [
        { massId: "mass-0", kind: "flat", overhang: 0.6, reasoning: "A quiet flat roof for the main pavilion." },
        { massId: "mass-1", kind: "shed", overhang: 0.5, reasoning: "A quiet shed roof for the bedroom wing." },
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

  it("preserves already-successful Foundation/Mass Expansion/Geometry when the later, nonessential Roof Composition stage fails every retry", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText
      // foundation: ok
      .mockResolvedValueOnce({ output: {
        intent: { mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" },
        siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Keep it level." },
        primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, reasoning: "Anchors the plan." },
      }, totalUsage: {} })
      // mass expansion: one add, then done — ok. Brief/role deliberately avoid REQUIRED_ROLE_WORDS
      // (garage/guest/bedroom) so the deterministic stop never fires and both calls below are actually made.
      .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A creative studio extends the plan.", mass: { name: "Studio Wing", role: "connector", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
      // architectural geometry pass: ok
      .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [{ type: "glazing-zone", facade: "south", start: 0.2, end: 0.8, heightRatio: 0.6 }] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
      // roof composition: every attempt (including the repair retry) keeps failing validation
      .mockResolvedValue({ output: { roofs: [] }, totalUsage: {} });

    const result = await runArchitecturePipeline({ brief: "A quiet family home with an added creative studio", hints: {} }, createTimings(), 60_000, usageMeta);

    // Mass Expansion and the Architectural Geometry Pass both succeeded and are untouched by the roof failure.
    // (Also pins the mock queue alignment: 1 foundation + 3 mass-expansion (add, done, insisted done) + 1 geometry, each
    // consumed on its first attempt — if the geometry mock silently shifted queue slots, this would drop.)
    expect(result.diagnostics.find((d) => d.stage === "mass-expansion")?.status).toBe("ok");
    expect(result.diagnostics.find((d) => d.stage === "mass-expansion")?.retries).toBe(0);
    expect(result.diagnostics.find((d) => d.stage === "architectural-geometry")?.status).toBe("ok");
    expect(result.diagnostics.find((d) => d.stage === "architectural-geometry")?.retries).toBe(0);
    expect(result.diagnostics.find((d) => d.stage === "roof-composition")?.status).toBe("fallback");
    expect(result.document.massing.masses).toHaveLength(2);
    // The Geometry Pass's articulation survived the later roof failure — never reverted to a blank/plain shell.
    // The model's own south glazing is kept exactly as authored; the plan does not add framing or geometry.
    const geometryMass = result.document.massing.masses.find((m) => m.id === "mass-0");
    expect(geometryMass?.openings).toContainEqual({ type: "glazing-zone", facade: "south", start: 0.2, end: 0.8, heightRatio: 0.6 });
    // The connector stands directly against mass-0's east side: a shared wall, never glazed.
    expect(geometryMass?.openings?.some((o) => o.facade === "east")).toBe(false);
    // A safe deterministic roof default (never a hard failure) for every mass, still honoring each planned edge.
    expect(result.document.roofs.recipes).toHaveLength(2);
    expect(result.document.roofs.recipes.every((r) => r.kind === "flat")).toBe(true);
    expect(result.document.roofs.recipes.find((r) => r.massId === "mass-0")?.overhang).toBeGreaterThanOrEqual(1.2); // deep-eave

    expect(validateArchitecturalDesignDocument(result.document)).toEqual([]);
    const compiled = compileArchitecture(result.document, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(compiled.errors).toEqual([]);
  });

  it("falls back to deterministic defaults for a stage that keeps failing validation, without failing the whole generation", async () => {
    const { runArchitecturePipeline } = await import("../pipeline");
    generateText.mockRejectedValue(new Error("model unavailable"));
    const result = await runArchitecturePipeline({ brief: "A simple family home", hints: {} }, createTimings(), 30_000, usageMeta);
    expect(result.document.massing.masses.length).toBeGreaterThanOrEqual(1);
    expect(validateArchitecturalDesignDocument(result.document)).toEqual([]);
    expect(result.diagnostics.every((d) => d.status === "fallback")).toBe(true);
    expect(result.diagnostics.find((d) => d.stage === "foundation")?.error).toContain("model unavailable");
  });

  describe("replayArchitectureStage (dev-only)", () => {
    const input = { brief: "A quiet family retreat", hints: {} };

    it("replaying roof-composition alone reuses the cached foundation and masses without calling the model for them", async () => {
      const { runArchitecturePipeline, replayArchitectureStage } = await import("../pipeline");
      generateText
        .mockResolvedValueOnce({ output: {
          intent: { mood: ["calm"], spatialGoals: ["privacy"], environmentalGoals: ["daylight"], hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary" },
          siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Keep it level." },
          primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, reasoning: "Anchors the plan." },
        }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "flat", overhang: 0.6, reasoning: "A quiet flat roof suits the brief." }] }, totalUsage: {} });
      const first = await runArchitecturePipeline(input, createTimings(), 60_000, usageMeta);
      expect(generateText).toHaveBeenCalledTimes(5);

      generateText.mockReset();
      generateText.mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "butterfly", overhang: 1.1, reasoning: "Try an expressive butterfly roof instead." }] }, totalUsage: {} });
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
          primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1, reasoning: "Anchors the plan." },
        }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One pavilion serves this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "flat", overhang: 0.6, reasoning: "A quiet flat roof suits the brief." }] }, totalUsage: {} });
      const first = await runArchitecturePipeline(input, createTimings(), 60_000, usageMeta);

      generateText.mockReset();
      generateText
        .mockResolvedValueOnce({ output: { decision: "add", reasoning: "A guest wing extends the plan.", mass: { name: "Guest Wing", role: "guest-pavilion", width: 6, depth: 6, floors: 1 }, relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { decision: "done", reasoning: "Two volumes fully serve this brief." }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }, { massId: "mass-1", operations: [] }] }, totalUsage: {} })
        .mockResolvedValueOnce({ output: { language: { dominantMassId: "mass-0", family: "flat" }, roofs: [
          { massId: "mass-0", kind: "flat", overhang: 0.6, reasoning: "Keep the main pavilion quiet." },
          { massId: "mass-1", kind: "shed", overhang: 0.5, reasoning: "The new guest wing gets its own shed roof." },
        ] }, totalUsage: {} });
      const replayed = await replayArchitectureStage("mass-expansion", input, first.upstream, createTimings(), 60_000, usageMeta);

      expect(generateText).toHaveBeenCalledTimes(5); // 3 for mass-expansion (add, done, insisted done), 1 for the geometry-pass recompute, 1 for the roof recompute it forces
      expect(replayed.document.massing.masses).toHaveLength(2);
      expect(replayed.document.roofs.recipes).toHaveLength(2);
      expect(replayed.diagnostics.find((d) => d.stage === "foundation")?.modelCalls).toBe(0);
    });
  });
});
