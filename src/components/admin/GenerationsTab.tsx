"use client";

import { withAssetOutcomes } from "@/lib/assets/outcomes";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, LoaderCircle, MinusCircle, Sparkles } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useGenerationStore } from "@/store/useGenerationStore";
import { useLibraryStore, type RecipeIntent } from "@/store/useLibraryStore";
import type { DesignRecipe, GenerationReport, Need } from "@/types/library";
import { resolveLiveNeed } from "@/lib/library/liveNeed";
import { AssetPlanDialog } from "./AssetPlanDialog";

/**
 * The learning loop, made visible: for each generation, the outdoor spaces found, what the library supplied and did not, the
 * Knowledge and Asset Needs that were opened, the starter plans written, and whether the write reached the store. Every gap is a
 * button: Generate Recipe for a Knowledge gap, Open Plan for an Asset Need — so Admin is where the next step starts.
 */

/** Distinguishes one "open the recipe form" request from the next, so the form remounts on a fresh draft. */
let intentCounter = 0;
const time = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const pct = (n: number) => `${Math.round(n * 100)}%`;
const chip = "rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-neutral-400";
const actionBtn = "flex items-center gap-1 rounded-md border border-violet-500/25 bg-violet-500/15 px-2 py-1 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/25 disabled:cursor-wait disabled:opacity-60";

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {title}
        {count !== undefined && <span className="ml-1.5 font-normal text-neutral-600">{count}</span>}
      </h4>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-[11px] text-neutral-600">{children}</p>;

function Applied({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={11} /> applied</span>
  ) : (
    <span className="flex items-center gap-1 text-neutral-500"><MinusCircle size={11} /> not applied</span>
  );
}

