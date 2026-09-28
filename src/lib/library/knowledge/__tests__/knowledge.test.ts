import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CuratedAsset } from "@/types/assets";
import type { DesignRecipe, KnowledgeNeed } from "@/types/library";
import { linkKnowledge, noteRecipeOutcome, recipesForBrief, recordKnowledgeNeeds, recordMissingAssetNeeds, saveRecipe, setKnowledgeStatus } from "../../service";
import { readLibrary } from "../../store";
import { recipeInputSchema } from "../../recipes";
import { scoreDesignAreas, weakAreas } from "../areas";
import { knowledgeForFamily, pickKnowledge } from "../catalog";
import { detectKnowledgeSignals, knowledgeBoards, knowledgeMetrics, knowledgeProgress, recordKnowledgeSignal } from "../knowledge";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "knowledge-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const settings = { environment: "beach", viewDirection: "south", terrainSlope: "flat", approachSide: "north", designTier: "luxury", projectScale: "estate" };

/** An estate with a rich house and roofs but a bare backyard: one pool, nothing around it. */
const weakBackyard = JSON.stringify({
  settings,
  house: { width: 20, depth: 14, floors: 2, roof: "hip" },
  exteriorOptions: { style: "modern-luxury", wallFinish: "stucco", windowStyle: "casement", doorStyle: "pivot", railingStyle: "glass-panel", columnStyle: "none" },
  windows: Array.from({ length: 14 }, () => ({ wall: "south" })),
  pools: [{ wall: "south", offset: 2, distance: 3, width: 8, depth: 4, waterDepth: 1.5 }],
  driveways: [{ wall: "north", offset: 2, width: 4, length: 20, bend: 3 }],
  roads: [{}],
  parking: [{}],
  garages: [{}],
  bays: [{}, {}], arches: [{}, {}], dormers: [{}, {}, {}], crossGables: [{}], chimneys: [{}, {}], porches: [{ wall: "north" }], stairs: [{}],
  landscaping: [{ kind: "garden" }, { kind: "garden" }, { kind: "lawn" }, { kind: "garden" }],
  paths: [{}, {}, {}], patios: [], decks: [], buildings: [],
});

/** Five villas with the same hip roof and nothing on them. */
const repetitiveRoofs = JSON.stringify({
  settings: { ...settings, designTier: "luxury" },
  exteriorOptions: { style: "mediterranean" },
  house: { roof: "hip" },
  buildings: Array.from({ length: 5 }, () => ({ kind: "villa", roof: "hip" })),
});

const gazebo = { id: "g", family: "gazebo" as const, styleTags: [], contextTags: [], dimensions: undefined };

describe("design area scoring", () => {
  it("scores every area independently and flags the weak backyard, not the healthy areas", () => {
    const scores = scoreDesignAreas(weakBackyard, "a modern beach estate", []);
    const by = Object.fromEntries(scores.map((s) => [s.area, s]));
    expect(scores).toHaveLength(15);
    expect(by["outdoor-living"].score).toBeLessThan(0.5);
    expect(by.furniture).toMatchObject({ relevant: true, score: 0 });
    expect(by.lighting.relevant).toBe(true);
    expect(by.terrain.relevant).toBe(false); // flat site, no need for terracing
    expect(by.architecture.score).toBeGreaterThanOrEqual(0.5);
    expect(by.driveway.score).toBeGreaterThanOrEqual(0.5);
  });

  it("lets approved library assets lift a thin area, and only then", () => {
    const empty = scoreDesignAreas(weakBackyard, "", []).find((s) => s.area === "outdoor-living")!;
    const stocked = scoreDesignAreas(weakBackyard, "", ["gazebo", "pergola", "outdoor-bar", "fire-pit", "cabana", "hot-tub", "outdoor-kitchen"].map((family) => ({ ...gazebo, id: family, family: family as never }))).find((s) => s.area === "outdoor-living")!;
    expect(stocked.score).toBeGreaterThan(empty.score);
  });

  it("returns nothing for unreadable output", () => {
    expect(scoreDesignAreas("not json", "", [])).toEqual([]);
    expect(weakAreas([])).toEqual([]);
  });
});

