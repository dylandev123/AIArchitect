import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CuratedAsset } from "@/types/assets";

/**
 * The server library is the source of truth for curated assets: what one browser approves must be retrievable from another
 * (or the same one after its storage is cleared), and assets that only ever lived in a browser can be imported without loss.
 * Requests go through the real route handlers, backed by the file store in a temp dir (the Postgres store shares the contract).
 */

const ADMIN = "admin@example.com";
const local = new Map<string, string>();
let dir = "";

type Handler = (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

/** Routes a browser fetch to the app's route handlers, like the dev server would. */
async function serverFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  const req = new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
  const method = (init?.method ?? "GET") as "GET" | "PUT" | "POST" | "DELETE";
  const byId = url.pathname.match(/^\/api\/assets\/([^/]+)\/(glb|outcome)$/);
  let mod: Record<string, Handler | unknown>;
  let params = {};
  if (url.pathname === "/api/assets") mod = await import("@/app/api/assets/route");
  else if (url.pathname === "/api/assets/import") mod = await import("@/app/api/assets/import/route");
  else if (byId?.[2] === "glb") [mod, params] = [await import("@/app/api/assets/[id]/glb/route"), { id: decodeURIComponent(byId[1]) }];
  else if (byId?.[2] === "outcome") [mod, params] = [await import("@/app/api/assets/[id]/outcome/route"), { id: decodeURIComponent(byId[1]) }];
  else return new Response("not found", { status: 404 });
  return (mod[method] as Handler)(req, { params: Promise.resolve(params as { id: string }) });
}

/** A fresh page load: new module instances (stores, sync state) over whatever localStorage/IndexedDB currently hold. */
async function openPage(glbStore?: import("../glbStorage").GlbBlobStore) {
  vi.resetModules();
  const glb = await import("../glbStorage");
  const store = glbStore ?? glb.createMemoryGlbStore();
  glb.setGlbStore(store);
  const [{ useAssetStore }, { useAdminStore }, sync, retrieval] = await Promise.all([
    import("@/store/useAssetStore"),
    import("@/store/useAdminStore"),
    import("../assetSync"),
    import("@/lib/library/retrieval"),
  ]);
  return { useAssetStore, useAdminStore, sync, retrieval, glbStore: store };
}

/** Clears this origin's browser storage the way the browser's "clear site data" does. */
const clearBrowserStorage = () => local.clear();

/** A minimal GLB header ("glTF", version 2): enough for the server's file check; the bytes are compared, never parsed. */
const glbBytes = (seed: number) => {
  const bytes = new Uint8Array(64);
  bytes.set([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 64, 0, 0, 0]);
  for (let i = 12; i < bytes.length; i++) bytes[i] = (seed + i) % 256;
  return bytes.buffer;
};

const light = (over: Partial<CuratedAsset> = {}): CuratedAsset => ({
  id: "native-light-1",
  sourceSlug: "native:pa-lantern:abc123",
  source: "generated",
  type: "glb-model",
  name: "Garden Lantern",
  categories: ["light"],
  tags: ["lantern", "light", "native"],
  thumbnailUrl: "data:image/svg+xml;utf8,x",
  pbr: { baseColor: "#222222", roughness: 0.6, metalness: 0.3 },
  compatibleStyles: [],
  contentHash: "native-abc123",
  status: "pending",
  importedAt: "2026-09-01T10:00:00.000Z",
  family: "light",
  styleTags: ["modern"],
  contextTags: ["garden", "path"],
  dimensions: { width: 0.3, depth: 0.3, height: 1.2 },
  needId: "need-garden-lighting",
  planId: "plan-lighting-pack",
  plannedAssetId: "pa-lantern",
  knowledgeIds: ["knowledge-lighting"],
  stableAssetId: "native:pa-lantern",
  generatorVersion: "native-1",
  styleProfileVersion: 3,
  generationPrompt: "A slim modern garden lantern",
  createdAt: "2026-09-01T10:00:00.000Z",
  validation: { checkedAt: "2026-09-01T10:00:01.000Z", passed: true, errors: [], warnings: [], validatorVersion: 4, fileSizeBytes: 64, triangleCount: 480, dimensions: { width: 0.3, depth: 0.3, height: 1.2 } },
  ...over,
});

