import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { usageStorageInfo } from "@/lib/ai/usage/store";
import { libraryStorageInfo } from "@/lib/library/store";
import { importLocalData } from "@/lib/storage/importLocalData";

export const dynamic = "force-dynamic";

/** One-time, admin-only migration of .data JSON into the existing Postgres stores. */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (libraryStorageInfo().kind !== "postgres" || usageStorageInfo().kind !== "postgres") {
    return NextResponse.json({ error: "Configure DATABASE_URL or POSTGRES_URL before importing shared persistence." }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as { includeUsage?: unknown };
  try {
    return NextResponse.json({ ok: true, imported: await importLocalData(body.includeUsage !== false) });
  } catch (err) {
    console.error("[admin/import-local] failed:", err);
    return NextResponse.json({ error: "Local data import failed. The source files were not changed." }, { status: 500 });
  }
}
