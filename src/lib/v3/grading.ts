import type { V3Scene, V3SceneObject, V3SceneSite } from "./scene";
import type { V3SiteLevel, V3SiteConnection, V3RoutePoint } from "./siteHierarchy";
import { getObjectBaseY, scaledDimensionsOf } from "./elevation";

/**
 * Graded Site v1.
 *
 * One vertical authority for the ground:
 *
 *   natural ground (site.naturalGround: plane / profile / ridge / cliff, plus legacy terrain-region modifiers)
 *    → connection corridors (driveway/path profiles derived from their endpoints and the ground, cut/fill)
 *    → pads (pad/terrace/slab levels own their elevation; batters for small steps, derived retaining walls ≥ 0.6 m)
 *    → pool excavation (inside the shell only)
 *
 * Everything here is derived from semantic site intent on demand. Nothing is persisted, and derived walls
 * are compiled geometry with stable ids, never authored objects.
 */
export type V3FallDirection = "x" | "-x" | "z" | "-z";
export interface V3NaturalGround {
  /** Natural elevation at the site centre. Defaults to `site.baseElevation`. */
  elevation?: number;
  /** Downhill direction: the ground falls toward this axis. */
  fall?: V3FallDirection;
  /** Planar fall grade (rise / run): .05 = 5 %. Ignored when `profile` is given. */
  grade?: number;
  /** Absolute elevations at distances along the fall axis from the site centre, [distance, elevation]. Smooth, monotone between points. */
  profile?: [number, number][];
  /** Cross-fall curvature: metres the ground drops at the side edges relative to the centre line. Negative is a valley. */
  ridge?: number;
  /** A natural cliff / drop line perpendicular to the fall axis, at `at` metres downhill of the centre. */
  cliff?: { at: number; drop: number; run?: number };
}
/** Sea / lake level. Rendered as an independent water plane; it never shapes the terrain. */
export interface V3SeaPlane { level: number; }
export type V3PadSide = "north" | "south" | "west" | "east";

export const V3_RETAINING_STEP = .6;
export const V3_GRADING_SUPPORT = new Set<V3SiteLevel["supportType"]>(["pad", "terrace", "slab"]);
const WALL_THICKNESS = .35;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smooth = (v: number) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
type P2 = [number, number];

/* ------------------------------------------------------------------ natural ground */

function monotoneProfile(points: readonly [number, number][], u: number): number {
  const p = [...points].filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)).sort((a, b) => a[0] - b[0]);
  if (!p.length) return 0;
  if (p.length === 1) return p[0][1];
  const n = p.length, secant = p.slice(1).map(([x, y], i) => (y - p[i][1]) / Math.max(1e-6, x - p[i][0]));
  if (u <= p[0][0]) return p[0][1] + secant[0] * (u - p[0][0]);
  if (u >= p[n - 1][0]) return p[n - 1][1] + secant[n - 2] * (u - p[n - 1][0]);
  // Fritsch–Carlson tangents: smooth, never overshoots the authored control heights.
  const m = p.map((_, i) => i === 0 ? secant[0] : i === n - 1 ? secant[n - 2] : secant[i - 1] * secant[i] <= 0 ? 0 : (secant[i - 1] + secant[i]) / 2);
  for (let i = 0; i < n - 1; i++) if (secant[i] === 0) { m[i] = 0; m[i + 1] = 0; } else {
    const a = m[i] / secant[i], b = m[i + 1] / secant[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * secant[i]; m[i + 1] = t * b * secant[i]; }
  }
  let i = 0; while (u > p[i + 1][0]) i++;
  const h = p[i + 1][0] - p[i][0], t = (u - p[i][0]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h * m[i + 1];
}

const fallAxes = (fall: V3FallDirection = "z", x: number, z: number) =>
  ({ u: fall === "z" ? z : fall === "-z" ? -z : fall === "x" ? x : -x, v: fall === "z" || fall === "-z" ? x : z });

/** The continuous natural-ground surface (before legacy terrain modifiers). Continuous everywhere, including site edges. */
export function v3NaturalGroundHeight(site: V3SceneSite, x: number, z: number): number {
  const ground = site.naturalGround, base = ground?.elevation ?? site.baseElevation ?? 0;
  if (!ground) return base;
  const { u, v } = fallAxes(ground.fall, x, z);
  let y = ground.profile?.length ? monotoneProfile(ground.profile, u) : base - (ground.grade ?? 0) * u;
  if (ground.ridge) { const half = (ground.fall === "x" || ground.fall === "-x" ? site.depth : site.width) / 2; y -= ground.ridge * (v / Math.max(1, half)) ** 2; }
  if (ground.cliff && ground.cliff.drop > 0) {
    const run = Math.max(1, ground.cliff.run ?? Math.max(4, ground.cliff.drop * .3));
    y -= ground.cliff.drop * smooth((u - ground.cliff.at) / run + .5);
  }
  return y;
}

