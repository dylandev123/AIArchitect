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
}

/** A request for a visual asset, before it is matched against needs or the library. */
export interface AssetRequest {
  text: string;
  category: AssetCategory;
  styleTags: string[];
  contextTags: string[];
  dimensions?: NeedDimensions;
  projectId?: string | null;
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
