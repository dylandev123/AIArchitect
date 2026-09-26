import type { WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { POOL_COPING_WIDTH, SITE_POSITION_LIMIT } from "../constants";
import { waterwayCurve } from "../features/waterways";
import { retainingWallCurve } from "../features/retainingWalls";
import { polylineLength } from "../geometry/mesh";
import { wallPoint } from "./siteRules";

/**
 * Site-wide collision validation for the exterior features a design generates.
 *
 * The scale, style and tier rules each place their own parts with their own heuristics, and the model places some
 * itself, so nothing guaranteed that a gazebo missed the pool, that a river missed the guest house or that a retaining
 * wall left room for the drive. This pass runs once over the finished op list, before anything is committed:
 *
 *   - every feature that stands on the ground gets a footprint (rectangle, or a curve with a half-width);
 *   - features are settled in priority order — the house and its wings first, then wall-anchored parts, the pool,
 *     terrain, detached buildings and so on — and each one is checked against everything already settled;
 *   - a feature that collides is moved to the *nearest* position that clears everything, never past the tether that
 *     keeps its relationship intact (a bar stays by the pool, a garage stays on the drive, a wall stays behind the house);
 *   - a feature with no such position is reported, so generation can retry instead of committing an overlap.
 *
 * Only features in `ops` are ever moved. `existing` (the current project, for a scoped edit) is read as fixed
 * obstacles, so a project that already has overlaps is left exactly as it is and nothing unrelated is disturbed.
 * Ids are untouched: a move only rewrites position fields on the same op.
 */

type Rec = Record<string, unknown>;
type P = [number, number];
type Shell = { width: number; depth: number };

export type CollisionRole = "main" | "att" | "bd" | "dg" | "gz" | "patio" | "drive" | "park" | "pool" | "deck" | "water" | "wall";

export interface SiteCollisionInput {
  /** The house's footprint. Omitted for a scoped edit: it is read from `existing`, with any `setHouse` in `ops` applied. */
  house?: Shell;
  ops: readonly PatchOp[];
  /** The current project's JSON, for a scoped edit: its features are fixed obstacles the new ones must clear. */
  existing?: Rec;
}

export interface SiteCollisionResult {
  ops: PatchOp[];
  /** Human-readable, model-actionable reasons a feature could not be placed. Empty = the design is clear. */
  errors: string[];
  /**
   * Op indices (into the input `ops`) of features that could not be placed, one entry per error in the same order;
   * empty when the blocked feature is not an op (the house or an existing feature), i.e. it cannot be dropped.
   * Lets a caller with no one to ask (initial generation) drop them instead of failing.
   */
  unplaced: number[][];
  /** What was moved, for logging and tests. */
  relocated: string[];
}

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const round = (v: number) => Math.round(v * 10) / 10;

/** Penetration this deep is a touch, not an overlap: wings are drawn a wall thickness into their neighbour. */
const TOLERANCE = 0.25;
/** A moved feature must clear by this much more than an untouched one, so rounding its new coordinates to 0.1 m cannot undo the check. */
const MOVE_MARGIN = 0.1;
/** How far a feature may be moved from where it was put, in metres. */
const SEARCH_RADIUS = 48;

// ── Geometry ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A closed convex polygon (a footprint) or an open polyline with a half-width (a river, a wall). */
interface Shape { pts: P[]; closed: boolean; half: number }

const shapeAt = (item: { shape: Shape; shapeAt?: (dx: number, dz: number) => Shape }, dx: number, dz: number): Shape => item.shapeAt?.(dx, dz) ?? translated(item.shape, dx, dz);
const translated = (s: Shape, dx: number, dz: number): Shape => (dx === 0 && dz === 0 ? s : { ...s, pts: s.pts.map(([x, z]) => [x + dx, z + dz] as P) });

function boxOf(s: Shape): [number, number, number, number] {
  let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, z] of s.pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return [x0 - s.half, z0 - s.half, x1 + s.half, z1 + s.half];
}

/** A rectangle `w` × `d` about (cx, cz), turned by `yaw` degrees the way the renderer turns a building. */
function rectShape(cx: number, cz: number, w: number, d: number, yawDeg = 0): Shape {
  const yaw = (yawDeg * Math.PI) / 180;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const pts = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sz]) => {
    const dx = (sx * w) / 2;
    const dz = (sz * d) / 2;
    return [cx + dx * cos + dz * sin, cz - dx * sin + dz * cos] as P;
  });
  return { pts, closed: true, half: 0 };
}

const segments = (s: Shape): [P, P][] => {
  const out: [P, P][] = [];
  for (let i = 0; i + 1 < s.pts.length; i++) out.push([s.pts[i], s.pts[i + 1]]);
  if (s.closed) out.push([s.pts[s.pts.length - 1], s.pts[0]]);
  return out;
};

