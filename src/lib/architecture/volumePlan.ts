import type { CompassSide } from "@/types/house";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import { LEVEL_HEIGHT } from "@/lib/house/constants";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import { computeCourtyards } from "./compiler";
import type {
  FacadeTreatment, FootprintScope, MassFacade, MassGeometryOperation, MassOpening, MassVolume, SiteStrategy, VolumePlan,
} from "./document";
import { volumePlanSchema } from "./stages/schemas";

/**
 * Plan → reference geometry. A `VolumePlan` is authored when a volume is placed (Foundation / Mass Expansion).
 * This module turns it into the articulated-geometry vocabulary (footprint operations, facade openings,
 * cantilever, capability intents) against the volume's FINAL orientation and neighbors — deterministic and
 * AI-free. That realization is a REFERENCE and a VALIDATION TARGET only: the Architectural Geometry Pass is
 * shown it as a baseline and authors the actual geometry, and `planConformance` measures what was authored
 * against it. It is never what gets built when the AI differs or omits something — a missing planned element
 * is a repair request to the owning stage, and an exhausted repair budget fails the generation.
 */

/**
 * What an unauthored plan field means: nothing. Role-independent on purpose — a field the architect left out
 * must never turn into glazing, an entry, a terrace or a roof edge because of what the volume is called. The
 * placing stages reject a plan with missing fields (`missingVolumePlanFields`) and ask for a repair; this value
 * only keeps a plan-less fixture or pre-plan document executable as the plain volume it is.
 */
const UNAUTHORED_PLAN: VolumePlan = {
  form: "bar", height: "standard", hierarchy: "supporting", viewFacade: "solid", arrivalFacade: "solid", flankFacades: "solid",
  entry: "none", outdoor: "none", outdoorSide: "view", roofEdge: "thin-eave", structure: "bearing-walls",
};

/** Every plan field the architect must author; `courtyardFacade` only applies to a courtyard wing. */
export const REQUIRED_PLAN_FIELDS = ["form", "height", "hierarchy", "viewFacade", "arrivalFacade", "flankFacades", "entry", "outdoor", "outdoorSide", "roofEdge", "structure"] as const satisfies readonly (keyof VolumePlan)[];

/** Keeps only the individually valid fields of a raw model plan — an off-vocabulary value is dropped, and its absence is then reported by `missingVolumePlanFields`, never defaulted. */
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

/** The required plan fields a raw authored plan leaves out (or gave an off-vocabulary value for). */
export function missingVolumePlanFields(raw: unknown): string[] {
  const plan = sanitizeVolumePlan(raw) ?? {};
  return REQUIRED_PLAN_FIELDS.filter((field) => plan[field] === undefined);
}

/** Normalizes a plan's valid fields into the full shape. Never invents architecture: an absent field stays "nothing". */
export function completeVolumePlan(partial: Partial<VolumePlan> | undefined): VolumePlan {
  const defined = Object.fromEntries(Object.entries(partial ?? {}).filter(([, v]) => v !== undefined)) as Partial<VolumePlan>;
  return { ...UNAUTHORED_PLAN, ...defined };
}

/** The total height a plan implies, or undefined for the standard `floors * LEVEL_HEIGHT`. Decided at placement so later volumes step against the real height. */
export function planHeight(plan: VolumePlan, floors: number): number | undefined {
  if (plan.height === "low") return round(floors * LEVEL_HEIGHT * 0.85);
  if (plan.height === "lofty") return round(floors * LEVEL_HEIGHT * 1.2);
  if (plan.height === "double-height") return round(floors === 1 ? LEVEL_HEIGHT * 1.8 : floors * LEVEL_HEIGHT * 1.2);
  return undefined;
}

