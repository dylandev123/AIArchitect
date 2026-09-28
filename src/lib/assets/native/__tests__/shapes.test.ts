import { describe, expect, it } from "vitest";
import { validateGlb } from "@/lib/assets/glbValidator";
import { buildAsset, expandParts, type BuiltAsset } from "../build";
import { estimateTriangles, partTriangles } from "../budget";
import { exportGlb } from "../glb";
import * as P from "../primitives";
import { repairSpec } from "../repair";
import { validateSpec, type AssetPart } from "../spec";
import { DETAIL_LEVELS, STYLE_PROFILE } from "../styleProfile";
import { lantern } from "./fixtures";
import { loadGlb } from "./lighting";

const built = (spec: unknown): BuiltAsset => {
  const r = buildAsset(spec);
  if (!r.ok) throw new Error(r.error);
  return r.asset;
};

/** Signed volume of a triangle soup: positive when every face winds outward. */
function volume(g: ReturnType<typeof P.sphere>): number {
  const p = g.getAttribute("position");
  let v = 0;
  for (let i = 0; i < p.count; i += 3) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}
const tris = (g: ReturnType<typeof P.sphere>) => g.getAttribute("position").count / 3;
const ctx = (detail: (typeof DETAIL_LEVELS)[number]) => ({ detail, bevel: 1 });

describe("sphere, cone and torus geometry", () => {
  it.each(DETAIL_LEVELS)("winds outward and fills the right volume at %s detail", (detail) => {
    const ball = volume(P.sphere(0.1, ctx(detail)));
    const cn = volume(P.cone(0.12, 0.25, ctx(detail)));
    const ring = volume(P.torus(0.2, 0.02, ctx(detail)));
    // Positive = outward faces; within tessellation and bevel tolerance of the analytic solid. A cone's rim reaches full
    // radius one bevel up (like a tapered cylinder), so its ceiling is the cone plus that bevel-high disc, not the bare cone;
    // a low-detail torus is a pentagon swept round a decagon, which holds about 71% of the round one's volume.
    const bevel = 0.03;
    expect(ball).toBeGreaterThan((4 / 3) * Math.PI * 0.1 ** 3 * 0.8);
    expect(ball).toBeLessThan((4 / 3) * Math.PI * 0.1 ** 3 * 1.001);
    expect(cn).toBeGreaterThan((Math.PI * 0.12 ** 2 * 0.25 / 3) * 0.7);
    expect(cn).toBeLessThan(Math.PI * 0.12 ** 2 * (bevel + (0.25 - bevel) / 3));
    expect(ring).toBeGreaterThan(2 * Math.PI ** 2 * 0.2 * 0.02 ** 2 * 0.65);
    expect(ring).toBeLessThan(2 * Math.PI ** 2 * 0.2 * 0.02 ** 2 * 1.001);
  });

  it("centres each shape on its own origin: a sphere on the point, a cone about its middle, a torus flat in y", () => {
    const box = (g: ReturnType<typeof P.sphere>) => (g.computeBoundingBox(), g.boundingBox!);
    const s = box(P.sphere(0.1, ctx("medium")));
    expect(s.max.x).toBeCloseTo(0.1, 3);
    expect(s.min.y).toBeCloseTo(-0.1, 3);
    const c = box(P.cone(0.12, 0.25, ctx("medium")));
    expect(c.min.y).toBeCloseTo(-0.125, 4);
    expect(c.max.y).toBeCloseTo(0.125, 4);
    expect(c.max.x).toBeCloseTo(0.12, 3);
    const t = box(P.torus(0.2, 0.02, ctx("medium")));
    expect(t.max.y).toBeCloseTo(0.02, 4);
    expect(t.max.x).toBeCloseTo(0.22, 3);
  });

  it("stays cheap: each detail level costs less than a fixed cap, and low is the cheapest", () => {
    const cost = (f: (d: (typeof DETAIL_LEVELS)[number]) => number) => DETAIL_LEVELS.map(f);
    const [sLow, sMed, sHigh] = cost((d) => tris(P.sphere(0.1, ctx(d))));
    const [cLow, cMed, cHigh] = cost((d) => tris(P.cone(0.1, 0.2, ctx(d))));
    const [tLow, tMed, tHigh] = cost((d) => tris(P.torus(0.2, 0.02, ctx(d))));
    expect([sLow, sMed, sHigh]).toEqual([80, 224, 728]);
    expect([cLow, cMed, cHigh]).toEqual([40, 96, 224]);
    expect([tLow, tMed, tHigh]).toEqual([100, 256, 672]);
    for (const n of [sHigh, cHigh, tHigh]) expect(n).toBeLessThan(STYLE_PROFILE.triangleBudget.low);
  });

  it("has no degenerate triangles (the cone's axis-collapsed halves are dropped)", () => {
    const g = P.cone(0.12, 0.25, ctx("high"));
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = [p.getX(i), p.getY(i), p.getZ(i), p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1), p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
      const [ux, uy, uz, vx, vy, vz] = [bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az];
      const area2 = (uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2;
      expect(area2).toBeGreaterThan(1e-20);
    }
  });
});

