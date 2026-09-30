"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssetValidationReport, CuratedAsset, PBRValues, UpgradeRollout } from "@/types/assets";
import { getGlbStore } from "@/lib/assets/glbStorage";
import { applyUpgradeApproval, nextVersion, upgradeBlocker, withoutVersion } from "@/lib/assets/versions";

export type AssetMetaPatch = Partial<Pick<CuratedAsset, "name" | "family" | "styleTags" | "contextTags" | "dimensions" | "license" | "needId" | "validation">>;

/**
 * Why an asset may not be approved yet, or null. Generated GLBs must pass validation first; an uploaded GLB is
 * validated on upload and may not be approved once that validation has failed. An upgrade candidate is never approved
 * with a bare "Approve": it replaces a version other projects may use, so it goes through `approveUpgrade`.
 */
export function approvalBlocker(asset: CuratedAsset): string | null {
  if (asset.upgradeOf) return "This is an upgrade candidate: review it against the current version and choose New Projects Only or Make Current.";
  return validationBlocker(asset);
}

/** The GLB gate alone (what an upgrade candidate must also pass before it can be approved). */
export function validationBlocker(asset: CuratedAsset): string | null {
  if (asset.type !== "glb-model") return null;
  const validation = asset.validation as AssetValidationReport | undefined;
  if (asset.source === "generated" && !validation?.passed) {
    return "Generated models must pass GLB validation before they can be approved.";
  }
  if (validation && !validation.passed) {
    return `GLB validation failed: ${validation.errors[0] ?? "unusable model"}`;
  }
  return null;
}

type AssetLists = Pick<AssetStore, "catalog" | "queue" | "localOnly">;

/**
 * The server's lists win. Whatever this browser held that the server does not know is moved to `localOnly` rather than
 * dropped, so nothing curated before the move to the server (or lost on the way) disappears without the admin deciding.
 * Without a server queue (not an admin) the local queue is left alone: it is only ever written by an admin.
 */
export function mergeServerLibrary(local: AssetLists, server: { catalog: CuratedAsset[]; queue?: CuratedAsset[] }): AssetLists {
  const queue = server.queue ?? local.queue;
  const known = new Set([...server.catalog, ...queue].map((a) => a.id));
  const stranded = [...local.localOnly, ...local.catalog, ...(server.queue ? local.queue : [])].filter((a) => !known.has(a.id));
  const localOnly = [...new Map(stranded.map((a) => [a.id, a])).values()];
  return { catalog: server.catalog, queue, localOnly };
}

/** Removes a GLB's stored bytes (the model cache notices the asset is gone on its own). Best effort: a missing file is already the desired state. */
function discardModel(id: string) {
  void getGlbStore().delete(id).catch(() => {});
}

/** Where the browser's copy stands against the server library (see `lib/assets/assetSync`). Never persisted. */
export interface AssetSyncState {
  status: "idle" | "loading" | "ready" | "error";
  /** The last load or write failure, until the next successful load. */
  error: string;
  /** When the catalog was last replaced from the server. */
  loadedAt: string | null;
}

interface AssetStore {
  queue: CuratedAsset[];
  catalog: CuratedAsset[];
  /**
   * Assets this browser holds that the server does not: created before the library moved to the server, or whose write never
   * reached it. They are kept (with their GLBs in IndexedDB) until imported or discarded, but not used, since the server is
   * the source of truth.
   */
  localOnly: CuratedAsset[];
  sync: AssetSyncState;
  /** Replaces the cached library with the server's. `queue` is undefined when the viewer may not see it (not an admin). */
  applyServerLibrary: (server: { catalog: CuratedAsset[]; queue?: CuratedAsset[] }) => void;
  /** Forgets browser-only assets and their cached GLBs, after the admin chose not to import them. */
  discardLocalOnly: (ids: readonly string[]) => void;
  setSync: (patch: Partial<AssetSyncState>) => void;
  addToQueue: (asset: CuratedAsset) => void;
  approve: (id: string) => void;
  /**
   * Approves an upgrade candidate as the next version of its asset. The version it upgrades is left exactly as it was, apart
   * from being marked superseded; `rollout` decides whether existing projects follow. Resolves to why it was refused, or null.
   */
  approveUpgrade: (id: string, rollout: UpgradeRollout) => string | null;
  reject: (id: string) => void;
  removeFromCatalog: (id: string) => void;
  /** Records that an approved model rendered ("success") or could not be loaded ("failure"), for retrieval ranking. */
  recordAssetOutcome: (id: string, outcome: "success" | "failure") => void;
  updateAssetPBR: (id: string, pbr: PBRValues) => void;
  /** Edits library metadata (family, tags, dimensions, license…) of a queued or approved asset. */
  updateAssetMeta: (id: string, patch: AssetMetaPatch) => void;
  getPBRMaterials: () => CuratedAsset[];
  isDuplicate: (sourceSlug: string, source: string) => CuratedAsset | null;
}

