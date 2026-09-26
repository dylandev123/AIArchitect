"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssetValidationReport, CuratedAsset, PBRValues } from "@/types/assets";
import { getGlbStore } from "@/lib/assets/glbStorage";

export type AssetMetaPatch = Partial<Pick<CuratedAsset, "name" | "family" | "styleTags" | "contextTags" | "dimensions" | "license" | "needId" | "validation">>;

/**
 * Why an asset may not be approved yet, or null. Generated GLBs must pass validation first; an uploaded GLB is
 * validated on upload and may not be approved once that validation has failed.
 */
export function approvalBlocker(asset: CuratedAsset): string | null {
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

/** Removes a GLB's stored bytes (the model cache notices the asset is gone on its own). Best effort: a missing file is already the desired state. */
function discardModel(id: string) {
  void getGlbStore().delete(id).catch(() => {});
}

interface AssetStore {
  queue: CuratedAsset[];
  catalog: CuratedAsset[];
  addToQueue: (asset: CuratedAsset) => void;
  approve: (id: string) => void;
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
        set({
          queue: queue.filter((a) => a.id !== id),
          catalog: [...catalog, { ...asset, status: "approved" as const }],
        });
      },

      reject: (id) => {
        const asset = get().queue.find((a) => a.id === id);
        set((s) => ({ queue: s.queue.filter((a) => a.id !== id) }));
        if (asset?.type === "glb-model") discardModel(id);
      },

      removeFromCatalog: (id) => {
        const asset = get().catalog.find((a) => a.id === id);
        set((s) => ({ catalog: s.catalog.filter((a) => a.id !== id) }));
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
    { name: "ai-architect-assets" }
  )
);
