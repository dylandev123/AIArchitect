import { NextRequest, NextResponse } from "next/server";
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin/auth";
import { AI_NOT_CONFIGURED_MESSAGE, isAiConfigured } from "@/lib/ai/model";
import { generateNativeSpec } from "@/lib/library/nativeAi";
import { callNativeModel } from "@/lib/library/nativeModel";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  planId: z.string().min(1).max(80),
  plannedAssetId: z.string().min(1).max(80),
  /** Refinement in words ("make the legs thicker and use darker teak"); absent means generate / regenerate from scratch. */
  instruction: z.string().trim().min(3).max(400).optional(),
});

/**
 * Native Generate / Regenerate / Refine for ONE planned asset: the AI returns an AssetSpec, it is validated and built
 * deterministically, then stored on that asset for review. Usage is logged as "native_asset"; the one automatic repair retry
 * (see `generateSpecWithRepair`) is logged separately as "native_asset_retry". Other assets are untouched.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "planId and plannedAssetId are required" }, { status: 400 });

  try {
    const result = await generateNativeSpec(body.data.planId, body.data.plannedAssetId, callNativeModel, { instruction: body.data.instruction });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.kind === "spec" ? { kind: "spec", spec: result.spec, stats: result.stats } : { kind: "external", reason: result.reason });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) return NextResponse.json({ error: "AI response didn't match the asset spec format." }, { status: 502 });
    console.error("[admin/learn/native] generation failed:", err);
    return NextResponse.json({ error: "Native generation failed. Please try again." }, { status: 500 });
  }
}
