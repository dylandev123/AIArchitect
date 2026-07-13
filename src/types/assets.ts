import type { StyleKey } from "./house";

export type AssetType = "pbr-material" | "hdri" | "glb-model" | "vegetation" | "component-pack";
export type AssetSource = "polyhaven" | "ambientcg" | "upload";
export type AssetStatus = "pending" | "approved" | "rejected";

export interface PBRValues {
  baseColor: string;
  roughness: number;
  metalness: number;
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