function pointSegment(p: P, a: P, b: P): number {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t));
}

const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function segmentDistance(a: P, b: P, c: P, d: P): number {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}

function insidePolygon(p: P, poly: readonly P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** How deep two overlapping convex polygons sit in each other (separating-axis test); 0 when they are apart. */
function penetration(a: readonly P[], b: readonly P[]): number {
  let least = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const nx = -(q[1] - p[1]) / len;
      const nz = (q[0] - p[0]) / len;
      const range = (pts: readonly P[]) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const [x, z] of pts) { const v = x * nx + z * nz; lo = Math.min(lo, v); hi = Math.max(hi, v); }
        return [lo, hi] as const;
      };
      const [al, ah] = range(a);
      const [bl, bh] = range(b);
      const overlap = Math.min(ah, bh) - Math.max(al, bl);
      if (overlap <= 0) return 0;
      least = Math.min(least, overlap);
    }
  }
  return least;
}

/**
 * The gap between two shapes: metres of clear ground between them, negative when they overlap. Anything farther apart
 * than `cap` reads as `Infinity` — callers that need the true distance pass a large cap.
 */
function gapBetween(a: Shape, b: Shape, cap = 12): number {
  const [ax0, az0, ax1, az1] = boxOf(a);
  const [bx0, bz0, bx1, bz1] = boxOf(b);
  if (Math.max(bx0 - ax1, ax0 - bx1, bz0 - az1, az0 - bz1) > cap) return Infinity;

  if (a.closed && b.closed) {
    const pen = penetration(a.pts, b.pts);
    if (pen > 0) return -pen;
  } else {
    const [poly, line] = a.closed ? [a, b] : b.closed ? [b, a] : [undefined, undefined];
    if (poly && line && line.pts.some((p) => insidePolygon(p, poly.pts))) return -(line.half + 1);
  }
  let dist = Infinity;
  for (const [p, q] of segments(a)) for (const [r, s] of segments(b)) dist = Math.min(dist, segmentDistance(p, q, r, s));
  const half = a.half + b.half;
  // A curve that touches or crosses anything overlaps it, however thin its half-width; two footprints that merely touch do not.
  return dist === 0 && !(a.closed && b.closed) ? Math.min(-half, -TOLERANCE * 2) : dist - half;
}

// ── Features → items ────────────────────────────────────────────────────────────────────────────────────────────

/** Op name → its array in the project JSON, for the features this pass checks. */
const KEYS: Record<string, string> = {
  addBuilding: "buildings",
  addGarage: "garages",
  addPatio: "patios",
  addPool: "pools",
  addDeck: "decks",
  addDriveway: "driveways",
  addParking: "parking",
  addWaterway: "waterways",
  addRetainingWall: "retainingWalls",
};

interface Item {
  id: string;
  label: string;
  role: CollisionRole;
  shape: Shape;
  /** Settled before anything else, never moved: the house and wings. */
  fixed: boolean;
  /** An existing feature of the project (scoped edit): an obstacle, never checked or moved. */
  existing: boolean;
  priority: number;
  /** Index into the incoming ops, for a feature that may be moved. */
  op?: number;
  opName?: string;
  /** Wall-anchored parts slide along their wall instead of moving freely. */
  slide?: { wall: WallSide; from: number; to: number };
  /** A raised deck may stand over a building, so it collides with none. */
  elevated?: boolean;
  stripes?: boolean;
  buildingKind?: string;
  /** A pool's water centre. */
  centre?: P;
  /** The shape at an offset, for a feature whose outline is not simply translated by a move (a river's meander depends on its start). */
  shapeAt?: (dx: number, dz: number) => Shape;
  /** May leave its wall for a free position when sliding along it finds none. */
  freeFallback?: boolean;
}

const PRIORITY: Record<string, number> = {
  main: 100, att: 80, patio: 76, drive: 74, pool: 66, deck: 60,
  bd: 55, dg: 52, park: 45, bar: 40, gz: 38, shed: 30,
  // Terrain gives way to what is built: a wall stops short of a garage, a river bends around a guest house.
  wall: 25, water: 20,
};

const isNS = (wall: WallSide) => wall === "north" || wall === "south";
const wallOf = (v: unknown): WallSide => (v === "north" || v === "south" || v === "east" || v === "west" ? v : "south");
const wallLength = (h: Shell, wall: WallSide) => (isNS(wall) ? h.width : h.depth);

/** Ground rectangle `out0`…`out1` metres out from a house wall, `offset`…`offset + width` along it. */
function wallShape(house: Shell, wall: WallSide, offset: number, width: number, out0: number, out1: number): Shape {
  const h = { ...house, floors: 1, roof: "flat" }; // wallPoint only reads the footprint
  return { pts: [wallPoint(h, wall, offset, out0), wallPoint(h, wall, offset + width, out0), wallPoint(h, wall, offset + width, out1), wallPoint(h, wall, offset, out1)], closed: true, half: 0 };
}

