import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { CapabilityRequest } from "@/types/library";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import { capabilityById, normalizeCapability } from "@/lib/library/capabilities";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassGeometryOperation, MassOpening, MassVolume, SiteStrategy } from "../document";
import { describeVolumePlan, parameterizeCapabilityIntent, pluginAligned, worldSideOf } from "../volumePlan";
import { describeBaseline, duplicatesBaselineCapability, mandatoryBaseline, refineBaseline, type BaselineElement, type MandatoryBaseline } from "../planBaseline";
import { runStage } from "./runStage";
import { geometryStageOutputSchema, type GeometryOperationOutput, type GeometryStageOutput, FACADE_ELEMENT_TYPES, KNOWN_CAPABILITY_IDS } from "./schemas";
import { clampNearBound } from "./numericNormalization";
import { geometryConflicts } from "./integrityChecks";
import { repairRequests, type OwningStage, type StageConflict } from "./recovery";

const SYSTEM = `You are a senior residential architect authoring the built form of every volume of a composition, all at once. Every volume was planned when it was placed — its form, height, facade treatments, entry, outdoor transition, structure and roof edge.
The plan's MANDATORY requirements are ALREADY BUILT for you as each volume's MANDATORY BASELINE: the glazing and windows of every facade the plan glazed, the entry (entry-recess and its door, or a flush door) on the arrival facade, and the canopy, screens, sun fins and pilotis the plan fixed to a facade. Each baseline element has a stable id. It is immutable: never repeat it in your operations (a repeat is a duplicate and is rejected), never remove it, never move it to another facade, never change its type. Where an element lists refinable fields you may change ONLY those, via "refinements": [{ "id": <baseline id>, <field>: <value> }] — e.g. narrow a glazing zone's start/end to make room for your terrace, or set a canopy's depth.
YOU author everything else as "operations" — additions to the baseline, built exactly as you return them; nothing is added, moved, restored or corrected for you: the planned form (notch = l-shape, chamfer = prow, floors:"upper" recess = setback) — which corner or facade it takes is yours to decide; the planned outdoor room as an open (open:true) projection or recess — the baseline leaves the span the reference shows free for it, but where it goes is yours (refine the baseline glazing to make room elsewhere); and any secondary moves and details that serve the plan: additional openings, doors, canopies, screens or fins clear of the baseline. A missing form move or outdoor room is rejected and sent back. Never author an entry-recess (the entry is the plan's), never author anything on a shared wall (a facade another volume stands against), never let a footprint move run into the entry or a baseline door or swallow a baseline opening whole.
Vocabulary: "recess"/"projection" push part of one facade in or out ("open": true makes the interval wall-less — a veranda/covered terrace; "postSpacing" adds a colonnade rhythm); "notch" cuts a rectangular corner bite; "chamfer" cuts one corner at an angle ("width" = cut size; "glazed": true = glass prow); "glazing-zone" is one wide glazed panel ("frame": true = heavy structural surround, "reveal" = glass set back from the wall face); "opening-rhythm" is a row of evenly repeated windows; "door" is a grade-level pass-through; "canopy" is a projecting canopy (facade, width, depth, optional height); "screen" is a batten screen layer standing off a facade span (facade, start, end, optional depth); "sun-fins" is a row of vertical sun fins on a facade (facade, count, optional depth/height/sill). Canopy and sun-fins can only be built on a volume that is not turned off the site axes. If a volume needs another freestanding element, request it by exact id via requestedOperation: ${KNOWN_CAPABILITY_IDS.join(", ")}; for anything else outside this vocabulary (e.g. a curved wall), name it in plain words.`;

export interface GeometryStageContext { brief: string; intent: ArchitecturalIntent; siteStrategy: SiteStrategy; masses: readonly MassVolume[]; }

export interface MassGeometryResult {
  /** The mandatory baseline's entry-recess (if any) followed by the Geometry Pass's footprint moves, each with its stable id. */
  operations: readonly MassGeometryOperation[];
  /** The mandatory baseline's openings (as refined) followed by the Geometry Pass's added openings, each with its stable id. */
  openings: readonly MassOpening[];
  /** How the plan's reference realization had to adapt (diagnostics only). */
  planNotes: readonly string[];
}

/**
 * The Geometry Pass either refines and adds to every volume's mandatory baseline (`ok: true`) or fails. A response
 * that leaves out a Geometry-owned plan element, contradicts the baseline, or cannot be built is a repair request
 * inside this stage's retry budget, and an exhausted budget fails the generation. A baseline the placement makes
 * impossible is never handed to the model to relocate: the stage fails before any call, owned by the placing stage.
 */
