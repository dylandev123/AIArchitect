import { completeComposition } from "./compositionCompletion";
import type { CompassSide, ProjectScale, SiteEnvironment } from "@/types/house";
import type { DesignRecipe, CapabilityRequest } from "@/types/library";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { Timings } from "@/lib/ai/timing";
import type { SiteHints } from "@/lib/house/siteSettings";
import type { ArchitecturalDesignDocument, MassVolume, RoofRecipe, SiteStrategy } from "../document";
import { runFoundationStage, type FoundationStageResult, type FoundationStageRunResult } from "./foundationStage";
import { plannedVolumesFromSpacePlan, runMassExpansionStage, type MassExpansionResult, type MassExpansionStopReason, type PlannedVolume, type UnplacedVolume } from "./massExpansionStage";
import { createSpacePlan, selectDesignStrategies, type ArchitecturalDesign, type ArchitecturalIntent } from "../designEngine";
import { runGeometryStage, type GeometryStageResult, type MassGeometryResult } from "./geometryStage";
import { fallbackRoofs, runRoofCompositionStage } from "./roofStage";
import { mergeCapabilityIntents, parameterizeCapabilityIntent } from "../volumePlan";
import { toArchitecturalDesign } from "./toArchitecturalDesign";
import type { StageDiagnostics } from "./diagnostics";
import { siteStrategyInvariantSchema } from "./schemas";

const TOTAL_STAGES = 6;

export type PipelineStageEvent =
  | { type: "stage"; stage: "intent" | "site-strategy" | "primary-mass" | "mass-expansion" | "architectural-geometry" | "roof-composition"; index: number; of: typeof TOTAL_STAGES; document: ArchitecturalDesignDocument }
  | { type: "mass-added"; stage: "mass-expansion"; massesSoFar: number; document: ArchitecturalDesignDocument }
  | { type: "roof-added"; stage: "roof-composition"; massId: string; roofsSoFar: number; totalMasses: number; document: ArchitecturalDesignDocument };

/** Applies the Architectural Geometry Pass's per-mass result onto the resolved mass list — pure data merge, no placement math (that already happened in mass-expansion). A cantilever mass expansion placed explicitly wins over the plan's. */
function applyGeometry(masses: readonly MassVolume[], byMassId: ReadonlyMap<string, MassGeometryResult>): MassVolume[] {
  return masses.map((mass) => {
    const result = byMassId.get(mass.id);
    if (!result || (result.operations.length === 0 && result.openings.length === 0 && !result.cantilever)) return mass;
    const cantilever = mass.cantilever ?? result.cantilever;
    return { ...mass, operations: result.operations, openings: result.openings, ...(cantilever ? { cantilever } : {}) };
  });
}

/**
 * Every capability intent the stages produced, with facade-bound ones parameterized from the final
 * orientation (a by-name request carries only a mass id) and duplicates collapsed onto the fullest one.
 */
function finalCapabilityIntents(intents: readonly NonNullable<ArchitecturalDesignDocument["capabilities"]>[number][], masses: readonly MassVolume[], siteStrategy: SiteStrategy) {
  return mergeCapabilityIntents(intents.map((intent) => parameterizeCapabilityIntent(intent, masses, siteStrategy)));
}

const isDev = process.env.NODE_ENV !== "production";

function completedMasses(masses: readonly MassVolume[], intent: Parameters<typeof completeComposition>[1], siteStrategy: SiteStrategy): MassVolume[] {
  const completion = completeComposition(masses, intent, siteStrategy);
  if (isDev && completion.notes.length) console.debug("[composition-completion]", completion.notes);
  return completion.masses;
}
function logPlanNotes(byMassId: ReadonlyMap<string, MassGeometryResult>): void {
  if (!isDev) return;
  for (const [massId, result] of byMassId) if (result.planNotes.length) console.debug(`[architectural-geometry] ${massId} plan notes:`, result.planNotes);
}

