import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordKnowledgeSignal } from "../knowledge/knowledge";
import { proposeRecipe, validateProposal, buildProposalPrompt, proposalContext } from "../proposal";
import { recipeInputSchema } from "../recipes";
import { saveRecipe } from "../service";
import { mutateLibrary, readLibrary } from "../store";
import type { KnowledgeSignal } from "@/types/library";

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "proposal-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const signal = (knowledgeId: string, title: string, over: Partial<KnowledgeSignal> = {}): KnowledgeSignal => ({
  knowledgeId, title, areas: ["outdoor-living"], weakness: 0.6, styles: ["luxury", "tropical"], scale: "estate", environment: "beach",
  projectId: "p1", brief: "A beach estate", details: [{ area: "outdoor-living", score: 0.4, reason: "thin" }], ...over,
});

const seed = (...signals: KnowledgeSignal[]) =>
  mutateLibrary((s) => ({ put: signals.map((sig) => ({ kind: "knowledge" as const, data: recordKnowledgeSignal(s.knowledge.find((k) => k.id === sig.knowledgeId), sig) })), result: undefined }));

const dining = {
  name: "Luxury Outdoor Dining Terrace 01",
  category: "outdoor-living",
  styleTags: ["Luxury", "tropical", "resort"],
  compatibleScales: ["luxury", "estate"],
  environmentTags: ["beach", "cliff"],
  parameters: [
    { key: "seats", value: 8, min: 6, max: 12, unit: "count" },
    { key: "tableLength", value: 4.2, min: 3.5, max: 5.5, unit: "m" },
    { key: "distanceFromPool", value: 4, min: 2, max: 8, unit: "m" },
    { key: "shade", value: "pergola" },
  ],
  relationships: [{ kind: "requires", target: "patio" }, { kind: "prefers", target: "pool", note: "within 8 m" }, { kind: "conflicts", target: "driveway" }],
  guidance: ["Place between the house and pool when possible.", "Keep views open."],
};

const lighting = {
  name: "Warm Path And Facade Lighting 01",
  category: "entry-sequence",
  styleTags: ["luxury", "modern"],
  compatibleScales: ["estate"],
  environmentTags: ["beach"],
  parameters: [
    { key: "colorTemperature", value: 2700, min: 2400, max: 3000, unit: "K" },
    { key: "poleSpacing", value: 4, min: 3, max: 6, unit: "m" },
    { key: "uplightHeight", value: 0.6, min: 0.3, max: 1, unit: "m" },
  ],
  relationships: [{ kind: "prefers", target: "pathway", note: "along both edges" }, { kind: "conflicts", target: "floodlight" }],
  guidance: ["Wash facade columns with warm uplights.", "Keep glare away from bedroom windows."],
};

