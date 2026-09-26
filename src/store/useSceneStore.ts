"use client";

import { create } from "zustand";
import type { RoomFocus } from "@/lib/house/roomView";

export type CameraPreset = "site" | "house" | "top" | "room" | "exterior";

interface SceneStore {
  selectedKey: string | null;
  selectKey: (key: string | null) => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showRoof: boolean;
  toggleRoof: () => void;
  setShowAdvanced: (show: boolean) => void;
  showAdvanced: boolean;

  /**
   * The room the user has stepped into, or null for the whole house. This one value drives the camera, the cutaway
   * (roof and blocking walls hidden) and the scope of AI edits, so they can never disagree.
   */
  focusedRoom: RoomFocus | null;
  /** Level whose cutaway is applied; outlives `focusedRoom` briefly on exit so walls return only once the camera is back outside. */
  cutawayLevel: number | null;
  setCutawayLevel: (level: number | null) => void;
  /** Steps into a room: selects nothing, leaves walk mode, and flies the camera in. Re-entering another room just moves. */
  enterRoom: (focus: RoomFocus) => void;
  /** Refreshes the focus after the project changed (id backfilled, room moved in the array) without moving the camera. */
  syncRoomFocus: (focus: RoomFocus | null) => void;
  /** Back to the whole house. The camera returns to where it was, unless `camera: false` (another view is taking over). */
  exitRoom: (options?: { camera?: boolean }) => void;

  /**
   * One-shot camera preset trigger. CameraRig watches this, flies the camera there,
   * then resets it to null. Never persists across frames.
   */
  cameraPreset: CameraPreset | null;
  triggerCameraPreset: (preset: CameraPreset | null) => void;

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

  focusedRoom: null,
  cutawayLevel: null,
  setCutawayLevel: (level) => set({ cutawayLevel: level }),
  enterRoom: (focus) =>
    set({ focusedRoom: focus, selectedKey: null, showAdvanced: false, walkMode: false, cameraPreset: "room" }),
  syncRoomFocus: (focus) => set({ focusedRoom: focus }),
  exitRoom: (options) =>
    set((state) => ({
      focusedRoom: null,
      ...(options?.camera === false ? {} : { cameraPreset: state.focusedRoom ? "exterior" : state.cameraPreset }),
    })),

  cameraPreset: null,
  triggerCameraPreset: (preset) => set({ cameraPreset: preset }),

  walkMode: false,
  setWalkMode: (active) => set({ walkMode: active }),
}));