export interface PipelineInput {
  brief: string;
  hints: SiteHints;
  scale?: ProjectScale;
  recipes?: readonly DesignRecipe[];
  availableCapabilities?: readonly string[];
  variationSeed?: string;
  projectId?: string | null;
}

export interface PipelineResult {
  document: ArchitecturalDesignDocument;
  design: ArchitecturalDesign;
  capabilityRequests: CapabilityRequest[];
  massExpansionLog: { massId: string; reasoning: string }[];
  truncated: boolean;
  /** Why mass expansion actually stopped — see `MassExpansionStopReason`. Never report a hard cap unless this is `"hard-cap"`. */
  massExpansionStopReason: MassExpansionStopReason;
  /** Human-readable summary of `massExpansionStopReason`; empty when the stage completed normally and there's nothing worth logging. */
  massExpansionStopMessage: string;
  /** Space-plan volumes mass expansion never placed, each with the reason — empty when every planned volume was built. */
  unplacedVolumes: UnplacedVolume[];
  /** Per-stage trace (dev/debug tooling only) — start/duration/model-call-count/retry-count/status/error. */
  diagnostics: StageDiagnostics[];
  /** The stage outputs a same-session Replay can reuse instead of paying for them again; undefined fields mean that stage never produced a value to reuse. */
  upstream: {
    foundation?: FoundationStageResult;
    /** The mass list AFTER mass-expansion placement, before the Architectural Geometry Pass — replaying "architectural-geometry" or "roof-composition" resolves against this, never the already-articulated list, so a replay never compounds a previous run's operations onto itself. */
    masses?: MassVolume[];
    /** Same mass list, with `operations`/`openings` from the Architectural Geometry Pass applied — what roofs and the compiler actually consume. */
    articulatedMasses?: MassVolume[];
    roofs?: RoofRecipe[];
  };
}

/**
 * The volumes the space plan assigns, computed up front from the same deterministic functions
 * `toArchitecturalDesign` uses — so mass expansion builds what the plan says rather than the plan being
 * derived after the fact from whatever happened to get placed.
 */
function requiredVolumes(input: PipelineInput, intent: ArchitecturalIntent): PlannedVolume[] {
  return plannedVolumesFromSpacePlan(createSpacePlan(intent, selectDesignStrategies(intent, input.recipes, input.availableCapabilities, input.variationSeed)));
}

function massExpansionDiagnostics(expansion: MassExpansionResult): StageDiagnostics {
  return {
    stage: "mass-expansion", status: expansion.hadFailure ? "fallback" : "ok", durationMs: expansion.durationMs,
    modelCalls: expansion.modelCalls, retries: expansion.retries,
    ...(expansion.hadFailure || expansion.unplacedVolumes.length ? { error: expansion.stopMessage } : {}),
  };
}

/**
 * Fails loudly, right at the boundary, instead of letting an incomplete `SiteStrategy` reach a downstream
 * stage that dereferences `viewDirection`/`arrivalDirection` unguarded (mass-expansion, architectural-
 * geometry, roof-composition, the compiler). `runFoundationStage` already guarantees every branch (ok,
 * recovered, fallback — see `toResult` in foundationStage.ts) produces a complete `SiteStrategy`, so this
 * should never actually throw; it exists so a future regression in that guarantee surfaces here, with a
 * clear message, rather than as a cryptic `Cannot read properties of undefined` several stages later.
 */
function assertValidSiteStrategy(siteStrategy: SiteStrategy): void {
  const parsed = siteStrategyInvariantSchema.safeParse(siteStrategy);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
    throw new Error(`[architecture-stages] pipeline invariant violated: Foundation produced an incomplete/invalid SiteStrategy (${fields}). Every downstream stage requires environment/viewDirection/arrivalDirection/terrain.`);
  }
}