/** Ocean / sea plane: an independent water surface over the downhill side, extending past the site edge. */
export function v3SeaPlaneOutline(site: V3SceneSite, natural: (x: number, z: number) => number): P2[] | undefined {
  if (!site.sea || !Number.isFinite(site.sea.level)) return undefined;
  const fall = site.naturalGround?.fall ?? "z", along = fall === "x" || fall === "-x" ? site.width : site.depth, across = fall === "x" || fall === "-x" ? site.depth : site.width;
  const world = (u: number, v: number): P2 => fall === "z" ? [v, u] : fall === "-z" ? [v, -u] : fall === "x" ? [u, v] : [-u, v];
  let shore = along / 2;
  for (let u = -along / 2; u <= along / 2; u += .5) if (natural(...world(u, 0)) < site.sea.level) { shore = u; break; }
  const near = shore - 4, far = along / 2 + along * 3;
  return [world(near, -across * 2), world(far, -across * 2), world(far, across * 2), world(near, across * 2)];
}

/* ------------------------------------------------------------------ geometry helpers */

const SIDES: readonly V3PadSide[] = ["north", "south", "west", "east"];
interface Rect { cx: number; cz: number; hw: number; hd: number; c: number; s: number; aligned: boolean; }
const rectOf = (x: number, z: number, width: number, depth: number, rotation = 0): Rect => {
  const quarter = Math.abs(Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2) - rotation) < 1e-4, odd = quarter && Math.abs(Math.round(rotation / (Math.PI / 2))) % 2 === 1;
  return { cx: x, cz: z, hw: (odd ? depth : width) / 2, hd: (odd ? width : depth) / 2, c: quarter ? 1 : Math.cos(rotation), s: quarter ? 0 : Math.sin(rotation), aligned: quarter };
};
const toLocal = (r: Rect, x: number, z: number): P2 => { const dx = x - r.cx, dz = z - r.cz; return [dx * r.c - dz * r.s, dx * r.s + dz * r.c]; };
const toWorld = (r: Rect, lx: number, lz: number): P2 => [r.cx + r.c * lx + r.s * lz, r.cz - r.s * lx + r.c * lz];
const inRect = (r: Rect, x: number, z: number, margin = 0) => { const [lx, lz] = toLocal(r, x, z); return Math.abs(lx) <= r.hw + margin && Math.abs(lz) <= r.hd + margin; };
const objectRect = (o: V3SceneObject) => { const [w, , d] = scaledDimensionsOf(o); return rectOf(o.transform.position[0], o.transform.position[2], w, d, o.transform.rotation[1]); };
const levelRect = (l: V3SiteLevel) => rectOf(l.region.x, l.region.z, l.region.width, l.region.depth, l.region.rotation ?? 0);

/**
 * Graded pad regions. An authored retaining wall standing just outside a pad edge (parallel, within 5 m, spanning
 * half the edge) is the designer's grade break: the pad's flat extends to the wall's face. Elevations stay the level's.
 */
const authoredWallLines = (scene: V3Scene) => scene.objects.filter((o) => o.type === "retaining-wall").map((o) => {
  const [w, , d] = scaledDimensionsOf(o), alongX = w >= d, half = (alongX ? w : d) / 2, r = objectRect(o);
  return { a: toWorld(r, alongX ? -half : 0, alongX ? 0 : -half), b: toWorld(r, alongX ? half : 0, alongX ? 0 : half), thickness: alongX ? d : w };
});
export function v3GradedPadRects(scene: V3Scene): Map<string, Rect> {
  const walls = authoredWallLines(scene), out = new Map<string, Rect>();
  for (const level of scene.siteHierarchy?.levels ?? []) {
    if (!V3_GRADING_SUPPORT.has(level.supportType)) continue;
    const r = levelRect(level), ext = { north: 0, south: 0, west: 0, east: 0 };
    for (const side of SIDES) {
      const along: P2 = side === "north" || side === "south" ? [1, 0] : [0, 1], normal: P2 = side === "north" ? [0, -1] : side === "south" ? [0, 1] : side === "west" ? [-1, 0] : [1, 0];
      const edge = side === "north" || side === "south" ? r.hd : r.hw, span = side === "north" || side === "south" ? r.hw : r.hd;
      for (const wall of walls) {
        const [ax, az] = toLocal(r, ...wall.a), [bx, bz] = toLocal(r, ...wall.b), len = Math.hypot(bx - ax, bz - az) || 1;
        if (Math.abs(((bx - ax) * along[0] + (bz - az) * along[1]) / len) < .95) continue;
        const offset = ((ax + bx) / 2) * normal[0] + ((az + bz) / 2) * normal[1] - edge - wall.thickness / 2;
        const s0 = ax * along[0] + az * along[1], s1 = bx * along[0] + bz * along[1], overlap = Math.min(span, Math.max(s0, s1)) - Math.max(-span, Math.min(s0, s1));
        if (offset > .05 && offset <= 5 && overlap >= span) ext[side] = ext[side] ? Math.min(ext[side], offset) : offset;
      }
    }
    const [cx, cz] = toWorld(r, (ext.east - ext.west) / 2, (ext.south - ext.north) / 2);
    out.set(level.id, { ...r, cx, cz, hw: r.hw + (ext.east + ext.west) / 2, hd: r.hd + (ext.north + ext.south) / 2 });
  }
  return out;
}

