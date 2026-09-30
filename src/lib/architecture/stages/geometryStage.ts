import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { CapabilityRequest } from "@/types/library";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import { capabilityById, normalizeCapability } from "@/lib/library/capabilities";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassGeometryOperation, MassOpening, MassVolume, SiteStrategy } from "../document";
import { arrivalPrivacyFor, conflicts, describeVolumePlan, parameterizeCapabilityIntent, realizeVolumePlan, type PlanRealization } from "../volumePlan";
import { runStage, type RunStageResult } from "./runStage";
import { geometryOperationSchema, geometryStageOutputSchema, type GeometryOperationOutput, GEOMETRY_OPERATION_TYPES, KNOWN_CAPABILITY_IDS } from "./schemas";
import { clampNearBound } from "./numericNormalization";

const SYSTEM = `You are a senior residential architect turning each volume's already-decided architectural PLAN into built form, all at once. Every volume was planned when it was placed — its form, height, facade treatments, entry, outdoor transition, structure and roof edge — and you are given that plan plus a BASELINE realization of it in this geometry vocabulary: ${GEOMETRY_OPERATION_TYPES.join(", ")}. Your job is to refine the baseline so the plan reads as strongly as possible for this brief — adjust where along a facade a covered terrace or glazing sits and how wide/deep it is, proportion a notch or prow, add a secondary move that serves the plan (a shaded bay on a glazed facade, a framed slot) — never to invent a different design. Return the complete final operation list per mass (baseline items you keep must be repeated). Rules the plan fixes: never glaze a facade the plan keeps solid or any shared wall; a "punched"/"slot" facade takes opening-rhythm, a glass facade takes glazing-zone; keep the planned form (notch = l-shape, chamfer = prow, floors:"upper" recess = setback) at its planned corner; keep the entry-recess and a pass-through door on the arrival facade and the open (open:true) projection on the planned outdoor side. Anything you drop that the plan requires is restored from the baseline, and anything that contradicts the plan is discarded — so spend your effort on proportion and placement. Vocabulary: "recess"/"projection" push part of one facade in or out ("open": true makes the interval wall-less — a veranda/covered terrace; "postSpacing" adds a colonnade rhythm); "notch" cuts a rectangular corner bite; "chamfer" cuts one corner at an angle ("width" = cut size; "glazed": true = glass prow); "entry-recess" is a centered recess on the arrival facade; "glazing-zone" is one wide glazed panel ("frame": true = heavy structural surround, "reveal" = glass set back from the wall face); "opening-rhythm" is a row of evenly repeated windows; "door" is a grade-level pass-through. If a volume needs a freestanding element, request it by exact id via requestedOperation: ${KNOWN_CAPABILITY_IDS.join(", ")}; for anything else outside this vocabulary (e.g. a curved wall), name it in plain words.`;

export interface GeometryStageContext { brief: string; intent: ArchitecturalIntent; siteStrategy: SiteStrategy; masses: readonly MassVolume[]; }

export interface MassGeometryResult {
  operations: readonly MassGeometryOperation[];
  openings: readonly MassOpening[];
  cantilever?: MassVolume["cantilever"];
  /** Where the plan could not be realized as asked, or the model's proposal was overruled by it. */
  planNotes: readonly string[];
}

export interface GeometryStageResult {
  byMassId: Map<string, MassGeometryResult>;
  capabilityIntents: CapabilityIntent[];
  capabilityRequests: CapabilityRequest[];
  /** The model call failed and nothing was salvageable; every mass gets its plan's baseline realization instead — never a hard failure of the pipeline, and never a plain box. */
  hadFailure: boolean;
  /**
   * Both attempts failed validation/parsing, but some masses' refinements came through intact and were kept
   * (see `salvageGeometryOutput`); the rest got their baseline. Undefined on a clean success or a full fallback.
   */
  salvage?: { salvagedMassIds: string[]; baselineMassIds: string[]; droppedOperations: number; error: string };
  attempts: number;
  durationMs: number;
}

const FOOTPRINT_TYPES = new Set<GeometryOperationOutput["type"]>(["recess", "projection", "notch", "entry-recess", "chamfer"]);

/** `min(width,depth) * ratio`, bounded — used to size a footprint op's depth/width from the mass it's on rather than a fixed constant, so a small mass doesn't get a canyon-deep recess. */
const scaledDefault = (a: number, b: number, ratio: number, min: number, max: number) => Math.max(min, Math.min(max, Math.min(a, b) * ratio));

