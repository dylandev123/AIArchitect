"use client";

import { create } from "zustand";
import type { V3RenderIdentity, V3CameraSourceEvidence } from "@/lib/v3/renderIdentity";

interface V3RenderIdentityState {
  identity: V3RenderIdentity | null;
  cameraSource: V3CameraSourceEvidence | null;
  setCameraSource: (evidence: V3CameraSourceEvidence) => void;
  clearCameraSource: (projectId: string) => void;
  setIdentity: (identity: V3RenderIdentity) => void;
  clearIdentity: (projectId: string) => void;
}

/** Ephemeral DEV renderer evidence. It never writes project data or localStorage. */
export const useV3RenderIdentityStore = create<V3RenderIdentityState>((set) => ({
  identity: null,
  cameraSource: null,
  setCameraSource: (cameraSource) => set({ cameraSource }),
  clearCameraSource: (projectId) => set(state => state.cameraSource?.projectId === projectId ? { cameraSource: null } : state),
  setIdentity: (identity) => set({ identity }),
  clearIdentity: (projectId) => set((state) => state.identity?.projectId === projectId ? { identity: null } : state),
}));
