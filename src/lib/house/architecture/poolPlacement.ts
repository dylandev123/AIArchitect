import type { SiteSettings, WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { POOL_LIMITS } from "../constants";
import { SIDE_VECTORS } from "./profiles";
import { wallPoint, type Vec } from "./siteGeometry";
import { poolOnViewFront, type SitePlan } from "./sitePlan";

/**
 * Where the pool belongs, as a rule about the property and not about collisions.
 *
 * A luxury villa is read as two sides: the arrival side (drive, garage court, front entry) and the private side that looks at
 * the view (terrace, pool, outdoor living). The model is told this, but it sometimes hangs the pool on the entrance wall or
 * sets it free in the front court, and the collision pass would only nudge it clear of the drive — leaving a pool where the cars
 * arrive. These functions decide which side a pool is on and, for one on the arrival side, set it down on the view front
 * instead. The collision pass stays what it is: a safety net that runs after this.
 *
 * A brief that puts the pool at the entrance on purpose ("a reflecting pool in the forecourt") is left alone, and so is a
 * site whose arrival and view are the same side (the site plan already shares that wall between them).
 */

type Rec = Record<string, unknown>;
type Shell = { width: number; depth: number };

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const valueOf = (op: PatchOp): Rec => (isRecord(op.value) ? op.value : {});
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const round = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
const halfAlong = (h: Shell, v: Vec) => (Math.abs(v[0]) > 0.5 ? h.width : h.depth) / 2;
const wallLen = (h: Shell, wall: WallSide) => (wall === "north" || wall === "south" ? h.width : h.depth);

/** The brief puts a pool (or a reflecting pool) at the entrance on purpose. */
const FRONT_POOL = /\b(?:front|entry|entrance|forecourt|courtyard|arrival|street[-\s]?side)\s+(?:court\s*)?(?:pool|water\s+feature)|\bpool\s+(?:at|in|by|near|beside|in\s+front\s+of)\s+(?:the\s+)?(?:front|entrance|entry|forecourt|courtyard|arrival|house\s+front)\b|\breflecting\s+pool\b/i;
export const briefAllowsFrontPool = (brief: string): boolean => FRONT_POOL.test(brief);

export type PropertySide = "arrival" | "view" | "flank" | "rear";

/** The centre of a pool's water in world x/z, whichever way it was placed. */
export function poolCentre(house: Shell, v: Rec): Vec {
  if (typeof v.siteX === "number") return [v.siteX, num(v.siteZ)];
  return wallPoint(house, (v.wall as WallSide) ?? "south", num(v.offset) + num(v.width) / 2, num(v.distance) + num(v.depth) / 2);
}

/**
 * Which side of the house a point is on. Whichever plane it has passed by more decides: past the entrance wall's plane by more than
 * it is past the view wall's is the arrival side, and the reverse the view side; the rest is a flank or the rear. So a pool at the
 * corner of the private terrace is on the view side even when the entrance is on that flank. When the entrance and the view are
 * the same side there is no separate arrival side.
 */
export function sideOfPoint(house: Shell, site: Pick<SiteSettings, "viewDirection" | "approachSide">, c: Vec): PropertySide {
  const a = SIDE_VECTORS[site.approachSide];
  const v = SIDE_VECTORS[site.viewDirection];
  const shared = dot(a, v) > 0.5;
  const pastArrival = dot(c, a) - halfAlong(house, a);
  const pastView = dot(c, v) - halfAlong(house, v);
  if (!shared && pastArrival > -1 && pastArrival >= pastView) return "arrival";
  if (pastView > -1) return "view";
  if (dot(c, v) < -(halfAlong(house, v) - 1)) return "rear";
  return "flank";
}

export interface ReseatInput {
  house: Shell & { floors: number; roof: string };
  site: Pick<SiteSettings, "viewDirection" | "approachSide">;
  ops: readonly PatchOp[];
  brief: string;
  /** The site plan, when there is one (a project with a scale): the pool is set on its view front. */
  plan?: SitePlan;
  /** The largest pool the scale allows. */
  cap?: { width: number; depth: number };
  /** How far the water starts from the view wall: a patio's depth plus a little. */
  distance?: number;
}

/**
 * Moves a pool that stands on the arrival side to the view front, or drops it when a well-placed pool already exists. Returns
 * the ops unchanged (and no notes) when every pool is fine.
 */
export function reseatPools(input: ReseatInput): { ops: PatchOp[]; notes: string[] } {
  const { house, site, brief, plan } = input;
  const ops = [...input.ops];
  if (briefAllowsFrontPool(brief)) return { ops, notes: [] };
  const pools = ops.flatMap((op, i) => (op.op === "addPool" ? [i] : []));
  const misplaced = pools.filter((i) => sideOfPoint(house, site, poolCentre(house, valueOf(ops[i]))) === "arrival");
  if (misplaced.length === 0) return { ops, notes: [] };

  const notes: string[] = [];
  const drop = new Set<number>();
  const wellPlaced = pools.length - misplaced.length;
  const [first, ...rest] = misplaced;
  if (wellPlaced === 0) {
    const v = valueOf(ops[first]);
    const cap = input.cap ?? { width: POOL_LIMITS.width.max, depth: POOL_LIMITS.depth.max };
    const wall = site.viewDirection as WallSide;
    const len = wallLen(house, wall);
    const width = round(clamp(num(v.width, 8), POOL_LIMITS.width.min, Math.max(POOL_LIMITS.width.min, Math.min(cap.width, plan?.viewFront.freePool ? cap.width : len - 2))));
    const depth = round(clamp(num(v.depth, 4), POOL_LIMITS.depth.min, cap.depth));
    const distance = round(Math.min(POOL_LIMITS.distance.max, input.distance ?? 3.5));
    const fields: Rec = plan
      ? poolOnViewFront(plan, house, width, depth, distance)
      : { wall, offset: round(Math.max(0, (len - width) / 2)), distance, width, depth, waterDepth: 1.5 };
    ops[first] = { ...ops[first], value: { ...fields, ...(v.shape !== undefined ? { shape: v.shape } : {}), ...(typeof v.waterDepth === "number" ? { waterDepth: v.waterDepth } : {}) } };
    notes.push(`The pool stood on the arrival side (${site.approachSide}); it was set on the private ${site.viewDirection} side with the outdoor living.`);
    for (const i of rest) drop.add(i);
  } else {
    for (const i of misplaced) drop.add(i);
  }
  if (drop.size > 0) notes.push(`${drop.size} extra pool${drop.size === 1 ? "" : "s"} on the arrival side ${drop.size === 1 ? "was" : "were"} left out.`);
  return { ops: ops.filter((_, i) => !drop.has(i)), notes };
}

// ── Reading a finished project ──────────────────────────────────────────────

export interface PlacementReport {
  arrivalSide: string;
  viewSide: string;
  pools: { side: PropertySide; wall: string }[];
  garages: { side: PropertySide }[];
  issues: string[];
}

/**
 * Where the pools and garages of a finished project stand relative to its arrival and view sides, and what breaks the rule:
 * a pool on the arrival side (unless the brief asked), or a garage off it. Empty issues = the property reads correctly.
 */
export function describePlacement(projectJson: string | Rec, brief = ""): PlacementReport | null {
  let root: unknown;
  try {
    root = typeof projectJson === "string" ? JSON.parse(projectJson) : projectJson;
  } catch {
    return null;
  }
  if (!isRecord(root) || !isRecord(root.house) || !isRecord(root.site)) return null;
  const site = root.site as Rec;
  if (typeof site.viewDirection !== "string" || typeof site.approachSide !== "string") return null;
  const s = { viewDirection: site.viewDirection as WallSide, approachSide: site.approachSide as WallSide };
  const house: Shell = { width: num(root.house.width, 12), depth: num(root.house.depth, 9) };
  const list = (key: string) => (Array.isArray(root[key]) ? (root[key] as unknown[]).filter(isRecord) : []);

  const pools = list("pools").map((p) => ({ side: sideOfPoint(house, s, poolCentre(house, p)), wall: String(p.wall ?? "") }));
  const garages: { side: PropertySide }[] = [
    ...list("garages").map(() => ({ side: (s.approachSide === s.viewDirection ? "view" : "arrival") as PropertySide })),
    ...list("buildings").filter((b) => b.kind === "detached_garage").map((b) => ({ side: sideOfPoint(house, s, [num(b.x), num(b.z)]) })),
  ];
  const issues: string[] = [];
  const shared = s.approachSide === s.viewDirection;
  if (!briefAllowsFrontPool(brief)) {
    pools.forEach((p, i) => {
      if (p.side === "arrival") issues.push(`Pool ${i + 1} stands on the arrival side (${s.approachSide}).`);
    });
  }
  if (!shared) {
    garages.forEach((g, i) => {
      // A detached garage beside the drive can sit a little behind the entrance plane: only the far side of the house is wrong.
      if (g.side === "view" || g.side === "rear") issues.push(`Garage ${i + 1} stands on the ${g.side} side, away from the arrival.`);
    });
  }
  return { arrivalSide: s.approachSide, viewSide: s.viewDirection, pools, garages, issues };
}
