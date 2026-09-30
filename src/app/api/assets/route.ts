import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { parseCuratedAsset, serverApprovalBlocker } from "@/lib/assets/assetSchema";
import { assetBackend } from "@/lib/assets/serverStore";
import { SharedPersistenceUnavailableError } from "@/lib/storage/diagnostics";
import type { CuratedAsset } from "@/types/assets";

export const dynamic = "force-dynamic";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const unavailable = (err: unknown) => {
  console.error("[assets] store failed:", err);
  return NextResponse.json({ error: err instanceof SharedPersistenceUnavailableError ? err.message : "The asset store is unavailable." }, { status: 503 });
};

/**
 * The curated-asset library. Everyone gets the approved catalog (generation and rendering need it); the review queue is admin-only.
 * `glbIds` lists which assets have their GLB stored on the server.
 */
export async function GET(req: NextRequest) {
  const admin = isAdminRequest(req);
  try {
    const { assets, glbIds } = await assetBackend().list();
    const catalog = assets.filter((a) => a.status === "approved");
    const visible = new Set((admin ? assets : catalog).map((a) => a.id));
    return NextResponse.json({
      catalog,
      ...(admin ? { queue: assets.filter((a) => a.status === "pending") } : {}),
      glbIds: glbIds.filter((id) => visible.has(id)),
    });
  } catch (err) {
    return unavailable(err);
  }
}

/** Creates or replaces one asset (metadata, approval, validation, relationships). Usage counters stay the server's. */
export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const parsed = parseCuratedAsset(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid asset" }, { status: 400 });
  const asset = parsed.data as CuratedAsset;
  const blocker = serverApprovalBlocker(asset);
  if (blocker) return NextResponse.json({ error: blocker }, { status: 409 });
  try {
    await assetBackend().put(asset);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return unavailable(err);
  }
}

export async function DELETE(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    await assetBackend().remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return unavailable(err);
  }
}
