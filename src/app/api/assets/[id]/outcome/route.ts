import { NextRequest, NextResponse } from "next/server";
import { assetBackend } from "@/lib/assets/serverStore";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Records that an approved model rendered or failed to load (any project, not only admins: this is what ranks retrieval). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { outcome } = ((await req.json().catch(() => ({}))) ?? {}) as { outcome?: unknown };
  if (outcome !== "success" && outcome !== "failure") return NextResponse.json({ error: "outcome must be success or failure" }, { status: 400 });
  try {
    const store = assetBackend();
    if ((await store.get(id))?.status !== "approved") return NextResponse.json({ error: "Not found" }, { status: 404 });
    await store.recordOutcome(id, outcome);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[assets/outcome] failed:", err);
    return NextResponse.json({ error: "The asset store is unavailable." }, { status: 503 });
  }
}
