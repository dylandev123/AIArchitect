"use client";

import { create } from "zustand";

/** One human-readable line of real progress from a live architecture generation; null when nothing is streaming. */
export interface GenerationProgress {
  label: string;
  massesSoFar?: number;
  totalMasses?: number;
}

interface GenerationProgressStore {
  progress: GenerationProgress | null;
  setProgress: (progress: GenerationProgress | null) => void;
}

export const useGenerationProgressStore = create<GenerationProgressStore>((set) => ({
  progress: null,
  setProgress: (progress) => set({ progress }),
}));
