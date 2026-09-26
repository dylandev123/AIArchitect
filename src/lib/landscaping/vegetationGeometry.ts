import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Low-poly stylised vegetation (Sims-like: soft clumped foliage, vertex-colour shading, no textures). One builder
 * serves two consumers: `scripts/build-vegetation.mjs` bakes it into the lightweight GLBs in public/models/vegetation,
 * and the viewport calls it at runtime as the procedural fallback when a GLB can't be loaded. The two therefore match.
 *
 * Deliberately dependency-free apart from three (no `@/` imports) so plain Node can run it.
 */

export type VegetationKind = "oak" | "oak-tall" | "pine" | "cypress" | "palm" | "shrub" | "shrub-flowering";

export interface VegetationParts {
  /** Trunk and branches — tinted by vertex colour only. */
  bark: THREE.BufferGeometry | null;
  /** Foliage — vertex colours carry the light-to-dark shading; the material colour tints the whole species. */
  leaf: THREE.BufferGeometry;
  /** Native size in metres (the ground is y = 0). */
  height: number;
  radius: number;
}

function rng32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fract = (x: number) => x - Math.floor(x);
const hash3 = (x: number, y: number, z: number) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);

/** Smooth 3D value noise in [0,1]. */
function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), sx), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), sx), sy),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), sx), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), sx), sy),
    sz
  );
}

type Ramp = { low: THREE.Color; high: THREE.Color };

const ramp = (low: string, high: string): Ramp => ({ low: new THREE.Color(low), high: new THREE.Color(high) });

function paint(geo: THREE.BufferGeometry, colorAt: (x: number, y: number, z: number) => THREE.Color): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = colorAt(pos.getX(i), pos.getY(i), pos.getZ(i));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** A lumpy, smooth-shaded blob (displaced icosphere with welded vertices). */
function blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, lumps: number, seed: number, detail = 2): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute("uv");
  geo.deleteAttribute("normal");
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = noise3(v.x * 1.8 + seed, v.y * 1.8 + seed * 0.7, v.z * 1.8 - seed) * 0.6 + noise3(v.x * 4.1 - seed, v.y * 4.1, v.z * 4.1 + seed) * 0.4;
    const k = 1 + (n - 0.5) * lumps;
    pos.setXYZ(i, cx + v.x * rx * k, cy + v.y * ry * k, cz + v.z * rz * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Foliage shading: dark inside and underneath, sunlit on top and outward, with a little per-vertex mottling. */
function shadeFoliage(geo: THREE.BufferGeometry, r: Ramp, yMin: number, yMax: number, seed: number, centre: [number, number], spread: number): THREE.BufferGeometry {
  const c = new THREE.Color();
  return paint(geo, (x, y, z) => {
    const t = THREE.MathUtils.clamp((y - yMin) / Math.max(0.001, yMax - yMin), 0, 1);
    const outward = THREE.MathUtils.clamp(Math.hypot(x - centre[0], z - centre[1]) / spread, 0, 1);
    const lit = Math.pow(t, 0.85) * 0.75 + outward * 0.25;
    const mottle = (noise3(x * 2.3 + seed, y * 2.3, z * 2.3) - 0.5) * 0.28;
    c.copy(r.low).lerp(r.high, THREE.MathUtils.clamp(lit + mottle, 0, 1));
    return c;
  });
}

const BARK = ramp("#4a3020", "#7a5a3a");

/** Tapered, slightly flared trunk along a gentle curve, with optional branches. Returns merged bark geometry. */
function trunk(height: number, baseR: number, topR: number, bend: number, seed: number, branches: { y: number; angle: number; len: number; pitch: number }[] = []): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const segs = 6;
  const centre = (t: number) => new THREE.Vector3(Math.sin(t * Math.PI) * bend, t * height, Math.cos(t * 2.1 + seed) * bend * 0.35);
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const a = centre(t0), b = centre(t1);
    const r0 = THREE.MathUtils.lerp(baseR, topR, t0) * (i === 0 ? 1.25 : 1);
    const r1 = THREE.MathUtils.lerp(baseR, topR, t1);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r1, r0, len, 8, 1, false);
    g.deleteAttribute("uv");
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    parts.push(g);
  }
  for (const br of branches) {
    const base = centre(br.y / height);
    const dir = new THREE.Vector3(Math.cos(br.angle) * Math.cos(br.pitch), Math.sin(br.pitch), Math.sin(br.angle) * Math.cos(br.pitch));
    const g = new THREE.CylinderGeometry(topR * 0.35, topR * 0.8, br.len, 6, 1, false);
    g.deleteAttribute("uv");
    g.translate(0, br.len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(base.x, base.y, base.z);
    parts.push(g);
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
  merged.computeVertexNormals();
  return paint(merged, (_x, y) => new THREE.Color().copy(BARK.low).lerp(BARK.high, THREE.MathUtils.clamp(y / height, 0, 1) * 0.7));
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

function bounds(...geos: (THREE.BufferGeometry | null)[]): { height: number; radius: number } {
  const box = new THREE.Box3();
  for (const g of geos) if (g) box.union(new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute));
  return { height: box.max.y, radius: Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z) };
}

