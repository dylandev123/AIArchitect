import type { SiteConfig, SiteEnvironment, SiteSettings, TerrainSlope } from "@/types/house";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import { collectOccupiedFootprints, isInsideAnyFootprint, yardHalfExtent, type Footprint } from "./footprints";
import { resolveTier, TIER_PROFILES } from "@/lib/house/tiers";
import { createRng, hashSeed, rngPick, rngRange } from "./rng";

/**
 * Procedural terrain and scenery derived from `SiteSettings`. Everything here is pure data
 * (no three.js): a few hundred triangles of ground relief plus a handful of instanced shapes,
 * deterministic for a given site so the layout never jumps between renders.
 *
 * Local frame: `d` runs from the house toward the view, `l` runs across it. The house pad is
 * the square |d|,|l| <= yard around the origin; everything here lives outside it.
 */

export const WATER_ENVIRONMENTS: readonly SiteEnvironment[] = ["beach", "cliff"];

const GROUND_COLOR: Record<SiteEnvironment, string> = {
  countryside: "#72b046",
  beach: "#d9bf80",
  cliff: "#7fa04f",
  hillside: "#62a040",
  farm: "#9bbb52",
  forest: "#3f8236",
  suburban: "#48ae36", // the original lawn, so "suburban" matches pre-existing projects
  urban: "#8d9094",
};

const SLOPE_GRADE: Record<TerrainSlope, number> = { flat: 0, gentle: 0.14, steep: 0.34 };
const SLOPE_MAX_RISE: Record<TerrainSlope, number> = { flat: 0, gentle: 14, steep: 34 };

const CLIFF_DROP = 22;
const CLIFF_WATER_LEVEL = -18;
const BEACH_WATER_LEVEL = -0.55;

export interface TerrainPlan {
  settings: SiteSettings;
  /** Slope actually rendered (hillside is never flat; urban and suburban are always flat). */
  slope: TerrainSlope;
  groundColor: string;
  /** Half-extent of the flat square around the house that ground and site features occupy. */
  yard: number;
  /** Local `d` (toward the view) where flat ground ends and the sea begins; only for beach/cliff. */
  edge?: number;
  water?: { level: number; color: string };
  view: [number, number];
  /** Perpendicular to `view`. */
  across: [number, number];
  approach: [number, number];
  seed: number;
  /** Whether the automatic grass tufts belong in this environment. */
  grassTufts: boolean;
  /** Overrides for the ambient yard trees (count, palette, trunk height). */
  yardTrees: { count: number; colors: readonly string[]; trunk: [number, number] };
  /** Amplitude (m) of the gentle rolling ground outside the yard; 0 keeps the land dead flat. */
  relief: number;
  /** Everything ground relief must leave alone: the house, every site feature, rivers, paths and walls. */
  avoid: Footprint[];
}

/** Environments whose land rolls a little rather than lying dead flat. */
const ROLLING_ENVIRONMENTS: readonly SiteEnvironment[] = ["countryside", "farm", "forest"];

export function effectiveSlope(settings: SiteSettings): TerrainSlope {
  // Streets and neighbouring lots are laid out on level ground.
  if (settings.environment === "urban" || settings.environment === "suburban") return "flat";
  if (settings.environment === "hillside" && settings.terrainSlope === "flat") return "gentle";
  return settings.terrainSlope;
}

