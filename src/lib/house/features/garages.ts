import type { GarageConfig, HouseConfig, MaterialsConfig, WallSide } from "@/types/house";
import type { HousePrimitive } from "../types";
import {
  FLOOR_THICKNESS,
  GARAGE_LIMITS,
  LEVEL_HEIGHT,
  MATERIAL_COLORS,
  ROOF_OVERHANG,
  ROOF_THICKNESS,
  SITE_OFFSET_LIMIT,
} from "../constants";
import { getWallAnchor, getWallAnchorForFootprint, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";
import { buildFloorSlabPrimitive, buildWallRingPrimitives } from "../primitiveBuilders";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

const OPPOSITE: Record<WallSide, WallSide> = { north: "south", south: "north", east: "west", west: "east" };

export function validateGarage(raw: unknown): FeatureValidation<GarageConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["width", "depth", "offset"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "east");
  if (wall.warning) warnings.push(wall.warning);

  const width = clampNumber(values.width, GARAGE_LIMITS.width.min, GARAGE_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, GARAGE_LIMITS.depth.min, GARAGE_LIMITS.depth.max, "depth", warnings);
  const height = clampNumber(
    typeof o.height === "number" ? o.height : LEVEL_HEIGHT - FLOOR_THICKNESS,
    GARAGE_LIMITS.height.min,
    GARAGE_LIMITS.height.max,
    "height",
    warnings
  );
  const offset = clampNumber(values.offset, SITE_OFFSET_LIMIT.min, SITE_OFFSET_LIMIT.max, "offset", warnings);

  return { value: { wall: wall.value, offset, width, depth, height }, errors: [], warnings };
}

export function buildGarage(
  config: GarageConfig,
  house: HouseConfig,
  materials: MaterialsConfig,
  index: number
): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, 0);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const center = offsetOutward(base, anchor, config.depth / 2);
  const baseY = anchor.origin[1];

  const isNS = config.wall === "north" || config.wall === "south";
  const footprintWidth = isNS ? config.width : config.depth;
  const footprintDepth = isNS ? config.depth : config.width;
  const footprint = { center: [center[0], center[2]] as [number, number], width: footprintWidth, depth: footprintDepth };

  const exteriorMaterial = resolveMaterial(materials.exterior);
  const roofMaterial = resolveMaterial(materials.roof);

  const idPrefix = `garage-${index}`;
  const label = `Garage ${index + 1}`;
  const primitives: HousePrimitive[] = [];

  primitives.push(
    buildFloorSlabPrimitive(footprint, 0, FLOOR_THICKNESS, `${idPrefix}-floor`, `${label} Floor`, MATERIAL_COLORS.floor)
  );

  primitives.push(
    ...buildWallRingPrimitives(
      footprint,
      FLOOR_THICKNESS,
      config.height,
      `${idPrefix}-wall`,
      `${label} Wall`,
      exteriorMaterial.color,
      [OPPOSITE[config.wall]],
      exteriorMaterial
    )
  );

  const roofBaseY = FLOOR_THICKNESS + config.height;
  primitives.push({
    kind: "box",
    id: `${idPrefix}-roof`,
    category: "garage",
    label: `${label} Roof`,
    position: [footprint.center[0], roofBaseY + ROOF_THICKNESS / 2, footprint.center[1]],
    rotation: [0, 0, 0],
    size: [footprintWidth + ROOF_OVERHANG, ROOF_THICKNESS, footprintDepth + ROOF_OVERHANG],
    color: roofMaterial.color,
    roughness: roofMaterial.roughness,
    metalness: roofMaterial.metalness,
  });

  const doorAnchor = getWallAnchorForFootprint(footprint.center, footprintWidth, footprintDepth, baseY, config.wall);
  const doorWidth = config.width * 0.85;
  const doorHeight = Math.max(1.8, config.height - 0.4);
  const doorCenterGround = pointOnWall(doorAnchor, doorAnchor.length / 2);
  const doorPos = offsetOutward([doorCenterGround[0], baseY + doorHeight / 2, doorCenterGround[2]], doorAnchor, 0.03);

  primitives.push({
    kind: "box",
    id: `${idPrefix}-door`,
    category: "garage",
    label: `${label} Door`,
    position: doorPos,
    rotation: [0, 0, 0],
    size: wallMountedSize(config.wall, doorWidth, doorHeight, 0.08),
    color: MATERIAL_COLORS.garageDoor,
  });

  return primitives.map((p) => ({ ...p, category: "garage" as const }));
}