function ReportCard({ report, local, onNavigate }: { report: GenerationReport; local: boolean; onNavigate?: (tab: "recipes", intent?: RecipeIntent) => void }) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { plans, needs, recipes, proposeRecipe } = useLibraryStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [planning, setPlanning] = useState<{ needId: string; title: string; planId: string } | null>(null);
  const p = report.persistence;
  const failed = report.steps.filter((s) => !s.ok);
  const realized = report.spaces.filter((s) => s.realized);

  const openRecipe = async (id: string, title: string) => {
    setBusy(id);
    setError("");
    const result = await proposeRecipe(adminEmail, id);
    setBusy("");
    const intent = { knowledgeId: id, title, nonce: ++intentCounter };
    if (!("error" in result)) return onNavigate?.("recipes", { ...intent, ...result });
    onNavigate?.("recipes", { ...intent, notice: `AI proposal unavailable (${result.error}) — blank form opened.` });
  };
  const planFor = (needId: string) => plans.find((pl) => pl.needId === needId);
  const recipeFor = (knowledgeId: string): DesignRecipe | undefined =>
    recipes.filter((recipe) => recipe.knowledgeIds?.includes(knowledgeId)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const currentNeed = (historical: GenerationReport["assetNeeds"][number]): Need | undefined => resolveLiveNeed(historical, needs);

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-1.5 text-left">
        {open ? <ChevronDown size={13} className="mt-0.5 shrink-0 text-neutral-500" /> : <ChevronRight size={13} className="mt-0.5 shrink-0 text-neutral-500" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-neutral-100">{report.brief || "(no brief)"}</span>
          <span className="block text-[11px] text-neutral-500">
            {time(report.at)} · {realized.length} outdoor spaces · {report.knowledgeGaps.length} knowledge gaps · {report.assetNeeds.length} asset needs · {report.plansCreated.length} plans created · {report.recipes.length} recipes / {report.assets.length} assets retrieved
          </span>
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${p.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{p.ok ? `stored · ${p.backend}` : "NOT STORED"}</span>
      </button>

      {!p.ok && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> The library write failed ({p.error}). {local ? "This is the copy from this browser; " : ""}nothing below was saved, so the next generation will not learn from it.
        </p>
      )}
      {failed.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Step failed: {failed.map((s) => `${s.name} (${s.error})`).join("; ")}
        </p>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-4 border-t border-white/5 pt-3">
          <Section title="Placement">
            <p className="text-[11px] text-neutral-400">
              Arrival {report.placement.arrivalSide || "—"} · view {report.placement.viewSide || "—"} · pools: {report.placement.pools.map((x) => x.side).join(", ") || "none"} · garages: {report.placement.garages.map((x) => x.side).join(", ") || "none"}
            </p>
            {report.placement.issues.length > 0 ? report.placement.issues.map((i) => <p key={i} className="text-[11px] text-red-400">{i}</p>) : <p className="text-[11px] text-emerald-400/80">Pool on the private side, garage on the arrival side.</p>}
          </Section>

          <Section title="Outdoor spaces" count={report.spaces.length}>
            <div className="flex flex-col gap-1">
              {report.spaces.map((s) => (
                <div key={s.kind} className="text-[11px] text-neutral-400">
                  <span className="font-medium text-neutral-200">{s.name}</span>{" "}
                  <span className={chip}>{s.side}</span> <span className={chip}>~{s.footprint.width}×{s.footprint.depth} m</span>{" "}
                  {s.requested && <span className={`${chip} text-sky-300`}>asked for</span>} {!s.realized && <span className={`${chip} text-amber-300`}>not in design</span>}
                  <span className="text-neutral-600"> — {s.realizedBy.join(", ") || s.reasons[0]}</span>
                  {(s.supplied.length > 0 || s.missing.length > 0) && (
                    <span className="block pl-3 text-neutral-600">
                      {s.supplied.length > 0 && <>has {s.supplied.join(", ")} · </>}
                      {s.missing.length > 0 ? <>missing {s.missing.join(", ")}</> : "nothing missing"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="New knowledge gaps" count={report.knowledgeGaps.length}>
            {report.knowledgeGaps.length === 0 && <Empty>The library already covers every area and space.</Empty>}
            {report.knowledgeGaps.map((g) => {
              const recipe = recipeFor(g.id);
              const recipeLabel = recipe?.approval === "approved" ? "Recipe Approved" : recipe?.approval === "proposed" ? "Recipe Proposed" : "Recipe Generated";
              return (
                <div key={g.id} className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[11px] text-neutral-400">
                    <span className="font-medium text-neutral-200">{g.name}</span> {g.isNew && <span className={`${chip} text-sky-300`}>new</span>} <span className="text-neutral-600">requested {g.requestCount}×</span>
                    <span className="block text-neutral-600">{g.reason}</span>
                    {recipe && <span className="mt-1 flex items-center gap-1 text-emerald-400"><CheckCircle2 size={11} /> {recipeLabel}</span>}
                  </p>
                  {recipe ? (
                    <span className="flex shrink-0 gap-1">
                      <button onClick={() => onNavigate?.("recipes", { knowledgeId: g.id, title: g.name, recipeId: recipe.id, nonce: ++intentCounter })} className={actionBtn}>Open Recipe</button>
                      <button onClick={() => void openRecipe(g.id, g.name)} disabled={busy === g.id} className={actionBtn}>Generate Another</button>
                    </span>
                  ) : (
                    <button onClick={() => void openRecipe(g.id, g.name)} disabled={busy === g.id} className={actionBtn}>
                      {busy === g.id ? <LoaderCircle size={11} className="animate-spin" /> : <Sparkles size={11} />} Generate Recipe
                    </button>
                  )}
                </div>
              );
            })}
          </Section>

          <Section title="New asset needs" count={report.assetNeeds.length}>
            {report.assetNeeds.length === 0 && <Empty>No asset is missing.</Empty>}
            {report.assetNeeds.map((n) => {
              const liveNeed = currentNeed(n);
              // A generation report is historical evidence, not the planner's source
              // of truth. Its legacy ID is preferred when it survives, otherwise its
              // normalized semantic family resolves the live Need. Never start a plan
              // from a report-only record.
              const plan = liveNeed ? planFor(liveNeed.id) : undefined;
              return (
                <div key={n.id} className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[11px] text-neutral-400">
                    <span className="font-medium text-neutral-200">{liveNeed?.title ?? n.name}</span> {n.isNew && <span className={`${chip} text-sky-300`}>new</span>} <span className="text-neutral-600">requested {liveNeed?.requestedCount ?? n.requestedCount}×</span>
                    {liveNeed && <span className={`ml-1 ${chip}`}>{liveNeed.status}</span>}
                    <span className="block text-neutral-600">
                      {n.spaces.length > 0 ? <>for {n.spaces.join(", ")}</> : "asked for by the brief"}
                      {n.components.length > 0 && <> · missing {n.components.join(", ")}</>}
                    </span>
                  </p>
                  {plan ? (
                    <button onClick={() => setPlanning({ needId: liveNeed!.id, title: liveNeed!.title, planId: plan.id })} className={actionBtn}><CheckCircle2 size={11} /> Asset Plan Created · Open Plan</button>
                  ) : !liveNeed ? (
                    <span className="shrink-0 text-[10px] text-amber-400">This historical Need is no longer present in the current library.</span>
                  ) : (
                    <button onClick={() => setPlanning({ needId: liveNeed.id, title: liveNeed.title, planId: "" })} className={actionBtn}><Sparkles size={11} /> Generate Asset Plan</button>
                  )}
                </div>
              );
            })}
          </Section>

          <Section title="Asset plans created" count={report.plansCreated.length}>
            {report.plansCreated.length === 0 ? <Empty>None this time{report.plansExisting.length > 0 ? ` (${report.plansExisting.length} needs already have a plan)` : ""}.</Empty> : report.plansCreated.map((pl) => <p key={pl.id} className="text-[11px] text-neutral-400">{pl.title} <span className="text-neutral-600">· {pl.assets} planned assets</span></p>)}
          </Section>

          <Section title="Recipes retrieved" count={report.recipes.length}>
            {report.recipes.length === 0 && <Empty>No approved recipe matched. Approve recipes from the Learn tab and they are retrieved here automatically.</Empty>}
            {report.recipes.map((r) => (
              <p key={r.id} className="text-[11px] text-neutral-400">
                <span className="font-medium text-neutral-200">{r.name}</span> <Applied ok={r.applied} />
                <span className="block text-neutral-600">{r.reason}</span>
                <span className="block text-neutral-600">{r.note}</span>
              </p>
            ))}
          </Section>

          <Section title="Recipe rejections" count={report.recipeRejections?.length ?? 0}>
            {(report.recipeRejections ?? []).length === 0 && <Empty>No recipe rejections recorded.</Empty>}
            {(report.recipeRejections ?? []).map((r) => <p key={r.id} className="text-[11px] text-neutral-400"><span className="font-medium text-neutral-200">{r.name}</span><span className="block text-neutral-600">{r.reason}</span></p>)}
          </Section>

          {report.sitePlan && (
            <Section title="Accepted Site Plan geometry">
              <p className="text-[11px] text-neutral-400">Pool {report.sitePlan.pool.width}×{report.sitePlan.pool.depth} m · deck {report.sitePlan.poolDeck.width}×{report.sitePlan.poolDeck.depth} m · terrace {report.sitePlan.terrace.width}×{report.sitePlan.terrace.depth} m</p>
              <p className="text-[11px] text-neutral-600">{report.sitePlan.paths.length} paths · {report.sitePlan.landscape.map((zone) => zone.purpose).join(", ")}</p>
            </Section>
          )}

          <Section title="Capabilities requested & resolved" count={report.capabilitiesUsed?.length ?? 0}>
            {(report.capabilitiesUsed ?? []).length === 0 && <Empty>No recognized architectural capability was requested.</Empty>}
            {(report.capabilitiesUsed ?? []).map((c) => <p key={`${c.id}-${c.stage}`} className="text-[11px] text-neutral-400"><span className={c.status === "supported" ? "text-emerald-400" : "text-amber-300"}>{c.status === "supported" ? "✓ used" : "◐ partial"}</span> <span className="font-medium text-neutral-200">{c.name}</span> <span className="text-neutral-600">· requested by {c.stage}{c.note ? ` · ${c.note}` : ""}</span></p>)}
          </Section>

          <Section title="Capability gaps" count={report.capabilityGaps?.length ?? 0}>
            {(report.capabilityGaps ?? []).length === 0 && <Empty>No capability gaps recorded.</Empty>}
            {(report.capabilityGaps ?? []).map((c) => <p key={`${c.id}-${c.stage}`} className="text-[11px] text-neutral-400"><span className="text-amber-300">○</span> <span className="font-medium text-neutral-200">{c.name}</span> <span className={c.status === "missing" ? "text-red-300" : "text-amber-300"}> · {c.status}</span><span className="block pl-3 text-neutral-600">{c.stage} — fallback: {c.fallback}</span></p>)}
          </Section>

          {report.review && (
            <Section title="Architecture review" count={report.review.criteria.length}>
              <p className="text-[11px] text-neutral-400">
                Overall <span className="font-medium text-neutral-200">{pct(report.review.overallScore)}</span>
                {report.review.strengths.length > 0 && <span className="text-neutral-600"> · strong: {report.review.strengths.join(", ")}</span>}
              </p>
              <div className="flex flex-wrap gap-1">
                {report.review.criteria.map((c) => (
                  <span key={c.criterion} title={c.reason} className={`rounded px-1.5 py-0.5 text-[10px] ${c.score < 0.5 ? "bg-red-500/15 text-red-300" : c.score >= 0.75 ? "bg-emerald-500/10 text-emerald-300/80" : "bg-amber-500/10 text-amber-300/80"}`}>
                    {c.criterion} {pct(c.score)}
                  </span>
                ))}
              </div>
              {report.review.recommendations.length > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  {report.review.recommendations.map((r) => (
                    <p key={r.criterion} className="text-[11px] text-neutral-400">
                      <span className="font-medium text-amber-300">{r.criterion}</span> <span className="text-neutral-600">{r.issue}</span>
                      <span className="block text-neutral-600">recommend: {r.recommendedStrategy}{r.missingCapability ? ` · missing capability: ${r.missingCapability}` : ""}</span>
                    </p>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="Library assets retrieved & placed" count={report.assets.length}>
            {report.assets.length === 0 && <Empty>No approved library asset fit a space or feature.</Empty>}
            {report.assets.map((a) => (
              <p key={`${a.id}-${a.component}-${a.space}`} className="text-[11px] text-neutral-400">
                <span className="font-medium text-neutral-200">{a.name}</span>{a.serverGlb && <span className="ml-1 rounded bg-sky-500/10 px-1 py-0.5 text-[9px] text-sky-300">server GLB</span>} <span className="text-neutral-600">— {a.space}{a.feature ? ` · ${a.feature}` : ` · ${a.component}`}</span> <span>{a.status ?? (a.applied ? "Applied" : "Retrieved")}</span>
                <span className="block text-neutral-600">{a.note}</span>
              </p>
            ))}
          </Section>

          <Section title="Areas scored">
            <div className="flex flex-wrap gap-1">
              {report.areas.map((a) => (
                <span key={a.area} title={a.reason} className={`rounded px-1.5 py-0.5 text-[10px] ${!a.relevant ? "bg-white/[0.03] text-neutral-700" : a.weak ? "bg-red-500/15 text-red-300" : "bg-emerald-500/10 text-emerald-300/80"}`}>
                  {a.area} {a.relevant ? pct(a.score) : "n/a"}
                </span>
              ))}
            </div>
          </Section>

          <p className="text-[10px] text-neutral-700">
            Steps: {report.steps.map((s) => `${s.name} ${s.ok ? "✓" : "✗"} ${s.ms}ms`).join(" · ")} · wrote {p.wrote.knowledge} knowledge, {p.wrote.needs} needs, {p.wrote.plans} plans, {p.wrote.recipes} recipe counters
          </p>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      )}
      {planning && <AssetPlanDialog key={planning.planId || planning.needId} target={{ needId: planning.needId, title: planning.title }} planId={planning.planId || undefined} onClose={() => setPlanning(null)} />}
    </div>
  );
}

export function GenerationsTab({ onNavigate }: { onNavigate?: (tab: "recipes", intent?: RecipeIntent) => void }) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { generations, loaded, loading, error, refresh } = useLibraryStore();
  const outcomes = useGenerationStore(s => s.outcomes);
  const local = useGenerationStore((s) => s.reports);

  useEffect(() => {
    void refresh(adminEmail);
  }, [adminEmail, refresh]);

  // This browser's copy of a generation the server could not store (or has not listed yet) comes first.
  const shown = useMemo(() => {
    const known = new Set(generations.map((g) => g.id));
    return [...local.filter((r) => !known.has(r.id)).map((r) => ({ report: r, local: true })), ...generations.map((r) => ({ report: r, local: false }))].map(entry => ({...entry, report: withAssetOutcomes(entry.report,outcomes)}));
  }, [generations, local, outcomes]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-[11px] text-neutral-500">What each generation found, what the library could supply, and what was written back. Newest first.</p>
        <button onClick={() => void refresh(adminEmail)} className="text-[11px] text-neutral-600 hover:text-neutral-300">{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {error && <p className="shrink-0 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
      {loaded && shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-neutral-500">No generations recorded yet</p>
          <p className="max-w-sm text-xs text-neutral-600">Generate a property from a brief. Its outdoor spaces, knowledge gaps, asset needs and plans appear here, each one actionable.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 pb-2">
            {shown.map(({ report, local: isLocal }) => (
              <ReportCard key={report.id} report={report} local={isLocal} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
