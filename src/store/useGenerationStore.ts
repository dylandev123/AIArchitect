"use client";

import { withAssetOutcomes, type AssetRenderOutcomes } from "@/lib/assets/outcomes";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GenerationReport } from "@/types/library";

/**
 * The intelligence report of the latest generations run from this browser. The server keeps its own copy in the library; this one
 * exists for the case the server could not: a generation whose library write failed still shows its report here, so the admin sees
 * what the loop found and why it was not stored.
 */
const KEEP = 5;

interface GenerationStore {
  reports: GenerationReport[];
  outcomes: AssetRenderOutcomes;
  noteAsset: (projectId: string, placementId: string, status: "Rendered" | "Failed", note?: string) => void;
  record: (report: GenerationReport) => void;
}

export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      reports: [],
      outcomes: {},
      noteAsset: (projectId, placementId, status, note) => set(s => {
        const outcomes = {...s.outcomes, [`${projectId}:${placementId}`]: {status,note}};
        return {outcomes, reports:s.reports.map(r=>withAssetOutcomes(r,outcomes))};
      }),
      record: (report) => set((s) => ({ reports: [withAssetOutcomes(report,s.outcomes), ...s.reports.filter((r) => r.id !== report.id)].slice(0, KEEP) })),
    }),
    { name: "ai-architect-generations" }
  )
);