export const useAssetStore = create<AssetStore>()(
  persist(
    (set, get) => ({
      queue: [],
      catalog: [],
      localOnly: [],
      sync: { status: "idle", error: "", loadedAt: null },

      applyServerLibrary: (server) => set((s) => ({ ...mergeServerLibrary(s, server), sync: { status: "ready", error: "", loadedAt: new Date().toISOString() } })),

      discardLocalOnly: (ids) => {
        set((s) => ({ localOnly: s.localOnly.filter((a) => !ids.includes(a.id)) }));
        for (const id of ids) discardModel(id);
      },

      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),

      addToQueue: (asset) => {
        const { queue, isDuplicate } = get();
        const existing = isDuplicate(asset.sourceSlug, asset.source);
        const enriched: CuratedAsset = existing
          ? { ...asset, isDuplicate: true, duplicateOf: existing.id }
          : asset;
        if (queue.some((a) => a.sourceSlug === asset.sourceSlug && a.source === asset.source)) return;
        set({ queue: [...queue, enriched] });
      },

      approve: (id) => {
        const { queue, catalog } = get();
        const asset = queue.find((a) => a.id === id);
        if (!asset || approvalBlocker(asset)) return;
        // A native asset is numbered when it is approved, not when it is generated.
        const version = asset.stableAssetId ? nextVersion(catalog, asset.stableAssetId) : asset.version;
        set({
          queue: queue.filter((a) => a.id !== id),
          catalog: [...catalog, { ...asset, status: "approved" as const, ...(version !== undefined ? { version } : {}) }],
        });
      },

      approveUpgrade: (id, rollout) => {
        const { queue, catalog } = get();
        const candidate = queue.find((a) => a.id === id);
        if (!candidate) return "That upgrade candidate is no longer in the queue.";
        const blocker = validationBlocker(candidate) ?? upgradeBlocker(candidate, catalog);
        if (blocker) return blocker;
        set({ queue: queue.filter((a) => a.id !== id), catalog: applyUpgradeApproval(candidate, catalog, rollout, new Date().toISOString()) });
        return null;
      },

      reject: (id) => {
        const asset = get().queue.find((a) => a.id === id);
        set((s) => ({ queue: s.queue.filter((a) => a.id !== id) }));
        if (asset?.type === "glb-model") discardModel(id);
      },

      removeFromCatalog: (id) => {
        const asset = get().catalog.find((a) => a.id === id);
        set((s) => ({ catalog: withoutVersion(s.catalog, id) }));
        if (asset?.type === "glb-model") discardModel(id);
      },

      recordAssetOutcome: (id, outcome) => {
        const bump = (a: CuratedAsset): CuratedAsset =>
          a.id !== id
            ? a
            : {
                ...a,
                usageCount: (a.usageCount ?? 0) + 1,
                ...(outcome === "success" ? { successCount: (a.successCount ?? 0) + 1 } : { failureCount: (a.failureCount ?? 0) + 1 }),
              };
        set((s) => (s.catalog.some((a) => a.id === id) ? { catalog: s.catalog.map(bump) } : s));
      },

      updateAssetPBR: (id, pbr) => {
        set((s) => ({
          queue: s.queue.map((a) => a.id === id ? { ...a, pbr } : a),
          catalog: s.catalog.map((a) => a.id === id ? { ...a, pbr } : a),
        }));
      },

      updateAssetMeta: (id, patch) => {
        set((s) => ({
          queue: s.queue.map((a) => a.id === id ? { ...a, ...patch } : a),
          catalog: s.catalog.map((a) => a.id === id ? { ...a, ...patch } : a),
        }));
      },

      getPBRMaterials: () => {
        return get().catalog.filter((a) => a.type === "pbr-material");
      },

      isDuplicate: (sourceSlug, source) => {
        const { queue, catalog } = get();
        return (
          catalog.find((a) => a.sourceSlug === sourceSlug && a.source === source) ??
          queue.find((a) => a.sourceSlug === sourceSlug && a.source === source) ??
          null
        );
      },
    }),
    { name: "ai-architect-assets", partialize: (s) => ({ catalog: s.catalog, queue: s.queue, localOnly: s.localOnly }) }
  )
);
