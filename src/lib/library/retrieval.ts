import type { CuratedAsset } from "@/types/assets";
import type { AssetRequest, DesignRecipe, NeedDimensions, RecipeQuery, Scored } from "@/types/library";

/**
 * Retrieval for generation: rank approved library entries against what a project needs. A candidate is either a
 * close-enough match or excluded outright — an inappropriate asset (wrong family, clashing style, absurd size) is
 * never forced in; the caller falls back to the procedural version instead.
 */

export const MIN_ASSET_SCORE = 0.45;
export const MIN_RECIPE_SCORE = 0.45;
/** How far a request's size may be from an asset's before scaling it stops looking right. */
const SCALE_LIMITS = [0.5, 2] as const;

const overlap = (a: readonly string[], b: readonly string[]) => a.filter((t) => b.includes(t)).length;

/** The part of an asset that retrieval reads. This is also what the client sends to the server with a generation request. */
export type AssetIndexEntry = Pick<CuratedAsset, "id" | "family" | "styleTags" | "contextTags" | "dimensions" | "successCount" | "failureCount">;

/** Assets that can satisfy a global lookup: approved, a placeable object (not a material), and not project-local. */
export function isRetrievableAsset(a: CuratedAsset): boolean {
  if (a.status !== "approved" || a.family === undefined || a.scope === "project" || a.type === "pbr-material" || a.type === "hdri") return false;
  // A GLB only counts once it has a validated file behind it: an entry with nothing to render must not satisfy a request.
  return a.type !== "glb-model" || a.validation?.passed === true;
}

export function toAssetIndex(catalog: readonly CuratedAsset[]): AssetIndexEntry[] {
  return catalog.filter(isRetrievableAsset).map(({ id, family, styleTags, contextTags, dimensions, successCount, failureCount }) => ({ id, family, styleTags, contextTags, dimensions, successCount, failureCount }));
}

function dimensionFit(asset: NeedDimensions | undefined, want: NeedDimensions | undefined): { ok: boolean; bonus: number } {
  if (!asset || !want) return { ok: true, bonus: 0 };
  const ratios = (["width", "depth", "height"] as const)
    .map((k) => (asset[k] && want[k] ? want[k]! / asset[k]! : undefined))
    .filter((r): r is number => r !== undefined);
  if (ratios.length === 0) return { ok: true, bonus: 0 };
  if (ratios.some((r) => r < SCALE_LIMITS[0] || r > SCALE_LIMITS[1])) return { ok: false, bonus: 0 };
  const worst = Math.max(...ratios.map((r) => Math.abs(Math.log(r))));
  return { ok: true, bonus: 0.1 * (1 - worst / Math.log(SCALE_LIMITS[1])) };
}

/** Success history in [0,1], smoothed so an unproven entry sits at 0.5 instead of 0 or 1. */
const track = (e: { successCount?: number; failureCount?: number }) => ((e.successCount ?? 0) + 1) / ((e.successCount ?? 0) + (e.failureCount ?? 0) + 2);

type Wanted = Pick<AssetRequest, "category" | "styleTags" | "contextTags" | "dimensions">;

export function scoreAsset<T extends AssetIndexEntry>(asset: T, req: Wanted): Scored<T> | null {
  if (asset.family !== req.category) return null;
  const styles = asset.styleTags ?? [];
  const reasons = [`family ${asset.family}`];
  let score = 0.4;

  if (req.styleTags.length > 0 && styles.length > 0) {
    const shared = overlap(req.styleTags, styles);
    if (shared === 0) return null; // clearly a different look
    score += 0.3 * (shared / req.styleTags.length);
    reasons.push(`style ${req.styleTags.filter((t) => styles.includes(t)).join("/")}`);
  } else {
    score += 0.1; // unstyled on either side: compatible, but not a confirmed style match
  }

  const contexts = asset.contextTags ?? [];
  if (req.contextTags.length > 0 && contexts.length > 0) {
    if (overlap(req.contextTags, contexts) > 0) {
      score += 0.1;
      reasons.push("context");
    } else score -= 0.05;
  }

  const fit = dimensionFit(asset.dimensions, req.dimensions);
  if (!fit.ok) return null;
  score += fit.bonus;
  score += 0.1 * (track(asset) - 0.5);
  // An asset that keeps failing to load is demoted step by step until a better-behaved one (or the procedural version) wins.
  const netFailures = (asset.failureCount ?? 0) - (asset.successCount ?? 0);
  if (netFailures > 0) {
    score -= 0.08 * Math.min(netFailures, 5);
    reasons.push(`${netFailures} net load failure${netFailures > 1 ? "s" : ""}`);
  }
  return { item: asset, score, reasons };
}

/** Ranked approved assets that fit the request well enough to use, best first. */
export function findAssets<T extends AssetIndexEntry>(catalog: readonly T[], req: Wanted, limit = 3): Scored<T>[] {
  return catalog
    .map((a) => scoreAsset(a, req))
    .filter((s): s is Scored<T> => s !== null && s.score >= MIN_ASSET_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function scoreRecipe(recipe: DesignRecipe, q: RecipeQuery): Scored<DesignRecipe> | null {
  if (recipe.approval !== "approved") return null;
  if (q.category && recipe.category !== q.category) return null;
  const reasons: string[] = [];
  let score = 0.3;

  // A recipe that names scales/environments is only for those; one that names none suits any.
  if (q.scale && recipe.compatibleScales.length > 0) {
    if (!recipe.compatibleScales.includes(q.scale)) return null;
    score += 0.15;
    reasons.push(`scale ${q.scale}`);
  }
  if (q.environment && recipe.environmentTags.length > 0) {
    if (!recipe.environmentTags.includes(q.environment)) return null;
    score += 0.15;
    reasons.push(`environment ${q.environment}`);
  }
  const want = q.styleTags ?? [];
  if (want.length > 0 && recipe.styleTags.length > 0) {
    const shared = overlap(want, recipe.styleTags);
    if (shared === 0) return null;
    score += 0.3 * (shared / want.length);
    reasons.push(`style ${want.filter((t) => recipe.styleTags.includes(t)).join("/")}`);
  }
  score += 0.1 * track({ successCount: recipe.successCount, failureCount: recipe.failureCount });
  return { item: recipe, score, reasons };
}

export function findRecipes(recipes: readonly DesignRecipe[], q: RecipeQuery, limit = 3): Scored<DesignRecipe>[] {
  return recipes
    .map((r) => scoreRecipe(r, q))
    .filter((s): s is Scored<DesignRecipe> => s !== null && s.score >= MIN_RECIPE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * The asset that should stand in for a requested object, or `fallback` when the library has nothing suitable.
 * Generation never waits on this: "fallback" means "keep the procedural version and record a Need".
 */
export type AssetResolution<T extends AssetIndexEntry = AssetIndexEntry> =
  | { kind: "asset"; asset: T; score: number; reasons: string[] }
  | { kind: "fallback" };

export function resolveAsset<T extends AssetIndexEntry>(catalog: readonly T[], req: Wanted): AssetResolution<T> {
  const [best] = findAssets(catalog, req, 1);
  return best ? { kind: "asset", asset: best.item, score: best.score, reasons: best.reasons } : { kind: "fallback" };
}
