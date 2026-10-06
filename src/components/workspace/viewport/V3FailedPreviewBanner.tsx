"use client";

import { AlertTriangle } from "lucide-react";
import { useParams } from "next/navigation";
import { useSceneStore } from "@/store/useSceneStore";
import { useV3FailedPreviewStore } from "@/store/useV3FailedPreviewStore";

/** A visible guardrail: recovered Terra scenes are inspectable, never editable or saved. */
export function V3FailedPreviewBanner() {
  const params = useParams<{ projectId: string }>();
  const candidate = useV3FailedPreviewStore((s) => s.candidate);
  const active = useV3FailedPreviewStore((s) => s.active);
  const render = useV3FailedPreviewStore((s) => s.render);
  const clear = useV3FailedPreviewStore((s) => s.clear);
  const triggerCameraPreset = useSceneStore((s) => s.triggerCameraPreset);
  if (process.env.NODE_ENV === "production" || candidate?.projectId !== params.projectId) return null;
  const show = () => { render(params.projectId); triggerCameraPreset("site"); };
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-md">
      <div className="pointer-events-auto rounded-xl border border-red-400/50 bg-red-950/90 p-3 shadow-xl backdrop-blur">
        <div className="flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-300" />
          <div>
            <p className="text-xs font-bold tracking-wide text-red-100">V3 PREVIEW — INVALID / NOT SAVED</p>
            <p className="mt-1 text-[11px] leading-relaxed text-red-200/80">
              {candidate.scene.objects.length} recoverable object{candidate.scene.objects.length === 1 ? "" : "s"}; renderer is read-only.
            </p>
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          {!active && <button type="button" onClick={show} className="rounded-md border border-red-200/30 px-2 py-1 text-[10px] font-semibold text-red-100 hover:bg-red-200/10">Render failed Terra preview</button>}
          <button type="button" onClick={clear} className="rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-neutral-200 hover:bg-white/10">Clear failed preview</button>
        </div>
      </div>
    </div>
  );
}
