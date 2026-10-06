import { describe, expect, it } from "vitest";
import { buildV3TerrainSurface, compileV3Scene, type V3Scene, type V3SceneObject } from "../scene";
import { auditV3SiteHierarchy, normalizeConnectionRoute, routeGrade } from "../siteHierarchy";
import { v3SceneOutputSchema } from "../schema";
import { toGenerationOutput } from "./generationFixture";
import { validateV3Scene } from "../validation";

const object = (id: string, type: V3SceneObject["type"], position: [number, number, number], dimensions: [number, number, number], support?: V3SceneObject["support"]): V3SceneObject => ({
  id, type, semanticRole: id, label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions,
  material: { id: "stone", color: "#827a6f", surface: "stone" }, collision: type === "slab" ? "walkable" : "solid", ...(support ? { support } : {}),
});

/** Mocked, persistent fixture: no provider request is made in this test. */
const hillsideEstate = (): V3Scene => ({
  version: 3, site: { width: 150, depth: 150, baseElevation: 0 }, metadata: {}, relationships: [],
  siteHierarchy: {
    levels: [
      { id: "entry", elevation: 0, region: { x: 0, z: -68, width: 30, depth: 20 }, supportType: "terrain", access: "entry" },
      { id: "arrival", elevation: 12, region: { x: 0, z: -32, width: 36, depth: 24 }, supportType: "pad", access: "arrival" },
      { id: "main", elevation: 10, region: { x: 0, z: 4, width: 50, depth: 24 }, supportType: "pad" },
      { id: "lower", elevation: 4, region: { x: 0, z: 25, width: 40, depth: 16 }, supportType: "pad" },
      { id: "pool", elevation: 3, region: { x: -26, z: 42, width: 34, depth: 20 }, supportType: "terrace" },
      { id: "garden", elevation: 0, region: { x: 0, z: 62, width: 58, depth: 22 }, supportType: "terrain" },
    ],
    connections: [
      { id: "uphill-drive", fromLevelId: "entry", toLevelId: "arrival", type: "driveway", width: 6, maxGrade: .15, route: [[0, 0, -72], [22, 2.4, -57], [-22, 8.4, -45], [0, 12, -32]] },
      { id: "arrival-walk", fromLevelId: "arrival", toLevelId: "main", type: "path", width: 2, route: [[0, 12, -21], [0, 10, -8]] },
      { id: "main-stair", fromLevelId: "main", toLevelId: "lower", type: "stair", width: 2, route: [[0, 10, 16], [0, 4, 20]] },
      { id: "pool-walk", fromLevelId: "lower", toLevelId: "pool", type: "path", width: 2, route: [[-12, 4, 32], [-20, 3.5, 37], [-26, 3, 42]] },
      { id: "garden-walk", fromLevelId: "pool", toLevelId: "garden", type: "stair", width: 2, route: [[-26, 3, 52], [-12, 1.5, 58], [0, 0, 62]] },
    ],
    transitions: [{ id: "main-retain", fromLevelId: "main", toLevelId: "lower", type: "retaining-edge", objectId: "retaining" }],
  },
  objects: [
    object("main-house", "volume", [0, 16, 4], [38, 12, 18], { kind: "pad", levelId: "main" }),
    { ...object("lower-house", "volume", [0, 8, 25], [30, 8, 12], { kind: "pad", levelId: "lower", grounding: "embedded" }), metadata: { embedded: true } },
    object("pool-deck", "slab", [-26, 3.25, 42], [34, .5, 20], { kind: "terrace", levelId: "pool" }),
    object("pool", "pool", [-26, 4, 42], [19, 2, 8], { kind: "terrace", levelId: "pool" }),
    object("retaining", "retaining-wall", [0, 1.5, 16.49], [30, 3, .6], { kind: "terrain" }),
    object("tree", "proxy-asset", [42, 5, 30], [4, 10, 4], { kind: "terrain" }),
    object("fence", "fence", [-55, 1, 0], [.3, 2, 80], { kind: "terrain" }),
    object("cantilever", "slab", [28, 13, 4], [8, .5, 5], { kind: "deck", grounding: "cantilevered" }),
  ],
});

