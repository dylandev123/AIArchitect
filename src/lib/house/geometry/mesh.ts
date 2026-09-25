import type { PrimitiveCategory, TriMeshPrimitive } from "../types";
import type { Paint } from "../architecture/parts";

/**
 * Reusable geometry primitives: arcs, bowed curves, ribbons, extruded outlines and their triangulation.
 *
 * Everything works on plain arrays of numbers and returns flat triangle lists (`[x,y,z, x,y,z, …]`), the same
 * format a `triMesh` primitive carries, so any feature can compose them without touching the renderer. Triangle
 * winding is not significant: the renderer draws both faces and derives normals per triangle.
 */

/** A point on the ground plane: [x, z]. */
export type P2 = [number, number];
/** Ground height at a point, for ribbons and skirts that follow the terrain. */
export type HeightFn = (x: number, z: number) => number;

const DEG = Math.PI / 180;

export function triMeshOf(id: string, category: PrimitiveCategory, label: string, vertices: number[], paint: Paint): TriMeshPrimitive {
  return { kind: "triMesh", id, category, label, vertices, ...paint };
}

// ── Curves ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Points along an arc: angle 0 = +x (east), 90 = +z (south). `segments + 1` points, end points included. */
export function arcPoints(cx: number, cz: number, radius: number, startDeg: number, sweepDeg: number, segments: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (startDeg + (sweepDeg * i) / segments) * DEG;
    out.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
  }
  return out;
}

/** Sample count for an arc so that no chord spans more than `stepDeg` degrees. */
export function arcSegments(sweepDeg: number, stepDeg = 7.5): number {
  return Math.max(2, Math.ceil(Math.abs(sweepDeg) / stepDeg));
}

/**
 * A curve from `a` to `b` bowed sideways so its midpoint sits `bend` metres off the straight line (positive bends
 * to the left of the direction of travel, looking down with x east and z south). `bend = 0` is a straight line.
 */
export function bowedCurve(a: P2, b: P2, bend: number, samples: number): P2[] {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  // A quadratic Bezier's midpoint is half-way to its control point, so the control sits 2 × bend off the chord.
  const cx = (a[0] + b[0]) / 2 + nx * bend * 2;
  const cz = (a[1] + b[1]) / 2 + nz * bend * 2;
  const out: P2[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cz + t * t * b[1]]);
  }
  return out;
}

export function polylineLength(points: readonly P2[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return len;
}

/** Samples for a curve of about `length` metres so segments stay roughly `step` metres long. */
export function samplesFor(length: number, step = 2, min = 4, max = 120): number {
  return Math.min(max, Math.max(min, Math.ceil(length / step)));
}

/** Left-hand unit normal at each point of a polyline (averaged across joins), looking down with x east, z south. */
export function polylineNormals(points: readonly P2[]): P2[] {
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len];
  });
}

/** The polyline shifted sideways by `dist` (positive = left of travel). */
export function offsetPolyline(points: readonly P2[], dist: number): P2[] {
  const normals = polylineNormals(points);
  return points.map((p, i) => [p[0] + normals[i][0] * dist, p[1] + normals[i][1] * dist]);
}

/** Adds a sideways sine wander along a polyline; ends stay put so the curve still meets its end points. */
export function meander(points: readonly P2[], amplitude: number, wavelength: number, phase: number): P2[] {
  const normals = polylineNormals(points);
  const total = polylineLength(points) || 1;
  let run = 0;
  return points.map((p, i) => {
    if (i > 0) run += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]);
    const t = run / total;
    const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, t))); // 0 at both ends, 1 mid-way
    const off = Math.sin((run / wavelength) * Math.PI * 2 + phase) * amplitude * taper;
    return [p[0] + normals[i][0] * off, p[1] + normals[i][1] * off];
  });
}

/** Point and unit tangent `t` (0–1) of the way along a polyline, measured by length. */
export function pointAlong(points: readonly P2[], t: number): { p: P2; tangent: P2 } {
  const total = polylineLength(points);
  let target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (target <= seg || i === points.length - 1) {
      const k = seg === 0 ? 0 : Math.min(1, target / seg);
      const dx = points[i][0] - points[i - 1][0];
      const dz = points[i][1] - points[i - 1][1];
      const len = Math.hypot(dx, dz) || 1;
      return { p: [points[i - 1][0] + dx * k, points[i - 1][1] + dz * k], tangent: [dx / len, dz / len] };
    }
    target -= seg;
  }
  return { p: points[0], tangent: [1, 0] };
}