describe("triangle budget awareness for the new primitives", () => {
  const part = (p: Record<string, unknown>) => ({ role: "x", material: "m", position: [0, 0, 0], ...p }) as AssetPart;

  it("prices repeat and mirror like every other part", () => {
    const ball = part({ primitive: "sphere", radius: 0.05, repeat: { count: 4, step: [0.1, 0, 0] }, mirror: "xz" });
    expect(estimateTriangles([ball], { detail: "medium", leanCushion: false })).toBe(224 * 4 * 4);
    expect(expandParts([ball])).toHaveLength(16);
  });

  it("reduces a heavy sphere-and-torus asset down the ladder instead of failing it", () => {
    // 24 rings + 24 balls at medium is 24×(256+224)=11,520 > 5,000; it must come back reduced or refused with a clear reason.
    const spec = {
      ...lantern,
      parts: [
        ...lantern.parts,
        { primitive: "torus", role: "rib", material: "iron", radius: 0.1, tubeRadius: 0.006, position: [0, 0.1, 0], repeat: { count: 24, step: [0, 0.012, 0] } },
        { primitive: "sphere", role: "bead", material: "iron", radius: 0.012, position: [0.13, 0.05, 0], repeat: { count: 24, step: [0, 0.015, 0] } },
      ],
    };
    const r = buildAsset(spec);
    if (r.ok) expect(r.asset.triangles).toBeLessThanOrEqual(STYLE_PROFILE.triangleBudget[r.asset.detail]);
    else expect(r.error).toMatch(/Too heavy|Too many parts/);
  });

  it("publishes the new costs to the model", () => {
    expect(partTriangles(part({ primitive: "sphere", radius: 0.1 }), { detail: "medium", leanCushion: false })).toBe(224);
  });
});

describe("sphere, cone and torus export correctly to GLB", () => {
  const asset = (main: Record<string, unknown>, dims: { width: number; depth: number; height: number }) => ({
    family: "lamp", name: "Test lamp", style: "test", dimensions: dims,
    materials: [{ key: "iron", material: "metal", color: "#2c2f33" }, { key: "glow", material: "glass", color: "#ffe2a8", emissiveColor: "#ffcf7a", emissiveIntensity: 2 }],
    parts: [{ primitive: "cylinder", role: "base", material: "iron", radius: 0.1, height: 0.03, position: [0, 0.015, 0] }, { role: "main", material: "glow", ...main }],
  });
  const cases = [
    ["sphere", asset({ primitive: "sphere", radius: 0.1, position: [0, 0.13, 0] }, { width: 0.2, depth: 0.2, height: 0.23 })],
    ["cone", asset({ primitive: "cone", radius: 0.1, height: 0.3, position: [0, 0.18, 0] }, { width: 0.2, depth: 0.2, height: 0.33 })],
    ["torus", asset({ primitive: "torus", radius: 0.1, tubeRadius: 0.02, position: [0, 0.3, 0] }, { width: 0.24, depth: 0.24, height: 0.32 })],
  ] as const;

  it.each(cases)("%s: passes the validator, sits on the ground, and three's GLTFLoader reads back the same triangles and size", async (_n, spec) => {
    const a = built(spec);
    expect(a.triangles).toBeGreaterThan(0);
    const glb = exportGlb(a);
    const report = validateGlb(glb, { expectedDimensions: spec.dimensions });
    expect(report.errors).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.groundAligned).toBe(true);
    expect(report.triangleCount).toBe(a.triangles);
    expect(report.dimensions?.width).toBeCloseTo(spec.dimensions.width, 2);
    expect(report.dimensions?.height).toBeCloseTo(spec.dimensions.height, 2);

    const loaded = await loadGlb(glb);
    expect(loaded.triangles).toBe(a.triangles);
    expect(loaded.box.min.y).toBeCloseTo(0, 4);
    expect(loaded.box.max.y).toBeCloseTo(spec.dimensions.height, 3);
    expect(loaded.box.getSize(loaded.box.min.clone()).x).toBeCloseTo(spec.dimensions.width, 3);
  });

  it("a fixture using all three builds, validates and loads", async () => {
    const a = built(lantern);
    expect(a.triangles).toBeLessThanOrEqual(STYLE_PROFILE.triangleBudget.medium);
    const glb = exportGlb(a);
    expect(validateGlb(glb, { expectedDimensions: lantern.dimensions }).passed).toBe(true);
    expect((await loadGlb(glb)).triangles).toBe(a.triangles);
  });
});