describe("detecting knowledge needs", () => {
  it("files a weak backyard under Luxury Outdoor Living, never under Gazebo", () => {
    const signals = detectKnowledgeSignals(weakBackyard, "a modern beach estate", "p1", []);
    const ids = signals.map((s) => s.knowledgeId);
    expect(ids).toContain("luxury-outdoor-living");
    expect(ids.join()).not.toMatch(/gazebo/);
    // outdoor-living and furniture both point at it, yet it is one signal for the generation.
    const outdoor = signals.find((s) => s.knowledgeId === "luxury-outdoor-living")!;
    expect(outdoor.areas).toEqual(expect.arrayContaining(["outdoor-living", "furniture"]));
    expect(ids.filter((i) => i === "luxury-outdoor-living")).toHaveLength(1);
  });

  it("files repetitive roofs under the style's roof collection, not a roof type", () => {
    const ids = detectKnowledgeSignals(repetitiveRoofs, "a Tuscan villa compound", "p1", []).map((s) => s.knowledgeId);
    expect(ids).toContain("mediterranean-roof-collection");
    expect(ids).not.toContain("luxury-roof-collection");
  });

  it("falls back to the generic parent when no narrow entry matches", () => {
    const json = repetitiveRoofs.replace("mediterranean", "modern-luxury");
    expect(detectKnowledgeSignals(json, "a modern compound", null, []).map((s) => s.knowledgeId)).toContain("luxury-roof-collection");
  });

  it("only picks narrow entries on a real match", () => {
    expect(pickKnowledge("gardens", { brief: "a family home", styles: [] })?.id).toBe("estate-gardens");
    expect(pickKnowledge("gardens", { brief: "a Kyoto tea garden", styles: [] })?.id).toBe("japanese-courtyard");
    expect(pickKnowledge("vegetation", { brief: "", styles: ["coastal"] })?.id).toBe("coastal-plant-palette");
  });

  it("names the parent knowledge for an object family", () => {
    expect(knowledgeForFamily("gazebo")[0].id).toBe("luxury-outdoor-living");
  });
});

describe("accumulating", () => {
  it("creates then increments, accumulating styles, scales, environments and examples", () => {
    const [first] = detectKnowledgeSignals(weakBackyard, "a modern beach estate", "p1", []);
    const a = recordKnowledgeSignal(undefined, first, new Date("2026-01-01"));
    const b = recordKnowledgeSignal(a, { ...first, projectId: "p2", styles: ["tropical"], environment: "cliff" }, new Date("2026-01-05"));
    expect(b).toMatchObject({ id: first.knowledgeId, requestCount: 2, firstSeen: a.firstSeen, status: "open" });
    expect(b.lastSeen).toBe(new Date("2026-01-05").toISOString());
    expect(b.projectExamples.map((p) => p.projectId)).toEqual(["p1", "p2"]);
    expect(b.styles).toEqual(expect.arrayContaining(["modern", "tropical"]));
    expect(b.environments).toEqual(expect.arrayContaining(["beach", "cliff"]));
    expect(b.scales).toContain("estate");
  });

  it("persists through generation and counts concurrent generations without loss", async () => {
    await Promise.all(Array.from({ length: 6 }, (_, i) => recordKnowledgeNeeds(weakBackyard, "a modern beach estate", `p${i}`, [])));
    const { knowledge } = await readLibrary();
    expect(knowledge.find((k) => k.id === "luxury-outdoor-living")?.requestCount).toBe(6);
  });

  it("leaves object Needs working alongside (both recorded, different levels)", async () => {
    const project = JSON.stringify({ ...JSON.parse(weakBackyard), buildings: [{ kind: "gazebo", x: 5, z: 5, width: 4, depth: 4 }] });
    await recordMissingAssetNeeds(project, "", "p1", []);
    await recordKnowledgeNeeds(project, "", "p1", []);
    const lib = await readLibrary();
    expect(lib.needs[0].category).toBe("gazebo");
    expect(lib.knowledge.some((k) => k.id === "luxury-outdoor-living")).toBe(true);
  });

  it("loads a library file written before Knowledge Needs existed", async () => {
    await writeFile(path.join(dir, "library.json"), JSON.stringify({ needs: [{ id: "n", title: "Gazebo", category: "gazebo", requestedCount: 3 }], recipes: [] }));
    const lib = await readLibrary();
    expect(lib.knowledge).toEqual([]);
    expect(lib.needs).toHaveLength(1);
    await recordKnowledgeNeeds(weakBackyard, "", "p1", []);
    const after = await readLibrary();
    expect(after.needs).toHaveLength(1);
    expect(after.knowledge.length).toBeGreaterThan(0);
  });

  it("never throws when the store is unavailable", async () => {
    const blocker = path.join(dir, "file");
    await writeFile(blocker, "x");
    vi.stubEnv("AI_LIBRARY_PATH", path.join(blocker, "sub", "library.json"));
    await expect(recordKnowledgeNeeds(weakBackyard, "", "p1", [])).resolves.toEqual([]);
  });
});

