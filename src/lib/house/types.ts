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
  | "deck";

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
}

export interface TriMeshPrimitive extends MaterialFields {
  kind: "triMesh";
  id: string;
  category: PrimitiveCategory;
  label: string;
  /** Flat, world-space, non-indexed triangle vertex list: [x,y,z, x,y,z, ...] */
  vertices: number[];
  color: string;
}

export type HousePrimitive = BoxPrimitive | TriMeshPrimitive;

export interface HouseModel {
  id: string;
  primitives: HousePrimitive[];
}