/**
 * Same recovery principle as mass-expansion's `rotationOffset` normalization: a small overshoot on one of
 * this schema's bounded numeric fields (start/end/depth/width/heightRatio/height/sill) is model rounding,
 * not a structurally broken response, so it's clamped locally instead of costing a repair retry.
 *
 * Also fills in a handful of required-but-inferable fields the live pipeline actually saw omitted (e.g. an
 * otherwise-valid `entry-recess` missing `depth`) with a bounded default derived from the mass's own
 * dimensions, instead of failing schema validation and forcing a full repair-retry model call for a value
 * that was never architecturally ambiguous in the first place. `start`/`end` (recess/projection/glazing-
 * zone) are never defaulted — WHERE along a facade is a real design decision, not an inferable constant — so
 * an op missing those still fails normally and gets a real repair retry.
 */
function normalizeGeometryOutput(raw: unknown, massById: ReadonlyMap<string, { width: number; depth: number }>): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.results)) return raw;
  return {
    ...value,
    results: value.results.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const e = entry as Record<string, unknown>;
      if (!Array.isArray(e.operations)) return e;
      const mass = typeof e.massId === "string" ? massById.get(e.massId) : undefined;
      return {
        ...e,
        operations: e.operations.map((op) => {
          if (!op || typeof op !== "object") return op;
          const o = { ...(op as Record<string, unknown>) };
          const clamp = (key: string, min: number, max: number) => {
            if (key in o) { const recovered = clampNearBound(o[key], min, max); if (recovered !== undefined) o[key] = recovered; }
          };
          const defaultIfMissing = (key: string, value: number) => { if (o[key] === undefined || o[key] === null) o[key] = value; };
          clamp("start", 0, 1);
          clamp("end", 0, 1);
          clamp("depth", 0.3, 4);
          clamp("width", 0.5, 8);
          clamp("heightRatio", 0.2, 0.95);
          clamp("height", 0.6, 3);
          clamp("sill", 0, 1.5);
          if (mass) {
            const type = o.type;
            if (type === "recess" || type === "projection" || type === "notch" || type === "entry-recess") defaultIfMissing("depth", scaledDefault(mass.width, mass.depth, 0.12, 0.6, 1.6));
            if (type === "notch" || type === "entry-recess" || type === "chamfer") defaultIfMissing("width", scaledDefault(mass.width, mass.depth, 0.25, 1.2, 5));
            if (type === "glazing-zone") defaultIfMissing("heightRatio", 0.75);
            if (type === "opening-rhythm") { defaultIfMissing("width", 1.2); defaultIfMissing("height", 1.4); defaultIfMissing("sill", 0.8); defaultIfMissing("count", 3); }
          }
          return o;
        }),
      };
    }),
  };
}

/** Compact enough to repeat per mass, explicit enough that "keep the baseline" is a copy, not a reconstruction. */
function describeBaseline(realization: PlanRealization): string {
  const items = [...realization.operations, ...realization.openings];
  return items.length ? JSON.stringify(items.map((op) => (op.type === "chamfer" ? { ...op, size: undefined, width: op.size } : op))) : "[] (plain volume)";
}

type GeometryEntry = { massId: string; operations: GeometryOperationOutput[]; requestedOperation?: string };

/**
 * Last-resort recovery once every attempt failed: keeps each mass entry that is individually usable instead
 * of throwing away the whole refinement because one operation (or the response's cut-off tail) was bad. An
 * invalid operation is dropped on its own — `conformToPlan` restores anything the plan requires from the
 * baseline, so a dropped op can never cost the plan, only that one refinement. When the raw value was
 * truncated, its last entry is discarded entirely: a cut-off operation list (or a number cut mid-digit) must
 * never pass for a finished design, so that mass falls back to its baseline like any missing one.
 */
export function salvageGeometryOutput(raw: unknown, ids: readonly string[], massById: ReadonlyMap<string, { width: number; depth: number }>, truncated: boolean): { entries: GeometryEntry[]; droppedOperations: number } {
  const normalized = normalizeGeometryOutput(raw, massById);
  const results = normalized && typeof normalized === "object" && Array.isArray((normalized as { results?: unknown }).results) ? (normalized as { results: unknown[] }).results : [];
  const candidates = truncated ? results.slice(0, -1) : results;
  const entries: GeometryEntry[] = [];
  let droppedOperations = 0;
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const e = candidate as Record<string, unknown>;
    if (typeof e.massId !== "string" || !ids.includes(e.massId) || entries.some((x) => x.massId === e.massId) || !Array.isArray(e.operations)) continue;
    const operations: GeometryOperationOutput[] = [];
    for (const op of e.operations.slice(0, 8)) {
      const parsed = geometryOperationSchema.safeParse(op);
      if (parsed.success) operations.push(parsed.data); else droppedOperations++;
    }
    droppedOperations += Math.max(0, e.operations.length - 8);
    const requestedOperation = typeof e.requestedOperation === "string" && e.requestedOperation.length > 0 && e.requestedOperation.length <= 60 ? e.requestedOperation : undefined;
    entries.push({ massId: e.massId, operations, ...(requestedOperation ? { requestedOperation } : {}) });
  }
  return { entries, droppedOperations };
}

