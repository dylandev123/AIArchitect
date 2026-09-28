import { describe, expect, it } from "vitest";
import { Vector3, type SpotLight } from "three";
import { validateGlb } from "@/lib/assets/glbValidator";
import { assetHash, buildAsset, geometryHash, swapMaterials, type BuiltAsset } from "../build";
import { exportGlb } from "../glb";
import { repairSpec } from "../repair";
import { cleanLooseSpec, lightSchema, specOutputSchema, validateSpec, type AssetSpec } from "../spec";
import { STYLE_PROFILE } from "../styleProfile";
import { SAMPLES, floodlight, lantern } from "./fixtures";
import { DOWN, illuminate, irradiance, loadGlb, UP } from "./lighting";

const built = (spec: unknown): BuiltAsset => {
  const r = buildAsset(spec);
  if (!r.ok) throw new Error(r.error);
  return r.asset;
};
const unlit = (spec: AssetSpec): AssetSpec => ({ ...spec, light: undefined });
/**
 * The lantern with nothing glowing. (Lamps have a slot lit automatically when the model forgot: the one named like a bulb, else
 * glass. A plain "core" slot in a non-glass material is neither, so nothing glows.)
 */
const nothingGlows = (spec: AssetSpec): AssetSpec => ({
  ...spec,
  materials: [spec.materials[0], { key: "core", material: "stucco", color: "#ffe2a8" }],
  parts: spec.parts.map((p) => (p.material === "bulb" ? { ...p, material: "core" } : p)),
});
/** The parts of a glTF document these tests read. */
interface GltfJson {
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  extensions?: { KHR_lights_punctual: { lights: Record<string, unknown>[] } };
  nodes: { children?: number[]; extensions?: { KHR_lights_punctual?: { light: number } } }[];
  materials: { name: string; emissiveFactor?: number[] }[];
}
const gltfJson = (glb: ArrayBuffer): GltfJson => {
  const view = new DataView(glb);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, view.getUint32(12, true)))) as GltfJson;
};
const repaired = (light: unknown, over: Record<string, unknown> = {}) => {
  const r = repairSpec({ ...lantern, light, ...over });
  if (!r.ok) throw new Error(r.error);
  return r as { ok: true; spec: { light?: Record<string, unknown> }; notes: string[] };
};

