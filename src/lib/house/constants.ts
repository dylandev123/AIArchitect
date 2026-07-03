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

/**
 * Base colours used by procedurally-generated primitives (walls, floors, glass, etc.).
 * Tuned for Sims-style bright outdoor environments — saturated, clean, game-friendly.
 */
export const MATERIAL_COLORS = {
  floor:      "#d4cfc4",   // warm light stone
  wall:       "#f0ece4",   // clean stucco white
  roof:       "#5a82aa",   // game blue-gray tile roof
  glass:      "#a0e0f8",   // bright reflective sky-blue glass
  frame:      "#4a3420",   // rich dark trim
  door:       "#8a5c30",   // warm honey-brown door
  garageDoor: "#b0b4ba",   // light silver garage
  railing:    "#2a4060",   // deep blue-steel railing
  paving:     "#c4c0b6",   // light warm concrete
  driveway:   "#80858a",   // medium-gray asphalt
  poolWater:  "#00c8e8",   // vivid Sims-cyan pool (matches WaterSurface)
  poolCoping: "#e4e0d8",   // bright pool deck
} as const;

/** Sims-style room floor tones — warm, distinct, and easy to read from top-down. */
export const ROOM_FLOOR_COLORS: Record<RoomType, string> = {
  kitchen:  "#e8e2d4",   // light cream tile
  living:   "#c8a870",   // warm oak
  bedroom:  "#d4b880",   // soft honey wood
  bathroom: "#b8d8e8",   // cool blue-white tile
  hallway:  "#d0cbc0",   // neutral warm stone
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
  garden: "#2da03c",   // rich garden green
  lawn:   "#50c038",   // bright open lawn
};
