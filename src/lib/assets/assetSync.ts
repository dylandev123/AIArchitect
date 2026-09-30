import { useAdminStore } from "@/store/useAdminStore";
import { useAssetStore } from "@/store/useAssetStore";
import type { CuratedAsset } from "@/types/assets";
import { getGlbStore } from "./glbStorage";

/**
 * Keeps the browser's asset library in step with the server, which is the source of truth (`/api/assets`, backed by
 * `lib/assets/serverStore`). localStorage and IndexedDB are a cache:
 *
 *  - Load: the catalog (and, for an admin, the queue) is replaced by the server's. Anything only this browser had is set
 *    aside in `localOnly` until imported or discarded.
 *  - Write-through: every change to the store (queue, approve, upgrade, reject, remove, metadata edits) is sent to the server
 *    in order, followed by the GLB bytes of any model the server does not have yet.
 *  - Models: GLB bytes come from IndexedDB when cached there, otherwise from the server (and are then cached).
 */

const COUNTERS = ["usageCount", "successCount", "failureCount"] as const;
/** How long a generation waits for the first server load before using whatever the cache holds. */
const READY_TIMEOUT_MS = 5_000;
const IMPORT_BATCH = 10;

let started = false;
let applyingServer = false;
let hydration: Promise<void> | null = null;
let writes: Promise<unknown> = Promise.resolve();
let serverGlbIds = new Set<string>();

const adminEmail = () => useAdminStore.getState().adminEmail;
const adminHeaders = (): Record<string, string> => (adminEmail() ? { "x-admin-email": adminEmail() } : {});
const glbUrl = (id: string) => `/api/assets/${encodeURIComponent(id)}/glb`;

function fail(message: string) {
  console.warn(`[assets] ${message}`);
  useAssetStore.getState().setSync({ error: message });
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return res;
}

/** Runs server writes one at a time, in the order the store changed. */
function enqueue(label: string, task: () => Promise<void>): Promise<void> {
  const next = writes.then(task).catch((err: Error) => fail(`${label} was not saved to the server: ${err.message}`));
  writes = next;
  return next;
}

async function uploadGlb(id: string): Promise<boolean> {
  if (serverGlbIds.has(id)) return true;
  const bytes = await getGlbStore().get(id);
  if (!bytes) return false;
  await send(glbUrl(id), { method: "PUT", headers: { ...adminHeaders(), "Content-Type": "model/gltf-binary" }, body: bytes });
  serverGlbIds.add(id);
  return true;
}

function saveAsset(asset: CuratedAsset) {
  return enqueue(`"${asset.name}"`, async () => {
    await send("/api/assets", { method: "PUT", headers: { ...adminHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(asset) });
    if (asset.type === "glb-model") await uploadGlb(asset.id);
  });
}

function deleteAsset(id: string) {
  return enqueue(`Removing ${id}`, async () => {
    await send(`/api/assets?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: adminHeaders() });
    serverGlbIds.delete(id);
  });
}

function reportOutcome(id: string, outcome: "success" | "failure") {
  void fetch(`/api/assets/${encodeURIComponent(id)}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }) }).catch(() => {});
}

/** Which counter moved, when a change touched nothing but the usage counters (those go to the outcome endpoint, not a save). */
function counterOnlyChange(before: CuratedAsset, after: CuratedAsset): "success" | "failure" | "other" | null {
  const strip = (a: CuratedAsset) => JSON.stringify({ ...a, usageCount: 0, successCount: 0, failureCount: 0 });
  if (strip(before) !== strip(after)) return null;
  if ((after.successCount ?? 0) > (before.successCount ?? 0)) return "success";
  if ((after.failureCount ?? 0) > (before.failureCount ?? 0)) return "failure";
  return COUNTERS.some((f) => before[f] !== after[f]) ? "other" : null;
}

function onStoreChange(state: ReturnType<typeof useAssetStore.getState>, prev: ReturnType<typeof useAssetStore.getState>) {
  if (applyingServer || (state.catalog === prev.catalog && state.queue === prev.queue)) return;
  const before = new Map([...prev.catalog, ...prev.queue].map((a) => [a.id, a]));
  const after = new Map([...state.catalog, ...state.queue].map((a) => [a.id, a]));
  const admin = !!adminEmail();
  for (const [id, asset] of after) {
    const old = before.get(id);
    if (old === asset) continue;
    const counters = old ? counterOnlyChange(old, asset) : null;
    if (counters) {
      if (counters !== "other") reportOutcome(id, counters);
    } else if (admin) {
      void saveAsset(asset);
    } else {
      fail(`"${asset.name}" changed without an admin session; the change stays in this browser only.`);
    }
  }
  for (const id of before.keys()) {
    if (after.has(id)) continue;
    if (admin) void deleteAsset(id);
    else fail(`Removing ${id} needs an admin session; the server library still has it.`);
  }
}

