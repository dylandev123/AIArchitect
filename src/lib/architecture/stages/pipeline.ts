import { completeComposition } from "./compositionCompletion";
import type { CompassSide, ProjectScale, SiteEnvironment } from "@/types/house";
import type { DesignRecipe, CapabilityRequest } from "@/types/library";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { Timings } from "@/lib/ai/timing";
import type { SiteHints } from "@/lib/house/siteSettings";
import type { ArchitecturalDesignDocument, MassVolume, RoofRecipe, SiteStrategy } from "../document";
import { appliedRoofRecipe } from "../roofRecipeLibrary";
import { runFoundationStage, type FoundationStageResult, type FoundationStageRunResult } from "./foundationStage";
import { architectureAuthorityHash } from "./authority";
import { finalOutcome, V2GenerationFailure, type OwningStage } from "./recovery";
import { plannedVolumesFromSpacePlan, runMassExpansionStage, type MassExpansionResult, type MassExpansionStopReason, type PlannedVolume, type UnplacedVolume } from "./massExpansionStage";
import { createSpacePlan, selectDesignStrategies, type ArchitecturalDesign, type ArchitecturalIntent } from "../designEngine";
import { runGeometryStage, type GeometryStageResult, type MassGeometryResult } from "./geometryStage";
import { runRoofCompositionStage, type RoofCompositionStageResult } from "./roofStage";
import { mergeCapabilityIntents, parameterizeCapabilityIntent } from "../volumePlan";
import { toArchitecturalDesign } from "./toArchitecturalDesign";
import type { StageDiagnostics } from "./diagnostics";
import { siteStrategyInvariantSchema } from "./schemas";
import { runArchitectStage } from "./architectStage";
import { deriveArchitecturalIntent } from "../designEngine";

const TOTAL_STAGES = 6;

export type PipelineStageEvent =
  | { type: "stage"; stage: "architect"; index: 1; of: 1; document: ArchitecturalDesignDocument }
  | { type: "stage"; stage: "intent" | "site-strategy" | "primary-mass" | "mass-expansion" | "architectural-geometry" | "roof-composition"; index: number; of: typeof TOTAL_STAGES; document: ArchitecturalDesignDocument }
  | { type: "mass-added"; stage: "mass-expansion"; massesSoFar: number; document: ArchitecturalDesignDocument }
  | { type: "roof-added"; stage: "roof-composition"; massId: string; roofsSoFar: number; totalMasses: number; document: ArchitecturalDesignDocument };

/** Applies the Architectural Geometry Pass's authored per-mass geometry onto the resolved mass list — a pure data merge: no placement math, nothing added or restored. */
function applyGeometry(masses: readonly MassVolume[], byMassId: ReadonlyMap<string, MassGeometryResult>): MassVolume[] {
  return masses.map((mass) => {
    const result = byMassId.get(mass.id);
    return result ? { ...mass, operations: result.operations, openings: result.openings } : mass;
  });
}

/**
 * The single exit for an authoritative stage that exhausted its retry budget: the stage's diagnostics are
 * recorded as failed, the caller is told, and the generation stops — no stage after it runs and nothing
 * deterministic stands in for the missing design.
 */
function failGeneration(stage: OwningStage, errors: readonly string[], diagnostics: StageDiagnostics[], entry: StageDiagnostics, onFailure: (diagnostics: readonly StageDiagnostics[]) => void): never {
  diagnostics.push({ ...entry, status: "error", outcome: "failed", error: errors.join("; ") || "no usable response" });
  onFailure(diagnostics);
  throw new V2GenerationFailure(stage, errors, [...diagnostics]);
}

/**
 * Every capability intent the stages produced, with facade-bound ones parameterized from the final
 * orientation (a by-name request carries only a mass id) and duplicates collapsed onto the fullest one.
 */
