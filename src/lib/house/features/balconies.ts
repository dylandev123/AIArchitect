import type { BalconyConfig, HouseConfig, MaterialsConfig, WallSide } from "@/types/house";
import type { HousePrimitive } from "../types";
import { BALCONY_LIMITS, FLOOR_THICKNESS } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall } from "../wallAnchor";
import { buildFloorSlabPrimitive, buildWallRingPrimitives } from "../primitiveBuilders";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

const OPPOSITE: Record<WallSide, WallSide> = { north: "south", south: "north", east: "west", west: "east" };

export function validateBalcony(raw: unknown, house: HouseConfig): FeatureValidation<BalconyConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["width", "depth", "offset"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);

  const defaultLevel = Math.max(1, house.floors - 1);
  const level = clampNumber(
    Math.round(typeof o.level === "number" ? o.level : defaultLevel),
    0,
    Math.max(0, house.floors - 1),
    "level",
    warnings
  );
  const width = clampNumber(values.width, BALCONY_LIMITS.width.min, BALCONY_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, BALCONY_LIMITS.depth.min, BALCONY_LIMITS.depth.max, "depth", warnings);
  const railingHeight = clampNumber(
    typeof o.railingHeight === "number" ? o.railingHeight : 1.0,
    BALCONY_LIMITS.railingHeight.min,
    BALCONY_LIMITS.railingHeight.max,
    "railingHeight",
    warnings
  );

  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);

  return { value: { wall: wall.value, level, offset, width, depth, railingHeight }, errors: [], warnings };
}

export function buildBalcony(
  config: BalconyConfig,
  house: HouseConfig,
  materials: MaterialsConfig,
  index: number
): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, config.level);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const center = offsetOutward(base, anchor, config.depth / 2);
  const baseY = anchor.origin[1];

  const isNS = config.wall === "north" || config.wall === "south";
  const footprintWidth = isNS ? config.width : config.depth;
  const footprintDepth = isNS ? config.depth : config.width;
  const footprint = { center: [center[0], center[2]] as [number, number], width: footprintWidth, depth: footprintDepth };

  const decking = resolveMaterial(materials.decking);
  const trim = resolveMaterial(materials.trim);

  const idPrefix = `balcony-${index}`;
  const label = `Balcony ${index + 1}`;
  const primitives: HousePrimitive[] = [];

  primitives.push(
    buildFloorSlabPrimitive(
      footprint,
      baseY - FLOOR_THICKNESS,
      FLOOR_THICKNESS,
      `${idPrefix}-platform`,
      `${label} Platform`,
      decking.color,
      decking
    )
  );

  primitives.push(
    ...buildWallRingPrimitives(
      footprint,
      baseY,
      config.railingHeight,
      `${idPrefix}-railing`,
      `${label} Railing`,
      trim.color,
      [OPPOSITE[config.wall]],
      trim
    )
  );

  return primitives.map((p) => ({ ...p, category: "balcony" as const }));
}