const centreOf = (s: Shape): P => {
  const [x0, z0, x1, z1] = boxOf(s);
  return [(x0 + x1) / 2, (z0 + z1) / 2];
};

/** Describes one feature as an item, or null when it is not a ground feature this pass checks. */
function toItem(opName: string, v: Rec, house: Shell, ctx: { id: string; n: number; existing: boolean; op?: number }): Item | null {
  const base = { id: ctx.id, fixed: false, existing: ctx.existing, op: ctx.op, opName };
  const label = (name: string) => `${name} ${ctx.n}`;
  const waterwayIndex = ctx.n - 1;
  switch (opName) {
    case "addBuilding": {
      const kind = typeof v.kind === "string" ? v.kind : "villa";
      const shape = rectShape(num(v.x), num(v.z), num(v.width), num(v.depth), num(v.rotation));
      const named = kind.replace("_", " ");
      if (kind === "wing") return { ...base, label: label("wing"), role: "main", shape, fixed: true, priority: PRIORITY.main - 10, buildingKind: kind };
      if (kind === "gazebo") return { ...base, label: label(named), role: "gz", shape, priority: PRIORITY.gz, buildingKind: kind };
      if (kind === "outdoor_bar") return { ...base, label: label(named), role: "gz", shape, priority: PRIORITY.bar, buildingKind: kind };
      if (kind === "detached_garage") return { ...base, label: label(named), role: "dg", shape, priority: PRIORITY.dg, buildingKind: kind };
      return { ...base, label: label(named), role: "bd", shape, priority: kind === "shed" ? PRIORITY.shed : PRIORITY.bd, buildingKind: kind };
    }
    case "addGarage": case "addPatio": {
      const wall = wallOf(v.wall);
      const offset = num(v.offset);
      const width = num(v.width);
      const role = opName === "addPatio" ? "patio" : "att";
      const name = opName === "addGarage" ? "garage" : "patio";
      return { ...base, label: label(name), role, shape: wallShape(house, wall, offset, width, 0, num(v.depth)), priority: PRIORITY[role], slide: { wall, from: -offset, to: wallLength(house, wall) - offset - width } };
    }
    case "addDriveway": {
      const wall = wallOf(v.wall);
      const offset = num(v.offset);
      const width = num(v.width);
      // A bowed drive strays up to its bend to either side of the straight line.
      const bow = Math.abs(num(v.bend)) / 2;
      return { ...base, label: label("driveway"), role: "drive", shape: wallShape(house, wall, offset - bow, width + bow * 2, 0, num(v.length)), priority: PRIORITY.drive, slide: { wall, from: -offset, to: wallLength(house, wall) - offset - width } };
    }
    case "addPool": {
      const coping = POOL_COPING_WIDTH;
      const width = num(v.width);
      const depth = num(v.depth);
      const site = typeof v.siteX === "number";
      const shape = site
        ? rectShape(v.siteX as number, num(v.siteZ), width + coping * 2, depth + coping * 2)
        : wallShape(house, wallOf(v.wall), num(v.offset) - coping, width + coping * 2, num(v.distance) - coping, num(v.distance) + depth + coping);
      // The water's own centre: where a moved pool is re-anchored, whichever way it was placed.
      const water = wallShape(house, wallOf(v.wall), num(v.offset), width, num(v.distance), num(v.distance) + depth);
      const centre: P = site ? [v.siteX as number, num(v.siteZ)] : centreOf(water);
      // A pool set against the house slides along its wall first, which keeps it in front of its patio.
      const wall = wallOf(v.wall);
      const slide = site ? undefined : { wall, from: -num(v.offset), to: wallLength(house, wall) - num(v.offset) - width };
      return { ...base, label: label("pool"), role: "pool", shape, priority: PRIORITY.pool, centre, slide, freeFallback: true };
    }
    case "addDeck":
      return { ...base, label: label("deck"), role: "deck", shape: rectShape(num(v.x), num(v.z), num(v.width), num(v.depth), num(v.rotation)), priority: PRIORITY.deck, elevated: num(v.level) > 0 };
    case "addParking":
      return { ...base, label: label("parking"), role: "park", shape: rectShape(num(v.x), num(v.z), num(v.width), num(v.depth)), priority: PRIORITY.park, stripes: v.stripes !== false };
    case "addWaterway": {
      const kind = v.kind === "river" ? "river" : "stream";
      const width = num(v.width, 3);
      // The bed, its raised lips and the mud shoulder all belong to the river.
      const at = (dx: number, dz: number): Shape => ({
        pts: waterwayCurve({ kind, x1: num(v.x1) + dx, z1: num(v.z1) + dz, x2: num(v.x2) + dx, z2: num(v.z2) + dz, width, bend: num(v.bend), meander: num(v.meander, kind === "river" ? 0.5 : 0.7) }, waterwayIndex),
        closed: false,
        half: width / 2 + 1.8,
      });
      return { ...base, label: label(kind), role: "water", shape: at(0, 0), shapeAt: at, priority: PRIORITY.water };
    }
    case "addRetainingWall": {
      const curve = retainingWallCurve({ x1: num(v.x1), z1: num(v.z1), x2: num(v.x2), z2: num(v.z2), height: num(v.height, 1.2), thickness: num(v.thickness, 0.4), bend: num(v.bend) });
      // Buttress piers stand a little proud of the wall on its low side.
      return { ...base, label: label("retaining wall"), role: "wall", shape: { pts: curve, closed: false, half: num(v.thickness, 0.4) / 2 + 0.45 }, priority: PRIORITY.wall };
    }
  }
  return null;
}