function finalCapabilityIntents(intents: readonly NonNullable<ArchitecturalDesignDocument["capabilities"]>[number][], masses: readonly MassVolume[], siteStrategy: SiteStrategy) {
  return mergeCapabilityIntents(intents.map((intent) => parameterizeCapabilityIntent(intent, masses, siteStrategy)));
}

const isDev = process.env.NODE_ENV !== "production";

/** Validation-only review of the authored composition: the masses come back exactly as authored; the notes are warnings. */
function reviewedComposition(masses: readonly MassVolume[], intent: Parameters<typeof completeComposition>[1], siteStrategy: SiteStrategy): { masses: MassVolume[]; notes: string[] } {
  const completion = completeComposition(masses, intent, siteStrategy);
  if (isDev && completion.notes.length) console.debug("[composition-review]", completion.notes);
  return completion;
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
  /** Approved roof-only recipes retrieved for the Roof Composition stage. */
  roofRecipes?: readonly DesignRecipe[];
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
  /**
   * Fingerprint of the architecture as its authoring stages finished it. Every later stage (Site Plan, Final
   * Assembly, asset placement) reads the architecture only; the final integrity gate checks the saved artifact
   * still matches this.
   */
  authority: { architectureHash: string };
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

const repairTrace = (requests: readonly string[] | undefined) => (requests?.length ? { repairRequests: [...requests] } : {});

/** An accepted composition; volumes the architect declined to place, or a hard cap, are warnings on it. */
function massExpansionDiagnostics(expansion: MassExpansionResult, reviewNotes: readonly string[] = []): StageDiagnostics {
  const warnings = [...(expansion.stopMessage ? [expansion.stopMessage] : []), ...reviewNotes];
  return {
    stage: "mass-expansion", status: "ok", outcome: "accepted", durationMs: expansion.durationMs,
    modelCalls: expansion.modelCalls, retries: expansion.retries, ...repairTrace(expansion.repairRequests),
    ...(warnings.length ? { warnings } : {}),
  };
}

function roofDiagnostics(roofResult: Extract<RoofCompositionStageResult, { ok: true }>): StageDiagnostics {
  const warnings = [...(roofResult.warnings ?? []), ...(roofResult.normalizations ?? []), ...(roofResult.libraryRecipe ? [`Applied Roof Recipe: ${roofResult.libraryRecipe.name} (${roofResult.libraryRecipe.id}).`] : [])];
  return {
    stage: "roof-composition", status: "ok", outcome: finalOutcome(true, roofResult.normalizations), durationMs: roofResult.durationMs,
    modelCalls: roofResult.attempts, retries: Math.max(0, roofResult.attempts - 1), ...repairTrace(roofResult.repairRequests),
    ...(warnings.length ? { warnings } : {}),
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
 * Composition) as real bounded model calls. Each stage either authors its part of the design or the pipeline
 * throws `V2GenerationFailure` (see recovery.ts): there is no deterministic stand-in for a stage that
 * exhausted its retry budget. Calls `onEvent` after every stage AND after every
 * individual mass/roof so a streaming caller can update the viewport as the design grows. A
 * non-streaming caller can pass a no-op `onEvent` and just use the final `document`.
 */
async function runLegacyArchitecturePipeline(
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
  const failed = (failedDiagnostics: readonly StageDiagnostics[]) => onUpstreamProgress(upstream, failedDiagnostics);
  let upstream: PipelineResult["upstream"] = {};
  const progress = (next: PipelineResult["upstream"]) => { upstream = next; onUpstreamProgress(upstream, diagnostics); };

  // Intent, Site Strategy and Primary Mass are three visible progress updates, not three model calls: one
  // structured response decides all three, and the pipeline still emits three "stage" events from it below.
  const foundationResult = await runFoundationStage({ brief: input.brief, hints: input.hints, environment, scale: input.scale, viewDirection, arrivalDirection }, timings, budgetMs, usageMeta);
  if (!foundationResult.ok) failGeneration("foundation", foundationResult.errors, diagnostics, foundationDiagnostics(foundationResult), failed);
  const foundation = foundationResult.value;
  const { intent, siteStrategy, terrainResponse, primaryMass } = foundation;
  // The single checked boundary: every stage from here on reads `siteStrategy.viewDirection`/`arrivalDirection`
  // unguarded, trusting Foundation already normalized it — see `assertValidSiteStrategy`.
  assertValidSiteStrategy(siteStrategy);
  diagnostics.push(foundationDiagnostics(foundationResult));
  onEvent({ type: "stage", stage: "intent", index: 1, of: TOTAL_STAGES, document: draftDocument(input.brief, { environment, viewDirection, arrivalDirection, terrain: "level" }, [], [], undefined) });
  onEvent({ type: "stage", stage: "site-strategy", index: 2, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, [], [], undefined) });
  onEvent({ type: "stage", stage: "primary-mass", index: 3, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, [primaryMass], [], undefined) });
  progress({ foundation });

  const expansion = await runMassExpansionStage({ brief: input.brief, intent, siteStrategy, primaryMass, requiredVolumes: requiredVolumes(input, intent) }, timings, budgetMs, usageMeta, (masses) => {
    onEvent({ type: "mass-added", stage: "mass-expansion", massesSoFar: masses.length, document: draftDocument(input.brief, siteStrategy, masses, [], undefined) });
  });
  if (expansion.hadFailure) failGeneration("mass-expansion", [expansion.stopMessage, ...expansion.failureErrors], diagnostics, massExpansionDiagnostics(expansion), failed);
  // Validation only: the masses are exactly what Mass Expansion authored and resolved.
  const review = reviewedComposition(expansion.masses, intent, siteStrategy);
  const placedMasses = review.masses;
  diagnostics.push(massExpansionDiagnostics(expansion, review.notes));
  onEvent({ type: "stage", stage: "mass-expansion", index: 4, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, placedMasses, [], expansion.capabilityIntents) });
  progress({ foundation, masses: placedMasses });

  // Batched, same reasoning as roof composition below: every mass is already placed, so one call authors every
  // mass's geometry together instead of asking (and paying for) it per mass.
  const geometryResult = await runGeometryStage({ brief: input.brief, intent, siteStrategy, masses: placedMasses }, timings, budgetMs, usageMeta);
  if (!geometryResult.ok) failGeneration(geometryResult.owningStage ?? "architectural-geometry", geometryResult.errors, diagnostics, geometryDiagnostics(geometryResult), failed);
  const articulatedMasses = applyGeometry(placedMasses, geometryResult.byMassId);
  logPlanNotes(geometryResult.byMassId);
  diagnostics.push(geometryDiagnostics(geometryResult));
  const geometryCapabilityIntents = finalCapabilityIntents([...(expansion.capabilityIntents ?? []), ...geometryResult.capabilityIntents], articulatedMasses, siteStrategy);
  const geometryCapabilityRequests = [...expansion.capabilityRequests, ...geometryResult.capabilityRequests];
  onEvent({ type: "stage", stage: "architectural-geometry", index: 5, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, articulatedMasses, [], geometryCapabilityIntents) });
  progress({ foundation, masses: placedMasses, articulatedMasses });

  // One call composes every mass's roof at once: by now every mass is placed, so nothing is gained by asking
  // sequentially, and the "roof-added" events below still fire once per mass for the same live-preview cadence.
  const roofResult = await runRoofCompositionStage({ intent, siteStrategy, masses: articulatedMasses, approvedRecipes: input.roofRecipes }, timings, budgetMs, usageMeta);
  if (!roofResult.ok) failGeneration("roof-composition", roofResult.errors, diagnostics, { stage: "roof-composition", status: "error", durationMs: roofResult.durationMs, modelCalls: roofResult.attempts, retries: Math.max(0, roofResult.attempts - 1), ...repairTrace(roofResult.repairRequests) }, failed);
  const roofs: RoofRecipe[] = roofResult.value;
  diagnostics.push(roofDiagnostics(roofResult));
  progress({ foundation, masses: placedMasses, articulatedMasses, roofs });
  roofs.forEach((roof, i) => {
    onEvent({ type: "roof-added", stage: "roof-composition", massId: roof.massId, roofsSoFar: i + 1, totalMasses: articulatedMasses.length, document: draftDocument(input.brief, siteStrategy, articulatedMasses, roofs.slice(0, i + 1), geometryCapabilityIntents) });
  });
  onEvent({ type: "stage", stage: "roof-composition", index: 6, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, articulatedMasses, roofs, geometryCapabilityIntents) });

  const application = roofResult.libraryRecipe ? appliedRoofRecipe(roofResult.libraryRecipe) : undefined;
  const document = { ...draftDocument(input.brief, siteStrategy, articulatedMasses, roofs, geometryCapabilityIntents), roofs: { recipes: roofs, ...(application ?? {}) } };
  const design = toArchitecturalDesign({
    brief: input.brief, intent, siteStrategy, terrainResponse, masses: articulatedMasses, roofs,
    recipes: input.recipes, availableCapabilities: input.availableCapabilities, variationSeed: input.variationSeed,
  });
  return {
    document, design, capabilityRequests: geometryCapabilityRequests, massExpansionLog: expansion.log, truncated: expansion.truncated,
    massExpansionStopReason: expansion.stopReason, massExpansionStopMessage: expansion.stopMessage, unplacedVolumes: expansion.unplacedVolumes,
    diagnostics, authority: { architectureHash: architectureAuthorityHash(document) }, upstream: { foundation, masses: placedMasses, articulatedMasses, roofs },
  };
}

