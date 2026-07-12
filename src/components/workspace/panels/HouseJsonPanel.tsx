"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { DEFAULT_HOUSE_JSON } from "@/types/house";
import { classifyPromptTarget } from "@/lib/ai/targeting";

export function HouseJsonPanel() {
  const params = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.getProject(params.projectId));
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const appendVersion = useProjectStore((s) => s.appendVersion);
  const text = project?.houseConfigJson ?? DEFAULT_HOUSE_JSON;

  const [aiDraft, setAiDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const detectedScope = useMemo(
    () => (aiDraft.trim() ? classifyPromptTarget(aiDraft) : null),
    [aiDraft]
  );

  const handleAiSubmit = async () => {
    if (!aiDraft.trim() || !project || aiLoading) return;
    setAiLoading(true);
    setAiFeedback(null);
    try {
      const res = await fetch("/api/ai/house", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiDraft,
          currentHouseJson: project.houseConfigJson,
          history: [],
          scope: detectedScope ?? undefined,
        }),
      });
      const data = await res.json() as { summary?: string; json?: string; error?: string };
      if (res.ok && data.json) {
        appendVersion(project.id, data.summary ?? "AI edit", data.json);
        setAiDraft("");
        setAiFeedback({ ok: true, text: data.summary ?? "Done" });
      } else {
        setAiFeedback({ ok: false, text: data.error ?? "AI edit failed." });
      }
    } catch {
      setAiFeedback({ ok: false, text: "Network error." });
    } finally {
      setAiLoading(false);
      setTimeout(() => setAiFeedback(null), 3000);
    }
  };

  const { errors, warnings, config, site } = generateHouseFromJson(text);

  const handleChange = (value: string) => {
    if (project) updateHouseConfig(project.id, value);
  };

  const handleReset = () => {
    if (project) updateHouseConfig(project.id, DEFAULT_HOUSE_JSON);
  };

  const handleFormat = () => {
    if (!project || !site) return;
    updateHouseConfig(project.id, JSON.stringify(site, null, 2));
  };

  const featureCount = site
    ? site.windows.length +
      site.doors.length +
      site.garages.length +
      site.balconies.length +
      site.patios.length +
      site.pools.length +
      site.driveways.length +
      site.rooms.length +
      site.buildings.length +
      site.roads.length +
      site.parking.length +
      site.landscaping.length
    : 0;

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          House JSON
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={handleFormat}
            disabled={!site}
            title="Format"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-200 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Sparkles size={13} />
          </button>
          <button
            onClick={handleReset}
            title="Reset to default"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-200"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <textarea
        spellCheck={false}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        className={`min-h-[260px] flex-1 resize-none rounded-lg border bg-neutral-950/60 p-3 font-mono text-xs leading-relaxed text-neutral-200 outline-none ${
          errors.length > 0
            ? "border-red-500/50 focus:border-red-500/70"
            : "border-white/10 focus:border-amber-500/50"
        }`}
      />

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          {errors.map((err) => (
            <div
              key={err}
              className="flex items-start gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400"
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
          {warnings.map((warn) => (
            <div
              key={warn}
              className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-400"
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {config && (
        <p className="mt-2 px-1 text-xs text-neutral-600">
          {config.width}m × {config.depth}m · {config.floors} floor{config.floors > 1 ? "s" : ""} ·{" "}
          {config.roof} roof · {featureCount} feature{featureCount === 1 ? "" : "s"}
        </p>
      )}

      {/* AI edit */}
      <div className="mt-2 border-t border-white/[0.05] pt-2">
        {detectedScope && detectedScope.kind !== "full" && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-[9px] text-neutral-600">Target:</span>
            <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
              {detectedScope.label}
            </span>
          </div>
        )}
        <div className="flex gap-1.5">
          <input
            value={aiDraft}
            onChange={(e) => setAiDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAiSubmit(); }
            }}
            placeholder="Ask AI to change something…"
            disabled={aiLoading || !project}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-950/60 px-2.5 py-1.5 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-violet-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => void handleAiSubmit()}
            disabled={!aiDraft.trim() || aiLoading || !project}
            title="Send to AI"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-violet-500/15 text-violet-400 transition hover:bg-violet-500/25 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {aiLoading
              ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              : <Sparkles size={13} />}
          </button>
        </div>
        {aiFeedback && (
          <p className={`mt-1.5 text-[11px] ${aiFeedback.ok ? "text-emerald-400" : "text-red-400"}`}>
            {aiFeedback.ok ? "✓" : "✗"} {aiFeedback.text}
          </p>
        )}
      </div>
    </div>
  );
}
