import type { CompassSide } from "@/types/house";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import { LEVEL_HEIGHT } from "@/lib/house/constants";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import { computeCourtyards } from "./compiler";
import type {
  FacadeTreatment, FootprintScope, MassFacade, MassGeometryOperation, MassOpening, MassRole, MassVolume, SiteStrategy, VolumePlan,
} from "./document";
import { volumePlanSchema } from "./stages/schemas";

/**
 * Plan → geometry. A `VolumePlan` is decided when a volume is placed; this module is the single place that
 * turns it into the existing articulated-geometry vocabulary (footprint operations, facade openings,
 * cantilever, capability intents) against the volume's FINAL orientation and neighbors. Deterministic and
 * AI-free: the Architectural Geometry Pass receives this realization as its baseline and may only refine it
 * (`conformToPlan`), and if that pass fails, this realization is what gets built — never a plain box.
 */

/** What a volume's role implies when the model left a plan field out. Deliberately different per role: a garage is not a quieter living pavilion. */
const ROLE_PLANS: Record<MassRole, VolumePlan> = {
  "main-living": { form: "bar", height: "standard", hierarchy: "dominant", viewFacade: "framed-glass", arrivalFacade: "solid", flankFacades: "shaded-glass", courtyardFacade: "glass-wall", entry: "canopied", outdoor: "covered-terrace", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  "bedroom-wing": { form: "bar", height: "standard", hierarchy: "supporting", viewFacade: "shaded-glass", arrivalFacade: "slot", flankFacades: "solid", courtyardFacade: "glass-wall", entry: "none", outdoor: "none", outdoorSide: "view", roofEdge: "thin-eave", structure: "bearing-walls" },
  "guest-pavilion": { form: "bar", height: "standard", hierarchy: "supporting", viewFacade: "glass-wall", arrivalFacade: "punched", flankFacades: "solid", courtyardFacade: "glass-wall", entry: "flush", outdoor: "veranda", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  garage: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "solid", arrivalFacade: "solid", flankFacades: "solid", entry: "flush", outdoor: "none", outdoorSide: "view", roofEdge: "parapet", structure: "bearing-walls" },
  service: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "punched", arrivalFacade: "punched", flankFacades: "solid", entry: "flush", outdoor: "none", outdoorSide: "view", roofEdge: "parapet", structure: "bearing-walls" },
  connector: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "glass-wall", arrivalFacade: "glass-wall", flankFacades: "solid", entry: "none", outdoor: "colonnade", outdoorSide: "view", roofEdge: "thin-eave", structure: "post-and-beam" },
  terrace: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "glass-wall", arrivalFacade: "solid", flankFacades: "solid", entry: "none", outdoor: "colonnade", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  veranda: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "glass-wall", arrivalFacade: "solid", flankFacades: "solid", entry: "none", outdoor: "colonnade", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  entry: { form: "bar", height: "lofty", hierarchy: "supporting", viewFacade: "glass-wall", arrivalFacade: "solid", flankFacades: "solid", entry: "canopied", outdoor: "none", outdoorSide: "view", roofEdge: "thin-eave", structure: "post-and-beam" },
};

/** Keeps only the individually valid fields of a raw model plan — an off-vocabulary value is dropped (and later defaulted from the role), never worth a repair retry. */
export function sanitizeVolumePlan(raw: unknown): Partial<VolumePlan> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(volumePlanSchema.shape)) {
    if (source[key] === undefined || source[key] === null) continue;
    const parsed = field.safeParse(source[key]);
    if (parsed.success && parsed.data !== undefined) out[key] = parsed.data;
  }
  return out as Partial<VolumePlan>;
}

export function completeVolumePlan(partial: Partial<VolumePlan> | undefined, role: MassRole): VolumePlan {
  const defined = Object.fromEntries(Object.entries(partial ?? {}).filter(([, v]) => v !== undefined)) as Partial<VolumePlan>;
  return { ...ROLE_PLANS[role], ...defined };
}

/** The total height a plan implies, or undefined for the standard `floors * LEVEL_HEIGHT`. Decided at placement so later volumes step against the real height. */
export function planHeight(plan: VolumePlan, floors: number): number | undefined {
  if (plan.height === "low") return round(floors * LEVEL_HEIGHT * 0.85);
  if (plan.height === "lofty") return round(floors * LEVEL_HEIGHT * 1.2);
  if (plan.height === "double-height") return round(floors === 1 ? LEVEL_HEIGHT * 1.8 : floors * LEVEL_HEIGHT * 1.2);
  return undefined;
}

/** Attaches a completed plan (and the height it implies) to a freshly placed mass. */
export function withVolumePlan(mass: MassVolume, rawPlan: unknown): MassVolume {
  const plan = completeVolumePlan(sanitizeVolumePlan(rawPlan), mass.role);
  const height = planHeight(plan, mass.floors);
  return { ...mass, plan, ...(height !== undefined ? { height } : {}) };
}

// ── Orientation ──────────────────────────────────────────────────────────────────────────────────────

const FACADES: readonly MassFacade[] = ["north", "east", "south", "west"];
const LOCAL_NORMAL: Record<MassFacade, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const SIDES: readonly CompassSide[] = ["north", "east", "south", "west"];

/** Same yaw convention as `rotatePrimitiveY`: local (x, z) → (x·cos + z·sin, −x·sin + z·cos). */
function worldNormal(facade: MassFacade, rotation: number): [number, number] {
  const [x, z] = LOCAL_NORMAL[facade];
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return [x * c + z * s, -x * s + z * c];
}

