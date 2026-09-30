import type { CompassSide } from "@/types/house";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import type { FootprintScope, MassFacade, MassGeometryOperation, MassOpening, MassVolume, SiteStrategy } from "./document";
import { localFacadeToward, realizeVolumePlan, type PlanRealizationConflict } from "./volumePlan";

/**
 * The mandatory executable baseline: the VolumePlan requirements whose existence AND location the plan already
 * decided, compiled mechanically into geometry before the Geometry Pass runs. Compiling an authored "view facade:
 * framed-glass" into glazing on the facade that view resolves to is execution, not design — nothing here decides
 * THAT a feature exists or WHICH facade takes it; an unauthored plan compiles to nothing, for any role.
 *
 * Baseline (plan-owned, stable ids `<massId>:plan:…`, immutable except the fields each contract lists):
 *   - facade glazing / window rhythms (the treatment the plan gave the facade each side faces);
 *   - the entry: the centered entry-recess on the arrival facade and its door, or a flush door there;
 *   - the plan's facade-bound elements whose facade is fixed by the plan: entry canopy, screens, sun fins;
 *   - structure fully located by the plan: pilotis under a raised volume.
 * Geometry-owned (required by identity through `planConformance`, placed and proportioned by the Geometry Pass):
 *   the form move (l-shape notch / prow chamfer / setback), the outdoor room, and every addition.
 *
 * A baseline item that cannot be built where the plan puts it (a shared wall, a too-small volume) is a conflict
 * for the stage that placed the volume — it is never relocated here or by the Geometry Pass.
 */

export type RefinableField = "start" | "end" | "heightRatio" | "count" | "width" | "height" | "sill" | "depth";

/** Per element kind, the fields the Geometry Pass may refine. Everything else — type, facade, existence — is the plan's. */
const REFINABLE: Record<string, readonly RefinableField[]> = {
  "glazing-zone": ["start", "end", "heightRatio"],
  "opening-rhythm": ["count", "width", "height", "sill"],
  door: [],
  "entry-recess": [],
  "entry-canopy": ["width", "depth", "height"],
  "screen-layer": ["start", "end", "depth"],
  "brise-soleil": ["count", "depth", "sill"],
  pilotis: [],
};

type EntryRecess = Extract<MassGeometryOperation, { type: "entry-recess" }>;
type ElementBase = { id: string; refinable: readonly RefinableField[]; /** Local facade the plan fixed it to (none for pilotis). */ facade?: MassFacade };
export type BaselineElement =
  | ElementBase & { kind: "opening"; value: MassOpening }
  | ElementBase & { kind: "entry"; value: EntryRecess }
  | ElementBase & { kind: "capability"; value: CapabilityIntent };

export interface MandatoryBaseline {
  massId: string;
  elements: BaselineElement[];
  /** Mandatory plan items that cannot be built where the plan puts them — owned by the stage that placed the volume. */
  conflicts: PlanRealizationConflict[];
  /** Geometry-owned plan items (form move, outdoor room) as the reference realization placed them — a suggestion only. */
  reference: MassGeometryOperation[];
  notes: string[];
}

/** Only conflicts that make a mechanically executed, facade-fixed plan decision impossible belong to the
 * placement owner. Form and outdoor-room reference placement is deliberately Geometry-owned and flexible. */
function mandatoryConflicts(conflicts: readonly PlanRealizationConflict[]): PlanRealizationConflict[] {
  return conflicts.filter((conflict) => conflict.feature === "entry" || /^(view|courtyard) glazing$/.test(conflict.feature));
}

export const isBaselineId = (id: string | undefined): boolean => typeof id === "string" && id.includes(":plan:");

const CAPABILITY_STEM: Record<string, string> = { "entry-canopy": "canopy", "screen-layer": "screen", "brise-soleil": "sun-fins", pilotis: "pilotis" };
const OPENING_STEM: Record<MassOpening["type"], string> = { "glazing-zone": "glazing", "opening-rhythm": "windows", door: "door" };

