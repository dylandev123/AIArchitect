import { z } from "zod";
import type { CuratedAsset } from "@/types/assets";
import { assetSpecSchema, nativeRoute } from "@/lib/assets/native/spec";
import { ASSET_CATEGORIES, ASSET_PRIORITIES, ASSET_ROUTES, PLAN_STATUSES, type AssetPlan, type AssetPriority, type PlannedAsset, type UsageContext } from "@/types/library";

/** Asset Plans: pure model helpers shared by the planner, the admin API and the UI. */

export const USAGE_CONTEXTS = ["poolside", "terrace", "garden", "entry", "driveway", "waterfront", "rooftop", "courtyard", "facade", "interior"] as const satisfies readonly UsageContext[];

/** Largest edge (m) a single planned object may have. Anything bigger is a scene, not a reusable building block. */
export const MAX_ASSET_EDGE = 12;
export const MAX_PLANNED_ASSETS = 40;

const tag = z.string().trim().toLowerCase().min(1).max(40);
const edge = z.number().positive().max(MAX_ASSET_EDGE);

export const plannedAssetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(3).max(80),
  category: z.enum(ASSET_CATEGORIES),
  description: z.string().trim().min(1).max(300),
  style: z.array(tag).max(8).default([]),
  material: z.string().trim().max(80).default(""),
  dimensions: z.object({ width: edge.optional(), depth: edge.optional(), height: edge.optional() }).optional(),
  tags: z.array(tag).max(12).default([]),
  priority: z.enum(ASSET_PRIORITIES),
  estimatedReuse: z.number().min(0).max(100).transform(Math.round),
  contexts: z.array(z.enum(USAGE_CONTEXTS)).max(8).default([]),
  generationPrompt: z.string().trim().min(20).max(1200),
  approved: z.boolean().default(false),
  generated: z.boolean().default(false),
  assetId: z.string().max(80).optional(),
  route: z.enum(ASSET_ROUTES).optional(),
  spec: assetSpecSchema.optional(),
  job: z.object({ providerId: z.string().max(60), jobId: z.string().max(200), submittedAt: z.string().max(40) }).optional(),
});

/** What the admin submits to save a plan; ids, timestamps are assigned by the store. */
export const planInputSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  title: z.string().trim().min(3).max(120),
  knowledgeId: z.string().min(1).max(80).optional(),
  needId: z.string().min(1).max(80).optional(),
  status: z.enum(PLAN_STATUSES),
  assets: z.array(plannedAssetSchema).min(1).max(MAX_PLANNED_ASSETS),
});
export type PlanInput = z.infer<typeof planInputSchema>;

const PRIORITY_RANK: Record<AssetPriority, number> = { required: 0, recommended: 1, optional: 2 };

/** Required first, then by reuse: the order assets should be generated in. */
export const byGenerationOrder = (a: PlannedAsset, b: PlannedAsset) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.estimatedReuse - a.estimatedReuse || a.name.localeCompare(b.name);

const MARKER = "single freestanding object";

/** The provider-independent prompt for one object: the model's wording plus the fixed constraints every generator needs. */
export function finalizeGenerationPrompt(prompt: string, asset: Pick<PlannedAsset, "dimensions">): string {
  const text = prompt.trim().replace(/\s+/g, " ");
  if (text.toLowerCase().includes(MARKER)) return text;
  const d = asset.dimensions;
  const size = d && (d.width || d.depth || d.height) ? ` Real-world size about ${[d.width, d.depth, d.height].map((v) => (v ? v.toFixed(2).replace(/\.?0+$/, "") : "–")).join(" × ")} m.` : "";
  return `${text.replace(/[.\s]+$/, "")}. Single freestanding object, isolated, no ground plane or background, Y-up, clean topology for real-time web use.${size}`;
}

export function createPlan(input: PlanInput, now: Date = new Date(), id: string = crypto.randomUUID()): AssetPlan {
  const at = now.toISOString();
  // Progress and specs are server-owned: a new plan starts with none, whatever the client sent.
  const assets = input.assets.map((a) => ({ ...a, assetId: undefined, generated: false, job: undefined, spec: undefined, route: a.route ?? nativeRoute(a) }));
  return { id, title: input.title, knowledgeId: input.knowledgeId, needId: input.needId, status: input.status, created_at: at, updated_at: at, assets };
}

/**
 * Updates a saved plan from the admin's edit. Progress the admin cannot change from the dialog (the produced asset, any
 * submitted job and the native spec under review) always comes from the stored plan, so a stale editor cannot erase it.
 */
export function updatePlan(plan: AssetPlan, input: PlanInput, now: Date = new Date()): AssetPlan {
  const stored = new Map(plan.assets.map((a) => [a.id, a]));
  const assets = input.assets.map((a) => {
    const prior = stored.get(a.id);
    const route = a.route ?? prior?.route ?? nativeRoute(a);
    return prior ? { ...a, route, assetId: prior.assetId, generated: prior.generated, job: prior.job, spec: prior.spec } : { ...a, route, assetId: undefined, generated: false, job: undefined, spec: undefined };
  });
  return { ...plan, title: input.title, status: input.status, assets, updated_at: now.toISOString() };
}

// ── Progress ────────────────────────────────────────────────────────────────

export interface PlanStats {
  planned: number;
  approvedForGeneration: number;
  generated: number;
  /** In the global library: approved, and (for GLBs) validated. */
  approved: number;
  /** Planned but not yet in the library. */
  missing: number;
  /** approved / planned, 0…1 (0 when nothing is planned). */
  completion: number;
}

const usableInLibrary = (a: CuratedAsset) => a.status === "approved" && a.scope !== "project" && (a.type !== "glb-model" || a.validation?.passed === true);

/** Progress across plans, measured against what the admin's library actually holds. */
export function planStats(plans: readonly AssetPlan[], library: readonly Pick<CuratedAsset, "id" | "status" | "scope" | "type" | "validation">[]): PlanStats {
  const ready = new Set(library.filter((a) => usableInLibrary(a as CuratedAsset)).map((a) => a.id));
  const all = plans.flatMap((p) => p.assets);
  const approved = all.filter((a) => a.assetId && ready.has(a.assetId)).length;
  const planned = all.length;
  return {
    planned,
    approvedForGeneration: all.filter((a) => a.approved).length,
    generated: all.filter((a) => a.generated || a.assetId).length,
    approved,
    missing: planned - approved,
    completion: planned === 0 ? 0 : approved / planned,
  };
}

export const plansFor = (plans: readonly AssetPlan[], key: { needId?: string; knowledgeId?: string }) =>
  plans.filter((p) => (key.needId && p.needId === key.needId) || (key.knowledgeId && p.knowledgeId === key.knowledgeId));