/* ------------------------------------------------------------------ derived records */

export interface V3GradingPad { level: V3SiteLevel; elevation: number; rect: Rect; open: ReadonlySet<V3PadSide>; }
export interface V3GradedConnection {
  id: string; type: V3SiteConnection["type"]; graded: boolean; reason?: string; halfWidth: number;
  /** Derived vertical profile: [x, y, z] stations every ~1 m. */
  profile: V3RoutePoint[]; stations: number[];
  maxGrade: number; maxCut: number; maxFill: number;
}
export interface V3DerivedWallSample { at: P2; high: number; low: number; /** Local outward normal (curved corridor walls). Defaults to the wall's. */ normal?: P2; }
export interface V3DerivedRetainingWall {
  /** Stable derived id: owner (level or connection), side and run index. Never persisted. */
  id: string; levelId?: string; connectionId?: string; side: V3PadSide | "left" | "right" | "turn"; kind: "cut" | "fill" | "level-step";
  start: P2; end: P2; outward: P2; samples: V3DerivedWallSample[]; maxHeight: number;
  /** How far the exposed face stands forward of the grade break, toward the low side. Corridor cut walls stand at the
   *  ribbon edge so the one-cell mesh slant of a diagonal grade break is inside the wall, not in front of it. */
  inset?: number;
}
type EdgeKind = "wall" | "batter" | "open" | "authored" | "covered" | "neighbour";
interface EdgeSample { kind: EdgeKind; step: number; at: P2; outside: number; }
interface PadEdges { pad: V3GradingPad; sides: Record<V3PadSide, EdgeSample[]>; }
export interface V3SiteGrading {
  natural(x: number, z: number): number;
  /** Natural ground with connection corridors, before pads. */
  outside(x: number, z: number): number;
  /** Final analytic graded surface (pads, batters, corridors), before pool excavation. */
  graded(x: number, z: number): number;
  pads: V3GradingPad[]; connections: V3GradedConnection[]; walls: V3DerivedRetainingWall[];
  padAt(x: number, z: number): V3GradingPad | undefined;
}

