import type { TriMeshPrimitive } from "@/lib/house/types";
import type { Paint } from "@/lib/house/architecture/parts";
import type { MaterialType } from "@/types/house";
import type { RoofPlane, V3 } from "./types";

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const EPS = 1e-6;

/**
 * A plane from its corners and its low edge. `vertices` defaults to a fan over the corners (every pitched
 * face is convex); pass the real mesh for a face that has thickness or a concave outline.
 */
export function makePlane(id: string, corners: readonly V3[], eaveA: V3, eaveB: V3, vertices?: number[]): RoofPlane {
  const along = unit(sub(eaveB, eaveA));
  const mean = scale(corners.reduce<V3>((sum, p) => add(sum, p), [0, 0, 0]), 1 / corners.length);
  // Up the slope = the part of "toward the face's middle" that is square to the low edge.
  const toward = sub(mean, eaveA);
  const up = unit(sub(toward, scale(along, dot(toward, along))));
  let normal = unit(cross(along, up));
  if (normal[1] < 0) normal = scale(normal, -1);
  const fan: number[] = [];
  if (!vertices) for (let i = 1; i < corners.length - 1; i++) fan.push(...corners[0], ...corners[i], ...corners[i + 1]);
  return { id, origin: eaveA, along, up, normal, outline: corners.map((p) => [dot(sub(p, eaveA), along), dot(sub(p, eaveA), up)] as const), vertices: vertices ?? fan };
}

/** The world point at plane coordinates (a, s), `lift` metres off the surface. */
export function planePoint(plane: RoofPlane, a: number, s: number, lift = 0): V3 {
  return add(add(add(plane.origin, scale(plane.along, a)), scale(plane.up, s)), scale(plane.normal, lift));
}

export function planeExtents(plane: RoofPlane): { a0: number; a1: number; s1: number } {
  const as = plane.outline.map((p) => p[0]), ss = plane.outline.map((p) => p[1]);
  return { a0: Math.min(...as), a1: Math.max(...as), s1: Math.max(...ss) };
}

export function planeCentre(plane: RoofPlane): V3 {
  const n = plane.outline.length;
  return planePoint(plane, plane.outline.reduce((t, p) => t + p[0], 0) / n, plane.outline.reduce((t, p) => t + p[1], 0) / n);
}

/** The stretches of the up-slope line at `a` that lie on the face — one for a convex face, more across a notch. */
export function slopeSpansAt(plane: RoofPlane, a: number): [number, number][] {
  const hits: number[] = [];
  const o = plane.outline;
  for (let i = 0; i < o.length; i++) {
    const p = o[i], q = o[(i + 1) % o.length];
    if ((p[0] <= a) === (q[0] <= a)) continue;
    hits.push(p[1] + ((a - p[0]) / (q[0] - p[0])) * (q[1] - p[1]));
  }
  hits.sort((x, y) => x - y);
  const spans: [number, number][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) spans.push([hits[i], hits[i + 1]]);
  return spans;
}

/** A covering's repeat, in metres: unit width along the eave, course exposure up the slope. */
export type PatternModule = readonly [unit: number, course: number];

/**
 * Whole modules a face carries: the count nearest the covering's nominal size, so the first and last course
 * (and unit) are full ones and the real exposure only flexes by a fraction of a course to make it fit.
 */
export function courseLayout(plane: RoofPlane, module: PatternModule): { units: number; courses: number; unit: number; exposure: number } {
  const { a0, a1, s1 } = planeExtents(plane);
  const units = Math.max(1, Math.round((a1 - a0) / module[0]));
  const courses = Math.max(1, Math.round(s1 / module[1]));
  return { units, courses, unit: (a1 - a0) / units, exposure: s1 / courses };
}

/**
 * Every face merged into one mesh (one draw call per roof). With a `module`, each vertex also gets fitted
 * pattern coordinates in its own face's frame — see `TriMeshPrimitive.uvs`.
 */
