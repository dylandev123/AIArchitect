import type { BuildingKind, HouseConfig, LandscapeKind, RoomType } from "@/types/house";
import type { FeatureType } from "./featureTypes";
import { BUILDING_DEFAULT_SIZE, WALL_THICKNESS } from "../constants";
import { pitchedRoof } from "../architecture/roofPlane";

/** Sensible starting values for a newly-added feature, derived from the house's own dimensions. */
export function getDefaultFeatureConfig(type: FeatureType, house: HouseConfig): Record<string, unknown> {
  switch (type) {
    case "window":
      return { wall: "south", level: 0, offset: Math.max(0.5, house.width / 4 - 0.6), width: 1.2, height: 1.4, sill: 0.9 };
    case "door":
      return { wall: "south", level: 0, offset: Math.max(0.5, house.width / 2 - 0.5), width: 1.0, height: 2.1 };
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
    case "deck":
      return { x: 0, z: house.depth / 2 + 4, level: 0, width: 5, depth: 4 };
    case "porch":
      return { wall: "south", offset: Math.max(0, house.width / 2 - 2.5), width: Math.min(5, house.width), depth: 2.4 };
    case "chimney":
      return { wall: "east", offset: Math.max(0, house.depth / 2 - 0.6), width: 1.2, depth: 0.9 };
    case "curvedWall":
      return { x: -(house.width / 2 + 8), z: house.depth / 2 + 6, radius: 6, startAngle: 20, sweep: 140, height: 2.2, thickness: 0.4 };
    case "arch":
      return { wall: "south", level: 0, offset: Math.max(0, house.width / 2 - 1.5), width: 3, height: 3, depth: 0.35 };
    case "bay":
      return { wall: "south", level: 0, offset: Math.max(0, house.width / 2 - 1.5), width: 3, depth: 1, levels: 1, form: "angled" };
    case "foundation":
      return { steps: 2, riser: 0.15, projection: 0.18 };
    case "stairs":
      return { wall: "south", offset: Math.max(0, house.width / 2 - 1), width: 2, rise: 0.9, form: "straight", turn: "right" };
    case "dormer":
    case "crossGable": {
      const roof = pitchedRoof({ ...house, roof: house.roof === "hip" ? "hip" : "gable" });
      const width = type === "dormer" ? 1.8 : 5;
      const [lo, hi] = roof?.usable ?? [0, house.width];
      return { wall: roof?.slopeWalls[0] ?? "south", offset: Math.max(lo, (lo + hi) / 2 - width / 2), width };
    }
    case "retainingWall":
      return { x1: -(house.width / 2 + 4), z1: -(house.depth / 2 + 6), x2: house.width / 2 + 4, z2: -(house.depth / 2 + 6), height: 1.2, thickness: 0.4, bend: 3 };
    case "path":
      return { x1: 0, z1: house.depth / 2 + 1, x2: 4, z2: house.depth / 2 + 14, width: 1.4, bend: 3, surface: "gravel" };
    case "waterway":
      return { kind: "stream", x1: -40, z1: house.depth / 2 + 12, x2: 40, z2: house.depth / 2 + 12, width: 3, bend: 4, meander: 0.6 };
    case "rockCluster":
      return { x: house.width / 2 + 8, z: house.depth / 2 + 6, radius: 3, count: 6, size: 1.4 };
    case "slope":
      return { x: -(house.width / 2 + 10), z: house.depth / 2 + 6, width: 14, depth: 10, rise: 1.6, rotation: 0, form: "mound" };
  }
}

const ROOM_TYPE_SIZE: Record<RoomType, { width: number; depth: number }> = {
  kitchen:  { width: 4.0, depth: 3.8 },
  living:   { width: 5.5, depth: 4.2 },
  bedroom:  { width: 4.0, depth: 3.8 },
  bathroom: { width: 2.8, depth: 3.0 },
  hallway:  { width: 5.0, depth: 1.2 },
  dining:   { width: 4.2, depth: 3.8 },
  office:   { width: 3.5, depth: 3.5 },
  laundry:  { width: 2.8, depth: 2.5 },
  gym:      { width: 5.0, depth: 5.0 },
};

/**
 * Starting values for a new room — cells tile flush (no gap) so successive
 * adds build toward a gapless floor plan. Wraps left-to-right then top-to-bottom.
 */
export function getDefaultRoomConfig(
  type: RoomType,
  house: HouseConfig,
  existingRoomCount: number
): Record<string, unknown> {
  const usableWidth = Math.max(1, house.width - WALL_THICKNESS * 2);
  const usableDepth = Math.max(1, house.depth - WALL_THICKNESS * 2);

  // Scale room to fit within the interior while respecting min proportions
  const base = ROOM_TYPE_SIZE[type];
  const width = Math.min(base.width, usableWidth);
  const depth = Math.min(base.depth, usableDepth);

  const roomsPerRow = Math.max(1, Math.floor(usableWidth / width));
  const col = existingRoomCount % roomsPerRow;
  const row = Math.floor(existingRoomCount / roomsPerRow);

  return {
    type,
    level: 0,
    x: Math.min(col * width, Math.max(0, usableWidth - width)),
    z: Math.min(row * depth, Math.max(0, usableDepth - depth)),
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
  clearing: { width: 16, depth: 12 },
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
