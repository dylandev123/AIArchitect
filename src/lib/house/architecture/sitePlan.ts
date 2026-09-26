import type { SiteSettings, WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { DRIVEWAY_LIMITS } from "../constants";
import { briefChance, SCALE_PROFILES, scaleRank } from "../scale";
import { SIDE_VECTORS } from "./profiles";
import { wallPoint, type Rect, type Vec } from "./siteGeometry";

/**
 * The site plan: the master plan for a freshly generated property, derived before any feature is placed.
 *
 * Placement rules used to set each feature down "where nothing else is", searching outward from the house. That reads
 * as scattered objects. Here the property is composed once, as zones around two axes — the view axis (where the land
 * looks) and the arrival axis (where the drive meets the house) — and every rule then places its feature *into* the
 * zone that owns it: the garage in the garage court beside the drive, the pool in the pool garden on the view side,
 * the bar and gazebo in the outdoor-living zone beside it, the guest house in its own private zone, gardens in the
 * garden zones left over.
 *
 * The plan is pure data derived from the brief, the house, the site settings and the ops already there. It is built
 * in two local frames — the view frame (p toward the view, q across it) and the arrival frame (along the drive, across
 * it) — and returned in world coordinates, so the same brief with another view or approach rotates the whole plan.
 * It only steers generation of a project with a scale; nothing saved is ever re-planned.
 */

type Rec = Record<string, unknown>;
export type { Rect, Vec };

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const valueOf = (op: PatchOp): Rec => (isRecord(op.value) ? op.value : {});
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const round = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
const wallLen = (h: Shell, wall: WallSide) => (wall === "north" || wall === "south" ? h.width : h.depth);

type Shell = { width: number; depth: number; floors: number; roof: string };

/** Features a zone accepts. A rule asking a zone for anything else is turned away. */
export type ZoneFeature =
  | "wing" | "garage" | "porch" | "stairs" | "driveway" | "parking" | "path" | "patio" | "deck" | "pool"
  | "detached_garage" | "outdoor_bar" | "gazebo" | "villa" | "shed" | "garden";

export type ZoneKind =
  | "houseCore" | "arrivalCourt" | "frontEntry" | "garageCourt" | "viewTerrace" | "poolGarden" | "outdoorLiving"
  | "guest" | "service" | "garden";

export interface SiteZone {
  kind: ZoneKind;
  id: string;
  center: Vec;
  footprint: Rect;
  /** The direction the zone faces: what its features turn toward (a court toward the house, a terrace toward the view). */
  orientation: Vec;
  /** Zones this one wants close, most important first. */
  near: ZoneKind[];
  /** Zones this one wants kept away from. */
  apart: ZoneKind[];
  /** Ground height the zone is meant to sit at. Always 0 for now: terracing is not modelled yet. */
  targetElevation: number;
  allowed: ZoneFeature[];
  /** Free margin kept between what is placed here and anything else (m). */
  clearance: number;
}

export type ArrivalRelation = "rear" | "front" | "flank";

export interface ArrivalAxis {
  wall: WallSide;
  /** Unit vector from the house out along the drive. */
  dir: Vec;
  /** Unit vector across the drive (positive side). */
  across: Vec;
  /** Where the drive leaves the house wall. */
  origin: Vec;
  /** Drive centre, in metres along the approach wall. */
  centre: number;
  width: number;
  /** Where the arrival sits against the view: opposite it (`rear`, the usual), on the view side (`front`) or on a flank. */
  relation: ArrivalRelation;
  /** Which side of the drive (sign along `across`) the garage court is on. */
  garageSide: 1 | -1;
  /** Keep-out strip along the drive's line, so nothing but the drive and what serves it stands on the way in. */
  corridor: Rect;
}

/** The stretch of the view wall the terrace and pool garden stand on, in metres along that wall. */
export interface ViewFront {
  wall: WallSide;
  from: number;
  to: number;
  centre: number;
  /** Lateral centre of the pool garden, in the view frame (across the view axis). */
  poolQ: number;
  /** The pool garden reaches past the wall's free stretch (the drive shares the view wall), so the pool stands free of the wall. */
  freePool: boolean;
}

export interface SitePlan {
  viewAxis: Vec;
  /** Unit vector across the view axis. */
  lateralAxis: Vec;
  arrival: ArrivalAxis;
  viewFront: ViewFront;
  zones: Partial<Record<Exclude<ZoneKind, "garden">, SiteZone>>;
  /** Garden zones in priority order: more are derived than any scale asks for, and the first that fit are used, after the buildings. */
  gardens: SiteZone[];
}

export interface SitePlanInput {
  brief: string;
  house: Shell;
  site: SiteSettings;
  ops: readonly PatchOp[];
}

// ── Sizes ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** The apron joining a garage's doors to the drive's edge, and the garages' depth: the garage court is sized from them. */
export const APRON = 4.6;
export const GARAGE_BAY = { width: 6.8, depth: 6.4 };
export const GAZEBO_SIZE = (rank: number) => (rank >= 3 ? 6 : 5);
export const OUTDOOR_BAR_SIZE = { width: 7, depth: 3.5 };
export const SHED_SIZE = { width: 4, depth: 3.5 };
const SERVICE_MIN_RUN = 6;
/** The garden zone size for a scale whose profile has no gardens of its own: the tier rules' garden. */
export const TIER_GARDEN = { width: 6, depth: 5 };
export const guestSizeFor = (scale: string) => (scale === "mansion" ? { width: 13, depth: 10, floors: 2 } : scale === "estate" ? { width: 9, depth: 8, floors: 1 } : { width: 8, depth: 7, floors: 1 });

// ── Frames ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Frame { origin: Vec; dir: Vec; across: Vec }
const frameOf = (origin: Vec, dir: Vec): Frame => ({ origin, dir, across: [-dir[1], dir[0]] });
const pointIn = (f: Frame, along: number, across: number): Vec => [f.origin[0] + f.dir[0] * along + f.across[0] * across, f.origin[1] + f.dir[1] * along + f.across[1] * across];

/** The world rectangle spanning `along` × `across` in a frame (both are compass-aligned, so it stays axis-aligned). */
function rectIn(f: Frame, a0: number, a1: number, l0: number, l1: number): Rect {
  const p = pointIn(f, a0, l0);
  const q = pointIn(f, a1, l1);
  return { x: round((p[0] + q[0]) / 2), z: round((p[1] + q[1]) / 2), w: round(Math.abs(q[0] - p[0])), d: round(Math.abs(q[1] - p[1])) };
}

/** A point on the arrival frame's along/across axes (see ArrivalAxis). */
/** A point in the view frame: `p` metres toward the view from the house's centre, `q` metres across it. */
export const viewPoint = (plan: Pick<SitePlan, "viewAxis" | "lateralAxis">, p: number, q: number): Vec => [plan.viewAxis[0] * p + plan.lateralAxis[0] * q, plan.viewAxis[1] * p + plan.lateralAxis[1] * q];

export const arrivalPoint = (a: ArrivalAxis, along: number, across: number): Vec => pointIn({ origin: a.origin, dir: a.dir, across: a.across }, along, across);

const zoneOf = (kind: ZoneKind, footprint: Rect, rest: Partial<SiteZone> & Pick<SiteZone, "allowed">, id: string = kind): SiteZone => ({
  kind,
  id,
  footprint,
  center: [footprint.x, footprint.z],
  orientation: [0, 1],
  near: [],
  apart: [],
  targetElevation: 0,
  clearance: 1,
  ...rest,
});

// ── Derivation ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The arrival axis: where the drive leaves the house. An existing drive or garage on the approach wall decides it. */
function arrivalAxis(input: SitePlanInput, viewFrame: Frame): ArrivalAxis {
  const { brief, house, site, ops } = input;
  const profile = SCALE_PROFILES[site.projectScale!];
  const wall = site.approachSide as WallSide;
  const dir = SIDE_VECTORS[wall];
  const across: Vec = [-dir[1], dir[0]];
  const len = wallLen(house, wall);
  const onWall = (name: string) => ops.find((op) => op.op === name && valueOf(op).wall === wall);
  const drive = onWall("addDriveway");
  const garage = onWall("addGarage");
  const door = ops.find((op) => op.op === "addDoor" && valueOf(op).wall === wall && num(valueOf(op).level) === 0);
  const width = drive ? num(valueOf(drive).width, profile.driveway.width) : profile.driveway.width;

  // How far the wall's own coordinate runs along `across` (+1 or -1): lets a side be chosen without tying it to a compass wall.
  const start = wallPoint(house, wall, 0, 0);
  const end = wallPoint(house, wall, 1, 0);
  const alongWall: Vec = [end[0] - start[0], end[1] - start[1]];
  const sgnU = dot(alongWall, across) >= 0 ? 1 : -1;

  const garageCentre = garage ? num(valueOf(garage).offset) + num(valueOf(garage).width) / 2 : undefined;
  let centre: number;
  if (drive) {
    const off = num(valueOf(drive).offset);
    const misses = garage !== undefined && (off + width <= num(valueOf(garage!).offset) || off >= num(valueOf(garage!).offset) + num(valueOf(garage!).width));
    centre = misses && garageCentre !== undefined ? garageCentre : off + width / 2;
  } else if (garageCentre !== undefined) {
    centre = garageCentre;
  } else {
    // Off to one side of the door: the side is chosen across the drive, so it turns with the plan.
    const doorCentre = door ? num(valueOf(door).offset) + num(valueOf(door).width) / 2 : len / 2;
    const side = (briefChance(brief, "drive-side") < 0.5 ? -1 : 1) * sgnU;
    centre = clamp(doorCentre + side * len * 0.3, width / 2 + 1, len - width / 2 - 1);
  }
  centre = round(clamp(centre, width / 2, Math.max(width / 2, len - width / 2)));

  const origin = wallPoint(house, wall, centre, 0);
  const relation: ArrivalRelation = dot(dir, viewFrame.dir) < -0.5 ? "rear" : dot(dir, viewFrame.dir) > 0.5 ? "front" : "flank";
  const frame = frameOf(origin, dir);

  // Garage court side. Behind the drive's line on the usual plan a coin flip; on a flank, away from the view; and when the
  // drive shares the view wall, away from the pool, which takes the wider side of the wall.
  let garageSide: 1 | -1;
  if (relation === "flank") garageSide = dot(frame.across, viewFrame.dir) > 0 ? -1 : 1;
  else if (relation === "front") garageSide = centre / len < 0.5 ? (sgnU > 0 ? -1 : 1) : sgnU > 0 ? 1 : -1;
  else garageSide = briefChance(brief, "garage-side") < 0.5 ? 1 : -1;

  return { wall, dir, across: frame.across, origin, centre, width, relation, garageSide, corridor: rectIn(frame, 0, 24, -3, 3) };
}

/** Local (p, q) extents of the house and every wing, in the view frame. */
function coreBoxes(house: Shell, ops: readonly PatchOp[], f: Frame): { p: [number, number]; q: [number, number] }[] {
  const boxOf = (r: Rect) => {
    const corners: Vec[] = [[r.x - r.w / 2, r.z - r.d / 2], [r.x + r.w / 2, r.z + r.d / 2]];
    const ps = corners.map((c) => dot(c, f.dir));
    const qs = corners.map((c) => dot(c, f.across));
    return { p: [Math.min(...ps), Math.max(...ps)] as [number, number], q: [Math.min(...qs), Math.max(...qs)] as [number, number] };
  };
  const boxes = [boxOf({ x: 0, z: 0, w: house.width, d: house.depth })];
  for (const op of ops) {
    if (op.op !== "addBuilding" || valueOf(op).kind !== "wing") continue;
    const v = valueOf(op);
    boxes.push(boxOf({ x: num(v.x), z: num(v.z), w: num(v.width), d: num(v.depth) }));
  }
  return boxes;
}

/**
 * Derives the site plan for a project with a scale (undefined when it has none: such a project is never planned).
 * Wings already in `ops` are part of the house core, so call it once they are placed and before anything else is.
 */
export function deriveSitePlan(input: SitePlanInput): SitePlan | undefined {
  const scale = input.site.projectScale;
  if (!scale) return undefined;
  const { brief, house, site, ops } = input;
  const profile = SCALE_PROFILES[scale];
  const rank = scaleRank(scale);

  // ── Axes ──
  const viewWall = site.viewDirection as WallSide;
  const v = SIDE_VECTORS[viewWall];
  const view = frameOf([0, 0], v);
  const lat = view.across;
  const arrival = arrivalAxis(input, view);
  const arrivalFrame = frameOf(arrival.origin, arrival.dir);
  const qSign = (s: 1 | -1, f: Frame): 1 | -1 => (dot(f.across, lat) * s >= 0 ? 1 : -1);

  const hv = (Math.abs(v[0]) > 0.5 ? house.width : house.depth) / 2;
  const boxes = coreBoxes(house, ops, view);
  /** The lateral edge of the house and its wings over a stretch of the view axis, on side `s`. */
  const edge = (s: 1 | -1, p0: number, p1: number) => {
    let e = 0;
    for (const b of boxes) if (b.p[1] > p0 && b.p[0] < p1) e = Math.max(e, s > 0 ? b.q[1] : -b.q[0]);
    return e;
  };
  const inView = (p0: number, p1: number, q0: number, q1: number) => rectIn(view, p0, p1, q0, q1);
  const core = boxes.reduce((acc, b) => ({ p: [Math.min(acc.p[0], b.p[0]), Math.max(acc.p[1], b.p[1])] as [number, number], q: [Math.min(acc.q[0], b.q[0]), Math.max(acc.q[1], b.q[1])] as [number, number] }));

  // ── The view wall: terrace and pool garden stand on it ──
  const len = wallLen(house, viewWall);
  const vStart = wallPoint(house, viewWall, 0, 0);
  const vEnd = wallPoint(house, viewWall, 1, 0);
  // Wall coordinate → q (lateral position in the view frame).
  const qOfU = (u: number) => dot(wallPoint(house, viewWall, u, 0), lat);
  const uSign = dot([vEnd[0] - vStart[0], vEnd[1] - vStart[1]], lat) >= 0 ? 1 : -1;
  let span: [number, number] = [0, len];
  if (arrival.relation === "front") {
    // The drive and its garage take a stretch of this wall: the terrace keeps the wider free side.
    const taken: [number, number][] = [[arrival.centre - arrival.width / 2 - 2.6, arrival.centre + arrival.width / 2 + 2.6]];
    for (const op of ops) if (op.op === "addGarage" && valueOf(op).wall === viewWall) taken.push([num(valueOf(op).offset) - 1, num(valueOf(op).offset) + num(valueOf(op).width) + 1]);
    const low: [number, number] = [0, Math.max(0, Math.min(...taken.map((t) => t[0])))];
    const high: [number, number] = [Math.min(len, Math.max(...taken.map((t) => t[1]))), len];
    // The pool takes the side the drive is farther from, and the garages the other (see arrivalAxis).
    span = arrival.centre / len < 0.5 ? high : low;
  }
  const front = arrival.relation === "front";
  const spanLen = span[1] - span[0];
  const qCentre = qOfU((span[0] + span[1]) / 2);

  const patioD = profile.patio?.depth ?? 4;
  const patioW = Math.min(profile.patio?.width ?? 6, (span[1] - span[0]) * 0.75);
  const poolW = front ? profile.pool?.width[1] ?? 9 : Math.min(profile.pool?.width[1] ?? 9, spanLen - 2);
  const poolD = profile.pool?.depth[1] ?? 4.5;
  const deckD = profile.deck?.depth ?? 0;
  const deckW = Math.min(profile.deck?.width ?? 0, len);
  const gardenW = front ? Math.max(poolW, deckW) + 4 : Math.min(Math.max(poolW, deckW) + 4, spanLen);
  // With the drive on the view wall the pool garden starts at the drive's edge of the free stretch and runs on past the
  // house's corner, out into the garden the drive leaves free.
  const outward: 1 | -1 = span[0] > 0 ? (uSign as 1 | -1) : (-uSign as 1 | -1);
  const poolQ = front ? qOfU(span[0] > 0 ? span[0] : span[1]) + outward * (gardenW / 2) : qCentre;
  const viewFront: ViewFront = { wall: viewWall, from: round(span[0]), to: round(span[1]), centre: round((span[0] + span[1]) / 2), poolQ: round(poolQ), freePool: front };

  const poolEnd = hv + patioD + poolD + 0.5 + deckD + 1;

  const zones: SitePlan["zones"] = {};

  // ── House core: the bounding box of the house and its wings ──
  zones.houseCore = zoneOf("houseCore", inView(core.p[0], core.p[1], core.q[0], core.q[1]), {
    allowed: ["wing", "garage", "porch", "stairs", "patio"],
    orientation: v,
    near: ["frontEntry", "viewTerrace"],
    clearance: 0,
  });

  // ── Arrival: forecourt, front entry, garage court ──
  const courtDepth = rank >= 3 ? 10 : 8;
  const door = ops.find((op) => op.op === "addDoor" && valueOf(op).wall === arrival.wall && num(valueOf(op).level) === 0);
  const doorAcross = door
    ? dot([wallPoint(house, arrival.wall, num(valueOf(door).offset) + num(valueOf(door).width) / 2, 0)[0] - arrival.origin[0], wallPoint(house, arrival.wall, num(valueOf(door).offset) + num(valueOf(door).width) / 2, 0)[1] - arrival.origin[1]], arrival.across)
    : 0;
  const courtHalf = arrival.width / 2 + 2;
  zones.arrivalCourt = zoneOf("arrivalCourt", rectIn(arrivalFrame, 0, courtDepth, -courtHalf, courtHalf), {
    allowed: ["driveway", "parking", "path", "garden"],
    orientation: [-arrival.dir[0], -arrival.dir[1]],
    near: ["frontEntry", "garageCourt"],
    apart: ["poolGarden", "service"],
  });
  zones.frontEntry = zoneOf("frontEntry", rectIn(arrivalFrame, 0, 4.5, doorAcross - 2.5, doorAcross + 2.5), {
    allowed: ["porch", "stairs", "path"],
    orientation: [-arrival.dir[0], -arrival.dir[1]],
    near: ["arrivalCourt", "houseCore"],
  });
  const bays = Math.ceil(profile.garageCars / 2);
  const gs = arrival.garageSide;
  const g0 = courtDepth;
  const g1 = Math.min(DRIVEWAY_LIMITS.length.max, courtDepth + Math.max(1, bays) * GARAGE_BAY.width + 14);
  const gl0 = arrival.width / 2;
  const gl1 = arrival.width / 2 + APRON + GARAGE_BAY.depth + 1;
  zones.garageCourt = zoneOf("garageCourt", rectIn(arrivalFrame, g0, g1, gs * gl0, gs * gl1), {
    allowed: ["garage", "detached_garage", "parking", "driveway"],
    orientation: [-arrival.across[0] * gs, -arrival.across[1] * gs],
    near: ["arrivalCourt", "service"],
    apart: ["viewTerrace", "poolGarden", "guest"],
    clearance: 1,
  });

  // ── View side: terrace, pool garden, outdoor living ──
  zones.viewTerrace = zoneOf("viewTerrace", inView(hv, hv + patioD, qCentre - patioW / 2, qCentre + patioW / 2), {
    allowed: ["patio", "deck", "stairs", "path"],
    orientation: v,
    near: ["houseCore", "poolGarden"],
    apart: ["arrivalCourt", "garageCourt", "service"],
  });
  zones.poolGarden = zoneOf("poolGarden", inView(hv + patioD, poolEnd, poolQ - gardenW / 2, poolQ + gardenW / 2), {
    allowed: ["pool", "deck", "patio", "garden"],
    orientation: v,
    near: ["viewTerrace", "outdoorLiving"],
    apart: ["arrivalCourt", "garageCourt", "service"],
    clearance: 2,
  });
  // Which side the outdoor-living pavilions stand: away from the arrival, so the entrance stays quiet.
  let livingQ: 1 | -1;
  if (arrival.relation === "flank") livingQ = dot(arrival.dir, lat) > 0 ? -1 : 1;
  else if (front) livingQ = outward;
  else livingQ = briefChance(brief, "living-side") < 0.5 ? 1 : -1;
  const livingFrom = poolQ + livingQ * (gardenW / 2 + 1.6);
  const livingTo = livingFrom + livingQ * 12;
  zones.outdoorLiving = zoneOf("outdoorLiving", inView(hv + patioD * 0.5, poolEnd + 6, Math.min(livingFrom, livingTo), Math.max(livingFrom, livingTo)), {
    allowed: ["outdoor_bar", "gazebo", "deck", "garden"],
    orientation: [-livingQ * lat[0], -livingQ * lat[1]],
    near: ["poolGarden", "viewTerrace"],
    apart: ["arrivalCourt", "garageCourt", "service"],
    clearance: 2,
  });

  // ── Guest: private but connected — on the flank away from the arrival, behind the pool garden ──
  const guest = guestSizeFor(scale);
  const room = Math.max(guest.width, guest.depth);
  let guestP: number;
  let guestQ: 1 | -1;
  if (arrival.relation === "flank") {
    guestQ = dot(arrival.dir, lat) > 0 ? -1 : 1;
    guestP = -hv * 0.3;
  } else if (arrival.relation === "front") {
    guestQ = briefChance(brief, "guest-side") < 0.5 ? 1 : -1;
    guestP = -hv - room / 2 - 6;
  } else {
    guestQ = qSign(gs, arrivalFrame) > 0 ? -1 : 1;
    guestP = -hv * 0.3;
  }
  const gpFrom = guestP - room / 2 - 3;
  const gpTo = guestP + room / 2 + 3;
  const gqFrom = (arrival.relation === "front" ? 0 : edge(guestQ, gpFrom, gpTo)) + 4;
  zones.guest = zoneOf("guest", inView(gpFrom, gpTo, guestQ * gqFrom, guestQ * (gqFrom + room + 6)), {
    allowed: ["villa", "path", "garden"],
    orientation: [-guestQ * lat[0], -guestQ * lat[1]],
    near: ["houseCore", "outdoorLiving"],
    apart: ["arrivalCourt", "garageCourt", "service"],
    clearance: 3,
  });

  // ── Service: beside the garage side of the house, out of sight of the view ──
  const behind = arrival.relation !== "rear";
  const serviceQ: 1 | -1 = arrival.relation === "flank" ? (dot(arrival.dir, lat) > 0 ? -1 : 1) : qSign(gs, arrivalFrame);
  const sp0 = behind ? -hv - 9 : -hv - 1;
  // A cottage's short flank still has to hold a shed: the zone is never shorter than that.
  const sp1 = behind ? -hv - 1 : Math.max(Math.min(hv * 0.3, hv - 4), sp0 + SERVICE_MIN_RUN);
  const sq0 = behind ? 0 : edge(serviceQ, sp0, sp1) + 2;
  zones.service = zoneOf("service", inView(sp0, sp1, serviceQ * sq0, serviceQ * (sq0 + 9)), {
    allowed: ["shed", "path"],
    orientation: [-serviceQ * lat[0], -serviceQ * lat[1]],
    near: ["garageCourt", "houseCore"],
    apart: ["viewTerrace", "poolGarden", "outdoorLiving"],
    clearance: 2,
  });

  // ── Gardens: the intentional lawns around arrival and view, then the flanks ──
  const gw = profile.gardens.width || TIER_GARDEN.width;
  const gd = profile.gardens.depth || TIER_GARDEN.depth;
  const gardens: SiteZone[] = [];
  if (gw > 0 && gd > 0) {
    const arrX = Math.abs(arrival.dir[0]) > 0.5;
    const viewX = Math.abs(v[0]) > 0.5;
    const aAlong = arrX ? gw : gd;
    const aAcross = arrX ? gd : gw;
    const vAlong = viewX ? gw : gd;
    const vAcross = viewX ? gd : gw;
    const slack = 3;
    const garden = (i: number, rect: Rect) => gardens.push(zoneOf("garden", rect, { allowed: ["garden", "path"], orientation: [-arrival.dir[0], -arrival.dir[1]], near: ["houseCore"], clearance: 1 }, `garden-${i}`));
    const beside = (side: 1 | -1, from: number) => rectIn(arrivalFrame, 2, 2 + aAlong + slack, side * from, side * (from + aAcross + slack));
    // Front lawns flank the forecourt: one on the side opposite the garages, one beyond the garage court.
    const arrivalLawn = beside(-gs as 1 | -1, courtHalf + 1.6);
    const garageLawn = beside(gs, gl1 + 1.6);
    // View lawns: beyond the pool garden, and out to the side of it away from the pavilions.
    const viewLawn = inView(poolEnd + 1.6, poolEnd + 1.6 + vAlong + slack, poolQ - (vAcross + slack) / 2, poolQ + (vAcross + slack) / 2);
    const sideOfPool = -livingQ as 1 | -1;
    const sideFrom = poolQ + sideOfPool * (gardenW / 2 + 1.6);
    const sideLawn = inView(hv + patioD, hv + patioD + vAlong + slack, Math.min(sideFrom, sideFrom + sideOfPool * (vAcross + slack)), Math.max(sideFrom, sideFrom + sideOfPool * (vAcross + slack)));
    // Flank lawns beside the house, beyond the wings.
    const flank = (s: 1 | -1) => {
      const from = edge(s, -hv, hv) + 2;
      return inView(-vAlong / 2 - slack / 2, vAlong / 2 + slack / 2, Math.min(s * from, s * (from + vAcross + slack)), Math.max(s * from, s * (from + vAcross + slack)));
    };
    // Behind the house, when the arrival is not there.
    const rearLawn = inView(-hv - 1.6 - (vAlong + slack), -hv - 1.6, -(vAcross + slack) / 2, (vAcross + slack) / 2);
    [arrivalLawn, viewLawn, garageLawn, sideLawn, flank(guestQ === 1 ? -1 : 1), flank(guestQ), ...(arrival.relation === "rear" ? [] : [rearLawn])].forEach((r, i) => garden(i, r));
  }

  return { viewAxis: v, lateralAxis: lat, arrival, viewFront, zones, gardens };
}

// ── Pool on the view front ──────────────────────────────────────────────────────────────────────────────────────

/**
 * A new pool's fields on the plan's view front: hung on the view wall over the free stretch, or standing free in the
 * pool garden past the house's corner when the drive shares that wall. A free pool's width always runs along x, so on
 * an east or west view the two sizes trade places.
 */
export function poolOnViewFront(plan: SitePlan, house: Shell, width: number, depth: number, distance: number): Rec {
  const front = plan.viewFront;
  const len = wallLen(house, front.wall);
  const horizontal = front.wall === "north" || front.wall === "south";
  if (!front.freePool) return { wall: front.wall, offset: round(clamp(front.centre - width / 2, 0, Math.max(0, len - width))), distance, width, depth, waterDepth: 1.5 };
  const hv = (horizontal ? house.depth : house.width) / 2;
  const c = viewPoint(plan, hv + distance + depth / 2, front.poolQ);
  return { wall: front.wall, offset: 0, distance, width: horizontal ? width : depth, depth: horizontal ? depth : width, waterDepth: 1.5, siteX: round(c[0]), siteZ: round(c[1]) };
}

// ── Placement ───────────────────────────────────────────────────────────────────────────────────────────────────

export const overlaps = (a: Rect, b: Rect, margin = 0) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin;
export const insideZone = (zone: SiteZone, r: Rect, tolerance = 0.11) =>
  Math.abs(r.x - zone.footprint.x) + r.w / 2 <= zone.footprint.w / 2 + tolerance && Math.abs(r.z - zone.footprint.z) + r.d / 2 <= zone.footprint.d / 2 + tolerance;

/** The zones no other feature may be set down in: the entrance, the terrace and the pool and living areas. */
const RESERVED: readonly Exclude<ZoneKind, "garden">[] = ["arrivalCourt", "frontEntry", "viewTerrace", "poolGarden", "outdoorLiving"];

/** The footprints of the reserved zones, other than `except`'s own. */
export const reservedRects = (plan: SitePlan, except?: ZoneKind): Rect[] =>
  RESERVED.filter((k) => k !== except).flatMap((k) => (plan.zones[k] ? [plan.zones[k]!.footprint] : []));

export interface PlaceOptions {
  /** Where in the zone the feature wants to be (default: the zone's centre). */
  anchor?: Vec;
  /** Extra clearance around the feature beyond the zone's own. */
  margin?: number;
}

/**
 * Sets a `w` × `d` feature down *inside* `zone`, as close to its anchor as the zone and what stands in it allow.
 * Nothing outside the zone is ever considered: a feature its zone cannot hold, or a zone that does not allow the
 * feature, gets undefined and the caller leaves it out rather than dropping it somewhere arbitrary. The reserved
 * zones (entrance, terrace, pool and living areas) are kept clear of every feature that is not theirs.
 */
export function placeInZone(plan: SitePlan, zone: SiteZone, feature: ZoneFeature, w: number, d: number, taken: readonly Rect[], opts: PlaceOptions = {}): Rect | undefined {
  if (!zone.allowed.includes(feature)) return undefined;
  const f = zone.footprint;
  if (w > f.w + 0.11 || d > f.d + 0.11) return undefined;
  const margin = Math.max(zone.clearance, opts.margin ?? 0);
  const avoid = [...taken, ...reservedRects(plan, zone.kind)];
  const [ax, az] = opts.anchor ?? zone.center;
  const xs = Math.max(0, (f.w - w) / 2);
  const zs = Math.max(0, (f.d - d) / 2);
  const stepX = Math.max(0.5, xs / 12);
  const stepZ = Math.max(0.5, zs / 12);
  let best: Rect | undefined;
  let bestScore = Infinity;
  for (let dx = -xs; dx <= xs + 1e-6; dx += stepX) {
    for (let dz = -zs; dz <= zs + 1e-6; dz += stepZ) {
      const r: Rect = { x: round(f.x + dx), z: round(f.z + dz), w, d };
      const score = Math.hypot(r.x - ax, r.z - az);
      if (score >= bestScore || avoid.some((o) => overlaps(r, o, margin))) continue;
      best = r;
      bestScore = score;
    }
  }
  return best;
}
