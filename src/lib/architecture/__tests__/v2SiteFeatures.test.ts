import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { compileV2SiteFeatures, placeOutdoorBar } from "../v2SiteFeatures";
import { compileArchitecture } from "../compiler";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";

const plan = {
  entrance: { wall: "north" as const, offset: 6 }, driveway: { wall: "north" as const, offset: 2, width: 4, length: 12 },
  parking: [{ x: 0, z: -18, width: 6, depth: 6 }], pool: { wall: "south" as const, offset: 5, distance: 8, width: 8, depth: 4, waterDepth: 1.4 },
  terrace: { wall: "south" as const, offset: 3, width: 10, depth: 5 }, poolDeck: { x: 0, z: 16, width: 12, depth: 8 },
  paths: [
    { from: "arrival" as const, to: "parking" as const, x1: 0, z1: -30, x2: 0, z2: -18, width: 1.2, bend: 0, surface: "gravel" as const },
    { from: "parking" as const, to: "entrance" as const, x1: 0, z1: -18, x2: 0, z2: -8, width: 1.2, bend: 0, surface: "gravel" as const },
    { from: "entrance" as const, to: "outdoor-living" as const, x1: 0, z1: -8, x2: 0, z2: 8, width: 1.2, bend: 0, surface: "flagstone" as const },
    { from: "outdoor-living" as const, to: "pool" as const, x1: 0, z1: 8, x2: 0, z2: 16, width: 1.2, bend: 0, surface: "flagstone" as const },
  ],
  landscape: [{ purpose: "pool-planting" as const, kind: "garden" as const, x: 16, z: 16, width: 6, depth: 6 }, { purpose: "view-framing" as const, kind: "lawn" as const, x: -16, z: 16, width: 6, depth: 6 }],
};

describe("lightweight V2 Site Plan additions", () => {
  it("adds a grounded, collision-safe outdoor bar without changing existing V2 state", () => {
    const document = ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse;
    const root = { house: { width: 14, depth: 10, floors: 1, roof: "flat" }, architecturalDesignDocument: document, sitePlan: plan };
    const before = structuredClone(root);
    const placed = placeOutdoorBar(root, "approved-outdoor-bar");
    expect("error" in placed).toBe(false);
    if ("error" in placed) throw new Error(placed.error);

    expect(root).toEqual(before);
    expect(placed.plan.features).toHaveLength(1);
    expect(placed.feature.assetId).toBe("approved-outdoor-bar");
    expect(placed.feature.x).not.toBe(plan.poolDeck.x);
    expect(Math.abs(placed.feature.x - plan.poolDeck.x)).toBeGreaterThanOrEqual((plan.poolDeck.width + placed.feature.width) / 2 + 0.75);
    expect(placed.feature.z).toBeGreaterThan(0);
    expect(compileArchitecture(document, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives).toEqual(compileArchitecture(before.architecturalDesignDocument, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives);
    expect(compileV2SiteFeatures(placed.plan, DEFAULT_MATERIALS_CONFIG).every((p) => p.kind !== "box" || p.position[1] >= 0)).toBe(true);
  });
});
