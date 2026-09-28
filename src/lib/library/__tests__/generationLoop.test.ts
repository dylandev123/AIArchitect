import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { plannedAssetSchema } from "../plans";
import { planOutdoorSpaces } from "@/lib/outdoor/spaces";
import { knowledgeProgress } from "../knowledge/knowledge";
import { completePlannedAsset, recipesForSpaces, saveRecipe } from "../service";
import { readLibrary } from "../store";
import { recipeInputSchema } from "../recipes";
import { runPostGeneration, type LoopInput } from "../generationLoop";
import type { AssetIndexEntry } from "../retrieval";
import type { CuratedAsset } from "@/types/assets";
import { assembleVilla, VILLA_BRIEF } from "./villaFixture";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "loop-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const { json } = assembleVilla();

const input = (over: Partial<LoopInput> = {}): LoopInput => ({ json, brief: VILLA_BRIEF, projectId: "p1", library: [], retrieved: [], attached: [], ...over });

/** An approved, validated library object, as the client sends it with a generation request. */
const asset = (id: string, name: string, family: AssetIndexEntry["family"], tags: string[] = []): AssetIndexEntry => ({ id, name, family, tags, styleTags: ["tropical"], contextTags: [], dimensions: undefined });

describe("one successful generation, end to end", () => {
  it("detects the outdoor spaces, scores knowledge, records needs, plans them and persists all of it", async () => {
    const report = await runPostGeneration(input());

    // Nothing failed silently.
    expect(report.steps.filter((s) => !s.ok)).toEqual([]);
    expect(report.persistence.ok).toBe(true);
    expect(report.persistence.backend).toBe("local-json");

    // Distinct outdoor spaces, each with the reason it is there.
    const names = report.spaces.filter((s) => s.realized || s.requested).map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Arrival / Motor Court", "Main Outdoor Living", "Outdoor Dining", "Outdoor Kitchen", "Pool Lounge", "Fire Pit Lounge", "Garden / Landscape"]));
    expect(new Set(names).size).toBe(names.length);
    expect(report.areas).toHaveLength(15);

    // Knowledge gaps: the spaces' own homes, not just generic parents.
    const gapIds = report.knowledgeGaps.map((g) => g.id);
    expect(gapIds).toEqual(expect.arrayContaining(["outdoor-dining", "outdoor-kitchen", "fire-pit-lounge", "modern-pool-area", "luxury-outdoor-living", "estate-arrival-court"]));
    expect(report.knowledgeGaps.every((g) => g.reason.length > 0 && g.isNew)).toBe(true);

    // Asset needs, each with its parent outdoor space and the missing components.
    expect(report.assetNeeds.length).toBeGreaterThan(3);
    const furniture = report.assetNeeds.find((n) => n.name.endsWith("Furniture"))!;
    expect(furniture.spaces).toEqual(expect.arrayContaining(["Outdoor Dining", "Pool Lounge"]));
    expect(furniture.components).toEqual(expect.arrayContaining(["Outdoor Dining Table", "Outdoor Dining Chair", "Pool Sun Lounger"]));

    // Actionable in Admin: every need with components got a starter plan of natively buildable objects.
    expect(report.plansCreated.length).toBeGreaterThan(0);
    const lib = await readLibrary();
    expect(lib.plans).toHaveLength(report.plansCreated.length);
    for (const plan of lib.plans) {
      expect(plan.status).toBe("draft");
      expect(plan.needId).toBeDefined();
      expect(lib.needs.some((n) => n.id === plan.needId)).toBe(true);
      for (const a of plan.assets) {
        expect(plannedAssetSchema.safeParse(a).success).toBe(true);
        expect(a.approved).toBe(false);
        expect(a.tags.some((t) => t.startsWith("space:"))).toBe(true);
      }
    }
    expect(lib.plans.flatMap((p) => p.assets).find((a) => a.name === "Outdoor Dining Table")?.priority).toBe("required");

    // What the report says was stored is what is in the store.
    expect(lib.knowledge.map((k) => k.id).sort()).toEqual(gapIds.slice().sort());
    expect(lib.needs).toHaveLength(report.assetNeeds.length);
    expect(report.persistence.wrote).toMatchObject({ knowledge: lib.knowledge.length, needs: lib.needs.length, plans: lib.plans.length });
    expect(lib.generations.map((g) => g.id)).toEqual([report.id]);
    expect(lib.knowledge.find((k) => k.id === "outdoor-dining")!.projectExamples[0].areas.find((a) => a.space)).toMatchObject({ space: "outdoor-dining" });
  });

  it("keeps the placement it read: garage on the arrival side, pool private", async () => {
    const report = await runPostGeneration(input());
    expect(report.placement).toMatchObject({ arrivalSide: "north", viewSide: "south", issues: [] });
    expect(report.placement.pools.every((p) => p.side !== "arrival")).toBe(true);
    expect(report.placement.garages.every((g) => g.side === "arrival")).toBe(true);
  });

  it("counts demand again on the next generation without creating a second plan", async () => {
    const first = await runPostGeneration(input());
    const second = await runPostGeneration(input({ projectId: "p2" }));
    expect(second.plansCreated).toEqual([]);
    expect(second.plansExisting.length).toBe(first.plansCreated.length);
    expect(second.assetNeeds.every((n) => !n.isNew)).toBe(true);
    expect(second.knowledgeGaps.every((g) => !g.isNew && g.requestCount === 2)).toBe(true);
    const lib = await readLibrary();
    expect(lib.plans).toHaveLength(first.plansCreated.length);
    expect(lib.needs.every((n) => n.requestedCount === 2)).toBe(true);
    expect(lib.generations).toHaveLength(2);
  });

  it("is not silenced by a library that holds a token asset per family", async () => {
    // The regression: one approved chair and one lantern used to make furniture and lighting "well served", and the loop went quiet.
    const library = [asset("c1", "Tropical Deck Chair", "furniture", ["chaise"]), asset("l1", "Garden Lantern", "light", ["lantern"]), asset("p1", "Palm Planter", "decorative", ["planter"])];
    const report = await runPostGeneration(input({ library }));
    expect(report.knowledgeGaps.map((g) => g.id)).toEqual(expect.arrayContaining(["outdoor-dining", "modern-pool-area", "luxury-outdoor-living"]));
    const furniture = report.assetNeeds.find((n) => n.name.endsWith("Furniture"))!;
    // The chair supplies the lounger only: the dining table, chairs and side tables are still missing.
    expect(furniture.components).toEqual(expect.arrayContaining(["Outdoor Dining Table", "Outdoor Dining Chair"]));
    expect(furniture.components).toContain("Pool Sun Lounger");
    expect(report.assets.map((a) => a.name)).toEqual(expect.arrayContaining(["Tropical Deck Chair", "Garden Lantern"]));
  });

  it("reports a failed write as such, and still returns the analysis", async () => {
    const blocker = path.join(dir, "file");
    await writeFile(blocker, "x");
    vi.stubEnv("AI_LIBRARY_PATH", path.join(blocker, "sub", "library.json"));
    const report = await runPostGeneration(input());
    expect(report.persistence.ok).toBe(false);
    expect(report.persistence.error).toBeTruthy();
    expect(report.persistence.wrote).toEqual({ knowledge: 0, needs: 0, plans: 0, recipes: 0 });
    // The admin still sees what was found.
    expect(report.spaces.length).toBeGreaterThan(5);
    expect(report.knowledgeGaps.length).toBeGreaterThan(0);
  });
});