// ── Clearances and relationships ────────────────────────────────────────────────────────────────────────────────

/** Metres of clear ground each pair of roles needs. A pair that is absent may overlap (paving on paving, a wing on the house). */
const NEED: Record<string, number> = {
  "main|att": 0, "main|bd": 3, "main|dg": 2, "main|gz": 2, "main|patio": 0, "main|drive": 0, "main|park": 1, "main|pool": 0, "main|deck": 0, "main|water": 3, "main|wall": 2,
  "att|att": 0, "att|bd": 2, "att|dg": 2, "att|gz": 1.5, "att|patio": 0, "att|park": 1, "att|pool": 1, "att|deck": 0.5, "att|water": 3, "att|wall": 2,
  "bd|bd": 2.5, "bd|dg": 2, "bd|gz": 1.5, "bd|patio": 1, "bd|drive": 1, "bd|park": 1, "bd|pool": 1.5, "bd|deck": 1, "bd|water": 3, "bd|wall": 1.5,
  "dg|dg": 1.5, "dg|gz": 1.5, "dg|patio": 1, "dg|drive": 0, "dg|park": 0, "dg|pool": 2, "dg|deck": 1, "dg|water": 3, "dg|wall": 1.5,
  "gz|gz": 1.5, "gz|patio": 0.5, "gz|drive": 1, "gz|park": 1, "gz|pool": 1.5, "gz|deck": 0.5, "gz|water": 2, "gz|wall": 1,
  "patio|patio": 0, "patio|drive": 0, "patio|park": 0.5, "patio|pool": 0, "patio|deck": 0, "patio|water": 1.5, "patio|wall": 1,
  "drive|park": -1, "drive|pool": 1.5, "drive|deck": 1, "drive|water": 1, "drive|wall": 1,
  "park|pool": 1.5, "park|deck": 1, "park|water": 1, "park|wall": 1,
  "pool|pool": 3, "pool|deck": 0, "pool|water": 3, "pool|wall": 1.5,
  "deck|deck": 1, "deck|water": 1.5, "deck|wall": 1,
  "water|wall": 1,
};
const BUILDINGS = new Set<CollisionRole>(["main", "att", "bd", "dg", "gz"]);

/** Clear ground `a` and `b` need between them, or null when they may overlap. */
function clearance(a: Item, b: Item): number | null {
  if ((a.elevated && BUILDINGS.has(b.role)) || (b.elevated && BUILDINGS.has(a.role))) return null;
  // The wings and house are one mass; a driveway starts under its own garage.
  if (a.role === "main" && b.role === "main") return null;
  if (a.role === "att" && b.role === "drive" || a.role === "drive" && b.role === "att") return null;
  const need = NEED[`${a.role}|${b.role}`] ?? NEED[`${b.role}|${a.role}`];
  return need === undefined || need < 0 ? null : need;
}

interface Tether { roles: readonly CollisionRole[]; max: number; contact?: boolean }

/** What a feature must stay near, so moving it never breaks the reason it was put there. */
function tetherOf(item: Item): Tether[] {
  switch (item.buildingKind ?? item.role) {
    case "outdoor_bar": return [{ roles: ["pool"], max: 10 }, { roles: ["deck", "patio"], max: 10 }, { roles: ["main"], max: 16 }];
    case "gazebo": return [{ roles: ["pool", "deck", "patio"], max: 16 }, { roles: ["main"], max: 20 }];
    case "detached_garage": return [{ roles: ["drive"], max: 6 }, { roles: ["park"], max: 8 }];
    case "park": return [{ roles: ["drive"], max: 6 }];
    case "shed": case "villa": case "restaurant": case "reception": return [{ roles: ["main"], max: 30 }];
    case "deck": return [{ roles: ["pool", "patio"], max: 6 }, { roles: ["main"], max: 12 }];
    case "pool": return [{ roles: ["patio", "main"], max: 8 }];
    case "wall": return [{ roles: ["main"], max: 16 }];
    default: return [];
  }
}