// ── Outlines ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Closed outline of a rounded rectangle centred on the origin. `radius` is clamped to fit. */
export function roundedRectOutline(width: number, depth: number, radius: number, cornerSegments = 6): P2[] {
  const r = Math.max(0, Math.min(radius, width / 2, depth / 2));
  if (r < 1e-3) {
    const hw = width / 2;
    const hd = depth / 2;
    return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  }
  const hw = width / 2 - r;
  const hd = depth / 2 - r;
  const corners: [number, number, number][] = [[hw, hd, 0], [-hw, hd, 90], [-hw, -hd, 180], [hw, -hd, 270]];
  const out: P2[] = [];
  for (const [cx, cz, start] of corners) out.push(...arcPoints(cx, cz, r, start, 90, cornerSegments));
  return out;
}

export function ellipseOutline(width: number, depth: number, segments = 36): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    out.push([Math.cos(a) * width / 2, Math.sin(a) * depth / 2]);
  }
  return out;
}

/**
 * Kidney / free-form outline: an ellipse with a shallow bite taken out of one long side, then a bulge on the other.
 */
export function kidneyOutline(width: number, depth: number, segments = 40): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // Pull the +z edge inward at the middle and push the -z edge outward at one end.
    const dent = s > 0 ? 0.28 * (1 - c * c) * s : 0;
    const swell = s < 0 ? 0.1 * c * -s : 0;
    out.push([c * width / 2, (s * (1 - dent) + swell) * depth / 2]);
  }
  return out;
}

/** Scales an outline about its centroid so it grows by roughly `by` metres each side (negative shrinks). */
export function growOutline(outline: readonly P2[], by: number): P2[] {
  const [cx, cz] = centroid(outline);
  let maxX = 0;
  let maxZ = 0;
  for (const [x, z] of outline) {
    maxX = Math.max(maxX, Math.abs(x - cx));
    maxZ = Math.max(maxZ, Math.abs(z - cz));
  }
  const sx = maxX > 0 ? (maxX + by) / maxX : 1;
  const sz = maxZ > 0 ? (maxZ + by) / maxZ : 1;
  return outline.map(([x, z]) => [cx + (x - cx) * sx, cz + (z - cz) * sz]);
}

export function centroid(points: readonly P2[]): P2 {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p[0];
    z += p[1];
  }
  return [x / points.length, z / points.length];
}

export function translateOutline(outline: readonly P2[], dx: number, dz: number, rotationRad = 0): P2[] {
  const c = Math.cos(rotationRad);
  const s = Math.sin(rotationRad);
  return outline.map(([x, z]) => [dx + x * c - z * s, dz + x * s + z * c]);
}

// ── Triangulation ──────────────────────────────────────────────────────────────────────────────────────────────

