"use client";

import { create } from "zustand";
import type { RoomFocus } from "@/lib/house/roomView";

export type CameraPreset = "site" | "house" | "top" | "room" | "exterior";

export const ARCHITECTURE_DEBUG_MODES = ["massing-only", "geometry-only", "roofs-only", "openings-only", "full"] as const;
export const ARCHITECTURE_DEBUG_MODE_LABEL: Record<(typeof ARCHITECTURE_DEBUG_MODES)[number], string> = {
  "massing-only": "Massing",
  "geometry-only": "Articulated Geometry",
  "roofs-only": "Roofs",
  "openings-only": "Openings",
  full: "Full",
};

interface SceneStore {
  selectedKey: string | null;
  selectKey: (key: string | null) => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showRoof: boolean;
  toggleRoof: () => void;
  setShowAdvanced: (show: boolean) => void;
  showAdvanced: boolean;
  architectureDebug: "full" | "massing-only" | "geometry-only" | "roofs-only" | "openings-only";
  cycleArchitectureDebug: () => void;
  setArchitectureDebug: (mode: SceneStore["architectureDebug"]) => void;
  /** DEV-only end-to-end geometry inspection. Never persisted or used by production generation. */
  geometryXRay: boolean;
  setGeometryXRay: (enabled: boolean) => void;
  isolateArchitectureMassId: string | null;
  setIsolateArchitectureMassId: (id: string | null) => void;
  /**
   * DEV-only diagnostic: when true and the project has a valid `architecturalDesignDocument`, the V2
   * compiled model is the sole source of building geometry (legacy house/building primitives cannot
   * leak into the visible building) while genuine legacy site features (pools, driveways, landscaping,
   * terrain-adjacent walls) are still merged in. See src/lib/architecture/v2OnlyMode.ts.
   */
  v2OnlyMode: boolean;
  setV2OnlyMode: (enabled: boolean) => void;

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
  architectureDebug: "full",
  // Massing → Articulated Geometry → Roofs → Openings → Full, matching the debug panel's mode selector.
  cycleArchitectureDebug: () => set((state) => ({
    architectureDebug: ARCHITECTURE_DEBUG_MODES[(ARCHITECTURE_DEBUG_MODES.indexOf(state.architectureDebug) + 1) % ARCHITECTURE_DEBUG_MODES.length],
  })),
  setArchitectureDebug: (mode) => set({ architectureDebug: mode }),
  geometryXRay: false,
  setGeometryXRay: (geometryXRay) => set({ geometryXRay }),
  isolateArchitectureMassId: null,
  setIsolateArchitectureMassId: (isolateArchitectureMassId) => set({ isolateArchitectureMassId }),
  v2OnlyMode: false,
  setV2OnlyMode: (v2OnlyMode) => set({ v2OnlyMode }),

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
