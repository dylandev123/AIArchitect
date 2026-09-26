import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CuratedAsset } from "@/types/assets";
import { buildGlb } from "./glbFixture";

const data = new Map<string, string>();

beforeEach(() => {
  data.clear();
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});

const glbAsset = (over: Partial<CuratedAsset>): CuratedAsset => ({
  id: "gazebo-1", sourceSlug: "gazebo_1", source: "upload", type: "glb-model", name: "Gazebo", categories: [], tags: [], thumbnailUrl: "",
  pbr: { baseColor: "#888", roughness: 0.8, metalness: 0 }, compatibleStyles: [], status: "pending", importedAt: "", family: "gazebo", ...over,
});

/** Fresh module graph with an in-memory file store whose reads are counted. */
async function setup() {
  const storage = await import("../glbStorage");
  const memory = storage.createMemoryGlbStore();
  const get = vi.spyOn(memory, "get");
  storage.setGlbStore(memory);
  const { useAssetStore } = await import("@/store/useAssetStore");
  const models = await import("../glbModels");
  const { ingestGlb } = await import("../glbIngest");
  return { memory, get, useAssetStore, models, ingestGlb };
}

describe("uploaded GLB -> validated -> approved -> loadable", () => {
  it("validates on ingest, keeps the file, and approval makes the asset retrievable", async () => {
    const { useAssetStore, memory, ingestGlb } = await setup();
    const id = "gazebo-1";
    const { derived } = await ingestGlb(id, buildGlb(), { family: "gazebo" });
    expect(derived.validation?.passed).toBe(true);
    expect(derived.dimensions).toEqual({ width: 4, depth: 4, height: 3 });
    expect(await memory.get(id)).not.toBeNull();

    useAssetStore.getState().addToQueue(glbAsset({ ...derived }));
    useAssetStore.getState().approve(id);
    const approved = useAssetStore.getState().catalog[0];
    expect(approved.status).toBe("approved");
    expect(approved.validation?.passed).toBe(true);
    const { toAssetIndex } = await import("@/lib/library/retrieval");
    expect(toAssetIndex(useAssetStore.getState().catalog).map((e) => e.id)).toEqual([id]);
  });

  it("refuses to approve a GLB whose validation failed", async () => {
    const { useAssetStore, ingestGlb } = await setup();
    const { derived } = await ingestGlb("bad", new TextEncoder().encode("not a glb, just some text bytes").buffer as ArrayBuffer);
    expect(derived.validation?.passed).toBe(false);
    useAssetStore.getState().addToQueue(glbAsset({ id: "bad", sourceSlug: "bad", ...derived }));
    useAssetStore.getState().approve("bad");
    expect(useAssetStore.getState().catalog).toHaveLength(0);
    const { approvalBlocker } = await import("@/store/useAssetStore");
    expect(approvalBlocker(useAssetStore.getState().queue[0])).toMatch(/validation failed/i);
  });
});

describe("rendering support: load, ground, cache", () => {
  it("normalises pivot and ground on load, whatever the file's origin", async () => {
    const { models, ingestGlb } = await setup();
    // Authored floating and off to one side.
    await ingestGlb("offset", buildGlb({ min: [3, 1.5, 3], max: [7, 4.5, 7] }));
    const loaded = await models.glbModels.load("offset");
    expect(loaded).not.toBeNull();
    expect(loaded!.size.toArray()).toEqual([4, 3, 4]);
    const { Box3 } = await import("three");
    const box = new Box3().setFromObject(loaded!.template);
    expect(box.min.y).toBeCloseTo(0);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0);
    expect(loaded!.triangleCount).toBe(12);
  });

  it("downloads/parses once and serves repeated use from the cache with independent clones", async () => {
    const { models, ingestGlb, get } = await setup();
    await ingestGlb("g", buildGlb());
    get.mockClear();
    await Promise.all([models.glbModels.load("g"), models.glbModels.load("g")]);
    await models.glbModels.load("g");
    expect(get).toHaveBeenCalledTimes(1);
    const a = models.instantiateGlb("g")!;
    const b = models.instantiateGlb("g")!;
    expect(a).not.toBe(b);
    a.position.set(5, 0, 0);
    expect(b.position.x).toBe(0);
    const { Mesh } = await import("three");
    let geometryA: unknown, geometryB: unknown;
    a.traverse((o) => { if (o instanceof Mesh) geometryA = o.geometry; });
    b.traverse((o) => { if (o instanceof Mesh) geometryB = o.geometry; });
    expect(geometryA).toBeDefined();
    expect(geometryA).toBe(geometryB); // shared, so reuse costs no extra memory
    expect(models.glbModels.stats().loads).toBe(1);
  });
});

