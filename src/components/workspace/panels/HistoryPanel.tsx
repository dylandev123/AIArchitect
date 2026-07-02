"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { GitCompare, History, RotateCcw } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { formatRelativeTime } from "@/lib/format";
import { VersionDiffModal } from "../VersionDiffModal";

export function HistoryPanel() {
  const params = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.getProject(params.projectId));
  const restoreVersion = useProjectStore((s) => s.restoreVersion);
  const [selected, setSelected] = useState<number[]>([]);
  const [comparing, setComparing] = useState(false);

  const versions = project?.versions ?? [];

  if (!project || versions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <History size={24} className="mb-1 text-neutral-700" />
        <p className="text-sm font-medium text-neutral-400">No actions yet</p>
        <p className="text-xs text-neutral-600">
          Edits made through the AI Chat will appear here, newest first.
        </p>
      </div>
    );
  }

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length < 2) return [...prev, index];
      return [prev[1], index];
    });
  };

  const ordered = [...versions.entries()].reverse();
  const [a, b] = selected;
  const canCompare = selected.length === 2;

  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">History</p>
        {selected.length > 0 && (
          <button onClick={() => setSelected([])} className="text-xs text-neutral-600 hover:text-neutral-400">
            Clear
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <button
          onClick={() => canCompare && setComparing(true)}
          disabled={!canCompare}
          className="mb-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-neutral-600"
        >
          <GitCompare size={13} />
          {canCompare ? "Compare Selected" : `Select ${2 - selected.length} more to compare`}
        </button>
      )}

      {ordered.map(([index, version]) => {
        const isCurrent = index === project.currentVersionIndex;
        const isSelected = selected.includes(index);
        return (
          <div
            key={version.id}
            className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 ${
              isCurrent ? "bg-amber-500/10" : "hover:bg-white/5"
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(index)}
              className="mt-1 shrink-0 accent-amber-500"
              aria-label={`Select version ${index + 1} to compare`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-neutral-500">Version {index + 1}</p>
              <p className="truncate text-sm font-medium text-neutral-200">{version.summary}</p>
              <p className="text-xs text-neutral-500">
                {formatRelativeTime(version.createdAt)}
                {isCurrent && <span className="ml-1.5 text-amber-400">· Current</span>}
              </p>
            </div>
            {!isCurrent && (
              <button
                onClick={() => restoreVersion(project.id, index)}
                title="Restore this version"
                className="shrink-0 rounded-md p-1.5 text-neutral-600 opacity-0 hover:bg-amber-500/10 hover:text-amber-400 group-hover:opacity-100"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        );
      })}

      {comparing && canCompare && (
        <VersionDiffModal
          older={versions[Math.min(a, b)]}
          newer={versions[Math.max(a, b)]}
          onClose={() => setComparing(false)}
        />
      )}
    </div>
  );
}