describe("V3 site hierarchy", () => {
  it("grounds a stepped hillside estate, compiles continuous switchback access, and survives save/reload", () => {
    const scene = JSON.parse(JSON.stringify(hillsideEstate())) as V3Scene;
    const terrain = buildV3TerrainSurface(scene), audit = auditV3SiteHierarchy(scene, terrain.heightAt), model = compileV3Scene(scene);
    expect(v3SceneOutputSchema.safeParse(toGenerationOutput(scene)).success).toBe(true);
    expect(audit.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(validateV3Scene(scene)).toMatchObject({ ok: true, errors: [] });
    expect(model.primitives.some((primitive) => primitive.id === "v3-connection-uphill-drive")).toBe(true);
    expect(model.primitives.some((primitive) => primitive.id === "v3-connection-pool-walk")).toBe(true);
    expect(terrain.heightAt(0, 4)).toBeCloseTo(10, 1);
    expect(terrain.heightAt(0, 25)).toBeCloseTo(4, 1);
  });

  it("reports objective site failures with stable, repairable codes", () => {
    const scene = hillsideEstate();
    scene.siteHierarchy!.connections[0].route = [[0, 0, -68], [0, 12, -32]]; // 12m over 36m is too steep for a driveway.
    scene.siteHierarchy!.connections = scene.siteHierarchy!.connections.filter((connection) => connection.id !== "pool-walk");
    scene.objects.find((item) => item.id === "pool-deck")!.transform.position[1] = 9;
    scene.objects.find((item) => item.id === "fence")!.transform.position[1] = 4;
    scene.siteHierarchy!.transitions![0] = { ...scene.siteHierarchy!.transitions![0], fromLevelId: "lower", toLevelId: "lower" };
    const issues = auditV3SiteHierarchy(scene, buildV3TerrainSurface(scene).heightAt);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["DRIVEWAY_GRADE_TOO_STEEP", "DISCONNECTED_SITE_LEVEL", "UNRESOLVED_SUPPORT", "RETAINING_EDGE_NO_GRADE_DIFFERENCE"]));
  });

  it("keeps Terra's authored 3D driveway profile and grades each segment from Y over X/Z travel", () => {
    const scene = hillsideEstate();
    const drive = scene.siteHierarchy!.connections[0];
    delete drive.maxGrade;
    drive.route = [[0, 6, 18], [5, 7.8, 30], [0, 9.6, 43], [0, 12, 54]];
    scene.siteHierarchy!.levels[0] = { ...scene.siteHierarchy!.levels[0], elevation: 6, region: { x: 0, z: 18, width: 30, depth: 20 } };
    scene.siteHierarchy!.levels[1] = { ...scene.siteHierarchy!.levels[1], elevation: 12, region: { x: 0, z: 54, width: 36, depth: 24 } };
    expect(v3SceneOutputSchema.safeParse(toGenerationOutput(scene)).success).toBe(true);
    expect(routeGrade(normalizeConnectionRoute(drive, scene.siteHierarchy!.levels))).toBeCloseTo(2.4 / 11, 8);
    const routeOnly: V3Scene = { ...scene, objects: [], relationships: [], siteHierarchy: { levels: scene.siteHierarchy!.levels.slice(0, 2), connections: [drive] } };
    expect(validateV3Scene(routeOnly)).toMatchObject({ ok: true, errors: [] });
    const compiled = compileV3Scene(scene).primitives.find((primitive) => primitive.id === "v3-connection-uphill-drive");
    expect(compiled?.kind).toBe("triMesh");
    if (compiled?.kind === "triMesh") expect(compiled.vertices.some((value) => Math.abs(value - 7.855) < 1e-9)).toBe(true);
  });

  it("normalizes old persisted [x, z] routes once at the runtime boundary and keeps stairs vertical", () => {
    const scene = hillsideEstate();
    const legacy = scene.siteHierarchy!.connections[2];
    legacy.route = [[0, 16], [0, 20]];
    const normalized = normalizeConnectionRoute(legacy, scene.siteHierarchy!.levels);
    expect(normalized).toEqual([[0, 10, 16], [0, 4, 20]]);
    expect(validateV3Scene(scene)).toMatchObject({ ok: true, errors: [] });
    expect(compileV3Scene(scene).primitives.some((primitive) => primitive.id === "v3-connection-main-stair")).toBe(true);
  });

  it("requires exactly three values for every new generation route point", () => {
    const output = toGenerationOutput(hillsideEstate()) as unknown as Omit<V3Scene, "metadata">;
    const route = output.siteHierarchy!.connections[0].route;
    route[0] = [0] as never;
    expect(v3SceneOutputSchema.safeParse(output).success).toBe(false);
    route[0] = [0, 0, 0, 0] as never;
    expect(v3SceneOutputSchema.safeParse(output).success).toBe(false);
  });
});