describe("fallback and success tracking", () => {
  it("a missing or corrupt file fails once, is remembered, and counts against the asset", async () => {
    const { models, useAssetStore, memory } = await setup();
    const approved = glbAsset({ status: "approved", validation: { checkedAt: "", passed: true, errors: [], warnings: [] } });
    useAssetStore.setState({ catalog: [approved] });

    expect(await models.glbModels.load("gazebo-1")).toBeNull(); // nothing stored
    expect(models.glbModels.status("gazebo-1")).toBe("failed");
    await models.glbModels.load("gazebo-1");
    expect(useAssetStore.getState().catalog[0].failureCount).toBe(1); // one failure, not one per attempt

    await memory.put("corrupt", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);
    useAssetStore.setState({ catalog: [approved, { ...approved, id: "corrupt" }] });
    expect(await models.glbModels.load("corrupt")).toBeNull();
    expect(useAssetStore.getState().catalog[1].failureCount).toBe(1);
    expect(useAssetStore.getState().catalog[1].successCount ?? 0).toBe(0);
  });

  it("counts a successful render once per project feature, not once per frame", async () => {
    const { models, useAssetStore } = await setup();
    useAssetStore.setState({ catalog: [glbAsset({ status: "approved" })] });
    for (let i = 0; i < 5; i++) models.noteGlbRendered("p1", "building-0", "gazebo-1");
    models.noteGlbRendered("p1", "building-1", "gazebo-1");
    models.noteGlbRendered("p2", "building-0", "gazebo-1");
    expect(useAssetStore.getState().catalog[0]).toMatchObject({ successCount: 3, usageCount: 3 });
    expect(useAssetStore.getState().catalog[0].failureCount).toBeUndefined();
  });

  it("removing the asset deletes its file and drops the cached model, so the procedural version returns", async () => {
    const { models, useAssetStore, ingestGlb, memory } = await setup();
    const { placementsFromBuildings, usablePlacements, replacedFeatureIds } = await import("../placement");
    await ingestGlb("gazebo-1", buildGlb(), { family: "gazebo" });
    const approved = glbAsset({ status: "approved", validation: { checkedAt: "", passed: true, errors: [], warnings: [] } });
    useAssetStore.setState({ catalog: [approved] });
    const placements = placementsFromBuildings([{ kind: "gazebo", x: 0, z: 0, width: 4, depth: 4, assetId: "gazebo-1" }]);

    await models.glbModels.load("gazebo-1");
    const swapped = () => replacedFeatureIds(usablePlacements(placements, useAssetStore.getState().catalog), (id) => models.glbModels.status(id));
    expect([...swapped()]).toEqual(["building-0"]); // GLB replaces the procedural gazebo

    useAssetStore.getState().removeFromCatalog("gazebo-1");
    await Promise.resolve();
    expect(await memory.get("gazebo-1")).toBeNull();
    expect(models.glbModels.status("gazebo-1")).toBe("idle");
    expect(swapped().size).toBe(0); // procedural fallback
  });

  it("only swaps while the model is ready: loading and failed keep the procedural feature", async () => {
    const { placementsFromBuildings, replacedFeatureIds } = await import("../placement");
    const placements = placementsFromBuildings([{ kind: "gazebo", x: 0, z: 0, width: 4, depth: 4, assetId: "g" }]);
    for (const status of ["idle", "loading", "failed"] as const) expect(replacedFeatureIds(placements, () => status).size).toBe(0);
    expect(replacedFeatureIds(placements, () => "ready").size).toBe(1);
  });
});
