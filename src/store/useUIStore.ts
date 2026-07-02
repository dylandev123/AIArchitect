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
}

export const useUIStore = create<UIStore>((set) => ({
  activeLeftTab: "houseJson",
  setActiveLeftTab: (tab) => set({ activeLeftTab: tab }),
  isChatOpen: true,
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  mobileSheet: null,
  setMobileSheet: (sheet) => set({ mobileSheet: sheet }),
}));
