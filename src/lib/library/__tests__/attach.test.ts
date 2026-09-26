import { describe, expect, it } from "vitest";
import type { CuratedAsset } from "@/types/assets";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { attachLibraryAssets } from "../attach";
import { findAssets, isRetrievableAsset, resolveAsset, toAssetIndex, type AssetIndexEntry } from "../retrieval";

const gazebo: AssetIndexEntry = { id: "glb-gazebo", family: "gazebo", styleTags: ["modern"], contextTags: [], dimensions: { width: 4, depth: 4, height: 3 } };
const bar: AssetIndexEntry = { id: "glb-bar", family: "outdoor-bar", styleTags: [], contextTags: [], dimensions: { width: 6, depth: 3 } };

const project = (buildings: unknown[]) => JSON.stringify({ house: { width: 12, depth: 10, floors: 1, roof: "flat" }, exteriorOptions: { style: "modern-luxury" }, buildings });

describe("attaching library assets at generation", () => {
  it("references a compatible approved asset by id and leaves everything else alone", () => {
    const json = project([
      { kind: "gazebo", x: 12, z: 0, width: 4, depth: 4, floors: 1, roof: "hip" },
      { kind: "outdoor_bar", x: -8, z: 3, width: 6, depth: 3, floors: 1, roof: "flat" },
      { kind: "villa", x: 20, z: 20, width: 9, depth: 9, floors: 1, roof: "flat" },
    ]);
    const { json: out, attached } = attachLibraryAssets(json, [gazebo, bar]);
    const buildings = JSON.parse(out).buildings;
    expect(buildings.map((b: { assetId?: string }) => b.assetId)).toEqual(["glb-gazebo", "glb-bar", undefined]);
    expect(attached.map((a) => a.index)).toEqual([0, 1]);
    // Only assetId was added: every other field is byte-for-byte what generation produced.
    const before = JSON.parse(json);
    for (const b of buildings) delete b.assetId;
    expect(JSON.parse(JSON.stringify({ ...JSON.parse(out), buildings }))).toEqual(before);
  });

  it("does not force poor matches: wrong style, wrong size, or no asset means no assetId", () => {
    const json = project([{ kind: "gazebo", x: 0, z: 0, width: 4, depth: 4, floors: 1, roof: "hip" }]);
    const rustic = { ...gazebo, styleTags: ["rustic"] };
    const huge = { ...gazebo, dimensions: { width: 20, depth: 20, height: 9 } };
    for (const lib of [[], [rustic], [huge], [bar]]) {
      const res = attachLibraryAssets(json, lib);
      expect(res.attached).toEqual([]);
      expect(res.json).toBe(json);
    }
  });

  it("returns the input untouched for unparseable json", () => {
    expect(attachLibraryAssets("not json", [gazebo]).json).toBe("not json");
  });
});

describe("the project keeps its meaning without the asset", () => {
  const base = [{ kind: "gazebo", x: 12, z: 0, width: 4, depth: 4, floors: 1, roof: "hip" }, { kind: "outdoor_bar", x: -8, z: 3, width: 6, depth: 3, floors: 1, roof: "flat" }];
  it("builds identical procedural geometry whether or not a feature references an asset", () => {
    const plain = generateHouseFromJson(project(base));
    const withAsset = generateHouseFromJson(project(base.map((b, i) => ({ ...b, assetId: `glb-${i}` }))));
    expect(plain.errors).toEqual([]);
    expect(withAsset.errors).toEqual([]);
    expect(withAsset.model?.primitives).toEqual(plain.model?.primitives);
    expect(withAsset.model?.primitives.some((p) => p.id.startsWith("building-0-post"))).toBe(true);
    expect(withAsset.site?.buildings[0].assetId).toBe("glb-0");
    expect(plain.site?.buildings[0].assetId).toBeUndefined();
  });
});

describe("retrieval only offers assets that can actually render", () => {
  const asset = (over: Partial<CuratedAsset>): CuratedAsset => ({
    id: "a", sourceSlug: "a", source: "upload", type: "glb-model", name: "G", categories: [], tags: [], thumbnailUrl: "", pbr: { baseColor: "#fff", roughness: 1, metalness: 0 },
    compatibleStyles: [], status: "approved", importedAt: "", family: "gazebo", ...over,
  });
  const ok = { checkedAt: "", passed: true, errors: [], warnings: [] };
  it("requires a passing validation for GLB models", () => {
    expect(isRetrievableAsset(asset({}))).toBe(false);
    expect(isRetrievableAsset(asset({ validation: { ...ok, passed: false, errors: ["x"] } }))).toBe(false);
    expect(isRetrievableAsset(asset({ validation: ok }))).toBe(true);
    expect(toAssetIndex([asset({ validation: ok }), asset({ id: "b" })]).map((e) => e.id)).toEqual(["a"]);
  });

  it("demotes an asset that keeps failing until it stops being chosen", () => {
    const req = { category: "gazebo" as const, styleTags: ["modern"], contextTags: [], dimensions: { width: 4, depth: 4 } };
    const healthy = { ...gazebo, id: "healthy", successCount: 0, failureCount: 0 };
    const flaky = { ...gazebo, id: "flaky", failureCount: 4, successCount: 0 };
    const ranked = (lib: AssetIndexEntry[]) => resolveAsset(lib, req);
    expect(ranked([flaky, healthy])).toMatchObject({ kind: "asset", asset: { id: "healthy" } });
    const score = (lib: AssetIndexEntry[]) => findAssets(lib, req)[0]?.score ?? 0;
    expect(score([flaky])).toBeLessThan(score([healthy]));
    expect(ranked([{ ...flaky, failureCount: 12 }]).kind).toBe("fallback");
    // Successes offset failures: a reliable asset with an old failure is not punished.
    const recovered = ranked([{ ...gazebo, failureCount: 2, successCount: 5 }]);
    expect(recovered.kind).toBe("asset");
  });
});