export function localFacadeToward(side: CompassSide, rotation: number): MassFacade {
  const [wx, wz] = SIDE_VECTOR[side];
  return FACADES.reduce((best, f) => { const [nx, nz] = worldNormal(f, rotation); const [bx, bz] = worldNormal(best, rotation); return nx * wx + nz * wz > bx * wx + bz * wz ? f : best; });
}

export function worldSideOf(facade: MassFacade, rotation: number): CompassSide {
  const [nx, nz] = worldNormal(facade, rotation);
  return SIDES.reduce((best, side) => { const [wx, wz] = SIDE_VECTOR[side]; const [bx, bz] = SIDE_VECTOR[best]; return nx * wx + nz * wz > nx * bx + nz * bz ? side : best; });
}

/** The facade-bound capability plugins (entry-canopy, brise-soleil, pilotis) place geometry from the unrotated footprint, so they are only emitted where that is exact: rotation ≈ 0 or π. */
const pluginAligned = (rotation: number) => Math.abs(Math.sin(rotation)) < 0.1;

const totalHeight = (m: MassVolume) => m.height ?? m.floors * LEVEL_HEIGHT;
const facadeLength = (f: MassFacade, m: { width: number; depth: number }) => (f === "north" || f === "south" ? m.width : m.depth);
/** The mass dimension perpendicular to a facade — how deep the volume is behind it. */
const depthBehind = (f: MassFacade, m: { width: number; depth: number }) => (f === "north" || f === "south" ? m.depth : m.width);
const perpendicular = (f: MassFacade): [MassFacade, MassFacade] => (f === "north" || f === "south" ? ["east", "west"] : ["south", "north"]);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round = (v: number) => Math.round(v * 100) / 100;

function worldExtent(m: MassVolume): { x0: number; x1: number; z0: number; z1: number } {
  const swap = Math.abs(Math.sin(m.rotation)) > 0.7;
  const hw = (swap ? m.depth : m.width) / 2, hd = (swap ? m.width : m.depth) / 2;
  return { x0: m.position.x - hw, x1: m.position.x + hw, z0: m.position.z - hd, z1: m.position.z + hd };
}

/** World sides where another volume stands against this one (≤ 0.6m gap, overlapping in plan and height) — a shared wall, never a facade to glaze or open. */
function partySides(mass: MassVolume, masses: readonly MassVolume[]): Set<CompassSide> {
  const a = worldExtent(mass);
  const sides = new Set<CompassSide>();
  for (const other of masses) {
    if (other.id === mass.id) continue;
    const verticalOverlap = mass.elevation < other.elevation + totalHeight(other) - 0.1 && other.elevation < mass.elevation + totalHeight(mass) - 0.1;
    if (!verticalOverlap) continue;
    const b = worldExtent(other);
    const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const overlapZ = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
    const GAP = 0.6, MIN_SHARED = 0.5;
    if (overlapZ > MIN_SHARED && Math.abs(b.x0 - a.x1) <= GAP) sides.add("east");
    if (overlapZ > MIN_SHARED && Math.abs(a.x0 - b.x1) <= GAP) sides.add("west");
    if (overlapX > MIN_SHARED && Math.abs(b.z0 - a.z1) <= GAP) sides.add("south");
    if (overlapX > MIN_SHARED && Math.abs(a.z0 - b.z1) <= GAP) sides.add("north");
  }
  return sides;
}

export interface PlanFacades {
  view: MassFacade; arrival: MassFacade; courtyard?: MassFacade;
  /** Facades standing against a neighboring volume: always solid, never opened. */
  party: ReadonlySet<MassFacade>;
  /** The side a corner move (l-shape notch, prow) or a flank outdoor room turns toward: perpendicular to the view, away from arrival and neighbors. */
  freeSide: MassFacade;
}

/** Resolves what each local facade of a placed mass actually faces. */
export function resolvePlanFacades(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): PlanFacades {
  const view = localFacadeToward(site.viewDirection, mass.rotation);
  const arrival = localFacadeToward(site.arrivalDirection, mass.rotation);
  const party = new Set([...partySides(mass, masses)].map((side) => localFacadeToward(side, mass.rotation)));
  let courtyard: MassFacade | undefined;
  const court = computeCourtyards(masses).find((c) => c.enclosingMassIds.includes(mass.id));
  const anchor = court && masses.find((m) => m.id === court.anchorMassId);
  if (anchor) {
    const dx = anchor.position.x - mass.position.x, dz = anchor.position.z - mass.position.z;
    const side: CompassSide = Math.abs(dx) >= Math.abs(dz) ? (dx >= 0 ? "east" : "west") : (dz >= 0 ? "south" : "north");
    courtyard = localFacadeToward(side, mass.rotation);
  }
  const score = (f: MassFacade) => (party.has(f) ? 4 : 0) + (f === arrival ? 2 : 0) + (f === courtyard ? 1 : 0);
  const [a, b] = perpendicular(view);
  const freeSide = score(b) < score(a) ? b : a;
  return { view, arrival, courtyard, party, freeSide };
}

/** Priority where two roles land on one facade: view > courtyard > arrival > flank; a party wall overrides everything. */
export function treatmentFor(facade: MassFacade, plan: VolumePlan, facades: PlanFacades): FacadeTreatment {
  if (facades.party.has(facade)) return "solid";
  if (facade === facades.view) return plan.viewFacade;
  if (facade === facades.courtyard) return plan.courtyardFacade ?? plan.viewFacade;
  if (facade === facades.arrival) return plan.arrivalFacade;
  return plan.flankFacades;
}

