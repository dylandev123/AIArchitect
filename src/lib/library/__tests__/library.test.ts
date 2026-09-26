import { describe, expect, it } from "vitest";
import type { CuratedAsset } from "@/types/assets";
import type { DesignRecipe, Need } from "@/types/library";
import { normalizeAssetRequest, extractRequestsFromBrief, sameFamily } from "../taxonomy";
import { canTransition, findMatchingNeed, recordRequest } from "../needs";
import { findAssets, findRecipes, resolveAsset, toAssetIndex } from "../retrieval";
import { formatParameterLines, parseParameterLines, parseRelationshipLines, recipeInputSchema, describeRecipesForPrompt } from "../recipes";
import { requestsFromProject } from "../requests";

const NOW = new Date("2026-09-26T10:00:00Z");
let n = 0;
const id = () => `need-${++n}`;

function record(needs: Need[], text: string, projectId?: string): Need[] {
  const req = normalizeAssetRequest(text, { projectId })!;
  const next = recordRequest(needs, req, NOW, id);
  return needs.some((x) => x.id === next.id) ? needs.map((x) => (x.id === next.id ? next : x)) : [...needs, next];
}

const asset = (over: Partial<CuratedAsset>): CuratedAsset => ({
  id: "a1", sourceSlug: "a1", source: "upload", type: "glb-model", name: "Gazebo", categories: [], tags: [], thumbnailUrl: "",
  pbr: { baseColor: "#888", roughness: 0.8, metalness: 0 }, compatibleStyles: [], status: "approved", importedAt: "",
  // A library GLB has been through validation (retrieval only offers models with a validated file behind them).
  validation: { checkedAt: "", passed: true, errors: [], warnings: [] }, ...over,
});

const recipe = (over: Partial<DesignRecipe>): DesignRecipe => ({
  id: "r1", name: "Caribbean Estate Hip 03", category: "roof", styleTags: ["tropical"], compatibleScales: ["luxury", "estate", "mansion"], environmentTags: [],
  parameters: [], relationships: [], guidance: [], usageCount: 0, successCount: 0, failureCount: 0, approval: "approved", version: 1,
  created_at: NOW.toISOString(), updated_at: NOW.toISOString(), ...over,
});

describe("wording normalisation", () => {
  it("maps different wordings of one object to the same family", () => {
    const a = normalizeAssetRequest("modern gazebo")!;
    const b = normalizeAssetRequest("contemporary pool pavilion")!;
    const c = normalizeAssetRequest("modern tropical pool gazebo")!;
    expect([a.category, b.category, c.category]).toEqual(["gazebo", "gazebo", "gazebo"]);
    expect(sameFamily(a, b)).toBe(true);
    expect(sameFamily(a, c)).toBe(true);
    expect(c.styleTags).toEqual(["modern", "tropical"]);
    expect(c.contextTags).toContain("poolside");
  });

  it("keeps genuinely different styles and categories apart", () => {
    expect(sameFamily(normalizeAssetRequest("mediterranean pool bar")!, normalizeAssetRequest("modern pool bar")!)).toBe(false);
    expect(sameFamily(normalizeAssetRequest("modern rustic gazebo")!, normalizeAssetRequest("modern tropical gazebo")!)).toBe(false);
    expect(sameFamily(normalizeAssetRequest("modern gazebo")!, normalizeAssetRequest("modern pergola")!)).toBe(false);
  });

  it("returns null for text that names no asset, and ignores a car garage", () => {
    expect(normalizeAssetRequest("a warm cosy feeling")).toBeNull();
    expect(extractRequestsFromBrief("A three-car garage with a long driveway.")).toEqual([]);
  });

  it("reads each object's own style and context from the brief", () => {
    const reqs = extractRequestsFromBrief("A villa on the beach. A tropical pool bar and a fire pit on the terrace.");
    expect(reqs.map((r) => r.category).sort()).toEqual(["fire-pit", "outdoor-bar"]);
    expect(reqs.find((r) => r.category === "outdoor-bar")!.contextTags).toContain("poolside");
    expect(reqs.find((r) => r.category === "fire-pit")!.contextTags).toContain("terrace");
  });
});

