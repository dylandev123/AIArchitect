import type { SiteSettings, WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { DOOR_LIMITS, DRIVEWAY_LIMITS, GARAGE_LIMITS, POOL_LIMITS, WALL_THICKNESS } from "../constants";
import { briefChance, floorRangeFor, pickInRange, SCALE_PROFILES, scaleRank } from "../scale";
import { SIDE_VECTORS } from "./profiles";
import { wallPoint } from "./siteRules";

/**
 * Project-scale rules for a freshly generated design.
 *
 * The model is told the size envelope of the chosen scale, but a "mansion" must not depend on it remembering to be
 * big, so these rules make it so — without ever just multiplying dimensions. A larger scale changes the *composition*:
 * more floors, connected wings that step down from the main block, a garage row, a pool and deck sized to the house,
 * a longer drive, more garden zones and detached buildings spread over the site.
 *
 * They run in three passes around the style and tier rules (see assembleGeneratedProject):
 *   1. fitShellToScale     — bring the model's shell into the scale's envelope and carry its ops with it;
 *   2. applyScaleRules     — resize what is there and add what the scale calls for, as ordinary `add*` ops;
 *   3. finalizeScale       — once every other rule has run, clear the walls the wings now cover and give the bigger
 *                            facades a window rhythm.
 * A wing is an ordinary "wing" building with its own id, so it can be moved, resized or removed like any other.
 */

type Shell = { width: number; depth: number; floors: number; roof: string };
type Rec = Record<string, unknown>;
type Vec = [number, number];
interface Rect { x: number; z: number; w: number; d: number }

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const valueOf = (op: PatchOp): Rec => (isRecord(op.value) ? op.value : {});
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const round = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const wallLen = (h: Shell, wall: WallSide) => (wall === "north" || wall === "south" ? h.width : h.depth);
const isHorizontal = (wall: WallSide) => wall === "north" || wall === "south";
const OPPOSITE: Record<WallSide, WallSide> = { north: "south", south: "north", east: "west", west: "east" };

function sideOf(v: Vec): WallSide {
  if (Math.abs(v[0]) > Math.abs(v[1])) return v[0] > 0 ? "east" : "west";
  return v[1] > 0 ? "south" : "north";
}

/** Half the house's extent along a direction (a compass vector or its perpendicular). */
const halfAlong = (h: Shell, v: Vec) => (Math.abs(v[0]) > 0.5 ? h.width : h.depth) / 2;

/** The roof a wing or outbuilding carries: matched to the main house, and never one that needs a specific slope. */
function wingRoof(roof: string): string {
  if (roof === "hip" || roof === "mansard") return "hip";
  if (roof === "gable") return "gable";
  return "flat";
}

export interface ScaleInput {
  brief: string;
  house: Shell;
  site: SiteSettings;
  ops: readonly PatchOp[];
}

// ── 1. Shell ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ops that hang on a wall at an `offset` along it and so must follow it when the wall changes length. */
const WALL_MOUNTED = new Set(["Window", "Door", "Garage", "Balcony", "Patio", "Pool", "Driveway", "Porch", "Chimney", "Bay", "Arch", "Stairs"].map((n) => `add${n}`));
/** Roof parts sit on slopes the resized roof no longer has; the tier rules add them back where the roof supports them. */
const ROOF_PARTS = new Set(["addDormer", "addCrossGable"]);
const LEVELLED = new Set(["addWindow", "addDoor", "addBalcony", "addBay", "addArch", "addRoom"]);

/** Moves a site coordinate outward by however much the house grew on that side, so clearances survive a resize. */
function pushOut(v: unknown, oldHalf: number, newHalf: number): unknown {
  if (typeof v !== "number" || Math.abs(v) < oldHalf) return v;
  return round(v + Math.sign(v) * (newHalf - oldHalf));
}

function remapOp(op: PatchOp, from: Shell, to: Shell): PatchOp | null {
  const v = valueOf(op);
  if (ROOF_PARTS.has(op.op)) return null;
  if (LEVELLED.has(op.op) && typeof v.level === "number" && v.level >= to.floors) return null;

  if (WALL_MOUNTED.has(op.op) && typeof v.wall === "string" && typeof v.offset === "number" && !(op.op === "addPool" && typeof v.siteX === "number")) {
    const wall = v.wall as WallSide;
    const oldLen = wallLen(from, wall);
    const newLen = wallLen(to, wall);
    if (oldLen === newLen) return op;
    const width = Math.min(num(v.width), newLen);
    const centre = (v.offset + num(v.width) / 2) / oldLen;
    return { ...op, value: { ...v, ...(width > 0 ? { width: round(width) } : {}), offset: round(clamp(centre * newLen - width / 2, 0, Math.max(0, newLen - width))) } };
  }

  if (op.op === "addRoom") {
    const sx = Math.max(0.1, to.width - WALL_THICKNESS * 2) / Math.max(0.1, from.width - WALL_THICKNESS * 2);
    const sz = Math.max(0.1, to.depth - WALL_THICKNESS * 2) / Math.max(0.1, from.depth - WALL_THICKNESS * 2);
    return { ...op, value: { ...v, x: round(num(v.x) * sx), z: round(num(v.z) * sz), width: round(num(v.width) * sx), depth: round(num(v.depth) * sz) } };
  }

  const shift = (a: unknown, b: unknown): { x: unknown; z: unknown } => ({ x: pushOut(a, from.width / 2, to.width / 2), z: pushOut(b, from.depth / 2, to.depth / 2) });
  if (op.op === "addBuilding" || op.op === "addDeck" || op.op === "addParking" || op.op === "addLandscape") return { ...op, value: { ...v, ...shift(v.x, v.z) } };
  if (op.op === "addPool" && typeof v.siteX === "number") {
    const s = shift(v.siteX, v.siteZ);
    return { ...op, value: { ...v, siteX: s.x, siteZ: s.z } };
  }
  if (op.op === "addRoad") {
    const a = shift(v.x1, v.z1);
    const b = shift(v.x2, v.z2);
    return { ...op, value: { ...v, x1: a.x, z1: a.z, x2: b.x, z2: b.z } };
  }
  return op;
}

/**
 * Brings the model's shell inside the scale's envelope. A shell already inside is left exactly as it is; one outside
 * is set to a brief-dependent point *within* the range (not to a multiple of what the model gave), and the ops that
 * hang on it are carried along: wall features keep their proportional place, rooms stretch to the new interior,
 * and site-absolute parts move out by the growth so clearances hold.
 */
export function fitShellToScale(input: ScaleInput): { house: Shell; ops: PatchOp[] } {
  const scale = input.site.projectScale;
  if (!scale) return { house: input.house, ops: [...input.ops] };
  const profile = SCALE_PROFILES[scale];
  const { width: wr, depth: dr } = profile.footprint;
  const [fmin, fmax] = floorRangeFor(profile, input.brief);
  const inside = (v: number, r: readonly [number, number]) => v >= r[0] && v <= r[1];

  const house: Shell = {
    ...input.house,
    width: inside(input.house.width, wr) ? input.house.width : pickInRange(wr, input.brief, "width"),
    depth: inside(input.house.depth, dr) ? input.house.depth : pickInRange(dr, input.brief, "depth"),
    floors: clamp(Math.round(input.house.floors), fmin, fmax),
  };

  let ops = input.ops.map((op) => remapOp(op, input.house, house)).filter((op): op is PatchOp => op !== null);
  // Interiors stay basic: only a handful of rooms per floor, whatever the scale.
  const perLevel = new Map<number, number>();
  ops = ops.filter((op) => {
    if (op.op !== "addRoom") return true;
    const level = num(valueOf(op).level);
    const n = (perLevel.get(level) ?? 0) + 1;
    perLevel.set(level, n);
    return n <= profile.roomsPerFloor;
  });
  return { house, ops };
}

// ── Layout helpers ──────────────────────────────────────────────────────────────────────────────────────────────

const overlap = (a: Rect, b: Rect, margin = 0) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin;

/** Ground rectangle of a wall-mounted item, `out0`…`out1` metres out from the wall. */
function wallRect(h: Shell, wall: WallSide, offset: number, width: number, out0: number, out1: number): Rect {
  const [x1, z1] = wallPoint(h, wall, offset, out0);
  const [x2, z2] = wallPoint(h, wall, offset + width, out1);
  return { x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: Math.abs(x2 - x1), d: Math.abs(z2 - z1) };
}

/** Everything already occupying the ground, as rectangles. */
function groundRects(house: Shell, ops: readonly PatchOp[]): Rect[] {
  const rects: Rect[] = [{ x: 0, z: 0, w: house.width, d: house.depth }];
  for (const op of ops) {
    const v = valueOf(op);
    const wall = v.wall as WallSide;
    switch (op.op) {
      case "addBuilding": case "addDeck": case "addParking": case "addLandscape":
        rects.push({ x: num(v.x), z: num(v.z), w: num(v.width), d: num(v.depth) });
        break;
      case "addPatio": case "addGarage": case "addPorch":
        rects.push(wallRect(house, wall, num(v.offset), num(v.width), 0, num(v.depth)));
        break;
      case "addPool":
        if (typeof v.siteX === "number") rects.push({ x: v.siteX, z: num(v.siteZ), w: num(v.width), d: num(v.depth) });
        else rects.push(wallRect(house, wall, num(v.offset), num(v.width), num(v.distance), num(v.distance) + num(v.depth)));
        break;
      case "addDriveway":
        rects.push(wallRect(house, wall, num(v.offset), num(v.width), 0, num(v.length)));
        break;
    }
  }
  return rects;
}

/** Sets a wall-mounted or ground rectangle down where nothing else is, searching outward along the given directions. */
function makePlacer(house: Shell, rects: Rect[]) {
  return (w: number, d: number, dirs: readonly Vec[], margin = 2): Rect => {
    let last: Rect = { x: 0, z: 0, w, d };
    for (const [rx, rz] of dirs) {
      const len = Math.hypot(rx, rz) || 1;
      const dx = rx / len;
      const dz = rz / len;
      const base = Math.abs(dx) * (house.width / 2 + w / 2) + Math.abs(dz) * (house.depth / 2 + d / 2) + 3;
      for (let k = 0; k < 40; k++) {
        const t = base + k * 3;
        last = { x: round(dx * t), z: round(dz * t), w, d };
        if (!rects.some((r) => overlap(last, r, margin))) {
          rects.push(last);
          return last;
        }
      }
    }
    rects.push(last);
    return last;
  };
}

/** The widest free stretch between `from` and `to`, given the [from, to] intervals already `taken`. */
function freeSpanIn(taken: readonly [number, number][], from: number, to: number): [number, number] | undefined {
  const sorted = [...taken].filter(([a, b]) => b > from && a < to).sort((a, b) => a[0] - b[0]);
  let best: [number, number] | undefined;
  let cursor = from;
  for (const [a, b] of sorted) {
    if (a - cursor > (best ? best[1] - best[0] : 0)) best = [cursor, a];
    cursor = Math.max(cursor, b);
  }
  if (to - cursor > (best ? best[1] - best[0] : 0)) best = [cursor, to];
  return best;
}

// ── 2. Composition ──────────────────────────────────────────────────────────────────────────────────────────────

const CAR = 3.1;
const carsIn = (width: number) => Math.max(1, Math.round(width / CAR));

/** The interval a wing covers on a house wall, in metres along that wall. */
interface WingContact { wall: WallSide; from: number; to: number; floors: number }

/** Every wing (and other building) that touches a wall of the house, read from the buildings themselves. */
function wingContacts(house: Shell, ops: readonly PatchOp[]): WingContact[] {
  const out: WingContact[] = [];
  const hw = house.width / 2;
  const hd = house.depth / 2;
  for (const op of ops) {
    if (op.op !== "addBuilding" || valueOf(op).kind !== "wing") continue;
    const v = valueOf(op);
    const x = num(v.x);
    const z = num(v.z);
    const w = num(v.width);
    const d = num(v.depth);
    const floors = num(v.floors, 1);
    const spanX: [number, number] = [x - w / 2, x + w / 2];
    const spanZ: [number, number] = [z - d / 2, z + d / 2];
    const touchesZ = spanZ[1] > -hd && spanZ[0] < hd;
    const touchesX = spanX[1] > -hw && spanX[0] < hw;
    // Flush against (or overlapping into) a wall, and not spanning across the house.
    if (touchesZ && spanX[0] < hw && spanX[1] > hw + 0.5 && spanX[0] > hw - 1) out.push({ wall: "east", from: Math.max(0, spanZ[0] + hd), to: Math.min(house.depth, spanZ[1] + hd), floors });
    if (touchesZ && spanX[1] > -hw && spanX[0] < -hw - 0.5 && spanX[1] < -hw + 1) out.push({ wall: "west", from: Math.max(0, spanZ[0] + hd), to: Math.min(house.depth, spanZ[1] + hd), floors });
    if (touchesX && spanZ[0] < hd && spanZ[1] > hd + 0.5 && spanZ[0] > hd - 1) out.push({ wall: "south", from: Math.max(0, spanX[0] + hw), to: Math.min(house.width, spanX[1] + hw), floors });
    if (touchesX && spanZ[1] > -hd && spanZ[0] < -hd - 0.5 && spanZ[1] < -hd + 1) out.push({ wall: "north", from: Math.max(0, spanX[0] + hw), to: Math.min(house.width, spanX[1] + hw), floors });
  }
  return out;
}

export function applyScaleRules(input: ScaleInput): PatchOp[] {
  const scale = input.site.projectScale;
  if (!scale) return [...input.ops];
  const { brief, house, site } = input;
  const profile = SCALE_PROFILES[scale];
  const rank = scaleRank(scale);
  const ops: PatchOp[] = [...input.ops];
  const has = (name: string, kind?: string) => ops.some((op) => op.op === name && (kind === undefined || valueOf(op).kind === kind));
  const count = (name: string, kind?: string) => ops.filter((op) => op.op === name && (kind === undefined || valueOf(op).kind === kind)).length;
  const chance = (salt: string) => briefChance(brief, salt);

  const view = SIDE_VECTORS[site.viewDirection];
  const approach = SIDE_VECTORS[site.approachSide];
  const lat: Vec = [-view[1], view[0]];
  const viewWall = site.viewDirection as WallSide;
  const approachWall = site.approachSide as WallSide;
  const hl = halfAlong(house, lat);
  const hv = halfAlong(house, view);
  const urban = site.environment === "urban";

  // ── Front door: as grand as the house ──
  for (let i = 0; i < ops.length; i++) {
    const v = valueOf(ops[i]);
    if (ops[i].op !== "addDoor" || v.wall !== approachWall || num(v.level) !== 0 || num(v.width) >= profile.door) continue;
    const len = wallLen(house, approachWall);
    const width = Math.min(profile.door, DOOR_LIMITS.width.max, len - 1);
    const centre = num(v.offset) + num(v.width) / 2;
    ops[i] = { ...ops[i], value: { ...v, width: round(width), height: round(Math.min(DOOR_LIMITS.height.max, Math.max(num(v.height, 2.1), profile.door >= 1.7 ? 2.6 : 2.1))), offset: round(clamp(centre - width / 2, 0, len - width)) } };
  }

  // ── Wings: connected blocks stepping down from the main mass ──
  const placedWings: { sign: 1 | -1; outer: number; run: number }[] = [];
  if (profile.wings > count("addBuilding", "wing")) {
    const wingFloors = Math.max(1, house.floors - 1);
    const roof = wingRoof(house.roof);
    const run = clamp(pickInRange(profile.wing.run, brief, "wing-run"), 4, hv * 2 * 0.72);
    const projection = pickInRange(profile.wing.projection, brief, "wing-projection");
    const order: (1 | -1)[] = chance("wing-side") < 0.5 ? [1, -1] : [-1, 1];
    const wantDirect = Math.min(2, profile.wings, order.length);

    const addWing = (sign: 1 | -1, from: number, to: number, runLen: number, floors: number) => {
      const c: Vec = [lat[0] * sign * ((from + to) / 2) + view[0] * (hv - runLen / 2), lat[1] * sign * ((from + to) / 2) + view[1] * (hv - runLen / 2)];
      const across = to - from;
      const alongX = Math.abs(lat[0]) > 0.5;
      ops.push({ op: "addBuilding", value: { kind: "wing", x: round(c[0]), z: round(c[1]), width: round(alongX ? across : runLen), depth: round(alongX ? runLen : across), floors, roof } });
    };
    const contactBlocked = (sign: 1 | -1) => {
      const wall = sideOf([lat[0] * sign, lat[1] * sign]);
      // The entrance wall stays open whatever is on it yet: the drive and the door come to it later.
      if (wall === approachWall) return true;
      const centreAlong = (wall === "east" || wall === "west" ? view[1] : view[0]) * (hv - run / 2);
      const half = (wall === "east" || wall === "west" ? house.depth : house.width) / 2;
      const from = half + centreAlong - run / 2 - 0.5;
      const to = half + centreAlong + run / 2 + 0.5;
      return ops.some((op) => {
        if (!["addDoor", "addGarage", "addDriveway", "addPorch", "addPatio", "addStairs", "addPool"].includes(op.op)) return false;
        const v = valueOf(op);
        if (v.wall !== wall || (op.op === "addPool" && typeof v.siteX === "number")) return false;
        if (op.op === "addDoor" && num(v.level) > 0) return false;
        return num(v.offset) < to && num(v.offset) + num(v.width) > from;
      });
    };

    for (const sign of order) {
      if (placedWings.length >= wantDirect || contactBlocked(sign)) continue;
      addWing(sign, hl - WALL_THICKNESS, hl + projection, run, wingFloors);
      placedWings.push({ sign, outer: hl + projection, run });
    }
    // Any wings still owed step out from the last one, smaller and lower, so the count and the spread hold.
    let chain = placedWings[placedWings.length - 1];
    let chained = 0;
    while (chain && placedWings.length + chained < profile.wings && chained < 2) {
      const w = round(projection * 0.8);
      const r = round(chain.run * 0.75);
      addWing(chain.sign, chain.outer - WALL_THICKNESS, chain.outer + w, r, 1);
      chain = { sign: chain.sign, outer: chain.outer + w, run: r };
      chained++;
    }
  }

  // ── Caps: a cottage never gets a resort pool ──
  for (let i = 0; i < ops.length; i++) {
    const v = valueOf(ops[i]);
    if (ops[i].op === "addPool" && typeof v.siteX !== "number") {
      const width = Math.min(num(v.width), profile.cap.pool.width);
      const depth = Math.min(num(v.depth), profile.cap.pool.depth);
      ops[i] = { ...ops[i], value: { ...v, width: round(width), depth: round(depth), offset: round(Math.max(0, num(v.offset) + (num(v.width) - width) / 2)) } };
    } else if (ops[i].op === "addDeck") {
      ops[i] = { ...ops[i], value: { ...v, width: round(Math.min(num(v.width), profile.cap.deck.width)), depth: round(Math.min(num(v.depth), profile.cap.deck.depth)) } };
    } else if (ops[i].op === "addGarage") {
      const width = Math.min(num(v.width), profile.cap.garageCars * CAR);
      ops[i] = { ...ops[i], value: { ...v, width: round(Math.max(GARAGE_LIMITS.width.min, width)), offset: round(Math.max(0, num(v.offset) + (num(v.width) - width) / 2)) } };
    } else if (ops[i].op === "addDriveway") {
      ops[i] = { ...ops[i], value: { ...v, length: round(Math.min(num(v.length), profile.cap.driveway)) } };
    }
  }

  // Everything below places things on the ground, around what is already there.
  const rects = groundRects(house, ops);
  const place = makePlacer(house, rects);
  const unit = (a: Vec, b: Vec, wa = 1, wb = 1): Vec => [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb];
  const neg = (v: Vec): Vec => [-v[0], -v[1]];
  // Keep the door's line and the drive's clear, so gardens and buildings never sit on the way in.
  rects.push({ ...wallRect(house, approachWall, wallLen(house, approachWall) / 2 - 3, 6, 0, 24) });

  // ── Driveway: as long as the scale's site is wide ──
  const [dmin, dmax] = profile.driveway.length;
  const driveLen = round(pickInRange(profile.driveway.length, brief, "drive"));
  if (has("addDriveway")) {
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].op !== "addDriveway") continue;
      const v = valueOf(ops[i]);
      const length = rank >= 2 ? clamp(num(v.length), dmin, dmax) : Math.min(num(v.length), dmax);
      const wall = v.wall as WallSide;
      const len = wallLen(house, wall);
      const width = num(v.width);
      // A drive that misses the garage on its own wall is brought onto it, so it always reaches the doors.
      const garage = ops.find((op) => op.op === "addGarage" && valueOf(op).wall === wall);
      const g = garage ? valueOf(garage) : undefined;
      const misses = g !== undefined && (num(v.offset) + width <= num(g.offset) || num(v.offset) >= num(g.offset) + num(g.width));
      const offset = g && misses ? clamp(num(g.offset) + num(g.width) / 2 - width / 2, 0, Math.max(0, len - width)) : num(v.offset);
      ops[i] = { ...ops[i], value: { ...v, offset: round(offset), length: round(clamp(length, DRIVEWAY_LIMITS.length.min, DRIVEWAY_LIMITS.length.max)) } };
    }
  } else if (rank >= 2) {
    const len = wallLen(house, approachWall);
    const width = profile.driveway.width;
    const garage = ops.find((op) => op.op === "addGarage" && valueOf(op).wall === approachWall);
    const door = ops.find((op) => op.op === "addDoor" && valueOf(op).wall === approachWall && num(valueOf(op).level) === 0);
    // From the attached garage if there is one; otherwise off to one side of the door.
    const doorCentre = door ? num(valueOf(door).offset) + num(valueOf(door).width) / 2 : len / 2;
    const centre = garage
      ? num(valueOf(garage).offset) + num(valueOf(garage).width) / 2
      : clamp(doorCentre + (chance("drive-side") < 0.5 ? -1 : 1) * len * 0.3, width / 2 + 1, len - width / 2 - 1);
    ops.push({ op: "addDriveway", value: { wall: approachWall, offset: round(clamp(centre - width / 2, 0, Math.max(0, len - width))), width, length: driveLen } });
  }

  // ── The drive's frame: where it starts on its wall, which way it runs and which way is across it ──
  const APRON = 4.6;
  const driveAt = ops.findIndex((op) => op.op === "addDriveway" && valueOf(op).wall === approachWall);
  const frame = driveAt >= 0 ? (() => {
    const v = valueOf(ops[driveAt]);
    const wall = v.wall as WallSide;
    const dir = SIDE_VECTORS[wall];
    const across: Vec = [-dir[1], dir[0]];
    const width = num(v.width);
    return { dir, across, width, start: wallPoint(house, wall, num(v.offset) + width / 2, 0) };
  })() : undefined;
  const runsX = frame ? Math.abs(frame.dir[0]) > 0.5 : false;
  /**
   * Reaches at least `length` metres out, never past the longest drive there can be. A drive that serves garages stays
   * straight (the tier rules would otherwise bow it), so the aprons meet its edge exactly.
   */
  const driveTo = (length: number) => {
    const v = valueOf(ops[driveAt]);
    const need = round(Math.min(DRIVEWAY_LIMITS.length.max, length));
    ops[driveAt] = { ...ops[driveAt], value: { ...v, bend: 0, ...(num(v.length) < need ? { length: need } : {}) } };
  };
  const yawOf = (face: Vec) => Math.round((Math.atan2(face[0], face[1]) * 180) / Math.PI);

  // ── Outbuildings the model or the style already placed: the house's language, and garages that face the drive ──
  for (let i = 0; i < ops.length; i++) {
    const v = valueOf(ops[i]);
    if (ops[i].op !== "addBuilding" || v.matchHouse !== undefined || !["detached_garage", "shed", "villa"].includes(v.kind as string)) continue;
    const next: Rec = { ...v, matchHouse: true };
    if (v.kind === "detached_garage") {
      next.roof = wingRoof(house.roof);
      if (v.rotation === undefined) {
        const gx = num(v.x);
        const gz = num(v.z);
        const gw = num(v.width);
        const gd = num(v.depth);
        let face: Vec = approach;
        if (frame) {
          const rel: Vec = [gx - frame.start[0], gz - frame.start[1]];
          const lateral = rel[0] * frame.across[0] + rel[1] * frame.across[1];
          let along = rel[0] * frame.dir[0] + rel[1] * frame.dir[1];
          let side = Math.sign(lateral) || 1;
          if (Math.abs(lateral) > frame.width / 2 + 1) {
            // Beside the drive: doors turn across it, and an apron joins them to its edge.
            face = [-frame.across[0] * side, -frame.across[1] * side];
            let gap = Math.abs(lateral) - gd / 2 - frame.width / 2;
            // Too far from the drive to be part of it: draw the garage in to a normal apron's distance, if that spot is free.
            if (gap > 8 && along > 0) {
              const own = rects.findIndex((r) => r.x === gx && r.z === gz && r.w === gw && r.d === gd);
              search: for (const s2 of [side, -side]) {
                const reach = s2 * (frame.width / 2 + APRON + gd / 2);
                for (const slide of [0, 3, 6, 9, -3, 12]) {
                  const a = along + slide;
                  if (a < gw / 2 + 1) continue;
                  const moved: Rect = { x: round(frame.start[0] + frame.dir[0] * a + frame.across[0] * reach), z: round(frame.start[1] + frame.dir[1] * a + frame.across[1] * reach), w: runsX ? gw : gd, d: runsX ? gd : gw };
                  if (rects.some((r, k) => k !== own && overlap(moved, r, 1))) continue;
                  if (own >= 0) rects[own] = moved;
                  next.x = moved.x;
                  next.z = moved.z;
                  along = a;
                  gap = APRON;
                  side = s2;
                  face = [-frame.across[0] * side, -frame.across[1] * side];
                  break search;
                }
              }
            }
            if (gap > 0.5 && gap <= 24 && along > 0) {
              const mid = side * (frame.width / 2 + gap / 2);
              const c: Vec = [round(frame.start[0] + frame.dir[0] * along + frame.across[0] * mid), round(frame.start[1] + frame.dir[1] * along + frame.across[1] * mid)];
              const pad: Rect = { x: c[0], z: c[1], w: runsX ? gw : gap, d: runsX ? gap : gw };
              ops.push({ op: "addParking", value: { x: pad.x, z: pad.z, width: round(pad.w), depth: round(pad.d), stripes: false } });
              rects.push(pad);
            }
            if (along > 0) driveTo(along + gw / 2 + 1);
          } else if (along > 0) {
            // On the drive's line: doors turn back toward the house, and the drive ends at them.
            face = [-frame.dir[0], -frame.dir[1]];
            const reachTo = round(along - gd / 2);
            if (reachTo >= DRIVEWAY_LIMITS.length.min) ops[driveAt] = { ...ops[driveAt], value: { ...valueOf(ops[driveAt]), length: reachTo, bend: 0 } };
          }
        }
        const turn = yawOf(face);
        if (turn !== 0) next.rotation = turn;
      }
    }
    ops[i] = { ...ops[i], value: next };
  }

  // ── Garage capacity: attached garages count; the rest is a row of two-car garages beside the drive ──
  // Each garage turns its doors to face the drive, and a paved apron joins the doors to the drive's edge.
  if (profile.garageCars > 0 && rank >= 2) {
    const have =
      ops.filter((op) => op.op === "addGarage").reduce((n, op) => n + carsIn(num(valueOf(op).width)), 0) +
      ops.filter((op) => op.op === "addBuilding" && valueOf(op).kind === "detached_garage").reduce((n, op) => n + carsIn(num(valueOf(op).width)), 0);
    const short = profile.garageCars - have;
    if (short > 0 && frame) {
      const { dir, across, width: driveW, start } = frame;
      const bays = Math.ceil(short / 2);
      const bw = 6.8;
      const bd = 6.4;
      const rowLen = bays * bw;
      const reach = driveW / 2 + APRON + bd / 2;
      const at = (along: number, lateral: number): Vec => [round(start[0] + dir[0] * along + across[0] * lateral), round(start[1] + dir[1] * along + across[1] * lateral)];
      const rectAt = (along: number, side: 1 | -1): Rect => {
        const c = at(along, side * reach);
        return { x: c[0], z: c[1], w: runsX ? rowLen : bd, d: runsX ? bd : rowLen };
      };
      const apronAt = (along: number, side: 1 | -1): Rect => {
        const c = at(along, side * (driveW / 2 + APRON / 2));
        return { x: c[0], z: c[1], w: runsX ? rowLen : APRON, d: runsX ? APRON : rowLen };
      };
      const first: 1 | -1 = chance("garage-side") < 0.5 ? 1 : -1;
      let spot: { along: number; side: 1 | -1 } | undefined;
      const last = DRIVEWAY_LIMITS.length.max - rowLen / 2 - 1;
      for (let along = rowLen / 2 + 2; along <= last && !spot; along += 2) {
        for (const side of [first, -first as 1 | -1]) {
          if (![rectAt(along, side), apronAt(along, side)].some((r) => rects.some((o) => overlap(r, o, 1)))) { spot = { along, side }; break; }
        }
      }
      spot ??= { along: rowLen / 2 + 2, side: first };
      // Doors face across the drive, toward its centreline.
      const turn = yawOf([-across[0] * spot.side, -across[1] * spot.side]);
      const garageRoof = wingRoof(house.roof);
      for (let i = 0; i < bays; i++) {
        const c = at(spot.along - rowLen / 2 + bw / 2 + i * bw, spot.side * reach);
        ops.push({ op: "addBuilding", value: { kind: "detached_garage", x: c[0], z: c[1], width: bw, depth: bd, floors: 1, roof: garageRoof, matchHouse: true, ...(turn !== 0 ? { rotation: turn } : {}) } });
      }
      const pad = apronAt(spot.along, spot.side);
      ops.push({ op: "addParking", value: { x: pad.x, z: pad.z, width: round(pad.w), depth: round(pad.d), stripes: false } });
      rects.push(rectAt(spot.along, spot.side), pad);
      // The drive runs on past the last bay so the apron always meets it.
      driveTo(spot.along + rowLen / 2 + 1);
    }
  }

  // The drive is ground too: nothing else is set down on it.
  for (const op of ops) {
    const v = valueOf(op);
    if (op.op === "addDriveway") rects.push(wallRect(house, v.wall as WallSide, num(v.offset), num(v.width), 0, num(v.length)));
  }

  // ── Outdoor living: patio, pool and a sun deck sized to the house ──
  if (profile.patio) {
    const len = wallLen(house, viewWall);
    const pw = round(Math.min(profile.patio.width, len * 0.75));
    const pd = profile.patio.depth;
    const existingPatio = ops.findIndex((op) => op.op === "addPatio" && valueOf(op).wall === viewWall);
    if (existingPatio >= 0) {
      const v = valueOf(ops[existingPatio]);
      const width = Math.max(num(v.width), pw);
      const centre = num(v.offset) + num(v.width) / 2;
      ops[existingPatio] = { ...ops[existingPatio], value: { ...v, width: round(width), depth: round(Math.max(num(v.depth), pd)), offset: round(clamp(centre - width / 2, 0, Math.max(0, len - width))) } };
    } else {
      ops.push({ op: "addPatio", value: { wall: viewWall, offset: round((len - pw) / 2), width: pw, depth: pd } });
    }
    const patio = valueOf(ops.find((op) => op.op === "addPatio" && valueOf(op).wall === viewWall)!);

    let pool: Rec | undefined;
    if (profile.pool && !urban) {
      const [wr, dr] = [profile.pool.width, profile.pool.depth];
      const width = round(Math.min(pickInRange(wr, brief, "pool-w"), len - 2));
      const depth = round(pickInRange(dr, brief, "pool-d"));
      const at = ops.findIndex((op) => op.op === "addPool" && typeof valueOf(op).siteX !== "number");
      const distance = round(Math.min(POOL_LIMITS.distance.max, num(patio.depth) + 0.5));
      if (at >= 0) {
        const v = valueOf(ops[at]);
        const w = clamp(num(v.width), Math.min(wr[0], len - 2), Math.min(profile.cap.pool.width, len - 2));
        const dd = clamp(num(v.depth), dr[0], profile.cap.pool.depth);
        const centre = num(v.offset) + num(v.width) / 2;
        ops[at] = { ...ops[at], value: { ...v, width: round(w), depth: round(dd), distance: round(Math.max(num(v.distance), distance)), offset: round(clamp(centre - w / 2, 0, Math.max(0, len - w))) } };
        pool = valueOf(ops[at]);
      } else if (!has("addPool")) {
        pool = { wall: viewWall, offset: round((len - width) / 2), distance, width, depth, waterDepth: 1.5 };
        ops.push({ op: "addPool", value: pool });
      }
    }

    // A sun deck beyond the pool, or straight off the patio when there is none.
    if (profile.deck && !has("addDeck")) {
      const along = round(Math.min(profile.deck.width, len));
      const out = pool ? num(pool.distance) + num(pool.depth) + 0.6 : num(patio.depth) + 0.4;
      const centre = wallPoint(house, viewWall, len / 2, out + profile.deck.depth / 2);
      ops.push({ op: "addDeck", value: { x: round(centre[0]), z: round(centre[1]), level: 0, width: isHorizontal(viewWall) ? along : profile.deck.depth, depth: isHorizontal(viewWall) ? profile.deck.depth : along } });
    }
    rects.length = 0;
    rects.push(...groundRects(house, ops), wallRect(house, approachWall, wallLen(house, approachWall) / 2 - 3, 6, 0, 24));
  }

  // ── Gardens: zones set beyond the wings ──
  if (profile.gardens.count > 0) {
    const want = profile.gardens.count - ops.filter((op) => op.op === "addLandscape" && valueOf(op).kind === "garden").length;
    const dirs: Vec[][] = [
      [unit(approach, lat, 0.6, 1), unit(approach, neg(lat), 0.6, 1), unit(approach, lat, 1, 0.4), unit(approach, neg(lat), 1, 0.4)],
      [unit(view, lat, 0.6, 1), unit(view, neg(lat), 0.6, 1), unit(neg(approach), lat, 1, 0.5), unit(neg(approach), neg(lat), 1, 0.5)],
    ];
    for (let i = 0; i < want; i++) {
      const at = place(profile.gardens.width, profile.gardens.depth, dirs[i % 2].slice((i >> 1) % 2), 1);
      ops.push({ op: "addLandscape", value: { kind: "garden", x: at.x, z: at.z, width: profile.gardens.width, depth: profile.gardens.depth } });
    }
  }

  // ── Detached buildings: how many, and how likely, depends on the scale ──
  const ob = profile.outbuildings;
  const roof = wingRoof(house.roof);
  const guestSize = scale === "mansion" ? { width: 13, depth: 10, floors: 2 } : scale === "estate" ? { width: 9, depth: 8, floors: 1 } : { width: 8, depth: 7, floors: 1 };
  if (!urban) {
    if (!has("addBuilding", "villa") && !has("addBuilding", "restaurant") && chance("guest") < ob.guestHouse) {
      // Turned toward the house, so the footprint may swap its sides: give it a square of room.
      const room = Math.max(guestSize.width, guestSize.depth);
      const at = place(room, room, [unit(view, lat, 0.4, 1), unit(view, neg(lat), 0.4, 1), unit(neg(approach), lat, 1, 0.6), unit(neg(approach), neg(lat), 1, 0.6)], 3);
      // Built like the main house, with its door turned toward it.
      const toHouse: Vec = Math.abs(at.x) > Math.abs(at.z) ? [-Math.sign(at.x), 0] : [0, -Math.sign(at.z) || 1];
      const turn = Math.round((Math.atan2(toHouse[0], toHouse[1]) * 180) / Math.PI);
      ops.push({ op: "addBuilding", value: { kind: "villa", x: at.x, z: at.z, ...guestSize, roof, matchHouse: true, ...(turn !== 0 ? { rotation: turn } : {}) } });
    }
    if (!has("addBuilding", "gazebo") && chance("gazebo") < ob.gazebo) {
      const size = rank >= 3 ? 6 : 5;
      const at = place(size, size, [unit(view, lat, 1, 0.5), unit(view, neg(lat), 1, 0.5), view, unit(view, lat, 0.4, 1), unit(view, neg(lat), 0.4, 1)], 3);
      ops.push({ op: "addBuilding", value: { kind: "gazebo", x: at.x, z: at.z, width: size, depth: size, floors: 1, roof: "hip" } });
    }
    if (!has("addBuilding", "outdoor_bar") && has("addPool") && chance("poolhouse") < ob.poolHouse) {
      const at = place(7, 3.5, [unit(view, lat, 0.6, 1), unit(view, neg(lat), 0.6, 1), unit(view, lat, 1, 0.3), unit(view, neg(lat), 1, 0.3)], 3);
      ops.push({ op: "addBuilding", value: { kind: "outdoor_bar", x: at.x, z: at.z, width: 7, depth: 3.5, floors: 1, roof: "flat" } });
    }
    const rural = ["forest", "farm", "countryside", "hillside"].includes(site.environment);
    if (rank < 2 && !has("addBuilding", "shed") && (rural || rank === 1) && chance("shed") < ob.shed) {
      const at = place(4, 3.5, [unit(neg(approach), lat, 0.6, 1), unit(neg(approach), neg(lat), 0.6, 1), lat, neg(lat)], 3);
      ops.push({ op: "addBuilding", value: { kind: "shed", x: at.x, z: at.z, width: 4, depth: 3.5, floors: 1, roof: "gable" } });
    }
  }
  return ops;
}