describe("scene-light metadata: spec and repair", () => {
  it("accepts a point and a spot light on lamps", () => {
    for (const spec of [lantern, floodlight]) {
      const r = validateSpec(spec);
      expect(r.ok).toBe(true);
      expect(r.ok && r.spec.light).toEqual(spec.light);
    }
  });

  it("is optional: assets without one are unchanged, and an emissive lamp does not get one added", () => {
    const glowing = validateSpec(unlit(lantern));
    expect(glowing.ok && glowing.spec.light).toBeUndefined();
    const r = repairSpec({ ...SAMPLES.deckChair });
    expect(r.ok && (r.spec as Record<string, unknown>).light).toBeUndefined();
  });

  it("defaults a sparse spot, takes the colour from the glowing material, and says so", () => {
    const r = repaired({ type: "spot" });
    expect(r.spec.light).toMatchObject({ type: "spot", color: "#ffcf7a", intensity: 20, range: 10, coneAngle: STYLE_PROFILE.light.defaultConeAngle, direction: "down" });
    expect(r.notes.join(" ")).toMatch(/cone angle defaulted/);
    expect(r.notes.join(" ")).toMatch(/colour taken from the glowing material/);
  });

  it("brings intensity, range and cone into the profile's limits", () => {
    const L = STYLE_PROFILE.light;
    expect(repaired({ type: "spot", color: "#fff", intensity: 900, range: 400, coneAngle: 170 }).spec.light).toMatchObject({ color: "#ffffff", intensity: L.intensity.max, range: L.range.max, coneAngle: L.coneAngle.max });
    expect(repaired({ type: "point", color: "#fff", intensity: 0, range: 0 }).spec.light).toMatchObject({ intensity: L.intensity.min, range: L.range.min });
  });

  it("reads loose spellings, and ignores cone settings on a point light", () => {
    expect(repaired({ type: "SpotLight", direction: "downward" }).spec.light).toMatchObject({ type: "spot", direction: "down" });
    expect(repaired({ type: "torch" }).spec.light).toMatchObject({ type: "point" });
    const point = repaired({ type: "point", coneAngle: 40, direction: "up" });
    expect(point.spec.light).not.toHaveProperty("coneAngle");
    expect(point.spec.light).not.toHaveProperty("direction");
    expect(point.notes.join(" ")).toMatch(/Cone settings were ignored/);
  });

  it("drops a light from a family that is not a light fixture (the asset still builds)", () => {
    const r = repairSpec({ ...SAMPLES.deckChair, light: lantern.light });
    expect(r.ok && r.notes.join(" ")).toMatch(/only lamps and pendants carry one, not a deck-chair/);
    expect(buildAsset({ ...SAMPLES.deckChair, light: lantern.light }).ok).toBe(true);
    // ...and the strict check refuses a spec that reaches it anyway.
    const strict = validateSpec({ ...SAMPLES.deckChair, light: lantern.light });
    expect(strict.ok && strict.spec.light).toBeUndefined();
  });

  it("repairs idempotently", () => {
    const once = repaired({ type: "spot", intensity: 900 });
    const twice = repairSpec(once.spec);
    expect(twice.ok && (twice.spec as { light: unknown }).light).toEqual(once.spec.light);
    expect(twice.ok && twice.notes.filter((n) => /Scene light/.test(n))).toEqual([]);
  });

  it("the strict schema needs a cone on a spot", () => {
    expect(lightSchema.safeParse({ type: "spot", color: "#ffffff", intensity: 5, range: 5 }).success).toBe(false);
    expect(lightSchema.safeParse({ type: "point", color: "#ffffff", intensity: 5, range: 5 }).success).toBe(true);
  });

  it("travels through the loose model-output schema, nulls and all", () => {
    const loose = (light: unknown) => specOutputSchema.parse({ ...lantern, light, unsupported: null });
    expect(cleanLooseSpec(loose(null))).not.toHaveProperty("light");
    const clean = cleanLooseSpec(loose({ type: "point", color: null, intensity: 5, range: null, position: null, coneAngle: null, direction: null })) as { light: Record<string, unknown> };
    expect(clean.light).toEqual({ type: "point", intensity: 5 });
    expect(validateSpec(clean).ok).toBe(true);
  });
});