const GLASS_TREATMENTS = new Set<FacadeTreatment>(["glass-wall", "framed-glass", "shaded-glass", "ribbon", "fin-screened", "screened"]);
const cornerOf = (a: MassFacade, b: MassFacade) => {
  const ns = a === "north" || a === "south" ? a : b;
  const ew = a === "east" || a === "west" ? a : b;
  return `${ns[0]}${ew[0]}` as "nw" | "ne" | "se" | "sw";
};
/** Which end (compass u: 0 = west/north, 1 = east/south) of `facade` touches the perpendicular facade `toward`. */
const endToward = (toward: MassFacade): 0 | 1 => (toward === "east" || toward === "south" ? 1 : 0);
const oppositeFacade = (facade: MassFacade): MassFacade => ({ north: "south", south: "north", east: "west", west: "east" } as const)[facade];

/** A shared wall is unavailable, but it must not erase a required architectural move. */
function firstFreeFacade(facades: PlanFacades, candidates: readonly (MassFacade | undefined)[]): MassFacade | undefined {
  return candidates.find((facade): facade is MassFacade => facade !== undefined && !facades.party.has(facade));
}

// ── Screens and privacy ──────────────────────────────────────────────────────────────────────────────

const PRIVATE_ROLES = new Set<MassRole>(["bedroom-wing", "guest-pavilion"]);
/** Sill above standing eye height: light and air without a view into the room from the drive. */
const PRIVATE_SILL = 1.6;

/** A screen-layer intent covering the glazing already on `facade`; undefined when there is no glazing to screen. */
function screenIntent(mass: MassVolume, facade: MassFacade, openings: readonly MassOpening[]): CapabilityIntent | undefined {
  const zones = openings.filter((o) => o.facade === facade && o.type === "glazing-zone") as Extract<MassOpening, { type: "glazing-zone" }>[];
  if (!zones.length) return undefined;
  return { id: "screen-layer", stage: "architectural-geometry", parameters: {
    massId: mass.id, facade: worldSideOf(facade, mass.rotation),
    start: round(Math.max(0, Math.min(...zones.map((z) => Math.min(z.start, z.end))) - 0.02)), end: round(Math.min(1, Math.max(...zones.map((z) => Math.max(z.start, z.end))) + 0.02)),
    depth: 0.5, height: round(totalHeight(mass) - 0.25),
  } };
}

/**
 * A bedroom or guest volume never shows its rooms to the drive: punched/slot windows on its arrival facade
 * are lifted to a high sill, and glazing the plan put there is kept but screened. The design's own treatment
 * (how much glass, where) is unchanged — only how exposed it is.
 */
function applyArrivalPrivacy(mass: MassVolume, facades: PlanFacades, openings: readonly MassOpening[], existing: readonly CapabilityIntent[]): { openings: MassOpening[]; capabilityIntents: CapabilityIntent[]; notes: string[] } {
  const facade = facades.arrival;
  if (!PRIVATE_ROLES.has(mass.role) || facade === facades.view || facade === facades.courtyard || facades.party.has(facade)) return { openings: [...openings], capabilityIntents: [], notes: [] };
  const wallHeight = totalHeight(mass) / mass.floors - 0.2;
  const notes: string[] = [];
  const out = openings.map((o) => {
    if (o.facade !== facade || o.type !== "opening-rhythm" || o.sill >= PRIVATE_SILL) return o;
    notes.push(`${o.type} on the ${facade} arrival facade lifted to a ${PRIVATE_SILL}m privacy sill.`);
    return { ...o, sill: PRIVATE_SILL, height: round(clamp(wallHeight - PRIVATE_SILL - 0.25, 0.5, Math.min(o.height, 0.9))) };
  });
  const side = worldSideOf(facade, mass.rotation);
  const screened = existing.some((i) => (i.id === "screen-layer" || i.id === "brise-soleil") && i.parameters?.massId === mass.id && i.parameters?.facade === side);
  const screen = screened ? undefined : screenIntent(mass, facade, out);
  if (screen) notes.push(`glazing on the ${facade} arrival facade screened for privacy.`);
  return { openings: out, capabilityIntents: screen ? [screen] : [], notes };
}

/** Privacy applied to an already-authored opening set (the Geometry Pass's refinement), with the intents it needs. */
export function arrivalPrivacyFor(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, openings: readonly MassOpening[], existing: readonly CapabilityIntent[]) {
  return applyArrivalPrivacy(mass, resolvePlanFacades(mass, masses, site), openings, existing);
}

// ── Realization ──────────────────────────────────────────────────────────────────────────────────────

export interface PlanRealization {
  operations: MassGeometryOperation[];
  openings: MassOpening[];
  capabilityIntents: CapabilityIntent[];
  cantilever?: MassVolume["cantilever"];
  /** Where a plan item could not be realized as asked and what was built instead — diagnostics, never errors. */
  notes: string[];
}

interface Interval { start: number; end: number }

/** The facade span (compass u) an opening-rhythm actually occupies, mirroring `openingBands` in openings.ts. */
function rhythmSpan(count: number, width: number, len: number): Interval {
  const widthU = Math.min(1, width / len);
  const span = Math.min(1, count * widthU + (count - 1) * widthU * 0.4);
  return { start: (1 - span) / 2, end: (1 + span) / 2 };
}

