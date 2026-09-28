import { describePlacement } from "@/lib/house/architecture/poolPlacement";
import { inferScaleFromBrief, isProjectScale } from "@/lib/house/scale";
import { inferSiteHints } from "@/lib/house/siteSettings";
import { COMPONENTS, plannedAssetFor } from "@/lib/outdoor/components";
import { planOutdoorSpaces, realizeSpaces, type OutdoorSpace } from "@/lib/outdoor/spaces";
import type { AssetPlan, AssetRequest, GenerationReport, KnowledgeNeed, Need, ReportKnowledge, ReportPlan, ReportStep } from "@/types/library";
import type { SiteEnvironment } from "@/types/house";
import { libraryStorageInfo, MAX_REPORTS, emptySnapshot, mutateLibrary, type LibraryChange, type LibraryDoc, type LibrarySnapshot } from "./store";
import { detectKnowledgeSignals, recordKnowledgeSignal } from "./knowledge/knowledge";
import { scoreDesignAreas, weakAreas } from "./knowledge/areas";
import { knowledgeForFamily } from "./knowledge/catalog";
import { findMatchingNeed, recordRequest } from "./needs";
import { createPlan, planInputSchema, plansFor } from "./plans";
import { recordRecipeUse } from "./recipes";
import { requestsFromProject, styleTagsForProjectStyle } from "./requests";
import { resolveAsset, type AssetIndexEntry } from "./retrieval";
import { evaluateRecipes, type RetrievedRecipe } from "./spaceRecipes";
import { reportAssets, resolveSpaceAssets } from "./spaceAssets";
import { dedupeRequests, extractStyleTags } from "./taxonomy";

/**
 * The learning loop, run after every successful initial generation:
 *
 *   outdoor spaces → Knowledge (areas + spaces scored) → Asset Needs (brief + missing space components) → starter Asset Plans
 *   → Recipes used → one report of all of it
 *
 * It is one pure analysis (`analyzeGeneration`) over a snapshot of the library, applied as ONE store transaction
 * (`runPostGeneration`). One transaction means the Knowledge, Needs, Plans, recipe counters and the report land together or not
 * at all, and there is exactly one place a failure can be observed — and it is observed: a failed step is recorded in the
 * report (`steps`) and logged, never swallowed, and a failed write is the report's `persistence`.
 */

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/** A generation writes at most this many new starter plans; the rest wait for the next one (or an admin's own plan). */
export const MAX_NEW_PLANS = 8;
const BRIEF_EXCERPT = 200;

export interface AttachedAsset {
  index: number;
  assetId: string;
  request: AssetRequest;
}

export interface LoopInput {
  json: string;
  brief: string;
  projectId: string | null;
  /** The approved assets the client sent with the request. */
  library: readonly AssetIndexEntry[];
  /** The recipes retrieved for this generation (before the model call). */
  retrieved: readonly RetrievedRecipe[];
  /** Library assets attached to project features. */
  attached: readonly AttachedAsset[];
}

export interface Analysis {
  report: GenerationReport;
  put: LibraryDoc[];
  remove: { kind: LibraryDoc["kind"]; id: string }[];
}

const emptyPlacement = (): GenerationReport["placement"] => ({ arrivalSide: "", viewSide: "", pools: [], garages: [], issues: [] });