const draftDocument = (brief: string, siteStrategy: ArchitecturalDesignDocument["siteStrategy"], masses: readonly MassVolume[], roofs: readonly RoofRecipe[], capabilities: ArchitecturalDesignDocument["capabilities"]): ArchitecturalDesignDocument => {
  const pending = { status: "pending" as const };
  const courtyard = masses.some((m) => m.relationships?.some((r) => r.kind === "surrounds-courtyard"));
  const composition = siteStrategy.terrain === "stepped" ? "stepped-terraces" : courtyard ? "courtyard" : "pavilion-cluster";
  return {
    version: 1, brief, siteStrategy, massing: { composition, masses }, roofs: { recipes: roofs }, capabilities,
    facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: new Date().toISOString(), source: "stage-pipeline", compiler: "procedural-architecture-v1" },
  };
};

/**
 * Orchestrates Stages 1-5 (Intent, Site Strategy, Primary Mass, Recursive Mass Expansion, Roof
 * Composition) as real bounded model calls, calling `onEvent` after every stage AND after every
 * individual mass/roof so a streaming caller can update the viewport as the design grows. A
 * non-streaming caller can pass a no-op `onEvent` and just use the final `document`.
 */
export async function runArchitecturePipeline(
  input: PipelineInput, timings: Timings, budgetMs: number, usageMeta: UsageMeta,
  onEvent: (event: PipelineStageEvent) => void = () => {},
  /**
   * Fires after every stage with the same `upstream` shape the final `PipelineResult` carries, built up
   * incrementally — so a caller (route.ts) can persist a dev-session Replay can resume from as each AI stage
   * pays off, instead of only ever caching once the whole pipeline returns. If a later, purely deterministic
   * stage then throws (a compiler bug, a bad relationship resolution), the AI calls already made for
   * Foundation/Mass Expansion/Geometry/Roofs are never repeated just to reach that bug again.
   */
  onUpstreamProgress: (upstream: PipelineResult["upstream"], diagnostics: readonly StageDiagnostics[]) => void = () => {}
): Promise<PipelineResult> {
  const environment: SiteEnvironment = input.hints.environment ?? "suburban";
  const viewDirection: CompassSide = input.hints.viewDirection ?? "south";
  const arrivalDirection: CompassSide = input.hints.approachSide ?? "north";
  const diagnostics: StageDiagnostics[] = [];

  // Intent, Site Strategy and Primary Mass are three visible progress updates, not three model calls: one
  // structured response decides all three, and the pipeline still emits three "stage" events from it below.
  const foundationResult = await runFoundationStage({ brief: input.brief, hints: input.hints, environment, scale: input.scale, viewDirection, arrivalDirection }, timings, budgetMs, usageMeta);
  const foundation = foundationResult.value;
  const { intent, siteStrategy, terrainResponse, primaryMass } = foundation;
  // The single checked boundary: every stage from here on reads `siteStrategy.viewDirection`/`arrivalDirection`
  // unguarded, trusting Foundation already normalized it — see `assertValidSiteStrategy`.
  assertValidSiteStrategy(siteStrategy);
  diagnostics.push(foundationDiagnostics(foundationResult));
  onEvent({ type: "stage", stage: "intent", index: 1, of: TOTAL_STAGES, document: draftDocument(input.brief, { environment, viewDirection, arrivalDirection, terrain: "level" }, [], [], undefined) });
  onEvent({ type: "stage", stage: "site-strategy", index: 2, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, [], [], undefined) });
  onEvent({ type: "stage", stage: "primary-mass", index: 3, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, [primaryMass], [], undefined) });
  onUpstreamProgress({ foundation }, diagnostics);

  const expansion = await runMassExpansionStage({ brief: input.brief, intent, siteStrategy, primaryMass, requiredVolumes: requiredVolumes(input, intent) }, timings, budgetMs, usageMeta, (masses) => {
    onEvent({ type: "mass-added", stage: "mass-expansion", massesSoFar: masses.length, document: draftDocument(input.brief, siteStrategy, masses, [], undefined) });
  });
  diagnostics.push(massExpansionDiagnostics(expansion));
  // Deterministic: makes the courtyard / indoor-outdoor moves the design declared executable before articulation.
  const placedMasses = completedMasses(expansion.masses, intent, siteStrategy);
  onEvent({ type: "stage", stage: "mass-expansion", index: 4, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, placedMasses, [], expansion.capabilityIntents) });
  onUpstreamProgress({ foundation, masses: placedMasses }, diagnostics);

  // Batched, same reasoning as roof composition below: every mass is already placed, so one call gives every
  // mass its articulation together instead of asking (and paying for) it per mass.
  const geometryResult = await runGeometryStage({ brief: input.brief, intent, siteStrategy, masses: placedMasses }, timings, budgetMs, usageMeta);
  const articulatedMasses = applyGeometry(placedMasses, geometryResult.byMassId);
  logPlanNotes(geometryResult.byMassId);
  diagnostics.push(geometryDiagnostics(geometryResult));
  const geometryCapabilityIntents = finalCapabilityIntents([...(expansion.capabilityIntents ?? []), ...geometryResult.capabilityIntents], articulatedMasses, siteStrategy);
  const geometryCapabilityRequests = [...expansion.capabilityRequests, ...geometryResult.capabilityRequests];
  onEvent({ type: "stage", stage: "architectural-geometry", index: 5, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, articulatedMasses, [], geometryCapabilityIntents) });
  onUpstreamProgress({ foundation, masses: placedMasses, articulatedMasses }, diagnostics);

  // One call composes every mass's roof at once: by now every mass is placed, so nothing is gained by asking
  // sequentially, and the "roof-added" events below still fire once per mass for the same live-preview cadence.
  const roofResult = await runRoofCompositionStage({ intent, siteStrategy, masses: articulatedMasses }, timings, budgetMs, usageMeta);
  const roofs: RoofRecipe[] = roofResult.ok ? roofResult.value : fallbackRoofs(articulatedMasses, intent);
  diagnostics.push({
    stage: "roof-composition", status: roofResult.ok ? "ok" : "fallback", durationMs: roofResult.durationMs,
    modelCalls: roofResult.attempts, retries: Math.max(0, roofResult.attempts - 1),
    ...(roofResult.ok ? (roofResult.warnings ? { warnings: roofResult.warnings } : {}) : { error: roofResult.errors.join("; ") }),
  });
  onUpstreamProgress({ foundation, masses: placedMasses, articulatedMasses, roofs }, diagnostics);
  roofs.forEach((_, i) => {
    onEvent({ type: "roof-added", stage: "roof-composition", massId: articulatedMasses[i].id, roofsSoFar: i + 1, totalMasses: articulatedMasses.length, document: draftDocument(input.brief, siteStrategy, articulatedMasses, roofs.slice(0, i + 1), geometryCapabilityIntents) });
  });
  onEvent({ type: "stage", stage: "roof-composition", index: 6, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, articulatedMasses, roofs, geometryCapabilityIntents) });

  const document = draftDocument(input.brief, siteStrategy, articulatedMasses, roofs, geometryCapabilityIntents);
  const design = toArchitecturalDesign({
    brief: input.brief, intent, siteStrategy, terrainResponse, masses: articulatedMasses, roofs,
    recipes: input.recipes, availableCapabilities: input.availableCapabilities, variationSeed: input.variationSeed,
  });
  return {
    document, design, capabilityRequests: geometryCapabilityRequests, massExpansionLog: expansion.log, truncated: expansion.truncated,
    massExpansionStopReason: expansion.stopReason, massExpansionStopMessage: expansion.stopMessage, unplacedVolumes: expansion.unplacedVolumes,
    diagnostics, upstream: { foundation, masses: placedMasses, articulatedMasses, roofs },
  };
}

