import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { placeV2AdditiveAsset } from "../v2AdditivePlacement";
import type { CuratedAsset } from "@/types/assets";

const plan = {
  entrance: { wall: "north" as const, offset: 6 }, driveway: { wall: "north" as const, offset: 2, width: 4, length: 12 }, parking: [{ x: 0, z: -18, width: 6, depth: 6 }],
  pool: { wall: "south" as const, offset: 5, distance: 8, width: 8, depth: 4, waterDepth: 1.4 }, terrace: { wall: "south" as const, offset: 3, width: 10, depth: 5 }, poolDeck: { x: 0, z: 16, width: 12, depth: 8 },
  paths: [{ from: "arrival" as const, to: "parking" as const, x1: 0, z1: -30, x2: 0, z2: -18, width: 1, bend: 0, surface: "gravel" as const }, { from: "parking" as const, to: "entrance" as const, x1: 0, z1: -18, x2: 0, z2: -8, width: 1, bend: 0, surface: "gravel" as const }, { from: "entrance" as const, to: "outdoor-living" as const, x1: 0, z1: -8, x2: 0, z2: 8, width: 1, bend: 0, surface: "flagstone" as const }, { from: "outdoor-living" as const, to: "pool" as const, x1: 0, z1: 8, x2: 0, z2: 16, width: 1, bend: 0, surface: "flagstone" as const }],
  landscape: [{ purpose: "pool-planting" as const, kind: "garden" as const, x: 16, z: 16, width: 6, depth: 6 }, { purpose: "view-framing" as const, kind: "lawn" as const, x: -16, z: 16, width: 6, depth: 6 }],
};
const chair = { id: "chair-glb", name: "Pool lounge chair", type: "glb-model", status: "approved", validation: { passed: true }, dimensions: { width: .8, depth: 1.1, height: .8 }, categories: ["furniture"], tags: ["chair", "poolside"], family: "furniture" } as CuratedAsset;

describe("generic V2 additive placement", () => {
  it("adds a grounded poolside chair without mutating architecture or existing Site Plan geometry", () => {
    const root = { architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, sitePlan: plan };
    const before = structuredClone(root);
    const result = placeV2AdditiveAsset(root, "add a lounge chair by the pool", [chair], [chair.id]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const next = JSON.parse(result.json);
    expect(next.architecturalDesignDocument).toEqual(before.architecturalDesignDocument);
    expect(next.sitePlan).toEqual(before.sitePlan);
    expect(next.outdoorAssetPlacements).toHaveLength(1);
    expect(next.outdoorAssetPlacements[0]).toMatchObject({ assetId: "chair-glb", role: "lounge-armchair", position: expect.arrayContaining([expect.any(Number), 0]) });
  });

  it("reports the real missing-approved-asset reason", () => {
    const root = { architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, sitePlan: plan };
    expect(placeV2AdditiveAsset(root, "add a lounge chair by the pool", [], [])).toMatchObject({ ok: false, code: "NO_APPROVED_ASSET" });
  });
});
