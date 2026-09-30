import type { MaterialType } from "@/types/house";

export type PrimitiveCategory =
  | "floor"
  | "wall"
  | "roof"
  | "window"
  | "door"
  | "garage"
  | "balcony"
  | "patio"
  | "pool"
  | "driveway"
  | "room"
  | "building"
  | "road"
  | "parking"
  | "landscape"
  | "deck"
  | "porch"
  | "chimney"
  | "curvedWall"
  | "arch"
  | "bay"
  | "foundation"
  | "stairs"
  | "retainingWall"
  | "path"
  | "waterway"
  | "rock"
  | "slope";

/** Optional PBR overrides; primitives omitting these render with renderer defaults. */
interface MaterialFields {
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  /** Imported CuratedAsset ID — triggers texture loading in PrimitiveMesh. */
  assetId?: string;
  /** UV repeat scale — tiles across the face. Default 1. */
  uvScale?: number;
  /** The surface this primitive is finished in, when its builder owns the finish (V2 Roof Systems). Absent = the renderer infers it from category and colour. */
  surface?: MaterialType;
}

export interface BoxPrimitive extends MaterialFields {
  kind: "box";
  id: string;
  category: PrimitiveCategory;
  label: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
  color: string;
  /** Radius (m) of the rounded edge on every exposed edge. Absent or 0 = a sharp box. */
  bevel?: number;
}

export interface TriMeshPrimitive extends MaterialFields {
  kind: "triMesh";
  id: string;
  category: PrimitiveCategory;
  label: string;
  /** Flat, world-space, non-indexed triangle vertex list: [x,y,z, x,y,z, ...] */
  vertices: number[];
  color: string;
  /**
   * Fitted pattern coordinates, two per vertex, in whole pattern modules: `u` counts units along the eave and `v`
   * courses up the slope, so integers land on joints and a plane always carries a whole number of courses. Absent =
   * the renderer projects metric planar UVs itself.
   */
  uvs?: number[];
  /** Metres one `uvs` module covers: [unit width, course exposure]. */
  uvModule?: [number, number];
}

export type HousePrimitive = BoxPrimitive | TriMeshPrimitive;

export interface HouseModel {
  id: string;
  primitives: HousePrimitive[];
}