export type ReplayableArchitectureStage = "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition";

/**
 * Dev-only: rerun one architecture stage using the previous run's still-valid upstream output instead of
 * paying for the whole pipeline again. Replaying "foundation" invalidates everything after it (masses were
 * placed against the old intent/site strategy), so mass-expansion, the geometry pass and roof-composition are
 * all recomputed too. Replaying "mass-expansion" invalidates both the geometry pass (articulation is keyed to
 * the mass list) and roofs (keyed to the articulated footprint), so both recompute. Replaying
 * "architectural-geometry" invalidates roofs only (they follow the articulated footprint). Replaying
 * "roof-composition" alone touches nothing else. Never called in production.
 */
export async function replayArchitectureStage(
  stage: ReplayableArchitectureStage,
  input: PipelineInput,
  cached: PipelineResult["upstream"],
  timings: Timings,
  budgetMs: number,
  usageMeta: UsageMeta
): Promise<PipelineResult> {
  if (stage === "foundation" || !cached.foundation) {
    // No valid upstream to reuse for stage 1 — a full (still bounded) rerun.
    return runArchitecturePipeline(input, timings, budgetMs, usageMeta);
  }
  const { intent, siteStrategy, terrainResponse, primaryMass } = cached.foundation;
  const diagnostics: StageDiagnostics[] = [{ stage: "foundation", status: "ok", durationMs: 0, modelCalls: 0, retries: 0 }];

  let masses = cached.masses ?? [primaryMass];
  let massCapabilityIntents: ArchitecturalDesignDocument["capabilities"] = [];
  let massCapabilityRequests: CapabilityRequest[] = [];
  let massExpansionLog: { massId: string; reasoning: string }[] = [];
  let truncated = false;
  // Cached masses were already accepted by a prior successful run — there's nothing to report.
  let massExpansionStopReason: MassExpansionStopReason = "model-done";
  let massExpansionStopMessage = "";
  let unplacedVolumes: UnplacedVolume[] = [];

  if (stage === "mass-expansion" || !cached.masses) {
    const expansion = await runMassExpansionStage({ brief: input.brief, intent, siteStrategy, primaryMass, requiredVolumes: requiredVolumes(input, intent) }, timings, budgetMs, usageMeta);
    masses = expansion.masses;
    massCapabilityIntents = expansion.capabilityIntents;
    massCapabilityRequests = expansion.capabilityRequests;
    massExpansionLog = expansion.log;
    truncated = expansion.truncated;
    massExpansionStopReason = expansion.stopReason;
    massExpansionStopMessage = expansion.stopMessage;
    unplacedVolumes = expansion.unplacedVolumes;
    diagnostics.push(massExpansionDiagnostics(expansion));
  } else {
    diagnostics.push({ stage: "mass-expansion", status: "ok", durationMs: 0, modelCalls: 0, retries: 0 });
  }

  // The geometry pass is keyed to the mass list, so a mass-expansion replay always recomputes it too.
  let articulatedMasses = cached.articulatedMasses ?? masses;
  let geometryCapabilityIntents: ArchitecturalDesignDocument["capabilities"] = [];
  let geometryCapabilityRequests: CapabilityRequest[] = [];
  if (stage === "architectural-geometry" || stage === "mass-expansion" || !cached.articulatedMasses) {
    masses = completedMasses(masses, intent, siteStrategy);
    const geometryResult = await runGeometryStage({ brief: input.brief, intent, siteStrategy, masses }, timings, budgetMs, usageMeta);
    articulatedMasses = applyGeometry(masses, geometryResult.byMassId);
    logPlanNotes(geometryResult.byMassId);
    geometryCapabilityIntents = geometryResult.capabilityIntents;
    geometryCapabilityRequests = geometryResult.capabilityRequests;
    diagnostics.push(geometryDiagnostics(geometryResult));
  } else {
    diagnostics.push({ stage: "architectural-geometry", status: "ok", durationMs: 0, modelCalls: 0, retries: 0 });
  }

  const capabilityIntents = finalCapabilityIntents([...(massCapabilityIntents ?? []), ...(geometryCapabilityIntents ?? [])], articulatedMasses, siteStrategy);
  const capabilityRequests = [...massCapabilityRequests, ...geometryCapabilityRequests];

  // Roofs follow the articulated footprint, so a geometry-pass replay always recomputes them too.
  let roofs = cached.roofs ?? [];
  if (stage === "roof-composition" || stage === "architectural-geometry" || stage === "mass-expansion" || !cached.roofs) {
    const roofResult = await runRoofCompositionStage({ intent, siteStrategy, masses: articulatedMasses }, timings, budgetMs, usageMeta);
    roofs = roofResult.ok ? roofResult.value : fallbackRoofs(articulatedMasses, intent);
    diagnostics.push({
      stage: "roof-composition", status: roofResult.ok ? "ok" : "fallback", durationMs: roofResult.durationMs,
      modelCalls: roofResult.attempts, retries: Math.max(0, roofResult.attempts - 1),
      ...(roofResult.ok ? (roofResult.warnings ? { warnings: roofResult.warnings } : {}) : { error: roofResult.errors.join("; ") }),
    });
  } else {
    diagnostics.push({ stage: "roof-composition", status: "ok", durationMs: 0, modelCalls: 0, retries: 0 });
  }

  const document = draftDocument(input.brief, siteStrategy, articulatedMasses, roofs, capabilityIntents);
  const design = toArchitecturalDesign({
    brief: input.brief, intent, siteStrategy, terrainResponse, masses: articulatedMasses, roofs,
    recipes: input.recipes, availableCapabilities: input.availableCapabilities, variationSeed: input.variationSeed,
  });
  return {
    document, design, capabilityRequests, massExpansionLog, truncated,
    massExpansionStopReason, massExpansionStopMessage, unplacedVolumes,
    diagnostics, upstream: { foundation: cached.foundation, masses, articulatedMasses, roofs },
  };
}

