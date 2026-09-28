"use client";

import { useEffect, useState } from "react";
import { useAdminStore } from "@/store/useAdminStore";
import { useAssetStore } from "@/store/useAssetStore";
import { getGlbStore } from "@/lib/assets/glbStorage";
import { ASSET_STORAGE_KEY, originNotice, readPersistedAssetCounts, type PersistedAssetCounts } from "@/lib/storage/browserAssets";
import type { StorageErrorEntry, StorageInfo } from "@/lib/storage/diagnostics";

interface Diagnostics {
  cwd: string;
  usage: { storage: StorageInfo; records: number | null; error: string | null };
  library: { storage: StorageInfo; needs: number | null; knowledge: number | null; recipes: number | null; plans: number | null; error: string | null };
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

const storageLabel = (s: StorageInfo) => `${s.kind === "postgres" ? "Postgres" : "Local JSON"} (${s.location})${s.ephemeral ? " — temporary, lost between deployments" : ""}`;
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
  }, [adminEmail, reloadKey]);

  const serverHasLibrary = !!data && (data.library.needs ?? 0) + (data.library.knowledge ?? 0) + (data.library.recipes ?? 0) + (data.library.plans ?? 0) > 0;
  const notice = browser ? originNotice(browser.origin, curated + queued + (browser.persisted?.catalog ?? 0), serverHasLibrary) : null;
  const persisted = browser?.persisted;
  const hydrationGap = !!persisted && !persisted.corrupt && (persisted.catalog > curated || persisted.queue > queued);
  const unread = data?.localFiles.filter((f) => !f.inUse && (f.records ?? 0) > 0) ?? [];

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
      <p className="mb-2 text-xs font-medium text-neutral-300">Storage diagnostics</p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!data && !error && <p className="text-xs text-neutral-500">Loading…</p>}
      {data && (
        <dl className="text-xs">
          <Row label="Usage storage" value={storageLabel(data.usage.storage)} />
          <Row label="Library storage" value={storageLabel(data.library.storage)} />
          <Row label="Asset catalog" value="Browser Local (this browser only)" />
          <Row label="Usage records" value={count(data.usage.records)} bad={data.usage.records === null} />
          <Row label="Knowledge Needs" value={count(data.library.knowledge)} bad={data.library.knowledge === null} />
          <Row label="Asset Needs" value={count(data.library.needs)} bad={data.library.needs === null} />
          <Row label="Recipes" value={count(data.library.recipes)} bad={data.library.recipes === null} />
          <Row label="Asset Plans" value={count(data.library.plans)} bad={data.library.plans === null} />
          <Row label="Curated assets in browser" value={curated.toLocaleString()} />
          {data.usage.error && <Row label="Usage read error" value={data.usage.error} bad />}
          {data.library.error && <Row label="Library read error" value={data.library.error} bad />}
        </dl>
      )}
      {browser && (
        <dl className="mt-2 border-t border-white/8 pt-2 text-xs">
          <Row label="Browser origin" value={browser.origin} />
          <Row label="localStorage (ai-architect-assets)" value={!persisted?.present ? "not present on this origin" : persisted.corrupt ? "present but unreadable" : `${persisted.catalog} approved, ${persisted.queue} queued`} bad={!!persisted?.corrupt} />
          <Row label="Asset store hydrated" value={browser.hydrated ? "yes" : "no"} bad={!browser.hydrated} />
          <Row label="GLB files (IndexedDB ai-architect-glb)" value={browser.glbFiles === null ? "unreadable" : `${browser.glbFiles}${browser.glbMissing ? ` — ${browser.glbMissing} asset(s) have no stored file` : ""}`} bad={browser.glbFiles === null || !!browser.glbMissing} />
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
