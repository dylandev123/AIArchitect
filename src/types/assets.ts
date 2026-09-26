import type { StyleKey } from "./house";
import type { AssetCategory, NeedDimensions } from "./library";

export type AssetType = "pbr-material" | "hdri" | "glb-model" | "vegetation" | "component-pack";
export type AssetSource = "polyhaven" | "ambientcg" | "upload" | "generated";
export type AssetStatus = "pending" | "approved" | "rejected";

export interface PBRValues {
  baseColor: string;
  roughness: number;
  metalness: number;
}

/** Where an asset may be used: only "global" assets are visible to every project's generation. */
export type AssetScope = "project" | "global";

export interface AssetLicense {
  name: string;
  url?: string;
  attribution?: string;
}

/** Result of GLB validation (see `lib/assets/glbValidator`). Required (and passing) before a GLB can be approved into the global library. */
export interface AssetValidationReport {
  checkedAt: string;
  passed: boolean;
  /** Hard failures: the model cannot be used. */
  errors: string[];
  /** Usable, but worth a look (heavy, oddly-pivoted, oversized textures…). */
  warnings: string[];
  /** Bumped when the validator's rules change, so stale reports can be told apart. */
  validatorVersion?: number;
  fileSizeBytes?: number;
  triangleCount?: number;
  /** Renderable mesh nodes in the scene (each is at least one draw call). */
  meshCount?: number;
  materialCount?: number;
  textureCount?: number;
  imageCount?: number;
  /** Largest texture edge in pixels, where it could be read (PNG/JPEG). */
  maxTextureSize?: number;
  /** Rough GPU memory the textures need once decoded, bytes. */
  textureMemoryBytes?: number;
  /** Metres, after normalising to Y-up. */
  dimensions?: NeedDimensions;
  /** Axis-aligned bounds in the model's own space (its pivot), metres. */
  bounds?: { min: [number, number, number]; max: [number, number, number] };
  /** True when the model's base sits on y=0 and its pivot is at the footprint centre. */
  groundAligned?: boolean;
  /** Where the pivot sits relative to the model: base height above/below the origin and the footprint centre's offset from it. */
  origin?: { groundOffset: number; pivotX: number; pivotZ: number };
  /** True when the proportions suggest the model is not upright (e.g. a Z-up export lying on its side). */
  orientationSuspect?: boolean;
  /** Axis-aligned collision footprint on the ground plane, metres; the offsets are of its centre from the pivot. */
  footprint?: { width: number; depth: number; offsetX?: number; offsetZ?: number };
}

/** A lower-detail stand-in for an asset, loaded at a distance. Reserved: nothing generates or selects LODs yet. */
export interface AssetLod {
  level: number;
  /** Where the LOD's GLB lives, same rules as `CuratedAsset.modelUrl`. */
  modelUrl?: string;
  triangleCount?: number;
  /** Camera distance (m) beyond which this LOD replaces the previous level. */
  minDistance?: number;
}

export interface CuratedAsset {
  id: string;
  sourceSlug: string;
  source: AssetSource;
  type: AssetType;
  name: string;
  categories: string[];
  tags: string[];
  thumbnailUrl: string;
  pbr: PBRValues;
  compatibleStyles: StyleKey[];
  contentHash?: string;
  status: AssetStatus;
  importedAt: string;
  isDuplicate?: boolean;
  duplicateOf?: string;

  // ── Reusable-library metadata (all optional: assets imported before it existed keep working unchanged) ──
  /** Object family for retrieval ("gazebo", "fire-pit"…). Material and HDRI assets have none. */
  family?: AssetCategory;
  styleTags?: string[];
  contextTags?: string[];
  /** Real-world size in metres; generation scales the asset to a requested footprint within a limited range. */
  dimensions?: NeedDimensions;
  license?: AssetLicense;
  /** Absent means "global" (the only kind that existed before). */
  scope?: AssetScope;
  /** The Need this asset was produced to satisfy. */
  needId?: string;
  validation?: AssetValidationReport;
  /**
   * Remote GLB to load instead of the locally stored file (future generated assets). Uploaded GLBs need none:
   * their bytes live in IndexedDB under the asset id (`lib/assets/glbStorage`).
   */
  modelUrl?: string;
  /** Future level-of-detail chain, nearest first. */
  lods?: AssetLod[];
  /** Usage/success history, updated as generations reuse the asset. */
  usageCount?: number;
  successCount?: number;
  failureCount?: number;
}

/** Normalised shape returned by the /api/admin/sources proxy for both Poly Haven and ambientCG */
export interface BrowseAsset {
  sourceSlug: string;
  source: AssetSource;
  name: string;
  thumbnailUrl: string;
  categories: string[];
  tags: string[];
}