// ── 3. Settling ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Level range a wall-mounted op occupies on its wall, or undefined when it doesn't take up wall face. */
function wallFace(op: PatchOp, floors: number): { wall: WallSide; from: number; to: number; levels: [number, number] } | undefined {
  const v = valueOf(op);
  if (typeof v.wall !== "string" || typeof v.offset !== "number") return undefined;
  const wall = v.wall as WallSide;
  const from = v.offset;
  const to = v.offset + num(v.width, num(v.depth));
  switch (op.op) {
    case "addWindow": case "addDoor": case "addBalcony": return { wall, from, to, levels: [num(v.level), num(v.level)] };
    case "addGarage": case "addPorch": case "addStairs": case "addArch": return { wall, from, to, levels: [0, 0] };
    case "addBay": return { wall, from, to, levels: [num(v.level), num(v.level) + num(v.levels, 1) - 1] };
    case "addChimney": return { wall, from, to, levels: [0, floors] };
    default: return undefined;
  }
}

/**
 * Last pass, after the style and tier rules. Wings now cover parts of the house's side walls, so anything the other
 * rules hung there is moved to a free stretch or dropped; and the larger facades get a rhythm of upper-floor windows
 * so a mansion is never a blank wall with a door in it.
 */
export function finalizeScale(input: ScaleInput): PatchOp[] {
  const scale = input.site.projectScale;
  if (!scale) return [...input.ops];
  const { house, site } = input;
  let ops: PatchOp[] = [...input.ops];
  const contacts = wingContacts(house, ops);

  const covered = (wall: WallSide, from: number, to: number, levels: [number, number]) =>
    contacts.some((c) => c.wall === wall && from < c.to + 0.3 && to > c.from - 0.3 && levels[0] < c.floors);

  // Move or drop what the wings now cover.
  const relocatable = new Set(["addChimney", "addBay"]);
  const next: PatchOp[] = [];
  for (const op of ops) {
    const face = wallFace(op, house.floors);
    if (!face || !covered(face.wall, face.from, face.to, face.levels)) { next.push(op); continue; }
    if (!relocatable.has(op.op)) {
      if (op.op === "addDoor" || op.op === "addGarage" || op.op === "addPorch" || op.op === "addStairs") next.push(op); // never strand the entrance
      continue;
    }
    // Look for a clear stretch on the same wall, then on the opposite one.
    const v = valueOf(op);
    const width = num(v.width);
    for (const wall of [face.wall, OPPOSITE[face.wall]]) {
      const len = wallLen(house, wall);
      const taken: [number, number][] = contacts.filter((c) => c.wall === wall).map((c) => [c.from - 0.4, c.to + 0.4] as [number, number]);
      const free = freeSpanIn(taken, 0, len);
      if (free && free[1] - free[0] >= width + 0.6) {
        next.push({ ...op, value: { ...v, wall, offset: round((free[0] + free[1]) / 2 - width / 2) } });
        break;
      }
    }
  }
  ops = next;

  // Window rhythm on the bigger facades.
  if (scaleRank(scale) >= 2) {
    const view = site.viewDirection as WallSide;
    const approach = site.approachSide as WallSide;
    const spacing = scaleRank(scale) >= 4 ? 4.6 : scaleRank(scale) === 3 ? 4.4 : 4.2;
    const size = scaleRank(scale) >= 3 ? { width: 1.6, height: 1.7, sill: 0.8 } : { width: 1.4, height: 1.5, sill: 0.85 };
    const added: PatchOp[] = [];
    for (let level = 0; level < house.floors; level++) {
      for (const wall of ["north", "east", "south", "west"] as const) {
        // The ground floor of the view and entrance walls belongs to the door, porch, arcade and terrace.
        if (level === 0 && (wall === view || wall === approach)) continue;
        const len = wallLen(house, wall);
        const taken: [number, number][] = [];
        for (const op of [...ops, ...added]) {
          const f = wallFace(op, house.floors);
          if (f && f.wall === wall && level >= f.levels[0] && level <= f.levels[1]) taken.push([f.from - 0.4, f.to + 0.4]);
        }
        for (const c of contacts) if (c.wall === wall && level < c.floors) taken.push([c.from - 0.4, c.to + 0.4]);
        const n = Math.floor((len - 1) / spacing);
        for (let i = 0; i < n; i++) {
          const centre = (len * (i + 0.5)) / n;
          const from = centre - size.width / 2;
          const to = centre + size.width / 2;
          if (from < 0.5 || to > len - 0.5) continue;
          if (taken.some(([a, b]) => from < b && to > a)) continue;
          taken.push([from, to]);
          added.push({ op: "addWindow", value: { wall, level, offset: round(from), ...size } });
        }
      }
    }
    ops = [...ops, ...added];
  }
  return ops;
}