export type GeometryStageResult =
  | { ok: true; byMassId: Map<string, MassGeometryResult>; capabilityIntents: CapabilityIntent[]; capabilityRequests: CapabilityRequest[]; attempts: number; durationMs: number; repairRequests?: string[] }
  | { ok: false; errors: string[]; attempts: number; durationMs: number; repairRequests?: string[]; owningStage?: OwningStage };

const FOOTPRINT_TYPES = new Set<GeometryOperationOutput["type"]>(["recess", "projection", "notch", "entry-recess", "chamfer"]);
const FACADE_ELEMENTS = new Set<GeometryOperationOutput["type"]>(FACADE_ELEMENT_TYPES);

/**
 * Safe numeric normalization only — same principle as mass-expansion's `rotationOffset`: a small overshoot on
 * one of this schema's bounded numeric fields (start/end/depth/width/heightRatio/height/sill), in an operation or a
 * baseline refinement, is model rounding, so it is clamped to the bound it grazed instead of costing a repair
 * retry. A MISSING field is never
 * filled in: how deep a recess is or how many windows a facade takes is the architect's decision, so an
 * operation that omits one fails the schema and is sent back as a repair request.
 */
function normalizeGeometryOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.results)) return raw;
  const normalizeOp = (op: unknown) => {
    if (!op || typeof op !== "object") return op;
    const o = { ...(op as Record<string, unknown>) };
    const clamp = (key: string, min: number, max: number) => {
      if (key in o) { const recovered = clampNearBound(o[key], min, max); if (recovered !== undefined) o[key] = recovered; }
    };
    clamp("start", 0, 1);
    clamp("end", 0, 1);
    clamp("depth", 0.3, 8);
    clamp("width", 0.5, 8);
    clamp("heightRatio", 0.2, 0.95);
    clamp("height", 0.6, 3);
    clamp("sill", 0, 1.5);
    return o;
  };
  return {
    ...value,
    results: value.results.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const e = { ...(entry as Record<string, unknown>) };
      if (Array.isArray(e.operations)) e.operations = e.operations.map(normalizeOp);
      if (Array.isArray(e.refinements)) e.refinements = e.refinements.map(normalizeOp);
      return e;
    }),
  };
}

type GeometryEntry = GeometryStageOutput["results"][number];

const describeMass = (m: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, baseline: MandatoryBaseline) =>
  `${m.id} "${m.name}", role ${m.role}, ${m.width.toFixed(1)}x${m.depth.toFixed(1)}m, ${m.floors} floor(s), rotation ${(m.rotation * 180 / Math.PI).toFixed(0)}°.\n  PLAN: ${describeVolumePlan(m, masses, site)}\n  MANDATORY BASELINE (already built — never repeat): ${describeBaseline(baseline, m)}\n  YOURS TO AUTHOR (reference placement only): ${baseline.reference.length ? JSON.stringify(baseline.reference.map((op) => (op.type === "chamfer" ? { ...op, size: undefined, width: op.size } : op))) : "no planned form move or outdoor room"}`;

/** The mass a placing stage put there owns a plan it cannot carry: Foundation for the primary volume, Mass Expansion for every other and for any shared wall (neighbors are placed by Mass Expansion). */
function placementOwner(mass: MassVolume, masses: readonly MassVolume[], code: string): OwningStage {
  return code !== "shared-facade" && mass.id === masses[0]?.id ? "foundation" : "mass-expansion";
}

function toDocumentOp(op: GeometryOperationOutput): MassGeometryOperation | MassOpening {
  const floors = op.floors;
  if (op.type === "notch") return { type: "notch", corner: op.corner!, width: op.width!, depth: op.depth!, floors };
  if (op.type === "chamfer") return { type: "chamfer", corner: op.corner!, size: op.width!, floors, ...(op.glazed ? { glazed: true } : {}) };
  if (op.type === "entry-recess") return { type: "entry-recess", facade: op.facade!, width: op.width!, depth: op.depth!, floors };
  if (op.type === "recess" || op.type === "projection") return { type: op.type, facade: op.facade!, start: op.start!, end: op.end!, depth: op.depth!, floors, ...(op.open ? { open: true, ...(op.postSpacing ? { postSpacing: op.postSpacing } : {}) } : {}) };
  if (op.type === "glazing-zone") return { type: "glazing-zone", facade: op.facade!, start: op.start!, end: op.end!, heightRatio: op.heightRatio!, ...(floors ? { floors } : {}), ...(op.frame ? { frame: true } : {}), ...(op.reveal ? { reveal: op.reveal } : {}) };
  if (op.type === "door") return { type: "door", facade: op.facade!, start: op.start!, end: op.end!, ...(op.height ? { height: op.height } : {}), ...(floors ? { floors } : {}), ...(op.frame ? { frame: true } : {}), ...(op.reveal ? { reveal: op.reveal } : {}) };
  return { type: "opening-rhythm", facade: op.facade!, count: op.count!, width: op.width!, height: op.height!, sill: op.sill!, floors };
}