const wantLight = { category: "light" as const, styleTags: ["modern"], contextTags: ["garden"], dimensions: { width: 0.3, depth: 0.3, height: 1.2 } };

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "asset-store-"));
  local.clear();
  vi.stubEnv("AI_ASSET_STORE_PATH", dir);
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  const localStorage = {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k),
  };
  // zustand's persist middleware reads window.localStorage.
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage });
  vi.stubGlobal("fetch", vi.fn(serverFetch));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true, force: true });
});

describe("server-backed asset library", () => {
  it("retrieves a persisted approved light after the browser's storage is cleared", async () => {
    // Browser A: an admin stages a generated light (bytes cached in IndexedDB by ingest), then approves it.
    const a = await openPage();
    a.useAdminStore.getState().setAdmin(ADMIN);
    await a.sync.startAssetSync();
    await a.glbStore.put("native-light-1", glbBytes(7));
    a.useAssetStore.getState().addToQueue(light());
    a.useAssetStore.getState().approve("native-light-1");
    await a.sync.assetWritesSettled();
    expect(a.useAssetStore.getState().sync.error).toBe("");
    const approved = a.useAssetStore.getState().catalog[0];
    expect(approved).toMatchObject({ id: "native-light-1", status: "approved", version: 1 });

    expect(JSON.parse(local.get("ai-architect-assets")!).state.catalog).toHaveLength(1);
    // Clear localStorage and IndexedDB, then open the app again: no admin session, nothing cached.
    clearBrowserStorage();
    const b = await openPage();
    expect(b.useAssetStore.getState().catalog).toEqual([]);
    expect(b.retrieval.resolveAsset(b.retrieval.toAssetIndex(b.useAssetStore.getState().catalog), wantLight).kind).toBe("fallback");

    await b.sync.startAssetSync();
    const { catalog, sync, localOnly } = b.useAssetStore.getState();
    expect(sync.status).toBe("ready");
    expect(localOnly).toEqual([]);
    // The whole asset came back: approval, version, validation and its Recipe → Need → Plan links, unchanged.
    expect(catalog).toEqual([approved]);

    // Retrieval (what the generation request sends to the server) finds it...
    const resolution = b.retrieval.resolveAsset(b.retrieval.toAssetIndex(catalog), wantLight);
    expect(resolution.kind).toBe("asset");
    expect(resolution.kind === "asset" && resolution.asset.id).toBe("native-light-1");
    // ...and the renderer can load its model: the bytes come from the server and are cached again locally.
    const bytes = await b.sync.loadAssetGlbBytes("native-light-1");
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array(glbBytes(7)));
    expect(await b.glbStore.get("native-light-1")).not.toBeNull();
  });

  it("imports browser-only assets without losing ids or links, never overwriting the server, and never regenerating", async () => {
    // A browser from before the move: the light (approved) and a queued candidate live only in localStorage + IndexedDB.
    const legacyGlb = (await import("../glbStorage")).createMemoryGlbStore();
    await legacyGlb.put("native-light-1", glbBytes(3));
    const queued = light({ id: "native-light-2", sourceSlug: "native:pa-lantern:def456", status: "pending", upgradeOf: "native-light-1" });
    const approvedLight = light({ status: "approved", version: 1, usageCount: 5, successCount: 4, failureCount: 1 });
    local.set("ai-architect-assets", JSON.stringify({ state: { catalog: [approvedLight], queue: [queued] }, version: 0 }));

    const page = await openPage(legacyGlb);
    expect(page.useAssetStore.getState().catalog).toHaveLength(1);
    await page.sync.startAssetSync();
    // The server is empty, so the browser's copies are set aside (kept, not used, not deleted).
    expect(page.useAssetStore.getState().catalog).toEqual([]);
    expect(page.useAssetStore.getState().localOnly.map((a) => a.id)).toEqual(["native-light-1"]);
    expect(await legacyGlb.get("native-light-1")).not.toBeNull();

    // Signing in as admin reloads with the queue, so the queued candidate is set aside too.
    page.useAdminStore.getState().setAdmin(ADMIN);
    await vi.waitFor(() => expect(page.useAssetStore.getState().localOnly.map((a) => a.id)).toEqual(["native-light-1", "native-light-2"]));
    expect(page.useAssetStore.getState().queue).toEqual([]);
    const result = await page.sync.importLocalOnlyAssets();
    expect(result).toEqual({ inserted: 2, existing: 0, glbsUploaded: 1, glbsMissing: ["native-light-2"] });
    const after = page.useAssetStore.getState();
    expect(after.localOnly).toEqual([]);
    expect(after.catalog).toEqual([approvedLight]);
    expect(after.queue).toEqual([queued]);

    // Re-running is a no-op, and a stale browser copy never overwrites what the server holds.
    const { assetBackend } = await import("../serverStore");
    await assetBackend().put({ ...approvedLight, name: "Renamed on server" });
    page.useAssetStore.setState({ localOnly: [approvedLight] });
    // The server copy wins: a stale browser copy is dropped on load rather than imported...
    expect(await page.sync.importLocalOnlyAssets()).toMatchObject({ inserted: 0, existing: 0 });
    expect(page.useAssetStore.getState().localOnly).toEqual([]);
    // ...and even sent straight to the import endpoint it is refused as already present.
    const direct = await serverFetch("/api/assets/import", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-email": ADMIN }, body: JSON.stringify({ assets: [approvedLight] }) });
    expect(await direct.json()).toEqual({ ok: true, inserted: [], existing: ["native-light-1"] });
    expect((await assetBackend().get("native-light-1"))?.name).toBe("Renamed on server");

    // Another browser (nothing local) now retrieves the imported light, with its counters and file.
    clearBrowserStorage();
    const other = await openPage();
    await other.sync.startAssetSync();
    const [imported] = other.useAssetStore.getState().catalog;
    expect(imported).toMatchObject({ id: "native-light-1", planId: "plan-lighting-pack", needId: "need-garden-lighting", knowledgeIds: ["knowledge-lighting"], successCount: 4 });
    expect(other.retrieval.resolveAsset(other.retrieval.toAssetIndex(other.useAssetStore.getState().catalog), wantLight).kind).toBe("asset");
    expect(new Uint8Array(await other.sync.loadAssetGlbBytes("native-light-1"))).toEqual(new Uint8Array(glbBytes(3)));
  });

  it("writes removals and usage outcomes through, and an admin save never rolls back the server's counters", async () => {
    const page = await openPage();
    page.useAdminStore.getState().setAdmin(ADMIN);
    await page.sync.startAssetSync();
    await page.glbStore.put("native-light-1", glbBytes(1));
    page.useAssetStore.getState().addToQueue(light());
    page.useAssetStore.getState().approve("native-light-1");
    await page.sync.assetWritesSettled();

    page.useAssetStore.getState().recordAssetOutcome("native-light-1", "success");
    await vi.waitFor(async () => {
      const { assetBackend } = await import("../serverStore");
      expect((await assetBackend().get("native-light-1"))?.successCount).toBe(1);
    });
    // A metadata edit carries the browser's (possibly stale) counters: the server keeps its own.
    page.useAssetStore.setState((s) => ({ catalog: s.catalog.map((a) => ({ ...a, successCount: 0, usageCount: 0 })) }));
    page.useAssetStore.getState().updateAssetMeta("native-light-1", { styleTags: ["modern", "minimal"] });
    await page.sync.assetWritesSettled();
    const { assetBackend } = await import("../serverStore");
    expect(await assetBackend().get("native-light-1")).toMatchObject({ styleTags: ["modern", "minimal"], successCount: 1, usageCount: 1 });

    page.useAssetStore.getState().removeFromCatalog("native-light-1");
    await page.sync.assetWritesSettled();
    expect(await assetBackend().get("native-light-1")).toBeNull();
    expect(await assetBackend().getGlb("native-light-1")).toBeNull();
  });

  it("refuses writes without an admin session and an approval the validation gate would block", async () => {
    const put = (asset: CuratedAsset, email?: string) => serverFetch("/api/assets", { method: "PUT", headers: { "Content-Type": "application/json", ...(email ? { "x-admin-email": email } : {}) }, body: JSON.stringify(asset) });
    expect((await put(light())).status).toBe(401);
    expect((await put(light({ status: "approved", validation: undefined }), ADMIN)).status).toBe(409);
    expect((await put(light(), ADMIN)).status).toBe(200);
    // A pending asset (and its file) is not visible to the public catalog.
    const listing = (await (await serverFetch("/api/assets")).json()) as { catalog: unknown[]; queue?: unknown[] };
    expect(listing).toEqual({ catalog: [], glbIds: [] });
    expect((await serverFetch("/api/assets/native-light-1/glb")).status).toBe(404);
  });
});
