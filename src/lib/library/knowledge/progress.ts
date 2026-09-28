import type { CuratedAsset } from "@/types/assets";
import type { DesignRecipe, KnowledgeNeed, KnowledgeTargets } from "@/types/library";
import type { AssetIndexEntry } from "../retrieval";
import { knowledgeDefinition, type KnowledgeDefinition } from "./catalog";

/**
 * How complete a Knowledge Need is: what the library holds against what the need wants. Kept apart from detection so the area
 * scorer (which asks "is the library already enough for this?") and the control center (which shows the same answer) read one
 * definition of "enough".
 */

/** The part of an asset completion reads. A `CuratedAsset` satisfies it; so does a retrieval index entry, via `factsFromIndex`. */
export type AssetFact = Pick<CuratedAsset, "id" | "type" | "family" | "styleTags" | "status" | "scope" | "supersededBy" | "knowledgeIds"> & { validation?: { passed: boolean } };

/** What the library holds, as far as completion cares. Assets live in the admin's browser, recipes on the server, so this is assembled where both are known. */
export interface KnowledgeFacts {
  assets: readonly AssetFact[];
  recipes: readonly DesignRecipe[];
}

/**
 * The server sees approved, validated object assets only through the index the client sends with a generation request; every
 * entry in it is retrievable by definition. Materials are not in it, so completion computed from it must skip that facet.
 */
export function factsFromIndex(library: readonly AssetIndexEntry[]): AssetFact[] {
  return library.map((a) => ({ id: a.id, type: "glb-model" as const, family: a.family, styleTags: a.styleTags, status: "approved" as const, validation: { passed: true } }));
}

export interface FacetProgress {
  have: number;
  target: number;
}

export interface KnowledgeProgress {
  facets: Record<keyof KnowledgeTargets, FacetProgress>;
  /** Ids of the approved assets / recipes counted, for "related assets/recipes". */
  assetIds: string[];
  recipeIds: string[];
  /** 0…1: mean fill of every tracked facet. */
  completion: number;
}

const styleFits = (def: KnowledgeDefinition, tags: readonly string[] | undefined): boolean =>
  !def.styles || def.styles.length === 0 || !tags || tags.length === 0 || tags.some((t) => def.styles!.includes(t));

/**
 * An approved asset that could be used at all: a GLB must have a validated file behind it. An older version that a newer one
 * replaced is not counted a second time (an upgrade is the same asset, not more coverage).
 */
const usable = (a: AssetFact) => a.status === "approved" && !a.supersededBy && a.scope !== "project" && (a.type !== "glb-model" || a.validation?.passed === true);

export function knowledgeProgress(need: Pick<KnowledgeNeed, "id" | "assetIds" | "recipeIds">, facts: KnowledgeFacts, opts: { ignore?: readonly (keyof KnowledgeTargets)[] } = {}): KnowledgeProgress {
  const def = knowledgeDefinition(need.id);
  const facets = { assets: 0, recipes: 0, materials: 0, lighting: 0, plants: 0 };
  const assetIds: string[] = [];
  for (const a of facts.assets) {
    if (!usable(a)) continue;
    const linked = need.assetIds.includes(a.id) || !!a.knowledgeIds?.includes(need.id);
    const isMaterial = a.type === "pbr-material";
    const byFamily = !!def && !!a.family && def.families.includes(a.family) && styleFits(def, a.styleTags);
    if (!linked && !byFamily) continue;
    assetIds.push(a.id);
    if (isMaterial) facets.materials++;
    else if (a.family === "light") facets.lighting++;
    else if (a.family === "vegetation") facets.plants++;
    else facets.assets++;
  }
  const recipeIds: string[] = [];
  for (const r of facts.recipes) {
    if (r.approval !== "approved") continue;
    const linked = need.recipeIds.includes(r.id) || !!r.knowledgeIds?.includes(need.id);
    const byCategory = !!def && def.recipeCategories.includes(r.category) && styleFits(def, r.styleTags);
    if (!linked && !byCategory) continue;
    recipeIds.push(r.id);
    facets.recipes++;
  }
  const targets = def?.targets ?? { assets: 10, recipes: 3, materials: 0, lighting: 0, plants: 0 };
  const keys = Object.keys(facets) as (keyof KnowledgeTargets)[];
  const out = Object.fromEntries(keys.map((k) => [k, { have: facets[k], target: targets[k] }])) as KnowledgeProgress["facets"];
  const tracked = keys.filter((k) => targets[k] > 0 && !opts.ignore?.includes(k));
  const completion = tracked.length === 0 ? 0 : tracked.reduce((sum, k) => sum + Math.min(1, facets[k] / targets[k]), 0) / tracked.length;
  return { facets: out, assetIds, recipeIds, completion };
}
