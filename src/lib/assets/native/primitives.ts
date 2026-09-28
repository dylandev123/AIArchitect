import { BufferGeometry, CatmullRomCurve3, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { arcPoints, roundedRectOutline } from "@/lib/house/geometry/mesh";
import { bevelRadius, STYLE_PROFILE, type DetailLevel } from "./styleProfile";

/**
 * Procedural primitives for small props. Each returns a triangle-soup BufferGeometry (position, normal, uv only) centred
 * on its own origin, beveled and segmented from the shared style profile. The house renderer's own outline helpers
 * (`roundedRectOutline`, `arcPoints`) and three's RoundedBoxGeometry (what the house bevels its boxes with) are reused.
 */

export interface PrimitiveContext {
  detail: DetailLevel;
  /** The asset-wide `bevel` multiplier. */
  bevel: number;
  /**
   * Triangle-budget lever: boxes whose smallest edge is under this (m) are built square-edged (12 triangles instead of 44+).
   * A bevel on a 2 cm slat is invisible at game-camera distance, so this trades no silhouette for a lot of triangles.
   */
  flatBelow?: number;
  /** Triangle-budget lever: pillows use the same edge segments as boxes instead of two more. */
  leanCushion?: boolean;
}

const segs = (c: PrimitiveContext) => STYLE_PROFILE.edgeSegments[c.detail];
const radial = (c: PrimitiveContext) => STYLE_PROFILE.radialSegments[c.detail];

/** UVs in metres / `textureScale`, projected along whichever axis each vertex faces, so a pattern keeps its real size on any part. */
function worldUv(g: BufferGeometry): void {
  const pos = g.getAttribute("position");
  const normal = g.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  const tile = STYLE_PROFILE.textureScale;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(normal.getX(i));
    const ay = Math.abs(normal.getY(i));
    const az = Math.abs(normal.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [pos.getZ(i), pos.getY(i)] : ay >= az ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
}

/** Non-indexed, with exactly position/normal/uv: the shape every builder hands back, so any two geometries merge. */
export function finalize(source: BufferGeometry): BufferGeometry {
  const g = source.index ? source.toNonIndexed() : source.clone();
  for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  worldUv(g);
  source.dispose();
  return g;
}

export const mergeAll = (parts: BufferGeometry[]): BufferGeometry => {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Could not merge geometry.");
  parts.forEach((p) => p.dispose());
  return merged;
};

/**
 * A box with rounded edges and corners built as flat faces + arc strips + octant corner patches, so it costs
 * 12 + 24s + 8s² triangles (s = edge segments) — a third of three's RoundedBoxGeometry at the same look. Faces wind outward.
 */
function bevelBoxGeometry(w: number, h: number, d: number, r: number, s: number): BufferGeometry {
  const half = [w / 2, h / 2, d / 2];
  const inner = half.map((v) => Math.max(0, v - r));
  const pos: number[] = [];
  const nor: number[] = [];
  const e = (a: number, sign = 1): [number, number, number] => [a === 0 ? sign : 0, a === 1 ? sign : 0, a === 2 ? sign : 0];
  const vertex = (p: number[], n: number[]) => ({ p, n });
  type V = { p: number[]; n: number[] };
  const tri = (a: V, b: V, c: V) => {
    // Wind outward: the geometric normal must agree with the mean vertex normal.
    const ux = b.p[0] - a.p[0], uy = b.p[1] - a.p[1], uz = b.p[2] - a.p[2];
    const vx = c.p[0] - a.p[0], vy = c.p[1] - a.p[1], vz = c.p[2] - a.p[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-18) return;
    const out = nx * (a.n[0] + b.n[0] + c.n[0]) + ny * (a.n[1] + b.n[1] + c.n[1]) + nz * (a.n[2] + b.n[2] + c.n[2]) >= 0;
    for (const v of out ? [a, b, c] : [a, c, b]) {
      pos.push(...v.p);
      nor.push(...v.n);
    }
  };
  const quad = (a: V, b: V, c: V, d: V) => (tri(a, b, c), tri(a, c, d));

  // Flat faces.
  for (let a = 0; a < 3; a++) {
    const [b, c] = [0, 1, 2].filter((i) => i !== a);
    for (const sign of [-1, 1]) {
      const n = e(a, sign);
      const at = (u: number, v: number) => {
        const p = [0, 0, 0];
        p[a] = sign * half[a];
        p[b] = u * inner[b];
        p[c] = v * inner[c];
        return vertex(p, n);
      };
      quad(at(-1, -1), at(1, -1), at(1, 1), at(-1, 1));
    }
  }
  // Edge strips: an arc swept along the third axis.
  for (let a = 0; a < 3; a++) {
    for (let b = a + 1; b < 3; b++) {
      const c = 3 - a - b;
      for (const sa of [-1, 1]) {
        for (const sb of [-1, 1]) {
          const ring = (k: number, along: number) => {
            const t = (Math.PI / 2) * (k / s);
            const n = [0, 0, 0];
            n[a] = sa * Math.cos(t);
            n[b] = sb * Math.sin(t);
            const p = [0, 0, 0];
            p[a] = sa * inner[a] + n[a] * r;
            p[b] = sb * inner[b] + n[b] * r;
            p[c] = along * inner[c];
            return vertex(p, n);
          };
          for (let k = 0; k < s; k++) quad(ring(k, -1), ring(k + 1, -1), ring(k + 1, 1), ring(k, 1));
        }
      }
    }
  }
  // Corner patches: an octant of a sphere, subdivided s times.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = (i: number, j: number) => {
          const l = Math.hypot(s - i - j, i, j);
          const n = [(sx * (s - i - j)) / l, (sy * i) / l, (sz * j) / l];
          return vertex([sx * inner[0] + n[0] * r, sy * inner[1] + n[1] * r, sz * inner[2] + n[2] * r], n);
        };
        for (let i = 0; i < s; i++) {
          for (let j = 0; j < s - i; j++) {
            tri(corner(i, j), corner(i + 1, j), corner(i, j + 1));
            if (i + j < s - 1) tri(corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1));
          }
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  return g;
}

/** Beveled box. `taper` shrinks the top face toward the base footprint's centre. */
export function beveledBox(size: readonly [number, number, number], c: PrimitiveContext, opts: { bevel?: number; taper?: number } = {}): BufferGeometry {
  const [w, h, d] = size;
  const edge = Math.min(w, h, d);
  const flat = c.flatBelow !== undefined && edge < c.flatBelow;
  const r = flat ? 0 : Math.min(bevelRadius(edge, c.bevel * (opts.bevel ?? 1)), edge / 2 - 1e-4);
  const g = bevelBoxGeometry(w, h, d, r, segs(c));
  if (opts.taper) {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const s = 1 - opts.taper * (pos.getY(i) / h + 0.5);
      pos.setX(i, pos.getX(i) * s);
      pos.setZ(i, pos.getZ(i) * s);
    }
    pos.needsUpdate = true;
  }
  return finalize(g);
}

