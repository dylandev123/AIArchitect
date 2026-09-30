import type { CompassSide, ProjectScale, SiteEnvironment } from "@/types/house";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { SiteHints } from "@/lib/house/siteSettings";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassVolume, SiteStrategy } from "../document";
import { missingVolumePlanFields, sanitizeVolumePlan, withVolumePlan } from "../volumePlan";
import { runStage } from "./runStage";
import { COMPOSITION_BIAS_OPTIONS, foundationStageOutputSchema, INTENT_GOALS, VOLUME_PLAN_GUIDE, type FoundationStageOutput } from "./schemas";
import { placementConflicts } from "./integrityChecks";
import { repairRequests } from "./recovery";

/**
 * `mood`/`spatialGoals`/`environmentalGoals` are a closed enum (`INTENT_GOALS`) and `compositionBias` is a
 * closed 4-way enum, but `AI_PROVIDER_OPTIONS` (model.ts) runs with `strictJsonSchema: false` — so OpenAI
 * does not grammar-constrain generation to those enums the way strict structured outputs would. A prompt
 * that never states the exact allowed strings reliably gets off-vocabulary synonyms ("connection" instead of
 * "indoor-outdoor", "openness" — plausible — vs "expansiveness" — not a member) that fail schema validation
 * every attempt, including the repair retry, since the model still doesn't know the closed set on attempt 2.
 * Disclosing the literal vocabulary here is the actual fix for Foundation's "did not match schema" failures.
 */
const SYSTEM = `You are a senior residential architect making the three foundational decisions of a new design, in this order, before any composition exists:
1. Architectural intent: pick "mood", "spatialGoals" and "environmentalGoals" ONLY from this exact closed vocabulary — use the literal strings below, never a synonym or variation: ${INTENT_GOALS.join(", ")}. "hierarchyGoals" are short free-text statements of which volumes should dominate and which should recede. "compositionBias" must be exactly one of: ${COMPOSITION_BIAS_OPTIONS.join(", ")}. Do not describe rooms, materials, roof forms or exact dimensions yet.
2. Site strategy: honoring that intent, decide whether the composition should sit level or step with the land, and briefly say how the terrain should be handled.
3. Primary mass: choose the single dominant volume and its executable placement (position, elevation and rotation), proportions and plan. Size it from the brief — do not default to a generic box.
${VOLUME_PLAN_GUIDE}
Be decisive and specific to THIS brief; avoid generic answers that would fit any house.`;

export interface FoundationStageContext { brief: string; hints: SiteHints; environment: SiteEnvironment; scale?: ProjectScale; viewDirection: CompassSide; arrivalDirection: CompassSide; }

export interface FoundationStageResult { intent: ArchitecturalIntent; siteStrategy: SiteStrategy; terrainResponse: string; primaryMass: MassVolume; }

/**
 * Foundation either authors the three decisions (`ok: true`) or fails. There is no default intent, site
 * strategy or primary mass: a response that cannot be repaired inside the stage's retry budget leaves the
 * generation without a design, and the pipeline does not finalize (see recovery.ts).
 */
export type FoundationStageRunResult =
  | { ok: true; value: FoundationStageResult; attempts: number; durationMs: number; repairRequests?: string[] }
  | { ok: false; errors: string[]; attempts: number; durationMs: number; repairRequests?: string[] };

/**
 * The model is only told `mood`/`spatialGoals`/`environmentalGoals`/`hierarchyGoals` have a max length in
 * prose (never grammar-enforced — see the module-level comment on `SYSTEM`), so it reliably returns a few
 * extra, individually valid entries. That's not a structurally broken response worth another model call for:
 * trim each array to its schema max (keeping first-seen order after deduplicating) before schema validation
 * ever runs, so an overflowing-but-otherwise-valid response is accepted on attempt 1 instead of retried.
 */
function capArray(value: unknown, max: number): unknown {
  if (!Array.isArray(value)) return value;
  return [...new Set(value)].slice(0, max);
}

function normalizeFoundationOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const value = raw as Record<string, unknown>;
  const primaryMass = value.primaryMass && typeof value.primaryMass === "object" ? value.primaryMass as Record<string, unknown> : undefined;
  const withPlan = primaryMass && "plan" in primaryMass ? { ...value, primaryMass: { ...primaryMass, plan: sanitizeVolumePlan(primaryMass.plan) } } : value;
  if (!value.intent || typeof value.intent !== "object") return withPlan;
  const intent = value.intent as Record<string, unknown>;
  return {
    ...withPlan,
    intent: {
      ...intent,
      mood: capArray(intent.mood, 3),
      spatialGoals: capArray(intent.spatialGoals, 4),
      environmentalGoals: capArray(intent.environmentalGoals, 3),
      hierarchyGoals: capArray(intent.hierarchyGoals, 4),
    },
  };
}

function toResult(ctx: FoundationStageContext, output: FoundationStageOutput): FoundationStageResult {
  const intent: ArchitecturalIntent = {
    mood: output.intent.mood, spatialGoals: output.intent.spatialGoals, environmentalGoals: output.intent.environmentalGoals,
    hierarchyGoals: output.intent.hierarchyGoals, compositionBias: output.intent.compositionBias,
    source: { environment: ctx.environment, scale: ctx.scale, viewDirection: ctx.viewDirection, arrivalDirection: ctx.arrivalDirection, style: output.intent.style },
  };
  // The brief's explicit statements (hints) always win over the model, matching `resolveSiteSettings`'s philosophy.
  const siteStrategy: SiteStrategy = {
    environment: ctx.hints.environment ?? output.siteStrategy.environment,
    viewDirection: ctx.hints.viewDirection ?? output.siteStrategy.viewDirection,
    arrivalDirection: ctx.hints.approachSide ?? output.siteStrategy.arrivalDirection,
    terrain: ctx.hints.terrainSlope === "steep" ? "stepped" : ctx.hints.terrainSlope === "flat" ? "level" : output.siteStrategy.terrain,
  };
  const primaryMass: MassVolume = withVolumePlan({
    id: "mass-0", name: output.primaryMass.name, role: "main-living",
    position: output.primaryMass.position ?? { x: 0, z: 0 }, width: output.primaryMass.width, depth: output.primaryMass.depth, floors: output.primaryMass.floors,
    elevation: output.primaryMass.elevation ?? 0, rotation: output.primaryMass.rotation ?? 0,
    ...((output.primaryMass.position || output.primaryMass.elevation !== undefined || output.primaryMass.rotation !== undefined) ? { placementLocked: true } : {}),
    ...(output.primaryMass.cantilever ? { cantilever: output.primaryMass.cantilever } : {}),
  }, output.primaryMass.plan);
  return { intent, siteStrategy, terrainResponse: output.siteStrategy.terrainResponse, primaryMass };
}

/**
 * Runs Intent + Site Strategy + Primary Mass as one bounded model call instead of three. All three are
 * visible progress updates, not independent decisions that need their own round trip — the pipeline still
 * emits the same three "stage" events afterward, sliced from this one response.
 *
 * The primary mass must carry a complete, buildable plan: a missing plan field or a plan the volume cannot
 * carry is sent back as a repair request inside this stage's retry budget. Nothing is defaulted on failure.
 */
export async function runFoundationStage(ctx: FoundationStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<FoundationStageRunResult> {
  const result = await runStage({
    stageName: "foundation",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${ctx.brief}`,
      `Known site facts: environment=${ctx.environment}, view direction=${ctx.viewDirection}, arrival direction=${ctx.arrivalDirection}${ctx.scale ? `, project scale=${ctx.scale}` : ""}.`,
      previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: foundationStageOutputSchema,
    normalize: normalizeFoundationOutput,
    timings, remainingBudgetMs, usageMeta,
    maxOutputTokens: 1150,
    validate: (value) => {
      const missing = missingVolumePlanFields(value.primaryMass.plan);
      if (missing.length) return [`[repair-required:plan-incomplete] primaryMass.plan must author every field; missing or off-vocabulary: ${missing.join(", ")}.`];
      const { siteStrategy, primaryMass } = toResult(ctx, value);
      return repairRequests(placementConflicts([primaryMass], siteStrategy, "foundation"));
    },
  });
  const repairs = result.repairRequests ? { repairRequests: result.repairRequests } : {};
  if (!result.ok) return { ok: false, errors: result.errors, attempts: result.attempts, durationMs: result.durationMs, ...repairs };
  return { ok: true, value: toResult(ctx, result.value), attempts: result.attempts, durationMs: result.durationMs, ...repairs };
}
