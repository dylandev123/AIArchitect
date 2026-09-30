import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { CapabilityRequest } from "@/types/library";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import type { CompassSide } from "@/types/house";
import { capabilityById, normalizeCapability } from "@/lib/library/capabilities";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassGeometryOperation, MassOpening, MassVolume, SiteStrategy } from "../document";
import { describeVolumePlan, localFacadeToward, parameterizeCapabilityIntent, pluginAligned, realizeVolumePlan, worldSideOf, type PlanRealization } from "../volumePlan";
import { runStage } from "./runStage";
import { geometryStageOutputSchema, type GeometryOperationOutput, type GeometryStageOutput, FACADE_ELEMENT_TYPES, GEOMETRY_OPERATION_TYPES, KNOWN_CAPABILITY_IDS } from "./schemas";
import { clampNearBound } from "./numericNormalization";
import { geometryConflicts } from "./integrityChecks";
import { repairRequests, type StageConflict } from "./recovery";

const SYSTEM = `You are a senior residential architect authoring the built form of every volume of a composition, all at once. Every volume was planned when it was placed — its form, height, facade treatments, entry, outdoor transition, structure and roof edge — and you are given that plan plus a REFERENCE realization of it in this geometry vocabulary: ${GEOMETRY_OPERATION_TYPES.join(", ")}. The reference is only a starting point: YOU author the actual geometry — every form move, terrace and veranda, all glazing, every door, canopy and screen. Exactly what you return is built; nothing is added, moved, restored or corrected for you. Return the complete final operation list per mass.
Every planned element must be present in what you author, or your response is rejected and sent back: the planned form (notch = l-shape, chamfer = prow, floors:"upper" recess = setback) — which corner or facade it takes is yours to decide; the planned outdoor room as an open (open:true) projection or recess — the reference shows the planned side, place it where it serves the design; the planned entry-recess with a door INSIDE it (an entry-recess with no door is rejected — no door is supplied for you); a flush entry as a door on the arrival facade; glazing on every facade planned as glass (glazing-zone) and windows on every facade planned "punched"/"slot" (opening-rhythm); a planned canopy, screen or sun fins as a canopy / screen / sun-fins operation on its planned facade. Never author anything on a shared wall (a facade another volume stands against). Proportion and place everything for this brief — where along a facade a terrace or glazing sits, how wide and deep it is — and add secondary moves that serve the plan.
Vocabulary: "recess"/"projection" push part of one facade in or out ("open": true makes the interval wall-less — a veranda/covered terrace; "postSpacing" adds a colonnade rhythm); "notch" cuts a rectangular corner bite; "chamfer" cuts one corner at an angle ("width" = cut size; "glazed": true = glass prow); "entry-recess" is a centered recess on the arrival facade; "glazing-zone" is one wide glazed panel ("frame": true = heavy structural surround, "reveal" = glass set back from the wall face); "opening-rhythm" is a row of evenly repeated windows; "door" is a grade-level pass-through; "canopy" is a projecting entry canopy (facade, width, depth, optional height); "screen" is a batten screen layer standing off a facade span (facade, start, end, optional depth); "sun-fins" is a row of vertical sun fins on a facade (facade, count, optional depth/height/sill). Canopy and sun-fins can only be built on a volume that is not turned off the site axes. If a volume needs another freestanding element, request it by exact id via requestedOperation: ${KNOWN_CAPABILITY_IDS.join(", ")}; for anything else outside this vocabulary (e.g. a curved wall), name it in plain words.`;

export interface GeometryStageContext { brief: string; intent: ArchitecturalIntent; siteStrategy: SiteStrategy; masses: readonly MassVolume[]; }

export interface MassGeometryResult {
  operations: readonly MassGeometryOperation[];
  openings: readonly MassOpening[];
  /** How the plan's reference realization had to adapt (diagnostics only — the geometry above is the architect's). */
  planNotes: readonly string[];
}

/**
 * The Geometry Pass either authors every volume's geometry (`ok: true`) or fails. The plan's reference
 * realization is never built in its place: a response that leaves out planned geometry, or cannot be built, is
 * a repair request inside this stage's retry budget, and an exhausted budget fails the generation.
 */
