"use client";

import { create } from "zustand";

interface RoomFocusTarget {
  worldX: number;
  worldZ: number;
  roomSize: number;
}

interface SceneStore {
  selectedKey: string | null;
  selectKey: (key: string | null) => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showRoof: boolean;
  toggleRoof: () => void;
  setShowAdvanced: (show: boolean) => void;
  showAdvanced: boolean;

  /** Persistent view mode — persists across selections. */
  viewMode: "site" | "room";
  setViewMode: (mode: "site" | "room") => void;

  /** Human-readable label for the room currently in focus ("Bedroom", "Kitchen", …). */
  roomLabel: string | null;

  /**
   * One-shot camera preset trigger. Viewport.tsx watches this, applies the
   * camera move, then resets it to null. Never persists across frames.
   */
  cameraPreset: "site" | "house" | "top" | "room" | null;
  roomFocusTarget: RoomFocusTarget | null;
  triggerCameraPreset: (
    preset: "site" | "house" | "top" | "room" | null,
    roomTarget?: RoomFocusTarget,
    roomLabel?: string
  ) => void;

  /** First-person walk mode: disables OrbitControls, activates PointerLockControls + WASD. */
  walkMode: boolean;
  setWalkMode: (active: boolean) => void;
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

  viewMode: "site",
  // Clear roomLabel when returning to site view
  setViewMode: (mode) => set({ viewMode: mode, ...(mode === "site" ? { roomLabel: null } : {}) }),

  roomLabel: null,

  cameraPreset: null,
  roomFocusTarget: null,
  triggerCameraPreset: (preset, roomTarget, roomLabel) =>
    set((state) => ({
      cameraPreset: preset,
      roomFocusTarget: roomTarget ?? null,
      // Only update roomLabel when a new label is explicitly provided; preserve it when
      // clearing the preset (triggerCameraPreset(null)) so the breadcrumb stays visible.
      roomLabel: roomLabel !== undefined ? roomLabel : state.roomLabel,
    })),

  walkMode: false,
  setWalkMode: (active) => set({ walkMode: active }),
}));