describe("reuse on the next generation", () => {
  const dining = recipeInputSchema.parse({
    name: "Caribbean Dining Pavilion 01",
    category: "outdoor-living",
    styleTags: ["tropical", "modern"],
    compatibleScales: ["luxury", "estate", "mansion"],
    parameters: [{ key: "tableLength", value: 4, min: 3, max: 6, unit: "m" }],
    relationships: [{ kind: "requires", target: "patio" }, { kind: "prefers", target: "pool", note: "within 8 m" }],
    guidance: ["Keep the table under shade, away from the drive."],
    knowledgeIds: ["outdoor-dining"],
  });
  const poolRecipe = recipeInputSchema.parse({ name: "Tropical Pool Garden 01", category: "pool", styleTags: ["tropical"], compatibleScales: ["luxury"], relationships: [{ kind: "requires", target: "pool" }], guidance: ["Loungers on the sun side."] });
  const roofRecipe = recipeInputSchema.parse({ name: "Modern Flat Roof 01", category: "roof", styleTags: ["modern"], compatibleScales: ["luxury"], guidance: ["Thin fascia."] });
  const unmet = recipeInputSchema.parse({ name: "Estate Fire Circle 01", category: "outdoor-living", styleTags: ["tropical"], compatibleScales: ["luxury"], relationships: [{ kind: "requires", target: "pool-bar" }], guidance: ["Ring of seats."], knowledgeIds: ["fire-pit-lounge"] });

  async function approve(input: Parameters<typeof saveRecipe>[0]) {
    const saved = await saveRecipe(input, undefined, { approve: true });
    if (!saved.ok) throw new Error(saved.error);
    return saved.value;
  }

  it("retrieves the approved recipes per space, with reasons, and never a proposed one", async () => {
    const d = await approve(dining);
    await approve(poolRecipe);
    await approve(roofRecipe);
    const proposed = await saveRecipe({ ...dining, name: "Unreviewed Dining 02" });
    if (!proposed.ok) throw new Error(proposed.error);

    const spaces = planOutdoorSpaces({ brief: VILLA_BRIEF });
    const retrieved = await recipesForSpaces(VILLA_BRIEF, spaces);
    const byName = Object.fromEntries(retrieved.map((r) => [r.recipe.name, r]));
    expect(Object.keys(byName)).toEqual(expect.arrayContaining(["Caribbean Dining Pavilion 01", "Tropical Pool Garden 01", "Modern Flat Roof 01"]));
    expect(byName["Unreviewed Dining 02"]).toBeUndefined();
    expect(byName["Caribbean Dining Pavilion 01"].reason).toMatch(/Outdoor Dining: filed under Outdoor Dining/);
    expect(byName["Caribbean Dining Pavilion 01"].spaces).toContain("outdoor-dining");
    expect(byName["Tropical Pool Garden 01"].spaces).toEqual(["pool-lounge"]);
    // A recipe for what no space covers still rides along, marked as a brief-level pick.
    expect(byName["Modern Flat Roof 01"].spaces).toEqual([]);
    expect(byName["Modern Flat Roof 01"].reason).toMatch(/^brief:/);
    expect(d.approval).toBe("approved");
  });

  it("reports each retrieved recipe as applied or not, and counts its success", async () => {
    await approve(dining);
    await approve(poolRecipe);
    await approve(unmet);
    const spaces = planOutdoorSpaces({ brief: VILLA_BRIEF });
    const retrieved = await recipesForSpaces(VILLA_BRIEF, spaces);
    const report = await runPostGeneration(input({ retrieved }));
    const by = Object.fromEntries(report.recipes.map((r) => [r.name, r]));

    expect(by["Caribbean Dining Pavilion 01"]).toMatchObject({ applied: true, spaces: ["Outdoor Dining"] });
    expect(by["Caribbean Dining Pavilion 01"].note).toMatch(/Outdoor Dining \(.*\); its required parts are present/);
    expect(by["Tropical Pool Garden 01"].applied).toBe(true);
    // Its space is in the design, but it requires a pool bar the design does not have.
    expect(by["Estate Fire Circle 01"].applied).toBe(false);
    expect(by["Estate Fire Circle 01"].note).toMatch(/requires pool-bar/);

    const lib = await readLibrary();
    expect(lib.recipes.filter((r) => retrieved.some((x) => x.recipe.id === r.id)).every((r) => r.successCount === 1)).toBe(true);
    // The spaces carry their recipe references.
    expect(report.persistence.wrote.recipes).toBe(retrieved.length);
  });

  it("keeps Needs open for retrieved assets without placement dimensions", async () => {
    const library = [
      asset("t1", "Tropical Teak Dining Table", "furniture", ["dining", "table"]),
      asset("c1", "Tropical Dining Chair", "furniture", ["dining", "chair"]),
      asset("g1", "Teak Pergola", "pergola", ["pergola"]),
      asset("s1", "Teak Sun Lounger", "furniture", ["lounger"]),
    ];
    const before = await runPostGeneration(input());
    const withLibrary = await runPostGeneration(input({ library, projectId: "p2" }));

    const names = withLibrary.assets.map((a) => a.name);
    expect(names).toEqual(expect.arrayContaining(["Tropical Teak Dining Table", "Tropical Dining Chair", "Teak Pergola", "Teak Sun Lounger"]));
    const table = withLibrary.assets.find((a) => a.name === "Tropical Teak Dining Table")!;
    expect(table).toMatchObject({ space: "Outdoor Dining", component: "dining-table", applied: false });
    expect(table.note).toMatch(/no safe supported placement/);

    const dinSpace = withLibrary.spaces.find((s) => s.name === "Outdoor Dining")!;
    expect(dinSpace.supplied).toEqual([]);
    expect(dinSpace.missing).toContain("dining-table");
    // A retrieved candidate without usable dimensions cannot clear a Need.
    const furniture = withLibrary.assetNeeds.find((n) => n.name.endsWith("Furniture"))!;
    expect(furniture.components).toContain("Outdoor Dining Table");
    expect(before.assetNeeds.some((n) => n.name.endsWith("Pergola"))).toBe(true);
    expect(withLibrary.assetNeeds.some((n) => n.name.endsWith("Pergola"))).toBe(true);
  });

  it("applies a library asset to the feature it stands in for, and says so", async () => {
    // A gazebo in the design and an approved gazebo in the library: this is the one kind of asset the design draws today.
    const withGazebo = assembleVilla({ ops: [{ op: "addBuilding", value: { kind: "gazebo", x: 14, z: 16, width: 5, depth: 5, floors: 1, roof: "hip" } }] });
    const { attachLibraryAssets } = await import("../attach");
    const library = [{ ...asset("gz1", "Tropical Gazebo", "gazebo"), dimensions: { width: 5, depth: 5 } }];
    const attached = attachLibraryAssets(withGazebo.json, library);
    expect(attached.attached.length).toBeGreaterThan(0);
    const report = await runPostGeneration(input({ json: attached.json, library, attached: attached.attached }));
    const row = report.assets.find((a) => a.id === "gz1")!;
    expect(row).toMatchObject({ applied: true, family: "gazebo" });
    expect(row.feature).toMatch(/^building \d+$/);
  });
});