const defined = (parameters: Record<string, unknown>) => Object.fromEntries(Object.entries(parameters).filter(([, v]) => v !== undefined));

/** An authored canopy / screen / sun-fins operation as the capability intent that builds it, with the architect's own parameters. */
function facadeElementIntent(op: GeometryOperationOutput, mass: MassVolume): CapabilityIntent {
  const facade = worldSideOf(op.facade!, mass.rotation);
  const stage = "architectural-geometry";
  if (op.type === "canopy") return { id: "entry-canopy", stage, parameters: defined({ massId: mass.id, facade, width: op.width, depth: op.depth, height: op.height }) };
  if (op.type === "screen") return { id: "screen-layer", stage, parameters: defined({ massId: mass.id, facade, start: op.start, end: op.end, depth: op.depth, height: op.height, sill: op.sill }) };
  return { id: "brise-soleil", stage, parameters: defined({ massId: mass.id, facade, count: op.count, depth: op.depth, height: op.height, sill: op.sill }) };
}

interface AuthoredGeometry { byMassId: Map<string, MassGeometryResult>; masses: MassVolume[]; capabilityIntents: CapabilityIntent[]; capabilityRequests: CapabilityRequest[]; conflicts: StageConflict[] }

/** The baseline split back into the document's three lists, in baseline order. */
function baselineParts(elements: readonly BaselineElement[]) {
  const operations: MassGeometryOperation[] = [], openings: MassOpening[] = [], intents: CapabilityIntent[] = [];
  for (const e of elements) {
    if (e.kind === "entry") operations.push(e.value);
    else if (e.kind === "opening") openings.push(e.value);
    else intents.push(e.value);
  }
  return { operations, openings, intents };
}

/**
 * Merges a structurally valid response onto each volume's mandatory baseline, by stable id: the baseline (with the
 * architect's refinements of its refinable fields) first, then the architect's additions exactly as returned, each
 * given a `<massId>:geometry:<n>` id. Then measures the result (see `geometryConflicts`, which includes
 * `baselineViolations`): a deleted, moved, modified, duplicated or obstructed baseline element is a repair request
 * for the Geometry Pass — nothing it authored is dropped, clamped or moved to make the merge work.
 */
function authoredGeometry(entries: readonly GeometryEntry[], ctx: GeometryStageContext, baselines: ReadonlyMap<string, MandatoryBaseline>): AuthoredGeometry {
  const stage = "architectural-geometry" as const;
  const byMassId = new Map<string, MassGeometryResult>();
  const capabilityIntents: CapabilityIntent[] = [];
  const capabilityRequests: CapabilityRequest[] = [];
  const conflicts: StageConflict[] = [];
  const entryById = new Map(entries.map((e) => [e.massId, e] as const));
  const masses = ctx.masses.map((mass) => {
    const entry = entryById.get(mass.id);
    if (!entry) return mass;
    const baseline = baselines.get(mass.id)!;
    const conflict = (code: string, detail: string) => conflicts.push({ stage, code, massId: mass.id, detail: `"${mass.id}": ${detail}` });
    const refined = refineBaseline(baseline, entry.refinements ?? []);
    for (const v of refined.violations) conflict(v.code, v.detail);
    const { operations, openings, intents } = baselineParts(refined.elements);
    const addIntent = (intent: CapabilityIntent, what: string) => {
      const duplicate = duplicatesBaselineCapability(baseline, intent);
      if (duplicate) conflict("baseline-duplicate", `the ${what} duplicates the mandatory ${duplicate.id}, which is already built. Do not repeat it — refine it by id.`);
      else intents.push(intent);
    };
    entry.operations.forEach((op, index) => {
      const id = `${mass.id}:geometry:${index + 1}`;
      if (FACADE_ELEMENTS.has(op.type)) {
        if (op.type !== "screen" && !pluginAligned(mass.rotation)) conflict("unbuildable-geometry", `it is turned off the site axes, so a ${op.type} cannot be built on it. Use a screen or deep glazing reveals instead.`);
        else addIntent(facadeElementIntent(op, mass), `added ${op.type} on the ${op.facade} facade`);
      } else if (FOOTPRINT_TYPES.has(op.type)) operations.push({ ...(toDocumentOp(op) as MassGeometryOperation), id });
      else openings.push({ ...(toDocumentOp(op) as MassOpening), id });
    });
    if (entry.requestedOperation) {
      const normalized = normalizeCapability(entry.requestedOperation);
      const capability = normalized ? capabilityById(normalized) : undefined;
      if (capability?.status === "supported") addIntent(parameterizeCapabilityIntent({ id: capability.id, stage, parameters: { massId: entry.massId } }, ctx.masses, ctx.siteStrategy), `requested ${capability.id}`);
      else capabilityRequests.push({ operation: normalized ?? entry.requestedOperation, stage, desiredBehaviour: `Requested for mass ${entry.massId}` });
    }
    capabilityIntents.push(...intents);
    byMassId.set(mass.id, { operations, openings, planNotes: baseline.notes });
    return { ...mass, operations, openings };
  });
  for (const mass of masses) if (byMassId.has(mass.id)) conflicts.push(...geometryConflicts(mass, masses, ctx.siteStrategy, capabilityIntents));
  return { byMassId, masses, capabilityIntents, capabilityRequests, conflicts };
}

