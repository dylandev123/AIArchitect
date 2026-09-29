import type { SiteHints } from "@/lib/house/siteSettings";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { ArchitecturalIntent } from "../designEngine";
import type { SiteStrategy } from "../document";
import { runStage, type RunStageResult } from "./runStage";
import { siteStrategyStageOutputSchema } from "./schemas";

const SYSTEM = `You are a senior residential architect deciding site strategy: where arrival, the view, and terrain response sit relative to the building — before any masses exist. Decide whether the composition should sit level or step with the land, and briefly say how the terrain should be handled. Honor the architectural intent you were given.`;

export interface SiteStrategyStageContext { brief: string; intent: ArchitecturalIntent; hints: SiteHints; }

/** The brief's explicit statements (hints) always win over the model, matching `resolveSiteSettings`'s philosophy. */
export async function runSiteStrategyStage(ctx: SiteStrategyStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RunStageResult<SiteStrategy>> {
  const result = await runStage({
    stageName: "site-strategy",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${ctx.brief}`,
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; spatial goals ${ctx.intent.spatialGoals.join(", ")}; composition bias ${ctx.intent.compositionBias}.`,
      `Default site facts (override only if the brief clearly implies otherwise): environment=${ctx.intent.source.environment}, view direction=${ctx.intent.source.viewDirection}, arrival direction=${ctx.intent.source.arrivalDirection}.`,
      previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: siteStrategyStageOutputSchema,
    timings, remainingBudgetMs, usageMeta,
    maxOutputTokens: 400,
  });
  if (!result.ok) return result;
  const strategy: SiteStrategy = {
    environment: ctx.hints.environment ?? result.value.environment,
    viewDirection: ctx.hints.viewDirection ?? result.value.viewDirection,
    arrivalDirection: ctx.hints.approachSide ?? result.value.arrivalDirection,
    terrain: ctx.hints.terrainSlope === "steep" ? "stepped" : ctx.hints.terrainSlope === "flat" ? "level" : result.value.terrain,
  };
  return { ok: true, value: strategy };
}
