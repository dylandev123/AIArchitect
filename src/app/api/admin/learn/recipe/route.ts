import { NextRequest, NextResponse } from "next/server";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin/auth";
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, getAiModel, getAiModelId, isAiConfigured } from "@/lib/ai/model";
import { withUsageLogging } from "@/lib/ai/usage/track";
import { proposeRecipe, recipeProposalOutputSchema } from "@/lib/library/proposal";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  knowledgeId: z.string().min(1).max(80),
  /** Names of drafts the admin already discarded, so a regeneration differs. */
  avoid: z.array(z.string().max(80)).max(10).optional(),
});

/**
 * Proposes a recipe draft for a Knowledge Need. Read-only: nothing is saved here. The admin reviews the draft in the
 * recipe form and saves it as "proposed" through the library route. Usage is logged as "recipe_proposal".
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Missing knowledgeId" }, { status: 400 });

  try {
    const result = await proposeRecipe(
      body.data.knowledgeId,
      async ({ system, prompt }) => {
        const { output } = await withUsageLogging({ projectId: null, requestType: "recipe_proposal", scope: "world", model: getAiModelId() }, () =>
          generateText({
            model: getAiModel(),
            maxOutputTokens: 3000,
            system,
            messages: [{ role: "user", content: prompt }],
            output: Output.object({ schema: recipeProposalOutputSchema }),
            providerOptions: AI_PROVIDER_OPTIONS,
          })
        );
        return output;
      },
      body.data.avoid
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ recipe: result.recipe, adjustments: result.adjustments });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) return NextResponse.json({ error: "AI response didn't match the recipe format." }, { status: 502 });
    console.error("[admin/learn/recipe] proposal failed:", err);
    return NextResponse.json({ error: "Recipe proposal failed. Please try again." }, { status: 500 });
  }
}
