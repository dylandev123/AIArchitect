"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import type { CapabilityStatus } from "@/types/library";
import { fallbackFor } from "@/lib/library/capabilities";

const tone: Record<CapabilityStatus, string> = { supported: "text-emerald-300 bg-emerald-500/10", partial: "text-amber-300 bg-amber-500/10", missing: "text-red-300 bg-red-500/10", deprecated: "text-neutral-500 bg-white/5" };

export function CapabilitiesTab() {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { capabilities, capabilityNeeds, loaded, refresh } = useLibraryStore();
  const [filter, setFilter] = useState<CapabilityStatus | "all">("all");
  const [open, setOpen] = useState<string>();
  useEffect(() => { void refresh(adminEmail); }, [adminEmail, refresh]);
  const shown = useMemo(() => capabilities.filter((c) => filter === "all" || c.status === filter).sort((a, b) => (capabilityNeeds.find((n) => n.capabilityId === b.id)?.priority ?? 0) - (capabilityNeeds.find((n) => n.capabilityId === a.id)?.priority ?? 0)), [capabilities, capabilityNeeds, filter]);
  return <div className="flex h-full flex-col gap-3 overflow-hidden">
    <div className="flex shrink-0 items-center justify-between gap-3"><p className="text-[11px] text-neutral-500">Procedural operations only — never GLB assets. Missing operations record a reusable gap and use a safe fallback.</p><select className="rounded border border-white/10 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">All statuses</option>{(["supported", "partial", "missing", "deprecated"] as const).map((x) => <option key={x}>{x}</option>)}</select></div>
    {!loaded ? <p className="text-xs text-neutral-600">Loading capability library…</p> : <div className="flex-1 overflow-y-auto"><div className="flex flex-col gap-2 pb-3">{shown.map((c) => { const need = capabilityNeeds.find((n) => n.capabilityId === c.id); const expanded = open === c.id; const successRate = c.usageCount ? Math.round(c.successCount / c.usageCount * 100) : 0; return <div key={c.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3"><button className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(expanded ? undefined : c.id)}>{expanded ? <ChevronDown size={14} className="mt-0.5 text-neutral-500" /> : <ChevronRight size={14} className="mt-0.5 text-neutral-500" />}<span className="min-w-0 flex-1"><span className="block text-sm font-medium text-neutral-100">{c.name}</span><span className="text-[11px] text-neutral-500">{c.category} · requested {need?.requestedCount ?? 0}× · used {c.usageCount}× · {successRate}% success</span></span><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone[c.status]}`}>{c.status}</span></button>{expanded && <div className="ml-6 mt-2 border-t border-white/5 pt-2 text-[11px] text-neutral-500"><p>{c.description}</p><p className="mt-1">Implementation: {c.implementationNotes}</p><p className="mt-1">Impact {c.visualImpact ?? 5}/10 · Difficulty {c.implementationDifficulty ?? 5}/10 · Performance {c.performanceCost ?? 5}/10</p><p className="mt-1">Parameters: {c.parameters.map((p) => p.key).join(", ") || "none"} · Constraints: {c.constraints.join(", ") || "none"}</p><p className="mt-1">Fallback: {need?.fallback ?? fallbackFor(c)}</p>{need && <><p className="mt-1">Priority {need.priority} · stages: {need.stages.join(", ")} · recipes: {need.recipeIds.length || "none"} · projects: {new Set(need.projectRefs.map((r) => r.projectId).filter(Boolean)).size}</p><p className="mt-1">Recent projects: {need.projectRefs.slice(-3).map((r) => r.projectId ?? "unassigned").join(", ")}</p></>}</div>}</div>; })}</div></div>}
  </div>;
}
