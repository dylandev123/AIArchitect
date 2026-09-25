import type {
  BayForm,
  BuildingKind,
  DeckShape,
  ExteriorOptions,
  LandscapeKind,
  MaterialType,
  MaterialZone,
  PathSurface,
  PoolShape,
  RoofType,
  RoomType,
  SlopeForm,
  StairForm,
  WaterwayKind,
} from "@/types/house";
import {
  COLUMN_STYLES,
  DOOR_STYLES,
  RAILING_STYLES,
  ROOF_FORMS,
  STYLE_PRESETS,
  SURFACES,
  WALL_FINISHES,
  WINDOW_STYLES,
} from "@/lib/house/catalog";
import { MATERIAL_TYPES, MATERIAL_ZONES } from "@/lib/house/materials";
import { FEATURE_TYPES } from "@/lib/house/features/featureTypes";
import { COMPASS_SIDES, SITE_ENVIRONMENTS, TERRAIN_SLOPES } from "@/lib/house/siteSettings";
import { DESIGN_TIERS } from "@/lib/house/tiers";

type NonEmpty<T> = [T, ...T[]];

function keysOf<T extends string>(record: Record<T, unknown>): NonEmpty<T> {
  return Object.keys(record) as NonEmpty<T>;
}

/** Enum-valued exteriorOptions keys and the catalog that defines their legal values. */
export const EXTERIOR_ENUM_OPTIONS = {
  style: keysOf(STYLE_PRESETS),
  wallFinish: keysOf(WALL_FINISHES),
  windowStyle: keysOf(WINDOW_STYLES),
  doorStyle: keysOf(DOOR_STYLES),
  railingStyle: keysOf(RAILING_STYLES),
  columnStyle: keysOf(COLUMN_STYLES),
  patioSurface: keysOf(SURFACES),
  poolTile: keysOf(SURFACES),
} satisfies Partial<Record<keyof ExteriorOptions, readonly string[]>>;

/** Imported-asset (PBR texture) keys in exteriorOptions, each paired with its UV-scale key. */
export const EXTERIOR_ASSET_OPTIONS = [
  ["patioAssetId", "patioUvScale"],
  ["poolAssetId", "poolUvScale"],
  ["drivewayAssetId", "drivewayUvScale"],
] as const satisfies readonly (readonly [keyof ExteriorOptions, keyof ExteriorOptions])[];

export const ROOF_TYPES: NonEmpty<RoofType> = keysOf(ROOF_FORMS);
export const MATERIAL_TYPE_LIST = MATERIAL_TYPES as NonEmpty<MaterialType>;
export const MATERIAL_ZONE_LIST = MATERIAL_ZONES as NonEmpty<MaterialZone>;
export const ROOM_TYPES: NonEmpty<RoomType> = [
  "kitchen", "living", "bedroom", "bathroom", "hallway", "dining", "office", "laundry", "gym",
];
export const BUILDING_KINDS: NonEmpty<BuildingKind> = ["villa", "restaurant", "reception", "gazebo", "outdoor_bar", "shed", "detached_garage"];
export const LANDSCAPE_KINDS: NonEmpty<LandscapeKind> = ["garden", "lawn", "clearing"];
export const POOL_SHAPES: NonEmpty<PoolShape> = ["rectangle", "rounded", "oval", "kidney"];
export const DECK_SHAPES: NonEmpty<DeckShape> = ["rectangle", "rounded", "oval", "arc"];
export const BAY_FORMS: NonEmpty<BayForm> = ["angled", "round", "turret"];
export const STAIR_FORMS: NonEmpty<StairForm> = ["straight", "curved", "angled"];
export const PATH_SURFACES: NonEmpty<PathSurface> = ["gravel", "flagstone", "dirt", "boardwalk"];
export const WATERWAY_KINDS: NonEmpty<WaterwayKind> = ["river", "stream"];
export const SLOPE_FORMS: NonEmpty<SlopeForm> = ["mound", "ramp", "terraced"];

/** Compact imported-material reference the client sends with a request. */
export interface AssetRef {
  id: string;
  name: string;
}

/** One-line-per-capability summary for the system prompt; only the requested sections are emitted. */
export function describeCapabilities(sections: {
  roofs?: boolean;
  materials?: boolean;
  exterior?: boolean;
  featureTypes?: boolean;
  site?: boolean;
  assets?: readonly AssetRef[];
}): string {
  const lines: string[] = [];
  if (sections.roofs) lines.push(`Roof types: ${ROOF_TYPES.join(", ")}.`);
  if (sections.materials) {
    lines.push(`Material zones: ${MATERIAL_ZONE_LIST.join(", ")}. Material types: ${MATERIAL_TYPE_LIST.join(", ")}.`);
  }
  if (sections.exterior) {
    for (const [key, values] of Object.entries(EXTERIOR_ENUM_OPTIONS)) lines.push(`exteriorOptions.${key}: ${values.join(" | ")}`);
    lines.push("Set an exteriorOptions key to null to clear it back to the style default.");
  }
  if (sections.site) {
    lines.push(
      `site.environment: ${SITE_ENVIRONMENTS.join(" | ")}`,
      `site.viewDirection / site.approachSide: ${COMPASS_SIDES.join(" | ")}`,
      `site.terrainSlope: ${TERRAIN_SLOPES.join(" | ")}`,
      `site.designTier: ${DESIGN_TIERS.join(" | ")}`
    );
  }
  if (sections.featureTypes) lines.push(`Feature types: ${FEATURE_TYPES.join(", ")}.`);
  if (sections.assets && sections.assets.length > 0) {
    lines.push(
      "Imported PBR materials (set assetId on a material zone, or *AssetId in exteriorOptions; only these ids exist):",
      ...sections.assets.map((a) => `- ${a.id}: ${a.name}`)
    );
  }
  return lines.join("\n");
}
