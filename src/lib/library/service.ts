import { inferSiteHints } from "@/lib/house/siteSettings";
import { inferScaleFromBrief } from "@/lib/house/scale";
import type { AssetSpec } from "@/lib/assets/native/spec";
import { buildPlannedAssetRequest, PROVIDERS } from "@/lib/assetGeneration/providers";
import type { AssetGenerationProvider } from "@/lib/assetGeneration/types";
import type { AssetPlan, AssetRequest, DesignRecipe, KnowledgeNeed, KnowledgeStatus, Need, NeedStatus, PlannedAsset } from "@/types/library";
import { matchKnowledge } from "./knowledge/catalog";
import { detectKnowledgeSignals, recordKnowledgeSignal } from "./knowledge/knowledge";
import { canTransition, recordRequest } from "./needs";
import { byGenerationOrder, createPlan, updatePlan, type PlanInput } from "./plans";
import { createRecipe, recordRecipeUse, setRecipeApproval, updateRecipe, type RecipeInput } from "./recipes";
import { requestsFromProject } from "./requests";
import { findRecipes, resolveAsset, type AssetIndexEntry } from "./retrieval";
import { extractStyleTags } from "./taxonomy";
import { retrieveRecipes, type RetrievedRecipe } from "./spaceRecipes";
import type { OutdoorSpace } from "@/lib/outdoor/spaces";
import { mutateLibrary, readLibrary, type LibraryDoc } from "./store";

/** Server-side library operations used by generation and the admin API. Everything here is best-effort for generation callers: see `safely`. */

/** Library problems must never fail or slow a generation: log and carry on. */
export async function safely<T>(label: string, work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (err) {
    console.warn(`[library] ${label} failed:`, err instanceof Error ? err.message : err);
    return fallback;
  }
}

/**
 * Approved recipes worth leaning on for this brief, best first. Empty when none fit (or the library is unreachable).
 * Retrieval order is Knowledge → Recipes: a recipe filed under a Knowledge Need the brief speaks to
 * ("Mediterranean Roof Collection" for a Tuscan villa) outranks an equally good recipe that is not.
 */
export function recipesForBrief(brief: string, limit = 3): Promise<DesignRecipe[]> {
  return safely("recipe lookup", async () => {
    const { recipes } = await readLibrary();
    if (recipes.length === 0) return [];
    const hints = inferSiteHints(brief);
    const styles = extractStyleTags(brief);
    const query = { styleTags: styles, scale: inferScaleFromBrief(brief), environment: hints.environment };
    const knowledgeIds = matchKnowledge({ brief, styles, environment: hints.environment }).map((d) => d.id);
    const filed = (r: DesignRecipe) => (r.knowledgeIds?.some((id) => knowledgeIds.includes(id)) ? 1 : 0);
    return findRecipes(recipes, query, recipes.length)
      .sort((a, b) => filed(b.item) - filed(a.item) || b.score - a.score)
      .slice(0, limit)
      .map((s) => s.item);
  }, []);
}

/**
 * The approved recipes generation should lean on, retrieved per outdoor space (each space asks for the recipes that describe how
 * to build it), plus a couple for what no space covers. Every pick carries the reason it was chosen. Empty when none fit or the
 * library is unreachable — a library problem never blocks generation (see `safely`).
 */
export function recipesForSpaces(brief: string, spaces: readonly OutdoorSpace[]): Promise<RetrievedRecipe[]> {
  return safely("recipe lookup", async () => {
    const { recipes } = await readLibrary();
    if (recipes.length === 0) return [];
    return retrieveRecipes(recipes, spaces, { brief, styles: extractStyleTags(brief), scale: inferScaleFromBrief(brief), environment: inferSiteHints(brief).environment });
  }, []);
}

/** Notes that generation used these recipes (`pending`), and later how it turned out. */
export function noteRecipeOutcome(ids: readonly string[], outcome: "pending" | "success" | "failure"): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return safely("recipe outcome", () =>
    mutateLibrary((s) => ({
      put: s.recipes.filter((r) => ids.includes(r.id)).map((r) => ({ kind: "recipe" as const, data: recordRecipeUse(r, outcome) })),
      result: undefined,
    })), undefined);
}