/** Compiles a placed volume's plan into its mandatory baseline. Deterministic: the same plan and placement always yield the same ids and values. */
export function mandatoryBaseline(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): MandatoryBaseline {
  const r = realizeVolumePlan(mass, masses, site);
  const used = new Map<string, number>();
  const idFor = (stem: string) => {
    const n = (used.get(stem) ?? 0) + 1;
    used.set(stem, n);
    return `${mass.id}:plan:${stem}${n > 1 ? `-${n}` : ""}`;
  };
  const elements: BaselineElement[] = [];
  for (const op of r.operations) {
    if (op.type !== "entry-recess") continue;
    const id = idFor(`${op.facade}-entry-recess`);
    elements.push({ id, kind: "entry", value: { ...op, id }, refinable: REFINABLE["entry-recess"], facade: op.facade });
  }
  for (const opening of r.openings) {
    const id = idFor(`${opening.facade}-${OPENING_STEM[opening.type]}`);
    elements.push({ id, kind: "opening", value: { ...opening, id }, refinable: REFINABLE[opening.type], facade: opening.facade });
  }
  for (const intent of r.capabilityIntents) {
    const facade = typeof intent.parameters?.facade === "string" ? localFacadeToward(intent.parameters.facade as CompassSide, mass.rotation) : undefined;
    elements.push({ id: idFor(`${CAPABILITY_STEM[intent.id] ?? intent.id}${facade ? `-${facade}` : ""}`), kind: "capability", value: intent, refinable: REFINABLE[intent.id] ?? [], ...(facade ? { facade } : {}) });
  }
  return {
    massId: mass.id, elements, conflicts: mandatoryConflicts(r.conflicts ?? []), notes: r.notes,
    reference: r.operations.filter((op) => op.type !== "entry-recess"),
  };
}

// ── Refinement ───────────────────────────────────────────────────────────────────────────────────────

export interface BaselineRefinement { id: string; facade?: MassFacade; start?: number; end?: number; heightRatio?: number; count?: number; width?: number; height?: number; sill?: number; depth?: number }
export interface BaselineViolation { code: string; detail: string }

/** A refined glazing zone must keep at least the span the plan realization itself treats as a usable facade (see `facadeOpenings`). */
const MIN_GLAZING_SPAN = 0.15;
const REFINEMENT_FIELDS: readonly RefinableField[] = ["start", "end", "heightRatio", "count", "width", "height", "sill", "depth"];

export function baselineLabel(element: BaselineElement): string {
  if (element.kind === "capability") return `${CAPABILITY_STEM[element.value.id] ?? element.value.id} (${element.id})`;
  return `${element.value.type} on the ${element.value.facade} facade (${element.id})`;
}

/**
 * Applies the Geometry Pass's refinements to the baseline: only listed ids, only each contract's refinable
 * fields, and only values that keep the element what the plan made it. Anything else is a violation for the
 * Geometry Pass to repair — nothing is ignored, clamped or reinterpreted.
 */
export function refineBaseline(baseline: MandatoryBaseline, refinements: readonly BaselineRefinement[]): { elements: BaselineElement[]; violations: BaselineViolation[] } {
  const violations: BaselineViolation[] = [];
  const byId = new Map(baseline.elements.map((e) => [e.id, e] as const));
  const refined = new Map<string, BaselineElement>();
  for (const refinement of refinements) {
    const element = byId.get(refinement.id);
    if (!element) { violations.push({ code: "baseline-unknown", detail: `"${refinement.id}" is not a mandatory baseline element of "${baseline.massId}". Refine only the listed ids; anything new is an operation.` }); continue; }
    if (refined.has(refinement.id)) { violations.push({ code: "baseline-refinement-invalid", detail: `"${refinement.id}" is refined more than once. Give one refinement per id.` }); continue; }
    const fields = REFINEMENT_FIELDS.filter((f) => refinement[f] !== undefined);
    if (refinement.facade !== undefined && refinement.facade !== element.facade) {
      violations.push({ code: "baseline-immutable", detail: `${baselineLabel(element)} is mandatory VolumePlan geometry on the ${element.facade ?? "volume"} facade; it cannot be moved to the ${refinement.facade} facade. Leave it where the plan put it — add separate geometry on the ${refinement.facade} facade instead.` });
      continue;
    }
    const immutable = fields.filter((f) => !element.refinable.includes(f));
    if (immutable.length) {
      violations.push({ code: "baseline-immutable", detail: `${baselineLabel(element)} is mandatory VolumePlan geometry; its ${immutable.join("/")} cannot be changed (refinable: ${element.refinable.join(", ") || "nothing"}). Leave it as built.` });
      continue;
    }
    const changes = Object.fromEntries(fields.map((f) => [f, refinement[f]]));
    const next: BaselineElement = element.kind === "capability"
      ? { ...element, value: { ...element.value, parameters: { ...element.value.parameters, ...changes } } }
      : { ...element, value: { ...element.value, ...changes } as never };
    const invalid = refinedValueProblem(next);
    if (invalid) { violations.push({ code: "baseline-refinement-invalid", detail: `${baselineLabel(element)}: ${invalid}` }); continue; }
    refined.set(element.id, next);
  }
  return { elements: baseline.elements.map((e) => refined.get(e.id) ?? e), violations };
}

