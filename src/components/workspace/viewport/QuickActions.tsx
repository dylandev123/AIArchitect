"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Settings2, X } from "lucide-react";
import { useSceneStore } from "@/store/useSceneStore";
import { useProjectStore } from "@/store/useProjectStore";
import { parseFeatureKey } from "@/lib/house/features/parseFeatureId";
import { getFeatureRawAt } from "@/lib/house/jsonEdit";
import { applyPatch } from "@/lib/house/applyPatch";
import {
  getActionsForFeature,
  HOUSE_ACTIONS,
  type QuickAction,
  type QuickActionGroup,
} from "@/lib/quickActions";

// ── Accent palette ────────────────────────────────────────────────────────────

const ACCENT: Record<string, { button: string; ring: string; badge: string }> = {
  amber:   { button: "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/20 text-amber-200",   ring: "ring-amber-500/40",  badge: "bg-amber-500/20 text-amber-300" },
  sky:     { button: "bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/20 text-sky-200",           ring: "ring-sky-500/40",    badge: "bg-sky-500/20 text-sky-300" },
  emerald: { button: "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/20 text-emerald-200", ring: "ring-emerald-500/40", badge: "bg-emerald-500/20 text-emerald-300" },
  green:   { button: "bg-green-500/15 hover:bg-green-500/25 border-green-500/20 text-green-200",   ring: "ring-green-500/40",  badge: "bg-green-500/20 text-green-300" },
  orange:  { button: "bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/20 text-orange-200", ring: "ring-orange-500/40", badge: "bg-orange-500/20 text-orange-300" },
  red:     { button: "bg-red-500/15 hover:bg-red-500/25 border-red-500/20 text-red-200",           ring: "ring-red-500/40",    badge: "bg-red-500/20 text-red-300" },
  violet:  { button: "bg-violet-500/15 hover:bg-violet-500/25 border-violet-500/20 text-violet-200", ring: "ring-violet-500/40", badge: "bg-violet-500/20 text-violet-300" },
  blue:    { button: "bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/20 text-blue-200",       ring: "ring-blue-500/40",   badge: "bg-blue-500/20 text-blue-300" },
  indigo:  { button: "bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/20 text-indigo-200", ring: "ring-indigo-500/40", badge: "bg-indigo-500/20 text-indigo-300" },
  neutral: { button: "bg-neutral-500/15 hover:bg-neutral-500/20 border-neutral-500/20 text-neutral-200", ring: "ring-neutral-500/40", badge: "bg-neutral-500/20 text-neutral-300" },
};

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  action,
  accent,
  loading,
  onClick,
}: {
  action: QuickAction;
  accent: (typeof ACCENT)[string];
  loading: boolean;
  onClick: () => void;
}) {
  const Icon = action.icon;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={action.label}
      className={`
        relative flex flex-col items-center justify-center gap-2
        rounded-2xl border px-4 py-3.5 min-w-[80px] max-w-[96px]
        transition-all duration-150
        hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-wait
        ${accent.button}
      `}
    >
      {loading ? (
        <span className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin opacity-60" />
      ) : (
        <Icon size={24} />
      )}
      <span className="text-[11px] font-semibold leading-tight text-center whitespace-nowrap">
        {action.label}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuickActions() {
  const selectedKey = useSceneStore((s) => s.selectedKey);
  const setShowAdvanced = useSceneStore((s) => s.setShowAdvanced);
  const selectKey = useSceneStore((s) => s.selectKey);

  const params = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.getProject(params.projectId));
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const appendVersion = useProjectStore((s) => s.appendVersion);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!selectedKey || !project) return null;

  // Resolve which group of actions to show
  const featureRef = parseFeatureKey(selectedKey);
  let group: QuickActionGroup;
  let rawFeature: Record<string, unknown> = {};

  if (featureRef) {
    rawFeature = (getFeatureRawAt(project.houseConfigJson, featureRef.type, featureRef.index) ?? {}) as Record<string, unknown>;
    group = getActionsForFeature(featureRef.type, rawFeature);
  } else {
    // Core part (wall / roof / floor) → house style actions
    group = HOUSE_ACTIONS;
  }

  const accent = ACCENT[group.accent] ?? ACCENT.neutral;

  const handleAction = async (action: QuickAction) => {
    if (loadingAction) return;
    setLoadingAction(action.id);
    setFeedback(null);

    try {
      const kind = action.action.type;

      if (kind === "direct") {
        const index = featureRef?.index ?? 0;
        const newJson = action.action.fn(project.houseConfigJson, index, rawFeature);
        updateHouseConfig(project.id, newJson);
        setFeedback("Done ✓");

      } else if (kind === "material") {
        const preset = action.action.preset;
        // Build setMaterials op using the fields from the preset
        const { json, errors } = applyPatch(project.houseConfigJson, [
          { op: "setMaterials", fields: preset as Record<string, unknown> },
        ]);
        if (errors.length === 0) {
          updateHouseConfig(project.id, json);
          setFeedback("Style applied ✓");
        }

      } else if (kind === "ai") {
        const index = featureRef?.index ?? 0;
        const prompt = action.action.prompt(index, rawFeature);

        const res = await fetch("/api/ai/house", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, currentHouseJson: project.houseConfigJson, history: [] }),
        });

        const data = await res.json();
        if (res.ok) {
          appendVersion(project.id, data.summary, data.json);
          setFeedback("Done ✓");
        } else if (data.error?.includes("configured") || res.status === 503) {
          setFeedback("Connect AI to use this →");
        } else {
          setFeedback("Try again?");
        }
      }
    } finally {
      setLoadingAction(null);
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  return (
    /* Positioned at the bottom-center of the viewport div */
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-lg">

        {/* Panel */}
        <div className="rounded-2xl border border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur-xl">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="flex items-center gap-2">
              <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${accent.badge}`}>
                {group.emoji} {group.label}
              </span>
              {feedback && (
                <span className="text-xs text-neutral-500 animate-pulse">{feedback}</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setShowAdvanced(true); }}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-neutral-500 hover:bg-white/5 hover:text-neutral-300 transition"
              >
                <Settings2 size={12} />
                Advanced
              </button>
              <button
                onClick={() => selectKey(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-white/5 hover:text-neutral-400 transition"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 p-3">
            {group.actions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                accent={accent}
                loading={loadingAction === action.id}
                onClick={() => handleAction(action)}
              />
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
