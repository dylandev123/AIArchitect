import type { RoadConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { MATERIAL_COLORS, PAVING_THICKNESS, ROAD_LIMITS, SITE_POSITION_LIMIT } from "../constants";
import { clampNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateRoad(raw: unknown): FeatureValidation<RoadConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x1", "z1", "x2", "z2", "width"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const x1 = clampNumber(values.x1, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x1", warnings);
  const z1 = clampNumber(values.z1, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z1", warnings);
  const x2 = clampNumber(values.x2, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x2", warnings);
  const z2 = clampNumber(values.z2, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z2", warnings);
  const width = clampNumber(values.width, ROAD_LIMITS.width.min, ROAD_LIMITS.width.max, "width", warnings);

  if (Math.hypot(x2 - x1, z2 - z1) < 0.5) {
    warnings.push('"x2"/"z2" were nearly identical to "x1"/"z1" — extended the end point.');
    return { value: { x1, z1, x2: x1 + 1, z2, width }, errors: [], warnings };
  }

  return { value: { x1, z1, x2, z2, width }, errors: [], warnings };
}

/** A straight paved segment oriented along its own direction (not axis-aligned, unlike most site features). */
export function buildRoad(config: RoadConfig, index: number): HousePrimitive[] {
  const dx = config.x2 - config.x1;
  const dz = config.z2 - config.z1;
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const cx = (config.x1 + config.x2) / 2;
  const cz = (config.z1 + config.z2) / 2;

  return [
    {
      kind: "box",
      id: `road-${index}-segment`,
      category: "road",
      label: `Road ${index + 1}`,
      position: [cx, PAVING_THICKNESS / 2, cz],
      rotation: [0, angle, 0],
      size: [config.width, PAVING_THICKNESS, length],
      color: MATERIAL_COLORS.driveway,
    },
  ];
}