function facadeOpenings(facade: MassFacade, treatment: FacadeTreatment, mass: MassVolume, plan: VolumePlan, avoid: Interval | undefined): MassOpening[] {
  const len = facadeLength(facade, mass);
  const levelHeight = totalHeight(mass) / mass.floors;
  const frame = plan.structure === "post-and-beam" || treatment === "framed-glass";
  let range: Interval = { start: 0.08, end: 0.92 };
  if (avoid) {
    const before = { start: 0.06, end: avoid.start - 0.04 }, after = { start: avoid.end + 0.04, end: 0.94 };
    range = before.end - before.start >= after.end - after.start ? before : after;
    if (range.end - range.start < 0.15) return [];
  }
  const zone = (heightRatio: number, extra: { reveal?: number } = {}): MassOpening => ({
    type: "glazing-zone", facade, start: round(range.start), end: round(range.end), heightRatio, ...(frame ? { frame: true } : {}), ...extra,
  });
  switch (treatment) {
    case "glass-wall": return [zone(0.88)];
    case "screened": return [zone(0.88)];
    case "framed-glass": return [zone(0.9)];
    case "shaded-glass": return [zone(0.8, { reveal: 0.45 })];
    case "fin-screened": return [zone(0.62, { reveal: 0.25 })];
    case "ribbon": return [{ type: "glazing-zone", facade, start: round(Math.max(range.start, 0.06)), end: round(Math.min(range.end, 0.94)), heightRatio: 0.38, reveal: 0.12 }];
    case "punched": return [{ type: "opening-rhythm", facade, count: clamp(Math.round(len / 2.8), 2, 6), width: 1.1, height: 1.4, sill: 0.9 }];
    case "slot": return [{ type: "opening-rhythm", facade, count: clamp(Math.round(len / 2), 2, 6), width: 0.6, height: round(clamp(levelHeight - 0.8, 1.4, 2.4)), sill: 0.3 }];
    default: return [];
  }
}

/** Places a centered door among a facade's other openings without overlapping them — splitting a glazing zone around it, or sliding it clear of a window rhythm. */
function placeDoor(openings: MassOpening[], facade: MassFacade, mass: MassVolume, door: { width: number; height: number; frame: boolean }): MassOpening[] {
  const len = facadeLength(facade, mass);
  const du = Math.min(0.9, door.width / len);
  let slot: Interval = { start: 0.5 - du / 2, end: 0.5 + du / 2 };
  const out: MassOpening[] = [];
  for (const op of openings) {
    if (op.facade !== facade) { out.push(op); continue; }
    if (op.type === "glazing-zone" && op.start < slot.end && op.end > slot.start) {
      if (slot.start - 0.05 - op.start > 0.08) out.push({ ...op, end: round(slot.start - 0.05) });
      if (op.end - (slot.end + 0.05) > 0.08) out.push({ ...op, start: round(slot.end + 0.05) });
      continue;
    }
    if (op.type === "opening-rhythm") {
      let count = op.count;
      while (count >= 2) {
        const span = rhythmSpan(count, op.width, len);
        if (span.start - 0.04 >= du + 0.04) { slot = { start: span.start - 0.04 - du, end: span.start - 0.04 }; break; }
        count--;
      }
      if (count >= 2) out.push({ ...op, count });
      continue;
    }
    out.push(op);
  }
  out.push({ type: "door", facade, start: round(slot.start), end: round(slot.end), height: door.height, ...(door.frame ? { frame: true } : {}) });
  return out;
}

