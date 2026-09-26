import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CuratedAsset } from "@/types/assets";

const data = new Map<string, string>();

beforeEach(() => {
  data.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});

const glb = (over: Partial<CuratedAsset>): CuratedAsset => ({
  id: "a1", sourceSlug: "a1", source: "generated", type: "glb-model", name: "Gazebo", categories: [], tags: [], thumbnailUrl: "",
  pbr: { baseColor: "#888", roughness: 0.8, metalness: 0 }, compatibleStyles: [], status: "pending", importedAt: "", ...over,
});

describe("asset approval", () => {
  it("blocks approving a generated GLB until it has passed validation", async () => {
    const { useAssetStore, approvalBlocker } = await import("../useAssetStore");
    const failing = glb({});
    useAssetStore.getState().addToQueue(failing);
    useAssetStore.getState().approve("a1");
    expect(useAssetStore.getState().catalog).toHaveLength(0);
    expect(approvalBlocker(failing)).toMatch(/validation/);

    useAssetStore.getState().updateAssetMeta("a1", { validation: { checkedAt: "", passed: true, errors: [], warnings: [] } });
    useAssetStore.getState().approve("a1");
    expect(useAssetStore.getState().catalog.map((a) => a.id)).toEqual(["a1"]);
  });

  it("keeps legacy approvals working: materials and plain uploads need nothing new", async () => {
    const { useAssetStore } = await import("../useAssetStore");
    useAssetStore.getState().addToQueue(glb({ id: "mat", source: "polyhaven", type: "pbr-material" }));
    useAssetStore.getState().addToQueue(glb({ id: "up", source: "upload" }));
    useAssetStore.getState().approve("mat");
    useAssetStore.getState().approve("up");
    expect(useAssetStore.getState().catalog.map((a) => a.id).sort()).toEqual(["mat", "up"]);
    expect(useAssetStore.getState().getPBRMaterials().map((a) => a.id)).toEqual(["mat"]);
  });

  it("edits library metadata on a queued asset", async () => {
    const { useAssetStore } = await import("../useAssetStore");
    useAssetStore.getState().addToQueue(glb({ id: "up", source: "upload" }));
    useAssetStore.getState().updateAssetMeta("up", { family: "gazebo", styleTags: ["modern"], dimensions: { width: 4 } });
    expect(useAssetStore.getState().queue[0]).toMatchObject({ family: "gazebo", styleTags: ["modern"] });
  });
});
