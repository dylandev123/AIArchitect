"use client";

import { create } from "zustand";

interface SceneStore {
  selectedKey: string | null;
  selectKey: (key: string | null) => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showRoof: boolean;
  toggleRoof: () => void;
  /** When true, the right sidebar shows the full advanced property inspector. */
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
  selectedKey: null,
  selectKey: (key) => set({ selectedKey: key, showAdvanced: false }),
  showGrid: true,
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  showRoof: true,
  toggleRoof: () => set((state) => ({ showRoof: !state.showRoof })),
  showAdvanced: false,
  setShowAdvanced: (show) => set({ showAdvanced: show }),
}));