export function realizeVolumePlan(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, planOverride?: VolumePlan): PlanRealization {
  const plan = planOverride ?? mass.plan ?? completeVolumePlan(undefined, mass.role);
  const facades = resolvePlanFacades(mass, masses, site);
  const operations: MassGeometryOperation[] = [];
  const capabilityIntents: CapabilityIntent[] = [];
  const notes: string[] = [];
  const multiStorey = mass.floors >= 2;
  const aligned = pluginAligned(mass.rotation);
  const levelHeight = totalHeight(mass) / mass.floors;
  const minDim = Math.min(mass.width, mass.depth);
  const formFacade = firstFreeFacade(facades, [facades.view, facades.courtyard, facades.freeSide, oppositeFacade(facades.view)]);
  const formCompanion = formFacade === facades.freeSide ? oppositeFacade(facades.view) : facades.freeSide;
  const featureCorner = cornerOf(formFacade ?? facades.view, formCompanion);
  /** The span of each facade a footprint move already claims, so openings and later moves go around it. */
  const claimed: Partial<Record<MassFacade, Interval>> = {};

  // 1. Form — the footprint itself, before anything is applied to its facades.
  if (plan.form === "l-shape") {
    if (minDim < 6) notes.push(`l-shape needs a volume at least 6m deep (this one is ${minDim.toFixed(1)}m) — kept as a bar.`);
    else if (!formFacade) notes.push("l-shape has no exterior edge to carve — kept as a bar.");
    else {
      if (formFacade !== facades.view) notes.push(`l-shape turned from the shared ${facades.view} facade onto the ${formFacade} exterior facade.`);
      const alongView = round(clamp(0.4 * facadeLength(formFacade, mass), 2.5, Math.min(8, 0.5 * facadeLength(formFacade, mass))));
      const alongSide = round(clamp(0.45 * facadeLength(formCompanion, mass), 2, Math.min(7, 0.5 * facadeLength(formCompanion, mass))));
      const viewIsNS = formFacade === "north" || formFacade === "south";
      operations.push({ type: "notch", corner: featureCorner, width: viewIsNS ? alongView : alongSide, depth: viewIsNS ? alongSide : alongView });
    }
  } else if (plan.form === "prow") {
    if (minDim < 4) notes.push("prow needs a volume at least 4m deep — kept as a bar.");
    else if (!formFacade) notes.push("prow has no exterior corner to express — kept as a bar.");
    else {
      if (formFacade !== facades.view) notes.push(`prow turned from the shared ${facades.view} facade onto the ${formFacade} exterior facade.`);
      operations.push({ type: "chamfer", corner: featureCorner, size: round(clamp(0.3 * minDim, 1.5, 5)), ...(GLASS_TREATMENTS.has(treatmentFor(formFacade, plan, facades)) ? { glazed: true } : {}) });
    }
  } else if (plan.form === "setback") {
    if (!multiStorey) notes.push("setback needs 2+ floors — kept as a bar.");
    else {
      const end = endToward(facades.freeSide);
      const span: Interval = end === 1 ? { start: 0.5, end: 0.94 } : { start: 0.06, end: 0.5 };
      operations.push({ type: "recess", facade: facades.view, ...span, depth: round(clamp(0.3 * depthBehind(facades.view, mass), 1.5, 3.5)), floors: "upper" });
    }
  }
  const featureEndOnView = plan.form === "l-shape" || plan.form === "prow" ? endToward(facades.freeSide) : undefined;

  // 2. Outdoor transition — a covered room carved from / added to the footprint on the planned side.
  const outdoorFacade = ((): MassFacade | undefined => {
    if (plan.outdoor === "none") return undefined;
    const wanted = plan.outdoorSide === "courtyard" ? (facades.courtyard ?? facades.view) : plan.outdoorSide === "arrival" ? facades.arrival : plan.outdoorSide === "flank" ? facades.freeSide : facades.view;
    const adapted = firstFreeFacade(facades, [wanted, facades.view, facades.courtyard, facades.freeSide, oppositeFacade(wanted)]);
    if (adapted && adapted !== wanted) notes.push(`${plan.outdoor} moved from the shared ${wanted} facade to the ${adapted} exterior facade.`);
    if (!adapted) notes.push(`${plan.outdoor} has no exterior edge available.`);
    return adapted;
  })();
  if (outdoorFacade) {
    const behind = depthBehind(outdoorFacade, mass);
    const posts = plan.outdoor === "colonnade" || plan.structure === "post-and-beam" ? { postSpacing: plan.outdoor === "colonnade" ? 2.4 : 2.6 } : {};
    const floors: FootprintScope | undefined = multiStorey ? "ground" : undefined;
    let span: Interval = { start: 0.06, end: 0.94 };
    let depth = round(clamp(0.22 * behind, 1.8, 2.8));
    if (plan.outdoor === "colonnade") depth = round(clamp(0.2 * behind, 1.6, 2.4));
    if (plan.outdoor === "covered-terrace") {
      depth = round(clamp(0.3 * behind, 2.4, 3.6));
      const featureEnd = outdoorFacade === facades.view ? featureEndOnView : undefined;
      span = facadeLength(outdoorFacade, mass) * 0.4 < 3 ? { start: 0.1, end: 0.9 } : featureEnd === 0 ? { start: 0.55, end: 0.95 } : { start: 0.05, end: 0.45 };
    }
    operations.push({ type: "projection", facade: outdoorFacade, ...span, depth, open: true, ...posts, ...(floors ? { floors } : {}) });
    claimed[outdoorFacade] = span;
  }

  // 3. Entry — how the arrival side is entered; skipped where the outdoor room already is the way in.
  const entryFacade = firstFreeFacade(facades, [facades.arrival, facades.freeSide, oppositeFacade(facades.arrival), facades.view]);
  if (plan.entry !== "none" && entryFacade && entryFacade !== facades.arrival) notes.push(`entry moved from the shared ${facades.arrival} facade to the ${entryFacade} exterior facade.`);
  if (plan.entry !== "none" && !entryFacade) notes.push("entry has no exterior facade available.");
  const entryThroughOutdoor = plan.entry !== "none" && entryFacade !== undefined && entryFacade === outdoorFacade;
  if (entryThroughOutdoor) notes.push(`entered through the ${plan.outdoor} on the arrival side instead of a separate ${plan.entry} entry.`);
  const entryActive = plan.entry !== "none" && entryFacade !== undefined && !entryThroughOutdoor;
  let recessWidth: number | undefined;
  if (entryActive && (plan.entry === "recessed" || plan.entry === "canopied")) {
    const len = facadeLength(entryFacade!, mass);
    const width = round(clamp(0.22 * len, 2.4, Math.min(4, len * 0.6)));
    recessWidth = width;
    operations.push({ type: "entry-recess", facade: entryFacade!, width, depth: round(clamp(0.12 * depthBehind(entryFacade!, mass), 1.1, 1.6)) });
    if (plan.entry === "canopied") {
      if (aligned) capabilityIntents.push({ id: "entry-canopy", stage: "architectural-geometry", parameters: { massId: mass.id, facade: worldSideOf(entryFacade!, mass.rotation), width: round(width + 0.8), depth: 2, height: round(Math.min(2.9, levelHeight - 0.2)) } });
      else notes.push("entry canopy skipped on a rotated volume — kept the recessed entry.");
    }
  }

  // 4. Facades — each side's treatment from what it faces, going around the moves above.
  let openings: MassOpening[] = [];
  for (const facade of FACADES) openings.push(...facadeOpenings(facade, treatmentFor(facade, plan, facades), mass, plan, claimed[facade]));
  if (mass.role === "main-living" && !openings.some((opening) => opening.type === "glazing-zone" && opening.heightRatio >= .65)) {
    const glazedFacade = firstFreeFacade(facades, [facades.view, facades.courtyard, facades.freeSide, oppositeFacade(facades.arrival)]);
    if (glazedFacade) {
      const treatment = GLASS_TREATMENTS.has(plan.viewFacade) ? plan.viewFacade : "framed-glass";
      const fallback = facadeOpenings(glazedFacade, treatment, mass, plan, claimed[glazedFacade]);
      if (fallback.length) {
        openings.push(...fallback);
        notes.push(`substantial living glazing adapted onto the ${glazedFacade} exterior facade.`);
      }
    }
  }
  // A recessed/canopied entry is still entered through a door: centred on the recess, so the compiler builds it in the recess's back wall.
  if (entryActive && recessWidth !== undefined) {
    openings = placeDoor(openings, entryFacade!, mass, { width: round(Math.min(1.8, recessWidth - 0.6)), height: round(Math.min(2.4, levelHeight - 0.3)), frame: true });
  }
  if (entryActive && plan.entry === "flush") {
    const garage = mass.role === "garage";
    const len = facadeLength(entryFacade!, mass);
    openings = placeDoor(openings, entryFacade!, mass, garage ? { width: clamp(0.76 * len, 2.6, 6.5), height: 2.5, frame: false } : { width: 1.8, height: 2.4, frame: true });
  }

  // 5. Structure — how the volume stands up, expressed rather than hidden.
  let cantilever: PlanRealization["cantilever"];
  if (plan.structure === "cantilever") {
    if (multiStorey && !facades.party.has(facades.view)) cantilever = { direction: worldSideOf(facades.view, mass.rotation), distance: round(clamp(0.2 * depthBehind(facades.view, mass), 1.2, 3)) };
    else if (mass.elevation > 0.3 && aligned) capabilityIntents.push({ id: "pilotis", stage: "architectural-geometry", parameters: { massId: mass.id, columnSize: 0.3, inset: 0.5 } });
    else notes.push("cantilever needs 2+ floors or a raised volume — built as bearing walls.");
  } else if (plan.structure === "pilotis") {
    if (mass.elevation > 0.3 && aligned) capabilityIntents.push({ id: "pilotis", stage: "architectural-geometry", parameters: { massId: mass.id, columnSize: 0.3, inset: 0.5 } });
    else notes.push(mass.elevation > 0.3 ? "pilotis skipped on a rotated volume." : "pilotis needs a raised volume (stepped above grade) — built as bearing walls.");
  }

  // 6. Sun fins — one screen per volume, on the most important fin-screened facade; any other fin-screened
  // facade (or one the plugin can't build exactly) gets deep glazing reveals, the same shading intent in wall depth.
  const finned = [facades.view, facades.courtyard, facades.arrival, ...FACADES].filter((f, i, all): f is MassFacade => f !== undefined && all.indexOf(f) === i && treatmentFor(f, plan, facades) === "fin-screened");
  finned.forEach((facade, i) => {
    if (i === 0 && aligned && !claimed[facade]) {
      capabilityIntents.push({ id: "brise-soleil", stage: "architectural-geometry", parameters: { massId: mass.id, facade: worldSideOf(facade, mass.rotation), count: clamp(Math.round(facadeLength(facade, mass) / 0.9), 5, 16), depth: 0.5, height: round(totalHeight(mass) - 0.4), sill: 0.3 } });
      return;
    }
    // A rotated volume can't take the axis-aligned fins, but the screen layer follows its rotation.
    if (i === 0 && !aligned && !claimed[facade]) {
      const screen = screenIntent(mass, facade, openings);
      if (screen) { capabilityIntents.push(screen); notes.push(`sun fins on the rotated ${facade} facade built as a screen layer.`); return; }
    }
    notes.push(`sun fins on the ${facade} facade built as deep glazing reveals (${i > 0 ? "one fin screen per volume" : !aligned ? "rotated volume" : "an outdoor room stands in front of it"}).`);
    openings = openings.map((o) => (o.type === "glazing-zone" && o.facade === facade ? { ...o, reveal: 0.8 } : o));
  });

  // 7. Screens — every facade planned "screened" gets a real screen layer over its glazing.
  for (const facade of FACADES) {
    if (treatmentFor(facade, plan, facades) !== "screened") continue;
    const screen = screenIntent(mass, facade, openings);
    if (screen) capabilityIntents.push(screen);
  }

  // 8. Privacy — a bedroom/guest volume's arrival side.
  const privacy = applyArrivalPrivacy(mass, facades, openings, capabilityIntents);
  openings = privacy.openings;
  capabilityIntents.push(...privacy.capabilityIntents);
  notes.push(...privacy.notes);

  return { operations, openings, capabilityIntents, ...(cantilever ? { cantilever } : {}), notes };
}

