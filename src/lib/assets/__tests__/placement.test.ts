import { describe, expect, it } from "vitest";
import { fitScale, GLB_WIRED_CATEGORIES, placementsFromBuildings } from "../placement";

describe("placements from project buildings", () => {
  it("emits one per wired building that references an asset, keyed by array index", () => {
    const placements = placementsFromBuildings([
      { kind: "villa", x: 0, z: 0, width: 10, depth: 10, assetId: "ignored-not-wired" },
      { kind: "gazebo", x: 8, z: -3, width: 4, depth: 5, rotation: 90, assetId: "glb-1" },
      { kind: "gazebo", x: 1, z: 1, width: 4, depth: 4 }, // no asset: stays procedural
      { kind: "outdoor_bar", x: -6, z: 2, width: 6, depth: 3, assetId: "glb-2" },
    ]);
    expect(placements.map((p) => [p.featureId, p.assetId, p.category])).toEqual([
      ["building-1", "glb-1", "gazebo"],
      ["building-3", "glb-2", "outdoor-bar"],
    ]);
    expect(placements[0]).toMatchObject({ x: 8, z: -3, width: 4, depth: 5 });
    expect(placements[0].yaw).toBeCloseTo(Math.PI / 2);
  });

  it("keeps ids stable when an invalid entry is dropped before it", () => {
    const placements = placementsFromBuildings([{ nonsense: true }, { kind: "gazebo", x: 0, z: 0, width: 4, depth: 4, assetId: "g" }]);
    expect(placements.map((p) => p.featureId)).toEqual(["building-1"]);
  });

  it("wires only the kinds that have a procedural feature today", () => {
    expect([...GLB_WIRED_CATEGORIES].sort()).toEqual(["gazebo", "outdoor-bar"]);
  });
});

describe("fitting to physical dimensions", () => {
  it("scales the stored footprint to fit inside the feature's, keeping proportions", () => {
    expect(fitScale({ width: 6, depth: 6 }, { width: 4, depth: 4 })).toBeCloseTo(1.5);
    expect(fitScale({ width: 6, depth: 3 }, { width: 4, depth: 4 })).toBeCloseTo(0.75);
  });
  it("draws at natural size without a usable footprint and clamps extremes", () => {
    expect(fitScale({ width: 6, depth: 6 })).toBe(1);
    expect(fitScale({ width: 6, depth: 6 }, { width: 0, depth: 4 })).toBe(1);
    expect(fitScale({ width: 60, depth: 60 }, { width: 4, depth: 4 })).toBe(2.5);
    expect(fitScale({ width: 0.5, depth: 0.5 }, { width: 4, depth: 4 })).toBe(0.4);
  });
});