/** Replaces the cached library with the server's. Resolves once applied (or once the failure is recorded). */
export function hydrateAssetsFromServer(): Promise<void> {
  const run = async () => {
    await writes;
    const store = useAssetStore.getState();
    store.setSync({ status: "loading" });
    const res = await send("/api/assets", { headers: adminHeaders(), cache: "no-store" });
    const data = (await res.json()) as { catalog: CuratedAsset[]; queue?: CuratedAsset[]; glbIds: string[] };
    serverGlbIds = new Set(data.glbIds);
    applyingServer = true;
    try {
      useAssetStore.getState().applyServerLibrary({ catalog: data.catalog, queue: data.queue });
    } finally {
      applyingServer = false;
    }
  };
  hydration = run().catch((err: Error) => {
    useAssetStore.getState().setSync({ status: "error", error: `Could not load the asset library from the server: ${err.message}. Using this browser's cached copy.` });
  });
  return hydration;
}

/**
 * Starts syncing (idempotent): subscribes to store changes, loads the server library, and reloads whenever the admin
 * session changes (an admin also sees the queue).
 */
export function startAssetSync(): Promise<void> {
  if (!started) {
    started = true;
    useAssetStore.subscribe(onStoreChange);
    useAdminStore.subscribe((s, p) => {
      if (s.adminEmail !== p.adminEmail) void hydrateAssetsFromServer();
    });
  }
  return hydrateAssetsFromServer();
}

/** Waits (briefly) for the first server load, so a generation right after page load does not retrieve from a stale cache. */
export async function assetLibraryReady(): Promise<void> {
  if (!hydration) return;
  await Promise.race([hydration, new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT_MS))]);
}

/** Resolves once every queued server write has finished (tests, and before an import). */
export const assetWritesSettled = (): Promise<unknown> => writes;

/** A GLB's bytes: the IndexedDB cache when present, otherwise the server copy (which is then cached). */
export async function loadAssetGlbBytes(id: string): Promise<ArrayBuffer> {
  const cached = await getGlbStore().get(id).catch(() => null);
  if (cached) return cached;
  const res = await fetch(glbUrl(id), { headers: adminHeaders() });
  if (!res.ok) throw new Error(res.status === 404 ? "The GLB file is not stored on the server or on this device." : `Model download failed (HTTP ${res.status}).`);
  const bytes = await res.arrayBuffer();
  void getGlbStore().put(id, bytes).catch(() => {});
  return bytes;
}

export interface ImportResult {
  inserted: number;
  /** Already on the server under the same id: left untouched. */
  existing: number;
  glbsUploaded: number;
  /** GLB assets whose file is not in this browser's IndexedDB either (imported without a model). */
  glbsMissing: string[];
  error?: string;
}

/**
 * Imports this browser's `localOnly` assets into the server library, keeping every id, approval, validation, relationship
 * (Need, Plan, Knowledge, upgrade lineage) and counter. Never overwrites an asset the server already has. Safe to re-run.
 * Nothing is regenerated and no AI is called.
 */
export async function importLocalOnlyAssets(): Promise<ImportResult> {
  const result: ImportResult = { inserted: 0, existing: 0, glbsUploaded: 0, glbsMissing: [] };
  if (!adminEmail()) return { ...result, error: "Sign in as admin to import." };
  // An admin load first: it also sets aside queued items the server lacks, and reflects anything imported elsewhere meanwhile.
  await hydrateAssetsFromServer();
  if (useAssetStore.getState().sync.status !== "ready") return { ...result, error: useAssetStore.getState().sync.error };
  const assets = useAssetStore.getState().localOnly;
  try {
    for (let i = 0; i < assets.length; i += IMPORT_BATCH) {
      const batch = assets.slice(i, i + IMPORT_BATCH);
      const res = await send("/api/assets/import", { method: "POST", headers: { ...adminHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ assets: batch }) });
      const data = (await res.json()) as { inserted: string[]; existing: string[] };
      result.inserted += data.inserted.length;
      result.existing += data.existing.length;
    }
    // Refresh which files the server has, then fill in the missing ones from this browser.
    const listing = (await (await send("/api/assets", { headers: adminHeaders(), cache: "no-store" })).json()) as { glbIds: string[] };
    serverGlbIds = new Set(listing.glbIds);
    for (const a of assets) {
      if (a.type !== "glb-model" || serverGlbIds.has(a.id)) continue;
      if (await uploadGlb(a.id)) result.glbsUploaded++;
      else result.glbsMissing.push(a.id);
    }
  } catch (err) {
    result.error = (err as Error).message;
  }
  await hydrateAssetsFromServer();
  return result;
}

/** Test seam: forgets module state so a test can start from a fresh page. */
export function resetAssetSyncForTests(): void {
  started = false;
  applyingServer = false;
  hydration = null;
  writes = Promise.resolve();
  serverGlbIds = new Set();
}