describe("completion follows the admin's work", () => {
  it("shows an approved recipe in the Knowledge Need's completion on the next generation", async () => {
    const before = await runPostGeneration(input());
    expect(before.knowledgeGaps.find((g) => g.id === "outdoor-dining")!.reason).toMatch(/0 of 3 recipes/);
    const saved = await saveRecipe(recipeInputSchema.parse({ name: "Caribbean Dining Pavilion 01", category: "outdoor-living", styleTags: ["tropical"], guidance: ["Shade the table."], knowledgeIds: ["outdoor-dining"] }), undefined, { approve: true });
    if (!saved.ok) throw new Error(saved.error);
    const after = await runPostGeneration(input({ projectId: "p2" }));
    expect(after.knowledgeGaps.find((g) => g.id === "outdoor-dining")!.reason).toMatch(/1 of 3 recipes/);
    // The recipe is also filed on the Knowledge Need, where the admin sees it.
    const lib = await readLibrary();
    expect(lib.knowledge.find((k) => k.id === "outdoor-dining")!.recipeIds).toEqual([saved.value.id]);
  });

  it("moves a Need to approved when its required plan assets are in the library, and its Knowledge Need completes further", async () => {
    await runPostGeneration(input());
    let lib = await readLibrary();
    const need = lib.needs.find((n) => n.title.endsWith("Furniture"))!;
    const plan = lib.plans.find((p) => p.needId === need.id)!;
    expect(need.status).toBe("needed");
    expect(need.components).toContain("dining-table");

    const [first, ...rest] = plan.assets.filter((a) => a.priority === "required");
    await completePlannedAsset(plan.id, first.id, "asset-1");
    lib = await readLibrary();
    expect(lib.needs.find((n) => n.id === need.id)).toMatchObject({ status: "generating" });
    // The component the asset supplies leaves the missing list.
    const done = first.tags.find((t) => t.startsWith("component:"))!.slice("component:".length);
    expect(lib.needs.find((n) => n.id === need.id)!.components).not.toContain(done);

    for (const [i, a] of rest.entries()) await completePlannedAsset(plan.id, a.id, `asset-${i + 2}`);
    lib = await readLibrary();
    expect(lib.needs.find((n) => n.id === need.id)).toMatchObject({ status: "approved" });
    expect(lib.plans.find((p) => p.id === plan.id)!.assets.filter((a) => a.priority === "required").every((a) => a.generated)).toBe(true);

    // The approved assets count toward the Knowledge Need the plan belongs to, so its completion rises.
    const knowledgeId = plan.knowledgeId!;
    const facts = (n: number) => ({
      recipes: [],
      assets: Array.from({ length: n }, (_, i) => ({ id: `a${i}`, type: "glb-model", family: "furniture", styleTags: ["tropical"], status: "approved", knowledgeIds: [knowledgeId], validation: { passed: true } }) as unknown as CuratedAsset),
    });
    const k = (n: number) => knowledgeProgress({ id: knowledgeId, assetIds: [], recipeIds: [] }, facts(n)).completion;
    expect(k(4)).toBeGreaterThan(k(0));
  });

  it("reopens an approved Need when a later design still cannot be satisfied", async () => {
    await runPostGeneration(input());
    let lib = await readLibrary();
    const need = lib.needs.find((n) => n.title.endsWith("Furniture"))!;
    const plan = lib.plans.find((p) => p.needId === need.id)!;
    for (const [i, a] of plan.assets.entries()) await completePlannedAsset(plan.id, a.id, `asset-${i}`);
    expect((await readLibrary()).needs.find((n) => n.id === need.id)!.status).toBe("approved");
    // The approved assets are not in this generation's library (the admin's browser never sent them): still missing.
    await runPostGeneration(input({ projectId: "p2" }));
    lib = await readLibrary();
    expect(lib.needs.find((n) => n.id === need.id)!.status).toBe("needed");
  });
});