export type GeometryStageResult =
  | { ok: true; byMassId: Map<string, MassGeometryResult>; capabilityIntents: CapabilityIntent[]; capabilityRequests: CapabilityRequest[]; attempts: number; durationMs: number; repairRequests?: string[] }
  | { ok: false; errors: string[]; attempts: number; durationMs: number; repairRequests?: string[] };

const FOOTPRINT_TYPES = new Set<GeometryOperationOutput["type"]>(["recess", "projection", "notch", "entry-recess", "chamfer"]);
const FACADE_ELEMENTS = new Set<GeometryOperationOutput["type"]>(FACADE_ELEMENT_TYPES);

/**
 * Safe numeric normalization only — same principle as mass-expansion's `rotationOffset`: a small overshoot on
 * one of this schema's bounded numeric fields (start/end/depth/width/heightRatio/height/sill) is model
 * rounding, so it is clamped to the bound it grazed instead of costing a repair retry. A MISSING field is never
 * filled in: how deep a recess is or how many windows a facade takes is the architect's decision, so an
 * operation that omits one fails the schema and is sent back as a repair request.
 */
function normalizeGeometryOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.results)) return raw;
  return {
    ...value,
    results: value.results.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const e = entry as Record<string, unknown>;
      if (!Array.isArray(e.operations)) return e;
      return {
        ...e,
        operations: e.operations.map((op) => {
          if (!op || typeof op !== "object") return op;
          const o = { ...(op as Record<string, unknown>) };
          const clamp = (key: string, min: number, max: number) => {
            if (key in o) { const recovered = clampNearBound(o[key], min, max); if (recovered !== undefined) o[key] = recovered; }
          };
          clamp("start", 0, 1);
          clamp("end", 0, 1);
          clamp("depth", 0.3, 4);
          clamp("width", 0.5, 8);
          clamp("heightRatio", 0.2, 0.95);
          clamp("height", 0.6, 3);
          clamp("sill", 0, 1.5);
          return o;
        }),
      };
    }),
  };
}

/** The reference realization in the stage's own vocabulary, so "keep this element" is a copy, not a reconstruction. */
function describeBaseline(realization: PlanRealization, mass: MassVolume): string {
  const local = (intent: CapabilityIntent) => localFacadeToward(intent.parameters!.facade as CompassSide, mass.rotation);
  const elements = realization.capabilityIntents.flatMap((intent): Record<string, unknown>[] => {
    const p = intent.parameters ?? {};
    if (intent.id === "entry-canopy") return [{ type: "canopy", facade: local(intent), width: p.width, depth: p.depth, height: p.height }];
    if (intent.id === "screen-layer") return [{ type: "screen", facade: local(intent), start: p.start, end: p.end, depth: p.depth }];
    if (intent.id === "brise-soleil") return [{ type: "sun-fins", facade: local(intent), count: p.count, depth: p.depth, sill: p.sill }];
    return [];
  });
  const items = [...realization.operations.map((op) => (op.type === "chamfer" ? { ...op, size: undefined, width: op.size } : op)), ...realization.openings, ...elements];
  return items.length ? JSON.stringify(items) : "[] (plain volume)";
}

type GeometryEntry = GeometryStageOutput["results"][number];

const describeMass = (m: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, baseline: PlanRealization) =>
  `${m.id} "${m.name}", role ${m.role}, ${m.width.toFixed(1)}x${m.depth.toFixed(1)}m, ${m.floors} floor(s), rotation ${(m.rotation * 180 / Math.PI).toFixed(0)}°.\n  PLAN: ${describeVolumePlan(m, masses, site)}\n  REFERENCE: ${describeBaseline(baseline, m)}`;

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

/**
 * Turns a structurally valid response into the geometry it authors — a pure conversion, one-to-one with what
 * the architect returned — and measures it (see `geometryConflicts`). The only thing taken from the plan's
 * reference realization is a structural element the plan itself names and this vocabulary cannot author
 * (pilotis under a raised volume).
 */