describe("scene-light placement", () => {
  it("puts the light where the spec says, through the same transform as the geometry", () => {
    const a = built(lantern);
    // The bulb (a sphere) is the centre of the part it was placed at, so the light sits at that sphere's centre.
    const bulb = a.meshes.find((m) => m.surface.key === "bulb")!.geometry.boundingBox!.getCenter(new Vector3());
    expect(a.light!.position[0]).toBeCloseTo(bulb.x, 3);
    expect(a.light!.position[1]).toBeCloseTo(bulb.y, 3);
    expect(a.light!.position[2]).toBeCloseTo(bulb.z, 3);
    expect(a.light).toMatchObject({ type: "point", color: "#ffcf7a", intensity: 8, range: 6 });
  });

  it("with no position, sits at the glowing part; with nothing glowing, near the top", () => {
    const { position, ...bare } = lantern.light!;
    void position;
    const a = built({ ...lantern, light: bare });
    const bulb = a.meshes.find((m) => m.surface.key === "bulb")!.geometry.boundingBox!.getCenter(new Vector3());
    expect(a.light!.position[1]).toBeCloseTo(bulb.y, 3);
    expect(a.notes).toContain("Scene light placed at the glowing part.");

    const dark = built({ ...nothingGlows(lantern), light: bare });
    expect(dark.light!.position[1]).toBeCloseTo(dark.size.height * 0.9, 3);
    expect(dark.notes.join(" ")).toMatch(/nothing glows to attach it to/);
  });

  it("pulls a light placed far outside the asset back to within 15 cm of it", () => {
    const a = built({ ...lantern, light: { ...lantern.light, position: [4, 9, -4] } });
    const { width, depth, height } = a.size;
    expect(a.light!.position[0]).toBeLessThanOrEqual(width / 2 + 0.15 + 1e-6);
    expect(a.light!.position[1]).toBeLessThanOrEqual(height + 0.15 + 1e-6);
    expect(a.light!.position[2]).toBeGreaterThanOrEqual(-depth / 2 - 0.15 - 1e-6);
    expect(a.notes).toContain("Scene light moved back to within 15 cm of the asset.");
  });

  it("changes no geometry: same hash, same triangles, same materials with or without the light", () => {
    const lit = built(lantern);
    const dark = built(unlit(lantern));
    expect(geometryHash(lit)).toBe(geometryHash(dark));
    expect(lit.triangles).toBe(dark.triangles);
    expect(lit.meshes.map((m) => m.surface)).toEqual(dark.meshes.map((m) => m.surface));
  });

  it("but versions that differ only in light or colour are different assets to the library", () => {
    const base = built(lantern);
    expect(assetHash(built(lantern))).toBe(assetHash(base));
    expect(assetHash(built({ ...lantern, light: { ...lantern.light, intensity: 12 } }))).not.toBe(assetHash(base));
    expect(assetHash(built(unlit(lantern)))).not.toBe(assetHash(base));
    expect(assetHash(built(swapMaterials(lantern, { iron: { color: "#553311" } })))).not.toBe(assetHash(base));
    // The mesh-only fingerprint is unchanged by all of those, as it always was.
    expect(geometryHash(built(swapMaterials(lantern, { iron: { color: "#553311" } })))).toBe(geometryHash(base));
  });
});

