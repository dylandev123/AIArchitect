"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pencil, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useAssetStore } from "@/store/useAssetStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { byGenerationOrder, USAGE_CONTEXTS, type PlanInput } from "@/lib/library/plans";
import { categoryLabel } from "@/lib/library/taxonomy";
import { ASSET_CATEGORIES, ASSET_PRIORITIES, type AssetPlan, type AssetPriority, type PlannedAsset } from "@/types/library";
import { NativeAssetPanel } from "./NativeAssetPanel";

const PRIORITY_STYLE: Record<AssetPriority, string> = {
  required: "bg-amber-500/15 text-amber-300",
  recommended: "bg-sky-500/15 text-sky-300",
  optional: "bg-white/5 text-neutral-400",
};
const inputCls = "w-full rounded-lg border border-white/8 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/40";
const btn = "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export interface PlanTarget {
  needId?: string;
  knowledgeId?: string;
  title: string;
}

interface Props {
  target: PlanTarget;
  /** Open an already saved plan instead of asking the AI for a new pack. */
  planId?: string;
  onClose: () => void;
}

type Draft = { title: string; knowledgeId?: string; needId?: string; assets: PlannedAsset[] };

/** Server-owned progress (spec under review, produced asset, route) always comes from the stored plan. */
function overlay(local: PlannedAsset[], stored: AssetPlan | undefined): PlannedAsset[] {
  if (!stored) return local;
  const byId = new Map(stored.assets.map((a) => [a.id, a]));
  return local.map((a) => {
    const s = byId.get(a.id);
    return s ? { ...a, spec: s.spec, generated: s.generated, assetId: s.assetId, job: s.job, route: s.route ?? a.route } : a;
  });
}