function authoredGeometry(entries: readonly GeometryEntry[], ctx: GeometryStageContext, baselines: ReadonlyMap<string, PlanRealization>): AuthoredGeometry {
  const byMassId = new Map<string, MassGeometryResult>();
  const capabilityIntents: CapabilityIntent[] = [];
  const capabilityRequests: CapabilityRequest[] = [];
  const conflicts: StageConflict[] = [];
  const entryById = new Map(entries.map((e) => [e.massId, e] as const));
  const masses = ctx.masses.map((mass) => {
    const entry = entryById.get(mass.id);
    if (!entry) return mass;
    const operations: MassGeometryOperation[] = [];
    const openings: MassOpening[] = [];
    for (const op of entry.operations) {
      if (FACADE_ELEMENTS.has(op.type)) {
        if (op.type !== "screen" && !pluginAligned(mass.rotation)) conflicts.push({ stage: "architectural-geometry", code: "unbuildable-geometry", massId: mass.id, detail: `"${mass.id}" is turned off the site axes, so a ${op.type} cannot be built on it. Use a screen or deep glazing reveals instead.` });
        else capabilityIntents.push(facadeElementIntent(op, mass));
      } else if (FOOTPRINT_TYPES.has(op.type)) operations.push(toDocumentOp(op) as MassGeometryOperation);
      else openings.push(toDocumentOp(op) as MassOpening);
    }
    const baseline = baselines.get(mass.id)!;
    capabilityIntents.push(...baseline.capabilityIntents.filter((intent) => intent.id === "pilotis"));
    if (entry.requestedOperation) {
      const normalized = normalizeCapability(entry.requestedOperation);
      const capability = normalized ? capabilityById(normalized) : undefined;
      if (capability?.status === "supported") capabilityIntents.push(parameterizeCapabilityIntent({ id: capability.id, stage: "architectural-geometry", parameters: { massId: entry.massId } }, ctx.masses, ctx.siteStrategy));
      else capabilityRequests.push({ operation: normalized ?? entry.requestedOperation, stage: "architectural-geometry", desiredBehaviour: `Requested for mass ${entry.massId}` });
    }
    byMassId.set(mass.id, { operations, openings, planNotes: baseline.notes });
    return { ...mass, operations, openings };
  });
  for (const mass of masses) if (byMassId.has(mass.id)) conflicts.push(...geometryConflicts(mass, masses, ctx.siteStrategy, capabilityIntents));
  return { byMassId, masses, capabilityIntents, capabilityRequests, conflicts };
}

/**
 * One batched call authors every mass's geometry together — every mass is placed, and the model can balance
 * emphasis only by seeing the whole composition. Each mass's plan is realized deterministically first
 * (`realizeVolumePlan`) purely as the reference the model is shown and the target its answer is measured
 * against; the geometry that is built is exactly what the model returns.
 */
export async function runGeometryStage(ctx: GeometryStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<GeometryStageResult> {
  const ids = ctx.masses.map((m) => m.id);
  const baselines = new Map(ctx.masses.map((m) => [m.id, realizeVolumePlan(m, ctx.masses, ctx.siteStrategy)] as const));
  const result = await runStage({
    stageName: "architectural-geometry",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${ctx.brief}`,
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; hierarchy goals: ${ctx.intent.hierarchyGoals.join("; ")}.`,
      `Site: environment=${ctx.siteStrategy.environment}, view faces ${ctx.siteStrategy.viewDirection}, arrival from ${ctx.siteStrategy.arrivalDirection}.`,
      `Masses (${ctx.masses.length}) — facades are LOCAL to each mass (already resolved from its rotation):\n${ctx.masses.map((m) => describeMass(m, ctx.masses, ctx.siteStrategy, baselines.get(m.id)!)).join("\n")}`,
      `Return exactly one entry per mass listed above, using its exact id, with its complete final operation list. "start"/"end" are normalized 0..1 along the facade (0 = its west end for north/south, its north end for east/west).`,
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