/** Attaches the authored plan (valid fields only, and the height it states) to a freshly placed mass. */
export function withVolumePlan(mass: MassVolume, rawPlan: unknown): MassVolume {
  const plan = completeVolumePlan(sanitizeVolumePlan(rawPlan));
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
export const pluginAligned = (rotation: number) => Math.abs(Math.sin(rotation)) < 0.1;

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

/** A neighboring volume this close (meters) to a facade stands against it: a shared wall. */
export const SHARED_WALL_GAP_M = 0.6;

/** World sides where another volume stands against this one (≤ SHARED_WALL_GAP_M, overlapping in plan and height) — a shared wall, never a facade to glaze or open. */
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
    const GAP = SHARED_WALL_GAP_M, MIN_SHARED = 0.5;
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

/** An authored, facade-specific operation that cannot be built without changing its architecture. */
export interface PlanRealizationConflict { code: "shared-facade" | "missing-exterior-facade" | "insufficient-geometry"; feature: string; facade?: MassFacade; detail: string }

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

// ── Screens ──────────────────────────────────────────────────────────────────────────────────────────

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

// ── Realization ──────────────────────────────────────────────────────────────────────────────────────

export interface PlanRealization {
  operations: MassGeometryOperation[];
  openings: MassOpening[];
  capabilityIntents: CapabilityIntent[];
  cantilever?: MassVolume["cantilever"];
  conflicts?: PlanRealizationConflict[];
  /** Where the reference realization had to express a plan item differently (e.g. fins as deep reveals) — diagnostics only. */
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
  const plan = planOverride ?? mass.plan ?? completeVolumePlan(undefined);
  const facades = resolvePlanFacades(mass, masses, site);
  const operations: MassGeometryOperation[] = [];
  const capabilityIntents: CapabilityIntent[] = [];
  const notes: string[] = [];
  const conflicts: PlanRealizationConflict[] = [];
  const multiStorey = mass.floors >= 2;
  const aligned = pluginAligned(mass.rotation);
  const levelHeight = totalHeight(mass) / mass.floors;
  const minDim = Math.min(mass.width, mass.depth);
  const formFacade = facades.view;
  const formCompanion = formFacade === facades.freeSide ? oppositeFacade(facades.view) : facades.freeSide;
  const featureCorner = cornerOf(formFacade ?? facades.view, formCompanion);
  /** The span of each facade a footprint move already claims, so openings and later moves go around it. */
  const claimed: Partial<Record<MassFacade, Interval>> = {};

  // 0. Planned glazing on the view (or courtyard) facade is mandatory: a neighbor standing against that facade makes
  // it unbuildable where the plan puts it — a placement conflict, never glazing quietly dropped or moved elsewhere.
  for (const [side, facade, treatment] of [["view", facades.view, plan.viewFacade], ["courtyard", facades.courtyard, plan.courtyardFacade ?? plan.viewFacade]] as const) {
    if (!facade || treatment === "solid" || !facades.party.has(facade) || (side === "courtyard" && facade === facades.view)) continue;
    conflicts.push({ code: "shared-facade", feature: `${side} glazing`, facade, detail: `the ${treatment} ${side} facade (local ${facade}) is authored against a neighboring volume, so its glazing cannot be built there.` });
  }

  // 1. Form — the footprint itself, before anything is applied to its facades.
  if (plan.form === "l-shape") {
    if (minDim < 6) conflicts.push({ code: "insufficient-geometry", feature: "l-shape", facade: formFacade, detail: `l-shape needs a volume at least 6m deep (this one is ${minDim.toFixed(1)}m).` });
    else if (facades.party.has(formFacade)) conflicts.push({ code: "shared-facade", feature: "l-shape", facade: formFacade, detail: "l-shape's authored view facade is shared." });
    else {
      const alongView = round(clamp(0.4 * facadeLength(formFacade, mass), 2.5, Math.min(8, 0.5 * facadeLength(formFacade, mass))));
      const alongSide = round(clamp(0.45 * facadeLength(formCompanion, mass), 2, Math.min(7, 0.5 * facadeLength(formCompanion, mass))));
      const viewIsNS = formFacade === "north" || formFacade === "south";
      operations.push({ type: "notch", corner: featureCorner, width: viewIsNS ? alongView : alongSide, depth: viewIsNS ? alongSide : alongView });
    }
  } else if (plan.form === "prow") {
    if (minDim < 4) conflicts.push({ code: "insufficient-geometry", feature: "prow", facade: formFacade, detail: "prow needs a volume at least 4m deep." });
    else if (facades.party.has(formFacade)) conflicts.push({ code: "shared-facade", feature: "prow", facade: formFacade, detail: "prow's authored view facade is shared." });
    else {
      operations.push({ type: "chamfer", corner: featureCorner, size: round(clamp(0.3 * minDim, 1.5, 5)), ...(GLASS_TREATMENTS.has(treatmentFor(formFacade, plan, facades)) ? { glazed: true } : {}) });
    }
  } else if (plan.form === "setback") {
    if (!multiStorey) conflicts.push({ code: "insufficient-geometry", feature: "setback", facade: facades.view, detail: "setback needs 2+ floors." });
    else if (facades.party.has(facades.view)) conflicts.push({ code: "shared-facade", feature: "setback", facade: facades.view, detail: "setback's authored view facade is shared." });
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
    if (facades.party.has(wanted)) { conflicts.push({ code: "shared-facade", feature: plan.outdoor, facade: wanted, detail: `${plan.outdoor} cannot be moved from its authored ${wanted} facade because it is shared.` }); return undefined; }
    return wanted;
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
  const entryFacade = facades.party.has(facades.arrival) ? undefined : facades.arrival;
  if (plan.entry !== "none" && !entryFacade) conflicts.push({ code: "shared-facade", feature: "entry", facade: facades.arrival, detail: "entry cannot be moved from its authored arrival facade because it is shared." });
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

  return { operations, openings, capabilityIntents, ...(cantilever ? { cantilever } : {}), ...(conflicts.length ? { conflicts } : {}), notes };
}

// ── Conformance ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Identity of a planned element. What the plan decides is THAT a volume has a form move or an outdoor room;
 * where and how large is the Geometry Pass's to author — so a notch at another corner, or a terrace on another
 * side, is still that element. An entry belongs to the arrival facade and openings to the facade the plan gave
 * their treatment to, so those are identified by facade.
 */
function opKey(op: MassGeometryOperation): string {
  if (op.type === "notch" || op.type === "chamfer") return `form:${op.type}`;
  if (op.type === "entry-recess") return `entry:${op.facade}`;
  if (op.open) return "outdoor-room";
  return `${op.type}:${op.floors ?? "all"}`;
}
const opLabel = (op: MassGeometryOperation) => (op.type === "notch" || op.type === "chamfer" ? `${op.type} (reference: the ${op.corner} corner)`
  : op.type === "entry-recess" ? `entry-recess on the ${op.facade} facade`
  : op.open ? `open (open:true) recess or projection — the outdoor room (reference: the ${op.facade} facade)`
  : `${op.type}${op.floors && op.floors !== "all" ? ` on floors:"${op.floors}"` : ""} (reference: the ${op.facade} facade)`);
function openingKey(op: MassOpening): string { return `${op.facade}:${op.type === "glazing-zone" ? "glass" : op.type === "door" ? "door" : "rhythm"}`; }
/** A capability the plan calls for on a volume (a canopy, fins, a screen, props), by id and — where it is facade-bound — world side. */
function capabilityKey(intent: CapabilityIntent): string { return `${intent.id}:${typeof intent.parameters?.facade === "string" ? intent.parameters.facade : "*"}`; }
const CAPABILITY_LABEL: Record<string, string> = { "entry-canopy": "canopy", "brise-soleil": "sun-fins", "screen-layer": "screen", pilotis: "pilotis" };

export interface PlanConformance {
  /** Planned elements the authored geometry does not contain. */
  missing: string[];
  /** Authored plan items that cannot be built where the plan puts them (owner: the stage that placed the volume). */
  conflicts: PlanRealizationConflict[];
  /** How the reference realization expressed the plan where it had to adapt — diagnostics only. */
  notes: string[];
}

/**
 * Measures a volume's AUTHORED geometry (`mass.operations`/`openings`/`cantilever`, plus the document's
 * capability intents for it) against the reference realization of its plan, by element identity. Validation
 * only: nothing here is added to, removed from or moved on the mass. The Geometry Pass uses it to ask for a
 * repair, the final integrity gate to block.
 */
export function planConformance(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, capabilities: readonly CapabilityIntent[] = []): PlanConformance {
  const baseline = realizeVolumePlan(mass, masses, site);
  const opKeys = new Set((mass.operations ?? []).map(opKey));
  const openingKeys = new Set((mass.openings ?? []).map(openingKey));
  const capabilityKeys = new Set(capabilities.filter((c) => c.parameters?.massId === mass.id).flatMap((c) => [capabilityKey(c), `${c.id}:*`]));
  const world = (key: string) => key.split(":")[1];
  const missing = [
    ...baseline.operations.filter((op) => !opKeys.has(opKey(op))).map(opLabel),
    ...baseline.openings.filter((op) => !openingKeys.has(openingKey(op))).map((op) => `${op.type} on the ${op.facade} facade`),
    ...baseline.capabilityIntents.filter((c) => !capabilityKeys.has(capabilityKey(c))).map((c) => `${CAPABILITY_LABEL[c.id] ?? c.id}${world(capabilityKey(c)) !== "*" ? ` on the ${localFacadeToward(world(capabilityKey(c)) as CompassSide, mass.rotation)} facade` : ""}`),
    ...(baseline.cantilever && !mass.cantilever ? ["cantilever"] : []),
  ];
  return { missing, conflicts: baseline.conflicts ?? [], notes: baseline.notes };
}

/** Local facades of a mass that stand against a neighboring volume — nothing can be opened, pushed or glazed there. */
export function sharedFacades(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): ReadonlySet<MassFacade> {
  return resolvePlanFacades(mass, masses, site).party;
}

/** One-line plan summary with local facades resolved — what the Geometry Pass (and later volumes) read. */
export function describeVolumePlan(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): string {
  const plan = mass.plan ?? completeVolumePlan(undefined);
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
