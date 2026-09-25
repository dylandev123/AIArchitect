"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useNeedsGeneration } from "./useNeedsGeneration";

/** Status card over the empty site: generating, failed, or waiting for the first brief. */
export function GenerationOverlay() {
  const blank = useNeedsGeneration();
  const working = useUIStore((s) => s.aiWorking);
  const error = useUIStore((s) => s.generationError);

  if (!blank) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18%] flex justify-center px-4">
      <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-white/15 bg-neutral-950/70 px-5 py-3.5 text-sm shadow-2xl shadow-black/30 backdrop-blur-md">
        {working ? (
          <>
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
            <div>
              <p className="font-semibold text-neutral-100">Your architect is designing…</p>
              <p className="text-xs text-neutral-400">Shaping the house, materials and grounds.</p>
            </div>
          </>
        ) : error ? (
          <>
            <AlertTriangle size={18} className="shrink-0 text-red-400" />
            <div>
              <p className="font-semibold text-neutral-100">Couldn&apos;t generate the design</p>
              <p className="text-xs text-neutral-400">{error} Your brief is back in the chat box.</p>
            </div>
          </>
        ) : (
          <>
            <Sparkles size={18} className="shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-neutral-100">An empty plot, ready for you</p>
              <p className="text-xs text-neutral-400">Describe your project in the chat below to generate it.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