describe("needs", () => {
  it("consolidates duplicate requests into one need and counts them", () => {
    let needs: Need[] = [];
    needs = record(needs, "modern gazebo", "p1");
    needs = record(needs, "contemporary pool pavilion", "p2");
    needs = record(needs, "modern tropical pool gazebo", "p3");
    expect(needs).toHaveLength(1);
    expect(needs[0].requestedCount).toBe(3);
    expect(needs[0].projectRefs.map((r) => r.projectId)).toEqual(["p1", "p2", "p3"]);
    expect(needs[0].phrasings).toHaveLength(3);
    expect(needs[0].styleTags).toEqual(["modern", "tropical"]);
    expect(needs[0].status).toBe("needed");
  });

  it("creates separate needs for different families", () => {
    let needs: Need[] = [];
    needs = record(needs, "mediterranean pool bar");
    needs = record(needs, "modern pool bar");
    expect(needs).toHaveLength(2);
    expect(findMatchingNeed(needs, normalizeAssetRequest("tuscan pool bar")!)?.id).toBe(needs[0].id);
  });

  it("keeps the largest requested dimensions", () => {
    let needs = [recordRequest([], normalizeAssetRequest("gazebo", { dimensions: { width: 4, depth: 4 } })!, NOW, id)];
    const next = recordRequest(needs, normalizeAssetRequest("gazebo", { dimensions: { width: 6, depth: 3 } })!, NOW, id);
    needs = [next];
    expect(needs[0].dimensions).toMatchObject({ width: 6, depth: 4 });
  });

  it("guards status transitions", () => {
    expect(canTransition("needed", "ignored")).toBe(true);
    expect(canTransition("ignored", "needed")).toBe(true);
    expect(canTransition("approved", "ignored")).toBe(false);
  });
});

describe("asset retrieval", () => {
  const catalog = [
    asset({ id: "g-modern", family: "gazebo", styleTags: ["modern"], contextTags: ["poolside"], dimensions: { width: 4, depth: 4 } }),
    asset({ id: "g-rustic", family: "gazebo", styleTags: ["rustic"] }),
    asset({ id: "g-pending", family: "gazebo", styleTags: ["modern"], status: "pending" }),
    asset({ id: "g-project", family: "gazebo", styleTags: ["modern"], scope: "project" }),
    asset({ id: "legacy-wood", type: "pbr-material", categories: ["wood"] }),
    asset({ id: "legacy-glb" }), // an old upload with no library metadata
  ];

  it("retrieves an approved asset by semantic tags", () => {
    const req = normalizeAssetRequest("contemporary tropical pool pavilion")!;
    const found = findAssets(toAssetIndex(catalog), req);
    expect(found.map((f) => f.item.id)).toEqual(["g-modern"]);
    expect(resolveAsset(toAssetIndex(catalog), req).kind).toBe("asset");
  });

  it("never forces an inappropriate asset", () => {
    expect(resolveAsset(toAssetIndex(catalog), normalizeAssetRequest("mediterranean gazebo")!).kind).toBe("fallback");
    expect(resolveAsset(toAssetIndex(catalog), normalizeAssetRequest("modern fire pit")!).kind).toBe("fallback");
    expect(resolveAsset(toAssetIndex(catalog), normalizeAssetRequest("modern gazebo", { dimensions: { width: 20, depth: 20 } })!).kind).toBe("fallback");
  });

  it("leaves legacy assets (no library metadata) out of retrieval without breaking", () => {
    expect(toAssetIndex(catalog).map((a) => a.id)).toEqual(["g-modern", "g-rustic"]);
  });

  it("prefers the asset with the better track record", () => {
    const req = normalizeAssetRequest("modern gazebo")!;
    const two = [asset({ id: "bad", family: "gazebo", styleTags: ["modern"], failureCount: 5 }), asset({ id: "good", family: "gazebo", styleTags: ["modern"], successCount: 5 })];
    expect(findAssets(toAssetIndex(two), req)[0].item.id).toBe("good");
  });
});

