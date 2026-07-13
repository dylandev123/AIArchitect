export type RoofType = "flat" | "gable" | "hip" | "mansard" | "shed" | "butterfly" | "sawtooth";
export type WallSide = "north" | "south" | "east" | "west";
export type RoomType =
  | "kitchen"
  | "living"
  | "bedroom"
  | "bathroom"
  | "hallway"
  | "dining"
  | "office"
  | "laundry"
  | "gym";

export type MaterialType =
  | "concrete" | "stone" | "wood" | "glass" | "metal" | "stucco" | "tile"
  | "brick" | "timber" | "render" | "cedar" | "slate" | "copper" | "terracotta" | "marble" | "zinc" | "corten";
export type MaterialZone = "exterior" | "roof" | "trim" | "decking";

export interface MaterialAssignment {
  material: MaterialType;
  color: string;
  roughness?: number;
  metalness?: number;
  /** ID of an imported CuratedAsset to use as a PBR texture set. Fallback to color when absent. */
  assetId?: string;
  /** UV repeat scale — how many tiles across the face. Default 1. */
  uvScale?: number;
}

export type MaterialsConfig = Record<MaterialZone, MaterialAssignment>;

export interface HouseConfig {
  width: number;
  depth: number;
  floors: number;
  roof: RoofType;
}

/** A window mounted on a wall: a glazed opening positioned by offset along the wall. */
export interface WindowConfig {
  wall: WallSide;
  level: number;
  offset: number;
  width: number;
  height: number;
  sill: number;
}

/** A door mounted on a wall at floor level. */
export interface DoorConfig {
  wall: WallSide;
  level: number;
  offset: number;
  width: number;
  height: number;
}

/** A single-story enclosed structure attached flush against a house wall. */
export interface GarageConfig {
  wall: WallSide;
  offset: number;
  width: number;
  depth: number;
  height: number;
}

/** A cantilevered platform with a railing, attached to an upper-floor wall. */
export interface BalconyConfig {
  wall: WallSide;
  level: number;
  offset: number;
  width: number;
  depth: number;
  railingHeight: number;
}

/** A ground-level paved area adjacent to a wall. */
export interface PatioConfig {
  wall: WallSide;
  offset: number;
  width: number;
  depth: number;
}

/**
 * A sunken water feature. By default positioned relative to the main house's
 * wall (wall/offset/distance), like a patio — but a resort-scale shared pool
 * can instead be placed anywhere on the site by providing siteX/siteZ, which
 * take priority over wall/offset/distance when both are present.
 */
export interface PoolConfig {
  wall: WallSide;
  offset: number;
  distance: number;
  width: number;
  depth: number;
  waterDepth: number;
  siteX?: number;
  siteZ?: number;
}

/** A paved path running outward from a wall. */
export interface DrivewayConfig {
  wall: WallSide;
  offset: number;
  width: number;
  length: number;
}

/**
 * An interior room, positioned by (x, z) offset from the house's interior
 * northwest corner — the same "offset from a reference corner" convention
 * used by every wall-mounted feature, just measured from a corner instead
 * of along a wall.
 */
export interface RoomConfig {
  type: RoomType;
  level: number;
  x: number;
  z: number;
  width: number;
  depth: number;
}

export type BuildingKind = "villa" | "restaurant" | "reception" | "gazebo" | "outdoor_bar";

/**
 * A freestanding structure positioned anywhere on the site (not attached to
 * the main house's wall) — the unit a resort's villas, restaurants, and
 * reception building are made of. Windows and a door are generated
 * automatically from its dimensions, the same way a garage auto-completes
 * itself, so adding 40 of these doesn't mean tracking 40 sub-trees of doors
 * and windows.
 */
export interface BuildingConfig {
  kind: BuildingKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  floors: number;
  roof: RoofType;
}

/** A straight paved road segment between two absolute site points. */
export interface RoadConfig {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
}

/** An absolute-positioned paved lot, e.g. for a reception or restaurant. */
export interface ParkingConfig {
  x: number;
  z: number;
  width: number;
  depth: number;
}

/** A freestanding outdoor platform, ground-level or elevated, positioned anywhere on site. */
export interface DeckConfig {
  x: number;
  z: number;
  level: number;
  width: number;
  depth: number;
  rotation?: number;
}

export type LandscapeKind = "garden" | "lawn";

/** A deliberate, named landscaping area (vs. the site's ambient automatic trees/grass). */
export interface LandscapeZoneConfig {
  kind: LandscapeKind;
  x: number;
  z: number;
  width: number;
  depth: number;
}

// ── Exterior catalog key types ────────────────────────────────────────────────
// These are part of the JSON schema (stored in SiteConfig.exteriorOptions).

export type WallFinishKey =
  | "smooth-stucco" | "rough-stucco" | "board-batten" | "horizontal-lap"
  | "brick" | "stone-veneer" | "cedar-shingle" | "corrugated-metal"
  | "venetian-plaster" | "split-face-block";

