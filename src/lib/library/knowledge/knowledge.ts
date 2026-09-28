import { inferSiteHints } from "@/lib/house/siteSettings";
import { inferScaleFromBrief, isProjectScale } from "@/lib/house/scale";
import type { SiteEnvironment } from "@/types/house";
import type { CuratedAsset } from "@/types/assets";
import type { DesignRecipe, KnowledgeNeed, KnowledgeSignal, KnowledgeTargets } from "@/types/library";
import { styleTagsForProjectStyle } from "../requests";
import type { AssetIndexEntry } from "../retrieval";
import { extractStyleTags } from "../taxonomy";
import { knowledgeDefinition, pickKnowledge, type KnowledgeDefinition } from "./catalog";
import { scoreDesignAreas, weakAreas } from "./areas";

const MAX_PROJECT_EXAMPLES = 12;
const MAX_RECENT_REQUESTS = 60;
const BRIEF_EXCERPT = 140;
/** "Recently growing" looks at this many days back. */
export const GROWTH_WINDOW_DAYS = 14;

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

// ── Detection (generation side) ─────────────────────────────────────────────

/**
 * Scores the design's areas and turns each weak one into the Knowledge Need it belongs to. Several weak areas that
 * point at the same need (a bare terrace *and* empty furniture → Luxury Outdoor Living) become one signal, so a
 * single generation counts once per need. Empty when the JSON is unreadable or every area is well served.
 */
export function detectKnowledgeSignals(json: string, brief: string, projectId: string | null, library: readonly AssetIndexEntry[]): KnowledgeSignal[] {
  const weak = weakAreas(scoreDesignAreas(json, brief, library));
  if (weak.length === 0) return [];

  let root: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) root = parsed as Record<string, unknown>;
  } catch {
    /* scoreDesignAreas already returned [] for unreadable JSON */
  }
  const settings = typeof root.settings === "object" && root.settings !== null ? (root.settings as Record<string, unknown>) : {};
  const opts = typeof root.exteriorOptions === "object" && root.exteriorOptions !== null ? (root.exteriorOptions as Record<string, unknown>) : {};
  const styleKey = typeof opts.style === "string" ? opts.style : "";
  const styles = unique([...extractStyleTags(brief), ...styleTagsForProjectStyle(styleKey)]);
  const environment = (typeof settings.environment === "string" ? settings.environment : inferSiteHints(brief).environment) as SiteEnvironment | undefined;
  const scale = isProjectScale(settings.projectScale) ? settings.projectScale : inferScaleFromBrief(brief);
  // The style key ("caribbean-villa") can name a place the tag vocabulary folds away; keep it visible to keyword entries.
  const ctx = { brief: `${brief} ${styleKey.replace(/-/g, " ")}`, styles, environment };

  const byNeed = new Map<string, KnowledgeSignal>();
  for (const w of weak) {
    const def = pickKnowledge(w.area, ctx);
    if (!def) continue;
    const detail = { area: w.area, score: w.score, reason: w.reason };
    const seen = byNeed.get(def.id);
    if (seen) {
      seen.areas.push(w.area);
      seen.details.push(detail);
      continue;
    }
    byNeed.set(def.id, { knowledgeId: def.id, title: def.title, areas: [w.area], weakness: 0, styles, scale, environment, projectId, brief: brief.trim().slice(0, BRIEF_EXCERPT), details: [detail] });
  }
  for (const s of byNeed.values()) s.weakness = s.details.reduce((sum, d) => sum + (1 - d.score), 0) / s.details.length;
  return [...byNeed.values()];
}

// ── Accumulation ────────────────────────────────────────────────────────────

/** Applies one signal to its Knowledge Need (creating it on first sight). Pure: the caller persists the result. */
export function recordKnowledgeSignal(existing: KnowledgeNeed | undefined, signal: KnowledgeSignal, now: Date = new Date()): KnowledgeNeed {
  const at = now.toISOString();
  const base: KnowledgeNeed = existing ?? {
    id: signal.knowledgeId,
    title: signal.title,
    areas: [],
    requestCount: 0,
    firstSeen: at,
    lastSeen: at,
    recentRequests: [],
    projectExamples: [],
    styles: [],
    scales: [],
    environments: [],
    weaknessTotal: 0,
    assetIds: [],
    recipeIds: [],
    status: "open",
    version: 1,
  };
  return {
    ...base,
    areas: unique([...base.areas, ...signal.areas]),
    requestCount: base.requestCount + 1,
    lastSeen: at,
    recentRequests: [...base.recentRequests, at].slice(-MAX_RECENT_REQUESTS),
    projectExamples: [...base.projectExamples, { projectId: signal.projectId, at, brief: signal.brief, areas: signal.details }].slice(-MAX_PROJECT_EXAMPLES),
    styles: unique([...base.styles, ...signal.styles]),
    scales: signal.scale ? unique([...base.scales, signal.scale]) : base.scales,
    environments: signal.environment ? unique([...base.environments, signal.environment]) : base.environments,
    weaknessTotal: base.weaknessTotal + signal.weakness,
  };
}

