import { makePlane } from "../roofSystems/planes";
import type { RoofEdge, RoofPlane, V3 } from "../roofSystems/types";
import type { Point, Rect } from "./footprint";

/**
 * The V2 ridge-family roofs (gable, hip, butterfly) over one rectangle of a mass's top floor, in local mass
 * space, built from the recipe's own pitch and overhang. They return faces and edges rather than finished
 * primitives: the mass's Roof System lays the covering, pattern and trim over them.
 *
 * Shared datum: the roof plane bears on the wall plate at the wall line. A gable/hip eave therefore continues
 * down the same slope past the wall (a deeper overhang ends lower, as built) — but never more than
 * `MAX_EAVE_DROP` below the plate: past that the whole roof is lifted on a raised heel (the wall carried up
 * to it at the wall line), so a deep or steep eave shelters the windows under it instead of covering them.
 * A butterfly's valley sits at the wall plate with its wings rising outward. The ridge/valley runs along the
 * rectangle's longer side.
 */
export interface PitchedRoofInput { rect: Rect; wallPlateY: number; pitchDeg: number; overhang: number }
export interface PitchedRoofGeometry { planes: RoofPlane[]; edges: RoofEdge[]; /** Wall infill closing the gap between wall plate and roof underside, as triangles. */ infill: number[] }

const MIN_PITCH = 1, MAX_PITCH = 60;
/** Furthest (m) a gable/hip eave edge may sit below the wall plate. */
export const MAX_EAVE_DROP = 0.25;

/** A rectangle's long/short frame: `at(l, y, s)` is the point `l` along the ridge axis and `s` across it. */
function frame({ rect, wallPlateY, pitchDeg, overhang }: PitchedRoofInput) {
  const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0;
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2;
  const ridgeAlongX = width >= depth;
  const at = (l: number, y: number, s: number): V3 => (ridgeAlongX ? [cx + l, y, cz + s] : [cx + s, y, cz + l]);
  const outL = (sign: number): [number, number] => (ridgeAlongX ? [sign, 0] : [0, sign]);
  const outS = (sign: number): [number, number] => (ridgeAlongX ? [0, sign] : [sign, 0]);
  const tan = Math.tan((Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitchDeg)) * Math.PI) / 180);
  const halfLong = Math.max(width, depth) / 2, halfShort = Math.min(width, depth) / 2;
  const names = ridgeAlongX ? { s: ["north", "south"], l: ["west", "east"] } : { s: ["west", "east"], l: ["north", "south"] };
  const reach = Math.max(0, overhang);
  return { at, outL, outS, tan, halfLong, halfShort, base: wallPlateY, reach, heel: Math.max(0, tan * reach - MAX_EAVE_DROP), names };
}
const SIDES = [-1, 1] as const;
const tri = (out: number[], a: V3, b: V3, c: V3) => out.push(...a, ...b, ...c);
/** The wall carried up from the plate to a raised heel along one eave wall. */
function heelBand(out: number[], a: V3, b: V3, heel: number) {
  if (heel <= 1e-6) return;
  const top = (p: V3): V3 => [p[0], p[1] + heel, p[2]];
  tri(out, a, b, top(b)); tri(out, a, top(b), top(a));
}

/** Two slopes meeting at a ridge, the gable-end walls carried up to it at the wall line. */
export function gableRoofGeometry(input: PitchedRoofInput): PitchedRoofGeometry {
  const f = frame(input);
  const bearing = f.base + f.heel;
  const ridgeY = bearing + f.tan * f.halfShort, eaveY = bearing - f.tan * f.reach;
  const span = f.halfShort + f.reach, length = f.halfLong + f.reach;
  const planes: RoofPlane[] = [], edges: RoofEdge[] = [], infill: number[] = [];
  SIDES.forEach((side, i) => {
    const corners = [f.at(-length, eaveY, side * span), f.at(length, eaveY, side * span), f.at(length, ridgeY, 0), f.at(-length, ridgeY, 0)];
    const plane = makePlane(`slope-${f.names.s[i]}`, corners, corners[0], corners[1]);
    planes.push(plane);
    edges.push({ kind: "eave", a: corners[0], b: corners[1], out: f.outS(side), planes: [plane] }, { kind: "rake", a: corners[0], b: corners[3], out: f.outL(-1), planes: [plane] }, { kind: "rake", a: corners[1], b: corners[2], out: f.outL(1), planes: [plane] });
    heelBand(infill, f.at(-f.halfLong, f.base, side * f.halfShort), f.at(f.halfLong, f.base, side * f.halfShort), f.heel);
  });
  edges.push({ kind: "ridge", a: f.at(-length, ridgeY, 0), b: f.at(length, ridgeY, 0), planes });
  for (const end of SIDES) {
    const low = [f.at(end * f.halfLong, f.base, -f.halfShort), f.at(end * f.halfLong, f.base, f.halfShort)];
    heelBand(infill, low[0], low[1], f.heel);
    tri(infill, f.at(end * f.halfLong, bearing, -f.halfShort), f.at(end * f.halfLong, bearing, f.halfShort), f.at(end * f.halfLong, ridgeY, 0));
  }
  return { planes, edges, infill };
}

