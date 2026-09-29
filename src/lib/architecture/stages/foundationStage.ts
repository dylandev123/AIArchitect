import type { CompassSide, ProjectScale, SiteEnvironment } from "@/types/house";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { SiteHints } from "@/lib/house/siteSettings";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassVolume, SiteStrategy } from "../document";
import { sanitizeVolumePlan, withVolumePlan } from "../volumePlan";
import { runStage } from "./runStage";
import { recoverFields } from "./partialRecovery";
import {
  COMPOSITION_BIAS_OPTIONS, foundationStageOutputSchema, INTENT_GOALS, VOLUME_PLAN_GUIDE,
  intentStageOutputSchema, primaryMassStageOutputSchema, siteStrategyStageOutputSchema,
  type FoundationStageOutput,
} from "./schemas";

const isDev = process.env.NODE_ENV !== "production";

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
 * `"ok"` = schema-validated within the normal attempt budget, no recovery needed. `"recovered"` = every
 * attempt failed validation, but at least one field of the model's last response was individually valid and
 * was kept — only the remaining fields were defaulted. `"fallback"` = nothing usable came back at all (e.g.
 * the model call errored outright), so every field is the deterministic default.
 */
export interface FoundationStageRunResult {
  value: FoundationStageResult;
  status: "ok" | "recovered" | "fallback";
  attempts: number;
  durationMs: number;
  recoveredFields: string[];
  defaultedFields: string[];
  error?: string;
}

function defaultFoundationOutput(ctx: FoundationStageContext): FoundationStageOutput {
  return {
    intent: {
      mood: ["calm"], spatialGoals: ["openness"], environmentalGoals: ["daylight"],
      hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical", style: "contemporary",
    },
    siteStrategy: {
      environment: ctx.environment, viewDirection: ctx.viewDirection, arrivalDirection: ctx.arrivalDirection,
      terrain: "level", terrainResponse: "Kept level; the staged foundation call was unavailable.",
    },
    primaryMass: { name: "Main Living Pavilion", width: 14, depth: 9, floors: 1 },
  };
}

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
  }, output.primaryMass.plan);
  return { intent, siteStrategy, terrainResponse: output.siteStrategy.terrainResponse, primaryMass };
}

/**
 * Runs Intent + Site Strategy + Primary Mass as one bounded model call instead of three. All three are
 * visible progress updates, not independent decisions that need their own round trip — the pipeline still
 * emits the same three "stage" events afterward, sliced from this one response.
 *
 * On failure this never falls back to an entirely generic design: it salvages every individually-valid
 * field from the last attempt's raw output (see `recoverFields`) and only defaults what's actually missing
 * or invalid, so e.g. a valid primary mass survives even if `intent.mood` used an off-vocabulary value.
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
  });

  if (result.ok) {
    return { value: toResult(ctx, result.value), status: "ok", attempts: result.attempts, durationMs: result.durationMs, recoveredFields: [], defaultedFields: [] };
  }

  const raw = result.rawValue as Record<string, unknown> | undefined;
  const fallback = defaultFoundationOutput(ctx);
  const intentRecovery = recoverFields(intentStageOutputSchema.shape, raw?.intent);
  const siteRecovery = recoverFields(siteStrategyStageOutputSchema.shape, raw?.siteStrategy);
  const massRecovery = recoverFields(primaryMassStageOutputSchema.shape, raw?.primaryMass);
  const merged: FoundationStageOutput = {
    intent: { ...fallback.intent, ...intentRecovery.recovered },
    siteStrategy: { ...fallback.siteStrategy, ...siteRecovery.recovered },
    primaryMass: { ...fallback.primaryMass, ...massRecovery.recovered },
  };
  const recoveredFields = [
    ...intentRecovery.recoveredKeys.map((k) => `intent.${k}`),
    ...siteRecovery.recoveredKeys.map((k) => `siteStrategy.${k}`),
    ...massRecovery.recoveredKeys.map((k) => `primaryMass.${k}`),
  ];
  const defaultedFields = [
    ...intentRecovery.defaultedKeys.map((k) => `intent.${k}`),
    ...siteRecovery.defaultedKeys.map((k) => `siteStrategy.${k}`),
    ...massRecovery.defaultedKeys.map((k) => `primaryMass.${k}`),
  ];
  if (isDev) {
    console.debug("[foundation] degraded result — salvaged fields individually instead of using a fully generic default", {
      rawValue: raw, recoveredFields, defaultedFields, errors: result.errors,
    });
  }
  return {
    value: toResult(ctx, merged),
    status: recoveredFields.length > 0 ? "recovered" : "fallback",
    attempts: result.attempts, durationMs: result.durationMs,
    recoveredFields, defaultedFields, error: result.errors.join("; "),
  };
}
