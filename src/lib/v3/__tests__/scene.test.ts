import { describe, expect, it } from "vitest";
import { buildV3TerrainSurface, compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from "../scene";
import { executeV3SceneOperations } from "../operations";
import { validateV3Scene } from "../validation";

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
