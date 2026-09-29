import type { CompassSide, ProjectScale, SiteEnvironment } from "@/types/house";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { ArchitecturalIntent } from "../designEngine";
import { runStage, type RunStageResult } from "./runStage";
import { intentStageOutputSchema } from "./schemas";

const SYSTEM = `You are a senior residential architect. Read a client's brief and decide the architectural intent BEFORE any geometry: the mood, the spatial goals, the environmental/climate goals, which volumes should dominate the composition, and the overall organizing bias. Do not describe rooms, materials, roof forms or exact dimensions yet — that comes later. Be decisive and specific to THIS brief; avoid generic answers that would fit any house.`;

export interface IntentStageContext { brief: string; environment: SiteEnvironment; scale?: ProjectScale; viewDirection: CompassSide; arrivalDirection: CompassSide; }

export async function runIntentStage(ctx: IntentStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RunStageResult<ArchitecturalIntent>> {
  const result = await runStage({
    stageName: "intent",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${ctx.brief}`,
      `Known site facts: environment=${ctx.environment}, view direction=${ctx.viewDirection}, arrival direction=${ctx.arrivalDirection}${ctx.scale ? `, project scale=${ctx.scale}` : ""}.`,
      previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: intentStageOutputSchema,
    timings, remainingBudgetMs, usageMeta,
    maxOutputTokens: 500,
  });
  if (!result.ok) return result;
  const intent: ArchitecturalIntent = {
    mood: result.value.mood, spatialGoals: result.value.spatialGoals, environmentalGoals: result.value.environmentalGoals,
    hierarchyGoals: result.value.hierarchyGoals, compositionBias: result.value.compositionBias,
    source: { environment: ctx.environment, scale: ctx.scale, viewDirection: ctx.viewDirection, arrivalDirection: ctx.arrivalDirection, style: result.value.style },
  };
  return { ok: true, value: intent };
}