/** Triangles with (numerically) zero area, e.g. a lathe's collapsed quads at the axis, cost draw budget and shade nothing. */
function dropDegenerate(g: BufferGeometry): BufferGeometry {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const keepPos: number[] = [];
  const keepNor: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [pos.getX(t), pos.getY(t), pos.getZ(t), pos.getX(t + 1), pos.getY(t + 1), pos.getZ(t + 1), pos.getX(t + 2), pos.getY(t + 2), pos.getZ(t + 2)];
    const [ux, uy, uz, vx, vy, vz] = [bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az];
    const [nx, ny, nz] = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (nx * nx + ny * ny + nz * nz < 1e-20) continue;
    for (let k = t; k < t + 3; k++) {
      keepPos.push(pos.getX(k), pos.getY(k), pos.getZ(k));
      keepNor.push(nor.getX(k), nor.getY(k), nor.getZ(k));
    }
  }
  const out = new BufferGeometry();
  out.setAttribute("position", new Float32BufferAttribute(keepPos, 3));
  out.setAttribute("normal", new Float32BufferAttribute(keepNor, 3));
  g.dispose();
  return out;
}

/** Cylinder and tapered cylinder in one: a lathe of a profile whose rims are beveled the same way boxes are. */
export function taperedCylinder(radiusBottom: number, radiusTop: number, height: number, c: PrimitiveContext, opts: { bevel?: number } = {}): BufferGeometry {
  const edge = Math.min(radiusBottom * 2, radiusTop * 2, height);
  const r = Math.min(bevelRadius(edge, c.bevel * (opts.bevel ?? 1)), radiusBottom * 0.9, radiusTop * 0.9, height * 0.4);
  const steps = segs(c) + 1;
  const pts: Vector2[] = [new Vector2(0, -height / 2)];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / steps);
    pts.push(new Vector2(radiusBottom - r + Math.cos(a) * r, -height / 2 + r + Math.sin(a) * r));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    pts.push(new Vector2(radiusTop - r + Math.cos(a) * r, height / 2 - r + Math.sin(a) * r));
  }
  pts.push(new Vector2(0, height / 2));
  return finalize(new LatheGeometry(pts, radial(c)));
}