/**
 * One batched call authors every mass's geometry together — every mass is placed, and the model can balance
 * emphasis only by seeing the whole composition. Each mass's mandatory baseline is compiled from its plan first
 * (`mandatoryBaseline`) and given to the model as immutable, already-built geometry; the model returns only
 * refinements of it and additions to it.
 */
export async function runGeometryStage(ctx: GeometryStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<GeometryStageResult> {
  const ids = ctx.masses.map((m) => m.id);
  const baselines = new Map(ctx.masses.map((m) => [m.id, mandatoryBaseline(m, ctx.masses, ctx.siteStrategy)] as const));
  // A mandatory requirement the placement cannot carry belongs to the stage that placed the volume. The model is
  // never asked to relocate it, so the stage fails before any call.
  const upstream: StageConflict[] = ctx.masses.flatMap((m) => baselines.get(m.id)!.conflicts.map((c) => ({ stage: placementOwner(m, ctx.masses, c.code), code: "plan-unbuildable", massId: m.id, detail: `"${m.id}": ${c.detail}` })));
  if (upstream.length) {
    const owningStage = upstream.some((c) => c.stage === "foundation") ? "foundation" : "mass-expansion";
    return { ok: false, errors: repairRequests(upstream), attempts: 0, durationMs: 0, owningStage };
  }
  const result = await runStage({
    stageName: "architectural-geometry",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${ctx.brief}`,
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; hierarchy goals: ${ctx.intent.hierarchyGoals.join("; ")}.`,
      `Site: environment=${ctx.siteStrategy.environment}, view faces ${ctx.siteStrategy.viewDirection}, arrival from ${ctx.siteStrategy.arrivalDirection}.`,
      `Masses (${ctx.masses.length}) — facades are LOCAL to each mass (already resolved from its rotation):\n${ctx.masses.map((m) => describeMass(m, ctx.masses, ctx.siteStrategy, baselines.get(m.id)!)).join("\n")}`,
      `Return exactly one entry per mass listed above, using its exact id: its "operations" (additions only — never a baseline element again) and any "refinements" of its baseline by id. "start"/"end" are normalized 0..1 along the facade (0 = its west end for north/south, its north end for east/west).`,
      previousErrors.length ? `Your previous attempt was rejected — repair exactly these and return every mass again:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: geometryStageOutputSchema,
    normalize: normalizeGeometryOutput,
    timings, remainingBudgetMs, usageMeta,
    // Each entry carries its whole operation list (often 5-8 operations) as full JSON objects; the old 260 + 320/mass
    // budget cut a 4-mass response off mid-array.
    maxOutputTokens: 900 + ctx.masses.length * 520,
    validate: (value) => {
      const errors: string[] = [];
      const seen = new Set<string>();
      for (const entry of value.results) {
        if (!ids.includes(entry.massId)) { errors.push(`Unknown mass id "${entry.massId}". Use one of: ${ids.join(", ")}.`); continue; }
        if (seen.has(entry.massId)) { errors.push(`Duplicate entry for mass "${entry.massId}".`); continue; }
        seen.add(entry.massId);
      }
      for (const id of ids) if (!seen.has(id)) errors.push(`Missing an entry for mass "${id}".`);
      return errors.length ? errors : repairRequests(authoredGeometry(value.results, ctx, baselines).conflicts);
    },
  });
  const repairs = result.repairRequests ? { repairRequests: result.repairRequests } : {};
  if (!result.ok) return { ok: false, errors: result.errors, attempts: result.attempts, durationMs: result.durationMs, ...repairs };
  const authored = authoredGeometry(result.value.results, ctx, baselines);
  return { ok: true, byMassId: authored.byMassId, capabilityIntents: authored.capabilityIntents, capabilityRequests: authored.capabilityRequests, attempts: result.attempts, durationMs: result.durationMs, ...repairs };
}