/**
 * After a design is built: for each reusable object it asks for, keep the procedural version (already in the
 * project) and — unless an approved library asset already fits — count the request against a Need.
 * Returns the requests that had no suitable asset.
 *
 * Generation no longer calls this: `runPostGeneration` (generationLoop) records the same requests, plus each outdoor space's
 * missing components, in one transaction with everything else. It stays as the standalone, brief-and-buildings-only recorder.
 */
export function recordMissingAssetNeeds(json: string, brief: string, projectId: string | null, library: readonly AssetIndexEntry[]): Promise<AssetRequest[]> {
  return safely("need recording", async () => {
    const missing = requestsFromProject(json, brief, projectId).filter((req) => resolveAsset(library, req).kind === "fallback");
    if (missing.length === 0) return [];
    await mutateLibrary((s) => {
      const needs = [...s.needs];
      const touched = new Map<string, Need>();
      for (const req of missing) {
        const next = recordRequest(needs, req);
        const at = needs.findIndex((n) => n.id === next.id);
        if (at >= 0) needs[at] = next;
        else needs.push(next);
        touched.set(next.id, next);
      }
      return { put: [...touched.values()].map((data) => ({ kind: "need" as const, data })), result: undefined };
    });
    return missing;
  }, []);
}

/**
 * After a design is built: scores its design areas and, for each weak one, creates or increments the Knowledge
 * Need it belongs to ("Luxury Outdoor Living", not "Gazebo"). Best-effort like every other library write.
 * Returns the ids of the Knowledge Needs that were touched.
 *
 * Superseded in the generation path by `runPostGeneration` (which also scores outdoor spaces and reports failures); kept as the
 * standalone area-only recorder.
 */
export function recordKnowledgeNeeds(json: string, brief: string, projectId: string | null, library: readonly AssetIndexEntry[]): Promise<string[]> {
  return safely("knowledge recording", async () => {
    const signals = detectKnowledgeSignals(json, brief, projectId, library);
    if (signals.length === 0) return [];
    await mutateLibrary((s) => {
      const put = signals.map((signal) => ({ kind: "knowledge" as const, data: recordKnowledgeSignal(s.knowledge.find((k) => k.id === signal.knowledgeId), signal) }));
      return { put, result: undefined };
    });
    return signals.map((s) => s.knowledgeId);
  }, []);
}

// ── Admin operations ────────────────────────────────────────────────────────

export type AdminResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export function setNeedStatus(id: string, status: NeedStatus, assetId?: string): Promise<AdminResult<Need>> {
  return mutateLibrary<AdminResult<Need>>((s) => {
    const need = s.needs.find((n) => n.id === id);
    if (!need) return { result: { ok: false, status: 404, error: "Need not found." } };
    if (!canTransition(need.status, status)) return { result: { ok: false, status: 409, error: `A ${need.status} need can't move to ${status}.` } };
    const next: Need = { ...need, status, assetId: assetId ?? need.assetId };
    return { put: [{ kind: "need", data: next }], result: { ok: true, value: next } };
  });
}

export function saveRecipe(input: RecipeInput, id?: string, opts: { approve?: boolean } = {}): Promise<AdminResult<DesignRecipe>> {
  return mutateLibrary<AdminResult<DesignRecipe>>((s) => {
    const existing = id ? s.recipes.find((r) => r.id === id) : undefined;
    if (id && !existing) return { result: { ok: false, status: 404, error: "Recipe not found." } };
    // Without an id this always creates a new "proposed" recipe; it never replaces another one. An admin who has reviewed the
    // draft can save and approve in one step; nothing else ever approves a recipe.
    const written = existing ? updateRecipe(existing, input) : createRecipe(input);
    const saved = opts.approve ? setRecipeApproval(written, "approved") : written;
    const put: LibraryDoc[] = [{ kind: "recipe", data: saved }];
    // Filing a recipe under a Knowledge Need also lists it there, in the same write.
    for (const knowledgeId of saved.knowledgeIds ?? []) {
      const need = s.knowledge.find((k) => k.id === knowledgeId);
      if (need && !need.recipeIds.includes(saved.id)) put.push({ kind: "knowledge", data: { ...need, recipeIds: [...need.recipeIds, saved.id] } });
    }
    return { put, result: { ok: true, value: saved } };
  });
}

export function changeRecipeApproval(id: string, approval: DesignRecipe["approval"]): Promise<AdminResult<DesignRecipe>> {
  return mutateLibrary<AdminResult<DesignRecipe>>((s) => {
    const existing = s.recipes.find((r) => r.id === id);
    if (!existing) return { result: { ok: false, status: 404, error: "Recipe not found." } };
    const next = setRecipeApproval(existing, approval);
    return { put: [{ kind: "recipe", data: next }], result: { ok: true, value: next } };
  });
}

