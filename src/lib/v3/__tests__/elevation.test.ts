import { describe, expect, it } from "vitest";
import { getObjectBaseY, getObjectTopY, getSupportSurfaceY, getTerrainY, getWalkableSurfaceY, sampleFinalTerrainHeight } from "../elevation";
import { upgradeLegacyV3SiteHierarchy } from "../siteHierarchyMigration";
import type { V3Scene, V3SceneObject } from "../scene";

const object = (id: string, type: V3SceneObject["type"], position: [number, number, number], dimensions: [number, number, number], extra: Partial<V3SceneObject> = {}): V3SceneObject => ({
  id, type, semanticRole: id, label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions,
  material: { id: "stone", color: "#827a6f", surface: "stone" }, collision: "solid", ...extra,
});

/** Offline regression fixture for the reported multi-pad hillside save. */
const mansionElevationFailure = (): V3Scene => ({
  version: 3, site: { width: 180, depth: 140, baseElevation: 0 }, relationships: [], metadata: { fixture: "mansion-elevation-regression" }, objects: [
    object("hillside", "terrain-region", [0, 0, 0], [180, 1, 140], { terrain: { operation: "slopeRegion", rise: 8, direction: "z" }, collision: "walkable" }),
    object("arrival-court", "surface", [0, 15.25, -28], [30, .5, 16], { collision: "walkable" }),
    object("main-pavilion", "volume", [0, 14.5, 5], [46, 12, 24]), // base 8.50
    object("garage-pavilion", "volume", [42, 18.5, -24], [18, 10, 16]), // base 13.50
    object("pool-terrace", "slab", [-28, 10.13, 32], [34, .5, 20], { collision: "walkable" }), // base 9.88
    object("spa", "proxy-asset", [-28, 10.88, 32], [5, 1, 5], { hostId: "pool-terrace", source: { kind: "proxy", replaceable: true } }), // base 10.38; intentionally inset in deck
    object("upper-wing", "volume", [30, 11.8, 5], [18, 10, 16]), // top 16.80
    object("upper-slab", "slab", [30, 17.05, 5], [10, .5, 7], { collision: "walkable", hostId: "upper-wing" }), // base 16.80
    object("sky-bar", "proxy-asset", [0, 18.05, 5], [8, 1, 5], { source: { kind: "proxy", replaceable: true }, hostId: "upper-slab" }), // base 17.55
    object("driveway", "path", [0, 4, -52], [6, .2, 42], { collision: "walkable", terrain: { operation: "gradePath", rise: 6, direction: "z" } }),
    object("tree", "proxy-asset", [68, 5, 36], [4, 10, 4], { source: { kind: "proxy", replaceable: true } }),
    object("fence", "fence", [-74, 2, 0], [.2, 2, 100], { metadata: { followsTerrain: true } }),
    object("arrival-stair", "stair", [0, 11.75, -14], [3, 6.5, 16], { collision: "walkable" }),
  ],
});

describe("V3 canonical elevation contract", () => {
  it("uses centre transforms only to derive object base/top and never as a support surface", () => {
    const slab = object("slab", "slab", [0, 15.25, 0], [8, .5, 8], { collision: "walkable" });
    expect(getObjectBaseY(slab)).toBeCloseTo(15);
    expect(getObjectTopY(slab)).toBeCloseTo(15.5);
  });

  it("samples hierarchy pads as final terrain, rather than collapsing to the base datum", () => {
    const scene = mansionElevationFailure();
    scene.siteHierarchy = { levels: [
      { id: "terrain", elevation: 0, region: { x: 0, z: 40, width: 180, depth: 60 }, supportType: "terrain" },
      { id: "arrival", elevation: 15, region: { x: 0, z: -28, width: 30, depth: 16 }, supportType: "pad", access: "arrival" },
      { id: "main", elevation: 8.5, region: { x: 0, z: 5, width: 46, depth: 24 }, supportType: "pad", access: "entry" },
      { id: "pool", elevation: 9.88, region: { x: -28, z: 32, width: 34, depth: 20 }, supportType: "terrace" },
    ], connections: [] };
    const court = scene.objects.find((item) => item.id === "arrival-court")!;
    court.support = { kind: "pad", levelId: "arrival" };
    expect(sampleFinalTerrainHeight(0, -28, scene)).toBeCloseTo(15);
    expect(getTerrainY(0, 5, scene)).toBeCloseTo(8.5);
    expect(getSupportSurfaceY(court.support, 0, -28, scene)).toBeCloseTo(15);
    expect(getWalkableSurfaceY(court, 0, -28, scene)).toBeCloseTo(15.5);
  });

  it("migrates the offline hillside fixture with non-zero direct support surfaces and independent stair ends", () => {
    const result = upgradeLegacyV3SiteHierarchy(mansionElevationFailure());
    expect(result.ok, result.errors.join("\n")).toBe(true);
    const supportY = new Map(result.report.supportGraph.map((edge) => [edge.objectId, edge.directSupportSurfaceY]));
    expect(supportY.get("main-pavilion")).toBeCloseTo(8.5);
    expect(supportY.get("garage-pavilion")).toBeCloseTo(13.5);
    expect(supportY.get("pool-terrace")).toBeCloseTo(9.88);
    expect(supportY.get("spa")).toBeCloseTo(10.38);
    expect(result.scene.objects.find((item) => item.id === "spa")?.support?.objectId).toBe("pool-terrace");
    expect(result.report.supportGraph.some((edge) => edge.directSupportSurfaceY !== undefined && edge.directSupportSurfaceY !== 0)).toBe(true);
    expect(result.scene.objects.find((item) => item.id === "tree")?.support?.kind).toBe("terrain");
    expect(result.scene.objects.find((item) => item.id === "fence")?.metadata?.followsTerrain).toBe(true);
    expect(result.scene.siteHierarchy?.connections.some((connection) => connection.surfaceObjectId === "arrival-stair")).toBe(true);
  });
});
