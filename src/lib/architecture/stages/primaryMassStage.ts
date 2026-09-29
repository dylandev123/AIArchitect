import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassVolume, SiteStrategy } from "../document";
import { runStage, type RunStageResult } from "./runStage";
import { primaryMassStageOutputSchema } from "./schemas";

const SYSTEM = `You are a senior residential architect choosing the primary mass: the single dominant volume every other piece of the composition will be built around. Size it from the brief and the architectural intent — do not default to a generic box. This mass anchors the site at the origin; you are not choosing its position, only its name and proportions.`;

export interface PrimaryMassStageContext { brief: string; intent: ArchitecturalIntent; siteStrategy: SiteStrategy; }

export async function runPrimaryMassStage(ctx: PrimaryMassStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RunStageResult<MassVolume>> {
  const result = await runStage({
    stageName: "primary-mass",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${ctx.brief}`,
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; hierarchy goals: ${ctx.intent.hierarchyGoals.join("; ")}; composition bias ${ctx.intent.compositionBias}.`,
      `Site strategy: environment=${ctx.siteStrategy.environment}, terrain=${ctx.siteStrategy.terrain}, view faces ${ctx.siteStrategy.viewDirection}.`,
      previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: primaryMassStageOutputSchema,
    timings, remainingBudgetMs, usageMeta,
    maxOutputTokens: 300,
  });
  if (!result.ok) return result;
  const mass: MassVolume = {
    id: "mass-0", name: result.value.name, role: "main-living",
    position: { x: 0, z: 0 }, width: result.value.width, depth: result.value.depth, floors: result.value.floors,
    elevation: 0, rotation: 0,
  };
  return { ok: true, value: mass };
}
