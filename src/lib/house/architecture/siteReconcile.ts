import type { PatchOp } from "../applyPatch";
import { groundRects, turnedRect, type Rect, type Vec } from "./siteGeometry";
import { APRON, arrivalPoint, insideZone, overlaps, placeInZone, reservedRects, type SitePlan, type SiteZone, type ZoneFeature } from "./sitePlan";

/**
 * Detached buildings and the site plan.
 *
 * A detached building can reach a generation from three places that know nothing of the plan: the style rules (a
 * cabin's shed, a villa's gazebo), the tier rules (an estate's gazebo and garage) and the model itself, which writes
 * its own coordinates. This module gives each kind its home zone and sets a building down in it, or judges whether
 * where a building already stands is somewhere the plan would have put it.
 */

type Rec = Record<string, unknown>;

/** The freestanding kinds the plan places. A wing is part of the house core and is never moved. */
export const DETACHED_KINDS: readonly string[] = ["gazebo", "outdoor_bar", "shed", "detached_garage", "villa", "restaurant", "reception"];

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const valueOf = (op: PatchOp): Rec => (isRecord(op.value) ? op.value : {});
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const round = (v: number) => Math.round(v * 10) / 10;
const yawTo = (face: Vec) => Math.round((Math.atan2(face[0], face[1]) * 180) / Math.PI);
const toward = (zone: SiteZone, along: Vec, by: number): Vec => [zone.center[0] + along[0] * by, zone.center[1] + along[1] * by];

interface Home {
  zone: SiteZone;
  feature: ZoneFeature;
  anchor?: Vec;
  /** Where the building's door turns, when it has a front; a building the plan does not turn keeps the rotation it has. */
  face?: Vec;
}

/** The zone that owns a kind of building, where in it the building wants to stand, and which way it faces. */
function homeOf(plan: SitePlan, kind: string, width: number, depth: number): Home | undefined {
  const z = plan.zones;
  switch (kind) {
    case "gazebo": return { zone: z.outdoorLiving!, feature: "gazebo", anchor: toward(z.outdoorLiving!, plan.viewAxis, 40) };
    case "outdoor_bar": return { zone: z.outdoorLiving!, feature: "outdoor_bar", anchor: z.poolGarden!.center, face: z.outdoorLiving!.orientation };
    case "shed": return { zone: z.service!, feature: "shed" };
    case "villa": case "restaurant": case "reception": return { zone: z.guest!, feature: "villa", anchor: toward(z.guest!, z.guest!.orientation, 4), face: z.guest!.orientation };
    case "detached_garage": {
      // Beside the drive at an apron's distance, as near the house as the court allows.
      const a = plan.arrival;
      const court = z.garageCourt!;
      const alongExtent = Math.abs(a.dir[0]) * court.footprint.w + Math.abs(a.dir[1]) * court.footprint.d;
      const near = (court.center[0] - a.origin[0]) * a.dir[0] + (court.center[1] - a.origin[1]) * a.dir[1] - alongExtent / 2;
      return { zone: court, feature: "detached_garage", anchor: arrivalPoint(a, near + width / 2 + 0.5, a.garageSide * (a.width / 2 + APRON + depth / 2)) };
    }
    default: return undefined;
  }
}

/** The ground rectangle a building takes, as the plan would set it: garages run their length along the drive. */
function planFootprint(plan: SitePlan, kind: string, width: number, depth: number, rotation: number | undefined, home: Home): { w: number; d: number; turn: number | undefined } {
  if (kind === "detached_garage") {
    // Rotation is left to the scale rules, which turn a garage's doors to the drive and join it to it with an apron.
    const runsX = Math.abs(plan.arrival.dir[0]) > 0.5;
    return { w: runsX ? width : depth, d: runsX ? depth : width, turn: undefined };
  }
  const turn = rotation ?? (home.face ? yawTo(home.face) : undefined);
  const r = turnedRect(0, 0, width, depth, turn ?? 0);
  return { w: round(r.w * 100) / 100, d: round(r.d * 100) / 100, turn };
}

