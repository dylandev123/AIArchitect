import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGenerationSystemPrompt } from "@/lib/ai/generation";
import { buildGenerationRequest, generationAvailability } from "@/lib/assetGeneration/providers";
import type { AssetGenerationProvider } from "@/lib/assetGeneration/types";
import { changeRecipeApproval, noteRecipeOutcome, recipesForBrief, recordMissingAssetNeeds, saveRecipe, setNeedStatus } from "../service";
import { readLibrary } from "../store";
import { recipeInputSchema } from "../recipes";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "library-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const project = JSON.stringify({ exteriorOptions: { style: "modern-luxury" }, buildings: [{ kind: "gazebo", x: 12, z: 0, width: 4, depth: 4 }] });

describe("recording needs during generation", () => {
  it("creates one need and increments it for repeated semantic requests", async () => {
    await recordMissingAssetNeeds(project, "", "p1", []);
    // The brief's "pool pavilion" and the generated gazebo are the same object: one generation counts it once.
    await recordMissingAssetNeeds(project, "A contemporary pool pavilion", "p2", []);
    const { needs } = await readLibrary();
    expect(needs).toHaveLength(1);
    expect(needs[0]).toMatchObject({ category: "gazebo", requestedCount: 2, status: "needed" });
  });

  it("counts concurrent generations without losing increments", async () => {
    await Promise.all(Array.from({ length: 8 }, (_, i) => recordMissingAssetNeeds(project, "", `p${i}`, [])));
    expect((await readLibrary()).needs[0].requestedCount).toBe(8);
  });

  it("does not create a need when an approved asset already fits", async () => {
    const missing = await recordMissingAssetNeeds(project, "", "p1", [{ id: "a", family: "gazebo", styleTags: ["modern"], contextTags: [], dimensions: { width: 4, depth: 4 } }]);
    expect(missing).toEqual([]);
    expect((await readLibrary()).needs).toEqual([]);
  });

  it("falls back quietly when the store is unavailable", async () => {
    // A path whose parent is a regular file cannot be created, so every write fails.
    const blocker = path.join(dir, "file");
    await writeFile(blocker, "x");
    vi.stubEnv("AI_LIBRARY_PATH", path.join(blocker, "sub", "library.json"));
    await expect(recordMissingAssetNeeds(project, "", "p1", [])).resolves.toEqual([]);
    await expect(recipesForBrief("a modern villa")).resolves.toEqual([]);
  });
});

describe("recipes end to end", () => {
  const input = recipeInputSchema.parse({ name: "Caribbean Estate Hip 03", category: "roof", styleTags: ["tropical"], compatibleScales: ["estate", "mansion"], guidance: ["deep eaves"] });

  it("is not reusable until approved, then is retrieved by style, scale and environment", async () => {
    const saved = await saveRecipe(input);
    if (!saved.ok) throw new Error(saved.error);
    expect(saved.value).toMatchObject({ approval: "proposed", version: 1, usageCount: 0 });
    expect(await recipesForBrief("A Caribbean estate on the beach")).toEqual([]);

    await changeRecipeApproval(saved.value.id, "approved");
    const found = await recipesForBrief("A Caribbean estate villa on the beach");
    expect(found.map((r) => r.id)).toEqual([saved.value.id]);
    expect(await recipesForBrief("A small nordic cottage in the forest")).toEqual([]);
  });

  it("puts approved matches in the generation prompt, and leaves the prompt alone without any", async () => {
    const saved = await saveRecipe(input);
    if (!saved.ok) throw new Error(saved.error);
    await changeRecipeApproval(saved.value.id, "approved");
    const recipes = await recipesForBrief("Caribbean estate");
    expect(buildGenerationSystemPrompt([], recipes)).toContain("PROVEN DESIGN PATTERNS");
    expect(buildGenerationSystemPrompt([], [])).toBe(buildGenerationSystemPrompt([]));
    expect(buildGenerationSystemPrompt([])).not.toContain("PROVEN DESIGN PATTERNS");
  });

  it("tracks usage, success and failure", async () => {
    const saved = await saveRecipe(input);
    if (!saved.ok) throw new Error(saved.error);
    await noteRecipeOutcome([saved.value.id], "pending");
    await noteRecipeOutcome([saved.value.id], "success");
    await noteRecipeOutcome([saved.value.id], "pending");
    await noteRecipeOutcome([saved.value.id], "failure");
    expect((await readLibrary()).recipes[0]).toMatchObject({ usageCount: 2, successCount: 1, failureCount: 1 });
  });

  it("bumps the version on edit", async () => {
    const saved = await saveRecipe(input);
    if (!saved.ok) throw new Error(saved.error);
    const edited = await saveRecipe({ ...input, name: "Caribbean Estate Hip 04" }, saved.value.id);
    expect(edited.ok && edited.value.version).toBe(2);
  });
});

describe("need status", () => {
  it("lets an admin ignore and restore, and rejects impossible moves", async () => {
    await recordMissingAssetNeeds(project, "", "p1", []);
    const [need] = (await readLibrary()).needs;
    expect((await setNeedStatus(need.id, "ignored")).ok).toBe(true);
    expect((await setNeedStatus(need.id, "approved")).ok).toBe(false);
    expect((await setNeedStatus(need.id, "needed")).ok).toBe(true);
    expect((await setNeedStatus("missing", "ignored")).ok).toBe(false);
  });
});

describe("asset generation providers", () => {
  it("reports generation as unavailable, without faking it, when nothing is configured", () => {
    const status = generationAvailability();
    expect(status.available).toBe(false);
    expect(status).toHaveProperty("message");
  });

  it("becomes available once a provider is configured", () => {
    const provider: AssetGenerationProvider = { id: "x", label: "X", isConfigured: () => true, configurationHint: "", submit: async () => ({ providerId: "x", jobId: "1" }), poll: async () => ({ state: "queued" }) };
    expect(generationAvailability([provider])).toEqual({ available: true, providers: [{ id: "x", label: "X" }] });
    expect(generationAvailability([{ ...provider, isConfigured: () => false, configurationHint: "Set X_API_KEY." }])).toMatchObject({ available: false, message: "X: Set X_API_KEY." });
  });

  it("builds a provider-neutral request from a need", async () => {
    await recordMissingAssetNeeds(project, "", "p1", []);
    const [need] = (await readLibrary()).needs;
    expect(buildGenerationRequest(need)).toMatchObject({ needId: need.id, category: "gazebo", style: ["modern"], quality: "standard", webReady: true, polygonBudget: 40_000, dimensions: { width: 4, depth: 4 } });
  });
});
