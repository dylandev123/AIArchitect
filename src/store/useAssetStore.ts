"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CuratedAsset, PBRValues } from "@/types/assets";

interface AssetStore {
  queue: CuratedAsset[];
  catalog: CuratedAsset[];
  addToQueue: (asset: CuratedAsset) => void;
  approve: (id: string) => void;
  reject: (id: string) => void;
  removeFromCatalog: (id: string) => void;
  updateAssetPBR: (id: string, pbr: PBRValues) => void;
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
        if (!asset) return;
        set({
          queue: queue.filter((a) => a.id !== id),
          catalog: [...catalog, { ...asset, status: "approved" as const }],
        });
      },

      reject: (id) => {
        set((s) => ({ queue: s.queue.filter((a) => a.id !== id) }));
      },

      removeFromCatalog: (id) => {
        set((s) => ({ catalog: s.catalog.filter((a) => a.id !== id) }));
      },

      updateAssetPBR: (id, pbr) => {
        set((s) => ({
          queue: s.queue.map((a) => a.id === id ? { ...a, pbr } : a),
          catalog: s.catalog.map((a) => a.id === id ? { ...a, pbr } : a),
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
