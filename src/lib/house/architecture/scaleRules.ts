import type { SiteSettings, WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { DOOR_LIMITS, DRIVEWAY_LIMITS, GARAGE_LIMITS, POOL_LIMITS, WALL_THICKNESS } from "../constants";
import { briefChance, floorRangeFor, pickInRange, SCALE_PROFILES, scaleRank } from "../scale";
import { SIDE_VECTORS } from "./profiles";
import { groundRects, wallPoint, wallRect, type Rect, type Vec } from "./siteGeometry";
import { reconcileDetached } from "./siteReconcile";
import { APRON, deriveSitePlan, poolOnViewFront, type SitePlan, viewPoint, GARAGE_BAY, GAZEBO_SIZE, guestSizeFor, insideZone, OUTDOOR_BAR_SIZE, overlaps, placeInZone, reservedRects, SHED_SIZE } from "./sitePlan";

/**
 * Project-scale rules for a freshly generated design.
 *
 * The model is told the size envelope of the chosen scale, but a "mansion" must not depend on it remembering to be
 * big, so these rules make it so — without ever just multiplying dimensions. A larger scale changes the *composition*:
 * more floors, connected wings that step down from the main block, a garage row, a pool and deck sized to the house,
 * a longer drive, more garden zones and detached buildings spread over the site.
 *
 * Placement follows the site plan (see sitePlan.ts): the property is composed once as zones around the view and
 * arrival axes, and each feature below is set down in the zone that owns it instead of wherever is free.
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
  /** Buildings in `ops` the style rules added at stand-in coordinates: the plan sets them into their zones (see reconcileDetached). */
  placeholders?: ReadonlySet<PatchOp>;
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
  return planScale(input).ops;
}

