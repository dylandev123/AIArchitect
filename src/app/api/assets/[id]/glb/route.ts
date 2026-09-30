import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { assetBackend, MAX_GLB_BYTES } from "@/lib/assets/serverStore";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The stored GLB. An approved asset's file is public (every project renders it); a pending one's is admin-only. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const store = assetBackend();
    const asset = await store.get(id);
    if (!asset || (asset.status !== "approved" && !isAdminRequest(req))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const bytes = await store.getGlb(id);
    if (!bytes) return NextResponse.json({ error: "No GLB stored for this asset." }, { status: 404 });
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "model/gltf-binary", "Content-Length": String(bytes.byteLength), "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch (err) {
    console.error("[assets/glb] read failed:", err);
    return NextResponse.json({ error: "The asset store is unavailable." }, { status: 503 });
  }
}

/** Stores the GLB for an asset the server already has (raw bytes as the body). */
export async function PUT(req: NextRequest, ctx: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  if (bytes.byteLength > MAX_GLB_BYTES) return NextResponse.json({ error: `GLB is larger than ${MAX_GLB_BYTES} bytes.` }, { status: 413 });
  // "glTF" magic: refuse anything that is not a binary glTF.
  if (bytes[0] !== 0x67 || bytes[1] !== 0x6c || bytes[2] !== 0x54 || bytes[3] !== 0x46) return NextResponse.json({ error: "Not a GLB file." }, { status: 400 });
  try {
    const store = assetBackend();
    if (!(await store.get(id))) return NextResponse.json({ error: "Save the asset before its file." }, { status: 404 });
    await store.putGlb(id, bytes);
    return NextResponse.json({ ok: true, size: bytes.byteLength });
  } catch (err) {
    console.error("[assets/glb] write failed:", err);
    return NextResponse.json({ error: "The asset store is unavailable." }, { status: 503 });
  }
}
