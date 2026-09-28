import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateGlb } from "@/lib/assets/glbValidator";
import { buildAsset, expandParts, geometryHash, swapMaterials, type BuiltAsset } from "../build";
import { exportGlb } from "../glb";
import { FAMILY_LIMITS, NATIVE_FAMILIES, nativeRoute, validateSpec } from "../spec";
import { STYLE_PROFILE } from "../styleProfile";
import { encodePng, renderAsset } from "./render";
import { SAMPLES } from "./fixtures";

const built = (spec: unknown): BuiltAsset => {
  const r = buildAsset(spec);
  if (!r.ok) throw new Error(r.error);
  return r.asset;
};

/** Signed volume of a triangle soup: positive when faces wind outward. */
function volume(a: BuiltAsset): number {
  let v = 0;
  for (const m of a.meshes) {
    const p = m.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = [p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
  }
  return v;
}

describe("native stylized generator: the five validation assets", () => {
  const all = Object.entries(SAMPLES).map(([name, spec]) => [name, spec, built(spec)] as const);

  it.each(all)("%s builds to its declared, realistic size, inside the triangle budget", (_n, spec, a) => {
    expect(a.size).toEqual(spec.dimensions);
    const limits = FAMILY_LIMITS[spec.family];
    for (const k of ["width", "depth", "height"] as const) expect(spec.dimensions[k]).toBeGreaterThanOrEqual(limits[k][0]);
    expect(a.triangles).toBeGreaterThan(200);
    expect(a.triangles).toBeLessThanOrEqual(STYLE_PROFILE.triangleBudget[a.detail]);
    expect(a.detail).toBe(spec.detailLevel);
  });

  it.each(all)("%s has outward faces (every primitive winds correctly)", (_n, _s, a) => {
    expect(volume(a)).toBeGreaterThan(0);
  });

  it("produces clearly different geometry per asset", () => {
    const hashes = new Set(all.map(([, , a]) => geometryHash(a)));
    expect(hashes.size).toBe(all.length);
    expect(new Set(all.map(([, , a]) => a.triangles)).size).toBeGreaterThan(3);
  });

  it("is deterministic", () => {
    expect(geometryHash(built(SAMPLES.deckChair))).toBe(geometryHash(built(SAMPLES.deckChair)));
  });

  it.each(all)("%s exports a GLB that passes the existing validator, grounded and centred", (_n, spec, a) => {
    const report = validateGlb(exportGlb(a), { family: undefined, expectedDimensions: spec.dimensions });
    expect(report.errors).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.groundAligned).toBe(true);
    expect(report.dimensions?.width).toBeCloseTo(spec.dimensions.width, 1);
    expect(report.dimensions?.height).toBeCloseTo(spec.dimensions.height, 1);
    expect(report.triangleCount).toBe(a.triangles);
    expect(report.materialCount).toBe(a.meshes.length);
    expect(report.warnings.filter((w) => /triangle|Many/.test(w))).toEqual([]);
  });

  it("recolours and swaps materials without touching geometry", () => {
    const base = built(SAMPLES.diningTable);
    const swapped = built(swapMaterials(SAMPLES.diningTable, { teak: { material: "cedar", color: "#3a2412" }, steel: { color: "#c9a24a", metalness: 1 } }));
    expect(geometryHash(swapped)).toBe(geometryHash(base));
    expect(swapped.meshes.map((m) => m.surface.key)).toEqual(base.meshes.map((m) => m.surface.key));
    expect(swapped.meshes[0].surface.color).not.toBe(base.meshes[0].surface.color);
    const json = new TextDecoder().decode(new Uint8Array(exportGlb(swapped)).subarray(20, 4000));
    expect(json).toContain('"name":"teak"');
  });

  it("holds every surface inside the profile's roughness and saturation ranges", () => {
    const neon = built({ ...SAMPLES.modernPlanter, materials: [{ key: "concrete", material: "concrete", color: "#00ff00", roughness: 0.01 }, ...SAMPLES.modernPlanter.materials.slice(1)] });
    const s = neon.meshes.find((m) => m.surface.key === "concrete")!.surface;
    expect(s.roughness).toBeGreaterThanOrEqual(STYLE_PROFILE.roughness.min);
    expect(s.color).not.toBe("#00ff00");
  });

  it("writes review renders when RENDER_DIR is set", () => {
    const dir = process.env.RENDER_DIR;
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    for (const [name, , a] of all) writeFileSync(path.join(dir, `${name}.png`), encodePng(renderAsset(a), 360, 360));
  });
});