/** Returns undefined for projects without `site` settings, which keep the original lawn. */
export function planTerrain(site: SiteConfig): TerrainPlan | undefined {
  const settings = site.settings;
  if (!settings) return undefined;

  const view = SIDE_VECTOR[settings.viewDirection];
  const yard = yardHalfExtent(site);
  const env = settings.environment;
  const water = env === "beach" ? { level: BEACH_WATER_LEVEL, color: "#2a93b8" } : env === "cliff" ? { level: CLIFF_WATER_LEVEL, color: "#17588a" } : undefined;

  const yardTrees: TerrainPlan["yardTrees"] = (() => {
    switch (env) {
      case "beach": return { count: 4, colors: ["#4fae4a", "#66bd55"], trunk: [3.4, 5.2] as [number, number] };
      case "urban": return { count: 3, colors: ["#38c040", "#2aac38"], trunk: [1.8, 3.2] as [number, number] };
      case "forest": return { count: 22, colors: ["#2f8a3a", "#267a33", "#3a9640"], trunk: [1.8, 3.6] as [number, number] };
      case "farm": return { count: 5, colors: ["#4aa838", "#3d9a35"], trunk: [1.8, 3.2] as [number, number] };
      default: return { count: 14, colors: ["#38c040", "#2aac38", "#44c84c", "#30b035"], trunk: [1.8, 3.2] as [number, number] };
    }
  })();

  const tier = TIER_PROFILES[resolveTier(settings.designTier)].detail;
  yardTrees.count = Math.max(0, Math.round(yardTrees.count * tier.planting));
  const slope = effectiveSlope(settings);

  return {
    settings,
    slope,
    relief: slope === "flat" && ROLLING_ENVIRONMENTS.includes(env) ? tier.relief : 0,
    avoid: collectOccupiedFootprints(site),
    groundColor: GROUND_COLOR[env],
    yard,
    edge: water ? yard + (env === "cliff" ? 8 : 16) : undefined,
    water,
    view,
    across: [-view[1], view[0]],
    approach: SIDE_VECTOR[settings.approachSide],
    seed: hashSeed("terrain", env, settings.viewDirection, settings.approachSide, settings.terrainSlope, site.house.width, site.house.depth),
    grassTufts: env === "countryside" || env === "farm" || env === "suburban" || env === "forest" || env === "hillside" || env === "cliff",
    yardTrees,
  };
}

// ── Height field ────────────────────────────────────────────────────────────

/** Deterministic smooth-ish noise in [-1, 1] along the cliff line. */
function edgeNoise(l: number): number {
  return Math.sin(l * 0.21) * 0.5 + Math.sin(l * 0.53 + 1.3) * 0.5;
}

function hillRise(plan: TerrainPlan, s: number): number {
  if (s <= 0 || plan.slope === "flat") return 0;
  const eased = s < 8 ? (s * s) / 16 : s - 4;
  return Math.min(SLOPE_MAX_RISE[plan.slope], SLOPE_GRADE[plan.slope] * eased);
}

function seaHeight(plan: TerrainPlan, t: number, l: number): number {
  if (t <= 0) return 0;
  if (plan.settings.environment === "beach") return -0.08 * Math.min(t, 16);
  const u = Math.min(1, t / 5);
  return -CLIFF_DROP * u * u * (3 - 2 * u) * (1 + 0.12 * edgeNoise(l));
}

export function toLocal(plan: TerrainPlan, x: number, z: number): { d: number; l: number } {
  return { d: x * plan.view[0] + z * plan.view[1], l: x * plan.across[0] + z * plan.across[1] };
}

export function toWorld(plan: TerrainPlan, d: number, l: number): [number, number] {
  return [d * plan.view[0] + l * plan.across[0], d * plan.view[1] + l * plan.across[1]];
}

/**
 * Gentle rolling ground outside the yard: soft mounds that fade to nothing at the pad and around every site
 * feature, so buildings, pools, paths and rivers always sit on level ground. Only rises above the base plane
 * (never dips below it), which keeps the flat ground plane underneath it hidden.
 */
function rollingHeight(plan: TerrainPlan, x: number, z: number): number {
  if (plan.relief <= 0) return 0;
  const outside = Math.max(Math.abs(x), Math.abs(z)) - plan.yard;
  if (outside <= 0) return 0;
  let clear = Math.min(1, outside / 16);
  for (const f of plan.avoid) {
    const gap = Math.max(Math.abs(x - f.cx) - f.halfW, Math.abs(z - f.cz) - f.halfD);
    if (gap < 5) {
      clear = Math.min(clear, Math.max(0, gap / 5));
      if (clear <= 0) return 0;
    }
  }
  const n = Math.sin(x * 0.083 + 1.3) * Math.cos(z * 0.071 + 0.4) * 0.6 + Math.sin((x + z) * 0.043 + 2.1) * 0.4;
  return n > 0 ? plan.relief * clear * clear * (3 - 2 * clear) * n : 0;
}

