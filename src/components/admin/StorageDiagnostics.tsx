"use client";

import { useEffect, useState } from "react";
import { useAdminStore } from "@/store/useAdminStore";
import { useAssetStore } from "@/store/useAssetStore";
import { getGlbStore } from "@/lib/assets/glbStorage";
import { importLocalOnlyAssets, type ImportResult } from "@/lib/assets/assetSync";
import { ASSET_STORAGE_KEY, originNotice, readPersistedAssetCounts, type PersistedAssetCounts } from "@/lib/storage/browserAssets";
import type { StorageErrorEntry, StorageInfo } from "@/lib/storage/diagnostics";

interface Diagnostics {
  cwd: string;
  usage: { storage: StorageInfo; records: number | null; error: string | null };
  assets: { storage: StorageInfo; approved: number | null; pending: number | null; glbs: number | null; error: string | null };
  library: { storage: StorageInfo; needs: number | null; knowledge: number | null; recipes: number | null; plans: number | null; generations: number | null; error: string | null };
  databaseConnected: boolean;
  localFiles: { path: string; bytes: number; modified: string; records: number | null; inUse: boolean }[];
  errors: StorageErrorEntry[];
}

/** What this browser origin actually holds, read straight from localStorage and IndexedDB (not from the in-memory store). */
interface BrowserState {
  origin: string;
  persisted: PersistedAssetCounts | null;
  /** Whether the zustand persist middleware has finished loading localStorage into the store. */
  hydrated: boolean;
  /** GLB files stored in IndexedDB; null when IndexedDB could not be read. */
  glbFiles: number | null;
  /** Approved/queued GLB assets that have no bytes in IndexedDB (they cannot render). */
  glbMissing: number | null;
}

const storageLabel = (s: StorageInfo) => `${s.kind === "postgres" ? "Postgres" : s.kind === "local-json" ? "Local JSON" : "Unavailable"}${s.kind === "unavailable" ? "" : ` (${s.location})`}${s.ephemeral ? " — temporary, lost between deployments" : ""}`;
const count = (n: number | null) => (n === null ? "unreadable" : n.toLocaleString());

function Row({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`break-all text-right ${bad ? "text-red-400" : "text-neutral-300"}`}>{value}</dd>
    </div>
  );
}

