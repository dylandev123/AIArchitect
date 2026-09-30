import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { placeV2AdditiveAsset } from "../v2AdditivePlacement";
import type { CuratedAsset } from "@/types/assets";
import { placementBounds } from "@/lib/outdoor/placements";

const plan = {
  entrance: { wall: "north" as const, offset: 6 }, driveway: { wall: "north" as const, offset: 2, width: 4, length: 12 }, parking: [{ x: 0, z: -18, width: 6, depth: 6 }],
  pool: { wall: "south" as const, offset: 5, distance: 8, width: 8, depth: 4, waterDepth: 1.4 }, terrace: { wall: "south" as const, offset: 3, width: 10, depth: 5 }, poolDeck: { x: 0, z: 16, width: 12, depth: 8 },
  paths: [{ from: "arrival" as const, to: "parking" as const, x1: 0, z1: -30, x2: 0, z2: -18, width: 1, bend: 0, surface: "gravel" as const }, { from: "parking" as const, to: "entrance" as const, x1: 0, z1: -18, x2: 0, z2: -8, width: 1, bend: 0, surface: "gravel" as const }, { from: "entrance" as const, to: "outdoor-living" as const, x1: 0, z1: -8, x2: 0, z2: 8, width: 1, bend: 0, surface: "flagstone" as const }, { from: "outdoor-living" as const, to: "pool" as const, x1: 0, z1: 8, x2: 0, z2: 16, width: 1, bend: 0, surface: "flagstone" as const }],
  landscape: [{ purpose: "pool-planting" as const, kind: "garden" as const, x: 16, z: 16, width: 6, depth: 6 }, { purpose: "view-framing" as const, kind: "lawn" as const, x: -16, z: 16, width: 6, depth: 6 }],
};
const chair = { id: "chair-glb", name: "Pool lounge chair", type: "glb-model", status: "approved", validation: { passed: true }, dimensions: { width: .8, depth: 1.1, height: .8 }, categories: ["furniture"], tags: ["chair", "poolside"], family: "furniture" } as CuratedAsset;
const badPivotLounger = { ...chair, id: "bad-pivot-lounger", name: "Rotated pool lounger", tags: ["lounger"], validation: { passed: true, bounds: { min: [-1.5, -0.4, -0.25], max: [0.5, 0.6, 0.75] } } } as CuratedAsset;

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

  it("uses grounded, collision-checked procedural placeholders when no approved GLB exists", () => {
    const root = { architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, sitePlan: plan };
    const before = structuredClone(root);
    const result = placeV2AdditiveAsset(root, "add two lounge chairs beside the pool facing the water", [], []);
    expect(result).toMatchObject({ ok: true, object: "chair", assetId: "procedural-v2-chair", usedProceduralFallback: true });
    if (!result.ok) throw new Error(result.error);
    const next = JSON.parse(result.json);
    expect(next.architecturalDesignDocument).toEqual(before.architecturalDesignDocument);
    expect(next.sitePlan).toEqual(before.sitePlan);
    expect(next.outdoorAssetPlacements).toHaveLength(2);
    expect(next.outdoorAssetPlacements.every((p: { assetId: string; position: number[]; rotation: number[] }) => p.assetId === "procedural-v2-chair" && p.position[1] === 0 && Number.isFinite(p.rotation[1]))).toBe(true);
  });

  it("persists actual transformed GLB bounds through sequential save/reload edits", () => {
    const initial = { architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, sitePlan: plan };
    const architecture = structuredClone(initial.architecturalDesignDocument);
    const sitePlan = structuredClone(initial.sitePlan);
    const loungers = placeV2AdditiveAsset(initial, "add 2 pool loungers", [badPivotLounger], [badPivotLounger.id]);
    expect(loungers.ok).toBe(true);
    if (!loungers.ok) throw new Error(loungers.error);
    // Save/reload is the JSON boundary used by a later request.
    const reloaded = JSON.parse(loungers.json);
    const umbrella = placeV2AdditiveAsset(reloaded, "add umbrella", [], []);
    expect(umbrella.ok).toBe(true);
    if (!umbrella.ok) throw new Error(umbrella.error);
    const afterUmbrella = JSON.parse(umbrella.json);
    const planter = placeV2AdditiveAsset(afterUmbrella, "add planter", [], []);
    expect(planter.ok).toBe(true);
    if (!planter.ok) throw new Error(planter.error);
    const final = JSON.parse(planter.json);

    expect(final.architecturalDesignDocument).toEqual(architecture);
    expect(final.sitePlan).toEqual(sitePlan);
    expect(final.outdoorAssetPlacements).toHaveLength(4);
    const placedLoungers = final.outdoorAssetPlacements.filter((p: { assetId: string }) => p.assetId === badPivotLounger.id);
    expect(placedLoungers).toHaveLength(2);
    for (const p of placedLoungers) {
      // y is the final model-origin transform: the deliberately below-origin geometry lands at grade.
      expect(p.position[1]).toBeCloseTo(.4);
      expect(p.localBounds).toEqual(badPivotLounger.validation!.bounds);
      expect(p.support).toEqual({ kind: "terrain", elevation: 0 });
      expect(p.relationship).toEqual({ type: "around", targetId: "pool" });
    }
    expect(final.outdoorAssetPlacements.slice(0, 2)).toEqual(reloaded.outdoorAssetPlacements);
  });

  it("refuses a legacy V2 project without canonical persisted Site Plan anchors", () => {
    const result = placeV2AdditiveAsset({ architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, decks: [{ x: 0, z: 16, width: 12, depth: 8 }] }, "add planter", [], []);
    expect(result).toMatchObject({ ok: false, code: "NO_VALID_SITE_PLAN" });
  });

  it("uses transformed bounds for a rotated, non-unit-scale model with an off-ground pivot", () => {
    const bounds = placementBounds({ id: "outdoor-bounds", assetId: "bad", parentSpaceId: "test", category: "furniture", role: "test", position: [10, 1.2, 20], rotation: [0, Math.PI / 2, 0], scale: 1.5, dimensions: { width: 3, depth: 1.5, height: 1.5 }, localBounds: { min: [-1, -.8, -.5], max: [1, .2, .5] }, support: { kind: "deck", elevation: 0 } });
    // The local bottom (-.8), transformed by scale, sits on y=0; rotation swaps x/z extents.
    expect(bounds.y).toBeCloseTo(0);
    expect(bounds.h).toBeCloseTo(1.5);
    expect(bounds.w).toBeCloseTo(1.5);
    expect(bounds.d).toBeCloseTo(3);
  });
});