/** A salvaged geometry pass still counts as "ok" (the model's refinements were used), but says what was lost. */
function geometryDiagnostics(result: GeometryStageResult): StageDiagnostics {
  const salvage = result.salvage;
  return {
    stage: "architectural-geometry", status: result.hadFailure ? "fallback" : "ok", durationMs: result.durationMs,
    modelCalls: result.attempts, retries: Math.max(0, result.attempts - 1),
    ...(salvage ? { error: `${salvage.error} (salvaged refinements for ${salvage.salvagedMassIds.join(", ")}${salvage.baselineMassIds.length ? `; baseline for ${salvage.baselineMassIds.join(", ")}` : ""}${salvage.droppedOperations ? `; dropped ${salvage.droppedOperations} invalid operation(s)` : ""})` } : {}),
  };
}

/**
 * `"recovered"` still counts as a "fallback" `StageDiagnostics` status (that type has no finer-grained
 * state) but its `error` reports which fields were salvaged vs defaulted, rather than the fully-generic
 * "unavailable" story a plain fallback implies — dev tooling can tell the two apart from this text.
 */
function foundationDiagnostics(result: FoundationStageRunResult): StageDiagnostics {
  if (result.status === "ok") {
    return { stage: "foundation", status: "ok", durationMs: result.durationMs, modelCalls: result.attempts, retries: Math.max(0, result.attempts - 1) };
  }
  const error = result.status === "recovered"
    ? `${result.error} (recovered: ${result.recoveredFields.join(", ")}; defaulted: ${result.defaultedFields.join(", ")})`
    : result.error;
  return { stage: "foundation", status: "fallback", durationMs: result.durationMs, modelCalls: result.attempts, retries: Math.max(0, result.attempts - 1), error };
}