const approvedAsset = (over: Partial<CuratedAsset>): CuratedAsset =>
  ({ id: "a", sourceSlug: "a", source: "upload", type: "vegetation", name: "a", categories: [], tags: [], thumbnailUrl: "", pbr: { baseColor: "#fff", roughness: 1, metalness: 0 }, compatibleStyles: [], status: "approved", importedAt: "", ...over }) as CuratedAsset;

const recipe = (over: Partial<DesignRecipe>): DesignRecipe =>
  ({ id: "r", name: "r", category: "outdoor-living", styleTags: [], compatibleScales: [], environmentTags: [], parameters: [], relationships: [], guidance: [], usageCount: 0, successCount: 0, failureCount: 0, approval: "approved", version: 1, created_at: "", updated_at: "", ...over }) as DesignRecipe;

describe("completion", () => {
  const need = { id: "luxury-outdoor-living", assetIds: [], recipeIds: [] };

  it("starts at zero and grows as approved assets and recipes are linked", () => {
    expect(knowledgeProgress(need, { assets: [], recipes: [] }).completion).toBe(0);
    const glb = (id: string, family: CuratedAsset["family"]) => approvedAsset({ id, type: "glb-model", family, validation: { checkedAt: "", passed: true, errors: [], warnings: [] } });
    const some = knowledgeProgress(need, { assets: [glb("1", "gazebo"), glb("2", "fire-pit"), glb("3", "light")], recipes: [recipe({ id: "r1" })] });
    expect(some.facets.assets).toMatchObject({ have: 2, target: 18 });
    expect(some.facets.lighting.have).toBe(1);
    expect(some.facets.recipes.have).toBe(1);
    expect(some.completion).toBeGreaterThan(0);
    expect(some.assetIds).toEqual(["1", "2", "3"]);
  });

  it("ignores unapproved, project-scoped and unvalidated assets and unapproved recipes", () => {
    const facts = {
      assets: [
        approvedAsset({ id: "p", type: "glb-model", family: "gazebo", status: "pending", validation: { checkedAt: "", passed: true, errors: [], warnings: [] } }),
        approvedAsset({ id: "s", type: "glb-model", family: "gazebo", scope: "project", validation: { checkedAt: "", passed: true, errors: [], warnings: [] } }),
        approvedAsset({ id: "u", type: "glb-model", family: "gazebo" }),
      ],
      recipes: [recipe({ approval: "proposed" })],
    };
    expect(knowledgeProgress(need, facts).completion).toBe(0);
  });

  it("counts explicitly filed materials, which have no family", () => {
    const material = approvedAsset({ id: "m", type: "pbr-material", knowledgeIds: ["luxury-outdoor-living"] });
    expect(knowledgeProgress(need, { assets: [material], recipes: [] }).facets.materials.have).toBe(1);
  });

  it("only counts a style-specific entry's style-compatible items", () => {
    const roof = { id: "mediterranean-roof-collection", assetIds: [], recipeIds: [] };
    const facts = { assets: [], recipes: [recipe({ id: "t", category: "roof", styleTags: ["mediterranean"] }), recipe({ id: "n", category: "roof", styleTags: ["nordic"] })] };
    expect(knowledgeProgress(roof, facts).recipeIds).toEqual(["t"]);
  });
});