describe("scene-light GLB export (KHR_lights_punctual)", () => {
  it("writes the extension, one light, and a child node that carries it", () => {
    const glb = exportGlb(built(lantern));
    const json = gltfJson(glb);
    expect(json.extensionsUsed).toContain("KHR_lights_punctual");
    expect(json.extensionsRequired).toBeUndefined();
    expect(json.extensions!.KHR_lights_punctual.lights).toHaveLength(1);
    expect(json.extensions!.KHR_lights_punctual.lights[0]).toMatchObject({ type: "point", intensity: 8, range: 6 });
    const lightNode = json.nodes.find((n) => n.extensions?.KHR_lights_punctual)!;
    expect(lightNode.extensions!.KHR_lights_punctual!.light).toBe(0);
    expect(json.nodes[0].children).toContain(json.nodes.indexOf(lightNode));
    // It adds no geometry, so the shared validator still passes and the model is still grounded.
    const report = validateGlb(glb, { expectedDimensions: lantern.dimensions });
    expect(report.errors).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.groundAligned).toBe(true);
  });

  it("writes nothing for an asset without a light, glowing or not", () => {
    for (const spec of [unlit(lantern), SAMPLES.deckChair]) {
      const json = gltfJson(exportGlb(built(spec)));
      expect(json.extensions).toBeUndefined();
      expect(json.extensionsUsed ?? []).not.toContain("KHR_lights_punctual");
    }
  });

  it("keeps glow and light separate: emissive is on the material, the light is its own node", () => {
    const json = gltfJson(exportGlb(built(lantern)));
    const glow = json.materials.find((m) => m.name === "bulb")!;
    expect(glow.emissiveFactor).toBeDefined();
    expect(json.materials.find((m) => m.name === "iron")!.emissiveFactor).toBeUndefined();
    // A light with no glowing material at all is still exported.
    const noGlow = built(nothingGlows(lantern));
    const noGlowJson = gltfJson(exportGlb(noGlow));
    expect(noGlowJson.materials.every((m) => m.emissiveFactor === undefined)).toBe(true);
    expect(noGlowJson.extensions!.KHR_lights_punctual.lights).toHaveLength(1);
  });

  it("is read back by three's GLTFLoader as the same light, in the same place", async () => {
    const a = built(lantern);
    const { lights } = await loadGlb(exportGlb(a));
    expect(lights).toHaveLength(1);
    const [l] = lights;
    expect(l.type).toBe("PointLight");
    expect(l.intensity).toBe(8);
    expect(l.distance).toBe(6);
    expect(l.color.getHexString()).toBe("ffcf7a");
    expect(l.getWorldPosition(new Vector3()).toArray()).toEqual(a.light!.position.map((v) => expect.closeTo(v, 4)));
  });

  it("writes a spot's cone (outer = half the cone angle, inner from the fixed penumbra) and faces it", async () => {
    const a = built(floodlight);
    const [l] = (await loadGlb(exportGlb(a))).lights as SpotLight[];
    expect(l.type).toBe("SpotLight");
    expect(l.angle).toBeCloseTo((50 / 2) * (Math.PI / 180), 5);
    expect(l.penumbra).toBeCloseTo(STYLE_PROFILE.light.penumbra, 4);
    expect(l.intensity).toBe(30);
    expect(l.distance).toBe(8);
  });

  it.each([["down", [0, -1, 0]], ["up", [0, 1, 0]], ["forward", [0, 0, 1]], ["back", [0, 0, -1]], ["left", [-1, 0, 0]], ["right", [1, 0, 0]]])("aims a spot %s", async (direction, expected) => {
    const [l] = (await loadGlb(exportGlb(built({ ...floodlight, light: { ...floodlight.light, direction } })))).lights as SpotLight[];
    const aim = l.target.getWorldPosition(new Vector3()).sub(l.getWorldPosition(new Vector3())).normalize();
    expect(aim.toArray().map((v) => Math.round(v * 1e4) / 1e4)).toEqual(expected.map((v) => v + 0));
  });
});