const describeMass = (m: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, baseline: PlanRealization) =>
  `${m.id} "${m.name}", role ${m.role}, ${m.width.toFixed(1)}x${m.depth.toFixed(1)}m, ${m.floors} floor(s), rotation ${(m.rotation * 180 / Math.PI).toFixed(0)}°.\n  PLAN: ${describeVolumePlan(m, masses, site)}\n  BASELINE: ${describeBaseline(baseline)}`;

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

/** Restore only required plan components the otherwise-valid architect response omitted. */
function completeCriticalPlanElements(operations: MassGeometryOperation[], openings: MassOpening[], baseline: PlanRealization, mass: MassVolume): { operations: MassGeometryOperation[]; openings: MassOpening[]; notes: string[] } {
  const notes: string[] = [];
  let completeOperations = [...operations];
  for (const required of baseline.operations.filter((op) => op.type === "entry-recess")) {
    if (!completeOperations.some((op) => op.type === "entry-recess" && op.facade === required.facade)) completeOperations.push(required);
  }
  // The planned outdoor room is how this volume meets the outside. The model may move or reshape it (any open
  // edge it authors stands), but a refinement that drops every open edge loses the plan's indoor-outdoor move,
  // so the planned one is restored — displacing only a plain recess/projection it would collide with.
  const isOpen = (op: MassGeometryOperation) => (op.type === "projection" || op.type === "recess") && op.open === true;
  if (!completeOperations.some(isOpen)) {
    for (const required of baseline.operations.filter(isOpen)) {
      const blocking = completeOperations.filter((op) => conflicts(op, required, mass));
      if (blocking.some((op) => op.type !== "projection" && op.type !== "recess")) { notes.push(`planned ${required.type} terrace on ${"facade" in required ? required.facade : "?"} not restored — it collides with an authored ${blocking[0].type}.`); continue; }
      completeOperations = completeOperations.filter((op) => !blocking.includes(op));
      completeOperations.push(required);
      notes.push(`restored the planned open ${required.type} on the ${"facade" in required ? required.facade : "?"} facade${blocking.length ? `, replacing ${blocking.length} colliding operation(s)` : ""}.`);
    }
  }
  const completeOpenings = [...openings];
  for (const required of baseline.openings) {
    if (!completeOpenings.some((op) => op.type === required.type && op.facade === required.facade)) completeOpenings.push(required);
  }
  return { operations: completeOperations, openings: completeOpenings, notes };
}

function baselineResult(masses: readonly MassVolume[], baselines: ReadonlyMap<string, PlanRealization>, attempts: number, durationMs: number): GeometryStageResult {
  const byMassId = new Map(masses.map((m) => {
    const b = baselines.get(m.id)!;
    return [m.id, { operations: b.operations, openings: b.openings, ...(b.cantilever ? { cantilever: b.cantilever } : {}), planNotes: b.notes }] as const;
  }));
  return { byMassId, capabilityIntents: masses.flatMap((m) => baselines.get(m.id)!.capabilityIntents), capabilityRequests: [], hadFailure: true, attempts, durationMs };
}

/**
 * Realizes every mass's plan deterministically first (`realizeVolumePlan`), then one batched call refines
 * those realizations together — same reasoning as roof composition: every mass is placed, and the model can
 * balance emphasis only by seeing the whole composition. The model's output is merged back through
 * `conformToPlan`, so the plan always drives the geometry; a failed call builds the baseline realization.
 */