/** Ground height at a world point (0 on the pad and flat land). */
export function terrainHeightAt(plan: TerrainPlan, x: number, z: number): number {
  const { d, l } = toLocal(plan, x, z);
  if (plan.edge !== undefined && d > plan.edge) return seaHeight(plan, d - plan.edge, l);
  return hillRise(plan, -d - plan.yard) + rollingHeight(plan, x, z);
}

/** Axis-aligned world rectangle the flat ground plane should cover (trimmed on the water side). */
export function groundRect(plan: TerrainPlan | undefined, half: number): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const rect = { minX: -half, maxX: half, minZ: -half, maxZ: half };
  if (plan?.edge === undefined) return rect;
  const [vx, vz] = plan.view;
  if (vx > 0) rect.maxX = plan.edge;
  else if (vx < 0) rect.minX = -plan.edge;
  else if (vz > 0) rect.maxZ = plan.edge;
  else rect.minZ = -plan.edge;
  return rect;
}

// ── Colour helpers ──────────────────────────────────────────────────────────

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

// ── Relief mesh ─────────────────────────────────────────────────────────────

export interface TerrainMeshData {
  /** Non-indexed triangles: 3 floats per vertex. */
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
}

const LATERAL_HALF = 220;
const LATERAL_STOPS = (() => {
  const half = [0, 8, 16, 26, 38, 52, 70, 95, 130, 170, LATERAL_HALF];
  return [...half.slice(1).reverse().map((v) => -v), ...half];
})();
const HILL_STOPS = [0, 4, 8, 12, 16, 24, 32, 44, 60, 80, 110, 150];
const SEA_STOPS = [0, 1, 2, 3, 4, 5, 6, 8, 11, 15, 20, 30, 50, 90, 160];

/** Builds the ground relief outside the house pad: the uphill ramp and/or the drop to the sea. */
export function buildTerrainMesh(plan: TerrainPlan): TerrainMeshData {
  const quads: { d0: number; d1: number; kind: "hill" | "sea" }[] = [];
  if (plan.slope !== "flat") {
    for (let i = 0; i < HILL_STOPS.length - 1; i++) {
      quads.push({ d0: -plan.yard - HILL_STOPS[i], d1: -plan.yard - HILL_STOPS[i + 1], kind: "hill" });
    }
  }
  if (plan.edge !== undefined) {
    for (let i = 0; i < SEA_STOPS.length - 1; i++) {
      quads.push({ d0: plan.edge + SEA_STOPS[i], d1: plan.edge + SEA_STOPS[i + 1], kind: "sea" });
    }
  }

  const tris = quads.length * (LATERAL_STOPS.length - 1) * 2;
  const positions = new Float32Array(tris * 9);
  const normals = new Float32Array(tris * 9);
  const colors = new Float32Array(tris * 9);
  const rng = createRng(plan.seed);

  const ground = hexToRgb(plan.groundColor);
  const rock = hexToRgb("#8b8578");
  const deepRock = hexToRgb("#5f5a55");
  const cliffRock = hexToRgb("#7d746b");
  const wetSand = hexToRgb("#b39a64");

  const heightAt = (kind: "hill" | "sea", d: number, l: number): number =>
    kind === "hill" ? hillRise(plan, -d - plan.yard) : seaHeight(plan, d - (plan.edge ?? 0), l);

  const colorFor = (kind: "hill" | "sea", h: number): RGB => {
    if (kind === "hill") return mix(ground, rock, (h / (plan.slope === "steep" ? 26 : 20)) * 0.85);
    if (plan.settings.environment === "beach") return h < -0.3 ? wetSand : ground;
    return h > -0.6 ? ground : mix(cliffRock, deepRock, (-h - 6) / 16);
  };

  let v = 0;
  const pushTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number], color: RGB) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    // Keep every triangle facing up so lighting is consistent whatever the view direction.
    const flip = ny < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const len = Math.hypot(nx, ny, nz) || 1;
    for (const pt of flip ? [a, c, b] : [a, b, c]) {
      positions.set(pt, v);
      normals.set([nx / len, ny / len, nz / len], v);
      colors.set(color, v);
      v += 3;
    }
  };

  for (const { d0, d1, kind } of quads) {
    for (let i = 0; i < LATERAL_STOPS.length - 1; i++) {
      const l0 = LATERAL_STOPS[i], l1 = LATERAL_STOPS[i + 1];
      const corner = (d: number, l: number): [number, number, number] => {
        const [x, z] = toWorld(plan, d, l);
        return [x, heightAt(kind, d, l), z];
      };
      const p00 = corner(d0, l0), p10 = corner(d1, l0), p11 = corner(d1, l1), p01 = corner(d0, l1);
      const avg = (p00[1] + p10[1] + p11[1] + p01[1]) / 4;
      const shade = 0.93 + rng() * 0.12;
      const base = colorFor(kind, avg);
      const c1: RGB = [base[0] * shade, base[1] * shade, base[2] * shade];
      const shade2 = 0.93 + rng() * 0.12;
      const c2: RGB = [base[0] * shade2, base[1] * shade2, base[2] * shade2];
      pushTri(p00, p10, p11, c1);
      pushTri(p00, p11, p01, c2);
    }
  }
  return { positions, normals, colors };
}