/** The scale rules, and the site plan they placed everything by (undefined for a project without a scale, which is never planned). */
export function planScale(input: ScaleInput): { ops: PatchOp[]; plan: SitePlan | undefined } {
  const scale = input.site.projectScale;
  if (!scale) return { ops: [...input.ops], plan: undefined };
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
  // The site plan: the whole property composed as zones before any of it is placed. Every placement below is into a zone.
  const plan = deriveSitePlan({ brief, house, site, ops })!;

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
    // On the plan's arrival axis: from the attached garage if there is one; otherwise off to one side of the door.
    const centre = plan.arrival.centre;
    ops.push({ op: "addDriveway", value: { wall: approachWall, offset: round(clamp(centre - width / 2, 0, Math.max(0, len - width))), width, length: driveLen } });
  }

  // ── Detached buildings the style or the model already placed: onto the plan, before anything is set beside them ──
  // The style rules could not know the zones, and the model's coordinates are only a suggestion: a building the plan
  // accepts stays where it is, the rest go to the zone that owns them (a garage to the garage court, a gazebo to the
  // outdoor-living zone). Only x, z and the turn change, so ids and order hold.
  ops.splice(0, ops.length, ...reconcileDetached(plan, house, ops, input.placeholders ?? new Set()));

  // The drive is added to these once it is settled; the garages set beside it must be able to meet its edge.
  const rects = groundRects(house, ops, false);

  // ── The drive's frame: where it starts on its wall, which way it runs and which way is across it ──
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
            // Too far from the drive to be part of it: draw the garage into the garage court, at a normal apron's distance.
            if (gap > 8 && along > 0) {
              const own = rects.findIndex((r) => r.x === gx && r.z === gz && r.w === gw && r.d === gd);
              const court = plan.zones.garageCourt!;
              search: for (const s2 of [plan.arrival.garageSide]) {
                const reach = s2 * (frame.width / 2 + APRON + gd / 2);
                for (let a = gw / 2 + 1; a <= DRIVEWAY_LIMITS.length.max; a += 1.5) {
                  const moved: Rect = { x: round(frame.start[0] + frame.dir[0] * a + frame.across[0] * reach), z: round(frame.start[1] + frame.dir[1] * a + frame.across[1] * reach), w: runsX ? gw : gd, d: runsX ? gd : gw };
                  if (!insideZone(court, moved)) continue;
                  if (rects.some((r, k) => k !== own && overlaps(moved, r, 1)) || reservedRects(plan, "garageCourt").some((r) => overlaps(moved, r, 1))) continue;
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
  // Those buildings may have moved and turned: read the ground again.
  rects.splice(0, rects.length, ...groundRects(house, ops, false));

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
      const bw = GARAGE_BAY.width;
      const bd = GARAGE_BAY.depth;
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
      // The garage court on the plan's side of the drive: the row slides along it only as far as something in the way demands.
      const side = plan.arrival.garageSide;
      const court = plan.zones.garageCourt!;
      const held = reservedRects(plan, "garageCourt");
      let spot: { along: number; side: 1 | -1 } | undefined;
      const last = DRIVEWAY_LIMITS.length.max - rowLen / 2 - 1;
      for (let along = rowLen / 2; along <= last && !spot; along += 1) {
        const row = rectAt(along, side);
        const apron = apronAt(along, side);
        if (!insideZone(court, row) || !insideZone(court, apron)) continue;
        if (![row, apron].some((r) => rects.some((o) => overlaps(r, o, 1)) || held.some((o) => overlaps(r, o, 1)))) spot = { along, side };
      }
      // No room in the court: the garages are left out rather than set down somewhere arbitrary.
      if (spot) {
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
  }

  // The drive is ground too: nothing else is set down on it.
  for (const op of ops) {
    const v = valueOf(op);
    if (op.op === "addDriveway") rects.push(wallRect(house, v.wall as WallSide, num(v.offset), num(v.width), 0, num(v.length)));
  }

  // ── Outdoor living: patio, pool and a sun deck sized to the house ──
  if (profile.patio) {
    const len = wallLen(house, viewWall);
    // The terrace and pool garden stand on the plan's view front: the whole wall, or the free side of it when the drive shares it.
    const front = plan.viewFront;
    const frontLen = front.to - front.from;
    const fitOffset = (width: number) => round(clamp(front.centre - width / 2, 0, Math.max(0, len - width)));
    const horizontal = isHorizontal(viewWall);
    const pw = round(Math.min(profile.patio.width, frontLen * 0.75));
    const pd = profile.patio.depth;
    const existingPatio = ops.findIndex((op) => op.op === "addPatio" && valueOf(op).wall === viewWall);
    if (existingPatio >= 0) {
      const v = valueOf(ops[existingPatio]);
      const width = Math.max(num(v.width), pw);
      const centre = num(v.offset) + num(v.width) / 2;
      ops[existingPatio] = { ...ops[existingPatio], value: { ...v, width: round(width), depth: round(Math.max(num(v.depth), pd)), offset: round(clamp(centre - width / 2, 0, Math.max(0, len - width))) } };
    } else {
      ops.push({ op: "addPatio", value: { wall: viewWall, offset: fitOffset(pw), width: pw, depth: pd } });
    }
    const patio = valueOf(ops.find((op) => op.op === "addPatio" && valueOf(op).wall === viewWall)!);

    let pool: Rec | undefined;
    /** How far the water's far edge is from the view wall. */
    let poolReach = 0;
    if (profile.pool && !urban) {
      const [wr, dr] = [profile.pool.width, profile.pool.depth];
      const width = round(front.freePool ? pickInRange(wr, brief, "pool-w") : Math.min(pickInRange(wr, brief, "pool-w"), frontLen - 2));
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
        poolReach = num(pool.distance) + num(pool.depth);
      } else if (!has("addPool")) {
        // With the drive on the view wall the pool stands free in the pool garden; otherwise it hangs on the wall.
        pool = poolOnViewFront(plan, house, width, depth, distance);
        ops.push({ op: "addPool", value: pool });
        poolReach = distance + depth;
      }
    }

    // A sun deck beyond the pool, or straight off the patio when there is none.
    if (profile.deck && !has("addDeck")) {
      const along = round(front.freePool ? profile.deck.width : Math.min(profile.deck.width, frontLen));
      const out = pool ? poolReach + 0.6 : num(patio.depth) + 0.4;
      // Beyond the pool, on the pool garden's own axis.
      const centre = viewPoint(plan, hv + out + profile.deck.depth / 2, front.poolQ);
      ops.push({ op: "addDeck", value: { x: round(centre[0]), z: round(centre[1]), level: 0, width: horizontal ? along : profile.deck.depth, depth: horizontal ? profile.deck.depth : along } });
    }
    rects.length = 0;
    rects.push(...groundRects(house, ops));
  }

  // ── Detached buildings: how many, and how likely, depends on the scale ──
  const ob = profile.outbuildings;
  const roof = wingRoof(house.roof);
  const guestSize = guestSizeFor(scale);
  const yawTo = (face: Vec) => Math.round((Math.atan2(face[0], face[1]) * 180) / Math.PI);
  const toward = (zone: { center: Vec }, along: Vec, by: number): Vec => [zone.center[0] + along[0] * by, zone.center[1] + along[1] * by];
  if (!urban) {
    if (!has("addBuilding", "villa") && !has("addBuilding", "restaurant") && chance("guest") < ob.guestHouse) {
      // In its own zone, private on the flank away from the arrival and turned toward the house: give it a square of room.
      const zone = plan.zones.guest!;
      const room = Math.max(guestSize.width, guestSize.depth);
      const at = placeInZone(plan, zone, "villa", room, room, rects, { anchor: toward(zone, zone.orientation, 4) });
      if (at) {
        rects.push(at);
        // Built like the main house, with its door turned toward it, and joined to it by a path.
        const turn = yawTo(zone.orientation);
        ops.push({ op: "addBuilding", value: { kind: "villa", x: at.x, z: at.z, ...guestSize, roof, matchHouse: true, ...(turn !== 0 ? { rotation: turn } : {}) } });
        const edge = (r: Rect): Vec => [clamp(at.x, r.x - r.w / 2, r.x + r.w / 2), clamp(at.z, r.z - r.d / 2, r.z + r.d / 2)];
        const masses = [{ x: 0, z: 0, w: house.width, d: house.depth }, ...ops.filter((op) => op.op === "addBuilding" && valueOf(op).kind === "wing").map((op) => ({ x: num(valueOf(op).x), z: num(valueOf(op).z), w: num(valueOf(op).width), d: num(valueOf(op).depth) }))];
        const from = masses.map(edge).reduce((a, b) => (Math.hypot(a[0] - at.x, a[1] - at.z) <= Math.hypot(b[0] - at.x, b[1] - at.z) ? a : b));
        const to: Vec = [at.x - zone.orientation[0] * (room / 2), at.z - zone.orientation[1] * (room / 2)].map(round) as Vec;
        if (Math.hypot(to[0] - from[0], to[1] - from[1]) > 3) ops.push({ op: "addPath", value: { x1: round(from[0]), z1: round(from[1]), x2: to[0], z2: to[1], width: 1.4, bend: 0, surface: rank >= 3 ? "flagstone" : "gravel" } });
      }
    }
    const living = plan.zones.outdoorLiving!;
    if (!has("addBuilding", "gazebo") && chance("gazebo") < ob.gazebo) {
      // The view pavilion, out at the far end of the living zone where the garden looks back at the house.
      const size = GAZEBO_SIZE(rank);
      const at = placeInZone(plan, living, "gazebo", size, size, rects, { anchor: toward(living, plan.viewAxis, 40) });
      if (at) {
        rects.push(at);
        ops.push({ op: "addBuilding", value: { kind: "gazebo", x: at.x, z: at.z, width: size, depth: size, floors: 1, roof: "hip" } });
      }
    }
    if (!has("addBuilding", "outdoor_bar") && has("addPool") && chance("poolhouse") < ob.poolHouse) {
      // Beside the pool, its long side turned to the water.
      const facesX = Math.abs(living.orientation[0]) > 0.5;
      const w = facesX ? OUTDOOR_BAR_SIZE.depth : OUTDOOR_BAR_SIZE.width;
      const d = facesX ? OUTDOOR_BAR_SIZE.width : OUTDOOR_BAR_SIZE.depth;
      const at = placeInZone(plan, living, "outdoor_bar", w, d, rects, { anchor: plan.zones.poolGarden!.center });
      if (at) {
        rects.push(at);
        const turn = yawTo(living.orientation);
        ops.push({ op: "addBuilding", value: { kind: "outdoor_bar", x: at.x, z: at.z, width: OUTDOOR_BAR_SIZE.width, depth: OUTDOOR_BAR_SIZE.depth, floors: 1, roof: "flat", ...(turn !== 0 ? { rotation: turn } : {}) } });
      }
    }
    const rural = ["forest", "farm", "countryside", "hillside"].includes(site.environment);
    if (rank < 2 && !has("addBuilding", "shed") && (rural || rank === 1) && chance("shed") < ob.shed) {
      // In the service zone, beside the garage side of the house and out of sight of the view.
      const at = placeInZone(plan, plan.zones.service!, "shed", SHED_SIZE.width, SHED_SIZE.depth, rects);
      if (at) {
        rects.push(at);
        ops.push({ op: "addBuilding", value: { kind: "shed", x: at.x, z: at.z, width: SHED_SIZE.width, depth: SHED_SIZE.depth, floors: 1, roof: "gable" } });
      }
    }
  }
  // ── Gardens: the plan's lawns in priority order, the first ones that fit around what is already placed ──
  if (profile.gardens.count > 0) {
    let want = profile.gardens.count - ops.filter((op) => op.op === "addLandscape" && valueOf(op).kind === "garden").length;
    for (const zone of plan.gardens) {
      if (want <= 0) break;
      const at = placeInZone(plan, zone, "garden", profile.gardens.width, profile.gardens.depth, rects);
      if (!at) continue;
      rects.push(at);
      ops.push({ op: "addLandscape", value: { kind: "garden", x: at.x, z: at.z, width: profile.gardens.width, depth: profile.gardens.depth } });
      want--;
    }
  }

  return { ops, plan };
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
