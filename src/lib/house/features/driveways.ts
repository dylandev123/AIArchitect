import type { DrivewayConfig, HouseConfig } from "@/types/house";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { DRIVEWAY_LIMITS, MATERIAL_COLORS, PAVING_THICKNESS, SITE_OFFSET_LIMIT } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall } from "../wallAnchor";
import { clampNumber, readNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";
import { bowedCurve, extrudeBand, offsetPolyline, samplesFor, triMeshOf, type P2 } from "../geometry/mesh";
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

  const value: DrivewayConfig = { wall: wall.value, offset, width, length };
  // Only written when given, so a straight driveway's JSON stays exactly as it was.
  if (o.bend !== undefined) value.bend = readNumber(o, "bend", 0, -30, 30, warnings);
  return { value, errors: [], warnings };
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

  if (config.bend) {
    // A curved driveway: a paved band bowed sideways between the wall and its far end.
    const start: P2 = [ground[0], ground[2]];
    const end: P2 = [ground[0] + anchor.outwardNormal[0] * config.length, ground[2] + anchor.outwardNormal[2] * config.length];
    const centre = bowedCurve(start, end, config.bend, samplesFor(config.length, 1.5, 6, 60));
    return [
      triMeshOf(`driveway-${index}-slab`, "driveway", `Driveway ${index + 1}`, extrudeBand(offsetPolyline(centre, config.width / 2), offsetPolyline(centre, -config.width / 2), 0, PAVING_THICKNESS), {
        color: MATERIAL_COLORS.driveway,
        roughness: 0.92,
        metalness: 0,
      }),
    ];
  }

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