// ── Conformance ──────────────────────────────────────────────────────────────────────────────────────

/** Identity of a plan element, so a model's refinement can replace the baseline's version of it without duplicating it. */
function opKey(op: MassGeometryOperation): string {
  if (op.type === "notch" || op.type === "chamfer") return `corner:${op.corner}`;
  if (op.type === "entry-recess") return `entry:${op.facade}`;
  if (op.open) return `open:${op.facade}`;
  return `${op.type}:${op.facade}:${op.floors ?? "all"}`;
}
function openingKey(op: MassOpening): string { return `${op.facade}:${op.type === "glazing-zone" ? "glass" : op.type === "door" ? "door" : "rhythm"}`; }

function opInterval(op: MassGeometryOperation, mass: MassVolume): (Interval & { facade: MassFacade; floors: FootprintScope }) | undefined {
  if (op.type === "notch" || op.type === "chamfer") return undefined;
  if (op.type === "entry-recess") { const len = facadeLength(op.facade, mass); const half = Math.min(op.width, len) / 2 / len; return { facade: op.facade, start: 0.5 - half, end: 0.5 + half, floors: op.floors ?? "all" }; }
  return { facade: op.facade, start: Math.min(op.start, op.end), end: Math.max(op.start, op.end), floors: op.floors ?? "all" };
}
const floorsIntersect = (a: FootprintScope, b: FootprintScope) => a === "all" || b === "all" || a === b;
/** True when two footprint operations would claim the same corner, or overlapping spans of one facade on a shared floor. */
export function conflicts(a: MassGeometryOperation, b: MassGeometryOperation, mass: MassVolume): boolean {
  if ((a.type === "notch" || a.type === "chamfer") && (b.type === "notch" || b.type === "chamfer")) return a.corner === b.corner;
  const ia = opInterval(a, mass), ib = opInterval(b, mass);
  return !!ia && !!ib && ia.facade === ib.facade && floorsIntersect(ia.floors, ib.floors) && ia.start < ib.end && ib.start < ia.end;
}