// ── Grouping ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Items that move as one: a garage row with its apron, an attached garage with the drive that leaves it. */
function groupItems(items: Item[]): Item[][] {
  const movable = items.filter((i) => !i.fixed && !i.existing);
  const parent = movable.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < movable.length; i++) {
    for (let j = i + 1; j < movable.length; j++) {
      const a = movable[i];
      const b = movable[j];
      const garageRun = (a.role === "dg" && (b.role === "dg" || (b.role === "park" && b.stripes === false))) || (b.role === "dg" && a.role === "park" && a.stripes === false);
      const attachedDrive = a.slide && b.slide && a.slide.wall === b.slide.wall && ((a.role === "att" && b.role === "drive") || (a.role === "drive" && b.role === "att"));
      if (garageRun && gapBetween(a.shape, b.shape, 1) < 0.8) parent[find(i)] = find(j);
      else if (attachedDrive && gapBetween(a.shape, b.shape, 1) < 0) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Item[]>();
  movable.forEach((item, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), item]));
  return [...groups.values()];
}

// ── Placement ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Free-move offsets, nearest first. */
const OFFSETS: P[] = (() => {
  const out: P[] = [];
  for (let x = -SEARCH_RADIUS; x <= SEARCH_RADIUS; x++) for (let z = -SEARCH_RADIUS; z <= SEARCH_RADIUS; z++) if (Math.hypot(x, z) <= SEARCH_RADIUS) out.push([x, z]);
  return out.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[0] - b[0] || a[1] - b[1]);
})();

const AXIS: Record<WallSide, P> = { north: [1, 0], south: [1, 0], east: [0, 1], west: [0, 1] };

/** The first thing a feature at this offset would collide with, or undefined when it is clear. */
function conflictAt(group: readonly Item[], dx: number, dz: number, settled: readonly Item[], slack = dx === 0 && dz === 0 ? 0 : MOVE_MARGIN): { with: Item; gap: number; need: number } | undefined {
  for (const m of group) {
    const shape = shapeAt(m, dx, dz);
    for (const s of settled) {
      const need = clearance(m, s);
      if (need === null) continue;
      const gap = gapBetween(shape, s.shape, need + 1);
      if (gap < need - TOLERANCE + slack) return { with: s, gap, need };
    }
  }
  return undefined;
}

function tetherGap(group: readonly Item[], dx: number, dz: number, roles: readonly CollisionRole[], settled: readonly Item[]): number | undefined {
  const targets = settled.filter((s) => roles.includes(s.role) && !group.includes(s));
  if (targets.length === 0) return undefined;
  // A garage run meets the drive by its apron, so the apron is what stays in reach — not whichever bay happens to be nearest.
  const aprons = roles.includes("drive") ? group.filter((m) => m.role === "park") : [];
  let best = Infinity;
  for (const m of aprons.length > 0 ? aprons : group) for (const t of targets) best = Math.min(best, gapBetween(shapeAt(m, dx, dz), t.shape, 200));
  return best;
}

/** Returns a predicate: is a move to (dx, dz) within the group's tether? */
function tetherCheck(group: readonly Item[], settled: readonly Item[]): (dx: number, dz: number) => boolean {
  const checks: ((dx: number, dz: number) => boolean)[] = [];
  const seen = new Set<string>();
  for (const item of group) {
    for (const t of tetherOf(item)) {
      const key = t.roles.join(",") + item.role;
      if (seen.has(key)) continue;
      const origin = tetherGap(group, 0, 0, t.roles, settled);
      if (origin === undefined) continue; // nothing of that kind exists: try the next tether
      seen.add(key);
      // A garage run whose apron meets the drive stays in contact with it; anything else may stray no farther than it was, or the tether.
      const touching = item.role === "dg" && t.roles.includes("drive") && origin < 0.8;
      const limit = touching ? 0.8 : Math.max(origin, t.max);
      checks.push((dx, dz) => (tetherGap(group, dx, dz, t.roles, settled) ?? 0) <= limit);
      break;
    }
  }
  return (dx, dz) => checks.every((c) => c(dx, dz));
}

/**
 * A retaining wall that runs into something stops short of it and carries on beyond it, the way a wall lets a drive
 * through: returns the sections of the wall that stand clear, as payloads (each a sub-arc of the same quadratic bow),
 * or none when too little of the wall would be left.
 */
