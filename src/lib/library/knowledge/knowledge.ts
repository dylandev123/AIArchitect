import { inferSiteHints } from "@/lib/house/siteSettings";
import { inferScaleFromBrief, isProjectScale } from "@/lib/house/scale";
import type { SiteEnvironment } from "@/types/house";
import type { DesignArea, DesignRecipe, KnowledgeNeed, KnowledgeSignal } from "@/types/library";
import { spaceName, type OutdoorSpace, type OutdoorSpaceKind } from "@/lib/outdoor/spaces";
import { styleTagsForProjectStyle } from "../requests";
import type { AssetIndexEntry } from "../retrieval";
import { extractStyleTags } from "../taxonomy";
import { pickKnowledge, pickKnowledgeForSpace } from "./catalog";
import { scoreDesignAreas, weakAreas } from "./areas";
import { factsFromIndex, knowledgeProgress, type KnowledgeFacts, type KnowledgeProgress } from "./progress";

const MAX_PROJECT_EXAMPLES = 12;
const MAX_RECENT_REQUESTS = 60;
const BRIEF_EXCERPT = 140;
/** "Recently growing" looks at this many days back. */
export const GROWTH_WINDOW_DAYS = 14;

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

// ── Detection (generation side) ─────────────────────────────────────────────

/** The design area an outdoor space is filed under, for display. */
const SPACE_AREA: Partial<Record<OutdoorSpaceKind, DesignArea>> = {
  "arrival-court": "arrival",
  "main-outdoor-living": "outdoor-living",
  "outdoor-dining": "outdoor-living",
  "outdoor-kitchen": "outdoor-living",
  "pool-lounge": "pool",
  "pool-bar": "pool",
  "fire-pit-lounge": "outdoor-living",
  garden: "gardens",
  "quiet-retreat": "landscape",
  "guest-outdoor": "landscape",
  "view-terrace": "views",
};

/** What the library holds for detection: object assets from the request's index and every recipe. Materials are not visible here. */
export interface DetectionFacts {
  recipes?: readonly DesignRecipe[];
  /** The outdoor spaces the design contains (see `realizeSpaces`); each one whose Knowledge Need is not yet covered is a gap. */
  spaces?: readonly OutdoorSpace[];
}

/**
 * Scores the design's areas and its outdoor spaces, and turns each weak one into the Knowledge Need it belongs to. Several
 * weak areas that point at the same need (a bare terrace *and* empty furniture → Luxury Outdoor Living) become one signal, so a
 * single generation counts once per need. An outdoor space the design contains (or the brief asked for) whose Knowledge Need
 * the library does not yet cover is a gap in its own right, filed under the need that is that space's home ("Outdoor Dining",
 * not "Luxury Outdoor Living"). Empty when the JSON is unreadable or everything is well served.
 */
export function detectKnowledgeSignals(json: string, brief: string, projectId: string | null, library: readonly AssetIndexEntry[], facts: DetectionFacts = {}): KnowledgeSignal[] {
  const recipes = facts.recipes ?? [];
  const weak = weakAreas(scoreDesignAreas(json, brief, library, recipes));
  const spaces = (facts.spaces ?? []).filter((sp) => sp.realized || sp.requested);
  if (weak.length === 0 && spaces.length === 0) return [];

  let root: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) root = parsed as Record<string, unknown>;
  } catch {
    /* scoreDesignAreas already returned [] for unreadable JSON */
  }
  // `site` is the stored key (see applyPatch); `settings` is what older fixtures call it.
  const settings = typeof root.site === "object" && root.site !== null ? (root.site as Record<string, unknown>) : typeof root.settings === "object" && root.settings !== null ? (root.settings as Record<string, unknown>) : {};
  const opts = typeof root.exteriorOptions === "object" && root.exteriorOptions !== null ? (root.exteriorOptions as Record<string, unknown>) : {};
  const styleKey = typeof opts.style === "string" ? opts.style : "";
  const styles = unique([...extractStyleTags(brief), ...styleTagsForProjectStyle(styleKey)]);
  const environment = (typeof settings.environment === "string" ? settings.environment : inferSiteHints(brief).environment) as SiteEnvironment | undefined;
  const scale = isProjectScale(settings.projectScale) ? settings.projectScale : inferScaleFromBrief(brief);
  // The style key ("caribbean-villa") can name a place the tag vocabulary folds away; keep it visible to keyword entries.
  const ctx = { brief: `${brief} ${styleKey.replace(/-/g, " ")}`, styles, environment };

  const byNeed = new Map<string, KnowledgeSignal>();
  const add = (def: { id: string; title: string }, area: DesignArea, detail: KnowledgeSignal["details"][number]) => {
    const seen = byNeed.get(def.id);
    if (seen) {
      if (!seen.areas.includes(area)) seen.areas.push(area);
      seen.details.push(detail);
      return;
    }
    byNeed.set(def.id, { knowledgeId: def.id, title: def.title, areas: [area], weakness: 0, styles, scale, environment, projectId, brief: brief.trim().slice(0, BRIEF_EXCERPT), details: [detail] });
  };

  for (const w of weak) {
    const def = pickKnowledge(w.area, ctx);
    if (def) add(def, w.area, { area: w.area, score: w.score, reason: w.reason });
  }

  const libraryFacts: KnowledgeFacts = { assets: factsFromIndex(library), recipes };
  for (const sp of spaces) {
    const def = pickKnowledgeForSpace(sp.kind, ctx);
    if (!def) continue;
    const progress = knowledgeProgress({ id: def.id, assetIds: [], recipeIds: [] }, libraryFacts, { ignore: ["materials"] });
    if (progress.completion >= COMPLETE_AT) continue;
    const f = progress.facets;
    const parts = [`${f.assets.have} of ${f.assets.target} assets`, `${f.recipes.have} of ${f.recipes.target} recipes`].filter((_, i) => (i === 0 ? f.assets.target > 0 : f.recipes.target > 0));
    add(def, SPACE_AREA[sp.kind] ?? "outdoor-living", {
      area: SPACE_AREA[sp.kind] ?? "outdoor-living",
      score: Math.round(progress.completion * 100) / 100,
      reason: `${spaceName(sp.kind)} ${sp.realized ? "is in the design" : "was asked for"}; the library has ${parts.join(", ")} approved for ${def.title}.`,
      space: sp.kind,
    });
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

export { knowledgeProgress, factsFromIndex } from "./progress";
export type { AssetFact, FacetProgress, KnowledgeFacts, KnowledgeProgress } from "./progress";

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