/**
 * Merges the Geometry Pass's proposal with the plan's baseline realization, the plan always winning:
 * proposed moves that contradict the plan are dropped (glazing on a facade planned solid, a corner cut the
 * form doesn't have, anything on a shared wall); every plan element the proposal failed to realize is
 * added from the baseline, displacing any proposed move it would collide with.
 */
export function conformToPlan(
  mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, baseline: PlanRealization,
  proposed: { operations: readonly MassGeometryOperation[]; openings: readonly MassOpening[] },
): { operations: MassGeometryOperation[]; openings: MassOpening[]; notes: string[] } {
  const plan = mass.plan ?? completeVolumePlan(undefined, mass.role);
  const facades = resolvePlanFacades(mass, masses, site);
  const notes: string[] = [];
  const baselineOpKeys = new Set(baseline.operations.map(opKey));
  const baselineOpeningKeys = new Set(baseline.openings.map(openingKey));
  const glazedProw = baseline.operations.some((op) => op.type === "chamfer" && op.glazed);

  const operations: MassGeometryOperation[] = [];
  for (const op of proposed.operations) {
    const facade = op.type === "notch" || op.type === "chamfer" ? undefined : op.facade;
    const key = opKey(op);
    const planOwned = key.startsWith("corner:") || key.startsWith("entry:") || key.startsWith("open:");
    if (facade && facades.party.has(facade)) { notes.push(`dropped ${op.type} on the ${facade} shared wall.`); continue; }
    if (planOwned && !baselineOpKeys.has(key)) { notes.push(`dropped ${op.type} (${key}) — not part of this volume's ${plan.form}/${plan.entry}/${plan.outdoor} plan.`); continue; }
    operations.push(op.type === "chamfer" ? { ...op, ...(glazedProw ? { glazed: true } : {}) } : op);
  }
  const proposedOpKeys = new Set(operations.map(opKey));
  for (const op of baseline.operations) {
    if (proposedOpKeys.has(opKey(op))) continue;
    for (let i = operations.length - 1; i >= 0; i--) {
      if (conflicts(op, operations[i], mass)) { notes.push(`dropped proposed ${operations[i].type} on ${"facade" in operations[i] ? (operations[i] as { facade: string }).facade : "a corner"} — it collides with the planned ${op.type}.`); operations.splice(i, 1); }
    }
    operations.push(op);
  }

  const openings: MassOpening[] = [];
  for (const op of proposed.openings) {
    const treatment = treatmentFor(op.facade, plan, facades);
    const isEntryDoor = op.type === "door" && baselineOpeningKeys.has(openingKey(op));
    if (treatment === "solid" && !isEntryDoor) { notes.push(`dropped ${op.type} on the ${op.facade} facade — planned solid.`); continue; }
    if (op.type === "glazing-zone" && (treatment === "punched" || treatment === "slot")) { notes.push(`dropped glazing-zone on the ${op.facade} facade — planned as ${treatment} windows.`); continue; }
    if (op.type === "opening-rhythm" && (treatment === "glass-wall" || treatment === "framed-glass")) { notes.push(`dropped opening-rhythm on the ${op.facade} facade — planned as ${treatment}.`); continue; }
    openings.push(op.type === "glazing-zone" && plan.structure === "post-and-beam" && GLASS_TREATMENTS.has(treatment) && treatment !== "ribbon" ? { ...op, frame: true } : op);
  }
  const proposedOpeningKeys = new Set(openings.map(openingKey));
  let merged = [...openings];
  for (const op of baseline.openings) {
    if (proposedOpeningKeys.has(openingKey(op))) continue;
    // A restored door is re-placed around the FINAL openings on its facade, which may no longer be the baseline's.
    if (op.type === "door") merged = placeDoor(merged, op.facade, mass, { width: (op.end - op.start) * facadeLength(op.facade, mass), height: op.height ?? 2.4, frame: op.frame === true });
    else merged.push(op);
  }

  return { operations, openings: merged, notes };
}

