"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, EyeOff, LoaderCircle, RotateCcw, Search, Sparkles, Plus } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useAssetStore } from "@/store/useAssetStore";
import { useLibraryStore, type RecipeIntent } from "@/store/useLibraryStore";
import { planStats, plansFor } from "@/lib/library/plans";
import { AssetPlanDialog } from "./AssetPlanDialog";
import { knowledgeBoards, type KnowledgeMetrics } from "@/lib/library/knowledge/knowledge";
import { knowledgeDefinition, knowledgeForFamily } from "@/lib/library/knowledge/catalog";
import { categoryLabel } from "@/lib/library/taxonomy";
import type { KnowledgeTargets } from "@/types/library";

const FACETS: { key: keyof KnowledgeTargets; label: string }[] = [
  { key: "assets", label: "Assets" },
  { key: "recipes", label: "Recipes" },
  { key: "materials", label: "Materials" },
  { key: "lighting", label: "Lighting" },
  { key: "plants", label: "Plants" },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

interface CardProps {
  m: KnowledgeMetrics;
  onNavigate?: (tab: "browse" | "recipes", intent?: RecipeIntent) => void;
}

function KnowledgeCard({ m, onNavigate }: CardProps) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { act, needs, plans, proposeRecipe } = useLibraryStore();
  const catalog = useAssetStore((s) => s.catalog);
  const [planning, setPlanning] = useState<{ planId?: string } | null>(null);
  const [proposing, setProposing] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const { need, progress } = m;
  const def = knowledgeDefinition(need.id);
  const children = needs.filter((n) => knowledgeForFamily(n.category, n.styleTags)[0]?.id === need.id);
  const ignore = async (status: "open" | "ignored") => setError((await act(adminEmail, { action: "setKnowledgeStatus", id: need.id, status })) ?? "");
  /** Asks the AI for a recipe draft, then opens the Recipes tab on it. With `blankOnFailure` a failed draft opens the blank form instead. */
  const openRecipe = async (blankOnFailure: boolean) => {
    setProposing(true);
    setError("");
    const result = await proposeRecipe(adminEmail, need.id);
    setProposing(false);
    const intent = { knowledgeId: need.id, title: need.title, nonce: Date.now() };
    if (!("error" in result)) return onNavigate?.("recipes", { ...intent, ...result });
    if (blankOnFailure) return onNavigate?.("recipes", { ...intent, notice: `AI proposal unavailable (${result.error}) — blank form opened.` });
    setError(result.error);
  };
  const mine = plansFor(plans, { knowledgeId: need.id });
  const stats = planStats(mine, catalog);

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 items-start gap-1.5 text-left">
          {open ? <ChevronDown size={13} className="mt-0.5 shrink-0 text-neutral-500" /> : <ChevronRight size={13} className="mt-0.5 shrink-0 text-neutral-500" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-neutral-100">{need.title}</span>
            <span className="block text-[11px] text-neutral-500">
              {need.requestCount} request{need.requestCount === 1 ? "" : "s"}
              {m.recentCount > 0 && <span className="text-sky-300"> · +{m.recentCount} recent</span>}
              <span> · last {date(need.lastSeen)}</span>
            </span>
          </span>
        </button>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-medium text-neutral-300">Completion {pct(m.completion)}</p>
          <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-amber-400/80" style={{ width: pct(m.completion) }} />
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          onClick={() => setPlanning({})}
          title="Have the AI plan a pack of reusable assets for this knowledge area, then generate them natively one by one"
          className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/25"
        >
          <Sparkles size={12} /> Generate Assets
        </button>
        {mine.length > 0 && (
          <button onClick={() => setPlanning({ planId: mine[0].id })} className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-neutral-200">
            View Plan
          </button>
        )}
        <button
          onClick={() => void openRecipe(false)}
          disabled={proposing}
          title="Have the AI draft a recipe for this need. You review and edit it before saving; it is saved as Proposed."
          className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/25 disabled:cursor-wait disabled:opacity-60"
        >
          {proposing ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />} {proposing ? "Generating recipe…" : "Generate Recipe"}
        </button>
        <button onClick={() => onNavigate?.("browse")} className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25">
          <Search size={12} /> Find Assets
        </button>
        <button onClick={() => void openRecipe(true)} disabled={proposing} className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25 disabled:cursor-wait disabled:opacity-60">
          <Plus size={12} /> Add Recipe
        </button>
        <button onClick={() => ignore(need.status === "ignored" ? "open" : "ignored")} className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-neutral-200">
          {need.status === "ignored" ? <RotateCcw size={12} /> : <EyeOff size={12} />}
          {need.status === "ignored" ? "Restore" : "Ignore"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
      <p className="mt-2 text-[11px] text-neutral-500">
        Recipes <span className="text-neutral-300">{progress.facets.recipes.have}/{progress.facets.recipes.target}</span> · Assets planned <span className="text-neutral-300">{stats.planned}</span> · Assets approved <span className="text-neutral-300">{stats.approved}</span> · Missing assets <span className="text-neutral-300">{stats.missing}</span> · Completion <span className="font-medium text-neutral-300">{pct(m.completion)}</span>
      </p>
      {planning && <AssetPlanDialog key={planning.planId ?? need.id} target={{ knowledgeId: need.id, title: need.title }} planId={planning.planId} onClose={() => setPlanning(null)} />}

      {open && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-white/5 pt-3">
          <div className="grid grid-cols-5 gap-2">
            {FACETS.filter((f) => progress.facets[f.key].target > 0).map(({ key, label }) => (
              <div key={key} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                <p className="text-[10px] text-neutral-600">{label}</p>
                <p className="text-xs font-medium text-neutral-200">
                  {progress.facets[key].have}
                  <span className="text-neutral-600"> / {progress.facets[key].target}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500">
            Confidence {pct(m.confidence)} · Priority {m.priority.toFixed(1)} · Areas: {need.areas.join(", ")}
            {need.styles.length > 0 && <> · Styles: {need.styles.join(", ")}</>}
            {need.scales.length > 0 && <> · Scales: {need.scales.join(", ")}</>}
            {need.environments.length > 0 && <> · Environments: {need.environments.join(", ")}</>}
          </p>
          {def && def.families.length > 0 && (
            <p className="text-[11px] text-neutral-500">Contains: {def.families.map(categoryLabel).join(", ")}</p>
          )}
          {(() => {
            const spaces = [...new Set(need.projectExamples.flatMap((ex) => ex.areas.flatMap((a) => (a.space ? [a.space.replace(/-/g, " ")] : []))))];
            return spaces.length > 0 ? <p className="text-[11px] text-neutral-500">Outdoor spaces that exposed it: {spaces.join(", ")}</p> : null;
          })()}
          {children.length > 0 && (
            <p className="text-[11px] text-neutral-500">Object needs: {children.map((c) => `${c.title} (${c.requestedCount}×)`).join(", ")}</p>
          )}
          {need.projectExamples.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-600">Recent examples</p>
              {need.projectExamples.slice(-3).reverse().map((ex) => (
                <p key={ex.at} className="text-[11px] text-neutral-500">
                  {date(ex.at)} — {ex.brief ? `“${ex.brief}”` : "no brief"}
                  <span className="text-neutral-600"> · {ex.areas.map((a) => `${a.area} ${a.score.toFixed(2)}`).join(", ")}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Board({ title, hint, items, onNavigate }: { title: string; hint: string; items: KnowledgeMetrics[]; onNavigate?: CardProps["onNavigate"] }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-xs font-semibold text-neutral-200">{title}</h3>
        <p className="text-[10px] text-neutral-600">{hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/8 px-3 py-3 text-[11px] text-neutral-600">Nothing here yet.</p>
      ) : (
        items.map((m) => <KnowledgeCard key={m.need.id} m={m} onNavigate={onNavigate} />)
      )}
    </section>
  );
}

/** The Learn page's control center: which design knowledge generation keeps missing, ranked four ways. */
export function KnowledgeControlCenter({ onNavigate }: { onNavigate?: CardProps["onNavigate"] }) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const catalog = useAssetStore((s) => s.catalog);
  const { knowledge, recipes, loaded, error, refresh } = useLibraryStore();

  useEffect(() => {
    void refresh(adminEmail);
  }, [adminEmail, refresh]);

  const boards = useMemo(() => knowledgeBoards(knowledge, { assets: catalog, recipes }), [knowledge, catalog, recipes]);
  const ignored = knowledge.filter((k) => k.status === "ignored").length;

  if (error) return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>;
  if (loaded && knowledge.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/8 px-4 py-5 text-center">
        <p className="text-sm text-neutral-400">No knowledge gaps recorded yet</p>
        <p className="mx-auto mt-1 max-w-md text-[11px] text-neutral-600">
          Each generation scores its roofs, outdoor living, landscape, pool, arrival and other areas. Weak ones show up here as the design knowledge to build next.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Board title="Highest Impact Missing Knowledge" hint="Demand × how badly designs fall short × what is still missing" items={boards.highestImpact} onNavigate={onNavigate} />
      <Board title="Most Requested Knowledge" hint="Total generations that exposed the gap" items={boards.mostRequested} onNavigate={onNavigate} />
      <Board title="Recently Growing Needs" hint="Requests in the last 14 days" items={boards.recentlyGrowing} onNavigate={onNavigate} />
      <Board title="Needs Close To Completion" hint="Half done or better — a few more assets and recipes finish them" items={boards.closeToCompletion} onNavigate={onNavigate} />
      {ignored > 0 && <p className="text-[10px] text-neutral-700">{ignored} ignored need{ignored === 1 ? "" : "s"} hidden.</p>}
    </div>
  );
}