describe("boards", () => {
  const now = new Date("2026-06-30");
  const mk = (id: string, count: number, lastSeen: string, recent: string[], severity = 0.6): KnowledgeNeed => ({
    id, title: id, areas: [], requestCount: count, firstSeen: "2026-01-01", lastSeen, recentRequests: recent, projectExamples: [], styles: [], scales: [], environments: [],
    weaknessTotal: severity * count, assetIds: [], recipeIds: [], status: "open", version: 1,
  });
  const needs = [
    mk("luxury-outdoor-living", 92, "2026-06-29", ["2026-06-25", "2026-06-28"]),
    mk("mediterranean-roof-collection", 61, "2026-05-01", []),
    mk("exterior-lighting", 10, "2026-06-29", ["2026-06-20", "2026-06-21", "2026-06-22"], 0.9),
    { ...mk("estate-gardens", 30, "2026-06-01", []), status: "ignored" as const },
  ];

  it("ranks by demand, impact and recent growth, and hides ignored needs", () => {
    const boards = knowledgeBoards(needs, { assets: [], recipes: [] }, now);
    expect(boards.mostRequested.map((m) => m.need.id)).toEqual(["luxury-outdoor-living", "mediterranean-roof-collection", "exterior-lighting"]);
    expect(boards.recentlyGrowing.map((m) => m.need.id)).toEqual(["exterior-lighting", "luxury-outdoor-living"]);
    expect(boards.highestImpact[0].need.id).toBe("luxury-outdoor-living");
    expect(boards.closeToCompletion).toEqual([]);
  });

  it("surfaces needs close to completion and drops finished ones", () => {
    const recipes = Array.from({ length: 7 }, (_, i) => recipe({ id: `r${i}` }));
    const valid = { checkedAt: "", passed: true, errors: [], warnings: [] };
    const glbs = [
      ...Array.from({ length: 12 }, (_, i) => approvedAsset({ id: `g${i}`, type: "glb-model", family: "gazebo", validation: valid })),
      ...Array.from({ length: 5 }, (_, i) => approvedAsset({ id: `l${i}`, type: "glb-model", family: "light", validation: valid })),
      ...Array.from({ length: 3 }, (_, i) => approvedAsset({ id: `v${i}`, type: "glb-model", family: "vegetation", validation: valid })),
      ...Array.from({ length: 3 }, (_, i) => approvedAsset({ id: `m${i}`, type: "pbr-material", knowledgeIds: ["luxury-outdoor-living"] })),
    ];
    const boards = knowledgeBoards(needs, { assets: glbs, recipes }, now);
    const close = boards.closeToCompletion.find((m) => m.need.id === "luxury-outdoor-living");
    expect(close?.completion).toBeGreaterThanOrEqual(0.5);
    expect(close!.completion).toBeLessThan(0.95);
  });

  it("lowers priority as completion rises and as a need goes quiet", () => {
    const facts = { assets: [], recipes: Array.from({ length: 7 }, (_, i) => recipe({ id: `r${i}` })) };
    const bare = knowledgeMetrics(needs[0], { assets: [], recipes: [] }, now);
    expect(knowledgeMetrics(needs[0], facts, now).priority).toBeLessThan(bare.priority);
    expect(knowledgeMetrics(needs[1], { assets: [], recipes: [] }, now).priority).toBeLessThan(knowledgeMetrics({ ...needs[1], lastSeen: "2026-06-29" }, { assets: [], recipes: [] }, now).priority);
    expect(bare.confidence).toBeGreaterThan(0.5);
  });
});

describe("admin operations and retrieval order", () => {
  it("ignores, restores and links", async () => {
    await recordKnowledgeNeeds(weakBackyard, "", "p1", []);
    const id = "luxury-outdoor-living";
    expect(await setKnowledgeStatus(id, "ignored")).toMatchObject({ ok: true, value: { status: "ignored" } });
    expect(await setKnowledgeStatus("nope", "open")).toMatchObject({ ok: false, status: 404 });
    expect(await linkKnowledge(id, { kind: "asset", targetId: "asset-1", linked: true })).toMatchObject({ ok: true, value: { assetIds: ["asset-1"] } });
    expect(await linkKnowledge(id, { kind: "asset", targetId: "asset-1", linked: false })).toMatchObject({ ok: true, value: { assetIds: [] } });
    expect(await linkKnowledge(id, { kind: "recipe", targetId: "missing", linked: true })).toMatchObject({ ok: false, status: 404 });
  });

  it("prefers a recipe filed under knowledge the brief speaks to", async () => {
    await recordKnowledgeNeeds(repetitiveRoofs, "a Tuscan villa", "p1", []);
    const make = (name: string) => saveRecipe(recipeInputSchema.parse({ name, category: "roof", styleTags: ["mediterranean"] }));
    const [plain, filed] = await Promise.all([make("Plain terracotta roof"), make("Filed terracotta roof")]);
    if (!plain.ok || !filed.ok) throw new Error("save failed");
    await noteRecipeOutcome([plain.value.id], "success"); // the unfiled one has the better track record
    await (await import("../../service")).changeRecipeApproval(plain.value.id, "approved");
    await (await import("../../service")).changeRecipeApproval(filed.value.id, "approved");
    await linkKnowledge("mediterranean-roof-collection", { kind: "recipe", targetId: filed.value.id, linked: true });
    const [best] = await recipesForBrief("a Tuscan villa with terracotta roofs");
    expect(best.id).toBe(filed.value.id);
  });
});