export function deleteRecipe(id: string): Promise<AdminResult<null>> {
  return mutateLibrary<AdminResult<null>>((s) => {
    if (!s.recipes.some((r) => r.id === id)) return { result: { ok: false, status: 404, error: "Recipe not found." } };
    return { remove: [{ kind: "recipe", id }], result: { ok: true, value: null } };
  });
}

export function setKnowledgeStatus(id: string, status: KnowledgeStatus): Promise<AdminResult<KnowledgeNeed>> {
  return mutateLibrary<AdminResult<KnowledgeNeed>>((s) => {
    const need = s.knowledge.find((k) => k.id === id);
    if (!need) return { result: { ok: false, status: 404, error: "Knowledge need not found." } };
    const next: KnowledgeNeed = { ...need, status };
    return { put: [{ kind: "knowledge", data: next }], result: { ok: true, value: next } };
  });
}

/** Files a curated asset or recipe under a Knowledge Need (or takes it back out). Recipes are validated here; assets live client-side, so their id is taken as given. */
export function linkKnowledge(id: string, link: { kind: "asset" | "recipe"; targetId: string; linked: boolean }): Promise<AdminResult<KnowledgeNeed>> {
  return mutateLibrary<AdminResult<KnowledgeNeed>>((s) => {
    const need = s.knowledge.find((k) => k.id === id);
    if (!need) return { result: { ok: false, status: 404, error: "Knowledge need not found." } };
    const put: LibraryDoc[] = [];
    if (link.kind === "recipe") {
      const recipe = s.recipes.find((r) => r.id === link.targetId);
      if (!recipe) return { result: { ok: false, status: 404, error: "Recipe not found." } };
      const ids = new Set(recipe.knowledgeIds ?? []);
      if (link.linked) ids.add(id);
      else ids.delete(id);
      put.push({ kind: "recipe", data: { ...recipe, knowledgeIds: [...ids] } });
    }
    const key = link.kind === "asset" ? "assetIds" : "recipeIds";
    const ids = new Set(need[key]);
    if (link.linked) ids.add(link.targetId);
    else ids.delete(link.targetId);
    const next: KnowledgeNeed = { ...need, [key]: [...ids] };
    put.push({ kind: "knowledge", data: next });
    return { put, result: { ok: true, value: next } };
  });
}

// ── Asset plans ─────────────────────────────────────────────────────────────

/** Changes one planned asset inside one plan; the store write is a single transaction. */
function withPlannedAsset<T>(planId: string, assetId: string, change: (asset: PlannedAsset, plan: AssetPlan) => { asset: PlannedAsset; result: T } | AdminResult<never>) {
  return mutateLibrary<AdminResult<T>>((s) => {
    const plan = s.plans.find((p) => p.id === planId);
    const asset = plan?.assets.find((a) => a.id === assetId);
    if (!plan || !asset) return { result: { ok: false, status: 404, error: "Planned asset not found." } };
    const out = change(asset, plan);
    if ("ok" in out) return { result: out };
    const next: AssetPlan = { ...plan, assets: plan.assets.map((a) => (a.id === assetId ? out.asset : a)), updated_at: new Date().toISOString() };
    return { put: [{ kind: "plan", data: next }], result: { ok: true, value: out.result } };
  });
}

/** Creates a plan, or (with an id) updates the one already saved: title, status and the admin's edits to its assets. Never creates twice. */
export function savePlan(input: PlanInput): Promise<AdminResult<AssetPlan>> {
  return mutateLibrary<AdminResult<AssetPlan>>((s) => {
    if (input.needId && !s.needs.some((n) => n.id === input.needId)) return { result: { ok: false, status: 404, error: "Need not found." } };
    const existing = input.id ? s.plans.find((p) => p.id === input.id) : undefined;
    if (input.id && !existing) return { result: { ok: false, status: 404, error: "Plan not found." } };
    const saved = existing ? updatePlan(existing, input) : createPlan(input);
    return { put: [{ kind: "plan", data: saved }], result: { ok: true, value: saved } };
  });
}