/**
 * Which of a volume's plan elements the built document is actually missing — the quality gate's view of plan
 * fidelity. Compares against a fresh baseline realization by the same element identity `conformToPlan` uses.
 */
export function planConformance(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): { missing: string[]; notes: string[] } {
  const baseline = realizeVolumePlan(mass, masses, site);
  const opKeys = new Set((mass.operations ?? []).map(opKey));
  const openingKeys = new Set((mass.openings ?? []).map(openingKey));
  const missing = [
    ...baseline.operations.filter((op) => !opKeys.has(opKey(op))).map((op) => `${op.type} (${opKey(op)})`),
    ...baseline.openings.filter((op) => !openingKeys.has(openingKey(op))).map((op) => `${op.type} on ${op.facade}`),
    ...(baseline.cantilever && !mass.cantilever ? ["cantilever"] : []),
  ];
  return { missing, notes: baseline.notes };
}

/** One-line plan summary with local facades resolved — what the Geometry Pass (and later volumes) read. */
export function describeVolumePlan(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): string {
  const plan = mass.plan ?? completeVolumePlan(undefined, mass.role);
  const f = resolvePlanFacades(mass, masses, site);
  const outdoor = plan.outdoor === "none" ? "no outdoor room" : `${plan.outdoor} on the ${plan.outdoorSide} side`;
  const flanks = FACADES.filter((x) => x !== f.view && x !== f.arrival && x !== f.courtyard);
  return [
    `form ${plan.form}, ${plan.height} height, ${plan.hierarchy}`,
    `view facade (local ${f.view}): ${treatmentFor(f.view, plan, f)}`,
    f.courtyard ? `courtyard facade (local ${f.courtyard}): ${treatmentFor(f.courtyard, plan, f)}` : "",
    f.arrival !== f.view ? `arrival facade (local ${f.arrival}): ${treatmentFor(f.arrival, plan, f)}, ${plan.entry} entry` : `${plan.entry} entry on the view facade`,
    flanks.length ? `flanks (local ${flanks.join("/")}): ${plan.flankFacades}` : "",
    f.party.size ? `shared walls (keep solid): local ${[...f.party].join("/")}` : "",
    outdoor, `structure ${plan.structure}`, `roof edge ${plan.roofEdge}`,
  ].filter(Boolean).join("; ");
}

/**
 * The local corner corner-glazing should wrap: the view facade (or, if that is a shared wall, the next open
 * face) turning onto its free flank — skipping a corner the footprint already notched or chamfered away.
 */
export function viewCorner(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): "nw" | "ne" | "se" | "sw" {
  const f = resolvePlanFacades(mass, masses, site);
  const main = firstFreeFacade(f, [f.view, f.courtyard, f.freeSide]) ?? f.view;
  const [a, b] = perpendicular(main);
  const flanks = [f.freeSide, a, b].filter((x) => x !== main && x !== oppositeFacade(main));
  const cut = new Set((mass.operations ?? []).flatMap((op) => (op.type === "notch" || op.type === "chamfer" ? [op.corner] : [])));
  const candidates = [...flanks.filter((x) => !f.party.has(x)), ...flanks].map((flank) => cornerOf(main, flank));
  return candidates.find((c) => !cut.has(c)) ?? candidates[0];
}

/**
 * A capability requested by name alone (`requestedOperation`) carries only `{ massId }`, but the facade-bound
 * plugins refuse to build without a facade. Fill it from the volume's plan orientation — arrival for an
 * entry canopy, the view for sun fins — instead of emitting an intent that is guaranteed to fail.
 */
export function parameterizeCapabilityIntent(intent: CapabilityIntent, masses: readonly MassVolume[], site: SiteStrategy): CapabilityIntent {
  const mass = masses.find((m) => m.id === intent.parameters?.massId);
  if (mass && intent.id === "corner-glazing" && typeof intent.parameters?.corner !== "string") return { ...intent, parameters: { ...intent.parameters, corner: viewCorner(mass, masses, site) } };
  if (!mass || typeof intent.parameters?.facade === "string") return intent;
  const f = resolvePlanFacades(mass, masses, site);
  if (intent.id === "entry-canopy") return { ...intent, parameters: { ...intent.parameters, facade: worldSideOf(f.arrival, mass.rotation) } };
  if (intent.id === "brise-soleil" || intent.id === "screen-layer") return { ...intent, parameters: { ...intent.parameters, facade: worldSideOf(f.view, mass.rotation) } };
  return intent;
}

/** One intent per (capability, mass): the most fully parameterized wins, so a plan-derived canopy isn't duplicated by a bare by-name request for the same thing. */
export function mergeCapabilityIntents(intents: readonly CapabilityIntent[]): CapabilityIntent[] {
  const byKey = new Map<string, CapabilityIntent>();
  for (const intent of intents) {
    // A volume can carry a screen on more than one facade; every other capability is one per mass (or mass pair).
    const key = `${intent.id}:${String(intent.parameters?.massId ?? "")}:${String(intent.parameters?.secondaryMassId ?? "")}${intent.id === "screen-layer" ? `:${String(intent.parameters?.facade ?? "")}` : ""}`;
    const existing = byKey.get(key);
    if (!existing || Object.keys(intent.parameters ?? {}).length > Object.keys(existing.parameters ?? {}).length) byKey.set(key, intent);
  }
  return [...byKey.values()];
}