describe("spec validation rejects unsafe or unsupported output", () => {
  const ok = SAMPLES.barStool;
  it.each([
    ["unknown family", { ...ok, family: "spaceship" }],
    ["unrealistic height", { ...ok, dimensions: { ...ok.dimensions, height: 3 } }],
    ["unknown material key", { ...ok, parts: ok.parts.map((p, i) => (i === 0 ? { ...p, material: "gold" } : p)) }],
    ["unknown primitive", { ...ok, parts: [...ok.parts, { primitive: "blob", role: "x", material: "steel", position: [0, 0, 0] }] }],
    ["zero-thickness part", { ...ok, parts: [...ok.parts, { primitive: "panel", role: "film", material: "steel", size: [0.3, 0.3, 0], position: [0, 0.3, 0] }] }],
    ["bad colour", { ...ok, materials: [{ key: "leather", material: "stucco", color: "somewhere between brown and grey" }, ok.materials[1]] }],
    ["too few parts", { ...ok, parts: ok.parts.slice(0, 1) }],
    ["duplicate material keys", { ...ok, materials: [ok.materials[0], ok.materials[0]] }],
  ])("%s", (_l, bad) => {
    expect(validateSpec(bad).ok).toBe(false);
    expect(buildAsset(bad).ok).toBe(false);
  });

  it("rejects parts that do not build to the declared size", () => {
    const r = buildAsset({ ...SAMPLES.diningTable, dimensions: { width: 3, depth: 0.9, height: 0.75 } });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/too far from the declared/);
  });

  it("rejects runaway repeat/mirror expansion", () => {
    const r = buildAsset({ ...ok, parts: [{ primitive: "box", role: "x", material: "steel", size: [0.05, 0.05, 0.05], position: [0.1, 0.1, 0.1], mirror: "xz", repeat: { count: 24, step: [0, 0.01, 0] } }, ...Array.from({ length: 10 }, () => ({ primitive: "box", role: "y", material: "steel", size: [0.05, 0.05, 0.05], position: [0, 0.3, 0], mirror: "xz", repeat: { count: 3, step: [0, 0.01, 0] } }))] });
    expect(r.ok).toBe(false);
  });

  it("expands mirror and repeat", () => {
    expect(expandParts([{ primitive: "box", role: "leg", material: "steel", size: [0.1, 0.1, 0.1], position: [1, 0, 1], mirror: "xz", repeat: { count: 3, step: [0, 0, 0.2] } }])).toHaveLength(12);
  });

  it("routes organic and complex objects to external generation", () => {
    expect(nativeRoute({ name: "Bar Stool", category: "furniture" })).toBe("native");
    expect(nativeRoute({ name: "Outdoor Sink", category: "outdoor-kitchen" })).toBe("native");
    expect(nativeRoute({ name: "Special Sculpture", category: "decorative" })).toBe("external-generation-recommended");
    expect(nativeRoute({ name: "Herb Garden", category: "vegetation" })).toBe("external-generation-recommended");
    expect(nativeRoute({ name: "Palm Tree", category: "decorative" })).toBe("external-generation-recommended");
    expect(nativeRoute({ name: "Beach Cabana", category: "cabana" })).toBe("external-generation-recommended");
    expect(NATIVE_FAMILIES.length).toBeGreaterThan(15);
  });
});
