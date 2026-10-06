"use client";

import { create } from "zustand";
import type { V3FailedPreview } from "@/lib/v3/failedPreview";

interface V3FailedPreviewStore {
  candidate: (V3FailedPreview & { projectId: string }) | null;
  active: boolean;
  capture: (projectId: string, preview: V3FailedPreview) => void;
  render: (projectId: string) => void;
  clear: () => void;
}

/** Ephemeral dev inspection state. It intentionally has no persistence middleware or project write capability. */
export const useV3FailedPreviewStore = create<V3FailedPreviewStore>((set) => ({
  candidate: null,
  active: false,
  capture: (projectId, preview) => {
    if (process.env.NODE_ENV === "production") return;
    set({ candidate: { projectId, ...preview }, active: false });
  },
  render: (projectId) => set((state) => state.candidate?.projectId === projectId && process.env.NODE_ENV !== "production" ? { active: true } : state),
  clear: () => set({ candidate: null, active: false }),
}));