export const cylinder = (radius: number, height: number, c: PrimitiveContext, opts: { bevel?: number } = {}) => taperedCylinder(radius, radius, height, c, opts);

/**
 * UV-sphere segment counts per detail level. The rings are half the radial segments, so it reads round from every angle at
 * `2·w·(h−1)` triangles: 80 / 224 / 728, about the price of a cylinder. Shared with the triangle estimator (`budget.ts`).
 */
export const sphereLayout = (c: Pick<PrimitiveContext, "detail">) => {
  const w = STYLE_PROFILE.radialSegments[c.detail];
  return { w, h: Math.max(4, Math.round(w / 2)) };
};

/** Smooth ball: bulbs, finials, knobs, globes, orb lights. */
export function sphere(radius: number, c: PrimitiveContext): BufferGeometry {
  const { w, h } = sphereLayout(c);
  return finalize(new SphereGeometry(radius, w, h));
}

/**
 * A cone (base on the bottom, apex on top). The base rim is beveled the way a tapered cylinder's is: the profile reaches the
 * full `radius` one bevel above the base and runs straight to the apex, so the bounding box is exactly `radius` × `height`
 * (the builder fits assets to their declared size by it). `2·w·(edge segments + 1)` triangles.
 */
export function cone(radius: number, height: number, c: PrimitiveContext, opts: { bevel?: number } = {}): BufferGeometry {
  const r = Math.min(bevelRadius(Math.min(radius * 2, height), c.bevel * (opts.bevel ?? 1)), radius * 0.5, height * 0.25);
  const steps = segs(c);
  const pts: Vector2[] = [new Vector2(0, -height / 2)];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / steps);
    pts.push(new Vector2(radius - r + Math.cos(a) * r, -height / 2 + r + Math.sin(a) * r));
  }
  pts.push(new Vector2(0, height / 2));
  return finalize(dropDegenerate(new LatheGeometry(pts, radial(c)).toNonIndexed()));
}

/** Tube-ring segment counts of a torus (the `tube` primitive's ring sizes), shared with the estimator: `2·radial·ring` triangles. */
export const torusLayout = (c: Pick<PrimitiveContext, "detail">) => ({ radial: STYLE_PROFILE.radialSegments[c.detail], ring: c.detail === "low" ? 5 : c.detail === "medium" ? 8 : 12 });

