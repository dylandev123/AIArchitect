import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassVolume, RoofRecipe, SiteStrategy } from "../document";
import { runStage, type RunStageResult } from "./runStage";
import { roofStageOutputSchema } from "./schemas";

const SYSTEM = `You are a senior residential architect choosing the roof for one volume of a larger composition. Each mass may choose its own roof family — you do not have to match the others. Consider this mass's role, its neighbors' roofs, and the site's climate response. A dominant living volume can justify a more expressive roof (floating plane, clerestory); a service or secondary wing usually wants something quieter. Avoid picking the same family as every neighbor unless that repetition is the point.`;

export interface RoofStageContext { intent: ArchitecturalIntent; siteStrategy: SiteStrategy; mass: MassVolume; neighborRoofs: readonly { massId: string; kind: string }[]; }

export async function runRoofStage(ctx: RoofStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RunStageResult<RoofRecipe>> {
  const result = await runStage({
    stageName: `roof-${ctx.mass.id}`,
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; environmental goals ${ctx.intent.environmentalGoals.join(", ")}.`,
      `Site: environment=${ctx.siteStrategy.environment}, terrain=${ctx.siteStrategy.terrain}, view faces ${ctx.siteStrategy.viewDirection}.`,
      `This mass: ${ctx.mass.id} "${ctx.mass.name}", role ${ctx.mass.role}, ${ctx.mass.width.toFixed(1)}x${ctx.mass.depth.toFixed(1)}m, ${ctx.mass.floors} floor(s).`,
      ctx.neighborRoofs.length ? `Neighboring masses' roofs already chosen: ${ctx.neighborRoofs.map((r) => `${r.massId}=${r.kind}`).join(", ")}.` : "This is the first mass to choose a roof.",
      previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: roofStageOutputSchema,
    timings, remainingBudgetMs, usageMeta,
    maxOutputTokens: 300,
  });
  if (!result.ok) return result;
  const recipe: RoofRecipe = { id: `${ctx.mass.id}-roof`, massId: ctx.mass.id, kind: result.value.kind, overhang: result.value.overhang, pitch: result.value.pitch };
  return { ok: true, value: recipe };
}
