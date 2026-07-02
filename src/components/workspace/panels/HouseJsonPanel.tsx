"use client";

import { useParams } from "next/navigation";
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { DEFAULT_HOUSE_JSON } from "@/types/house";

export function HouseJsonPanel() {
  const params = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.getProject(params.projectId));
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const text = project?.houseConfigJson ?? DEFAULT_HOUSE_JSON;

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
    </div>
  );
}