/** Admin-only: which storage is live, what it holds, and any local data files it is not reading. Refetches when `reloadKey` changes. */
export function StorageDiagnostics({ reloadKey }: { reloadKey: number }) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const curated = useAssetStore((s) => s.catalog.length);
  const queued = useAssetStore((s) => s.queue.length);
  const localOnly = useAssetStore((s) => s.localOnly);
  const sync = useAssetStore((s) => s.sync);
  const discardLocalOnly = useAssetStore((s) => s.discardLocalOnly);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState("");
  const [browser, setBrowser] = useState<BrowserState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(ASSET_STORAGE_KEY);
      } catch {
        // blocked storage reads as "not present"
      }
      let glbFiles: number | null = null;
      let glbMissing: number | null = null;
      try {
        const stored = new Set(await getGlbStore().keys());
        const { catalog, queue } = useAssetStore.getState();
        glbFiles = stored.size;
        glbMissing = [...catalog, ...queue].filter((a) => a.type === "glb-model" && !stored.has(a.id)).length;
      } catch {
        // reported as unreadable
      }
      if (!cancelled) setBrowser({ origin: window.location.origin, persisted: readPersistedAssetCounts(raw), hydrated: useAssetStore.persist.hasHydrated(), glbFiles, glbMissing });
    })();
    return () => {
      cancelled = true;
    };
    // catalog/queue sizes re-run the read so the panel follows edits made while it is open
  }, [reloadKey, curated, queued]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/diagnostics", { headers: { "x-admin-email": adminEmail }, cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as Diagnostics;
        if (!cancelled) {
          setData(json);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load diagnostics.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminEmail, reloadKey, imported]);

  const runImport = async () => {
    setImporting(true);
    try {
      setImported(await importLocalOnlyAssets());
    } finally {
      setImporting(false);
    }
  };
  const discard = () => {
    if (window.confirm(`Discard ${localOnly.length} browser-only asset(s) and their cached GLB files? The server library is not affected. This cannot be undone.`)) discardLocalOnly(localOnly.map((a) => a.id));
  };

  const notice = browser ? originNotice(browser.origin, localOnly.length) : null;
  const persisted = browser?.persisted;
  const hydrationGap = !!persisted && !persisted.corrupt && (persisted.catalog > curated || persisted.queue > queued);
  const unread = data?.localFiles.filter((f) => !f.inUse && (f.records ?? 0) > 0) ?? [];

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
      <p className="mb-2 text-xs font-medium text-neutral-300">Storage diagnostics & browser import</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!data && !error && <p className="text-xs text-neutral-500">Loading…</p>}
      {data && (
        <dl className="text-xs">
          <Row label="Usage storage" value={storageLabel(data.usage.storage)} />
          <Row label="Library storage" value={storageLabel(data.library.storage)} />
          <Row label="Database connected" value={data.databaseConnected ? "Yes" : "No"} bad={!data.databaseConnected && (data.usage.storage.kind === "postgres" || data.library.storage.kind === "postgres")} />
          <Row label="Asset storage" value={storageLabel(data.assets.storage)} bad={data.assets.storage.kind === "unavailable"} />
          <Row label="Assets on server" value={data.assets.approved === null ? "unreadable" : `${data.assets.approved} approved, ${data.assets.pending} queued, ${data.assets.glbs} GLB files`} bad={data.assets.approved === null} />
          <Row label="Usage records" value={count(data.usage.records)} bad={data.usage.records === null} />
          <Row label="Knowledge Needs" value={count(data.library.knowledge)} bad={data.library.knowledge === null} />
          <Row label="Asset Needs" value={count(data.library.needs)} bad={data.library.needs === null} />
          <Row label="Recipes" value={count(data.library.recipes)} bad={data.library.recipes === null} />
          <Row label="Asset Plans" value={count(data.library.plans)} bad={data.library.plans === null} />
          <Row label="Generation reports" value={count(data.library.generations)} bad={data.library.generations === null} />
          <Row label="Curated assets loaded" value={`${curated.toLocaleString()} (${sync.status === "ready" ? "from server" : sync.status === "error" ? "browser cache — server load failed" : "loading…"})`} bad={sync.status === "error"} />
          <Row label="Browser-only assets ready to import" value={localOnly.length.toLocaleString()} bad={localOnly.length > 0} />
          {data.assets.error && <Row label="Asset read error" value={data.assets.error} bad />}
          {data.usage.error && <Row label="Usage read error" value={data.usage.error} bad />}
          {data.library.error && <Row label="Library read error" value={data.library.error} bad />}
        </dl>
      )}
      {sync.error && <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{sync.error}</p>}
      {localOnly.length > 0 && (
        <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <p>
            {localOnly.length} asset(s) exist only in this browser ({localOnly.filter((a) => a.status === "approved").length} approved, {localOnly.filter((a) => a.status !== "approved").length} queued). They are kept here, unused, until you import or discard them. Import keeps their ids, approvals, validation and Need/Plan links, uploads their GLB files, never overwrites a server asset and never regenerates anything.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={importing} onClick={runImport} className="rounded border border-amber-400/40 px-2 py-1 font-medium text-amber-200 hover:bg-amber-400/10 disabled:opacity-50">
              {importing ? "Importing…" : "Import to server"}
            </button>
            <button type="button" disabled={importing} onClick={discard} className="rounded border border-white/10 px-2 py-1 text-neutral-400 hover:bg-white/5 disabled:opacity-50">
              Discard
            </button>
          </div>
        </div>
      )}
      {imported && (
        <p className={`mt-2 rounded-md border px-3 py-2 text-xs ${imported.error || imported.glbsMissing.length ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
          Imported {imported.inserted} asset(s){imported.existing ? `, ${imported.existing} already on the server (left as they were)` : ""}; uploaded {imported.glbsUploaded} GLB file(s).
          {imported.glbsMissing.length > 0 && ` ${imported.glbsMissing.length} GLB file(s) were not in this browser either: ${imported.glbsMissing.join(", ")}.`}
          {imported.error && ` Stopped early: ${imported.error}`}
        </p>
      )}
      {data && (data.library.storage.kind === "unavailable" || data.usage.storage.kind === "unavailable" || data.assets.storage.kind === "unavailable") && (
        <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">Production shared persistence is not configured.</p>
      )}
      {browser && (
        <dl className="mt-2 border-t border-white/8 pt-2 text-xs">
          <Row label="Browser origin" value={browser.origin} />
          <Row label="localStorage (ai-architect-assets)" value={!persisted?.present ? "not present on this origin" : persisted.corrupt ? "present but unreadable" : `${persisted.catalog} approved, ${persisted.queue} queued`} bad={!!persisted?.corrupt} />
          <Row label="Asset store hydrated" value={browser.hydrated ? "yes" : "no"} bad={!browser.hydrated} />
          <Row label="GLB cache (IndexedDB ai-architect-glb)" value={browser.glbFiles === null ? "unreadable" : `${browser.glbFiles}${browser.glbMissing ? ` — ${browser.glbMissing} loaded from the server on first use` : ""}`} bad={browser.glbFiles === null} />
        </dl>
      )}
      {hydrationGap && (
        <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          localStorage holds more assets than the loaded catalog ({persisted!.catalog} approved / {persisted!.queue} queued stored, {curated} / {queued} loaded). Reload the page; nothing was deleted.
        </p>
      )}
      {notice && (
        <p className={`mt-2 rounded-md border px-3 py-2 text-xs ${notice.severe ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-white/8 text-neutral-500"}`}>{notice.text}</p>
      )}
      {unread.length > 0 && (
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Local data exists that the current storage is not reading: {unread.map((f) => `${f.path} (${f.records} records)`).join(", ")}.
        </p>
      )}
      {data && data.errors.length > 0 && (
        <div className="mt-2 text-xs text-red-400">
          <p className="font-medium">Recent storage errors</p>
          {data.errors.slice(0, 5).map((e, i) => (
            <p key={i} className="break-all">{new Date(e.at).toLocaleString()} · {e.domain} {e.op}: {e.message}</p>
          ))}
        </div>
      )}
    </div>
  );
}