/** The Asset Planning dialog: review the AI's Asset Pack, edit it, approve it, and generate its assets one by one. */
export function AssetPlanDialog({ target, planId: initialPlanId, onClose }: Props) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const catalog = useAssetStore((s) => s.catalog);
  const { plans, generation, planAssets, savePlan, generateNative, act } = useLibraryStore();
  const [planId, setPlanId] = useState(initialPlanId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phase, setPhase] = useState<"loading" | "error" | "review">("loading");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  const stored = plans.find((p) => p.id === planId);
  const assets = useMemo(() => (draft ? overlay(draft.assets, stored).slice().sort(byGenerationOrder) : []), [draft, stored]);

  const load = async (avoid?: string[]) => {
    setPhase("loading");
    setError("");
    const known = catalog.filter((a) => a.type === "glb-model").map((a) => a.name).slice(0, 60);
    const result = await planAssets(adminEmail, { needId: target.needId, knowledgeId: target.knowledgeId }, { known, avoid });
    if ("error" in result) {
      setError(result.error);
      return setPhase("error");
    }
    setDraft(result.draft);
    setNotes(result.adjustments);
    setSelected(new Set(result.draft.assets.filter((a) => a.priority !== "optional").map((a) => a.id)));
    setPhase("review");
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const existing = initialPlanId ? useLibraryStore.getState().plans.find((p) => p.id === initialPlanId) : undefined;
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft({ title: existing.title, knowledgeId: existing.knowledgeId, needId: existing.needId, assets: existing.assets });
      setSelected(new Set(existing.assets.filter((a) => a.approved).map((a) => a.id)));
      setPhase("review");
    } else void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (id: string, change: Partial<PlannedAsset>) => setDraft((d) => (d ? { ...d, assets: d.assets.map((a) => (a.id === id ? { ...a, ...change } : a)) } : d));
  const remove = (id: string) => {
    setDraft((d) => (d ? { ...d, assets: d.assets.filter((a) => a.id !== id) } : d));
    setSelected((s) => new Set([...s].filter((x) => x !== id)));
  };

  /** Saves the plan as it stands. `approve` marks the selected assets approved for generation. */
  const persist = async (status: PlanInput["status"], approve: boolean): Promise<string | null> => {
    if (!draft) return null;
    const input: PlanInput = {
      id: planId,
      title: draft.title,
      knowledgeId: draft.knowledgeId,
      needId: draft.needId,
      status,
      assets: assets.map((a) => ({ ...a, approved: approve ? selected.has(a.id) || a.approved : a.approved })) as PlanInput["assets"],
    };
    const res = await savePlan(adminEmail, input);
    if ("error" in res) {
      setError(res.error);
      return null;
    }
    setPlanId(res.plan.id);
    setDraft((d) => (d ? { ...d, assets: d.assets.map((a) => ({ ...a, approved: approve ? selected.has(a.id) || a.approved : a.approved })) } : d));
    setMessage(planId ? "Asset plan saved" : "Asset plan created");
    return res.plan.id;
  };

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await work();
    } finally {
      setBusy("");
    }
  };

  const approvePlan = () =>
    run("approve", async () => {
      const id = await persist("approved", true);
      if (id) onClose();
    });

  const generate = (ids: string[]) =>
    run("generate", async () => {
      const id = await persist("approved", true);
      if (!id) return;
      const chosen = assets.filter((a) => ids.includes(a.id) && !a.generated);
      const native = chosen.filter((a) => (a.route ?? "native") === "native");
      const external = chosen.filter((a) => a.route === "external-generation-recommended");
      const problems: string[] = [];
      let done = 0;
      // Highest reuse first (`assets` is already in generation order).
      for (const a of native) {
        setMessage(`Generating ${done + 1}/${native.length}: ${a.name}…`);
        const res = await generateNative(adminEmail, id, a.id);
        if ("error" in res) problems.push(`${a.name}: ${res.error}`);
        else if (res.kind === "external") problems.push(`${a.name}: external generation recommended (${res.reason})`);
        done++;
      }
      let extra = "";
      if (external.length > 0) {
        if (generation?.available) {
          const err = await act(adminEmail, { action: "generateExternal", planId: id, assetIds: external.map((a) => a.id) });
          extra = err ? ` External: ${err}` : ` ${external.length} sent to the external provider.`;
        } else extra = ` ${external.length} need external generation (no provider configured).`;
      }
      setMessage(`${native.length - problems.length} of ${native.length} native drafts ready to review — open each to preview and approve.${extra}`);
      if (problems.length > 0) setError(problems.slice(0, 3).join(" · "));
    });

  const groups = ASSET_PRIORITIES.map((p) => ({ priority: p, items: assets.filter((a) => a.priority === p) })).filter((g) => g.items.length > 0);
  const allIds = assets.map((a) => a.id);
  const activePlan = { id: planId ?? "", needId: draft?.needId, knowledgeId: draft?.knowledgeId };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4" style={{ zIndex: 10000 }} role="dialog" aria-label="Asset planning">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-100"><Sparkles size={14} className="text-violet-300" /> Asset Planning — {target.title}</p>
            <p className="text-[11px] text-neutral-500">The AI plans reusable building blocks, never one giant model. Each becomes its own asset: generated natively, reviewed, then added to the library.</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/8 hover:text-neutral-300" aria-label="Close"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-2 py-16 text-neutral-500">
              <LoaderCircle className="animate-spin" size={20} />
              <p className="text-xs">Planning the asset pack…</p>
            </div>
          )}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="max-w-md text-xs text-red-400">{error}</p>
              <div className="flex gap-2">
                <button onClick={() => void load()} className={`${btn} border-amber-500/20 bg-amber-500/15 text-amber-300`}><RefreshCw size={12} /> Try again</button>
                <button onClick={onClose} className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">Cancel</button>
              </div>
            </div>
          )}
          {phase === "review" && draft && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                <span className="font-medium text-neutral-300">{draft.title}</span>
                <span>· {assets.length} assets · {selected.size} selected{stored ? ` · saved (${stored.status})` : " · not saved yet"}</span>
                {!planId && (
                  <button onClick={() => void run("regen", () => load(assets.map((a) => a.name)))} disabled={!!busy} className="ml-auto flex items-center gap-1 text-neutral-500 hover:text-neutral-300"><RefreshCw size={11} /> Re-plan</button>
                )}
              </div>
              {notes.length > 0 && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-[10px] text-neutral-600">{notes.slice(0, 3).join(" ")}</p>}

              {groups.map(({ priority, items }) => (
                <section key={priority} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold capitalize text-neutral-200">{priority} assets <span className="font-normal text-neutral-600">({items.length})</span></h3>
                  {items.map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                      {editing === a.id ? (
                        <div className="flex flex-col gap-2">
                          <input className={inputCls} value={a.name} onChange={(e) => patch(a.id, { name: e.target.value })} />
                          <div className="flex gap-2">
                            <select className={inputCls} value={a.category} onChange={(e) => patch(a.id, { category: e.target.value as PlannedAsset["category"] })}>{ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select>
                            <select className={inputCls} value={a.priority} onChange={(e) => patch(a.id, { priority: e.target.value as AssetPriority })}>{ASSET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
                            <input className={`${inputCls} max-w-24`} type="number" min={0} max={100} value={a.estimatedReuse} onChange={(e) => patch(a.id, { estimatedReuse: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} title="Estimated reuse 0-100" />
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {USAGE_CONTEXTS.map((c) => (
                              <button key={c} type="button" onClick={() => patch(a.id, { contexts: a.contexts.includes(c) ? a.contexts.filter((x) => x !== c) : [...a.contexts, c] })} className={`rounded-md px-2 py-1 text-[11px] ${a.contexts.includes(c) ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-neutral-500"}`}>{c}</button>
                            ))}
                          </div>
                          <textarea className={`${inputCls} h-14`} value={a.description} onChange={(e) => patch(a.id, { description: e.target.value })} />
                          <textarea className={`${inputCls} h-20 font-mono`} value={a.generationPrompt} onChange={(e) => patch(a.id, { generationPrompt: e.target.value })} />
                          <button onClick={() => setEditing(null)} className={`${btn} w-fit border-amber-500/30 bg-amber-500/20 text-amber-300`}>Done</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start gap-3">
                            <input type="checkbox" className="mt-1" checked={selected.has(a.id)} disabled={a.generated} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(a.id); else n.delete(a.id); return n; })} aria-label={`Select ${a.name}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-neutral-100">{a.name}</p>
                              <p className="text-[11px] text-neutral-500">
                                {categoryLabel(a.category)} · <span className={`rounded px-1 py-0.5 text-[10px] ${PRIORITY_STYLE[a.priority]}`}>{a.priority}</span> · reuse <span className="font-medium text-neutral-300">{a.estimatedReuse}</span>
                                {a.contexts.length > 0 && <> · {a.contexts.join(", ")}</>}
                                {a.dimensions && <> · {[a.dimensions.width, a.dimensions.depth, a.dimensions.height].map((v) => (v ? v : "–")).join(" × ")} m</>}
                              </p>
                              <p className="mt-0.5 text-[11px] text-neutral-500">{a.description}</p>
                              {a.route === "external-generation-recommended" && (
                                <p className="mt-0.5 text-[10px] text-amber-400/80">external-generation-recommended — too organic or complex for the native builders; better sent to Meshy/Tripo later.</p>
                              )}
                              {a.job && <p className="mt-0.5 text-[10px] text-sky-400/80">Sent to {a.job.providerId} (job {a.job.jobId}).</p>}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} disabled={a.route === "external-generation-recommended" && !a.spec} className={`${btn} border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20`} title={a.route === "external-generation-recommended" ? "Recommended for external generation" : "Generate this asset natively and review it"}>
                                <Sparkles size={12} /> {a.generated ? "In library" : a.spec ? "Review" : "Generate Native"}
                              </button>
                              <button onClick={() => setEditing(a.id)} disabled={a.generated} className="p-1.5 text-neutral-500 hover:text-neutral-200" title="Edit"><Pencil size={13} /></button>
                              <button onClick={() => { if (!a.spec && !a.generated) remove(a.id); else if (window.confirm(`Remove "${a.name}" from the plan? Its native draft will be lost.`)) remove(a.id); }} disabled={a.generated} className="p-1.5 text-neutral-600 hover:text-red-400" title="Delete"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          {a.route === "external-generation-recommended" && !a.generated && (
                            <button onClick={() => patch(a.id, { route: "native" })} className="w-fit text-[10px] text-neutral-600 hover:text-neutral-300">Try native anyway</button>
                          )}
                          {(expanded === a.id || a.spec) && a.route !== "external-generation-recommended" && (
                            <NativeAssetPanel plan={activePlan} asset={a} ensureSaved={async () => planId ?? (await persist("draft", false))} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              ))}
              {message && <p className="rounded-lg bg-violet-500/10 px-3 py-2 text-[11px] text-violet-300">{message}</p>}
              {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-400">{error}</p>}
            </div>
          )}
        </div>

        {phase === "review" && draft && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-3">
            <button onClick={() => void generate(allIds)} disabled={!!busy || assets.length === 0} className={`${btn} border-violet-500/25 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25`}>{busy === "generate" ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate All</button>
            <button onClick={() => void generate([...selected])} disabled={!!busy || selected.size === 0} className={`${btn} border-violet-500/25 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25`}>Generate Selected ({selected.size})</button>
            <button onClick={() => void run("draft", async () => void (await persist("draft", false)))} disabled={!!busy || assets.length === 0} className={`${btn} border-white/8 text-neutral-400 hover:text-neutral-200`}>Save Draft</button>
            <button onClick={() => void approvePlan()} disabled={!!busy || assets.length === 0} className={`${btn} ml-auto border-emerald-500/20 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25`}>Approve Plan</button>
            <button onClick={onClose} disabled={busy === "generate"} className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