function refinedValueProblem(element: BaselineElement): string | undefined {
  const v = (element.kind === "capability" ? element.value.parameters ?? {} : element.value) as Record<string, unknown>;
  const start = v.start as number | undefined, end = v.end as number | undefined;
  if (start !== undefined && end !== undefined && end <= start) return "end must be greater than start.";
  if (element.kind === "opening" && element.value.type === "glazing-zone" && element.value.end - element.value.start < MIN_GLAZING_SPAN) return `a planned glazing zone must keep at least ${MIN_GLAZING_SPAN} of its facade — narrowing it away would delete a plan requirement.`;
  if (element.kind === "opening" && element.value.type === "opening-rhythm" && element.value.count > 6) return "a window rhythm takes 2-6 windows.";
  return undefined;
}

// ── Facade spans ─────────────────────────────────────────────────────────────────────────────────────

interface Interval { start: number; end: number }
const EPS = 0.01;
const facadeLength = (f: MassFacade, m: { width: number; depth: number }) => (f === "north" || f === "south" ? m.width : m.depth);
const overlaps = (a: Interval, b: Interval) => Math.min(a.end, b.end) - Math.max(a.start, b.start) > EPS;

/** The floor indices an operation or opening applies to. */
function floorSet(scope: FootprintScope | undefined, floors: number): number[] {
  const all = Array.from({ length: Math.max(1, floors) }, (_, i) => i);
  return !scope || scope === "all" ? all : scope === "ground" ? [0] : all.filter((i) => i > 0);
}
const sharesFloor = (a: readonly number[], b: readonly number[]) => a.some((i) => b.includes(i));
const coversFloors = (outer: readonly number[], inner: readonly number[]) => inner.length > 0 && inner.every((i) => outer.includes(i));

/** The span (compass u) an opening occupies on its facade — a rhythm's whole run, mirroring `openingBands` in openings.ts. */
export function openingSpan(opening: MassOpening, mass: Pick<MassVolume, "width" | "depth">): Interval {
  if (opening.type !== "opening-rhythm") return { start: Math.min(opening.start, opening.end), end: Math.max(opening.start, opening.end) };
  const widthU = Math.min(1, opening.width / facadeLength(opening.facade, mass));
  const span = Math.min(1, opening.count * widthU + (opening.count - 1) * widthU * 0.4);
  return { start: (1 - span) / 2, end: (1 + span) / 2 };
}

const entrySpan = (op: EntryRecess, mass: Pick<MassVolume, "width" | "depth">): Interval => {
  const half = Math.min(0.5, op.width / facadeLength(op.facade, mass) / 2);
  return { start: 0.5 - half, end: 0.5 + half };
};

/** The span of `facade` a footprint move takes off the original facade plane (where no opening on that plane can be built). */
function takenSpan(op: MassGeometryOperation, facade: MassFacade, mass: Pick<MassVolume, "width" | "depth">): Interval | undefined {
  if (op.type === "recess" || op.type === "projection") return op.facade === facade ? { start: Math.min(op.start, op.end), end: Math.max(op.start, op.end) } : undefined;
  if (op.type === "entry-recess") return op.facade === facade ? entrySpan(op, mass) : undefined;
  const [ns, ew] = [op.corner[0], op.corner[1]];
  const ofFacade = facade === "north" || facade === "south" ? facade[0] === ns : facade[0] === ew;
  if (!ofFacade) return undefined;
  const along = op.type === "notch" ? (facade === "north" || facade === "south" ? op.width : op.depth) : op.size;
  const u = Math.min(1, along / facadeLength(facade, mass));
  const atStart = facade === "north" || facade === "south" ? ew === "w" : ns === "n";
  return atStart ? { start: 0, end: u } : { start: 1 - u, end: 1 };
}