/** Four faces at one pitch: two trapezoids along the ridge and a triangle at each end (a pyramid on a square). */
export function hipRoofGeometry(input: PitchedRoofInput): PitchedRoofGeometry {
  const f = frame(input);
  const bearing = f.base + f.heel;
  const ridgeY = bearing + f.tan * f.halfShort, eaveY = bearing - f.tan * f.reach;
  const span = f.halfShort + f.reach, length = f.halfLong + f.reach, halfRidge = f.halfLong - f.halfShort;
  const planes: RoofPlane[] = [], edges: RoofEdge[] = [], infill: number[] = [];
  const apex = (end: number) => f.at(end * halfRidge, ridgeY, 0);
  const long = SIDES.map((side, i) => {
    const corners = [f.at(-length, eaveY, side * span), f.at(length, eaveY, side * span), apex(1), ...(halfRidge > 1e-6 ? [apex(-1)] : [])];
    const plane = makePlane(`hip-${f.names.s[i]}`, corners, corners[0], corners[1]);
    edges.push({ kind: "eave", a: corners[0], b: corners[1], out: f.outS(side), planes: [plane] });
    heelBand(infill, f.at(-f.halfLong, f.base, side * f.halfShort), f.at(f.halfLong, f.base, side * f.halfShort), f.heel);
    return plane;
  });
  const ends = SIDES.map((end, i) => {
    const corners = [f.at(end * length, eaveY, -span), f.at(end * length, eaveY, span), apex(end)];
    const plane = makePlane(`hip-${f.names.l[i]}`, corners, corners[0], corners[1]);
    edges.push({ kind: "eave", a: corners[0], b: corners[1], out: f.outL(end), planes: [plane] });
    heelBand(infill, f.at(end * f.halfLong, f.base, -f.halfShort), f.at(end * f.halfLong, f.base, f.halfShort), f.heel);
    return plane;
  });
  planes.push(...long, ...ends);
  SIDES.forEach((end, e) => SIDES.forEach((side, s) => edges.push({ kind: "hip", a: f.at(end * length, eaveY, side * span), b: apex(end), planes: [long[s], ends[e]] })));
  if (halfRidge > 1e-6) edges.push({ kind: "ridge", a: apex(-1), b: apex(1), planes: long });
  return { planes, edges, infill };
}

/**
 * Two wings rising outward from a central valley. The walls are carried up to the wings at the wall line on all
 * four sides: a rectangle under each high eave and a pair of triangles at each end.
 */
export function butterflyRoofGeometry(input: PitchedRoofInput): PitchedRoofGeometry {
  const f = frame(input);
  const span = f.halfShort + f.reach, length = f.halfLong + f.reach;
  const outerY = f.base + f.tan * span, wallY = f.base + f.tan * f.halfShort;
  const planes: RoofPlane[] = [], edges: RoofEdge[] = [], infill: number[] = [];
  const valley: [V3, V3] = [f.at(-length, f.base, 0), f.at(length, f.base, 0)];
  SIDES.forEach((side, i) => {
    const corners = [valley[0], valley[1], f.at(length, outerY, side * span), f.at(-length, outerY, side * span)];
    const plane = makePlane(`wing-${f.names.s[i]}`, corners, corners[0], corners[1]);
    planes.push(plane);
    edges.push({ kind: "high-eave", a: corners[3], b: corners[2], out: f.outS(side), planes: [plane] }, { kind: "rake", a: corners[0], b: corners[3], out: f.outL(-1), planes: [plane] }, { kind: "rake", a: corners[1], b: corners[2], out: f.outL(1), planes: [plane] });
    const low = [f.at(-f.halfLong, f.base, side * f.halfShort), f.at(f.halfLong, f.base, side * f.halfShort)], high = [f.at(-f.halfLong, wallY, side * f.halfShort), f.at(f.halfLong, wallY, side * f.halfShort)];
    tri(infill, low[0], low[1], high[1]); tri(infill, low[0], high[1], high[0]);
    for (const end of SIDES) tri(infill, f.at(end * f.halfLong, f.base, 0), f.at(end * f.halfLong, f.base, side * f.halfShort), f.at(end * f.halfLong, wallY, side * f.halfShort));
  });
  edges.push({ kind: "valley", a: valley[0], b: valley[1], planes });
  return { planes, edges, infill };
}

/** Outer edges of a roof outline at a given surface height, each with the horizontal direction pointing away from the roof. */
export function outlineEdges(outline: readonly Point[], heightAt: (x: number, z: number) => number, kindOf: (a: Point, b: Point, out: readonly [number, number]) => RoofEdge["kind"]): RoofEdge[] {
  let area = 0;
  outline.forEach((p, i) => { const q = outline[(i + 1) % outline.length]; area += p[0] * q[1] - q[0] * p[1]; });
  const turn = area >= 0 ? 1 : -1;
  return outline.flatMap((p, i) => {
    const q = outline[(i + 1) % outline.length];
    const dx = q[0] - p[0], dz = q[1] - p[1], length = Math.hypot(dx, dz);
    if (length < 1e-6) return [];
    const out = [(turn * dz) / length, (-turn * dx) / length] as const;
    return [{ kind: kindOf(p, q, out), a: [p[0], heightAt(p[0], p[1]), p[1]] as V3, b: [q[0], heightAt(q[0], q[1]), q[1]] as V3, out }];
  });
}