/**
 * The rolling mounds of a flat site as a coarse grid mesh. Only cells that actually rise off the ground plane are
 * emitted, so a mostly-flat site costs a few hundred triangles and the rest is left to the ground plane.
 */
export function buildRollingMesh(plan: TerrainPlan): TerrainMeshData | undefined {
  if (plan.relief <= 0) return undefined;
  const CELL = 3.5;
  const R = Math.min(150, plan.yard + 100);
  const n = Math.ceil((R * 2) / CELL);
  const heights = new Float32Array((n + 1) * (n + 1));
  const at = (i: number, j: number) => j * (n + 1) + i;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) heights[at(i, j)] = rollingHeight(plan, -R + i * CELL, -R + j * CELL);

  const quads: [number, number][] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (Math.max(heights[at(i, j)], heights[at(i + 1, j)], heights[at(i + 1, j + 1)], heights[at(i, j + 1)]) > 0.04) quads.push([i, j]);
    }
  }
  if (quads.length === 0) return undefined;

  const positions = new Float32Array(quads.length * 18);
  const normals = new Float32Array(quads.length * 18);
  const colors = new Float32Array(quads.length * 18);
  const rng = createRng(plan.seed ^ 0x51ed270b);
  const ground = hexToRgb(plan.groundColor);
  let v = 0;
  for (const [i, j] of quads) {
    const p = (a: number, b: number): [number, number, number] => [-R + a * CELL, heights[at(a, b)], -R + b * CELL];
    const corners = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)];
    const avg = corners.reduce((sum, c) => sum + c[1], 0) / 4;
    for (const tri of [[0, 1, 2], [0, 2, 3]] as const) {
      const [a, b, c] = tri.map((k) => corners[k]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const len = Math.hypot(nx, ny, nz) || 1;
      const shade = 0.94 + rng() * 0.1 + Math.min(0.05, avg * 0.03);
      for (const pt of [a, b, c]) {
        positions.set(pt, v);
        normals.set([nx / len, ny / len, nz / len], v);
        colors.set([ground[0] * shade, ground[1] * shade, ground[2] * shade], v);
        v += 3;
      }
    }
  }
  return { positions, normals, colors };
}

// ── Approach road ───────────────────────────────────────────────────────────

export interface RoadRibbon {
  /** Left/right vertex pairs along the road, world x/y/z. */
  points: [[number, number, number], [number, number, number]][];
  color: string;
}

const ROAD_STYLE: Record<SiteEnvironment, { width: number; length: number; color: string }> = {
  countryside: { width: 4.5, length: 70, color: "#b8a27a" },
  beach: { width: 4, length: 40, color: "#cdb888" },
  cliff: { width: 4.5, length: 70, color: "#a89880" },
  hillside: { width: 4.5, length: 70, color: "#a8987a" },
  farm: { width: 5, length: 80, color: "#a68a5c" },
  forest: { width: 4, length: 80, color: "#8a7350" },
  suburban: { width: 7, length: 60, color: "#4a4d52" },
  urban: { width: 9, length: 16, color: "#43464b" },
};

