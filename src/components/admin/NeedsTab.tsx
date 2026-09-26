"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, Upload, EyeOff, RotateCcw } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { categoryLabel } from "@/lib/library/taxonomy";
import { NEED_STATUSES, type Need, type NeedStatus } from "@/types/library";

type Filter = "open" | NeedStatus | "all";

const OPEN: NeedStatus[] = ["needed", "generating", "review"];

const STATUS_STYLE: Record<NeedStatus, string> = {
  needed: "bg-amber-500/15 text-amber-300",
  generating: "bg-sky-500/15 text-sky-300",
  review: "bg-violet-500/15 text-violet-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  ignored: "bg-white/5 text-neutral-500",
};

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

interface NeedsTabProps {
  onSearch: (need: Need) => void;
  onUpload: (need: Need) => void;
}

export function NeedsTab({ onSearch, onUpload }: NeedsTabProps) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { needs, generation, loaded, loading, error, refresh, act } = useLibraryStore();
  const [filter, setFilter] = useState<Filter>("open");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    void refresh(adminEmail);
  }, [adminEmail, refresh]);

  const shown = needs.filter((n) => (filter === "all" ? true : filter === "open" ? OPEN.includes(n.status) : n.status === filter));
  const setStatus = async (need: Need, status: Exclude<NeedStatus, "approved">) => setActionError((await act(adminEmail, { action: "setNeedStatus", id: need.id, status })) ?? "");

  const filters: { id: Filter; label: string }[] = [{ id: "open", label: "Open" }, ...NEED_STATUSES.map((s) => ({ id: s as Filter, label: s })), { id: "all", label: "all" }];

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-md px-2.5 py-1 text-[11px] capitalize transition ${filter === id ? "bg-neutral-700 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            {label}
          </button>
        ))}
        <button onClick={() => void refresh(adminEmail)} className="ml-auto text-[11px] text-neutral-600 hover:text-neutral-300">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {(error || actionError) && <p className="shrink-0 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error || actionError}</p>}

      {loaded && shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-neutral-500">No needs here</p>
          <p className="max-w-sm text-xs text-neutral-600">
            When generation wants an object the library can&apos;t supply — a gazebo, a pool bar — it keeps the procedural version and records it here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 pb-2">
            {shown.map((need) => (
              <div key={need.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-100">{need.title}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      Category: {categoryLabel(need.category)}
                      {need.styleTags.length > 0 && <> · Style: {need.styleTags.join(", ")}</>}
                      {need.contextTags.length > 0 && <> · Context: {need.contextTags.join(", ")}</>}
                    </p>
                    {need.dimensions && (need.dimensions.width || need.dimensions.depth || need.dimensions.height) && (
                      <p className="text-[11px] text-neutral-600">
                        Requested size: {[need.dimensions.width, need.dimensions.depth, need.dimensions.height].map((d) => (d ? `${d.toFixed(1)}` : "–")).join(" × ")} m
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLE[need.status]}`}>{need.status}</span>
                    <span className="text-[11px] font-medium text-neutral-300">Requested {need.requestedCount}×</span>
                  </div>
                </div>

                <p className="mt-1.5 text-[10px] text-neutral-600">
                  First {date(need.firstRequested)} · last {date(need.lastRequested)} · {need.projectRefs.length} recent project{need.projectRefs.length === 1 ? "" : "s"}
                  {need.phrasings.length > 1 && <> · also asked as: {need.phrasings.slice(0, 4).map((p) => `“${p}”`).join(", ")}</>}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    disabled
                    title={generation?.available === false ? generation.message : "Provider ready — the generation workflow is not wired up yet."}
                    className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-600 cursor-not-allowed"
                  >
                    <Sparkles size={12} /> Generate
                  </button>
                  <button onClick={() => onSearch(need)} className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25">
                    <Search size={12} /> Search Assets
                  </button>
                  <button onClick={() => onUpload(need)} className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25">
                    <Upload size={12} /> Upload
                  </button>
                  {need.status === "ignored" ? (
                    <button onClick={() => setStatus(need, "needed")} className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-neutral-200">
                      <RotateCcw size={12} /> Restore
                    </button>
                  ) : (
                    need.status !== "approved" && (
                      <button onClick={() => setStatus(need, "ignored")} className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-neutral-200">
                        <EyeOff size={12} /> Ignore
                      </button>
                    )
                  )}
                </div>
                {generation?.available === false && <p className="mt-1.5 text-[10px] text-neutral-600">{generation.message}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
