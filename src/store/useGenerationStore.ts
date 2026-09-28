"use client";

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
  record: (report: GenerationReport) => void;
}

export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      reports: [],
      record: (report) => set((s) => ({ reports: [report, ...s.reports.filter((r) => r.id !== report.id)].slice(0, KEEP) })),
    }),
    { name: "ai-architect-generations" }
  )
);