export function buildSurfaceMesh(id: string, label: string, planes: readonly RoofPlane[], paint: Paint, surface: MaterialType, module?: PatternModule): TriMeshPrimitive | undefined {
  const vertices: number[] = [];
  const uvs: number[] = [];
  for (const plane of planes) {
    if (!plane.vertices.length) continue;
    vertices.push(...plane.vertices);
    if (!module) continue;
    const { a0, a1, s1 } = planeExtents(plane);
    const { units, courses } = courseLayout(plane, module);
    for (let i = 0; i < plane.vertices.length; i += 3) {
      const p = sub([plane.vertices[i], plane.vertices[i + 1], plane.vertices[i + 2]], plane.origin);
      uvs.push(((dot(p, plane.along) - a0) / Math.max(a1 - a0, EPS)) * units, (dot(p, plane.up) / Math.max(s1, EPS)) * courses);
    }
  }
  if (!vertices.length) return undefined;
  return { kind: "triMesh", id, category: "roof", label, vertices, ...paint, surface, ...(module ? { uvs, uvModule: [module[0], module[1]] as [number, number] } : {}) };
}

/** Seam lines across a face: evenly spaced from one side to the other at the spacing nearest `nominal`, so the pans are equal and the layout is symmetric. */
export function seamLayout(plane: RoofPlane, nominal: number): { pans: number; spacing: number; positions: number[] } {
  const { a0, a1 } = planeExtents(plane);
  const pans = Math.max(1, Math.round((a1 - a0) / nominal));
  const spacing = (a1 - a0) / pans;
  return { pans, spacing, positions: Array.from({ length: pans + 1 }, (_, i) => a0 + i * spacing) };
}

const MIN_SEAM_LENGTH = 0.15;

/**
 * Standing seams as real ribs: each runs straight up the slope from the low edge and stops where it meets the
 * face's boundary (a ridge, or the hip line on a hipped face). Returned as one triangle soup for every face.
 */
export function buildSeamRibs(planes: readonly RoofPlane[], nominal: number, rib: { width: number; height: number }): number[] {
  const out: number[] = [];
  const quad = (a: V3, b: V3, c: V3, d: V3) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  const half = rib.width / 2;
  for (const plane of planes) {
    const { a0, a1 } = planeExtents(plane);
    if (a1 - a0 < rib.width * 3) continue;
    // Ribs stand square to the face, so on a pitch their tops lean out past the low edge: stop them short by that lean.
    const lean = plane.normal[1] > 1e-6 ? Math.hypot(plane.normal[0], plane.normal[2]) / plane.normal[1] : 0;
    const setback = rib.height * Math.min(3, lean) + 0.005;
    for (const position of seamLayout(plane, nominal).positions) {
      // The two outermost seams sit just inside the face so they stay on it.
      const a = Math.min(Math.max(position, a0 + half + 1e-3), a1 - half - 1e-3);
      for (const [from, to] of slopeSpansAt(plane, a)) {
        const s0 = from + setback, s1 = to - setback;
        if (s1 - s0 < MIN_SEAM_LENGTH) continue;
        const at = (da: number, s: number, lift: number) => planePoint(plane, a + da, s, lift);
        quad(at(-half, s0, 0), at(-half, s1, 0), at(-half, s1, rib.height), at(-half, s0, rib.height));
        quad(at(half, s0, 0), at(half, s1, 0), at(half, s1, rib.height), at(half, s0, rib.height));
        quad(at(-half, s0, rib.height), at(-half, s1, rib.height), at(half, s1, rib.height), at(half, s0, rib.height));
        quad(at(-half, s0, 0), at(half, s0, 0), at(half, s0, rib.height), at(-half, s0, rib.height));
        quad(at(-half, s1, 0), at(half, s1, 0), at(half, s1, rib.height), at(-half, s1, rib.height));
      }
    }
  }
  return out;
}