/** What is left of `span` once every `taken` interval is removed. */
function remaining(span: Interval, taken: readonly Interval[]): number {
  let left = [span];
  for (const t of taken) left = left.flatMap((s) => (overlaps(s, t) ? [{ start: s.start, end: Math.max(s.start, t.start) }, { start: Math.min(s.end, t.end), end: s.end }] : [s]));
  return left.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

// ── Integrity ────────────────────────────────────────────────────────────────────────────────────────

const sameExcept = (a: Record<string, unknown>, b: Record<string, unknown>, free: readonly string[]) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter((k) => !free.includes(k) && k !== "id"));
  return [...keys].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
};

/**
 * Whether a volume's final geometry keeps its mandatory baseline intact — the one check both the Geometry Pass
 * (on its merged result, as repair requests) and the final quality gate (blocking) run:
 *   - every baseline element is present under its id, with nothing but its refinable fields changed;
 *   - no other opening duplicates a baseline opening (same facade, overlapping span, shared floor);
 *   - no other footprint move runs into the entry or a baseline door, or takes a baseline opening's whole span.
 * Only a volume whose geometry carries baseline ids is checked element by element: a pre-baseline document is
 * measured by `planConformance` alone.
 */
export function baselineViolations(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): BaselineViolation[] {
  if (!mass.plan) return [];
  const operations = mass.operations ?? [], openings = mass.openings ?? [];
  if (![...operations, ...openings].some((item) => isBaselineId(item.id))) return [];
  const baseline = mandatoryBaseline(mass, masses, site);
  const violations: BaselineViolation[] = [];
  const baseOpenings: { element: BaselineElement; opening: MassOpening }[] = [];
  const baseEntries: { element: BaselineElement; op: EntryRecess }[] = [];
  for (const element of baseline.elements) {
    if (element.kind === "capability") continue;
    const built = element.kind === "entry" ? operations.find((o) => o.id === element.id) : openings.find((o) => o.id === element.id);
    if (!built) { violations.push({ code: "baseline-removed", detail: `The mandatory ${baselineLabel(element)} is missing. It is VolumePlan geometry and cannot be removed.` }); continue; }
    if (built.type !== element.value.type || !sameExcept(built as Record<string, unknown>, element.value as Record<string, unknown>, element.refinable)) {
      violations.push({ code: "baseline-modified", detail: `The mandatory ${baselineLabel(element)} was changed beyond its refinable fields (${element.refinable.join(", ") || "none"}). Its type, facade and fixed dimensions are the VolumePlan's.` });
    }
    if (element.kind === "entry") baseEntries.push({ element, op: built as EntryRecess });
    else baseOpenings.push({ element, opening: built as MassOpening });
  }
  const otherOpenings = openings.filter((o) => !isBaselineId(o.id));
  const otherOperations = operations.filter((o) => !isBaselineId(o.id));
  for (const { element, opening } of baseOpenings) {
    const span = openingSpan(opening, mass), floors = floorSet(opening.floors, mass.floors);
    for (const other of otherOpenings) {
      if (other.facade === opening.facade && sharesFloor(floors, floorSet(other.floors, mass.floors)) && overlaps(span, openingSpan(other, mass))) {
        violations.push({ code: "baseline-duplicate", detail: `The added ${other.type} on the ${other.facade} facade overlaps the mandatory ${baselineLabel(element)}, which is already built. Do not repeat it — refine it by id, or place the addition clear of it.` });
      }
    }
    for (const { element: other, opening: otherOpening } of baseOpenings) {
      if (other.id <= element.id || otherOpening.facade !== opening.facade || !sharesFloor(floors, floorSet(otherOpening.floors, mass.floors))) continue;
      if (overlaps(span, openingSpan(otherOpening, mass))) violations.push({ code: "baseline-refinement-invalid", detail: `The refined ${baselineLabel(element)} now overlaps ${baselineLabel(other)}. Keep baseline openings clear of each other.` });
    }
    const taken = otherOperations.flatMap((op) => {
      const t = takenSpan(op, opening.facade, mass);
      return t && coversFloors(floorSet(op.floors, mass.floors), floors) ? [t] : [];
    });
    const touching = otherOperations.filter((op) => { const t = takenSpan(op, opening.facade, mass); return t && overlaps(span, t) && sharesFloor(floors, floorSet(op.floors, mass.floors)); });
    if (opening.type === "door" && touching.length) {
      violations.push({ code: "baseline-obstructed", detail: `Your ${touching.map((op) => op.type).join("/")} runs into the mandatory ${baselineLabel(element)}. Keep footprint moves clear of the entry door.` });
    } else if (opening.type !== "door" && remaining(span, taken) <= EPS) {
      violations.push({ code: "baseline-obstructed", detail: `Your ${touching.map((op) => op.type).join("/")} takes the whole span of the mandatory ${baselineLabel(element)}, which would delete it. Move or narrow the move, or refine the baseline element's span (if refinable) so both are built.` });
    }
  }
  for (const { element, op } of baseEntries) {
    const span = entrySpan(op, mass), floors = floorSet(op.floors, mass.floors);
    const touching = otherOperations.filter((other) => { const t = takenSpan(other, op.facade, mass); return t && overlaps(span, t) && sharesFloor(floors, floorSet(other.floors, mass.floors)); });
    if (touching.length) violations.push({ code: "baseline-obstructed", detail: `Your ${touching.map((o) => o.type).join("/")} runs into the mandatory ${baselineLabel(element)}. Keep footprint moves clear of the entry.` });
  }
  for (const op of otherOperations) {
    if (op.type === "entry-recess") violations.push({ code: "baseline-entry", detail: `An entry-recess on the ${op.facade} facade was added, but the entry is VolumePlan geometry (${mass.plan.entry} entry${baseEntries.length ? `, already built as ${baseEntries.map((e) => e.element.id).join(", ")}` : ""}). Remove it.` });
  }
  return violations;
}

