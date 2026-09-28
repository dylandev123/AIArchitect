import { NextRequest, NextResponse } from "next/server";
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin/auth";
import { AI_NOT_CONFIGURED_MESSAGE, isAiConfigured } from "@/lib/ai/model";
import { generateUpgradeSpec } from "@/lib/library/nativeAi";
import { callNativeModel } from "@/lib/library/nativeModel";
import { ASSET_CATEGORIES } from "@/types/library";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const metres = z.number().positive().max(50).optional();

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(ASSET_CATEGORIES),
  style: z.array(z.string().max(40)).max(12).default([]),
  material: z.string().max(80).optional(),
  dimensions: z.object({ width: metres, depth: metres, height: metres }).optional(),
  generationPrompt: z.string().max(2000).optional(),
  /** The approved version's spec: the starting point. It is validated (and repaired) before it is used. */
  current: z.record(z.string(), z.unknown()),
  /** What the admin wants improved; absent means a general polish. */
  instruction: z.string().trim().min(3).max(400).optional(),
});

/**
 * Generates an upgrade CANDIDATE spec for an approved native asset. Stateless: nothing is saved and the approved version is not
 * touched; the client stages the candidate as a pending asset under the same stableAssetId and the admin reviews it against the
 * current version. Usage is logged like any native generation, the automatic repair retry separately.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAiConfigured()) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "name, category and the current spec are required" }, { status: 400 });

  try {
    const { instruction, ...source } = body.data;
    const result = await generateUpgradeSpec(source, callNativeModel, instruction);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.kind === "spec" ? { kind: "spec", spec: result.spec, stats: result.stats } : { kind: "external", reason: result.reason });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) return NextResponse.json({ error: "AI response didn't match the asset spec format." }, { status: 502 });
    console.error("[admin/learn/native/upgrade] generation failed:", err);
    return NextResponse.json({ error: "Upgrade generation failed. Please try again." }, { status: 500 });
  }
}