/** Everything the loop concludes from one generation, and every write it wants. Pure: nothing is stored here. */
export function analyzeGeneration(input: LoopInput, snapshot: LibrarySnapshot, now: Date = new Date(), makeId: () => string = () => crypto.randomUUID()): Analysis {
  const steps: ReportStep[] = [];
  const step = <T,>(name: string, work: () => T, fallback: T): T => {
    const t0 = performance.now();
    try {
      const value = work();
      steps.push({ name, ok: true, ms: Math.round(performance.now() - t0) });
      return value;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[generation-loop] ${name} failed:`, err);
      steps.push({ name, ok: false, ms: Math.round(performance.now() - t0), error });
      return fallback;
    }
  };

  const { json, brief, projectId, library, retrieved, attached } = input;
  let root: Rec = {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (isRecord(parsed)) root = parsed;
  } catch {
    /* every step below copes with an empty project */
  }
  const site = isRecord(root.site) ? root.site : {};
  const opts = isRecord(root.exteriorOptions) ? root.exteriorOptions : {};
  const styles = unique([...extractStyleTags(brief), ...styleTagsForProjectStyle(opts.style)]);
  const scale = isProjectScale(site.projectScale) ? site.projectScale : inferScaleFromBrief(brief);
  const environment = (typeof site.environment === "string" ? site.environment : inferSiteHints(brief).environment) as SiteEnvironment | undefined;

  // 1. Outdoor spaces: which the design has, and which recipes were retrieved for each.
  const spaces: OutdoorSpace[] = step("outdoor-spaces", () => {
    const planned = planOutdoorSpaces({
      brief,
      scale,
      tier: typeof site.designTier === "string" ? (site.designTier as never) : undefined,
      environment,
      styles,
      viewDirection: typeof site.viewDirection === "string" ? (site.viewDirection as never) : undefined,
      approachSide: typeof site.approachSide === "string" ? (site.approachSide as never) : undefined,
    });
    return realizeSpaces(planned, root).map((s) => ({ ...s, recipeIds: retrieved.filter((r) => r.spaces.includes(s.kind)).map((r) => r.recipe.id) }));
  }, []);

  // 2. Areas scored (the evidence for the weak ones).
  const areas = step("score-areas", () => {
    const scores = scoreDesignAreas(json, brief, library, snapshot.recipes);
    const weak = new Set(weakAreas(scores).map((s) => s.area));
    return scores.map((s) => ({ ...s, weak: weak.has(s.area) }));
  }, []);

  // 3. Knowledge gaps: weak areas and uncovered spaces, merged into the Knowledge Needs they belong to.
  const knowledge = new Map<string, KnowledgeNeed>();
  const knowledgeGaps: ReportKnowledge[] = step("knowledge", () => {
    const out: ReportKnowledge[] = [];
    for (const signal of detectKnowledgeSignals(json, brief, projectId, library, { recipes: snapshot.recipes, spaces })) {
      const existing = knowledge.get(signal.knowledgeId) ?? snapshot.knowledge.find((k) => k.id === signal.knowledgeId);
      const next = recordKnowledgeSignal(existing, signal, now);
      knowledge.set(next.id, next);
      out.push({ id: next.id, name: signal.title, reason: signal.details.slice(0, 2).map((d) => d.reason).join(" · "), isNew: !snapshot.knowledge.some((k) => k.id === next.id), requestCount: next.requestCount });
    }
    return out;
  }, []);

  // 4. Asset Needs: what the brief and buildings ask for that no approved asset fits, and each outdoor space's missing components.
  const placements: import("@/lib/outdoor/placements").OutdoorAssetPlacement[] = Array.isArray(root.outdoorAssetPlacements) ? root.outdoorAssetPlacements : [];
  const spaceAssets = step("space-assets", () => resolveSpaceAssets(spaces, library, { styles, projectId, placements }), { supplied: [], requests: [], bySpace: new Map() });
  const touchedNeeds = new Map<string, Need>();
  /** Needs whose missing components the library now supplies (and which no request touched): rewritten without them. */
  const satisfied = new Map<string, Need>();
  step("asset-needs", () => {
    const fromProject = requestsFromProject(json, brief, projectId).filter((req) => resolveAsset(library, req).kind === "fallback");
    const needs = [...snapshot.needs];
    for (const req of dedupeRequests([...fromProject, ...spaceAssets.requests])) {
      const before = findMatchingNeed(needs, req);
      let next = recordRequest(needs, req, now, makeId);
      // An approved Need that a design still could not satisfy was not enough: it is open again.
      if (before?.status === "approved") next = { ...next, status: "needed" };
      const at = needs.findIndex((n) => n.id === next.id);
      if (at >= 0) needs[at] = next;
      else needs.push(next);
      touchedNeeds.set(next.id, next);
    }
    // What the library supplies is no longer missing: drop those components from every Need that lists them. A Need whose
    // every component is now supplied has been answered by the library, without a plan.
    const supplied = new Set(spaceAssets.supplied.filter(s => spaceAssets.bySpace.get(s.space)?.supplied.includes(s.component) && ![...spaceAssets.bySpace.values()].some(v => v.missing.includes(s.component))).map(s => s.component));
    const supplier = (key: string) => spaceAssets.supplied.find((s) => s.component === key)?.asset.id;
    for (const need of needs) {
      if (!need.components?.some((c) => supplied.has(c))) continue;
      const remaining = need.components.filter((c) => !supplied.has(c));
      const answered = remaining.length === 0 && (need.status === "needed" || need.status === "generating");
      const next: Need = { ...need, components: remaining, ...(answered ? { status: "approved" as const, assetId: supplier(need.components[0]) } : {}) };
      if (touchedNeeds.has(need.id)) touchedNeeds.set(need.id, next);
      else satisfied.set(need.id, next);
    }
  }, undefined);

  // 5. Starter Asset Plans: a Need with components and no plan yet gets a plan of those objects, so it is actionable straight away.
  const plansCreated: ReportPlan[] = [];
  const plansExisting: ReportPlan[] = [];
  const newPlans: AssetPlan[] = [];
  step("asset-plans", () => {
    const homeOf = (key: string): { space: string; need: "required" | "preferred" } | undefined => {
      let found: { space: string; need: "required" | "preferred" } | undefined;
      for (const s of spaces) {
        if (!s.realized && !s.requested) continue;
        if (s.components.required.includes(key)) return { space: s.kind, need: "required" };
        if (!found && s.components.preferred.includes(key)) found = { space: s.kind, need: "preferred" };
      }
      return found;
    };
    for (const need of touchedNeeds.values()) {
      const keys = (need.components ?? []).filter((k) => COMPONENTS[k]?.category === need.category);
      if (keys.length === 0) continue;
      const mine = plansFor(snapshot.plans, { needId: need.id });
      if (mine.length > 0) {
        plansExisting.push({ id: mine[0].id, title: mine[0].title, needId: need.id, assets: mine[0].assets.length });
        continue;
      }
      if (newPlans.length >= MAX_NEW_PLANS) continue;
      const assets = keys.flatMap((key) => {
        const home = homeOf(key);
        const asset = plannedAssetFor(key, { styles: need.styleTags, space: home?.space, need: home?.need ?? "preferred", id: makeId() });
        return asset ? [asset] : [];
      });
      if (assets.length === 0) continue;
      const parsed = planInputSchema.safeParse({ title: `${need.title} — Starter Pack`, knowledgeId: knowledgeForFamily(need.category, need.styleTags)[0]?.id, needId: need.id, status: "draft", assets });
      if (!parsed.success) throw new Error(`starter plan for ${need.title} is invalid: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`);
      const plan = createPlan(parsed.data, now, makeId());
      newPlans.push(plan);
      plansCreated.push({ id: plan.id, title: plan.title, needId: need.id, assets: plan.assets.length });
    }
  }, undefined);

  // 6. Recipes: what was retrieved, whether the design gave it anything to act on, and the success it counts toward.
  const recipes = step("recipes", () => evaluateRecipes(retrieved, spaces, root), []);
  const usedRecipes = retrieved.flatMap((r) => {
    const fresh = snapshot.recipes.find((x) => x.id === r.recipe.id);
    return fresh ? [recordRecipeUse(fresh, "success")] : [];
  });

  // 7. Placement: did the property read correctly (pool private, garage on the arrival side)?
  const placement = step("placement", () => describePlacement(root, brief) ?? emptyPlacement(), emptyPlacement());

  const assets = step("reuse", () => reportAssets(spaceAssets, attached, library, spaces, placements), []);
  if (typeof root.outdoorAssetPlacementFailure === "string") {
    steps.push({name:"outdoor-asset-placement",ok:false,ms:0,error:root.outdoorAssetPlacementFailure});
    for (const asset of assets) if (!asset.applied) { asset.status="Failed"; asset.note=root.outdoorAssetPlacementFailure; }
  }

  const info = libraryStorageInfo();
  const report: GenerationReport = {
    id: makeId(),
    at: now.toISOString(),
    projectId,
    brief: brief.trim().slice(0, BRIEF_EXCERPT),
    spaces: spaces.map((s) => ({
      kind: s.kind,
      name: s.name,
      requested: s.requested,
      realized: s.realized,
      realizedBy: s.realizedBy,
      side: s.side,
      footprint: s.footprint,
      reasons: s.reasons,
      missing: spaceAssets.bySpace.get(s.kind)?.missing ?? [],
      supplied: spaceAssets.bySpace.get(s.kind)?.supplied ?? [],
    })),
    areas: areas.map((a) => ({ area: a.area, relevant: a.relevant, score: a.score, reason: a.reason, weak: a.weak })),
    recipes,
    assets,
    knowledgeGaps,
    assetNeeds: [...touchedNeeds.values()].map((n) => ({
      id: n.id,
      name: n.title,
      spaces: n.spaces ?? [],
      components: (n.components ?? []).map((k) => COMPONENTS[k]?.name ?? k),
      isNew: !snapshot.needs.some((x) => x.id === n.id),
      requestedCount: n.requestedCount,
    })),
    plansCreated,
    plansExisting,
    placement,
    persistence: { ok: true, backend: info.kind, location: info.location, wrote: { knowledge: knowledge.size, needs: touchedNeeds.size, plans: newPlans.length, recipes: usedRecipes.length } },
    steps,
  };

  const put: LibraryDoc[] = [
    ...[...knowledge.values()].map((data) => ({ kind: "knowledge" as const, data })),
    ...[...touchedNeeds.values(), ...satisfied.values()].map((data) => ({ kind: "need" as const, data })),
    ...newPlans.map((data) => ({ kind: "plan" as const, data })),
    ...usedRecipes.map((data) => ({ kind: "recipe" as const, data })),
    { kind: "generation" as const, data: report },
  ];
  // Reports are evidence, not history: keep the newest few.
  const old = [...snapshot.generations].sort((a, b) => b.at.localeCompare(a.at)).slice(MAX_REPORTS - 1);
  return { report, put, remove: old.map((g) => ({ kind: "generation" as const, id: g.id })) };
}

/** How long the request waits for the library write before answering without confirmation. */
const WRITE_TIMEOUT_MS = 8_000;

/**
 * Runs the loop and writes its result in one transaction. Never throws: a store failure is returned as the report's
 * `persistence` (and logged), and the analysis is still returned so the admin sees what the generation *would* have recorded.
 */
export async function runPostGeneration(input: LoopInput, opts: { timeoutMs?: number } = {}): Promise<GenerationReport> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`the library write did not finish within ${(opts.timeoutMs ?? WRITE_TIMEOUT_MS) / 1000}s`)), opts.timeoutMs ?? WRITE_TIMEOUT_MS);
    });
    const write = mutateLibrary((snapshot): LibraryChange<GenerationReport> => {
      const a = analyzeGeneration(input, snapshot);
      return { put: a.put, remove: a.remove, result: a.report };
    });
    return await Promise.race([write, timeout]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generation-loop] persisting the generation failed:", message);
    const { report } = analyzeGeneration(input, emptySnapshot());
    return { ...report, persistence: { ...report.persistence, ok: false, error: message, wrote: { knowledge: 0, needs: 0, plans: 0, recipes: 0 } } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
