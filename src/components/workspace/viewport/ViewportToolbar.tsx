"use client";

import { Eye, EyeOff, Home } from "lucide-react";
import { useSceneStore } from "@/store/useSceneStore";

export function ViewportToolbar({ onResetCamera }: { onResetCamera: () => void }) {
  const showRoof = useSceneStore((s) => s.showRoof);
  const toggleRoof = useSceneStore((s) => s.toggleRoof);

  return (
    <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1.5">
      <button
        onClick={toggleRoof}
        title={showRoof ? "Hide roof (see inside)" : "Show roof"}
        className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 shadow-lg backdrop-blur transition hover:scale-105 active:scale-95 ${
          showRoof
            ? "bg-neutral-900/90 text-neutral-400 hover:text-neutral-200"
            : "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
        }`}
      >
        {showRoof ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <button
        onClick={onResetCamera}
        title="Frame scene"
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-neutral-900/90 text-neutral-400 shadow-lg backdrop-blur transition hover:text-neutral-200 hover:scale-105 active:scale-95"
      >
        <Home size={15} />
      </button>
    </div>
  );
}
