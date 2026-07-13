import type { DrivewayConfig, HouseConfig } from "@/types/house";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { DRIVEWAY_LIMITS, MATERIAL_COLORS, PAVING_THICKNESS, SITE_OFFSET_LIMIT } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall } from "../wallAnchor";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";
import type { ResolvedExteriorOptions } from "../catalog/types";

export function validateDriveway(raw: unknown): FeatureValidation<DrivewayConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["width", "length", "offset"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "west");
  if (wall.warning) warnings.push(wall.warning);

  const width = clampNumber(values.width, DRIVEWAY_LIMITS.width.min, DRIVEWAY_LIMITS.width.max, "width", warnings);
  const length = clampNumber(values.length, DRIVEWAY_LIMITS.length.min, DRIVEWAY_LIMITS.length.max, "length", warnings);
  const offset = clampNumber(values.offset, SITE_OFFSET_LIMIT.min, SITE_OFFSET_LIMIT.max, "offset", warnings);

  return { value: { wall: wall.value, offset, width, length }, errors: [], warnings };
}

export function buildDriveway(
  config: DrivewayConfig,
  house: HouseConfig,
  index: number,
  opts?: ResolvedExteriorOptions
): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, 0);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const ground: Vec3 = [base[0], 0, base[2]];
  const center = offsetOutward(ground, anchor, config.length / 2);

  const isNS = config.wall === "north" || config.wall === "south";
  const sizeX = isNS ? config.width : config.length;
  const sizeZ = isNS ? config.length : config.width;

  const assetOverride = opts?.drivewayAssetId
    ? { assetId: opts.drivewayAssetId, uvScale: opts.drivewayUvScale ?? 1 }
    : {};

  return [
    {
      kind: "box",
      id: `driveway-${index}-slab`,
      category: "driveway",
      label: `Driveway ${index + 1}`,
      position: [center[0], PAVING_THICKNESS / 2, center[2]],
      rotation: [0, 0, 0],
      size: [sizeX, PAVING_THICKNESS, sizeZ],
      color: MATERIAL_COLORS.driveway,
      ...assetOverride,
    },
  ];
}