function trimWall(v: Rec, wall: Item, settled: readonly Item[]): Rec[] {
  const [a, b]: [P, P] = [[num(v.x1), num(v.z1)], [num(v.x2), num(v.z2)]];
  const bend = num(v.bend);
  const half = num(v.thickness, 0.4) / 2 + 0.45;
  const curve = retainingWallCurve({ x1: a[0], z1: a[1], x2: b[0], z2: b[1], height: num(v.height, 1.2), thickness: num(v.thickness, 0.4), bend });
  const last = curve.length - 1;
  const blocked = curve.map((p) => settled.some((s) => {
    const need = clearance(wall, s);
    return need !== null && gapBetween({ pts: [p, p], closed: false, half }, s.shape, need + 1) < need - TOLERANCE;
  }));
  const pieces: Rec[] = [];
  let kept = 0;
  for (let i = 0; i <= last; ) {
    if (blocked[i] || blocked[i - 1] || blocked[i + 1]) { i++; continue; }
    let j = i;
    while (j + 1 <= last && !blocked[j + 1] && !blocked[j + 2]) j++;
    const run = polylineLength(curve.slice(i, j + 1));
    if (j > i && run >= 3) {
      const [t0, t1] = [i / last, j / last];
      // De Casteljau: the sub-arc of a quadratic Bezier is a quadratic Bezier with this control point.
      const mid: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const n: P = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
      const c: P = [mid[0] + n[0] * bend * 2, mid[1] + n[1] * bend * 2];
      const d0: P = [(1 - t0) * (c[0] - a[0]) + t0 * (b[0] - c[0]), (1 - t0) * (c[1] - a[1]) + t0 * (b[1] - c[1])];
      const q: P = [curve[i][0] + (t1 - t0) * d0[0], curve[i][1] + (t1 - t0) * d0[1]];
      const [p0, p1] = [curve[i], curve[j]];
      const clen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const cn: P = [-(p1[1] - p0[1]) / clen, (p1[0] - p0[0]) / clen];
      const sag = ((q[0] - (p0[0] + p1[0]) / 2) * cn[0] + (q[1] - (p0[1] + p1[1]) / 2) * cn[1]) / 2;
      pieces.push({ ...v, x1: round(p0[0]), z1: round(p0[1]), x2: round(p1[0]), z2: round(p1[1]), bend: round(sag) });
      kept += run;
    }
    i = j + 1;
  }
  // Blocked from end to end, or a sliver of what was asked for: not worth keeping.
  return kept >= polylineLength(curve) * 0.4 ? pieces : [];
}

function moveOp(op: PatchOp, item: Item, dx: number, dz: number, slideBy: number): PatchOp {
  const v = { ...(op.value ?? {}) } as Rec;
  if (slideBy !== 0) {
    v.offset = round(num(v.offset) + slideBy);
    return { ...op, value: v };
  }
  switch (item.opName) {
    case "addBuilding": case "addDeck": case "addParking": v.x = round(num(v.x) + dx); v.z = round(num(v.z) + dz); break;
    case "addPool": {
      // A pool set against the house is re-anchored to a site position; siteX/siteZ take priority over its wall.
      const [cx, cz] = item.centre ?? centreOf(item.shape);
      v.siteX = round(cx + dx);
      v.siteZ = round(cz + dz);
      break;
    }
    case "addWaterway": case "addRetainingWall":
      v.x1 = round(num(v.x1) + dx); v.z1 = round(num(v.z1) + dz); v.x2 = round(num(v.x2) + dx); v.z2 = round(num(v.z2) + dz);
      break;
  }
  return { ...op, value: v };
}

/** Turns a lone (already moved) garage's doors toward the nearest drive. */
function faceDrive(op: PatchOp, drives: readonly Item[]): PatchOp {
  const v = op.value ?? {};
  const [cx, cz] = [num(v.x), num(v.z)];
  let best: P | undefined;
  let bestD = Infinity;
  for (const d of drives) for (const [p, q] of segments(d.shape)) {
    const mid: P = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const dist = Math.hypot(mid[0] - cx, mid[1] - cz);
    if (dist < bestD) { bestD = dist; best = mid; }
  }
  if (!best) return op;
  const fx = best[0] - cx;
  const fz = best[1] - cz;
  const face: P = Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz) || 1];
  return { ...op, value: { ...v, rotation: Math.round((Math.atan2(face[0], face[1]) * 180) / Math.PI) } };
}

const explain = (item: Item, other: Item, gap: number, need: number) =>
  gap < 0 ? `${item.label} overlaps ${other.label}` : `${item.label} is only ${round(gap)} m from ${other.label} (needs ${need} m)`;

/** The house's footprint: given, or read from the project with the batch's own `setHouse` applied. */
function shellOf(input: SiteCollisionInput): Shell {
  if (input.house) return input.house;
  const base = isRecord(input.existing?.house) ? input.existing.house : {};
  const fields = input.ops.filter((op) => op.op === "setHouse").reduce<Rec>((all, op) => ({ ...all, ...(op.fields ?? {}) }), {});
  const merged = { ...base, ...fields };
  return { width: num(merged.width), depth: num(merged.depth) };
}

