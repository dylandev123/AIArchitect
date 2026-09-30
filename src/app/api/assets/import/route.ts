import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { parseCuratedAsset } from "@/lib/assets/assetSchema";
import { assetBackend } from "@/lib/assets/serverStore";
import { SharedPersistenceUnavailableError } from "@/lib/storage/diagnostics";
import type { CuratedAsset } from "@/types/assets";

export const dynamic = "force-dynamic";

const MAX_BATCH = 25;

/**
 * One-way, non-destructive import of browser-local assets (the pre-server localStorage catalog). Each asset is inserted with its
 * id, approval, validation, relationships and counters exactly as the browser held them; an id the server already has is left
 * untouched, so re-running an import never overwrites anything. The approval gate is not re-applied: these were approved under
 * the rules of their day, and refusing them now would lose them.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { assets?: unknown } | null;
  if (!Array.isArray(body?.assets) || body.assets.length > MAX_BATCH) return NextResponse.json({ error: `Send 1–${MAX_BATCH} assets per request.` }, { status: 400 });
  const assets: CuratedAsset[] = [];
  for (const raw of body.assets) {
    const parsed = parseCuratedAsset(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid asset" }, { status: 400 });
    assets.push(parsed.data as CuratedAsset);
  }
  try {
    const inserted: string[] = [];
    const existing: string[] = [];
    for (const asset of assets) ((await assetBackend().insertIfAbsent(asset)) ? inserted : existing).push(asset.id);
    return NextResponse.json({ ok: true, inserted, existing });
  } catch (err) {
    console.error("[assets/import] failed:", err);
    return NextResponse.json({ error: err instanceof SharedPersistenceUnavailableError ? err.message : "The asset store is unavailable." }, { status: 503 });
  }
}
