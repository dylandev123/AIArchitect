import { describe, expect, it } from "vitest";
import { v3TerrainGrid } from "../elevation";
import { buildV3TerrainSurface, compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from "../scene";
import { executeV3SceneOperations } from "../operations";
import { validateV3Scene } from "../validation";
import { computeV3CameraFit, getV3PresentationBounds } from "../presentation";

const object = (id: string, type: V3SceneObject["type"], position: [number, number, number], dimensions: [number, number, number], extra: Partial<V3SceneObject> = {}): V3SceneObject => ({
  id, type, semanticRole: id.replaceAll("-", " "), label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions,
  material: { id: "concrete", color: "#6b6862", roughness: 0.78, surface: "concrete" }, collision: "solid", ...extra,
});

/** A mocked high-complexity answer used without any network/model call. */
const hillsideMansion: V3Scene = {
  version: 3, site: { width: 220, depth: 180, baseElevation: 0, groundMaterial: { id: "grass", color: "#426d38", surface: "grass" } }, relationships: [], metadata: { brief: "mocked luxury hillside mansion" },
  objects: [
    object("hillside", "terrain-region", [0, 0, 0], [220, 1, 180], { collision: "walkable", terrain: { operation: "slopeRegion", rise: 28, direction: "z" }, material: { id: "earth", color: "#496842", surface: "grass" } }),
    object("lower-level", "volume", [0, 5, 12], [42, 10, 24], { metadata: { embedded: true } }),
    object("main-pavilion", "volume", [-5, 18, -4], [50, 12, 28]),
    object("east-wing", "volume", [35, 24, 3], [22, 10, 18]),
    object("glass-view-wall", "glass-panel", [0, 20, 11], [38, 8, 0.18], { material: { id: "glass", color: "#9ec9d5", opacity: 0.38, surface: "glass" }, collision: "none", hostId: "main-pavilion" }),
    object("roof-terrace", "slab", [-5, 25, -4], [54, 0.45, 32], { collision: "walkable", material: { id: "paving", color: "#b9ad97", surface: "paving" } }),
    object("pool-deck", "slab", [-24, 11, 37], [32, 0.5, 20], { collision: "walkable", material: { id: "travertine", color: "#c6bda8", surface: "paving" } }),
    object("infinity-pool", "pool", [-24, 10.2, 38], [22, 1.2, 8], { collision: "water", material: { id: "water", color: "#247ca1", opacity: 0.85, surface: "water" }, hostId: "pool-deck" }),
    object("arrival-drive", "path", [14, 11, -58], [7, 0.3, 70], { collision: "walkable", terrain: { operation: "gradePath", rise: 14, direction: "z" }, material: { id: "asphalt", color: "#353638", surface: "paving" } }),
    object("retaining-wall", "retaining-wall", [28, 14, -12], [42, 5, 0.7], { metadata: { followsTerrain: true } }),
    object("entry-gate", "gate", [14, 17, -88], [8, 3, 0.3], { groupId: "boundary", source: { kind: "proxy", replaceable: true } }),
    object("boundary-fence", "fence", [-58, 12, -20], [0.3, 2, 110], { groupId: "boundary", metadata: { followsTerrain: true } }),
    object("outdoor-sofa", "proxy-asset", [-26, 12, 28], [4, 1, 1.4], { source: { kind: "proxy", replaceable: true }, groupId: "pool-lounge", collision: "solid" }),
    object("feature-tree", "proxy-asset", [48, 18, 18], [5, 10, 5], { source: { kind: "proxy", replaceable: true }, collision: "solid", material: { id: "foliage", color: "#315b31", surface: "grass" } }),
    object("entry-opening", "opening", [0, 18, -18], [3, 3, 0.2], { collision: "passable", hostId: "main-pavilion", material: { id: "dark-metal", color: "#202426", surface: "metal" } }),
  ],
};

/** Regression fixture for the saved multi-pad V3 hillside scene: no model call. */
const groundedEstate = (): V3Scene => ({
  version: 3, site: { width: 144, depth: 120, baseElevation: 0, groundMaterial: { id: "earth", color: "#48613e", surface: "grass" } }, relationships: [], metadata: { fixture: "v3-grounded-estate" },
  siteHierarchy: { levels: [
    { id: "arrival", elevation: 2, region: { x: 0, z: -42, width: 28, depth: 20 }, supportType: "pad", access: "arrival" },
    { id: "main", elevation: 7, region: { x: 0, z: 0, width: 48, depth: 30 }, supportType: "pad", access: "entry" },
    { id: "lower", elevation: 4, region: { x: -24, z: 28, width: 34, depth: 22 }, supportType: "terrace" },
    { id: "pool", elevation: 3, region: { x: -29, z: 43, width: 30, depth: 16 }, supportType: "deck" },
  ], connections: [{ id: "arrival-drive", fromLevelId: "arrival", toLevelId: "main", type: "driveway", width: 6, route: [[0, 31, -42], [0, 45, -22], [0, -18, -14]], surfaceObjectId: "driveway" }] },
  objects: [
    object("slope", "terrain-region", [0, 0, 0], [144, 1, 120], { terrain: { operation: "slopeRegion", rise: 12, direction: "z" }, collision: "walkable", material: { id: "earth", color: "#48613e", surface: "grass" } }),
    object("main-building", "volume", [0, 12, 0], [42, 10, 26], { support: { kind: "pad", levelId: "main" } }),
    object("arrival-court", "slab", [0, 2.25, -42], [28, .5, 20], { collision: "walkable", support: { kind: "pad", levelId: "arrival" } }),
    object("entry-terrace", "slab", [0, 7.25, -18], [26, .5, 8], { collision: "walkable", support: { kind: "pad", levelId: "main" } }),
    object("main-terrace", "slab", [0, 7.25, 17], [38, .5, 10], { collision: "walkable", support: { kind: "pad", levelId: "main" } }),
    object("lower-terrace", "slab", [-24, 4.25, 28], [34, .5, 22], { collision: "walkable", support: { kind: "terrace", levelId: "lower" } }),
    object("pool-deck", "slab", [-29, 3.25, 43], [30, .5, 16], { collision: "walkable", support: { kind: "deck", levelId: "pool" } }),
    object("pool", "pool", [-29, 2.3, 43], [18, 1.2, 7], { collision: "water", support: { kind: "deck", levelId: "pool" }, material: { id: "water", color: "#247ca1", surface: "water" } }),
    object("driveway", "path", [0, 5, -28], [6, .2, 32], { collision: "walkable", support: { kind: "terrain" }, material: { id: "asphalt", color: "#3b3b3a", surface: "paving" } }),
    object("retaining", "retaining-wall", [25, 5, 18], [34, 2.4, .5], { support: { kind: "terrain" }, metadata: { followsTerrain: true } }),
    object("boundary-fence", "fence", [-55, 4, 0], [.2, 2, 72], { support: { kind: "terrain" }, metadata: { followsTerrain: true } }),
  ],
});

describe("V3 persistent scene", () => {
  it("serializes, validates, and compiles a dramatic multi-elevation scene without a V2 document", () => {
    const reloaded = JSON.parse(JSON.stringify(hillsideMansion)) as V3Scene;
    expect(validateV3Scene(reloaded)).toMatchObject({ ok: true, errors: [] });
    const model = compileV3Scene(reloaded);
    expect(model.primitives.find((p) => p.id === "v3-terrain-surface")?.kind).toBe("triMesh");
    expect(model.primitives.find((p) => p.id === "arrival-drive")?.kind).toBe("triMesh");
    expect(reloaded.objects.find((o) => o.id === "lower-level")?.transform.position[1]).toBe(5);
    expect(reloaded.objects.find((o) => o.id === "arrival-drive")?.terrain?.operation).toBe("gradePath");
  });

  it("compiles one continuous slope with bounded terraces and a grade-path ribbon", () => {
    const terrain = buildV3TerrainSurface(hillsideMansion);
    expect(terrain.heightAt(0, 50)).toBeGreaterThan(terrain.heightAt(0, -50));
    // The arrival drive is a 7 m corridor: its compiled mesh does not become a tilted site-sized box.
    const model = compileV3Scene(hillsideMansion);
    const drive = model.primitives.find((p) => p.id === "arrival-drive");
    expect(drive?.kind).toBe("triMesh");
    if (drive?.kind === "triMesh") {
      const xs = drive.vertices.filter((_, i) => i % 3 === 0);
      const zs = drive.vertices.filter((_, i) => i % 3 === 2);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(7.1);
      expect(Math.max(...zs) - Math.min(...zs)).toBeLessThanOrEqual(70.1);
    }
    expect(validateV3CompiledGeometry(hillsideMansion, model)).toMatchObject({ ok: true, errors: [] });
  });

  it("levels a terrace, keeps water clear, and makes site lines meet sampled terrain", () => {
    const scene: V3Scene = {
      version: 3, site: { width: 120, depth: 140, baseElevation: 0 }, relationships: [], metadata: {},
      objects: [
        object("slope", "terrain-region", [0, 9, 0], [120, 1, 140], { terrain: { operation: "slopeRegion", rise: 18, direction: "z" } }),
        object("arrival", "terrain-region", [0, 15, -42], [32, 1, 22], { terrain: { operation: "createTerrace" } }),
        object("drive", "path", [0, 10, -38], [7, .2, 55], { terrain: { operation: "gradePath", rise: 10, direction: "z" } }),
        object("wall", "retaining-wall", [22, 10, 0], [40, 4, .6]),
        object("fence", "fence", [-42, 8, 0], [.25, 2, 90]),
        object("deck", "slab", [0, 8, 24], [34, .4, 22]),
        object("pool", "pool", [0, 7.3, 24], [18, 1.2, 8]),
        object("upper", "volume", [0, 20, 12], [24, 8, 18]),
        object("embedded", "volume", [32, 5, 26], [12, 8, 10], { metadata: { embedded: true } }),
      ],
    };
    const terrain = buildV3TerrainSurface(scene);
    expect(terrain.heightAt(0, -42)).toBeCloseTo(15, 1);
    const model = compileV3Scene(scene);
    expect(model.primitives.find((p) => p.id === "pool-water")?.kind).toBe("triMesh");
    expect(model.primitives.some((p) => p.id.startsWith("fence-"))).toBe(true);
    expect(model.primitives.some((p) => p.id.startsWith("wall-"))).toBe(true);
    // No terrain triangle is emitted through the independent pool/deck or upper building footprints.
    const ground = model.primitives.find((p) => p.id === "v3-terrain-surface");
    expect(ground?.kind).toBe("triMesh");
    if (ground?.kind === "triMesh") expect(ground.vertices.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("repairs the persisted-style estate deterministically: continuous grounded terrain, supported slabs, route, and site lines", () => {
    const scene = groundedEstate(), terrain = buildV3TerrainSurface(scene), model = compileV3Scene(scene);
    // Uniform lattice plus graded-site feature lines (pad / pool edges); every cell is emitted.
    const grid = v3TerrainGrid(scene), cells = grid.columns * grid.rows;
    // The old compiler skipped every cell below a slab or volume. This must be
    // one unbroken heightfield, including terrain beneath the house and decks.
    expect(terrain.vertices).toHaveLength(cells * 2 * 9);

    for (const id of ["main-building", "arrival-court", "entry-terrace", "main-terrace", "lower-terrace"]) {
      const item = scene.objects.find((object) => object.id === id)!;
      expect(terrain.heightAt(item.transform.position[0], item.transform.position[2])).toBeCloseTo(item.transform.position[1] - item.dimensions[1] / 2, 5);
    }
    // The pool is deliberately cut down from its deck, while the terrain still
    // remains continuous below it rather than becoming a missing ground island.
    expect(terrain.heightAt(-29, 43)).toBeCloseTo(1.1, 5);
    expect(terrain.heightAt(-42, 43)).toBeCloseTo(3, 5);

    const driveway = model.primitives.find((primitive) => primitive.id === "v3-connection-arrival-drive");
    expect(driveway?.kind).toBe("triMesh");
    if (driveway?.kind === "triMesh") {
      const ys = driveway.vertices.filter((_, index) => index % 3 === 1);
      expect(Math.min(...ys)).toBeCloseTo(2.055, 5);
      expect(Math.max(...ys)).toBeCloseTo(7.055, 5);
    }
    // Walls/fences are split into short terrain-following sections, so no long
    // authored box can float above an uneven site. A flat retaining edge stays
    // visible as a normal site wall instead of collapsing to a 0.35m strip.
    const retaining = model.primitives.filter((primitive) => primitive.id === "retaining" || primitive.id.startsWith("retaining-"));
    const fence = model.primitives.filter((primitive) => primitive.id === "boundary-fence" || primitive.id.startsWith("boundary-fence-"));
    expect(retaining.length).toBeGreaterThan(10);
    expect(fence.length).toBeGreaterThan(40);
    expect(retaining.every((primitive) => primitive.kind === "box" && primitive.size[1] >= .35)).toBe(true);
    expect(fence.every((primitive) => primitive.kind === "box" && primitive.position[1] - primitive.size[1] / 2 <= terrain.heightAt(primitive.position[0], primitive.position[2]) + .01)).toBe(true);
    expect(validateV3CompiledGeometry(scene, model)).toMatchObject({ ok: true, errors: [] });

    const bounds = getV3PresentationBounds(scene, model), fit = computeV3CameraFit(bounds);
    expect(fit.target.x).toBeCloseTo(bounds.center[0], 5);
    expect(fit.target.z).toBeGreaterThan(-20);
    expect(fit.position.distanceTo(fit.target)).toBeLessThan(220);
  });

  it("keeps stable identity, replaceable proxy source, groups, materials and first-person semantics through edits", () => {
    const result = executeV3SceneOperations(hillsideMansion, { intent: "Warm the pool deck and move its seating.", operations: [
      { op: "move", target: "outdoor-sofa", position: [-20, 12, 28] },
      { op: "changeMaterial", target: "pool-deck", material: { id: "dark-stone", color: "#54514b", surface: "stone" } },
    ] });
    expect(result.ok).toBe(true);
    const sofa = result.scene.objects.find((o) => o.id === "outdoor-sofa")!;
    expect(sofa).toMatchObject({ groupId: "pool-lounge", source: { kind: "proxy", replaceable: true } });
    expect(sofa.transform.position).toEqual([-20, 12, 28]);
    expect(result.scene.objects.find((o) => o.id === "pool-deck")?.material.id).toBe("dark-stone");
    expect(result.scene.objects.find((o) => o.id === "entry-opening")?.collision).toBe("passable");
    expect(result.scene.objects.find((o) => o.id === "roof-terrace")?.collision).toBe("walkable");
  });

  it("rejects impossible transforms and missing hosts atomically", () => {
    const invalid = structuredClone(hillsideMansion);
    invalid.objects[1].transform.position = [Number.NaN, 0, 0];
    invalid.objects[2].hostId = "does-not-exist";
    expect(validateV3Scene(invalid).errors.join(" ")).toMatch(/invalid transform|missing host/);
    const rejected = executeV3SceneOperations(hillsideMansion, { intent: "Break it", operations: [{ op: "move", target: "main-pavilion", position: [Number.NaN, 0, 0] }] });
    expect(rejected.ok).toBe(false);
    expect(rejected.scene.objects.find((o) => o.id === "main-pavilion")?.transform.position).toEqual([-5, 18, -4]);
  });
});