/** The project's features of one kind as they will stand once the batch's own `update…` and `remove…` ops are applied. */
function existingRecords(input: SiteCollisionInput, opName: string, key: string): Rec[] {
  const list = isRecord(input.existing) && Array.isArray(input.existing[key]) ? (input.existing[key] as unknown[]) : [];
  const type = opName.slice(3);
  const targeted = (op: PatchOp, raw: unknown, index: number) => (typeof op.id === "string" ? isRecord(raw) && raw.id === op.id : op.index === index);
  const out: Rec[] = [];
  list.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    if (input.ops.some((op) => op.op === `remove${type}` && targeted(op, raw, index))) return;
    const fields = input.ops.filter((op) => op.op === `update${type}` && targeted(op, raw, index)).reduce<Rec>((all, op) => ({ ...all, ...(op.fields ?? {}) }), {});
    delete fields.id; // an edit never changes a stable id
    out.push({ ...raw, ...fields });
  });
  return out;
}

/** Collects every feature of the design (and, for an edit, of the project) as items. `asNew` treats the project's own as new. */
function collect(input: SiteCollisionInput, asNew = false): Item[] {
  const house = shellOf(input);
  const items: Item[] = [{ id: "house", label: "house", role: "main", shape: rectShape(0, 0, house.width, house.depth), fixed: true, existing: true, priority: PRIORITY.main }];
  const counts: Record<string, number> = {};
  for (const [opName, key] of Object.entries(KEYS)) {
    counts[key] = 0;
    for (const raw of existingRecords(input, opName, key)) {
      const n = ++counts[key];
      const item = toItem(opName, raw, house, { id: `${key}:${n}`, n, existing: !asNew });
      if (item) items.push(asNew ? item : { ...item, existing: true, fixed: true });
    }
  }
  input.ops.forEach((op, i) => {
    const key = KEYS[op.op];
    if (!key || !isRecord(op.value)) return;
    const n = ++counts[key];
    const item = toItem(op.op, op.value, house, { id: `${key}:${n}`, n, existing: false, op: i });
    if (item) items.push(item);
  });
  return items;
}

/**
 * Settles every new feature: clear as put, or moved to the nearest clear position within its tether, or reported.
 * See the file header for the rules. Features the pass does not know (paths, roads, landscaping…) are left alone.
 */
