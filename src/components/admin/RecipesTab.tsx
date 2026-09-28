"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Trash2, Pencil, Plus, Archive, Sparkles, LoaderCircle } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useLibraryStore, type RecipeIntent } from "@/store/useLibraryStore";
import { PROJECT_SCALES } from "@/lib/house/scale";
import { formatParameterLines, formatRelationshipLines, parseParameterLines, parseRelationshipLines, recipeInputSchema, type RecipeInput } from "@/lib/library/recipes";
import { RECIPE_APPROVALS, RECIPE_CATEGORIES, type DesignRecipe, type RecipeApproval } from "@/types/library";
import type { ProjectScale, SiteEnvironment } from "@/types/house";

const ENVIRONMENTS: SiteEnvironment[] = ["countryside", "beach", "cliff", "hillside", "farm", "forest", "suburban", "urban"];

const APPROVAL_STYLE: Record<RecipeApproval, string> = {
  proposed: "bg-violet-500/15 text-violet-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/10 text-red-400",
  archived: "bg-white/5 text-neutral-500",
};

const inputCls = "w-full rounded-lg border border-white/8 bg-neutral-800/60 px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/40";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Chips<T extends string>({ all, on, onToggle }: { all: readonly T[]; on: T[]; onToggle: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onToggle(v)}
          className={`rounded-md px-2 py-1 text-[11px] transition ${on.includes(v) ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-neutral-500 hover:text-neutral-300"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

interface RecipeFormProps {
  /** Editing this saved recipe. */
  recipe?: DesignRecipe;
  /** Prefill for a new recipe (an AI draft); nothing is saved until the admin submits. */
  draft?: RecipeInput;
  /** Files a new recipe under this Knowledge Need on save. */
  knowledgeId?: string;
  aiProposed?: boolean;
  /** Notes shown above the form: what validation adjusted, or why the form is blank. */
  notes?: string[];
  onRegenerate?: () => Promise<void>;
  /** `approve` saves it approved in one step, for a draft the admin has just reviewed. */
  onSave: (input: RecipeInput, approve?: boolean) => Promise<string | null>;
  onCancel: () => void;
}

function RecipeForm({ recipe, draft, knowledgeId, aiProposed, notes = [], onRegenerate, onSave, onCancel }: RecipeFormProps) {
  const src = recipe ?? draft;
  const [name, setName] = useState(src?.name ?? "");
  const [category, setCategory] = useState(src?.category ?? RECIPE_CATEGORIES[0]);
  const [styles, setStyles] = useState(src?.styleTags.join(", ") ?? "");
  const [scales, setScales] = useState<ProjectScale[]>(src?.compatibleScales ?? []);
  const [envs, setEnvs] = useState<SiteEnvironment[]>(src?.environmentTags ?? []);
  const [params, setParams] = useState(formatParameterLines(src?.parameters ?? []));
  const [rels, setRels] = useState(formatRelationshipLines(src?.relationships ?? []));
  const [guidance, setGuidance] = useState(src?.guidance.join("\n") ?? "");
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const knowledgeIds = recipe?.knowledgeIds ?? (knowledgeId ? [knowledgeId] : undefined);

  const submit = async (approve = false) => {
    const parsed = parseParameterLines(params);
    if (parsed.errors.length > 0) return setError(parsed.errors[0]);
    const result = recipeInputSchema.safeParse({
      name,
      category,
      styleTags: styles.split(",").map((s) => s.trim()).filter(Boolean),
      compatibleScales: scales,
      environmentTags: envs,
      parameters: parsed.params,
      relationships: parseRelationshipLines(rels),
      guidance: guidance.split("\n").map((g) => g.trim()).filter(Boolean),
      origin: recipe?.origin ?? draft?.origin ?? { kind: "admin" },
      ...(knowledgeIds && { knowledgeIds }),
    });
    if (!result.success) return setError(`${result.error.issues[0]?.path.join(".") || "recipe"}: ${result.error.issues[0]?.message}`);
    setSaving(true);
    setError((await onSave(result.data, approve)) ?? "");
    setSaving(false);
  };

  const regenerate = async () => {
    if (!window.confirm("Replace this draft with a new AI proposal? Your edits will be lost.")) return;
    setRegenerating(true);
    await onRegenerate?.();
    setRegenerating(false);
  };

  return (
    <div className={`flex flex-col gap-2.5 rounded-xl border bg-white/[0.02] p-3 ${aiProposed ? "border-violet-500/30" : "border-amber-500/20"}`}>
      {(aiProposed || notes.length > 0) && (
        <div className="flex flex-col gap-1 rounded-lg bg-violet-500/10 px-3 py-2">
          {aiProposed && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-violet-300">
              <Sparkles size={12} /> AI-proposed draft — review and edit before saving. It saves as Proposed; approval stays manual.
            </p>
          )}
          {notes.map((n) => <p key={n} className="text-[11px] text-violet-300/70">{n}</p>)}
        </div>
      )}
      <input className={inputCls} placeholder="Name — e.g. Caribbean Estate Hip 03" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          {RECIPE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={inputCls} placeholder="Style tags, comma separated (tropical, modern)" value={styles} onChange={(e) => setStyles(e.target.value)} />
      </div>
      <div><p className="mb-1 text-[11px] text-neutral-500">Compatible scales (none = any)</p><Chips all={PROJECT_SCALES} on={scales} onToggle={(v) => setScales(toggle(scales, v))} /></div>
      <div><p className="mb-1 text-[11px] text-neutral-500">Environments (none = any)</p><Chips all={ENVIRONMENTS} on={envs} onToggle={(v) => setEnvs(toggle(envs, v))} /></div>
      <div>
        <p className="mb-1 text-[11px] text-neutral-500">Parameters — one per line: <span className="font-mono">key: value [min..max] unit</span> or <span className="font-mono">key: hip {"{hip|gable}"}</span></p>
        <textarea className={`${inputCls} h-24 font-mono`} value={params} onChange={(e) => setParams(e.target.value)} placeholder={"pitch: 32 [28..36] deg\neaveOverhang: 1.2 [0.9..1.6] m\ncupola: false"} />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-neutral-500">Relationships — <span className="font-mono">requires|prefers|conflicts: target — note</span></p>
        <textarea className={`${inputCls} h-16 font-mono`} value={rels} onChange={(e) => setRels(e.target.value)} placeholder="prefers: pool-bar — within 6 m of the pool edge" />
      </div>
      <div>
        <p className="mb-1 text-[11px] text-neutral-500">Guidance for the generator — one rule per line</p>
        <textarea className={`${inputCls} h-16`} value={guidance} onChange={(e) => setGuidance(e.target.value)} placeholder="Deep eaves and a veranda roof on the view side" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => void submit()} disabled={saving} className="rounded-lg border border-amber-500/30 bg-amber-500/20 px-4 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50">
          {recipe ? "Save changes" : "Save as proposed"}
        </button>
        {!recipe && (
          <button onClick={() => void submit(true)} disabled={saving} title="Save and approve in one step: the next generation retrieves it" className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50">
            <CheckCircle size={12} /> Save & approve
          </button>
        )}
        {onRegenerate && (
          <button onClick={regenerate} disabled={regenerating || saving} className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50">
            {regenerating ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />} {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        )}
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300">Cancel</button>
      </div>
    </div>
  );
}

export function RecipesTab({ intent }: { intent?: RecipeIntent }) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { recipes, loaded, error, refresh, act, proposeRecipe } = useLibraryStore();
  const [filter, setFilter] = useState<RecipeApproval | "all">("all");
  const [editing, setEditing] = useState<DesignRecipe | "new" | null>(intent?.recipeId ? null : intent ? "new" : null);
  const [dismissedRecipeId, setDismissedRecipeId] = useState<string>();
  const [proposal, setProposal] = useState(intent?.recipe ? { recipe: intent.recipe, adjustments: intent.adjustments ?? [], nonce: 0 } : undefined);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void refresh(adminEmail);
  }, [adminEmail, refresh]);

  const shown = recipes.filter((r) => filter === "all" || r.approval === filter);
  const intendedRecipe = intent?.recipeId === dismissedRecipeId ? undefined : recipes.find((item) => item.id === intent?.recipeId);
  const activeEditing = intendedRecipe ?? editing;
  const run = async (action: Parameters<typeof act>[1]) => {
    const err = await act(adminEmail, action);
    setActionError(err ?? "");
    if (!err) setNotice(action.action === "setRecipeApproval" && action.approval === "approved" ? "Recipe approved" : "Recipe updated");
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {(["all", ...RECIPE_APPROVALS] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 text-[11px] capitalize transition ${filter === f ? "bg-neutral-700 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}>{f}</button>
        ))}
        <button onClick={() => { if (intent?.recipeId) setDismissedRecipeId(intent.recipeId); setEditing("new"); }} className="ml-auto flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-500/30">
          <Plus size={12} /> New recipe
        </button>
      </div>

      {(error || actionError) && <p className="shrink-0 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error || actionError}</p>}
      {notice && <p className="shrink-0 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">✓ {notice}</p>}

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3 pb-2">
          {activeEditing === "new" && (
            <RecipeForm
              key={proposal?.nonce ?? "blank"}
              draft={proposal?.recipe}
              knowledgeId={intent?.knowledgeId}
              aiProposed={!!proposal}
              notes={proposal ? [`For Knowledge Need: ${intent?.title}`, ...proposal.adjustments] : [intent?.notice, intent && `Filing under Knowledge Need: ${intent.title}`].filter((n): n is string => !!n)}
              onRegenerate={
                intent
                  ? async () => {
                      const result = await proposeRecipe(adminEmail, intent.knowledgeId, proposal ? [proposal.recipe.name] : undefined);
                      if ("error" in result) return setActionError(result.error);
                      setActionError("");
                      setProposal({ ...result, nonce: (proposal?.nonce ?? 0) + 1 });
                    }
                  : undefined
              }
              onCancel={() => { setEditing(null); setProposal(undefined); }}
              onSave={async (recipe, approve) => {
                const err = await act(adminEmail, { action: "saveRecipe", recipe, ...(approve ? { approve: true } : {}) });
                if (!err) { setEditing(null); setProposal(undefined); setNotice(approve ? "Recipe approved" : "Recipe proposed"); }
                return err;
              }}
            />
          )}
          {loaded && shown.length === 0 && activeEditing !== "new" && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm text-neutral-500">No recipes here</p>
              <p className="max-w-sm text-xs text-neutral-600">Recipes are reusable architectural logic — roof compositions, pool layouts, planting schemes. Approved ones guide every matching generation.</p>
            </div>
          )}
          {shown.map((r) =>
            activeEditing && activeEditing !== "new" && activeEditing.id === r.id ? (
              <RecipeForm
                key={r.id}
                recipe={r}
                onCancel={() => { if (intendedRecipe?.id === r.id) setDismissedRecipeId(r.id); setEditing(null); }}
                onSave={async (recipe) => {
                  const err = await act(adminEmail, { action: "saveRecipe", id: r.id, recipe });
                  if (!err) { setEditing(null); setNotice("Recipe updated"); }
                  return err;
                }}
              />
            ) : (
              <div key={r.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-100">{r.name} <span className="text-[10px] font-normal text-neutral-600">v{r.version}</span></p>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {r.category}
                      {r.styleTags.length > 0 && <> · {r.styleTags.join(", ")}</>}
                      {r.compatibleScales.length > 0 && <> · scales: {r.compatibleScales.join(", ")}</>}
                      {r.environmentTags.length > 0 && <> · {r.environmentTags.join(", ")}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${APPROVAL_STYLE[r.approval]}`}>{r.approval}</span>
                    <span className="text-[10px] text-neutral-600">used {r.usageCount} · ✓ {r.successCount} · ✗ {r.failureCount}</span>
                  </div>
                </div>
                {r.parameters.length > 0 && <pre className="mt-2 overflow-x-auto rounded-lg bg-white/[0.03] p-2 font-mono text-[10px] text-neutral-500">{formatParameterLines(r.parameters)}</pre>}
                {r.guidance.length > 0 && <ul className="mt-1.5 list-disc pl-4 text-[11px] text-neutral-500">{r.guidance.map((g) => <li key={g}>{g}</li>)}</ul>}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {r.approval !== "approved" && (
                    <button onClick={() => run({ action: "setRecipeApproval", id: r.id, approval: "approved" })} className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25"><CheckCircle size={12} /> Approve</button>
                  )}
                  {r.approval !== "rejected" && r.approval !== "archived" && (
                    <button onClick={() => run({ action: "setRecipeApproval", id: r.id, approval: r.approval === "approved" ? "archived" : "rejected" })} className="flex items-center gap-1.5 rounded-lg border border-red-500/15 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20">
                      {r.approval === "approved" ? <><Archive size={12} /> Archive</> : <><XCircle size={12} /> Reject</>}
                    </button>
                  )}
                  <button onClick={() => setEditing(r)} className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-neutral-200"><Pencil size={12} /> Edit</button>
                  <button onClick={() => { if (window.confirm(`Delete "${r.name}"? This cannot be undone.`)) void run({ action: "deleteRecipe", id: r.id }); }} className="ml-auto text-neutral-700 transition hover:text-red-400" title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
