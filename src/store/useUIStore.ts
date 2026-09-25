"use client";

import { create } from "zustand";

export type LeftPanelTab = "projects" | "houseJson" | "parts" | "materials" | "history";
export type MobileSheet = "design" | "elements" | "materials" | "properties" | null;

interface UIStore {
  activeLeftTab: LeftPanelTab;
  setActiveLeftTab: (tab: LeftPanelTab) => void;
  isChatOpen: boolean;
  toggleChat: () => void;
  mobileSheet: MobileSheet;
  setMobileSheet: (sheet: MobileSheet) => void;
  /** Briefs typed on the home page, keyed by project id; consumed once by the workspace to run the initial generation. */
  pendingBriefs: Record<string, string>;
  setPendingBrief: (projectId: string, brief: string) => void;
  takePendingBrief: (projectId: string) => string | undefined;
  /** True while an AI request is in flight (initial generation or an edit). */
  aiWorking: boolean;
  setAiWorking: (working: boolean) => void;
  /** Human-readable reason the initial generation failed; shown over the empty viewport. */
  generationError: string | null;
  setGenerationError: (message: string | null) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  activeLeftTab: "houseJson",
  setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),
  isChatOpen: true,
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  mobileSheet: null,
  setMobileSheet: (sheet) => set({ mobileSheet: sheet }),
  pendingBriefs: {},
  setPendingBrief: (projectId, brief) =>
    set((state) => ({ pendingBriefs: { ...state.pendingBriefs, [projectId]: brief } })),
  takePendingBrief: (projectId) => {
    const brief = get().pendingBriefs[projectId];
    if (brief === undefined) return undefined;
    set((state) => {
      const rest = { ...state.pendingBriefs };
      delete rest[projectId];
      return { pendingBriefs: rest };
    });
    return brief;
  },
  aiWorking: false,
  setAiWorking: (working) => set({ aiWorking: working }),
  generationError: null,
  setGenerationError: (message) => set({ generationError: message }),
}));
