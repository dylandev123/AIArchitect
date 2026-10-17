"use client";
import { useMemo } from "react";
import { resolveActiveV3RenderSource } from "@/lib/v3/activeRenderSource";
import { useRenderFlightStore } from "./useRenderFlightStore";
import { useV3FailedPreviewStore } from "./useV3FailedPreviewStore";

/** Shared inputs for presentation consumers; selection itself stays pure and testable. */
export function useActiveV3RenderSource(projectId: string, persistedJson: string | undefined) {
  const frozen = useRenderFlightStore(s => s.frozen);
  const viewed = useRenderFlightStore(s => s.viewed);
  const candidate = useV3FailedPreviewStore(s => s.candidate);
  const active = useV3FailedPreviewStore(s => s.active);
  return useMemo(() => resolveActiveV3RenderSource({ projectId, persistedJson, rendererJson: (frozen ?? viewed)?.configJson ?? persistedJson, historyActive: !!(frozen ?? viewed), historyProjectId: (frozen ?? viewed)?.projectId, failedPreviewCandidate: candidate, failedPreviewActive: active }), [projectId, persistedJson, frozen, viewed, candidate, active]);
}