/** A simple lane from the yard's edge out to the approach side, following the terrain. */
export function buildApproachRoad(plan: TerrainPlan): RoadRibbon | undefined {
  const style = ROAD_STYLE[plan.settings.environment];
  const [ax, az] = plan.approach;
  const [qx, qz] = [-az, ax];
  const points: RoadRibbon["points"] = [];
  const STEP = 4;
  for (let s = plan.yard - 2; s <= plan.yard + style.length; s += STEP) {
    const cx = ax * s, cz = az * s;
    const h = terrainHeightAt(plan, cx, cz);
    if (h < -0.3) break; // ran into the sea
    const y = h + 0.05;
    const hw = style.width / 2;
    points.push([[cx + qx * hw, y, cz + qz * hw], [cx - qx * hw, y, cz - qz * hw]]);
  }
  return points.length >= 2 ? { points, color: style.color } : undefined;
}

// ── Scenery shapes ──────────────────────────────────────────────────────────

/** One instanced shape: `y` is the base for boxes/cones and the centre for blobs. */
export interface SceneryShape {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  rotY: number;
  color: string;
}

export interface ScenicTrees {
  trunks: SceneryShape[];
  round: SceneryShape[];
  conifer: SceneryShape[];
}

export interface EnvironmentScenery {
  trees: ScenicTrees;
  /** Buildings, crop fields, streets, barns — unit boxes with their base at y. */
  boxes: SceneryShape[];
  /** Pyramid roofs sitting on `boxes`. */
  roofs: SceneryShape[];
  rocks: SceneryShape[];
}

const FOLIAGE: Record<SiteEnvironment, string[]> = {
  countryside: ["#4fa03c", "#5cb046", "#44963a"],
  beach: ["#4fae4a", "#66bd55"],
  cliff: ["#5c9440", "#6aa04a"],
  hillside: ["#2f7d3a", "#276f33", "#3a8a40"],
  farm: ["#4aa838", "#5cb548"],
  forest: ["#2f8a3a", "#267a33", "#1f6b2e", "#3a9640"],
  suburban: ["#38c040", "#2aac38", "#44c84c"],
  urban: ["#38c040"],
};

/**
 * Everything around the house, placed outside the pad and clear of site features, the approach
 * lane and the sea. Kept deliberately small: at most a couple of hundred instances.
 */
