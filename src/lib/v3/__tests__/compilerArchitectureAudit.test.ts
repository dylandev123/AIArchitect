import { describe, expect, it } from "vitest";
import { ingestV3GenerationOutput } from "../ingestion";
import { buildV3TerrainSurface, compileV3Scene, validateV3CompiledGeometry } from "../scene";
import { primitivesBounds } from "../presentation";
import { resolveV3Renderable } from "../renderability";
import { getTerrainY } from "../elevation";

const object = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, architecture: { x: 0, z: 0, baseElevation: 0, width: 10, depth: 6, height: 3 }, material: { id: "stone", color: "#aaaaaa" }, ...extra });
const compile = (...objects: ReturnType<typeof object>[]) => {
  const prepared = ingestV3GenerationOutput({ version: 3, site: { width: 50, depth: 50 }, objects });
  expect(prepared.ok, JSON.stringify(prepared.validation.errors)).toBe(true);
  return { ...prepared, model: compileV3Scene(prepared.scene) };
};

describe("V3 architectural compiler audit invariants", () => {
  it("bounds ambitious floors to height and never emits non-positive construction parts", () => {
    for (const height of [.01, .2, 3, 6]) {
      const { model, scene } = compile(object("mass", "building-mass", { levels: 100, facadePreset: "punched", architecture: { x: 0,z: 0,baseElevation: 0,width: .1,depth: .15,height } }));
      expect(model.primitives.filter((p) => p.kind === "box").every((p) => p.kind !== "box" || p.size.every((size) => size > 0))).toBe(true);
      expect(validateV3CompiledGeometry(scene, model, { lenient: true }).ok).toBe(true);
    }
  });

  it("keeps every construction capability finite and positive for very small semantic envelopes", () => {
    const types = ["building-mass", "roof-form", "pool", "balcony", "terrace", "courtyard", "landscape-zone", "planter", "glass-wall", "window-band", "column-line", "railing-run", "canopy", "path", "retaining-wall", "fence", "stair", "ramp"];
    for (const type of types) {
      const { scene, model } = compile(object("tiny", type, { architecture: { x: 0,z: 0,baseElevation: 0,width: .1,depth: .1,height: .1 } }));
      expect(model.primitives.some((p) => p.sourceObjectId === "tiny"), type).toBe(true);
      expect(validateV3CompiledGeometry(scene, model, { lenient: true }).errors, type).toEqual([]);
    }
  });

  it("privacy glazing occupies an actual wall opening with a hollow frame", () => {
    // Semantic ids: `mass:north-*:level-0:*` (opening parts) and `mass:north:level-0:wall*` (solid spans).
    const northGroundFloor = (id: string) => /^mass:north[^:]*:level-0:/.test(id);
    const { model } = compile(object("mass", "building-mass", { facadePreset: "privacy" }));
    const glass = model.primitives.find((p) => northGroundFloor(p.id) && p.componentRole === "facade glazing");
    expect(glass?.kind).toBe("box");
    const walls = model.primitives.filter((p) => northGroundFloor(p.id) && p.componentRole === "facade wall");
    if (glass?.kind === "box") for (const wall of walls) if (wall.kind === "box") {
      const intersects = Math.abs(wall.position[0] - glass.position[0]) < (wall.size[0] + glass.size[0]) / 2 - 1e-8 && Math.abs(wall.position[1] - glass.position[1]) < (wall.size[1] + glass.size[1]) / 2 - 1e-8;
      expect(intersects).toBe(false);
    }
    expect(model.primitives.filter((p) => northGroundFloor(p.id) && p.componentRole === "glazing frame").length).toBe(model.primitives.filter(p => northGroundFloor(p.id) && p.componentRole === "facade glazing").length * 4);
  });

  it("explicit hosted roofing replaces the mass's implicit roof", () => {
    const { model } = compile(object("mass", "building-mass"), object("cover", "roof-form", { hostId: "mass", architecture: { x: 0,z: 0,baseElevation: 3,width: 10,depth: 6,height: .3 } }));
    expect(model.primitives.some((p) => p.id === "mass-roof-plate")).toBe(false);
    expect(model.primitives.some((p) => p.sourceObjectId === "cover" && p.category === "roof")).toBe(true);
  });

  it("rotates water with its pool and keeps it horizontal", () => {
    const { model } = compile(object("pool", "pool", { architecture: { x: 0,z: 0,baseElevation: -1,width: 10,depth: 2,height: 1,rotationY: Math.PI/2 } }));
    const water = model.primitives.find((p) => p.id === "pool-water")!;
    const bounds = primitivesBounds([water])!;
    expect(bounds.max[0] - bounds.min[0]).toBeCloseTo(1.6);
    expect(bounds.max[2] - bounds.min[2]).toBeCloseTo(9.6);
    expect(bounds.max[1]).toBe(bounds.min[1]);
  });

  it("builds a hollow pool with inset water above the bottom and below the rim", () => {
    const { model } = compile(object("pool", "pool", { architecture: { x: 0,z: 0,baseElevation: -1.4,width: 10,depth: 6,height: 1.4 } }));
    const water = model.primitives.find((p) => p.id === "pool-water")!;
    const waterBounds = primitivesBounds([water])!;
    const bottom = model.primitives.find((p) => p.id === "pool-basin")!;
    expect(waterBounds.min[1]).toBeGreaterThan(primitivesBounds([bottom])!.max[1]);
    expect(waterBounds.max[1]).toBeLessThan(0);
    const shells = model.primitives.filter((p) => p.componentRole === "pool shell");
    expect(shells).toHaveLength(4);
    for (const shell of shells) {
      const bounds = primitivesBounds([shell])!;
      const coversWaterCenter = bounds.min[0] < 0 && bounds.max[0] > 0 && bounds.min[2] < 0 && bounds.max[2] > 0;
      expect(coversWaterCenter).toBe(false);
    }
  });

  it("samples the same bearing-pad terrain for support and rendered vertices", () => {
    const { scene } = compile(object("pad", "slab", { architecture: { x: 0,z: 0,baseElevation: 3,width: 10,depth: 6,height: .25 } }));
    const terrain = buildV3TerrainSurface(scene);
    expect(terrain.heightAt(0,0)).toBe(3);
    for (const [x,z] of [[0,0],[4,2],[5.5,0],[7,0],[12,12]]) expect(getTerrainY(x,z,scene)).toBeCloseTo(terrain.heightAt(x,z));
    for (let i = 0; i < terrain.vertices.length; i += 333) {
      expect(terrain.vertices[i+1]).toBeCloseTo(getTerrainY(terrain.vertices[i],terrain.vertices[i+2],scene));
    }
  });

  it("does not grow terrain through a building to support an upper slab with omitted host metadata", () => {
    const { scene } = compile(object("mass", "volume"), object("upper", "slab", { architecture: { x: 0,z: 0,baseElevation: 3.4,width: 12,depth: 8,height: .25 } }));
    const upper = scene.objects.find((o) => o.id === "upper")!;
    delete upper.support;
    delete upper.hostId;
    expect(getTerrainY(0,0,scene)).toBeCloseTo(0);
    expect(buildV3TerrainSurface(scene).heightAt(0,0)).toBeCloseTo(0);
  });

  it("stairs derive all steps from semantic rise/run and retain authored identity", () => {
    const { model } = compile(object("stairs", "stair"));
    const steps = model.primitives.filter((p) => p.sourceObjectId === "stairs");
    expect(steps.length).toBeGreaterThan(10);
    const bounds = primitivesBounds(steps)!;
    expect(bounds.min[1]).toBeCloseTo(0);
    expect(bounds.max[1]).toBeCloseTo(3);
  });

  it("incomplete specialist metadata and new nouns still produce identified geometry", () => {
    const { scene, model } = compile(object("incomplete", "terrain-region"), object("new-intent", "future-semantic-intent"));
    for (const authored of scene.objects) {
      expect(resolveV3Renderable(authored).strategy).toBe("generic");
      expect(model.primitives.some((p) => p.sourceObjectId === authored.id)).toBe(true);
    }
  });

  it("uses long-axis ridges for rectangular hip roofs with realistic pitch bounds", () => {
    const { model } = compile(object("roof", "roof-form", { roofForm: "hip", pitch: 89, architecture: { x: 0,z: 0,baseElevation: 3,width: 12,depth: 4,height: .3 } }));
    const roof = model.primitives.find((p) => p.sourceObjectId === "roof")!;
    expect(primitivesBounds([roof])!.max[1]).toBeLessThan(10);
    if (roof.kind === "triMesh") {
      const maxY = Math.max(...roof.vertices.filter((_, i) => i % 3 === 1));
      const ridgeX = new Set(roof.vertices.filter((_, i) => i % 3 === 0 && Math.abs(roof.vertices[i+1]-maxY) < 1e-8));
      expect(ridgeX.size).toBeGreaterThan(1);
    }
  });
});