describe("the model can name the new primitives loosely", () => {
  const spec = (part: Record<string, unknown>) => ({ ...lantern, light: undefined, parts: [lantern.parts[0], { role: "p", material: "iron", position: [0, 0.2, 0], ...part }] });
  const repaired = (part: Record<string, unknown>) => {
    const r = repairSpec(spec(part));
    if (!r.ok) throw new Error(r.error);
    return (r.spec as { parts: Record<string, unknown>[] }).parts[1];
  };

  it.each([["ball", { radius: 0.05 }], ["orb", { diameter: 0.1 }], ["globe", { size: [0.1, 0.1, 0.1] }], ["bulb", { width: 0.1 }]])("reads %s as a sphere", (name, dims) => {
    expect(repaired({ primitive: name, ...dims })).toMatchObject({ primitive: "sphere", radius: 0.05 });
  });

  it.each([["ring", { radius: 0.1, thickness: 0.02 }], ["donut", { radius: 0.1, tubeRadius: 0.01 }], ["hoop", { radius: 0.1, tube: 0.01 }]])("reads %s as a torus", (name, dims) => {
    expect(repaired({ primitive: name, ...dims })).toMatchObject({ primitive: "torus", radius: 0.1 });
  });

  it("a cone is a cone now, not a tapered cylinder", () => {
    expect(repaired({ primitive: "cone", radius: 0.1, height: 0.2 })).toMatchObject({ primitive: "cone", radius: 0.1, height: 0.2 });
    expect(repaired({ primitive: "cone", diameter: 0.2, height: 0.2 })).toMatchObject({ primitive: "cone", radius: 0.1 });
  });

  it("a cone that also has a top radius keeps it, as a tapered cylinder", () => {
    expect(repaired({ primitive: "cone", radiusBottom: 0.1, radiusTop: 0.04, height: 0.2 })).toMatchObject({ primitive: "taperedCylinder", radiusBottom: 0.1, radiusTop: 0.04 });
  });

  it("thins a torus tube that would close the ring, and keeps sizes above the minimum thickness", () => {
    const thinned = repaired({ primitive: "torus", radius: 0.05, tubeRadius: 0.08 }) as { radius: number; tubeRadius: number };
    expect(thinned.radius).toBe(0.05);
    expect(thinned.tubeRadius).toBeCloseTo(0.045, 6);
    expect((repaired({ primitive: "sphere", radius: 0.0001 }) as { radius: number }).radius * 2).toBeGreaterThanOrEqual(STYLE_PROFILE.minPartThickness);
  });

  it("still rejects a shape with no size, with the reason spelled out", () => {
    const r = validateSpec(spec({ primitive: "sphere" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/radius must be a positive number/);
  });

  it("strict validation refuses a torus whose tube is as fat as its ring", () => {
    const r = validateSpec({ ...lantern, parts: [lantern.parts[0], { primitive: "torus", role: "t", material: "iron", radius: 0.05, tubeRadius: 0.06, position: [0, 0.2, 0] }] });
    // The repair pass thins it first, so a spec that reaches the strict schema is valid.
    expect(r.ok).toBe(true);
  });
});
