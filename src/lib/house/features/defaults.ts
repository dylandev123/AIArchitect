import type { BuildingKind, HouseConfig, LandscapeKind, RoomType } from "@/types/house";
import type { FeatureType } from "./featureTypes";
import { BUILDING_DEFAULT_SIZE, WALL_THICKNESS } from "../constants";

/** Sensible starting values for a newly-added feature, derived from the house's own dimensions. */
export function getDefaultFeatureConfig(type: FeatureType, house: HouseConfig): Record<string, unknown> {
  switch (type) {
    case "window":
      return { wall: "south", level: 0, offset: Math.max(0.5, house.width / 4), width: 1.2, height: 1.4, sill: 0.9 };
    case "door":
      return { wall: "south", level: 0, offset: Math.max(0, house.width / 2 - 0.5), width: 1.0, height: 2.1 };
    case "garage":
      return { wall: "east", offset: 0, width: Math.min(6, house.depth), depth: 6, height: 2.6 };
    case "balcony":
      return {
        wall: "south",
        level: Math.max(1, house.floors - 1),
        offset: Math.max(0, house.width / 4),
        width: Math.min(4, house.width / 2),
        depth: 1.5,
        railingHeight: 1.0,
      };
    case "patio":
      return { wall: "south", offset: 0, width: house.width, depth: 3 };
    case "pool":
      return { wall: "south", offset: Math.max(0, house.width / 4), distance: 3, width: 6, depth: 3, waterDepth: 1.4 };
    case "driveway":
      return { wall: "west", offset: house.depth / 3, width: 3, length: 6 };
    case "room":
      return { type: "bedroom", level: 0, x: 0, z: 0, width: 3.5, depth: 3.5 };
    case "building":
      return { kind: "villa", x: house.width / 2 + 12, z: 0, width: 8, depth: 7, floors: 1, roof: "flat" };
    case "road":
      return { x1: 0, z1: house.depth / 2 + 2, x2: 0, z2: house.depth / 2 + 14, width: 5 };
    case "parking":
      return { x: 0, z: house.depth / 2 + 16, width: 12, depth: 8 };
    case "landscape":
      return { kind: "garden", x: -(house.width / 2 + 6), z: 0, width: 6, depth: 5 };
  }
}

const ROOM_TYPE_SIZE: Record<RoomType, { width: number; depth: number }> = {
  kitchen: { width: 3.5, depth: 3.5 },
  living: { width: 5.0, depth: 4.0 },
  bedroom: { width: 3.5, depth: 3.5 },
  bathroom: { width: 2.2, depth: 2.5 },
  hallway: { width: 4.0, depth: 1.2 },
};

/** Starting values for a new room of a specific type, cascaded slightly so sequential adds don't stack exactly. */
export function getDefaultRoomConfig(
  type: RoomType,
  house: HouseConfig,
  existingRoomCount: number
): Record<string, unknown> {
  const { width, depth } = ROOM_TYPE_SIZE[type];
  const usableWidth = Math.max(width, house.width - WALL_THICKNESS * 2);
  const usableDepth = Math.max(depth, house.depth - WALL_THICKNESS * 2);
  const cascade = existingRoomCount * 1.0;

  return {
    type,
    level: 0,
    x: Math.min(Math.max(0, usableWidth - width), cascade),
    z: Math.min(Math.max(0, usableDepth - depth), cascade),
    width,
    depth,
  };
}

const BUILDING_GRID_COLUMNS = 6;
const BUILDING_GRID_GAP = 4;

/** Starting values for a new building of a specific kind, laid out in a grid east of the main house. */
export function getDefaultBuildingConfig(
  kind: BuildingKind,
  house: HouseConfig,
  existingCount: number
): Record<string, unknown> {
  const { width, depth, floors } = BUILDING_DEFAULT_SIZE[kind];
  const col = existingCount % BUILDING_GRID_COLUMNS;
  const row = Math.floor(existingCount / BUILDING_GRID_COLUMNS);
  const x = house.width / 2 + 10 + col * (width + BUILDING_GRID_GAP);
  const z = row * (depth + BUILDING_GRID_GAP);
  return { kind, x, z, width, depth, floors, roof: "flat" };
}

const LANDSCAPE_SIZE: Record<LandscapeKind, { width: number; depth: number }> = {
  garden: { width: 6, depth: 5 },
  lawn: { width: 10, depth: 8 },
};

/** Starting values for a new landscaping zone of a specific kind, west of the main house. */
export function getDefaultLandscapeConfig(
  kind: LandscapeKind,
  house: HouseConfig,
  existingCount: number
): Record<string, unknown> {
  const { width, depth } = LANDSCAPE_SIZE[kind];
  const cascade = existingCount * 2;
  return { kind, x: -(house.width / 2 + 6 + cascade), z: 0, width, depth };
}