/** Facade-bound capabilities an addition would duplicate: one canopy / one set of fins / pilotis per volume, one screen per facade. */
export function duplicatesBaselineCapability(baseline: MandatoryBaseline, intent: CapabilityIntent): BaselineElement | undefined {
  return baseline.elements.find((e) => e.kind === "capability" && e.value.id === intent.id && (intent.id !== "screen-layer" || e.value.parameters?.facade === intent.parameters?.facade));
}

// ── Prompt ───────────────────────────────────────────────────────────────────────────────────────────

const round = (v: unknown) => (typeof v === "number" ? Math.round(v * 100) / 100 : v);

/** The baseline in the Geometry Pass's own vocabulary (local facades), each element with its id and refinable fields. */
export function describeBaseline(baseline: MandatoryBaseline, mass: MassVolume): string {
  const items = baseline.elements.map((element): Record<string, unknown> => {
    const refinable = element.refinable.length ? element.refinable : "none";
    if (element.kind !== "capability") {
      const value = { ...element.value } as Record<string, unknown>;
      delete value.id;
      return { id: element.id, ...Object.fromEntries(Object.entries(value).map(([k, v]) => [k, round(v)])), refinable };
    }
    const p = element.value.parameters ?? {};
    const facade = typeof p.facade === "string" ? localFacadeToward(p.facade as CompassSide, mass.rotation) : undefined;
    const type = CAPABILITY_STEM[element.value.id] ?? element.value.id;
    const fields = element.value.id === "entry-canopy" ? { width: p.width, depth: p.depth, height: p.height }
      : element.value.id === "screen-layer" ? { start: p.start, end: p.end, depth: p.depth }
      : element.value.id === "brise-soleil" ? { count: p.count, depth: p.depth, sill: p.sill } : {};
    return { id: element.id, type, ...(facade ? { facade } : {}), ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, round(v)])), refinable };
  });
  return items.length ? JSON.stringify(items) : "[] (nothing mandatory)";
}
