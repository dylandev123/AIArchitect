import { inferSiteHints } from "@/lib/house/siteSettings";
import { inferScaleFromBrief } from "@/lib/house/scale";
import type { AssetRequest, DesignRecipe, Need, NeedStatus } from "@/types/library";
import { canTransition, recordRequest } from "./needs";
import { createRecipe, recordRecipeUse, setRecipeApproval, updateRecipe, type RecipeInput } from "./recipes";
import { requestsFromProject } from "./requests";
import { findRecipes, resolveAsset, type AssetIndexEntry } from "./retrieval";
import { extractStyleTags } from "./taxonomy";
import { mutateLibrary, readLibrary } from "./store";

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

/** Approved recipes worth leaning on for this brief, best first. Empty when none fit (or the library is unreachable). */
export function recipesForBrief(brief: string, limit = 3): Promise<DesignRecipe[]> {
  return safely("recipe lookup", async () => {
    const { recipes } = await readLibrary();
    if (recipes.length === 0) return [];
    const hints = inferSiteHints(brief);
    const query = { styleTags: extractStyleTags(brief), scale: inferScaleFromBrief(brief), environment: hints.environment };
    return findRecipes(recipes, query, limit).map((s) => s.item);
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

export function saveRecipe(input: RecipeInput, id?: string): Promise<AdminResult<DesignRecipe>> {
  return mutateLibrary<AdminResult<DesignRecipe>>((s) => {
    if (!id) {
      const created = createRecipe(input);
      return { put: [{ kind: "recipe", data: created }], result: { ok: true, value: created } };
    }
    const existing = s.recipes.find((r) => r.id === id);
    if (!existing) return { result: { ok: false, status: 404, error: "Recipe not found." } };
    const updated = updateRecipe(existing, input);
    return { put: [{ kind: "recipe", data: updated }], result: { ok: true, value: updated } };
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