export type WindowStyleKey = "casement" | "double-hung" | "picture" | "arched" | "louvered";
export type DoorStyleKey   = "flush" | "paneled" | "glass-panel" | "double" | "pivot";
export type RailingStyleKey = "iron" | "cable" | "glass-panel" | "timber" | "concrete-wall" | "picket";
export type ColumnStyleKey  = "none" | "square-pilaster" | "craftsman-post" | "steel-section" | "board-strip";
export type SurfaceKey =
  | "concrete" | "travertine" | "slate-tile" | "terracotta" | "pebble"
  | "brick-paver" | "teak-deck" | "mosaic-tile";
export type StyleKey =
  | "mediterranean" | "modern-minimalist" | "craftsman" | "industrial"
  | "colonial" | "tropical" | "nordic" | "mid-century";

/** All per-component exterior overrides that can be stored alongside a SiteConfig. */
export interface ExteriorOptions {
  style?:        StyleKey;
  wallFinish?:   WallFinishKey;
  windowStyle?:  WindowStyleKey;
  doorStyle?:    DoorStyleKey;
  railingStyle?: RailingStyleKey;
  columnStyle?:  ColumnStyleKey;
  patioSurface?: SurfaceKey;
  poolTile?:     SurfaceKey;
  /** Imported PBR asset overrides — take priority over surface enum when set. */
  patioAssetId?:    string;
  patioUvScale?:    number;
  poolAssetId?:     string;
  poolUvScale?:     number;
  drivewayAssetId?: string;
  drivewayUvScale?: number;
}

export interface SiteConfig {
  house: HouseConfig;
  materials: MaterialsConfig;
  windows: WindowConfig[];
  doors: DoorConfig[];
  garages: GarageConfig[];
  balconies: BalconyConfig[];
  patios: PatioConfig[];
  pools: PoolConfig[];
  driveways: DrivewayConfig[];
  rooms: RoomConfig[];
  buildings: BuildingConfig[];
  roads: RoadConfig[];
  parking: ParkingConfig[];
  landscaping: LandscapeZoneConfig[];
  decks: DeckConfig[];
  exteriorOptions?: ExteriorOptions;
}

export const DEFAULT_HOUSE_CONFIG: HouseConfig = {
  width: 12,
  depth: 9,
  floors: 1,
  roof: "gable",
};

/**
 * Default material assignments — Sims-inspired: crisp white stucco, blue-slate tile roof,
 * warm wood trim, warm wood decking. Tile gives a clean slightly-glossy roof look.
 */
export const DEFAULT_MATERIALS_CONFIG: MaterialsConfig = {
  exterior: { material: "stucco", color: "#f5f2ec" },
  roof:     { material: "tile",   color: "#5a7a9c" },
  trim:     { material: "wood",   color: "#6b4d2a" },
  decking:  { material: "wood",   color: "#c8a070" },
};

// House 12×9 → usableWidth=11.6, usableDepth=8.6 (interior face to face)
// Room layout tiles gaplessly: cols 4.4+3.8+3.4=11.6, rows 3.8+1.0+3.8=8.6
const DEFAULT_SITE_CONFIG: SiteConfig = {
  house: DEFAULT_HOUSE_CONFIG,
  materials: DEFAULT_MATERIALS_CONFIG,
  windows: [
    // North wall — bedroom row
    { wall: "north", level: 0, offset: 1.8,  width: 1.2, height: 1.4, sill: 0.9 },
    { wall: "north", level: 0, offset: 5.7,  width: 1.2, height: 1.4, sill: 0.9 },
    // South wall — living + kitchen
    { wall: "south", level: 0, offset: 2.4,  width: 1.4, height: 1.4, sill: 0.9 },
    { wall: "south", level: 0, offset: 9.0,  width: 1.2, height: 1.4, sill: 0.9 },
    // East wall — bathroom vent
    { wall: "east",  level: 0, offset: 1.5,  width: 0.7, height: 1.0, sill: 1.1 },
  ],
  doors: [{ wall: "south", level: 0, offset: 5.3, width: 1.0, height: 2.1 }],
  garages: [],
  balconies: [],
  patios: [{ wall: "south", offset: 0, width: 12, depth: 3 }],
  pools: [],
  driveways: [{ wall: "west", offset: 3, width: 3, length: 6 }],
  rooms: [
    { type: "bedroom",  level: 0, x: 0,    z: 0,   width: 4.4,  depth: 3.8 },
    { type: "bedroom",  level: 0, x: 4.4,  z: 0,   width: 3.8,  depth: 3.8 },
    { type: "bathroom", level: 0, x: 8.2,  z: 0,   width: 3.4,  depth: 3.8 },
    { type: "hallway",  level: 0, x: 0,    z: 3.8, width: 11.6, depth: 1.0 },
    { type: "living",   level: 0, x: 0,    z: 4.8, width: 6.6,  depth: 3.8 },
    { type: "kitchen",  level: 0, x: 6.6,  z: 4.8, width: 5.0,  depth: 3.8 },
  ],
  buildings: [],
  roads: [],
  parking: [],
  landscaping: [],
  decks: [],
};

export const DEFAULT_HOUSE_JSON = JSON.stringify(DEFAULT_SITE_CONFIG, null, 2);