export function resolveSiteCollisions(input: SiteCollisionInput): SiteCollisionResult {
  // Most edits add nothing that stands on the ground: leave them exactly as they are.
  if (!input.ops.some((op) => op.op in KEYS && isRecord(op.value))) return { ops: [...input.ops], errors: [], unplaced: [], relocated: [] };
  const items = collect(input);
  const house = shellOf(input);
  const ops = [...input.ops];
  /** Sections of a trimmed wall beyond the first: new features, appended after the design's own ops. */
  const added: PatchOp[] = [];
  const errors: string[] = [];
  const unplaced: number[][] = [];
  const relocated: string[] = [];
  const settled: Item[] = items.filter((i) => i.fixed || i.existing);
  const pending = groupItems(items).sort((a, b) => Math.max(...b.map((i) => i.priority)) - Math.max(...a.map((i) => i.priority)));

  for (const group of pending) {
    const first = conflictAt(group, 0, 0, settled);
    if (!first) { settled.push(...group); continue; }

    const within = tetherCheck(group, settled);
    const slider = group.find((g) => g.slide)?.slide;
    const inBounds = (dx: number, dz: number) => group.every((m) => boxOf(shapeAt(m, dx, dz)).every((v) => Math.abs(v) <= SITE_POSITION_LIMIT.max));

    let found: { dx: number; dz: number; slideBy: number; value?: Rec; extra?: Rec[] } | undefined;
    const slideSearch = (g: readonly Item[]) => {
      const axis = AXIS[g.find((m) => m.slide)!.slide!.wall];
      // Every member has to stay on its wall.
      const from = Math.max(...g.map((m) => m.slide!.from));
      const to = Math.min(...g.map((m) => m.slide!.to));
      for (let t = 0.5; t <= Math.max(-from, to); t += 0.5) {
        for (const s of [t, -t]) if (s >= from && s <= to && !conflictAt(g, axis[0] * s, axis[1] * s, settled)) return s;
      }
      return undefined;
    };
    if (slider && group.every((g) => g.slide)) {
      const t = slideSearch(group);
      if (t !== undefined) found = { dx: AXIS[slider.wall][0] * t, dz: AXIS[slider.wall][1] * t, slideBy: t };
    }
    // A retaining wall stops short of what is in its way before it is ever moved.
    const one = group.length === 1 ? group[0] : undefined;
    if (!found && one?.role === "wall" && one.op !== undefined) {
      const pieces = trimWall(ops[one.op].value ?? {}, one, settled);
      const clear = pieces.every((piece) => {
        const probe = toItem("addRetainingWall", piece, house, { id: one.id, n: 0, existing: false });
        return probe !== null && !conflictAt([probe], 0, 0, settled);
      });
      if (pieces.length > 0 && clear) found = { dx: 0, dz: 0, slideBy: 0, value: pieces[0], extra: pieces.slice(1) };
    }
    if (!found && group.every((g) => !g.slide || g.freeFallback)) {
      for (const [dx, dz] of OFFSETS) {
        if (!inBounds(dx, dz) || conflictAt(group, dx, dz, settled) || !within(dx, dz)) continue;
        found = { dx, dz, slideBy: 0 };
        break;
      }
    }
    // A patio is decoration: with no room for its full width anywhere on its wall it narrows to the widest stretch that is free.
    const lone = group.length === 1 ? group[0] : undefined;
    if (!found && lone?.role === "patio" && lone.op !== undefined && lone.slide) {
      const v = ops[lone.op].value ?? {};
      const len = wallLength(house, lone.slide.wall);
      const [width, offset] = [num(v.width), num(v.offset)];
      for (const f of [0.85, 0.7, 0.55, 0.4]) {
        const w = round(width * f);
        const value = { ...v, width: w, offset: round(Math.min(Math.max(0, offset + (width - w) / 2), len - w)) };
        const probe = toItem("addPatio", value, house, { id: lone.id, n: 0, existing: false });
        if (!probe) continue;
        if (!conflictAt([probe], 0, 0, settled)) { found = { dx: 0, dz: 0, slideBy: 0, value }; break; }
        const t = slideSearch([probe]);
        if (t !== undefined) { found = { dx: AXIS[lone.slide.wall][0] * t, dz: AXIS[lone.slide.wall][1] * t, slideBy: t, value }; break; }
      }
    }

    if (!found) {
      const why = first ? explain(group[0], first.with, first.gap, first.need) : `${group[0].label} collides`;
      errors.push(`${why}, and there is no clear position for it${group.some((g) => g.slide && !g.freeFallback) ? " along its wall" : ` within ${SEARCH_RADIUS} m`}. Move it, shrink it or remove it.`);
      unplaced.push(group.every((m) => m.op !== undefined) ? group.map((m) => m.op as number) : []);
      settled.push(...group);
      continue;
    }

    const drives = settled.filter((s) => s.role === "drive");
    for (const m of group) {
      if (m.op === undefined) continue;
      let moved = moveOp(found.value ? { ...ops[m.op], value: found.value } : ops[m.op], m, found.dx, found.dz, found.slideBy);
      // A lone garage turns its doors to the drive again from its new place — if that turn still clears everything.
      if (m.role === "dg" && group.length === 1 && found.slideBy === 0) {
        const turned = faceDrive(moved, drives);
        const probe = toItem("addBuilding", turned.value ?? {}, house, { id: m.id, n: 0, existing: false });
        if (probe && !conflictAt([probe], 0, 0, settled)) moved = turned;
      }
      ops[m.op] = moved;
      for (const piece of found.extra ?? []) {
        const fresh = { ...piece };
        delete fresh.id; // a new section is a new feature: applyPatch gives it its own id
        added.push({ op: "addRetainingWall", value: fresh });
        const extra = toItem("addRetainingWall", fresh, house, { id: `${m.id}+`, n: 0, existing: false });
        if (extra) settled.push({ ...extra, label: m.label });
      }
      const after = toItem(m.opName!, moved.value ?? {}, house, { id: m.id, n: Number(m.label.split(" ").pop()), existing: false, op: m.op });
      relocated.push(m.role === "wall" && found.value ? `${m.label} trimmed around ${first.with.label}` : found.value ? `${m.label} narrowed to ${num(found.value.width)} m to clear ${first.with.label}` : `${m.label} moved ${round(Math.hypot(found.dx, found.dz))} m to clear ${first.with.label}`);
      settled.push(after ? { ...m, shape: after.shape } : m);
    }
  }
  return { ops: [...ops, ...added], errors, unplaced, relocated };
}

/**
 * Checks a finished design for collisions without moving anything: every pair of ground features that must not
 * overlap, except pairs of existing features. Used as the last gate, after the ops have been applied.
 */
export function findSiteCollisions(root: Rec): string[] {
  const items = collect({ ops: [], existing: root }, true);
  const runs = groupItems(items);
  const sameRun = (a: Item, b: Item) => runs.some((g) => g.includes(a) && g.includes(b));
  const errors: string[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const need = clearance(items[i], items[j]);
      if (need === null) continue;
      const gap = gapBetween(items[i].shape, items[j].shape, need + 1);
      if (gap < need - TOLERANCE && !sameRun(items[i], items[j])) errors.push(explain(items[i], items[j], gap, need));
    }
  }
  return errors;
}
