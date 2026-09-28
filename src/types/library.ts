import type { AssetSpec } from "@/lib/assets/native/spec";
import type { ProjectScale, SiteEnvironment } from "./house";

/**
 * Reusable-knowledge library shared by generation and the admin curator.
 *
 * Two kinds of knowledge live here, deliberately apart:
 *  - Needs: things generation wanted but could not source well (drives what to generate/upload next).
 *  - Recipes: parametric architectural logic (never a mesh). Visual assets stay `CuratedAsset`s.
 */

// ── Taxonomy ────────────────────────────────────────────────────────────────

/** Object families that are best served by a reusable GLB (see the procedural/GLB split in the design brief). */
export const ASSET_CATEGORIES = [
  "gazebo", "pergola", "outdoor-bar", "outdoor-kitchen", "cabana", "fire-pit", "hot-tub",
  "furniture", "vehicle", "light", "vegetation", "rock", "decorative",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export type UsageContext = "poolside" | "terrace" | "garden" | "entry" | "driveway" | "waterfront" | "rooftop" | "courtyard";

// ── Needs ───────────────────────────────────────────────────────────────────

export const NEED_STATUSES = ["needed", "generating", "review", "approved", "ignored"] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

export interface NeedDimensions {
  width?: number;
  depth?: number;
  height?: number;
}

export interface NeedProjectRef {
  projectId: string;
  at: string;
}

export interface Need {
  id: string;
  /** Human title, taken from the first request that created the need ("Modern Tropical Gazebo"). */
  title: string;
  category: AssetCategory;
  styleTags: string[];
  contextTags: string[];
  /** Largest dimensions requested so far (a candidate asset must be able to scale to them). */
  dimensions?: NeedDimensions;
  requestedCount: number;
  firstRequested: string;
  lastRequested: string;
  /** Most recent projects that asked for it; capped, oldest dropped. */
  projectRefs: NeedProjectRef[];
  /** Distinct wordings seen, so the admin can see what the merge collapsed. */
  phrasings: string[];
  status: NeedStatus;
  /** Set once a candidate asset was produced (queued for review) or approved. */
  assetId?: string;
  /** Outdoor spaces (see `lib/outdoor/spaces`) whose designs asked for this: "Outdoor Dining", "Pool Lounge". Absent on older needs. */
  spaces?: string[];
  /** The specific objects still missing ("dining-table", "sun-lounger") under this family. Absent on older needs. */
  components?: string[];
}

/** A request for a visual asset, before it is matched against needs or the library. */
export interface AssetRequest {
  text: string;
  category: AssetCategory;
  styleTags: string[];
  contextTags: string[];
  dimensions?: NeedDimensions;
  projectId?: string | null;
  /** The outdoor spaces that want it, and the specific objects (component keys), when the request came from them. */
  spaces?: string[];
  components?: string[];
}

// ── Recipes ─────────────────────────────────────────────────────────────────

export const RECIPE_CATEGORIES = [
  "roof", "pool", "outdoor-living", "terrace", "courtyard", "motor-court", "facade",
  "planting", "retaining-wall", "entry-sequence",
] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const RECIPE_APPROVALS = ["proposed", "approved", "rejected", "archived"] as const;
export type RecipeApproval = (typeof RECIPE_APPROVALS)[number];

/** A tunable value with the range generation may adapt it within. */
export interface RecipeParameter {
  key: string;
  label?: string;
  unit?: string;
  /** Default/typical value. */
  value: number | string | boolean;
  /** Numeric parameters only: the range the recipe permits when adapting to a project. */
  min?: number;
  max?: number;
  /** Enumerated parameters only. */
  options?: string[];
}

/** A relationship the recipe requires or prefers between the pattern and something else on the site. */
export interface RecipeRelationship {
  kind: "requires" | "prefers" | "conflicts";
  /** e.g. "pool-bar", "view-side", "veranda-roof". */
  target: string;
  note?: string;
}

export interface DesignRecipe {
  id: string;
  name: string;
  category: RecipeCategory;
  styleTags: string[];
  compatibleScales: ProjectScale[];
  environmentTags: SiteEnvironment[];
  parameters: RecipeParameter[];
  relationships: RecipeRelationship[];
  /** Free-text rules the generator is told to honour ("deep eaves", "cupola optional"). */
  guidance: string[];
  usageCount: number;
  successCount: number;
  failureCount: number;
  approval: RecipeApproval;
  version: number;
  created_at: string;
  updated_at: string;
  /** Where it came from: an admin, or a generated project it was proposed from. */
  origin?: { kind: "admin" | "learn" | "generation"; projectId?: string };
  /** Knowledge Needs this recipe was explicitly filed under. Absent on older recipes, which are matched by category instead. */
  knowledgeIds?: string[];
}

/** What generation asks the library for. Every field is optional; more fields only narrow the ranking. */
export interface RecipeQuery {
  category?: RecipeCategory;
  styleTags?: string[];
  scale?: ProjectScale;
  environment?: SiteEnvironment;
}

export interface Scored<T> {
  item: T;
  score: number;
  reasons: string[];
}

// ── Knowledge Needs ─────────────────────────────────────────────────────────
//
// A Need (above) is one missing *object*. A Knowledge Need is a missing *area of design knowledge* ("Luxury Outdoor
// Living") that parents assets, recipes, materials and lighting. Needs stay as they are and remain the children:
// every asset family maps to the Knowledge Needs that contain it (see `lib/library/knowledge/catalog`).

/** The major design areas generation scores independently. */
export const DESIGN_AREAS = [
  "architecture", "roofing", "landscape", "outdoor-living", "pool", "arrival", "driveway", "facade",
  "gardens", "lighting", "vegetation", "materials", "views", "terrain", "furniture",
] as const;
export type DesignArea = (typeof DESIGN_AREAS)[number];

export const KNOWLEDGE_STATUSES = ["open", "ignored"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

/** How much of each facet a Knowledge Need wants before it counts as complete. A facet with target 0 is not tracked. */
export interface KnowledgeTargets {
  assets: number;
  recipes: number;
  materials: number;
  lighting: number;
  plants: number;
}

export interface KnowledgeProjectRef {
  projectId: string | null;
  at: string;
  /** Start of the brief, so the admin can see what kind of request exposed the gap. */
  brief: string;
  /** The areas of that project that scored low, with their scores in [0,1]. `space` is set when an outdoor space, not an area score, exposed it. */
  areas: { area: DesignArea; score: number; reason: string; space?: string }[];
}

export interface KnowledgeNeed {
  /** The catalog slug ("luxury-outdoor-living"); stable, so the same gap always lands on the same record. */
  id: string;
  title: string;
  areas: DesignArea[];
  requestCount: number;
  firstSeen: string;
  lastSeen: string;
  /** Timestamps of the latest requests (capped), for "recently growing". */
  recentRequests: string[];
  /** Latest projects that exposed the gap (capped, oldest dropped). */
  projectExamples: KnowledgeProjectRef[];
  styles: string[];
  scales: ProjectScale[];
  environments: SiteEnvironment[];
  /** Sum over requests of (1 − area score): how badly the design fell short, on average = weaknessTotal / requestCount. */
  weaknessTotal: number;
  /** Curated assets / recipes an admin explicitly filed under this need, on top of those matched by family/category. */
  assetIds: string[];
  recipeIds: string[];
  status: KnowledgeStatus;
  version: 1;
}

/** One generation's evidence that an area is weak, before it is merged into a Knowledge Need. */
export interface KnowledgeSignal {
  knowledgeId: string;
  title: string;
  areas: DesignArea[];
  /** Mean shortfall (1 − score) across the areas that pointed here. */
  weakness: number;
  styles: string[];
  scale?: ProjectScale;
  environment?: SiteEnvironment;
  projectId: string | null;
  brief: string;
  details: KnowledgeProjectRef["areas"];
}

// ── Asset Plans ─────────────────────────────────────────────────────────────
//
// A Need is never satisfied by one giant GLB. The AI planner first designs an Asset Pack: a set of small reusable
// objects (kitchen island, sink, BBQ, stool…). Each planned asset later becomes its own generation job, and then goes
// through the normal Queue → validation → Library path like any other asset.

export const ASSET_PRIORITIES = ["required", "recommended", "optional"] as const;
export type AssetPriority = (typeof ASSET_PRIORITIES)[number];

export const PLAN_STATUSES = ["draft", "approved"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/**
 * How a planned asset should be made. Native is the default: the AI writes an AssetSpec and deterministic builders make the
 * model. Objects the primitives cannot express (organic, carved, figurative) are flagged for an external 3D provider instead.
 */
export const ASSET_ROUTES = ["native", "external-generation-recommended"] as const;
export type AssetRoute = (typeof ASSET_ROUTES)[number];

/** A generation job already submitted to a provider for a planned asset. */
export interface PlannedAssetJob {
  providerId: string;
  jobId: string;
  submittedAt: string;
}

export interface PlannedAsset {
  id: string;
  name: string;
  category: AssetCategory;
  description: string;
  style: string[];
  material: string;
  /** Target size in metres. */
  dimensions?: NeedDimensions;
  tags: string[];
  priority: AssetPriority;
  /** 0–100: how likely future projects are to reuse it. Higher-reuse assets are generated first. */
  estimatedReuse: number;
  contexts: UsageContext[];
  /** The exact, provider-independent text a generator is given for this one object. */
  generationPrompt: string;
  /** Approved for generation by the admin. */
  approved: boolean;
  /** An asset produced for it has reached the queue or library. */
  generated: boolean;
  /** The curated asset produced for it (see `CuratedAsset.plannedAssetId`). */
  assetId?: string;
  job?: PlannedAssetJob;
  route?: AssetRoute;
  /** The latest native spec awaiting review (set by the native generator; cleared on reject). Server-owned. */
  spec?: AssetSpec;
}

export interface AssetPlan {
  id: string;
  title: string;
  /** The Knowledge Need this pack belongs to (looked up from the Need's family when planned from an Asset Need). */
  knowledgeId?: string;
  /** The Asset Need this pack was planned for, if any. */
  needId?: string;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
  assets: PlannedAsset[];
}


// ── Generation reports ──────────────────────────────────────────────────────
//
// One record per successful initial generation: what the outdoor-space planner found, what the library could and could not
// supply, and what the learning loop wrote back. It is the admin's evidence that the loop ran (or where it stopped), and the
// proof that approved Recipes and Assets were actually retrieved by the next generation.

export interface ReportSpace {
  kind: string;
  name: string;
  /** The brief asked for it by name (as opposed to the planner adding it for the scale and site). */
  requested: boolean;
  /** The design has something standing for it (a patio, a pool, a garden zone…). */
  realized: boolean;
  realizedBy: string[];
  side: string;
  footprint: { width: number; depth: number };
  reasons: string[];
  /** Components (objects) the space wants that no approved asset supplies. */
  missing: string[];
  /** Components an approved library asset supplies. */
  supplied: string[];
}

export interface ReportRecipe {
  id: string;
  name: string;
  spaces: string[];
  reason: string;
  applied: boolean;
  /** Why it counts as applied, or why it does not. */
  note: string;
}

export interface ReportAsset {
  status?: "Retrieved" | "Applied" | "Rendered" | "Failed";
  placementIds?: string[];
  id: string;
  name: string;
  family: string;
  component: string;
  space: string;
  /** The project feature it was attached to, when it was. */
  feature?: string;
  applied: boolean;
  note: string;
}

export interface ReportKnowledge {
  id: string;
  name: string;
  reason: string;
  isNew: boolean;
  requestCount: number;
}

export interface ReportAssetNeed {
  id: string;
  name: string;
  spaces: string[];
  components: string[];
  isNew: boolean;
  requestedCount: number;
}

export interface ReportPlan {
  id: string;
  title: string;
  needId?: string;
  assets: number;
}

export interface ReportStep {
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface GenerationReport {
  id: string;
  at: string;
  projectId: string | null;
  brief: string;
  spaces: ReportSpace[];
  areas: { area: DesignArea; relevant: boolean; score: number; reason: string; weak: boolean }[];
  recipes: ReportRecipe[];
  assets: ReportAsset[];
  knowledgeGaps: ReportKnowledge[];
  assetNeeds: ReportAssetNeed[];
  plansCreated: ReportPlan[];
  /** Existing plans that already cover a Need this generation touched. */
  plansExisting: ReportPlan[];
  placement: {
    arrivalSide: string;
    viewSide: string;
    pools: { side: string; wall: string }[];
    garages: { side: string }[];
    issues: string[];
  };
  persistence: {
    ok: boolean;
    backend: "postgres" | "local-json" | "unavailable";
    location: string;
    error?: string;
    wrote: { knowledge: number; needs: number; plans: number; recipes: number };
  };
  steps: ReportStep[];
}