describe("recipe proposals", () => {
  it("builds a complete Outdoor Dining recipe, carries context, links the Knowledge Need and stays proposed", async () => {
    await seed(signal("outdoor-dining", "Outdoor Dining"));
    const generate = vi.fn().mockResolvedValue(dining);
    const res = await proposeRecipe("outdoor-dining", generate);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(generate.mock.calls[0][0].prompt).toContain("Knowledge Need: Outdoor Dining");
    expect(generate.mock.calls[0][0].prompt).toContain("luxury, tropical");
    expect(res.recipe).toMatchObject({ name: "Luxury Outdoor Dining Terrace 01", category: "outdoor-living", knowledgeIds: ["outdoor-dining"], origin: { kind: "learn" } });
    expect(res.recipe.styleTags).toContain("luxury");
    expect(res.recipe.parameters.find((p) => p.key === "seats")).toMatchObject({ value: 8, min: 6, max: 12 });
    expect(recipeInputSchema.safeParse(res.recipe).success).toBe(true);

    // Nothing is saved by proposing.
    expect((await readLibrary()).recipes).toEqual([]);

    const saved = await saveRecipe(res.recipe);
    expect(saved.ok && saved.value.approval).toBe("proposed");
    const lib = await readLibrary();
    expect(lib.recipes).toHaveLength(1);
    expect(lib.knowledge[0].recipeIds).toEqual([saved.ok ? saved.value.id : ""]);
  });

  it("gives Exterior Lighting a different, appropriate recipe with its own context", async () => {
    await seed(signal("outdoor-dining", "Outdoor Dining"), signal("exterior-lighting", "Exterior Lighting", { areas: ["lighting"], styles: ["modern"], scale: "mansion" }));
    const a = await proposeRecipe("outdoor-dining", async () => dining);
    const gen = vi.fn().mockResolvedValue(lighting);
    const b = await proposeRecipe("exterior-lighting", gen);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(gen.mock.calls[0][0].prompt).toContain("Exterior Lighting");
    expect(gen.mock.calls[0][0].prompt).not.toContain("Recipe categories: outdoor-living");
    expect(b.recipe.name).not.toBe(a.recipe.name);
    expect(b.recipe.knowledgeIds).toEqual(["exterior-lighting"]);
    // The need recorded scale "mansion", which the model missed: it is carried through.
    expect(b.recipe.compatibleScales).toEqual(["mansion"]);
    expect(b.adjustments.join(" ")).toMatch(/scales/i);
  });

  it("forces the catalog's recipe category and de-duplicates names against the library", async () => {
    await seed(signal("outdoor-dining", "Outdoor Dining"));
    const first = await proposeRecipe("outdoor-dining", async () => ({ ...dining, category: "roof" }));
    expect(first.ok && first.recipe.category).toBe("outdoor-living");
    if (first.ok) await saveRecipe(first.recipe);
    const second = await proposeRecipe("outdoor-dining", async () => dining);
    expect(second.ok && second.recipe.name).toBe("Luxury Outdoor Dining Terrace 02");
  });

  it("never overwrites: saving a second proposal creates a new recipe", async () => {
    await seed(signal("outdoor-dining", "Outdoor Dining"));
    const r = await proposeRecipe("outdoor-dining", async () => dining);
    if (!r.ok) throw new Error("expected ok");
    const a = await saveRecipe(r.recipe);
    const b = await saveRecipe(r.recipe);
    expect(a.ok && b.ok && a.value.id !== b.value.id).toBe(true);
    expect((await readLibrary()).recipes).toHaveLength(2);
  });

  it("supports a Knowledge Need that only exists in the catalog", async () => {
    const res = await proposeRecipe("outdoor-dining", async () => dining);
    expect(res.ok).toBe(true);
    expect(await proposeRecipe("no-such-need", async () => dining)).toMatchObject({ ok: false, status: 404 });
  });

  it.each([
    ["not an object", "hello"],
    ["unknown category", { ...dining, category: "spaceship" }],
    ["unknown scale", { ...dining, compatibleScales: ["galactic"] }],
    ["value outside its range", { ...dining, parameters: [{ key: "seats", value: 99, min: 6, max: 12 }, ...dining.parameters.slice(1)] }],
    ["too few parameters", { ...dining, parameters: dining.parameters.slice(0, 2) }],
    ["no ranged numeric parameter", { ...dining, parameters: [{ key: "a", value: "x" }, { key: "b", value: "y" }, { key: "c", value: true }] }],
    ["duplicate keys", { ...dining, parameters: [...dining.parameters, { key: "SEATS", value: 1, min: 0, max: 2 }] }],
    ["no relationships", { ...dining, relationships: [] }],
    ["require + conflict on one target", { ...dining, relationships: [{ kind: "requires", target: "patio" }, { kind: "conflicts", target: "Patio" }] }],
    ["no guidance", { ...dining, guidance: [] }],
    ["no styles", { ...dining, styleTags: [] }],
  ])("rejects invalid AI output safely: %s", async (_label, bad) => {
    await seed(signal("outdoor-dining", "Outdoor Dining"));
    const res = await proposeRecipe("outdoor-dining", async () => bad);
    expect(res).toMatchObject({ ok: false, status: 502 });
    expect((await readLibrary()).recipes).toEqual([]);
  });

  it("does not swallow provider failures (the caller falls back to the blank form)", async () => {
    await expect(proposeRecipe("outdoor-dining", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
  });

  it("puts avoided draft names in the prompt", () => {
    const ctx = proposalContext(undefined, { id: "x", title: "X", areas: [], families: [], recipeCategories: [], targets: { assets: 0, recipes: 0, materials: 0, lighting: 0, plants: 0 } }, []);
    expect(buildProposalPrompt(ctx!, ["Old Draft 01"])).toContain("Old Draft 01");
    expect(validateProposal(dining, ctx!).ok).toBe(true);
  });
});