/** The turn that faces a detached garage's doors across the drive, toward its centreline. */
export const garageTurn = (plan: SitePlan) => yawTo([-plan.arrival.across[0] * plan.arrival.garageSide, -plan.arrival.across[1] * plan.arrival.garageSide]);

export interface DetachedPlacement { x: number; z: number; rotation?: number; /** The ground the building takes there. */ rect: Rect }

/** Sets a `width` × `depth` building of `kind` down in its own zone; undefined when the zone cannot hold it. */
export function placeDetached(plan: SitePlan, kind: string, width: number, depth: number, rotation: number | undefined, taken: readonly Rect[]): DetachedPlacement | undefined {
  const home = homeOf(plan, kind, width, depth);
  if (!home) return undefined;
  const { w, d, turn } = planFootprint(plan, kind, width, depth, rotation, home);
  const at = placeInZone(plan, home.zone, home.feature, w, d, taken, { anchor: home.anchor });
  if (!at) return undefined;
  return { x: at.x, z: at.z, rect: at, ...(rotation === undefined && turn !== undefined && turn !== 0 ? { rotation: turn } : {}) };
}

/**
 * Whether a building already standing at a rectangle is somewhere the plan would accept: inside its own zone, or, when
 * the model put it elsewhere on purpose, clear of the reserved zones, the drive's corridor, what is already on the
 * ground and the zones it has no business beside.
 */
function standsWell(plan: SitePlan, kind: string, rect: Rect, taken: readonly Rect[]): boolean {
  const home = homeOf(plan, kind, rect.w, rect.d);
  if (!home) return true;
  if (taken.some((o) => overlaps(rect, o, 1))) return false;
  if (insideZone(home.zone, rect)) return true;
  if (reservedRects(plan, home.zone.kind).some((o) => overlaps(rect, o, 0.5))) return false;
  if (kind !== "detached_garage" && overlaps(rect, plan.arrival.corridor, 0.5)) return false;
  const apart = kind === "detached_garage" ? plan.zones.guest : plan.zones.garageCourt;
  return !(apart && overlaps(rect, apart.footprint, 0));
}

const isDetached = (op: PatchOp) => op.op === "addBuilding" && DETACHED_KINDS.includes(valueOf(op).kind as string);

/**
 * Brings every detached building of a generated design onto the plan. Buildings in `placeholders` (what the style rules
 * added at stand-in coordinates) are always set into their zone, or left out when it cannot hold them. A building the
 * model wrote is kept exactly where it stands if the plan accepts that, and otherwise moved into its zone; if the zone
 * cannot hold it either it stays put, for the collision pass to settle. Order, ids and everything but x, z and the
 * turn of a moved building are untouched, and the main house and its wings are never moved.
 */
export function reconcileDetached(plan: SitePlan, house: { width: number; depth: number }, ops: readonly PatchOp[], placeholders: ReadonlySet<PatchOp>): PatchOp[] {
  const next: (PatchOp | null)[] = [...ops];
  const taken = groundRects(house, ops.filter((op) => !isDetached(op)));
  const rectOf = (v: Rec) => turnedRect(num(v.x), num(v.z), num(v.width), num(v.depth), num(v.rotation));

  const pending: number[] = [];
  ops.forEach((op, i) => {
    if (!isDetached(op)) return;
    const v = valueOf(op);
    if (!placeholders.has(op) && standsWell(plan, v.kind as string, rectOf(v), taken)) taken.push(rectOf(v));
    else pending.push(i);
  });

  for (const i of pending) {
    const op = ops[i];
    const v = valueOf(op);
    const at = placeDetached(plan, v.kind as string, num(v.width), num(v.depth), typeof v.rotation === "number" ? v.rotation : undefined, taken);
    if (!at) {
      if (placeholders.has(op)) next[i] = null;
      else taken.push(rectOf(v));
      continue;
    }
    const { rect, ...fields } = at;
    next[i] = { ...op, value: { ...v, ...fields } };
    taken.push(rect);
  }
  return next.filter((op): op is PatchOp => op !== null);
}