const sideFrame = (pad: V3GradingPad, side: V3PadSide) => {
  const { hw, hd } = pad.rect;
  // Local edge start/end and outward normal in the pad's frame. North is -z.
  const local = side === "north" ? { a: [-hw, -hd], b: [hw, -hd], n: [0, -1] } : side === "south" ? { a: [-hw, hd], b: [hw, hd], n: [0, 1] }
    : side === "west" ? { a: [-hw, -hd], b: [-hw, hd], n: [-1, 0] } : { a: [hw, -hd], b: [hw, hd], n: [1, 0] };
  const a = toWorld(pad.rect, local.a[0], local.a[1]), b = toWorld(pad.rect, local.b[0], local.b[1]);
  const origin = toWorld(pad.rect, 0, 0), tip = toWorld(pad.rect, local.n[0], local.n[1]);
  return { a, b, n: [tip[0] - origin[0], tip[1] - origin[1]] as P2, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
};
const edgeCount = (length: number) => Math.max(2, Math.ceil(length));

function nearestOnPolyline(points: readonly P2[], cum: readonly number[], x: number, z: number) {
  let best = { d: Infinity, s: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1], dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1) : 0, px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, s: cum[i] + Math.sqrt(len2) * t };
  }
  return best;
}
const interpolateStations = (stations: readonly number[], ys: readonly number[], s: number) => {
  if (s <= stations[0]) return ys[0];
  if (s >= stations[stations.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = stations.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (stations[mid] <= s) lo = mid; else hi = mid; }
  const t = (s - stations[lo]) / Math.max(1e-9, stations[hi] - stations[lo]);
  return ys[lo] + (ys[hi] - ys[lo]) * t;
};

/** Connections that are graded into the ground. Stairs, ramps and explicitly authored (elevated) routes keep authored Y. */
const gradableConnection = (connection: V3SiteConnection, levels: ReadonlyMap<string, V3SiteLevel>) => {
  if (connection.type !== "driveway" && connection.type !== "path") return "structural connector";
  if (connection.profile === "authored") return "explicitly authored profile";
  const ends = [levels.get(connection.fromLevelId), levels.get(connection.toLevelId)];
  if (ends.some((level) => !level)) return "missing level";
  if (ends.some((level) => level!.supportType === "roof" || level!.supportType === "object" || level!.supportType === "deck")) return "elevated endpoint";
  return undefined;
};

/**
 * Derives the full site grading from the effective scene. `natural` is the natural ground including legacy
 * terrain-region modifiers; `routes` are the resolved [x, y, z] connection routes.
 */
export function deriveV3SiteGrading(scene: V3Scene, natural: (x: number, z: number) => number, routes: ReadonlyMap<string, V3RoutePoint[]>, meshStep = 1.5): V3SiteGrading {
  // Flat corridor shoulder at least one (diagonal) mesh cell wide: every mesh triangle under the ribbon is level crosswise.
  const shoulder = Math.max(.6, meshStep * 1.45), band = Math.min(shoulder, meshStep * 1.45);
  const levels = scene.siteHierarchy?.levels ?? [];
  const levelMap = new Map(levels.map((level) => [level.id, level]));
  const padRects = v3GradedPadRects(scene);
  const pads: V3GradingPad[] = levels.filter((level) => V3_GRADING_SUPPORT.has(level.supportType) && Number.isFinite(level.elevation) && level.region.width > 0 && level.region.depth > 0)
    .map((level) => ({ level, elevation: level.elevation, rect: padRects.get(level.id) ?? levelRect(level), open: new Set(level.openEdges ?? []) }))
    .sort((a, b) => b.elevation - a.elevation || a.level.id.localeCompare(b.level.id));
  const padAt = (x: number, z: number, except?: V3GradingPad) => pads.find((pad) => pad !== except && inRect(pad.rect, x, z));

  /* 1. Connection profiles: follow the padded ground, pinned to pad elevations, clamped to max grade. */
  const connections: V3GradedConnection[] = [];
  const corridors: { id: string; half: number; points: P2[]; cum: number[]; stations: number[]; ys: number[] }[] = [];
  const ordered = [...(scene.siteHierarchy?.connections ?? [])].sort((a, b) => Number(a.type === "driveway") - Number(b.type === "driveway"));
  for (const connection of ordered) {
    const route = routes.get(connection.id) ?? [];
    const points = route.map(([x, , z]) => [x, z] as P2), cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const total = cum.at(-1) ?? 0, half = Math.max(.3, connection.width / 2);
    let reason = gradableConnection(connection, levelMap) ?? (points.length < 2 || total < .5 ? "degenerate route" : undefined);
    const stations: number[] = [], xz: P2[] = [];
    for (let i = 0; i < points.length - 1 && !reason; i++) {
      const length = cum[i + 1] - cum[i], count = Math.max(1, Math.ceil(length));
      for (let k = i === 0 ? 0 : 1; k <= count; k++) { const t = k / count; stations.push(cum[i] + length * t); xz.push([points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t]); }
    }
    let ys: number[] = [];
    if (!reason) {
      // A route levels off into a pad: stations whose shoulder reaches the endpoint pads land at their elevation.
      const ends = pads.filter((pad) => pad.level.id === connection.fromLevelId || pad.level.id === connection.toLevelId);
      const landing = (x: number, z: number) => padAt(x, z) ?? ends.find((pad) => { const [lx, lz] = toLocal(pad.rect, x, z); return Math.hypot(Math.max(0, Math.abs(lx) - pad.rect.hw), Math.max(0, Math.abs(lz) - pad.rect.hd)) <= half + shoulder; });
      const ground = xz.map(([x, z]) => landing(x, z)?.elevation ?? natural(x, z)), pinned = xz.map(([x, z]) => !!landing(x, z));
      const window = connection.type === "driveway" ? 6 : 2.5;
      // Symmetric window, shrinking to zero at the route ends so the start/arrival meet the ground exactly.
      const smoothed = ground.map((_, i) => { const w = Math.min(window, stations[i] - stations[0], stations[stations.length - 1] - stations[i]); let sum = 0, count = 0; for (let j = 0; j < ground.length; j++) if (Math.abs(stations[j] - stations[i]) <= w + 1e-9) { sum += ground[j]; count++; } return sum / count; });
      ys = ground.slice();
      const grade = connection.maxGrade ?? (connection.type === "driveway" ? .15 : .33);
      for (let a = 0; a < ys.length;) {
        if (pinned[a]) { a++; continue; }
        let b = a; while (b + 1 < ys.length && !pinned[b + 1]) b++;
        const l = a > 0 ? a - 1 : a, r = b < ys.length - 1 ? b + 1 : b;
        const left = ground[l], right = ground[r], span = Math.max(1e-6, stations[r] - stations[l]);
        for (let i = a; i <= b; i++) {
          const t = (stations[i] - stations[l]) / span;
          ys[i] = smoothed[i] + (left - smoothed[l]) * (1 - t) + (right - smoothed[r]) * t;
        }
        // Max-grade clamp with fixed ends, when the ends are reachable at all.
        if (Math.abs(right - left) <= grade * span + 1e-6) for (let pass = 0; pass < 4; pass++) {
          for (let i = Math.max(a, l + 1); i <= Math.min(b, r); i++) ys[i] = clamp(ys[i], ys[i - 1] - grade * (stations[i] - stations[i - 1]), ys[i - 1] + grade * (stations[i] - stations[i - 1]));
          for (let i = Math.min(b, r - 1); i >= Math.max(a, l); i--) ys[i] = clamp(ys[i], ys[i + 1] - grade * (stations[i + 1] - stations[i]), ys[i + 1] + grade * (stations[i + 1] - stations[i]));
        }
        a = b + 1;
      }
      // A jump between two pinned pads (or an impossible grade) is a stair condition, not a graded route.
      for (let i = 1; i < ys.length && !reason; i++) if (Math.abs(ys[i] - ys[i - 1]) > Math.max(.3, (stations[i] - stations[i - 1]) * 1)) reason = "level step needs a stair";
    }
    const graded = !reason;
    let maxGrade = 0, maxCut = 0, maxFill = 0;
    if (graded) for (let i = 0; i < ys.length; i++) {
      if (i) maxGrade = Math.max(maxGrade, Math.abs(ys[i] - ys[i - 1]) / Math.max(1e-6, stations[i] - stations[i - 1]));
      const n = padAt(...xz[i]) ? ys[i] : natural(...xz[i]);
      maxCut = Math.max(maxCut, n - ys[i]); maxFill = Math.max(maxFill, ys[i] - n);
    }
    connections.push({ id: connection.id, type: connection.type, graded, ...(reason ? { reason } : {}), halfWidth: half, profile: graded ? xz.map(([x, z], i) => [x, ys[i], z]) : route, stations: graded ? stations : cum, maxGrade, maxCut, maxFill });
    if (graded) corridors.push({ id: connection.id, half, points, cum, stations, ys });
  }
  const outside = (x: number, z: number) => {
    const n0 = natural(x, z);
    let h = n0;
    // Same rule as pads: inside a corridor core the nearest leg's profile wins; beyond the core only steps
    // under 0.6 m are battered back to natural ground. Larger steps become derived corridor walls (step 4).
    let coreSum = 0, coreWeight = 0;
    for (const c of corridors) for (let i = 0; i < c.points.length - 1; i++) {
      const { d, s } = nearestOnPolyline([c.points[i], c.points[i + 1]], [c.cum[i], c.cum[i + 1]], x, z), inner = c.half + shoulder;
      if (d > inner + 2) continue;
      const y = interpolateStations(c.stations, c.ys, s);
      // Overlapping cores (inside of a turn) blend by depth, so the running surface has no crease.
      if (d <= inner) { const w = (inner - d + .05) ** 2; coreSum += w * y; coreWeight += w; }
      else if (Math.abs(y - n0) < V3_RETAINING_STEP) h += (y - h) * smooth(1 - (d - inner) / 2);
    }
    if (coreWeight) h = coreSum / coreWeight;
    return h;
  };

  /* 2. Pad edges: batter small steps, retain steps ≥ 0.6 m unless the edge is intentionally open. */
  const authored = authoredWallLines(scene);
  const authoredRetains = (at: P2, dir: P2) => authored.some(({ a, b, thickness }) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    if (Math.abs(ux * dir[0] + uz * dir[1]) < .9) return false;
    const along = (at[0] - a[0]) * ux + (at[1] - a[1]) * uz, across = Math.abs(-(at[0] - a[0]) * uz + (at[1] - a[1]) * ux);
    return along >= -.25 && along <= len + .25 && across <= thickness / 2 + 1;
  });
  const edges: PadEdges[] = pads.map((pad) => {
    const sides = {} as Record<V3PadSide, EdgeSample[]>;
    for (const side of SIDES) {
      const { a, b, n, length } = sideFrame(pad, side), count = edgeCount(length), dir: P2 = [(b[0] - a[0]) / (length || 1), (b[1] - a[1]) / (length || 1)];
      sides[side] = Array.from({ length: count }, (_, k): EdgeSample => {
        const t = (k + .5) / count, at: P2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (padAt(at[0] - n[0] * .05, at[1] - n[1] * .05) !== pad) return { kind: "covered", step: 0, at, outside: pad.elevation };
        const out: P2 = [at[0] + n[0] * .3, at[1] + n[1] * .3], neighbour = padAt(out[0], out[1], pad);
        if (neighbour && neighbour.elevation > pad.elevation) return { kind: "neighbour", step: 0, at, outside: neighbour.elevation };
        const o = neighbour ? neighbour.elevation : outside(...out), step = pad.elevation - o;
        const kind: EdgeKind = pad.open.has(side) ? "open" : Math.abs(step) < V3_RETAINING_STEP ? "batter" : authoredRetains(at, dir) ? "authored" : "wall";
        return { kind, step, at, outside: o };
      });
    }
    return { pad, sides };
  });
  const graded = (x: number, z: number) => {
    const pad = padAt(x, z);
    if (pad) return pad.elevation;
    let h = outside(x, z);
    for (const { pad: p, sides } of edges) {
      const [lx, lz] = toLocal(p.rect, x, z), ox = Math.max(0, Math.abs(lx) - p.rect.hw), oz = Math.max(0, Math.abs(lz) - p.rect.hd), d = Math.hypot(ox, oz);
      if (d <= 0 || d > 14) continue;
      const side: V3PadSide = ox >= oz ? (lx < 0 ? "west" : "east") : (lz < 0 ? "north" : "south");
      const samples = sides[side], t = side === "north" || side === "south" ? (clamp(lx, -p.rect.hw, p.rect.hw) + p.rect.hw) / (2 * p.rect.hw) : (clamp(lz, -p.rect.hd, p.rect.hd) + p.rect.hd) / (2 * p.rect.hd);
      const sample = samples[clamp(Math.floor(t * samples.length), 0, samples.length - 1)];
      if (sample.kind !== "batter" && sample.kind !== "open") continue;
      const run = Math.max(2, Math.abs(sample.step) * (sample.kind === "open" ? 2 : 2.5));
      if (d < run) h += (p.elevation - h) * smooth(1 - d / run);
    }
    return h;
  };

  /* 3. Derived retaining walls: contiguous wall samples, tapered one sample into the neighbouring batter. */
  const walls: V3DerivedRetainingWall[] = [];
  for (const { pad, sides } of edges) for (const side of SIDES) {
    const samples = sides[side], { a, b, n } = sideFrame(pad, side);
    let run = 0;
    for (let k = 0; k < samples.length;) {
      if (samples[k].kind !== "wall") { k++; continue; }
      let end = k; while (end + 1 < samples.length && samples[end + 1].kind === "wall") end++;
      const first = k > 0 && samples[k - 1].kind === "batter" ? k - 1 : k, last = end < samples.length - 1 && samples[end + 1].kind === "batter" ? end + 1 : end;
      const picked = samples.slice(first, last + 1).map((sample): V3DerivedWallSample => {
        const o = graded(sample.at[0] + n[0] * .3, sample.at[1] + n[1] * .3);
        return { at: sample.at, high: Math.max(pad.elevation, o), low: Math.min(pad.elevation, o) };
      });
      // Runs reaching a pad corner continue 1 m past it, so the corner of the grade break is retained too.
      const reach = 1 / Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
      const t0 = first === 0 ? -reach : first / samples.length, t1 = last === samples.length - 1 ? 1 + reach : (last + 1) / samples.length, lerp = (t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const kinds = samples.slice(k, end + 1), neighbour = padAt(samples[k].at[0] + n[0] * .3, samples[k].at[1] + n[1] * .3, pad);
      run++;
      walls.push({
        id: `v3-retaining-${pad.level.id}-${side}-${run}`, levelId: pad.level.id, side,
        kind: neighbour ? "level-step" : kinds.every((sample) => sample.step > 0) ? "fill" : "cut",
        start: lerp(t0), end: lerp(t1), outward: n, samples: picked, maxHeight: Math.max(...picked.map((sample) => sample.high - sample.low)),
      });
      k = end + 1;
    }
  }
  const inCore = (x: number, z: number) => {
    let best = Infinity;
    for (const c of corridors) for (let i = 0; i < c.points.length - 1; i++) best = Math.min(best, nearestOnPolyline([c.points[i], c.points[i + 1]], [c.cum[i], c.cum[i + 1]], x, z).d - c.half - shoulder);
    return best < -.3 ? "inside" : best <= .05 ? "edge" : "outside";
  };
  /* 4. Corridor retaining walls: where a corridor's shoulder meets the ground with a step ≥ 0.6 m (cuts and fills). */
  for (const c of corridors) for (const [side, sign] of [["left", 1], ["right", -1]] as const) {
    let run = 0, current: V3DerivedWallSample[] = [], dirN: P2 = [0, 0];
    const flush = () => {
      if (current.length >= 2) {
        run++;
        const kind = current.every((sample) => sample.high === sample.low) ? "cut" : (current[0] as V3DerivedWallSample & { cut?: boolean }).cut ? "cut" : "fill";
        walls.push({ id: `v3-retaining-${c.id}-${side}-${run}`, connectionId: c.id, side, kind, ...(kind === "cut" ? { inset: band - .1 } : {}), start: current[0].at, end: current[current.length - 1].at, outward: dirN, samples: current, maxHeight: Math.max(...current.map((sample) => sample.high - sample.low)) });
      }
      current = [];
    };
    for (let i = 0; i < c.points.length - 1; i++) {
      const [ax, az] = c.points[i], [bx, bz] = c.points[i + 1], length = Math.hypot(bx - ax, bz - az);
      if (length < 1) continue;
      const ux = (bx - ax) / length, uz = (bz - az) / length, n: P2 = [-uz * sign, ux * sign], inner = c.half + shoulder;
      if (current.length && (Math.abs(n[0] - dirN[0]) > 1e-6 || Math.abs(n[1] - dirN[1]) > 1e-6)) flush();
      dirN = n;
      // Sampled past both leg ends so a hairpin's outer corner is retained too; samples inside any core are skipped.
      for (let t = .5; t < length; t += 1) {
        const at: P2 = [ax + ux * t + n[0] * inner, az + uz * t + n[1] * inner];
        if (inCore(at[0] + n[0] * .3, at[1] + n[1] * .3) !== "outside") { flush(); continue; }
        const coreY = outside(at[0] - n[0] * .1, at[1] - n[1] * .1), beyond = outside(at[0] + n[0] * .3, at[1] + n[1] * .3);
        const steep = Math.abs(coreY - beyond) >= V3_RETAINING_STEP && !padAt(...at) && !padAt(at[0] + n[0] * .3, at[1] + n[1] * .3);
        if (!steep) { flush(); continue; }
        current.push(Object.assign({ at, high: Math.max(coreY, beyond), low: Math.min(coreY, beyond) }, { cut: beyond > coreY }));
      }
    }
    flush();
  }
  // Turns and route ends: the corridor's round cap, retained along its exposed arc.
  for (const c of corridors) c.points.forEach(([vx, vz], k) => {
    const inner = c.half + shoulder, arc: (V3DerivedWallSample & { cut: boolean; step: number })[][] = [[]];
    for (let step = 0; step < 48; step++) {
      const angle = step / 48 * Math.PI * 2, n: P2 = [Math.cos(angle), Math.sin(angle)], at: P2 = [vx + n[0] * inner, vz + n[1] * inner];
      const exposed = inCore(at[0] + n[0] * .3, at[1] + n[1] * .3) === "outside" && !padAt(...at) && !padAt(at[0] + n[0] * .3, at[1] + n[1] * .3);
      const coreY = outside(at[0] - n[0] * .1, at[1] - n[1] * .1), beyond = outside(at[0] + n[0] * .3, at[1] + n[1] * .3);
      if (exposed && Math.abs(coreY - beyond) >= V3_RETAINING_STEP) arc[arc.length - 1].push({ at, high: Math.max(coreY, beyond), low: Math.min(coreY, beyond), normal: n, cut: beyond > coreY, step });
      else if (arc[arc.length - 1].length) arc.push([]);
    }
    // An exposed arc crossing angle 0 is one run.
    const tail = arc[arc.length - 1];
    if (arc.length > 1 && arc[0][0]?.step === 0 && tail.at(-1)?.step === 47) arc[0] = [...arc.pop()!, ...arc[0]];
    arc.filter((samples) => samples.length >= 2).forEach((samples, run) => walls.push({
      id: `v3-retaining-${c.id}-turn-${k + 1}-${run + 1}`, connectionId: c.id, side: "turn", kind: samples.filter((sample) => sample.cut).length * 2 >= samples.length ? "cut" : "fill", ...(samples.filter((sample) => sample.cut).length * 2 >= samples.length ? { inset: band - .1 } : {}),
      start: samples[0].at, end: samples[samples.length - 1].at, outward: samples[0].normal!, samples, maxHeight: Math.max(...samples.map((sample) => sample.high - sample.low)),
    }));
  });
  return { natural, outside, graded, pads, connections, walls, padAt: (x, z) => padAt(x, z) };
}

/** Derived retaining walls compiled as solid tri-meshes whose exposed face sits on the grade break. */
export function v3DerivedWallVertices(wall: V3DerivedRetainingWall): number[] {
  const out: number[] = [], first = wall.samples[0], last = wall.samples[wall.samples.length - 1], highSide = wall.kind === "cut" ? 1 : -1, inset = wall.inset ?? .05;
  // Stations: run start, every sample, run end. Each carries its own top/bottom (the coping follows the grade break) and normal.
  const raw = [{ ...first, at: wall.start }, ...wall.samples, { ...last, at: wall.end }];
  const stations = raw.filter((station, i) => i === 0 || Math.hypot(station.at[0] - raw[i - 1].at[0], station.at[1] - raw[i - 1].at[1]) > .05).map((station) => {
    const n = station.normal ?? wall.outward;
    return { f: [station.at[0] - n[0] * inset * highSide, station.at[1] - n[1] * inset * highSide], back: [station.at[0] + n[0] * WALL_THICKNESS * highSide, station.at[1] + n[1] * WALL_THICKNESS * highSide], top: station.high + (highSide < 0 ? -.01 : .05), bottom: station.low - .4 };
  });
  const quad = (a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i + 1];
    quad([a.f[0], a.bottom, a.f[1]], [b.f[0], b.bottom, b.f[1]], [b.f[0], b.top, b.f[1]], [a.f[0], a.top, a.f[1]]);
    quad([a.back[0], a.bottom, a.back[1]], [a.back[0], a.top, a.back[1]], [b.back[0], b.top, b.back[1]], [b.back[0], b.bottom, b.back[1]]);
    quad([a.f[0], a.top, a.f[1]], [b.f[0], b.top, b.f[1]], [b.back[0], b.top, b.back[1]], [a.back[0], a.top, a.back[1]]);
    if (i === 0) quad([a.f[0], a.bottom, a.f[1]], [a.f[0], a.top, a.f[1]], [a.back[0], a.top, a.back[1]], [a.back[0], a.bottom, a.back[1]]);
    if (i === stations.length - 2) quad([b.f[0], b.bottom, b.f[1]], [b.back[0], b.bottom, b.back[1]], [b.back[0], b.top, b.back[1]], [b.f[0], b.top, b.f[1]]);
  }
  return out;
}