// ── Species ───────────────────────────────────────────────────────────────────────────────────

function oak(seed: number, tall: boolean): VegetationParts {
  const r = rng32(seed);
  const trunkH = tall ? 3.0 : 2.1;
  const R = tall ? 1.9 : 2.3;
  const crownY = trunkH + R * 0.55;
  const bark = trunk(trunkH + 0.9, 0.24, 0.13, 0.12 + r() * 0.1, seed, [
    { y: trunkH * 0.7, angle: r() * 6.28, len: 1.4, pitch: 0.9 },
    { y: trunkH * 0.85, angle: r() * 6.28, len: 1.5, pitch: 0.8 },
    { y: trunkH * 0.95, angle: r() * 6.28, len: 1.3, pitch: 1.0 },
  ]);
  const ramps = [ramp("#2d5e28", "#7cbc4c"), ramp("#2a6030", "#86c455"), ramp("#37642a", "#8cc050")];
  const list: THREE.BufferGeometry[] = [];
  const yMin = crownY - R, yMax = crownY + R * 1.05;
  // Main mass + satellite lobes for a broad, clumped crown.
  const lobes: [number, number, number, number, number][] = [[0, crownY, 0, R, R * 0.88]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.6;
    const d = R * (0.62 + r() * 0.2);
    lobes.push([Math.cos(a) * d, crownY + (r() - 0.35) * R * 0.55, Math.sin(a) * d, R * (0.5 + r() * 0.18), R * (0.42 + r() * 0.14)]);
  }
  lobes.push([R * 0.1, crownY + R * 0.75, -R * 0.1, R * 0.62, R * 0.5]);
  lobes.forEach(([x, y, z, rx, ry], i) => {
    list.push(shadeFoliage(blob(x, y, z, rx, ry, rx, 0.42, seed + i * 3.1), ramps[i % ramps.length], yMin, yMax, seed + i, [0, 0], R * 1.2));
  });
  // Small leaf clumps on the silhouette break up the smooth outline.
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2;
    const el = (r() - 0.25) * 1.9;
    const d = R * (0.85 + r() * 0.3);
    const x = Math.cos(a) * Math.cos(el) * d;
    const y = crownY + Math.sin(el) * d * 0.85;
    const z = Math.sin(a) * Math.cos(el) * d;
    const s = R * (0.2 + r() * 0.14);
    list.push(shadeFoliage(blob(x, y, z, s, s * 0.85, s, 0.5, seed + 40 + i, 1), ramps[i % ramps.length], yMin, yMax, seed + i, [0, 0], R * 1.2));
  }
  const leaf = merge(list);
  return { bark, leaf, ...bounds(bark, leaf) };
}

function pine(seed: number): VegetationParts {
  const r = rng32(seed);
  const bark = trunk(6.4, 0.2, 0.06, 0.05, seed);
  const tiers = 7;
  const list: THREE.BufferGeometry[] = [];
  const g0 = ramp("#1f4a2c", "#4a8a4a");
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const rad = THREE.MathUtils.lerp(1.9, 0.45, t) * (0.9 + r() * 0.2);
    const h = THREE.MathUtils.lerp(1.9, 1.2, t);
    const y = 1.3 + t * 4.2;
    let cone: THREE.BufferGeometry = new THREE.ConeGeometry(rad, h, 11, 3, false);
    cone.deleteAttribute("uv");
    cone.rotateY(r() * 3);
    cone = mergeVertices(cone, 1e-4);
    const pos = cone.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), yy = pos.getY(k), z = pos.getZ(k);
      const skirt = 1 + (noise3(x * 2 + seed + i, yy * 2, z * 2) - 0.5) * 0.4;
      const droop = Math.max(0, -yy / h + 0.5) * 0.18 * Math.hypot(x, z);
      pos.setXYZ(k, x * skirt, yy + y - droop, z * skirt);
    }
    cone.computeVertexNormals();
    list.push(shadeFoliage(cone, g0, 1.0, 6.2, seed + i, [0, 0], 1.9));
  }
  const leaf = merge(list);
  return { bark, leaf, ...bounds(bark, leaf) };
}

function cypress(seed: number): VegetationParts {
  const list: THREE.BufferGeometry[] = [];
  const g = ramp("#264e2a", "#5c9650");
  const specs: [number, number, number][] = [[1.4, 0.95, 1.5], [2.6, 0.85, 1.7], [3.8, 0.68, 1.5], [4.8, 0.45, 1.15]];
  specs.forEach(([y, rad, h], i) => list.push(shadeFoliage(blob(0, y, 0, rad, h, rad, 0.35, seed + i * 2, 2), g, 0.3, 5.9, seed + i, [0, 0], 1)));
  const bark = trunk(1.1, 0.16, 0.12, 0, seed);
  const leaf = merge(list);
  return { bark, leaf, ...bounds(bark, leaf) };
}