/** A ring lying flat (its axis is +y; rotate the part to stand it up): rims, hoops, rings, rope coils. `radius` is to the tube's centre. */
export function torus(radius: number, tubeRadius: number, c: PrimitiveContext): BufferGeometry {
  const { radial: around, ring } = torusLayout(c);
  const g = new TorusGeometry(radius, tubeRadius, ring, around);
  g.rotateX(-Math.PI / 2);
  return finalize(g);
}

/** Rounded-rectangle plate/block extruded upward, with beveled top and bottom edges. */
export function roundedRect(width: number, depth: number, height: number, cornerRadius: number, c: PrimitiveContext, opts: { bevel?: number } = {}): BufferGeometry {
  const r = Math.min(bevelRadius(Math.min(width, depth, height), c.bevel * (opts.bevel ?? 1)), Math.min(width, depth, height) / 2 - 1e-4);
  const outline = roundedRectOutline(Math.max(1e-3, width - 2 * r), Math.max(1e-3, depth - 2 * r), Math.max(0, cornerRadius - r), Math.max(2, segs(c) * 3));
  const shape = new Shape(outline.map(([x, z]) => new Vector2(x, z)));
  const g = new ExtrudeGeometry(shape, { depth: Math.max(1e-3, height - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: segs(c), curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.center();
  return finalize(g);
}

/** A rail swept along a smooth path, capped with spheres so both ends are round. */
export function tube(path: readonly (readonly [number, number, number])[], radius: number, c: PrimitiveContext): BufferGeometry {
  const curve = new CatmullRomCurve3(path.map(([x, y, z]) => new Vector3(x, y, z)), false, "catmullrom", 0.3);
  const ring = c.detail === "low" ? 5 : c.detail === "medium" ? 8 : 12;
  const body = new TubeGeometry(curve, Math.max(2, (path.length - 1) * (segs(c) + 2)), radius, ring, false);
  const cap = (p: Vector3) => new SphereGeometry(radius, ring, 3).translate(p.x, p.y, p.z);
  return mergeAll([finalize(body), finalize(cap(curve.getPoint(0))), finalize(cap(curve.getPoint(1)))]);
}

/** Pillowy block: a box whose bevel is most of its smallest half-edge. */
export function cushion(size: readonly [number, number, number], puff: number, c: PrimitiveContext): BufferGeometry {
  const [w, h, d] = size;
  const edge = Math.min(w, h, d);
  const r = Math.min(edge * 0.5 * (0.35 + 0.6 * puff), edge / 2 - 1e-4);
  return finalize(bevelBoxGeometry(w, h, d, r, segs(c) + (c.leanCushion ? 0 : 2)));
}

/** Thin flat board. `size` is [width, height, thickness]. */
export const panel = (size: readonly [number, number, number], c: PrimitiveContext, opts: { bevel?: number } = {}) => beveledBox(size, c, { bevel: (opts.bevel ?? 1) * 0.6 });

/** `count` beveled slats along `axis`, `gap` apart, centred on the origin. */
export function slatArray(count: number, slatSize: readonly [number, number, number], gap: number, axis: "x" | "y" | "z", c: PrimitiveContext, opts: { bevel?: number } = {}): BufferGeometry {
  const a = { x: 0, y: 1, z: 2 }[axis];
  const pitch = slatSize[a] + gap;
  const slats = Array.from({ length: count }, (_, i) => {
    const g = beveledBox(slatSize, c, opts);
    const offset = (i - (count - 1) / 2) * pitch;
    g.translate(a === 0 ? offset : 0, a === 1 ? offset : 0, a === 2 ? offset : 0);
    return g;
  });
  return mergeAll(slats);
}

/** A curved shell (arc of a ring) centred on +z, extruded upward; the origin is the arc's centre of curvature. */
export function curvedSurface(radius: number, arcDegrees: number, height: number, thickness: number, c: PrimitiveContext, opts: { bevel?: number } = {}): BufferGeometry {
  const r = Math.min(bevelRadius(Math.min(thickness, height), c.bevel * (opts.bevel ?? 1)), thickness / 2 - 1e-4, height / 2 - 1e-4);
  const n = Math.max(6, Math.ceil(arcDegrees / (c.detail === "low" ? 18 : c.detail === "medium" ? 10 : 6)));
  // The extrusion turn (rotateX -90°) maps shape-y to -z, so centre the arc on shape -y to face +z.
  const start = -90 - arcDegrees / 2;
  const outer = arcPoints(0, 0, radius + thickness / 2 - r, start, arcDegrees, n);
  const inner = arcPoints(0, 0, radius - thickness / 2 + r, start, arcDegrees, n).reverse();
  const shape = new Shape([...outer, ...inner].map(([x, z]) => new Vector2(x, z)));
  const g = new ExtrudeGeometry(shape, { depth: Math.max(1e-3, height - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: segs(c), curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(height / 2 - r), 0);
  return finalize(g);
}

// ── Lattice ─────────────────────────────────────────────────────────────────

export interface LatticeParams {
  form: "panel" | "tapered" | "dome";
  /** Panel width (m). */
  width?: number;
  /** Tapered / dome footprint radii (m); `radiusTop` defaults to the bottom radius (a straight drum) for `tapered`, and to a small crown for `dome`. */
  radiusBottom?: number;
  radiusTop?: number;
  height: number;
  /** Strands running up the surface (columns of a panel). */
  ribs: number;
  /** Interior strands running around it (rows of a panel); a stronger rim strand is always added at the open edges. */
  bands: number;
  /** Strand width (m); a strand is `strand` wide and 60% of that thick. */
  strand: number;
  /** Alternate ribs proud of / behind the bands, which is what reads as "woven" at game-camera distance. */
  weave: boolean;
}

const latticeRadii = (p: LatticeParams): [number, number] => {
  const rb = p.radiusBottom ?? 0.2;
  return [rb, p.radiusTop ?? (p.form === "dome" ? rb * 0.08 : rb)];
};

/** The lattice's own segment rules, shared with the triangle estimator (`budget.ts`) so the two cannot drift apart. */
export function latticeLayout(p: LatticeParams, c: Pick<PrimitiveContext, "detail">) {
  const sides = c.detail === "high" ? 8 : 4;
  const radialSegs = STYLE_PROFILE.radialSegments[c.detail];
  const ringSegs = p.ribs * Math.max(1, Math.round(radialSegs / p.ribs));
  const profileSegs = p.form === "dome" ? { low: 4, medium: 6, high: 8 }[c.detail] : 1;
  const [rb, rt] = latticeRadii(p);
  const crown = p.form === "dome" && rt > 0.02 * rb;
  // Rings: the interior bands plus a rim at each open end (a dome's crown ring only when it has an opening at the top).
  const rings = p.bands + (p.form === "panel" ? 0 : p.form === "dome" ? 1 + (crown ? 1 : 0) : 2);
  return { sides, ringSegs, profileSegs, rings };
}

type V3 = [number, number, number];
interface Frame { p: V3; n: V3; l: V3 }

/**
 * Sweeps a small rectangular (or, at high detail, chamfered) section along `frames` — `l` is the section's width axis,
 * `n` its thickness axis — as flat-shaded quads wound outward. Open sweeps can be capped. This is the whole trick behind the
 * lattice: strands are ribbons with four sides, not tubes or fibres.
 */
function sweep(out: number[], frames: readonly Frame[], width: number, thick: number, sides: number, closed: boolean, cap: boolean): void {
  const hw = width / 2;
  const ht = thick / 2;
  const ch = Math.min(hw, ht) * 0.45;
  // Counter-clockwise in (l, n).
  const section: [number, number][] = sides === 8
    ? [[-hw + ch, -ht], [hw - ch, -ht], [hw, -ht + ch], [hw, ht - ch], [hw - ch, ht], [-hw + ch, ht], [-hw, ht - ch], [-hw, -ht + ch]]
    : [[-hw, -ht], [hw, -ht], [hw, ht], [-hw, ht]];
  const at = (f: Frame, [a, b]: [number, number]): V3 => [f.p[0] + f.l[0] * a + f.n[0] * b, f.p[1] + f.l[1] * a + f.n[1] * b, f.p[2] + f.l[2] * a + f.n[2] * b];
  const tri = (a: V3, b: V3, c: V3, hint: V3) => {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (nx * nx + ny * ny + nz * nz < 1e-20) return;
    for (const v of nx * hint[0] + ny * hint[1] + nz * hint[2] >= 0 ? [a, b, c] : [a, c, b]) out.push(...v);
  };
  const segments = closed ? frames.length : frames.length - 1;
  for (let i = 0; i < segments; i++) {
    const f0 = frames[i];
    const f1 = frames[(i + 1) % frames.length];
    for (let k = 0; k < section.length; k++) {
      const s0 = section[k];
      const s1 = section[(k + 1) % section.length];
      // Outward hint of this side: the section edge's 2-D normal, expressed in the frame's axes.
      const ex = s1[1] - s0[1];
      const ey = -(s1[0] - s0[0]);
      const hint: V3 = [0, 1, 2].map((j) => (f0.l[j] + f1.l[j]) * 0.5 * ex + (f0.n[j] + f1.n[j]) * 0.5 * ey) as V3;
      const [a, b, c, d] = [at(f0, s0), at(f0, s1), at(f1, s1), at(f1, s0)];
      tri(a, b, c, hint);
      tri(a, c, d, hint);
    }
  }
  if (!cap || closed) return;
  for (const [f, sign] of [[frames[0], -1], [frames[frames.length - 1], 1]] as const) {
    const dir: V3 = [f.n[1] * f.l[2] - f.n[2] * f.l[1], f.n[2] * f.l[0] - f.n[0] * f.l[2], f.n[0] * f.l[1] - f.n[1] * f.l[0]];
    const hint: V3 = [dir[0] * sign, dir[1] * sign, dir[2] * sign];
    for (let k = 1; k < section.length - 1; k++) tri(at(f, section[0]), at(f, section[k]), at(f, section[k + 1]), hint);
  }
}

/**
 * A lightweight woven / lattice surface: a grid of flat strands, never individual fibres. `panel` is a flat screen or chair
 * panel; `tapered` a basket, drum shade or planter wall (a cone frustum); `dome` a pendant-style shell. A stronger rim strand
 * closes each open edge. Around 10-40 triangles per strand, so a whole woven shade lands well under 2,000 triangles.
 */
export function lattice(p: LatticeParams, c: PrimitiveContext): BufferGeometry {
  const { sides, ringSegs, profileSegs } = latticeLayout(p, c);
  const t = p.strand * 0.6;
  const drift = p.weave ? t * 0.5 : 0;
  const out: number[] = [];
  const rimWidth = p.strand * 1.5;
  const rimThick = t * (p.weave ? 2.2 : 1.2);

  if (p.form === "panel") {
    const w = p.width ?? 0.5;
    const h = p.height;
    const bar = (x0: number, y0: number, x1: number, y1: number, z: number, width: number, thick: number, cap: boolean) => {
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const l: V3 = [-dy / len, dx / len, 0];
      sweep(out, [{ p: [x0, y0, z], n: [0, 0, 1], l }, { p: [x1, y1, z], n: [0, 0, 1], l }], width, thick, sides, false, cap);
    };
    // Interior strands, kept clear of the rim strands.
    const inX = w / 2 - rimWidth * 0.75;
    const inY = h / 2 - rimWidth * 0.75;
    for (let i = 0; i < p.ribs; i++) {
      const x = p.ribs === 1 ? 0 : -inX + (2 * inX * i) / (p.ribs - 1);
      bar(x, -inY, x, inY, i % 2 ? drift : -drift, p.strand, t, false);
    }
    for (let j = 0; j < p.bands; j++) bar(-inX, -inY + (2 * inY * (j + 1)) / (p.bands + 1), inX, -inY + (2 * inY * (j + 1)) / (p.bands + 1), 0, p.strand, t, false);
    // Frame.
    bar(-w / 2 + rimWidth / 2, -h / 2 + rimWidth, -w / 2 + rimWidth / 2, h / 2 - rimWidth, 0, rimWidth, rimThick, true);
    bar(w / 2 - rimWidth / 2, -h / 2 + rimWidth, w / 2 - rimWidth / 2, h / 2 - rimWidth, 0, rimWidth, rimThick, true);
    bar(-w / 2, -h / 2 + rimWidth / 2, w / 2, -h / 2 + rimWidth / 2, 0, rimWidth, rimThick, true);
    bar(-w / 2, h / 2 - rimWidth / 2, w / 2, h / 2 - rimWidth / 2, 0, rimWidth, rimThick, true);
    return finalize(geometryFrom(out));
  }

  const [rb, rtRaw] = latticeRadii(p);
  const inset = rimWidth * 0.5;
  // Radius at height fraction u (0 = bottom rim, 1 = top), measured on the strand centre-layer.
  const radiusAt = (u: number) => (p.form === "dome" ? rtRaw + (rb - rtRaw) * Math.sqrt(Math.max(0, 1 - u * u)) : rb + (rtRaw - rb) * u);
  const yAt = (u: number) => -p.height / 2 + p.height * u;
  const profileFrame = (u: number, theta: number, offset: number, along: "ring" | "profile"): Frame => {
    const e = 1e-3;
    const dr = (radiusAt(Math.min(1, u + e)) - radiusAt(Math.max(0, u - e))) / (Math.min(1, u + e) - Math.max(0, u - e));
    const dy = p.height;
    const len = Math.hypot(dr, dy);
    const nr = dy / len; // outward component of the surface normal
    const ny = -dr / len;
    const [cs, sn] = [Math.cos(theta), Math.sin(theta)];
    const n: V3 = [nr * cs, ny, nr * sn];
    const r = radiusAt(u) + nr * offset;
    const l: V3 = along === "ring" ? [-sn, 0, cs] : [(dr / len) * cs, dy / len, (dr / len) * sn];
    return { p: [r * cs, yAt(u) + ny * offset, r * sn], n, l };
  };

  // Ribs run bottom-rim → top along the profile; alternate ribs sit proud of / behind the band layer.
  for (let i = 0; i < p.ribs; i++) {
    const theta = (2 * Math.PI * i) / p.ribs;
    const offset = i % 2 ? drift : -drift;
    const frames = Array.from({ length: profileSegs + 1 }, (_, k) => profileFrame(k / profileSegs, theta, offset, "ring"));
    sweep(out, frames, p.strand, t, sides, false, false);
  }
  // Bands: closed rings on the centre layer, evenly spaced between the rims.
  const ring = (u: number, width: number, thick: number) => {
    const frames = Array.from({ length: ringSegs }, (_, k) => profileFrame(u, (2 * Math.PI * k) / ringSegs, 0, "profile"));
    sweep(out, frames, width, thick, sides, true, false);
  };
  for (let j = 0; j < p.bands; j++) ring((j + 1) / (p.bands + 1), p.strand, t);
  const rimU = Math.min(0.25, inset / p.height);
  ring(rimU * 0.5, rimWidth, rimThick);
  if (p.form === "tapered") ring(1 - rimU * 0.5, rimWidth, rimThick);
  else if (rtRaw > 0.02 * rb) ring(1 - rimU * 0.5, rimWidth, rimThick);
  return finalize(geometryFrom(out));
}

function geometryFrom(pos: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
