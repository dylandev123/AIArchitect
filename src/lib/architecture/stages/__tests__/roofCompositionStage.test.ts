import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalIntent } from "../../designEngine";
import type { ArchitecturalDesignDocument, MassVolume, RoofRecipe } from "../../document";
import { compileArchitecture } from "../../compiler";
import { runRoofCompositionStage } from "../roofStage";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const intent: ArchitecturalIntent = {
  mood: ["calm"], spatialGoals: ["views"], environmentalGoals: ["daylight"], hierarchyGoals: ["living dominates"],
  compositionBias: "asymmetrical", source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "contemporary" },
};
const siteStrategy = { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" } as const;
const mass = (id: string, role: MassVolume["role"], x: number, width: number, depth: number): MassVolume =>
  ({ id, name: id, role, position: { x, z: 0 }, width, depth, floors: 1, elevation: 0, rotation: 0 });
const masses = [mass("mass-0", "main-living", 0, 16, 9), mass("mass-1", "bedroom-wing", 14, 10, 7), mass("mass-2", "connector", 7, 3, 3)];
const ctx = { intent, siteStrategy, masses };

const incoherent = { roofs: [
  { massId: "mass-0", kind: "gable", overhang: 0.6, pitch: 22 },
  { massId: "mass-1", kind: "hip", overhang: 0.6, pitch: 30 },
  { massId: "mass-2", kind: "floating-flat", overhang: 0.3, pitch: 2, expression: { verticalGap: 0.2 } },
] };
const coherent = {
  language: { dominantMassId: "mass-0", family: "floating-flat", concept: "One floating plane over the living pavilion; the wing and link sit under matching quiet planes." },
  roofs: [
    { massId: "mass-0", kind: "floating-flat", overhang: 0.6, pitch: 2, expression: { verticalGap: 0.3, thickness: 0.2 } },
    { massId: "mass-1", kind: "floating-flat", overhang: 0.5, pitch: 2, expression: { verticalGap: 0.3, thickness: 0.2 } },
    { massId: "mass-2", kind: "flat", overhang: 0.2, pitch: 1, orientation: 2 * Math.PI, parapet: { height: 0.4, thickness: 0.15 } },
  ],
};

const compile = (roofs: readonly RoofRecipe[]) => {
  const pending = { status: "pending" as const };
  const doc: ArchitecturalDesignDocument = {
    version: 1, brief: "t", siteStrategy, massing: { composition: "pavilion-cluster", masses }, roofs: { recipes: roofs },
    facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
  };
  return compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
};

beforeEach(() => {
  generateText.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

describe("roof composition stage — whole-house roof language", () => {
  it("asks for the dominant family first and the coordination rules, from the same matrix the referee uses", async () => {
    generateText.mockResolvedValueOnce({ output: coherent, totalUsage: {} });
    await runRoofCompositionStage(ctx, createTimings(), 60_000, usageMeta);
    const { system, messages } = generateText.mock.calls[0][0] as { system: string; messages: { content: string }[] };
    expect(system).toMatch(/Choose the dominant roof family and expression for the dominant volume first/);
    expect(system).toContain("- gable → gable, cross-gable, shed, mono-pitch, flat");
    expect(system).toContain("- floating-flat → floating-flat, flat, shed, mono-pitch");
    expect(system).toMatch(/counterpoint/);
    // The model sees each volume's wall-plate datum so it can share eave lines.
    expect(messages[0].content).toContain("mass-1 \"mass-1\", role bedroom-wing, 10.0x7.0m at (14.0, 0.0), 1 floor(s), wall plate at");
  });

  it("feeds unrelated competing roof forms back as a repair, then keeps the coherent authored recipes exactly", async () => {
    generateText.mockResolvedValueOnce({ output: incoherent, totalUsage: {} }).mockResolvedValueOnce({ output: coherent, totalUsage: {} });
    const result = await runRoofCompositionStage(ctx, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(2);
    const repair = (generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content;
    expect(repair).toMatch(/Declare the whole-house roof language/);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toBeUndefined();
    expect(result.language).toMatchObject({ dominantMassId: "mass-0", family: "floating-flat" });
    // AI authority: complete recipes are preserved verbatim — no deterministic re-derivation of overhang/pitch.
    expect(result.value).toEqual([
      { id: "mass-0-roof", massId: "mass-0", kind: "floating-flat", overhang: 0.6, pitch: 2, expression: { verticalGap: 0.3, thickness: 0.2 } },
      { id: "mass-1-roof", massId: "mass-1", kind: "floating-flat", overhang: 0.5, pitch: 2, expression: { verticalGap: 0.3, thickness: 0.2 } },
      { id: "mass-2-roof", massId: "mass-2", kind: "flat", overhang: 0.2, pitch: 1, orientation: 0, parapet: { height: 0.4, thickness: 0.15 } },
    ]);
    expect(compile(result.value).errors).toEqual([]);
  });

  it("names each incoherent roof in the repair once a language is declared", async () => {
    generateText
      .mockResolvedValueOnce({ output: { ...incoherent, language: { dominantMassId: "mass-0", family: "gable" } }, totalUsage: {} })
      .mockResolvedValueOnce({ output: coherent, totalUsage: {} });
    await runRoofCompositionStage(ctx, createTimings(), 60_000, usageMeta);
    const repair = (generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content;
    expect(repair).toContain(`"mass-1" hip roof competes with the gable language`);
    expect(repair).toContain(`"mass-2" floating-flat roof competes with the gable language`);
  });

  it("never reverts to deterministic flat roofs when only the language stays unrepaired: authored roofs stand, issues become warnings", async () => {
    generateText.mockResolvedValue({ output: incoherent, totalUsage: {} });
    const result = await runRoofCompositionStage(ctx, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((r) => r.kind)).toEqual(["gable", "hip", "floating-flat"]);
    expect(result.value[1]).toEqual({ id: "mass-1-roof", massId: "mass-1", kind: "hip", overhang: 0.6, pitch: 30 });
    expect(result.warnings?.[0]).toMatch(/Declare the whole-house roof language/);
  });

  it("fails — and no fallback roof is built — when the response can't build every mass", async () => {
    generateText.mockResolvedValue({ output: { ...coherent, roofs: coherent.roofs.slice(0, 2) }, totalUsage: {} });
    const result = await runRoofCompositionStage(ctx, createTimings(), 60_000, usageMeta);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(`Missing a roof for mass "mass-2".`);
  });

  it("needs no declared language for a single-volume house", async () => {
    generateText.mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "hip", overhang: 0.9, pitch: 24 }] }, totalUsage: {} });
    const result = await runRoofCompositionStage({ ...ctx, masses: masses.slice(0, 1) }, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.ok && result.value[0]).toEqual({ id: "mass-0-roof", massId: "mass-0", kind: "hip", overhang: 0.9, pitch: 24 });
  });

  it("sends an incomplete recipe back for repair and fails rather than filling it with a flat default", async () => {
    const incomplete = { ...coherent, roofs: coherent.roofs.map((r) => (r.massId === "mass-2" ? { massId: "mass-2", kind: "flat" } : r)) };
    generateText.mockResolvedValue({ output: incomplete, totalUsage: {} });
    const result = await runRoofCompositionStage(ctx, createTimings(), 60_000, usageMeta);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect((generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content).toMatch(/repair-required:roof-incomplete mass-2\]/);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("value");
  });

  it("asks for a repair when clearance would have to cut an eave into a different roof, and keeps the repaired roofs exactly", async () => {
    const deep = { ...coherent, roofs: coherent.roofs.map((r) => (r.massId === "mass-0" ? { ...r, overhang: 1.4 } : r)) };
    generateText.mockResolvedValueOnce({ output: deep, totalUsage: {} }).mockResolvedValueOnce({ output: coherent, totalUsage: {} });
    const result = await runRoofCompositionStage(ctx, createTimings(), 60_000, usageMeta);
    const repair = (generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content;
    expect(repair).toMatch(/repair-required:roof-clearance mass-0\].*1\.40m overhang.*at most 0\.60m/);
    expect(result.ok && result.value.find((r) => r.massId === "mass-0")?.overhang).toBe(0.6);
    // The kept trim (0.6 → 0.3 against the abutting link) preserves the roof, so it compiles as a normalization.
    const clearance = compile(result.ok ? result.value : []).diagnostics!.roofClearance.find((c) => c.massId === "mass-0")!;
    expect(clearance).toMatchObject({ authored: 0.6, cleared: 0.3, preservesLanguage: true });
  });

  it("never lets a cited library recipe overwrite the authored kind, pitch or overhang — it only selects the roof system", async () => {
    const approvedRecipes = [{
      id: "seam-hip", name: "Seam Hip", category: "roof", styleTags: [], compatibleScales: [], environmentTags: [],
      parameters: [{ key: "system", value: "standing-seam" }, { key: "kind", value: "floating-flat" }, { key: "pitch", value: 9 }, { key: "overhang", value: 2.5 }],
      relationships: [], guidance: [], usageCount: 0, successCount: 0, failureCount: 0, approval: "approved", version: 1, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    }] as never;
    generateText.mockResolvedValueOnce({ output: { ...coherent, libraryRecipeId: "seam-hip" }, totalUsage: {} });
    const result = await runRoofCompositionStage({ ...ctx, approvedRecipes }, createTimings(), 60_000, usageMeta);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.libraryRecipe?.id).toBe("seam-hip");
    expect(result.value.map((r) => [r.kind, r.pitch, r.overhang])).toEqual(coherent.roofs.map((r) => [r.kind, r.pitch, r.overhang]));
    const prompt = (generateText.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    expect(prompt).toMatch(/author its kind, pitch and overhang yourself/);
  });
});