describe("recipe retrieval", () => {
  const recipes = [
    recipe({ id: "carib" }),
    recipe({ id: "proposed", approval: "proposed" }),
    recipe({ id: "small-only", compatibleScales: ["cottage"] }),
    recipe({ id: "beach-only", environmentTags: ["beach"] }),
    recipe({ id: "nordic", styleTags: ["nordic"] }),
    recipe({ id: "pool", category: "pool", styleTags: ["modern"], compatibleScales: ["estate", "mansion"] }),
  ];

  it("finds approved recipes by style, scale and environment", () => {
    const ids = findRecipes(recipes, { styleTags: ["tropical"], scale: "estate", environment: "beach" }).map((r) => r.item.id);
    expect(ids).toContain("carib");
    expect(ids).toContain("beach-only");
    expect(ids).not.toContain("proposed");
    expect(ids).not.toContain("small-only");
    expect(ids).not.toContain("nordic");
  });

  it("excludes a recipe tied to another environment", () => {
    expect(findRecipes(recipes, { styleTags: ["tropical"], scale: "estate", environment: "hillside" }).map((r) => r.item.id)).not.toContain("beach-only");
  });

  it("filters by category", () => {
    expect(findRecipes(recipes, { category: "pool", scale: "mansion" }).map((r) => r.item.id)).toEqual(["pool"]);
  });

  it("ranks proven recipes higher", () => {
    const two = [recipe({ id: "a", failureCount: 4 }), recipe({ id: "b", successCount: 4 })];
    expect(findRecipes(two, { styleTags: ["tropical"] })[0].item.id).toBe("b");
  });

  it("describes matches for the prompt, and says nothing when there are none", () => {
    expect(describeRecipesForPrompt([])).toBe("");
    const text = describeRecipesForPrompt([recipe({ parameters: [{ key: "pitch", value: 32, min: 28, max: 36, unit: "deg" }], guidance: ["deep eaves"] })]);
    expect(text).toContain("Caribbean Estate Hip 03");
    expect(text).toContain("pitch: 32 (range 28–36 deg)");
    expect(text).toContain("deep eaves");
  });
});

describe("recipe editing helpers", () => {
  it("round-trips parameter and relationship text", () => {
    const { params, errors } = parseParameterLines("pitch: 32 [28..36] deg\nroof: hip {hip|gable}\ncupola: false");
    expect(errors).toEqual([]);
    expect(params).toEqual([
      { key: "pitch", value: 32, min: 28, max: 36, unit: "deg" },
      { key: "roof", value: "hip", options: ["hip", "gable"] },
      { key: "cupola", value: false },
    ]);
    expect(parseParameterLines(formatParameterLines(params)).params).toEqual(params);
    expect(parseRelationshipLines("requires: pool-bar — near the edge\nveranda")).toEqual([
      { kind: "requires", target: "pool-bar", note: "near the edge" },
      { kind: "prefers", target: "veranda" },
    ]);
  });

  it("rejects malformed recipes", () => {
    expect(recipeInputSchema.safeParse({ name: "x", category: "roof" }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ name: "Valid name", category: "roof", parameters: [{ key: "p", value: 50, min: 28, max: 36 }] }).success).toBe(false);
    expect(recipeInputSchema.safeParse({ name: "Valid name", category: "roof" }).success).toBe(true);
  });
});

describe("requests from a generated project", () => {
  it("turns freestanding gazebos and bars into requests, marking poolside ones", () => {
    const json = JSON.stringify({
      exteriorOptions: { style: "caribbean-villa" },
      pools: [{ siteX: 10, siteZ: 0 }],
      buildings: [
        { kind: "gazebo", x: 14, z: 2, width: 4, depth: 4 },
        { kind: "villa", x: 30, z: 30, width: 10, depth: 10 },
      ],
    });
    const reqs = requestsFromProject(json, "A house with a fire pit", "p1");
    expect(reqs.map((r) => r.category).sort()).toEqual(["fire-pit", "gazebo"]);
    const gazebo = reqs.find((r) => r.category === "gazebo")!;
    expect(gazebo.styleTags).toEqual(["tropical"]);
    expect(gazebo.contextTags).toContain("poolside");
    expect(gazebo.dimensions).toMatchObject({ width: 4, depth: 4 });
  });

  it("tolerates invalid JSON", () => {
    expect(requestsFromProject("{", "", null)).toEqual([]);
  });
});
