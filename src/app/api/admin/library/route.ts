import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin/auth";
import { generationAvailability } from "@/lib/assetGeneration/providers";
import { recipeInputSchema } from "@/lib/library/recipes";
import { changeRecipeApproval, deleteRecipe, saveRecipe, setNeedStatus, type AdminResult } from "@/lib/library/service";
import { readLibrary } from "@/lib/library/store";
import { NEED_STATUSES, RECIPE_APPROVALS } from "@/types/library";

export const dynamic = "force-dynamic";

const id = z.string().min(1).max(80);

const actionSchema = z.discriminatedUnion("action", [
  // "approved" is only ever reached by approving the asset the need produced, never set by hand.
  z.object({ action: z.literal("setNeedStatus"), id, status: z.enum(NEED_STATUSES).exclude(["approved"]) }),
  // Called when an admin approves an asset that was made for a need.
  z.object({ action: z.literal("completeNeed"), id, assetId: id }),
  z.object({ action: z.literal("saveRecipe"), id: id.optional(), recipe: recipeInputSchema }),
  z.object({ action: z.literal("setRecipeApproval"), id, approval: z.enum(RECIPE_APPROVALS) }),
  z.object({ action: z.literal("deleteRecipe"), id }),
]);

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** The reusable library: needs and recipes (stored server-side), plus whether asset generation is available. */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const { needs, recipes } = await readLibrary();
    needs.sort((a, b) => b.requestedCount - a.requestedCount || b.lastRequested.localeCompare(a.lastRequested));
    recipes.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return NextResponse.json({ needs, recipes, generation: generationAvailability() });
  } catch (err) {
    console.error("[library] read failed:", err);
    return NextResponse.json({ error: "The library store is unavailable." }, { status: 503 });
  }
}

function respond<T>(result: AdminResult<T>) {
  return result.ok ? NextResponse.json({ ok: true, value: result.value }) : NextResponse.json({ error: result.error }, { status: result.status });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const a = parsed.data;
  try {
    switch (a.action) {
      case "setNeedStatus":
        return respond(await setNeedStatus(a.id, a.status));
      case "completeNeed":
        return respond(await setNeedStatus(a.id, "approved", a.assetId));
      case "saveRecipe":
        return respond(await saveRecipe(a.recipe, a.id));
      case "setRecipeApproval":
        return respond(await changeRecipeApproval(a.id, a.approval));
      case "deleteRecipe":
        return respond(await deleteRecipe(a.id));
    }
  } catch (err) {
    console.error("[library] write failed:", err);
    return NextResponse.json({ error: "The library store is unavailable." }, { status: 503 });
  }
}