// ── Completion ──────────────────────────────────────────────────────────────

/** What the library holds, as far as completion cares. Assets live in the admin's browser, recipes on the server, so this is assembled where both are known. */
export interface KnowledgeFacts {
  assets: readonly CuratedAsset[];
  recipes: readonly DesignRecipe[];
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
const usable = (a: CuratedAsset) => a.status === "approved" && !a.supersededBy && a.scope !== "project" && (a.type !== "glb-model" || a.validation?.passed === true);

export function knowledgeProgress(need: Pick<KnowledgeNeed, "id" | "assetIds" | "recipeIds">, facts: KnowledgeFacts): KnowledgeProgress {
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
  const tracked = keys.filter((k) => targets[k] > 0);
  const completion = tracked.length === 0 ? 0 : tracked.reduce((sum, k) => sum + Math.min(1, facets[k] / targets[k]), 0) / tracked.length;
  return { facets: out, assetIds, recipeIds, completion };
}

// ── Metrics and ranking ─────────────────────────────────────────────────────

export interface KnowledgeMetrics {
  need: KnowledgeNeed;
  progress: KnowledgeProgress;
  completion: number;
  /** 0…1: how sure we are the gap is real — it needs repeat sightings and a consistent shortfall. */
  confidence: number;
  /** Mean shortfall of the weak areas that pointed here, 0…1. */
  severity: number;
  /** Requests in the last GROWTH_WINDOW_DAYS. */
  recentCount: number;
  /** Higher = work on it sooner: demand × severity × what is still missing, discounted as it goes quiet. */
  priority: number;
}

export function knowledgeMetrics(need: KnowledgeNeed, facts: KnowledgeFacts, now: Date = new Date()): KnowledgeMetrics {
  const progress = knowledgeProgress(need, facts);
  const severity = need.requestCount === 0 ? 0 : need.weaknessTotal / need.requestCount;
  const confidence = Math.round(Math.min(1, need.requestCount / 5) * severity * 100) / 100;
  const cutoff = now.getTime() - GROWTH_WINDOW_DAYS * 86_400_000;
  const recentCount = need.recentRequests.filter((t) => Date.parse(t) >= cutoff).length;
  const idleDays = Math.max(0, (now.getTime() - Date.parse(need.lastSeen)) / 86_400_000);
  const recency = 1 / (1 + idleDays / 30);
  const priority = Math.round(Math.log2(1 + need.requestCount) * (0.5 + severity) * (1 - progress.completion) * recency * 100) / 100;
  return { need, progress, completion: progress.completion, confidence, severity, recentCount, priority };
}

export interface KnowledgeBoards {
  mostRequested: KnowledgeMetrics[];
  highestImpact: KnowledgeMetrics[];
  recentlyGrowing: KnowledgeMetrics[];
  closeToCompletion: KnowledgeMetrics[];
}

/** Completion at which a Need is treated as done and drops off the boards. */
export const COMPLETE_AT = 0.95;
/** A Need is "close" once this much is done. */
export const CLOSE_FROM = 0.5;

/** The four control-center lists. Ignored and complete Needs never appear; each list is capped. */
export function knowledgeBoards(needs: readonly KnowledgeNeed[], facts: KnowledgeFacts, now: Date = new Date(), limit = 5): KnowledgeBoards {
  const all = needs.filter((n) => n.status === "open").map((n) => knowledgeMetrics(n, facts, now));
  const open = all.filter((m) => m.completion < COMPLETE_AT);
  const top = (items: KnowledgeMetrics[], cmp: (a: KnowledgeMetrics, b: KnowledgeMetrics) => number) => [...items].sort(cmp).slice(0, limit);
  return {
    mostRequested: top(open, (a, b) => b.need.requestCount - a.need.requestCount || b.need.lastSeen.localeCompare(a.need.lastSeen)),
    highestImpact: top(open, (a, b) => b.priority - a.priority),
    recentlyGrowing: top(open.filter((m) => m.recentCount > 0), (a, b) => b.recentCount - a.recentCount || b.priority - a.priority),
    closeToCompletion: top(open.filter((m) => m.completion >= CLOSE_FROM), (a, b) => b.completion - a.completion),
  };
}

/** The Knowledge Needs an object Need (a missing gazebo) rolls up under, for display. */
export { knowledgeForFamily } from "./catalog";