/** Extra mesh lines (pairs a few cm apart) on aligned pad and pool edges, so grade breaks and shells are crisp. */
export function v3GradingFeatureLines(scene: V3Scene): { xs: number[]; zs: number[] } {
  const xs: number[] = [], zs: number[] = [];
  const add = (r: Rect, offsets: readonly number[]) => {
    if (!r.aligned) return;
    for (const sign of [-1, 1]) for (const offset of offsets) { xs.push(r.cx + sign * (r.hw + offset)); zs.push(r.cz + sign * (r.hd + offset)); }
  };
  for (const rect of v3GradedPadRects(scene).values()) add(rect, [-.02, .02]);
  for (const pool of scene.objects.filter((o) => o.type === "pool")) add(objectRect(pool), [.03, .08]);
  return { xs, zs };
}

/** Pool excavation: only the shell footprint (plus a mesh-cell margin when the pool is not grid-aligned). */
export function v3PoolExcavation(scene: V3Scene, step: number) {
  return scene.objects.filter((o) => o.type === "pool").map((pool) => {
    const r = objectRect(pool), [, h] = scaledDimensionsOf(pool);
    return { rect: r, bottom: pool.architecture ? getObjectBaseY(pool) : pool.transform.position[1] - h, margin: r.aligned ? .05 : step * 1.45 };
  });
}
export const v3PoolCarve = (pools: ReturnType<typeof v3PoolExcavation>, x: number, z: number, h: number) =>
  pools.reduce((height, pool) => inRect(pool.rect, x, z, pool.margin) ? Math.min(height, pool.bottom) : height, h);
