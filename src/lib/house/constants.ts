import type { BuildingKind, LandscapeKind, RoomType } from "@/types/house";

export const WALL_HEIGHT = 3;
export const WALL_THICKNESS = 0.2;
export const FLOOR_THICKNESS = 0.2;
export const ROOF_THICKNESS = 0.25;
export const ROOF_OVERHANG = 0.4;
export const LEVEL_HEIGHT = WALL_HEIGHT + FLOOR_THICKNESS;

export const FRAME_BORDER = 0.08;
export const FRAME_THICKNESS = 0.08;
export const GLASS_THICKNESS = 0.03;
export const DOOR_PANEL_THICKNESS = 0.06;
export const RAILING_POST_SIZE = 0.08;
export const RAILING_RAIL_THICKNESS = 0.06;
export const PAVING_THICKNESS = 0.1;
export const POOL_COPING_WIDTH = 0.4;
export const POOL_COPING_THICKNESS = 0.1;
export const POOL_WALL_THICKNESS = 0.15;

export const HOUSE_LIMITS = {
  width: { min: 2, max: 100 },
  depth: { min: 2, max: 100 },
  floors: { min: 1, max: 12 },
};

export const WINDOW_LIMITS = {
  width: { min: 0.3, max: 4 },
  height: { min: 0.3, max: 3 },
  sill: { min: 0, max: 2.5 },
};

export const DOOR_LIMITS = {
  width: { min: 0.6, max: 3 },
  height: { min: 1.5, max: 3 },
};

export const GARAGE_LIMITS = {
  width: { min: 2, max: 20 },
  depth: { min: 2, max: 20 },
  height: { min: 2, max: 6 },
};

export const BALCONY_LIMITS = {
  width: { min: 1, max: 20 },
  depth: { min: 0.6, max: 6 },
  railingHeight: { min: 0.6, max: 1.4 },
};

export const PATIO_LIMITS = {
  width: { min: 1, max: 30 },
  depth: { min: 1, max: 30 },
};

export const POOL_LIMITS = {
  width: { min: 2, max: 25 },
  depth: { min: 2, max: 25 },
  distance: { min: 0, max: 30 },
  waterDepth: { min: 0.5, max: 4 },
};

export const DRIVEWAY_LIMITS = {
  width: { min: 1.5, max: 8 },
  length: { min: 1, max: 40 },
};

export const ROOM_LIMITS = {
  width: { min: 0.9, max: 20 },
  depth: { min: 0.9, max: 20 },
};

/** Shorter than a structural wall — interior partitions are a floor-plan diagram, not a full ceiling-height wall. */
export const ROOM_WALL_HEIGHT = 1.1;
export const ROOM_FLOOR_FINISH_THICKNESS = 0.02;

/** Generic bound for offsets that aren't constrained by a wall's own length (garage, patio, pool, driveway). */
export const SITE_OFFSET_LIMIT = { min: 0, max: 200 };

/** Bound for absolute, sign-aware site coordinates (buildings/roads/parking/landscaping can sit on either side of the main house). */
export const SITE_POSITION_LIMIT = { min: -300, max: 300 };

export const BUILDING_LIMITS = {
  width: { min: 3, max: 40 },
  depth: { min: 3, max: 40 },
  floors: { min: 1, max: 6 },
};

export const ROAD_LIMITS = {
  width: { min: 2, max: 12 },
};

export const PARKING_LIMITS = {
  width: { min: 3, max: 60 },
  depth: { min: 3, max: 60 },
};

export const LANDSCAPE_LIMITS = {
  width: { min: 1, max: 60 },
  depth: { min: 1, max: 60 },
};

export const MATERIAL_COLORS = {
  floor: "#c9c2b0",
  wall: "#e9e4d8",
  roof: "#454b54",
  glass: "#9fc4d8",
  frame: "#5b4a3a",
  door: "#6b4a35",
  garageDoor: "#8a8d92",
  railing: "#3a3f47",
  paving: "#aba79c",
  driveway: "#6b6d70",
  poolWater: "#3aa0c4",
  poolCoping: "#d8d3c5",
} as const;

export const ROOM_FLOOR_COLORS: Record<RoomType, string> = {
  kitchen: "#d8d2c4",
  living: "#b89169",
  bedroom: "#c9a877",
  bathroom: "#cfdbe0",
  hallway: "#cabfa9",
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  kitchen: "Kitchen",
  living: "Living Room",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  hallway: "Hallway",
};

export const BUILDING_KIND_LABELS: Record<BuildingKind, string> = {
  villa: "Villa",
  restaurant: "Restaurant",
  reception: "Reception",
};

export const BUILDING_DEFAULT_SIZE: Record<BuildingKind, { width: number; depth: number; floors: number }> = {
  villa: { width: 8, depth: 7, floors: 1 },
  restaurant: { width: 14, depth: 10, floors: 1 },
  reception: { width: 12, depth: 9, floors: 1 },
};

export const LANDSCAPE_KIND_LABELS: Record<LandscapeKind, string> = {
  garden: "Garden",
  lawn: "Lawn",
};

export const LANDSCAPE_COLORS: Record<LandscapeKind, string> = {
  garden: "#5d7a4a",
  lawn: "#7fa05f",
};