/** The normal path has one architectural author; the legacy pipeline above remains an internal fallback boundary. */
export async function runArchitecturePipeline(
  input: PipelineInput, timings: Timings, budgetMs: number, usageMeta: UsageMeta,
  onEvent: (event: PipelineStageEvent) => void = () => {},
  onUpstreamProgress: (upstream: PipelineResult["upstream"], diagnostics: readonly StageDiagnostics[]) => void = () => {},
): Promise<PipelineResult> {
  // Deliberately opt-in only while the single-Architect path proves out; normal generation never enters it.
  if (process.env.AI_ARCHITECT_LEGACY_PIPELINE === "1") {
    return runLegacyArchitecturePipeline(input, timings, budgetMs, usageMeta, onEvent, onUpstreamProgress);
  }
  const architect = await runArchitectStage(input.brief, timings, budgetMs, usageMeta);
  const architectDiagnostic: StageDiagnostics = {
    stage: "architect", status: architect.ok ? "ok" : "error", outcome: architect.ok ? "accepted" : "failed",
    durationMs: architect.durationMs, modelCalls: architect.attempts, retries: Math.max(0, architect.attempts - 1),
    ...(architect.repairRequests?.length ? { repairRequests: architect.repairRequests } : {}),
    ...(!architect.ok ? { error: architect.errors?.join("; ") || "no usable architecture document" } : {}),
  };
  if (!architect.ok || !architect.document) throw new V2GenerationFailure("architect", architect.errors ?? ["no usable architecture document"], [architectDiagnostic]);
  const document = architect.document;
  const intent = deriveArchitecturalIntent(input.brief, {
    environment: document.siteStrategy.environment, viewDirection: document.siteStrategy.viewDirection,
    approachSide: document.siteStrategy.arrivalDirection, scale: input.scale,
  });
  const design = toArchitecturalDesign({
    brief: input.brief, intent, siteStrategy: document.siteStrategy,
    terrainResponse: document.siteStrategy.terrain === "stepped" ? "The authored masses step with the site." : "The authored masses sit on a level site.",
    masses: document.massing.masses, roofs: document.roofs.recipes, recipes: input.recipes,
    availableCapabilities: input.availableCapabilities, variationSeed: input.variationSeed,
  });
  onEvent({ type: "stage", stage: "architect", index: 1, of: 1, document });
  onUpstreamProgress({}, [architectDiagnostic]);
  return {
    document, design, capabilityRequests: [], massExpansionLog: [], truncated: false,
    massExpansionStopReason: "model-done", massExpansionStopMessage: "", unplacedVolumes: [],
    diagnostics: [architectDiagnostic], authority: { architectureHash: architectureAuthorityHash(document) },
    upstream: { masses: [...document.massing.masses], articulatedMasses: [...document.massing.masses], roofs: [...document.roofs.recipes] },
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
  const failed = () => {};

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
    if (expansion.hadFailure) failGeneration("mass-expansion", [expansion.stopMessage, ...expansion.failureErrors], diagnostics, massExpansionDiagnostics(expansion), failed);
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
    masses = reviewedComposition(masses, intent, siteStrategy).masses;
    const geometryResult = await runGeometryStage({ brief: input.brief, intent, siteStrategy, masses }, timings, budgetMs, usageMeta);
    if (!geometryResult.ok) failGeneration(geometryResult.owningStage ?? "architectural-geometry", geometryResult.errors, diagnostics, geometryDiagnostics(geometryResult), failed);
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
  let roofLibraryRecipe: DesignRecipe | undefined;
  if (stage === "roof-composition" || stage === "architectural-geometry" || stage === "mass-expansion" || !cached.roofs) {
    const roofResult = await runRoofCompositionStage({ intent, siteStrategy, masses: articulatedMasses, approvedRecipes: input.roofRecipes }, timings, budgetMs, usageMeta);
    if (!roofResult.ok) failGeneration("roof-composition", roofResult.errors, diagnostics, { stage: "roof-composition", status: "error", durationMs: roofResult.durationMs, modelCalls: roofResult.attempts, retries: Math.max(0, roofResult.attempts - 1), ...repairTrace(roofResult.repairRequests) }, failed);
    roofs = roofResult.value;
    roofLibraryRecipe = roofResult.libraryRecipe;
    diagnostics.push(roofDiagnostics(roofResult));
  } else {
    diagnostics.push({ stage: "roof-composition", status: "ok", durationMs: 0, modelCalls: 0, retries: 0 });
  }

  const application = roofLibraryRecipe ? appliedRoofRecipe(roofLibraryRecipe) : undefined;
  const document = { ...draftDocument(input.brief, siteStrategy, articulatedMasses, roofs, capabilityIntents), roofs: { recipes: roofs, ...(application ?? {}) } };
  const design = toArchitecturalDesign({
    brief: input.brief, intent, siteStrategy, terrainResponse, masses: articulatedMasses, roofs,
    recipes: input.recipes, availableCapabilities: input.availableCapabilities, variationSeed: input.variationSeed,
  });
  return {
    document, design, capabilityRequests, massExpansionLog, truncated,
    massExpansionStopReason, massExpansionStopMessage, unplacedVolumes,
    diagnostics, authority: { architectureHash: architectureAuthorityHash(document) }, upstream: { foundation: cached.foundation, masses, articulatedMasses, roofs },
  };
}

function geometryDiagnostics(result: GeometryStageResult): StageDiagnostics {
  return {
    stage: "architectural-geometry", status: result.ok ? "ok" : "error", ...(result.ok ? { outcome: "accepted" as const } : {}), durationMs: result.durationMs,
    modelCalls: result.attempts, retries: Math.max(0, result.attempts - 1), ...repairTrace(result.repairRequests),
  };
}

function foundationDiagnostics(result: FoundationStageRunResult): StageDiagnostics {
  return {
    stage: "foundation", status: result.ok ? "ok" : "error", ...(result.ok ? { outcome: "accepted" as const } : {}), durationMs: result.durationMs,
    modelCalls: result.attempts, retries: Math.max(0, result.attempts - 1), ...repairTrace(result.repairRequests),
  };
}
