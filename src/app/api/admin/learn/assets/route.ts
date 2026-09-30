import { NextRequest, NextResponse } from "next/server";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin/auth";
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, getAssetPlanningModel, getAssetPlanningModelId, isAiConfigured } from "@/lib/ai/model";
import { withUsageLogging } from "@/lib/ai/usage/track";
import { planAssets, planOutputSchema } from "@/lib/library/planner";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    needId: z.string().min(1).max(80).optional(),
    knowledgeId: z.string().min(1).max(80).optional(),
    /** Names already in the admin's library, so the pack does not repeat them. */
    known: z.array(z.string().max(80)).max(80).optional(),
    /** Names from a discarded pack, so a regeneration differs. */
    avoid: z.array(z.string().max(80)).max(40).optional(),
  })
  .refine((b) => b.needId || b.knowledgeId, { message: "needId or knowledgeId is required" });

/** Drafts an Asset Pack for a Need. Read-only: nothing is saved or generated. Usage is logged as "asset_plan". */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  try {
    const result = await planAssets(
      { needId: body.data.needId, knowledgeId: body.data.knowledgeId },
      async ({ system, prompt }) => {
        const { output } = await withUsageLogging({ projectId: null, requestType: "asset_plan", scope: "world", model: getAssetPlanningModelId(), maxOutputTokens: 8000, stage: "asset-planning" }, () =>
          generateText({
            model: getAssetPlanningModel(),
            maxOutputTokens: 8000,
            system,
            messages: [{ role: "user", content: prompt }],
            output: Output.object({ schema: planOutputSchema }),
            providerOptions: AI_PROVIDER_OPTIONS,
          })
        );
        return output;
      },
      { known: body.data.known, avoid: body.data.avoid }
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ draft: result.draft, adjustments: result.adjustments });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) return NextResponse.json({ error: "AI response didn't match the asset plan format." }, { status: 502 });
    console.error("[admin/learn/assets] planning failed:", err);
    return NextResponse.json({ error: "Asset planning failed. Please try again." }, { status: 500 });
  }
}
