import { describe, expect, it } from "vitest";
import { buildFloorFootprint, offsetFootprintOutline, offsetRectilinearPolygon, decomposeToRectangles } from "../footprint";

describe("buildFloorFootprint", () => {
  it("returns the plain rectangle when there are no operations", () => {
    const { polygon, rects, warnings } = buildFloorFootprint(10, 8, [], 0);
    expect(warnings).toEqual([]);
    expect(polygon).toEqual([
      [-5, -4],
      [5, -4],
      [5, 4],
      [-5, 4],
    ]);
    expect(rects).toEqual([{ x0: -5, x1: 5, z0: -4, z1: 4 }]);
  });

  it("recesses a span of one facade inward without touching the others", () => {
    const { polygon, warnings } = buildFloorFootprint(10, 8, [
      { type: "recess", facade: "south", start: 0.2, end: 0.8, depth: 1.5 },
    ], 0);
    expect(warnings).toEqual([]);
    // South runs from x=-5 (u=0) to x=5 (u=1) at z=4; the recess spans x in [-3,3], pulled inward (z=2.5).
    expect(polygon).toEqual([
      [-5, -4], [5, -4],
      [5, 4], [3, 4], [3, 2.5], [-3, 2.5], [-3, 4], [-5, 4],
    ]);
  });

  it("projects a span outward", () => {
    const { polygon } = buildFloorFootprint(10, 8, [
      { type: "projection", facade: "east", start: 0.25, end: 0.75, depth: 2 },
    ], 0);
    // East runs from z=-4 (u=0) to z=4 (u=1) at x=5; span z in [-2,2], pushed outward (x=7).
    expect(polygon).toEqual([
      [-5, -4], [5, -4], [5, -2], [7, -2], [7, 2], [5, 2], [5, 4], [-5, 4],
    ]);
  });

  it("cuts an L-shape at one corner and decomposes it into two rectangles", () => {
    const { polygon, rects, warnings } = buildFloorFootprint(10, 8, [
      { type: "notch", corner: "se", width: 4, depth: 3 },
    ], 0);
    expect(warnings).toEqual([]);
    // SE corner (5,4) is cut back to (1,4)-(1,1)-(5,1).
    expect(polygon).toEqual([
      [-5, -4], [5, -4], [5, 1], [1, 1], [1, 4], [-5, 4],
    ]);
    expect(rects.length).toBe(2);
    const totalArea = rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
    expect(totalArea).toBeCloseTo(10 * 8 - 4 * 3);
  });

  it("cuts a corner with a single angled edge, and slabs/roofs keep that cut instead of squaring it back", () => {
    const { polygon, hullPolygon, chamfers, rects, wedges, edges, warnings } = buildFloorFootprint(10, 8, [
      { type: "chamfer", corner: "se", size: 2, glazed: true },
    ], 0);
    expect(warnings).toEqual([]);
    // SE corner (5,4) is replaced by one diagonal wall from (5,2) to (3,4) — not an L-shaped step.
    expect(polygon).toEqual([[-5, -4], [5, -4], [5, 2], [3, 4], [-5, 4]]);
    const angled = edges.filter((e) => e.chamfer);
    expect(angled).toHaveLength(1);
    expect(angled[0]).toMatchObject({ a: [5, 2], b: [3, 4], chamfer: { glazed: true } });
    expect(angled[0].facade).toBeUndefined();
    expect(chamfers).toEqual([{ corner: "se", size: 2 }]);
    expect(hullPolygon).toEqual([[-5, -4], [5, -4], [5, 4], [-5, 4]]);
    // The slab rectangles never cover the cut-away half of the corner square...
    for (const r of rects) expect(r.x1 <= 3 + 1e-9 || r.z1 <= 2 + 1e-9).toBe(true);
    // ...the wedge fills exactly the inside half, so rects + wedges tile the true outline: 80 - ½·2·2 = 78 m².
    expect(wedges).toEqual([[[3, 4], [5, 2], [3, 2]]].map((w) => expect.arrayContaining(w)));
    const rectArea = rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
    expect(rectArea + 2).toBeCloseTo(78);
  });

  it("grows a chamfered outline with an even overhang that keeps the cut's angle", () => {
    const footprint = buildFloorFootprint(10, 8, [{ type: "chamfer", corner: "se", size: 2 }], 0);
    const { polygon } = offsetFootprintOutline(footprint, 10, 8, 0.5);
    // Five edges, one of them the 45° prow — not a square corner.
    expect(polygon).toHaveLength(5);
    const diagonal = polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]]).filter(([a, b]) => Math.abs(a[0] - b[0]) > 1e-9 && Math.abs(a[1] - b[1]) > 1e-9);
    expect(diagonal).toHaveLength(1);
    const [[ax, az], [bx, bz]] = diagonal[0];
    expect(Math.abs(bx - ax)).toBeCloseTo(Math.abs(bz - az));
    // The grown diagonal sits exactly 0.5m outside the wall's diagonal x + z = 7.
    expect((ax + az - 7) / Math.SQRT2).toBeCloseTo(0.5);
    for (const [x, z] of polygon) expect(Math.max(Math.abs(x) - 5, Math.abs(z) - 4)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it("warns and keeps only the first operation when a notch and a chamfer claim the same corner", () => {
    const { polygon, warnings } = buildFloorFootprint(10, 8, [
      { type: "notch", corner: "nw", width: 3, depth: 2 },
      { type: "chamfer", corner: "nw", size: 2 },
    ], 0);
    expect(warnings.some((w) => w.includes("duplicate operation at corner \"nw\""))).toBe(true);
    expect(polygon).toContainEqual([-2, -2]); // the notch's inward corner survived
  });

  it("only applies floors: \"ground\" operations to floor 0", () => {
    const ground = buildFloorFootprint(10, 8, [{ type: "recess", facade: "south", start: 0.2, end: 0.8, depth: 1.5, floors: "ground" }], 0);
    const upper = buildFloorFootprint(10, 8, [{ type: "recess", facade: "south", start: 0.2, end: 0.8, depth: 1.5, floors: "ground" }], 1);
    expect(ground.polygon.length).toBeGreaterThan(4);
    expect(upper.polygon).toEqual([[-5, -4], [5, -4], [5, 4], [-5, 4]]);
  });

  it("warns and drops overlapping operations on the same facade instead of producing an invalid polygon", () => {
    const { warnings, polygon } = buildFloorFootprint(10, 8, [
      { type: "recess", facade: "south", start: 0.1, end: 0.6, depth: 1 },
      { type: "recess", facade: "south", start: 0.4, end: 0.9, depth: 1 },
    ], 0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(polygon.length).toBeGreaterThan(4);
  });
});

describe("offsetRectilinearPolygon", () => {
  it("grows a plain rectangle exactly like a bounding-box expansion", () => {
    const rect: [number, number][] = [[-5, -4], [5, -4], [5, 4], [-5, 4]];
    const { polygon, warnings } = offsetRectilinearPolygon(rect, 1.3);
    expect(warnings).toEqual([]);
    expect(polygon).toEqual([[-6.3, -5.3], [6.3, -5.3], [6.3, 5.3], [-6.3, 5.3]]);
  });

  it("narrows a recess's mouth (not its depth) when growing outward, and never overlaps itself while the mouth stays open", () => {
    const { polygon: base } = buildFloorFootprint(10, 8, [{ type: "recess", facade: "south", start: 0.2, end: 0.8, depth: 1.5 }], 0);
    const { polygon, warnings } = offsetRectilinearPolygon(base, 1);
    expect(warnings).toEqual([]);
    // South recess mouth was x in [-3,3] (6m); growing by 1 on both sides narrows it to [-2,2] (4m). Depth (1.5m) is unchanged.
    const southZ = Math.max(...polygon.map((p) => p[1]));
    const recessZ = southZ - 1.5;
    expect(polygon).toContainEqual([-2, recessZ]);
    expect(polygon).toContainEqual([2, recessZ]);
    const rects = decomposeToRectangles(polygon);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      expect(ox > 1e-9 && oz > 1e-9).toBe(false);
    }
  });

  it("closes up (with a warning) a recess narrower than 2x the growth distance, instead of self-intersecting", () => {
    const { polygon: base } = buildFloorFootprint(10, 8, [{ type: "recess", facade: "south", start: 0.4, end: 0.6, depth: 1.5 }], 0); // 2m-wide mouth
    const { polygon, warnings } = offsetRectilinearPolygon(base, 1.5); // 2x1.5=3 > 2m mouth
    expect(warnings.some((w) => w.includes("closes up"))).toBe(true);
    // No zero-or-negative-width rectangle in the decomposition — the collapse must not invert the polygon.
    const rects = decomposeToRectangles(polygon);
    for (const r of rects) { expect(r.x1 - r.x0).toBeGreaterThan(0); expect(r.z1 - r.z0).toBeGreaterThan(0); }
  });

  it("translates a corner notch outward, preserving its size, with no overlap in the resulting roof rectangles", () => {
    const { polygon: base } = buildFloorFootprint(18, 10, [
      { type: "entry-recess", facade: "north", width: 3.2, depth: 1.3 },
      { type: "notch", corner: "sw", width: 3, depth: 2.5 },
      { type: "projection", facade: "south", start: 0.15, end: 0.85, depth: 2.6, open: true, postSpacing: 2.4 },
    ], 0);
    const { polygon, warnings } = offsetRectilinearPolygon(base, 1.3);
    expect(warnings).toEqual([]);
    const rects = decomposeToRectangles(polygon);
    expect(rects.length).toBeGreaterThan(1);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      expect(ox > 1e-9 && oz > 1e-9).toBe(false);
    }
  });
});