export async function runGeometryStage(ctx: GeometryStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<GeometryStageResult> {
  const ids = ctx.masses.map((m) => m.id);
  const massById = new Map(ctx.masses.map((m) => [m.id, { width: m.width, depth: m.depth }] as const));
  const baselines = new Map(ctx.masses.map((m) => [m.id, realizeVolumePlan(m, ctx.masses, ctx.siteStrategy)] as const));
  const result: RunStageResult<{ results: GeometryEntry[] }> = await runStage({
    stageName: "architectural-geometry",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${ctx.brief}`,
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; hierarchy goals: ${ctx.intent.hierarchyGoals.join("; ")}.`,
      `Site: environment=${ctx.siteStrategy.environment}, view faces ${ctx.siteStrategy.viewDirection}, arrival from ${ctx.siteStrategy.arrivalDirection}.`,
      `Masses (${ctx.masses.length}) — facades are LOCAL to each mass (already resolved from its rotation):\n${ctx.masses.map((m) => describeMass(m, ctx.masses, ctx.siteStrategy, baselines.get(m.id)!)).join("\n")}`,
      `Return exactly one entry per mass listed above, using its exact id, with its complete final operation list. "start"/"end" are normalized 0..1 along the facade (0 = its west end for north/south, its north end for east/west).`,
      previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: geometryStageOutputSchema,
    normalize: (raw) => normalizeGeometryOutput(raw, massById),
    timings, remainingBudgetMs, usageMeta,
    // Each entry repeats its baseline (often 5-8 operations) as full JSON objects; the old 260 + 320/mass budget
    // cut a 4-mass response off mid-array, so both attempts "failed to parse" and every refinement was lost.
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
      return errors;
    },
  });
  let entries: GeometryEntry[];
  let salvage: GeometryStageResult["salvage"];
  if (result.ok) entries = result.value.results;
  else {
    const salvaged = result.rawValue === undefined ? { entries: [], droppedOperations: 0 } : salvageGeometryOutput(result.rawValue, ids, massById, result.rawValueTruncated === true);
    if (salvaged.entries.length === 0) return baselineResult(ctx.masses, baselines, result.attempts, result.durationMs);
    entries = salvaged.entries;
    const salvagedMassIds = entries.map((e) => e.massId);
    salvage = { salvagedMassIds, baselineMassIds: ids.filter((id) => !salvagedMassIds.includes(id)), droppedOperations: salvaged.droppedOperations, error: result.errors.join("; ") };
  }

  const byMassId = new Map<string, MassGeometryResult>();
  const capabilityIntents: CapabilityIntent[] = [];
  const capabilityRequests: CapabilityRequest[] = [];
  const massesById = new Map(ctx.masses.map((m) => [m.id, m] as const));
  for (const entry of entries) {
    const operations: MassGeometryOperation[] = [];
    const openings: MassOpening[] = [];
    for (const op of entry.operations) {
      const converted = toDocumentOp(op);
      if (FOOTPRINT_TYPES.has(op.type)) operations.push(converted as MassGeometryOperation);
      else openings.push(converted as MassOpening);
    }
    const mass = massesById.get(entry.massId)!;
    // A schema-valid response is the architect's executable geometry. `volumePlan` supplies geometry only
    // when this stage fails or a salvaged response omits a mass; it does not reinterpret valid authored form.
    const baseline = baselines.get(entry.massId)!;
    const completed = completeCriticalPlanElements(operations, openings, baseline, mass);
    // Privacy is re-applied to what the model actually authored, not just to the baseline it may have replaced.
    const privacy = arrivalPrivacyFor(mass, ctx.masses, ctx.siteStrategy, completed.openings, baseline.capabilityIntents);
    byMassId.set(entry.massId, { operations: completed.operations, openings: privacy.openings, ...(mass.cantilever ? { cantilever: mass.cantilever } : {}), planNotes: [...completed.notes, ...privacy.notes] });
    capabilityIntents.push(...baseline.capabilityIntents, ...privacy.capabilityIntents);
    if (entry.requestedOperation) {
      const normalized = normalizeCapability(entry.requestedOperation);
      const capability = normalized ? capabilityById(normalized) : undefined;
      if (capability?.status === "supported") capabilityIntents.push(parameterizeCapabilityIntent({ id: capability.id, stage: "architectural-geometry", parameters: { massId: entry.massId } }, ctx.masses, ctx.siteStrategy));
      else capabilityRequests.push({ operation: normalized ?? entry.requestedOperation, stage: "architectural-geometry", desiredBehaviour: `Requested for mass ${entry.massId}` });
    }
  }
  // Every mass not returned in `results` (only after a salvage — `validate` rejects a short list) gets its baseline realization.
  for (const mass of ctx.masses) {
    if (byMassId.has(mass.id)) continue;
    const b = baselines.get(mass.id)!;
    byMassId.set(mass.id, { operations: b.operations, openings: b.openings, ...(b.cantilever ? { cantilever: b.cantilever } : {}), planNotes: b.notes });
    capabilityIntents.push(...b.capabilityIntents);
  }

  return { byMassId, capabilityIntents, capabilityRequests, hadFailure: false, ...(salvage ? { salvage } : {}), attempts: result.attempts, durationMs: result.durationMs };
}
