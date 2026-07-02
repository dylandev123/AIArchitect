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
  | "landscape";

/** Optional PBR-ish overrides; primitives that omit these render with the renderer's defaults. */
interface MaterialFields {
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
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
