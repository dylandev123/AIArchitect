import type { BuildingKind, LandscapeKind, RoomType } from "@/types/house";

export const WALL_HEIGHT = 3;
export const WALL_THICKNESS = 0.2;
export const FLOOR_THICKNESS = 0.2;
export const ROOF_THICKNESS = 0.25;
export const ROOF_OVERHANG = 0.60;
export const LEVEL_HEIGHT = WALL_HEIGHT + FLOOR_THICKNESS;

export const FRAME_BORDER = 0.07;
export const FRAME_THICKNESS = 0.12;
export const GLASS_THICKNESS = 0.04;
export const DOOR_PANEL_THICKNESS = 0.07;
export const RAILING_POST_SIZE = 0.08;
export const RAILING_RAIL_THICKNESS = 0.06;
export const PAVING_THICKNESS = 0.1;
/** Thin interior partition wall between rooms — thinner than structural exterior walls. */
export const PARTITION_WALL_THICKNESS = 0.10;
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
export const ROOM_WALL_HEIGHT = 1.4;
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

export const PORCH_LIMITS = {
  width: { min: 1.5, max: 30 },
  depth: { min: 1.2, max: 6 },
};

export const CHIMNEY_LIMITS = {
  width: { min: 0.6, max: 3 },
  depth: { min: 0.5, max: 2.5 },
};

export const CURVED_WALL_LIMITS = {
  radius: { min: 1.5, max: 40 },
  sweep: { min: 20, max: 360 },
  height: { min: 0.6, max: 12 },
  thickness: { min: 0.15, max: 1.2 },
};

export const ARCH_LIMITS = {
  width: { min: 1, max: 8 },
  height: { min: 1.8, max: 6 },
  depth: { min: 0.1, max: 1.2 },
};

export const BAY_LIMITS = {
  width: { min: 1.5, max: 8 },
  depth: { min: 0.6, max: 4 },
  levels: { min: 1, max: 6 },
};

export const FOUNDATION_LIMITS = {
  steps: { min: 1, max: 4 },
  riser: { min: 0.08, max: 0.4 },
  projection: { min: 0.08, max: 0.6 },
};

export const STAIRS_LIMITS = {
  width: { min: 0.9, max: 6 },
  rise: { min: 0.3, max: 4 },
};

export const DORMER_LIMITS = {
  width: { min: 1, max: 4 },
};

export const CROSS_GABLE_LIMITS = {
  width: { min: 2.5, max: 20 },
};

export const RETAINING_WALL_LIMITS = {
  height: { min: 0.3, max: 6 },
  thickness: { min: 0.2, max: 1.2 },
  bend: { min: -30, max: 30 },
  length: { min: 1, max: 200 },
};

export const PATH_LIMITS = {
  width: { min: 0.6, max: 6 },
  bend: { min: -30, max: 30 },
  length: { min: 1, max: 250 },
};

export const WATERWAY_LIMITS = {
  width: { min: 1, max: 24 },
  bend: { min: -40, max: 40 },
  meander: { min: 0, max: 1 },
  length: { min: 6, max: 400 },
};

export const ROCK_LIMITS = {
  radius: { min: 0.5, max: 20 },
  count: { min: 1, max: 24 },
  size: { min: 0.4, max: 3 },
};

export const SLOPE_LIMITS = {
  width: { min: 3, max: 80 },
  depth: { min: 3, max: 80 },
  rise: { min: 0.3, max: 8 },
};

export const DECK_LIMITS = {
  width: { min: 1, max: 40 },
  depth: { min: 1, max: 40 },
};

/**
 * Base colours used by procedurally-generated primitives (walls, floors, glass, etc.).
 * Tuned for Sims-style bright outdoor environments — saturated, clean, game-friendly.
 */
export const MATERIAL_COLORS = {
  floor:      "#cec9bc",   // warm muted stone
  wall:       "#ede9e1",   // clean warm stucco
  roof:       "#486e90",   // deeper slate-blue tile
  glass:      "#88d4f0",   // rich sky-blue glass
  frame:      "#352014",   // deep espresso trim
  door:       "#7a4c24",   // warm rich brown door
  garageDoor: "#a8acb2",   // cool silver garage panel
  railing:    "#1e3350",   // deep navy-steel railing
  paving:     "#bab6aa",   // warm concrete
  driveway:   "#707880",   // deep cool-gray asphalt
  poolWater:  "#00c8e8",   // vivid Sims-cyan pool (matches WaterSurface)
  poolCoping: "#dedad0",   // warm pool deck
} as const;

/** Sims-style room floor tones — warm, distinct, and easy to read from top-down. */
export const ROOM_FLOOR_COLORS: Record<RoomType, string> = {
  kitchen:  "#e8e2d4",
  living:   "#c8a870",
  bedroom:  "#d4b880",
  bathroom: "#b8d8e8",
  hallway:  "#d0cbc0",
  dining:   "#c8b48a",
  office:   "#c0bab4",
  laundry:  "#d8d8d8",
  gym:      "#2e3030",
};

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  kitchen:  "Kitchen",
  living:   "Living Room",
  bedroom:  "Bedroom",
  bathroom: "Bathroom",
  hallway:  "Hallway",
  dining:   "Dining Room",
  office:   "Office",
  laundry:  "Laundry Room",
  gym:      "Gym",
};

export const BUILDING_KIND_LABELS: Record<BuildingKind, string> = {
  villa: "Villa",
  restaurant: "Restaurant",
  reception: "Reception",
  gazebo: "Gazebo",
  outdoor_bar: "Outdoor Bar",
  shed: "Shed",
  detached_garage: "Detached Garage",
};

export const BUILDING_DEFAULT_SIZE: Record<BuildingKind, { width: number; depth: number; floors: number }> = {
  villa: { width: 8, depth: 7, floors: 1 },
  restaurant: { width: 14, depth: 10, floors: 1 },
  reception: { width: 12, depth: 9, floors: 1 },
  gazebo: { width: 5, depth: 5, floors: 1 },
  outdoor_bar: { width: 6, depth: 3, floors: 1 },
  shed: { width: 4, depth: 3.5, floors: 1 },
  detached_garage: { width: 6.5, depth: 6, floors: 1 },
};

export const LANDSCAPE_KIND_LABELS: Record<LandscapeKind, string> = {
  garden: "Garden",
  lawn: "Lawn",
  clearing: "Clearing",
};

export const LANDSCAPE_COLORS: Record<LandscapeKind, string> = {
  garden: "#2da03c",   // rich garden green
  lawn:   "#50c038",   // bright open lawn
  clearing: "#8dbf58", // open meadow, trampled lighter than the forest floor around it
};
