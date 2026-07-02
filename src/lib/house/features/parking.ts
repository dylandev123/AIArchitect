import type { ParkingConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { MATERIAL_COLORS, PARKING_LIMITS, PAVING_THICKNESS, SITE_POSITION_LIMIT } from "../constants";
import { clampNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateParking(raw: unknown): FeatureValidation<ParkingConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const x = clampNumber(values.x, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x", warnings);
  const z = clampNumber(values.z, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z", warnings);
  const width = clampNumber(values.width, PARKING_LIMITS.width.min, PARKING_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, PARKING_LIMITS.depth.min, PARKING_LIMITS.depth.max, "depth", warnings);

  return { value: { x, z, width, depth }, errors: [], warnings };
}

const MAX_STRIPES = 12;
const STALL_WIDTH = 2.5;

/** A paved lot plus a handful of painted stall-divider stripes for legibility. */
export function buildParking(config: ParkingConfig, index: number): HousePrimitive[] {
  const idPrefix = `parking-${index}`;
  const primitives: HousePrimitive[] = [
    {
      kind: "box",
      id: `${idPrefix}-lot`,
      category: "parking",
      label: `Parking Lot ${index + 1}`,
      position: [config.x, PAVING_THICKNESS / 2, config.z],
      rotation: [0, 0, 0],
      size: [config.width, PAVING_THICKNESS, config.depth],
      color: MATERIAL_COLORS.driveway,
    },
  ];

  const stallCount = Math.min(MAX_STRIPES, Math.max(0, Math.floor(config.width / STALL_WIDTH) - 1));
  const startX = config.x - config.width / 2;
  for (let i = 1; i <= stallCount; i++) {
    const stripeX = startX + (config.width / (stallCount + 1)) * i;
    primitives.push({
      kind: "box",
      id: `${idPrefix}-stripe-${i}`,
      category: "parking",
      label: `Parking Lot ${index + 1} Stripe`,
      position: [stripeX, PAVING_THICKNESS + 0.005, config.z],
      rotation: [0, 0, 0],
      size: [0.08, 0.01, config.depth * 0.8],
      color: "#e8e8e0",
    });
  }

  return primitives;
}
