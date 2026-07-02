"use client";

import { MousePointerClick, X } from "lucide-react";
import { useSceneStore } from "@/store/useSceneStore";
import { PropertyInspector } from "./inspector/PropertyInspector";

export function RightSidebar() {
  const selectedKey = useSceneStore((s) => s.selectedKey);
  const showAdvanced = useSceneStore((s) => s.showAdvanced);
  const setShowAdvanced = useSceneStore((s) => s.setShowAdvanced);

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-white/[0.07] bg-neutral-950/80">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.05] px-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
          Properties
        </span>
        {showAdvanced && selectedKey && (
          <button
            onClick={() => setShowAdvanced(false)}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/5 hover:text-neutral-400 transition"
            title="Close advanced panel"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selectedKey ? (
          /* Nothing selected */
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
              <MousePointerClick size={20} className="text-neutral-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-400">Tap anything to edit</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                Click any element in the scene and quick actions will appear.
              </p>
            </div>
          </div>
        ) : !showAdvanced ? (
          /* Something selected but advanced is hidden */
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <p className="text-xs leading-relaxed text-neutral-600">
              Use the quick actions below to edit this element.
            </p>
            <button
              onClick={() => setShowAdvanced(true)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-neutral-400 transition hover:bg-white/[0.08] hover:text-neutral-200"
            >
              ⚙ Advanced Properties
            </button>
          </div>
        ) : (
          /* Advanced mode: full inspector */
          <PropertyInspector />
        )}
      </div>
    </aside>
  );
}