function palm(seed: number): VegetationParts {
  const r = rng32(seed);
  const H = 6.2;
  const bend = 0.7;
  const bark = trunk(H, 0.24, 0.14, bend, seed);
  const topX = 0; // trunk() curve ends where sin(pi*t)=0
  const topZ = Math.cos(2.1 + seed) * bend * 0.35;
  const fronds: THREE.BufferGeometry[] = [];
  const g = ramp("#2f6a2c", "#8ac452");
  // Two rings of arching fronds plus a rising spear: the inner ring stands up, the outer ring droops well below the
  // crown, so the head reads as a volume from every angle rather than a flat disc.
  const rings: { count: number; rise: number; len: number; sag: number }[] = [
    { count: 6, rise: 1.5, len: 2.5, sag: 0.35 },
    { count: 8, rise: 0.75, len: 3.1, sag: 0.7 },
  ];
  const segs = 9;
  const addFrond = (a: number, len: number, rise: number, sag: number, width: number) => {
    const pos: number[] = [];
    const idx: number[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Ballistic arc: leaves the crown at slope `rise`, then falls away by `sag` * len at the tip.
      const out = len * t * 0.92;
      const y = len * (rise * t - (rise + sag) * t * t);
      // Pinnate outline: leaflet tips alternate long/short along the blade.
      const notch = s % 2 === 0 ? 1 : 0.62;
      const w = Math.sin(Math.PI * Math.pow(t, 0.7) * 0.98 + 0.06) * width * (t < 0.15 ? 0.5 : notch);
      for (const side of [-1, 1]) {
        const px = Math.cos(a) * out - Math.sin(a) * side * w;
        const pz = Math.sin(a) * out + Math.cos(a) * side * w;
        // Edges fold down from the midrib for a V section, so each blade catches light on both faces.
        pos.push(topX + px, H + y - w * 0.5, topZ + pz);
      }
      if (s < segs) {
        const k = s * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const nonIndexed = geo.toNonIndexed();
    nonIndexed.computeVertexNormals();
    fronds.push(shadeFoliage(nonIndexed, g, H - 1.8, H + 1.6, seed + fronds.length, [topX, topZ], 3));
  };
  rings.forEach((ring, ri) => {
    const phase = r() * Math.PI * 2;
    for (let i = 0; i < ring.count; i++) {
      const a = phase + (i / ring.count) * Math.PI * 2 + (ri === 1 ? Math.PI / ring.count : 0) + (r() - 0.5) * 0.35;
      addFrond(a, ring.len * (0.9 + r() * 0.2), ring.rise * (0.85 + r() * 0.3), ring.sag * (0.85 + r() * 0.3), 0.36 + r() * 0.08);
    }
  });
  // Young frond standing up from the centre.
  addFrond(r() * Math.PI * 2, 1.7, 2.6, 0.9, 0.24);
  // Coconut cluster where the fronds meet.
  const nuts = shadeFoliage(blob(topX, H - 0.25, topZ, 0.3, 0.26, 0.3, 0.2, seed, 1), ramp("#5a4020", "#7c5a30"), H - 0.5, H + 0.1, seed, [topX, topZ], 0.4);
  const leaf = merge([...fronds, nuts]);
  return { bark, leaf, ...bounds(bark, leaf) };
}

function shrub(seed: number, flowering: boolean): VegetationParts {
  const r = rng32(seed);
  const list: THREE.BufferGeometry[] = [];
  const g = flowering ? ramp("#2c5c2a", "#6cae48") : ramp("#2e5e2c", "#78b64a");
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r();
    const d = i === 0 ? 0 : 0.35 + r() * 0.2;
    const s = i === 0 ? 0.62 : 0.34 + r() * 0.14;
    list.push(shadeFoliage(blob(Math.cos(a) * d, s * 0.8 + r() * 0.1, Math.sin(a) * d, s, s * 0.82, s, 0.45, seed + i * 5, 1), g, 0, 1.3, seed + i, [0, 0], 0.9));
  }
  if (flowering) {
    const palette = [new THREE.Color("#f4a6c0"), new THREE.Color("#fff2b0"), new THREE.Color("#ffffff")];
    const tint = palette[Math.floor(r() * palette.length)];
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const el = 0.2 + r() * 1.1;
      const d = 0.62;
      const b = blob(Math.cos(a) * Math.cos(el) * d, 0.55 + Math.sin(el) * d * 0.8, Math.sin(a) * Math.cos(el) * d, 0.09, 0.09, 0.09, 0.2, seed + i, 0);
      list.push(paint(b, () => tint));
    }
  }
  const leaf = merge(list);
  return { bark: null, leaf, ...bounds(leaf) };
}

/** Builds one species. `variant` (any integer) picks a different but deterministic silhouette. */
export function buildVegetation(kind: VegetationKind, variant = 0): VegetationParts {
  const seed = 11 + variant * 977;
  switch (kind) {
    case "oak": return oak(seed, false);
    case "oak-tall": return oak(seed + 13, true);
    case "pine": return pine(seed);
    case "cypress": return cypress(seed);
    case "palm": return palm(seed);
    case "shrub": return shrub(seed, false);
    case "shrub-flowering": return shrub(seed, true);
  }
}

export const VEGETATION_KINDS: VegetationKind[] = ["oak", "oak-tall", "pine", "cypress", "palm", "shrub", "shrub-flowering"];