export function deletePlan(id: string): Promise<AdminResult<null>> {
  return mutateLibrary<AdminResult<null>>((s) => {
    if (!s.plans.some((p) => p.id === id)) return { result: { ok: false, status: 404, error: "Plan not found." } };
    return { remove: [{ kind: "plan", id }], result: { ok: true, value: null } };
  });
}

/**
 * Records that an asset produced for a planned asset reached the library (called when the admin approves it), and rolls that up:
 * the component it supplies leaves its Asset Need's missing list, the Need moves to "generating" on the first one, and to
 * "approved" once every required asset of its plans is in the library — so the Need's completion follows the admin's work.
 */
export function completePlannedAsset(planId: string, plannedAssetId: string, assetId: string): Promise<AdminResult<null>> {
  return mutateLibrary<AdminResult<null>>((s) => {
    const plan = s.plans.find((p) => p.id === planId);
    const asset = plan?.assets.find((a) => a.id === plannedAssetId);
    if (!plan || !asset) return { result: { ok: false, status: 404, error: "Planned asset not found." } };
    const at = new Date().toISOString();
    const next: AssetPlan = { ...plan, assets: plan.assets.map((a) => (a.id === plannedAssetId ? { ...a, generated: true, assetId, spec: undefined } : a)), updated_at: at };
    const put: LibraryDoc[] = [{ kind: "plan", data: next }];

    const need = plan.needId ? s.needs.find((n) => n.id === plan.needId) : undefined;
    if (need && need.status !== "ignored") {
      const mine = s.plans.map((p) => (p.id === planId ? next : p)).filter((p) => p.needId === need.id);
      const required = mine.flatMap((p) => p.assets).filter((a) => a.priority === "required");
      const allRequiredDone = required.length > 0 && required.every((a) => a.generated);
      const component = asset.tags.find((t) => t.startsWith("component:"))?.slice("component:".length);
      const status: NeedStatus = allRequiredDone ? "approved" : need.status === "needed" ? "generating" : need.status;
      put.push({
        kind: "need",
        data: { ...need, status, ...(allRequiredDone ? { assetId } : {}), ...(component && need.components ? { components: need.components.filter((c) => c !== component) } : {}) },
      });
    }
    return { put, result: { ok: true, value: null } };
  });
}

/** The native generator's output for a planned asset: a spec awaiting review, or a verdict that it needs an external provider. */
export function saveNativeSpec(planId: string, plannedAssetId: string, outcome: { spec: AssetSpec } | { route: "external-generation-recommended" }) {
  return withPlannedAsset(planId, plannedAssetId, (a) => ({ asset: "spec" in outcome ? { ...a, spec: outcome.spec, route: "native" as const } : { ...a, spec: undefined, route: outcome.route }, result: null }));
}

/** Rejecting a native draft discards the spec; the planned asset itself stays. */
export function discardNativeSpec(planId: string, plannedAssetId: string) {
  return withPlannedAsset(planId, plannedAssetId, (a) => ({ asset: { ...a, spec: undefined }, result: null }));
}

/**
 * Sends approved, not-yet-generated assets to an external provider (the fallback for objects the native generator cannot
 * make), highest reuse first. Native-route assets are skipped: those go through the native generator.
 */
export async function generateExternal(planId: string, assetIds: readonly string[] | undefined, providers: readonly AssetGenerationProvider[] = PROVIDERS): Promise<AdminResult<{ submitted: string[]; failed: { id: string; error: string }[] }>> {
  const provider = providers.find((p) => p.isConfigured());
  if (!provider) return { ok: false, status: 409, error: "No external 3D provider is configured. Native assets can still be generated." };
  const { plans } = await readLibrary();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return { ok: false, status: 404, error: "Plan not found." };
  const todo = plan.assets
    .filter((a) => a.approved && !a.generated && !a.job && a.route === "external-generation-recommended" && (!assetIds || assetIds.includes(a.id)))
    .sort(byGenerationOrder);
  const submitted: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const asset of todo) {
    try {
      const job = await provider.submit(buildPlannedAssetRequest(plan, asset));
      const noted = await withPlannedAsset(planId, asset.id, (a) => ({ asset: { ...a, job: { ...job, submittedAt: new Date().toISOString() } }, result: null }));
      if (noted.ok) submitted.push(asset.id);
    } catch (err) {
      failed.push({ id: asset.id, error: err instanceof Error ? err.message : "Submission failed." });
    }
  }
  return { ok: true, value: { submitted, failed } };
}