function signedArea(poly: readonly P2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

function pointInTriangle(p: P2, a: P2, b: P2, c: P2): boolean {
  const d = (p1: P2, p2: P2, p3: P2) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = d(p, a, b);
  const d2 = d(p, b, c);
  const d3 = d(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Ear-clipping triangulation of a simple polygon; returns index triples into `outline`. */
export function triangulate(outline: readonly P2[]): [number, number, number][] {
  const n = outline.length;
  if (n < 3) return [];
  const idx = outline.map((_, i) => i);
  if (signedArea(outline) < 0) idx.reverse();
  const tris: [number, number, number][] = [];
  let guard = n * n;
  while (idx.length > 3 && guard-- > 0) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      const a = outline[ia];
      const b = outline[ib];
      const c = outline[ic];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 1e-9) continue; // reflex or degenerate
      if (idx.some((k) => k !== ia && k !== ib && k !== ic && pointInTriangle(outline[k], a, b, c))) continue;
      tris.push([ia, ib, ic]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break; // degenerate input: stop rather than loop forever
  }
  if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

// ── Meshes ─────────────────────────────────────────────────────────────────────────────────────────────────────

const push = (out: number[], x: number, y: number, z: number) => out.push(x, y, z);

/** Two triangles for the quad a-b-c-d (given around its perimeter). */
export function quadVerts(out: number[], a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]): void {
  for (const p of [a, b, c, a, c, d]) push(out, p[0], p[1], p[2]);
}

/** A flat filled polygon at height `y` (a constant, or a function of position for terrain-following fills). */
export function flatPolygon(outline: readonly P2[], y: number | HeightFn): number[] {
  const out: number[] = [];
  const h = typeof y === "number" ? () => y : y;
  for (const [i, j, k] of triangulate(outline)) {
    for (const p of [outline[i], outline[j], outline[k]]) push(out, p[0], h(p[0], p[1]), p[1]);
  }
  return out;
}

/** A flat strip between two polylines of equal length (e.g. the two edges of a road). */
export function stripBetween(a: readonly P2[], b: readonly P2[], y: number | HeightFn): number[] {
  const out: number[] = [];
  const h = typeof y === "number" ? () => y : y;
  const v = (p: P2): [number, number, number] => [p[0], h(p[0], p[1]), p[1]];
  for (let i = 0; i < a.length - 1; i++) quadVerts(out, v(a[i]), v(a[i + 1]), v(b[i + 1]), v(b[i]));
  return out;
}

/** A ribbon of constant `width` centred on a polyline, lying at height `y`. */
export function ribbon(center: readonly P2[], width: number, y: number | HeightFn): number[] {
  return stripBetween(offsetPolyline(center, width / 2), offsetPolyline(center, -width / 2), y);
}

/** A closed outline extruded from `y0` up to `y1`: the side walls plus a top cap (and a bottom cap when asked). */
export function extrudeOutline(outline: readonly P2[], y0: number, y1: number, opts: { bottom?: boolean } = {}): number[] {
  const out: number[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = outline[i];
    const [x2, z2] = outline[(i + 1) % n];
    quadVerts(out, [x1, y0, z1], [x2, y0, z2], [x2, y1, z2], [x1, y1, z1]);
  }
  out.push(...flatPolygon(outline, y1));
  if (opts.bottom) out.push(...flatPolygon(outline, y0));
  return out;
}

/**
 * The band between two open polylines of equal length, raised from `y0` to `y1`: both faces, the top and the two
 * end caps. This is a curved wall, a retaining wall or a pool shell — anything with thickness that follows a curve.
 */
export function extrudeBand(a: readonly P2[], b: readonly P2[], y0: number | HeightFn, y1: number | HeightFn): number[] {
  const out: number[] = [];
  const lo = typeof y0 === "number" ? () => y0 : y0;
  const hi = typeof y1 === "number" ? () => y1 : y1;
  const bot = (p: P2): [number, number, number] => [p[0], lo(p[0], p[1]), p[1]];
  const top = (p: P2): [number, number, number] => [p[0], hi(p[0], p[1]), p[1]];
  for (let i = 0; i < a.length - 1; i++) {
    quadVerts(out, bot(a[i]), bot(a[i + 1]), top(a[i + 1]), top(a[i]));
    quadVerts(out, bot(b[i]), bot(b[i + 1]), top(b[i + 1]), top(b[i]));
    quadVerts(out, top(a[i]), top(a[i + 1]), top(b[i + 1]), top(b[i]));
  }
  const last = a.length - 1;
  quadVerts(out, bot(a[0]), bot(b[0]), top(b[0]), top(a[0]));
  quadVerts(out, bot(a[last]), bot(b[last]), top(b[last]), top(a[last]));
  return out;
}

/** A closed ring between an outer and inner outline of equal point count, as a flat surface at `y`. */
export function ringBetween(outer: readonly P2[], inner: readonly P2[], y: number): number[] {
  const out: number[] = [];
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quadVerts(out, [outer[i][0], y, outer[i][1]], [outer[j][0], y, outer[j][1]], [inner[j][0], y, inner[j][1]], [inner[i][0], y, inner[i][1]]);
  }
  return out;
}

/** A fan of triangles from `apex` to each edge of the outline: a cone or pyramid roof over any polygon. */
export function fanToApex(outline: readonly P2[], y: number, apex: [number, number, number]): number[] {
  const out: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    for (const p of [[outline[i][0], y, outline[i][1]], [outline[j][0], y, outline[j][1]], apex]) push(out, p[0], p[1], p[2]);
  }
  return out;
}

/** A closed box mesh, rotated about the vertical axis — for planks, slabs and steps too small to be worth a primitive each. */
export function orientedBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rotY = 0): number[] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const corner = (ix: number, iy: number, iz: number): [number, number, number] => {
    const lx = (ix - 0.5) * sx;
    const lz = (iz - 0.5) * sz;
    return [cx + lx * c + lz * s, cy + (iy - 0.5) * sy, cz - lx * s + lz * c];
  };
  const out: number[] = [];
  const face = (a: [number, number, number], b: [number, number, number], c2: [number, number, number], d: [number, number, number]) => quadVerts(out, a, b, c2, d);
  face(corner(0, 0, 0), corner(1, 0, 0), corner(1, 1, 0), corner(0, 1, 0));
  face(corner(0, 0, 1), corner(1, 0, 1), corner(1, 1, 1), corner(0, 1, 1));
  face(corner(0, 0, 0), corner(0, 0, 1), corner(0, 1, 1), corner(0, 1, 0));
  face(corner(1, 0, 0), corner(1, 0, 1), corner(1, 1, 1), corner(1, 1, 0));
  face(corner(0, 1, 0), corner(1, 1, 0), corner(1, 1, 1), corner(0, 1, 1));
  return out;
}

/** The vertical faces around a closed outline, with no top or bottom — the inside of a pool, the edge of a slab. */
export function loopWall(outline: readonly P2[], y0: number, y1: number): number[] {
  const out: number[] = [];
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const [x1, z1] = outline[i];
    const [x2, z2] = outline[(i + 1) % n];
    quadVerts(out, [x1, y0, z1], [x2, y0, z2], [x2, y1, z2], [x1, y1, z1]);
  }
  return out;
}