describe("persistence", () => {
  it("reads a library file written before reports existed", async () => {
    await writeFile(path.join(dir, "library.json"), JSON.stringify({ needs: [], recipes: [], knowledge: [], plans: [] }));
    const report = await runPostGeneration(input());
    expect(report.persistence.ok).toBe(true);
    expect((await readLibrary()).generations).toHaveLength(1);
  });

  it("survives a restart: a fresh module graph reads back exactly what was written", async () => {
    const report = await runPostGeneration(input());
    const file = path.join(dir, "library.json");
    const onDisk = JSON.parse(await readFile(file, "utf8")) as Awaited<ReturnType<typeof readLibrary>>;
    expect(onDisk.generations.map((g) => g.id)).toEqual([report.id]);

    vi.resetModules();
    const restarted = await import("../store");
    const after = await restarted.readLibrary();
    expect(after.knowledge.map((k) => k.id).sort()).toEqual(report.knowledgeGaps.map((g) => g.id).sort());
    expect(after.needs).toHaveLength(report.assetNeeds.length);
    expect(after.plans).toHaveLength(report.plansCreated.length);
    expect(after.generations[0].persistence.ok).toBe(true);
  });

  it("keeps only the newest reports", async () => {
    const { MAX_REPORTS } = await import("../store");
    for (let i = 0; i < MAX_REPORTS + 3; i++) await runPostGeneration(input({ projectId: `p${i}` }));
    const lib = await readLibrary();
    expect(lib.generations).toHaveLength(MAX_REPORTS);
    expect(lib.needs.every((n) => n.requestedCount === MAX_REPORTS + 3)).toBe(true);
  }, 60_000);
});