export function generateEnvironmentScenery(site: SiteConfig, plan: TerrainPlan): EnvironmentScenery {
  const env = plan.settings.environment;
  const rng = createRng(plan.seed ^ 0x9e3779b9);
  const footprints = collectOccupiedFootprints(site);
  const P = plan.yard;
  const out: EnvironmentScenery = { trees: { trunks: [], round: [], conifer: [] }, boxes: [], roofs: [], rocks: [] };
  const [ax, az] = plan.approach;

  /** True if (x,z) is open ground: off the pad, off features, off the approach lane, on land. */
  const isFree = (x: number, z: number, margin = 3): boolean => {
    if (Math.max(Math.abs(x), Math.abs(z)) < P + margin) return false;
    if (isInsideAnyFootprint(x, z, footprints)) return false;
    const along = x * ax + z * az;
    const lateral = Math.abs(x * -az + z * ax);
    if (along > 0 && lateral < 6 + margin) return false;
    if (plan.edge !== undefined && toLocal(plan, x, z).d > plan.edge - 3) return false;
    return true;
  };

  const scatter = (count: number, rMin: number, rMax: number, spacing: number, place: (x: number, z: number, y: number) => void) => {
    const placed: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 14; attempt++) {
        const angle = rng() * Math.PI * 2;
        const r = rngRange(rng, rMin, rMax);
        const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
        if (!isFree(x, z)) continue;
        if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < spacing)) continue;
        placed.push([x, z]);
        place(x, z, terrainHeightAt(plan, x, z));
        break;
      }
    }
  };

  const addTree = (x: number, z: number, y: number, kind: "round" | "conifer" | "palm" | "bush") => {
    const foliage = rngPick(rng, FOLIAGE[env]);
    const trunkColor = "#3a2410";
    if (kind === "bush") {
      const r = rngRange(rng, 0.7, 1.3);
      out.trees.round.push({ x, y: y + r * 0.5, z, sx: r * 2, sy: r * 1.5, sz: r * 2, rotY: rng() * 6, color: foliage });
      return;
    }
    if (kind === "palm") {
      const h = rngRange(rng, 4, 6.5);
      out.trees.trunks.push({ x, y, z, sx: 0.2, sy: h, sz: 0.2, rotY: 0, color: "#8a6a3c" });
      out.trees.round.push({ x, y: y + h, z, sx: 3.6, sy: 1.1, sz: 3.6, rotY: rng() * 6, color: foliage });
      return;
    }
    const h = rngRange(rng, kind === "conifer" ? 1 : 1.6, kind === "conifer" ? 2 : 3);
    const crown = rngRange(rng, 1.3, 2.4);
    out.trees.trunks.push({ x, y, z, sx: 0.28, sy: h, sz: 0.28, rotY: 0, color: trunkColor });
    if (kind === "conifer") {
      out.trees.conifer.push({ x, y: y + h * 0.6, z, sx: crown * 1.1, sy: crown * 3.6, sz: crown * 1.1, rotY: rng() * 6, color: foliage });
    } else {
      out.trees.round.push({ x, y: y + h + crown * 0.55, z, sx: crown * 2, sy: crown * 1.8, sz: crown * 2, rotY: rng() * 6, color: foliage });
    }
  };

  const addRocks = (count: number, rMin: number, rMax: number, color: string) =>
    scatter(count, rMin, rMax, 4, (x, z, y) => {
      const s = rngRange(rng, 0.8, 2.6);
      out.rocks.push({ x, y: y + s * 0.2, z, sx: s * 1.3, sy: s * 0.8, sz: s, rotY: rng() * 6, color });
    });

  /** Axis-aligned box on flat ground, given in world coordinates. */
  const addBox = (x: number, z: number, w: number, d: number, h: number, color: string, y = 0) =>
    out.boxes.push({ x, y, z, sx: w, sy: h, sz: d, rotY: 0, color });

  switch (env) {
    case "countryside":
      scatter(18, P + 6, P + 80, 6, (x, z, y) => addTree(x, z, y, "round"));
      scatter(16, P + 5, P + 55, 4, (x, z, y) => addTree(x, z, y, "bush"));
      addRocks(4, P + 10, P + 60, "#8f8a80");
      break;
    case "farm": {
      scatter(6, P + 10, P + 90, 12, (x, z, y) => addTree(x, z, y, "round"));
      // Crop fields and a barn, laid out in the two lateral bands and behind the view.
      const fieldColors = ["#c9a93e", "#5f9a2f", "#8f6c2c", "#b39a36", "#6e9f34"];
      const [vx, vz] = plan.view;
      const [px, pz] = plan.across;
      const lots: [number, number, number, number][] = [
        [P + 24, P + 12, 42, 26], [P + 24, -(P + 14), 42, 28], [P + 62, P + 12, 46, 30], [P + 62, -(P + 14), 46, 30],
        [-(P + 30), P + 12, 40, 26], [-(P + 30), -(P + 12), 40, 26],
      ];
      lots.forEach(([d, l, w, h], i) => {
        if (d < 0 && plan.slope !== "flat") return; // that land rises behind the house
        const [x, z] = [d * vx + l * px, d * vz + l * pz];
        const swap = vx !== 0;
        const [bw, bd] = swap ? [w, h] : [h, w];
        if (!isFree(x, z, 0) || !isFree(x + bw / 2, z + bd / 2, 0) || !isFree(x - bw / 2, z - bd / 2, 0)) return;
        addBox(x, z, bw, bd, 0.03, fieldColors[i % fieldColors.length]);
      });
      // Barn: red box with a roof, on a lateral side.
      const [bx, bz] = [(P + 26) * px + 20 * vx, (P + 26) * pz + 20 * vz];
      if (isFree(bx, bz, 4)) {
        addBox(bx, bz, 10, 14, 5, "#a83a2c");
        out.roofs.push({ x: bx, y: 5, z: bz, sx: 12, sy: 3.2, sz: 15.5, rotY: 0, color: "#5a3a2a" });
      }
      break;
    }
    case "forest":
      scatter(46, P + 4, P + 90, 4, (x, z, y) => addTree(x, z, y, rng() < 0.55 ? "conifer" : "round"));
      scatter(14, P + 4, P + 40, 3.5, (x, z, y) => addTree(x, z, y, "bush"));
      break;
    case "hillside":
      scatter(20, P + 5, P + 110, 6, (x, z, y) => addTree(x, z, y, rng() < 0.7 ? "conifer" : "round"));
      addRocks(10, P + 8, P + 90, "#8b8578");
      break;
    case "beach":
      scatter(9, P + 4, P + 55, 7, (x, z, y) => addTree(x, z, y, "palm"));
      addRocks(5, P + 4, P + 45, "#a89d8a");
      break;
    case "cliff":
      scatter(9, P + 5, P + 70, 7, (x, z, y) => addTree(x, z, y, "round"));
      addRocks(8, P + 4, P + 40, "#7d746b");
      break;
    case "suburban": {
      // A street on the approach side, neighbours beside the plot and across the street.
      const streetOffset = P + 9;
      const sw = 8;
      const [qx, qz] = [-az, ax];
      const alongStreet = (s: number, l: number): [number, number] => [ax * s + qx * l, az * s + qz * l];
      const [sx, sz] = alongStreet(streetOffset, 0);
      out.boxes.push({ x: sx, y: 0, z: sz, sx: ax !== 0 ? sw : 320, sy: 0.03, sz: ax !== 0 ? 320 : sw, rotY: 0, color: "#4a4d52" });
      const houseColors = ["#eadfcf", "#d9c9b0", "#c9d6e0", "#e6cfc0", "#d5dcc4"];
      const roofColors = ["#7a4a3a", "#5a5f6a", "#6a4a34", "#4d5a66"];
      const neighbour = (s: number, l: number) => {
        const [x, z] = alongStreet(s, l);
        if (!isFree(x, z, 0) || isInsideAnyFootprint(x, z, footprints)) return;
        const w = rngRange(rng, 9, 13), dd = rngRange(rng, 8, 11), h = rngRange(rng, 3.2, 6);
        const color = rngPick(rng, houseColors);
        out.boxes.push({ x, y: 0, z, sx: w, sy: h, sz: dd, rotY: 0, color });
        out.roofs.push({ x, y: h, z, sx: w * 1.12, sy: 2.6, sz: dd * 1.12, rotY: 0, color: rngPick(rng, roofColors) });
      };
      for (let i = 1; i <= 3; i++) {
        neighbour(0, P + 10 + (i - 1) * 20); neighbour(0, -(P + 10 + (i - 1) * 20));
      }
      for (let i = -3; i <= 3; i++) neighbour(streetOffset + sw / 2 + 14, i * 22);
      scatter(6, P + 4, P + 30, 8, (x, z, y) => addTree(x, z, y, "round"));
      break;
    }
    case "urban": {
      // A street lattice around the plot with blocks of low-rise towers, lower toward the view.
      const S = 9;
      const C = 2 * P + 6 + S;
      const RING = 2;
      for (let i = -RING; i <= RING; i++) {
        for (let j = -RING; j <= RING; j++) {
          if (i === 0 && j === 0) continue;
          const cx = i * C, cz = j * C;
          const toView = (cx * plan.view[0] + cz * plan.view[1]) / C;
          const maxH = toView > 0.5 ? 14 : toView < -0.5 ? 40 : 26;
          const half = (C - S) / 2;
          for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
            const w = half - 1, d = half - 1;
            const shade = 0.82 + rng() * 0.3;
            const g = Math.round(150 * shade);
            const tint = rng() < 0.3 ? `rgb(${g + 20},${g},${g - 10})` : `rgb(${g},${g + 3},${g + 8})`;
            out.boxes.push({
              x: cx + (ox * (half)) / 2, y: 0, z: cz + (oz * half) / 2,
              sx: w, sy: rngRange(rng, 6, maxH), sz: d, rotY: 0, color: tint,
            });
          }
        }
      }
      const span = (RING + 1) * C * 2;
      for (let k = -RING - 1; k <= RING; k++) {
        const line = (k + 0.5) * C;
        out.boxes.push({ x: line, y: 0, z: 0, sx: S, sy: 0.03, sz: span, rotY: 0, color: "#43464b" });
        out.boxes.push({ x: 0, y: 0, z: line, sx: span, sy: 0.03, sz: S, rotY: 0, color: "#43464b" });
      }
      break;
    }
  }
  return out;
}
