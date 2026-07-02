import type { HouseConfig, MaterialsConfig, PatioConfig } from "@/types/house";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { PATIO_LIMITS, PAVING_THICKNESS, SITE_OFFSET_LIMIT } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validatePatio(raw: unknown): FeatureValidation<PatioConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["width", "depth", "offset"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);

  const width = clampNumber(values.width, PATIO_LIMITS.width.min, PATIO_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, PATIO_LIMITS.depth.min, PATIO_LIMITS.depth.max, "depth", warnings);
  const offset = clampNumber(values.offset, SITE_OFFSET_LIMIT.min, SITE_OFFSET_LIMIT.max, "offset", warnings);

  return { value: { wall: wall.value, offset, width, depth }, errors: [], warnings };
}

export function buildPatio(
  config: PatioConfig,
  house: HouseConfig,
  materials: MaterialsConfig,
  index: number
): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, 0);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const ground: Vec3 = [base[0], 0, base[2]];
  const center = offsetOutward(ground, anchor, config.depth / 2);

  const isNS = config.wall === "north" || config.wall === "south";
  const sizeX = isNS ? config.width : config.depth;
  const sizeZ = isNS ? config.depth : config.width;

  const decking = resolveMaterial(materials.decking);

  return [
    {
      kind: "box",
      id: `patio-${index}-slab`,
      category: "patio",
      label: `Patio ${index + 1}`,
      position: [center[0], PAVING_THICKNESS / 2, center[2]],
      rotation: [0, 0, 0],
      size: [sizeX, PAVING_THICKNESS, sizeZ],
      color: decking.color,
      roughness: decking.roughness,
      metalness: decking.metalness,
    },
  ];
}
