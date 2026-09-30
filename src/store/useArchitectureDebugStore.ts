"use client";

import { create } from "zustand";
import type { StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import type { CapabilityRequest } from "@/types/library";

/**
 * Dev-only trace of the last staged architecture pipeline run: per-stage status/duration/model-call-count,
 * which stage (if any) actually failed the request, which stage is currently being replayed, and any
 * Capability Need the run recorded (an architectural operation the model asked for that isn't in the
 * supported vocabulary yet). Nothing here is read by rendering — it exists purely for the Architecture
 * debug panel.
 */
interface ArchitectureDebugState {
  /** Project that produced this transient server trace. Prevents a prior project's timings leaking into the current panel. */
  projectId: string | null;
  diagnostics: StageDiagnostics[] | null;
  /** The stage named by the server as having failed the overall request (e.g. "final-assembly"), if any. */
  failedStage?: string;
  replaying: string | null;
  capabilityRequests: CapabilityRequest[];
  setDiagnostics: (projectId: string, diagnostics: StageDiagnostics[] | null, failedStage?: string, capabilityRequests?: CapabilityRequest[]) => void;
  clearDiagnostics: (projectId: string) => void;
  setReplaying: (stage: string | null) => void;
}

export const useArchitectureDebugStore = create<ArchitectureDebugState>((set) => ({
  projectId: null,
  diagnostics: null,
  failedStage: undefined,
  replaying: null,
  capabilityRequests: [],
  setDiagnostics: (projectId, diagnostics, failedStage, capabilityRequests) => set({ projectId, diagnostics, failedStage, ...(capabilityRequests ? { capabilityRequests } : {}) }),
  clearDiagnostics: (projectId) => set({ projectId, diagnostics: null, failedStage: undefined, capabilityRequests: [] }),
  setReplaying: (stage) => set({ replaying: stage }),
}));