describe("a light asset illuminates a test scene", () => {
  // The scene: a 9 m × 9 m floor (facing up) and a wall 3 m behind the asset (facing +z), sampled on a 0.5 m grid.
  const grid = (y: number, z?: number) => {
    const pts: Vector3[] = [];
    for (let x = -4.5; x <= 4.5; x += 0.5) for (let u = -4.5; u <= 4.5; u += 0.5) pts.push(z === undefined ? new Vector3(x, 0, u) : new Vector3(x, y + Math.abs(u) / 3, z));
    return pts;
  };
  const floor = grid(0);
  const total = (lights: Parameters<typeof illuminate>[0], pts: Vector3[], n: Vector3) => pts.reduce((s, p) => s + illuminate(lights, p, n), 0);
  const litCount = (lights: Parameters<typeof illuminate>[0], pts: Vector3[], n: Vector3) => pts.filter((p) => illuminate(lights, p, n) > 1e-6).length;

  it("a lantern's point light lights the floor around it, falling off with distance to nothing at its range", async () => {
    const { lights } = await loadGlb(exportGlb(built(lantern)));
    const at = (d: number) => illuminate(lights, new Vector3(d, 0, 0), UP);
    expect(at(0.5)).toBeGreaterThan(at(1.5));
    expect(at(1.5)).toBeGreaterThan(at(3));
    expect(at(3)).toBeGreaterThan(at(5.5));
    expect(at(5.5)).toBeGreaterThan(0);
    expect(at(6.2)).toBe(0);
    // Round: the same all the way round the lantern.
    expect(illuminate(lights, new Vector3(0, 0, 2), UP)).toBeCloseTo(at(2), 6);
    // Bounded: it lights part of the floor, not all of it.
    const lit = litCount(lights, floor, UP);
    expect(lit).toBeGreaterThan(50);
    expect(lit).toBeLessThan(floor.length);
    // Its own base is lit from above but a surface facing away from it (the underside of the floor) gets nothing.
    expect(illuminate(lights, new Vector3(1, 0, 0), DOWN)).toBe(0);
  });

  it("without the light there is nothing: glow alone lights no surface", async () => {
    const lit = await loadGlb(exportGlb(built(lantern)));
    const glowOnly = await loadGlb(exportGlb(built(unlit(lantern))));
    expect(glowOnly.lights).toHaveLength(0);
    expect(total(glowOnly.lights, floor, UP)).toBe(0);
    expect(total(lit.lights, floor, UP)).toBeGreaterThan(0);
  });

  it("brightness follows the light's intensity and colour survives as data", async () => {
    const weak = await loadGlb(exportGlb(built({ ...lantern, light: { ...lantern.light, intensity: 4 } })));
    const strong = await loadGlb(exportGlb(built({ ...lantern, light: { ...lantern.light, intensity: 8 } })));
    expect(total(strong.lights, floor, UP) / total(weak.lights, floor, UP)).toBeCloseTo(2, 6);
    expect(strong.lights[0].color.getHexString()).toBe("ffcf7a");
  });

  it("a spot lights a pool under it and nothing outside its cone or behind it", async () => {
    const a = built(floodlight);
    const { lights } = await loadGlb(exportGlb(a));
    const head = a.light!.position;
    // Under the head, inside the cone (radius at the floor is about head-height × tan 25°).
    expect(illuminate(lights, new Vector3(head[0], 0, head[2]), UP)).toBeGreaterThan(0);
    expect(illuminate(lights, new Vector3(head[0] + 0.3, 0, head[2]), UP)).toBeGreaterThan(0);
    // Well outside the cone on the floor, though well within range.
    expect(illuminate(lights, new Vector3(head[0] + 2, 0, head[2]), UP)).toBe(0);
    // Above the light (a ceiling facing down) gets nothing from a downward spot.
    expect(illuminate(lights, new Vector3(head[0], head[1] + 1.5, head[2]), DOWN)).toBe(0);
    // The pool is a small part of the floor.
    const lit = litCount(lights, floor, UP);
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(20);
  });

  it("a spot faced at the wall lights the wall and leaves the floor to the side dark", async () => {
    const { lights } = await loadGlb(exportGlb(built({ ...floodlight, light: { ...floodlight.light, direction: "back", coneAngle: 70, range: 12 } })));
    const wall = grid(0, -3);
    const facing = new Vector3(0, 0, 1);
    expect(litCount(lights, wall, facing)).toBeGreaterThan(0);
    expect(litCount(lights, grid(0, 3), new Vector3(0, 0, -1))).toBe(0);
    expect(irradiate(lights)).toBeGreaterThan(0);
    function irradiate(ls: typeof lights) {
      return ls.reduce((s, l) => s + irradiance(l, new Vector3(0, 1, -3), facing), 0);
    }
  });

  it("the whole scene at once: lantern and floodlight together, each within its own reach", async () => {
    const a = await loadGlb(exportGlb(built(lantern)));
    const b = await loadGlb(exportGlb(built(floodlight)));
    // Move the floodlight 5 m to the side: its pool and the lantern's glow are then different parts of the floor.
    b.lights[0].position.x += 5;
    b.scene.updateMatrixWorld(true);
    const both = [...a.lights, ...b.lights];
    expect(total(both, floor, UP)).toBeCloseTo(total(a.lights, floor, UP) + total(b.lights, floor, UP), 6);
    expect(illuminate(both, new Vector3(5, 0, 0.02), UP)).toBeGreaterThan(illuminate(a.lights, new Vector3(5, 0, 0.02), UP));
  });
});
