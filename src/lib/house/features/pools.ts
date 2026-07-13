import type { HouseConfig, MaterialsConfig, PoolConfig } from "@/types/house";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { SURFACES } from "../catalog/surfaces";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import {
  MATERIAL_COLORS,
  POOL_COPING_THICKNESS,
  POOL_COPING_WIDTH,
  POOL_LIMITS,
  POOL_WALL_THICKNESS,
  SITE_OFFSET_LIMIT,
  SITE_POSITION_LIMIT,
} from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall } from "../wallAnchor";
import { buildWallRingPrimitives, type RoomFootprint } from "../primitiveBuilders";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validatePool(raw: unknown): FeatureValidation<PoolConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["width", "depth", "offset"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);

  const width = clampNumber(values.width, POOL_LIMITS.width.min, POOL_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, POOL_LIMITS.depth.min, POOL_LIMITS.depth.max, "depth", warnings);
  const distance = clampNumber(
    typeof o.distance === "number" ? o.distance : 2,
    POOL_LIMITS.distance.min,
    POOL_LIMITS.distance.max,
    "distance",
    warnings
  );
  const waterDepth = clampNumber(
    typeof o.waterDepth === "number" ? o.waterDepth : 1.4,
    POOL_LIMITS.waterDepth.min,
    POOL_LIMITS.waterDepth.max,
    "waterDepth",
    warnings
  );
  const offset = clampNumber(values.offset, SITE_OFFSET_LIMIT.min, SITE_OFFSET_LIMIT.max, "offset", warnings);

  const value: PoolConfig = { wall: wall.value, offset, distance, width, depth, waterDepth };

  if (typeof o.siteX === "number" || typeof o.siteZ === "number") {
    const siteXRaw = typeof o.siteX === "number" ? o.siteX : 0;
    const siteZRaw = typeof o.siteZ === "number" ? o.siteZ : 0;
    value.siteX = clampNumber(siteXRaw, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "siteX", warnings);
    value.siteZ = clampNumber(siteZRaw, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "siteZ", warnings);
  }

  return { value, errors: [], warnings };
}

/**
 * The pool's water footprint (center + size) in world XZ, shared with the
 * ground-cutout logic. A resort-scale pool placed via siteX/siteZ skips the
 * wall-relative math entirely and just uses those as the absolute center.
 */
export function getPoolFootprint(config: PoolConfig, house: HouseConfig): RoomFootprint {
  if (typeof config.siteX === "number" && typeof config.siteZ === "number") {
    return { center: [config.siteX, config.siteZ], width: config.width, depth: config.depth };
  }

  const anchor = getWallAnchor(house, config.wall, 0);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const ground: Vec3 = [base[0], 0, base[2]];
  const center = offsetOutward(ground, anchor, config.distance + config.depth / 2);

  const isNS = config.wall === "north" || config.wall === "south";
  const sizeX = isNS ? config.width : config.depth;
  const sizeZ = isNS ? config.depth : config.width;
  return { center: [center[0], center[2]], width: sizeX, depth: sizeZ };
}

/** The deck's outer footprint — used to cut a matching hole in the ground plane. */
export function getPoolDeckFootprint(config: PoolConfig, house: HouseConfig): RoomFootprint {
  const water = getPoolFootprint(config, house);
  return {
    center: water.center,
    width: water.width + POOL_COPING_WIDTH * 2,
    depth: water.depth + POOL_COPING_WIDTH * 2,
  };
}

export function buildPool(
  config: PoolConfig,
  house: HouseConfig,
  materials: MaterialsConfig,
  index: number,
  opts?: ResolvedExteriorOptions
): HousePrimitive[] {
  const footprint = getPoolFootprint(config, house);
  const [cx, cz] = footprint.center;
  const sizeX = footprint.width;
  const sizeZ = footprint.depth;

  const tileEntry  = opts ? SURFACES[opts.poolTile] : null;
  const deckColor  = tileEntry?.defaultColor ?? resolveMaterial(materials.decking).color;
  const deckRough  = tileEntry?.roughness    ?? resolveMaterial(materials.decking).roughness;
  const deckMetal  = tileEntry?.metalness    ?? resolveMaterial(materials.decking).metalness;

  const idPrefix = `pool-${index}`;
  const label = `Pool ${index + 1}`;
  const primitives: HousePrimitive[] = [];

  // Coping deck as a frame (not a solid slab) so the water stays open to the sky.
  const outerW = sizeX + POOL_COPING_WIDTH * 2;
  const deckY = -POOL_COPING_THICKNESS / 2;
  const deckStrips: { id: string; position: Vec3; size: Vec3 }[] = [
    { id: "north", position: [cx, deckY, cz - sizeZ / 2 - POOL_COPING_WIDTH / 2], size: [outerW, POOL_COPING_THICKNESS, POOL_COPING_WIDTH] },
    { id: "south", position: [cx, deckY, cz + sizeZ / 2 + POOL_COPING_WIDTH / 2], size: [outerW, POOL_COPING_THICKNESS, POOL_COPING_WIDTH] },
    { id: "east", position: [cx + sizeX / 2 + POOL_COPING_WIDTH / 2, deckY, cz], size: [POOL_COPING_WIDTH, POOL_COPING_THICKNESS, sizeZ] },
    { id: "west", position: [cx - sizeX / 2 - POOL_COPING_WIDTH / 2, deckY, cz], size: [POOL_COPING_WIDTH, POOL_COPING_THICKNESS, sizeZ] },
  ];
  for (const strip of deckStrips) {
    primitives.push({
      kind: "box",
      id: `${idPrefix}-deck-${strip.id}`,
      category: "pool",
      label: `${label} Deck`,
      position: strip.position,
      rotation: [0, 0, 0],
      size: strip.size,
      color: deckColor,
      roughness: deckRough,
      metalness: deckMetal,
    });
  }

  const shellMat = { color: deckColor, roughness: deckRough, metalness: deckMetal };
  primitives.push(
    ...buildWallRingPrimitives(
      footprint,
      -config.waterDepth,
      config.waterDepth,
      `${idPrefix}-shell`,
      `${label} Shell`,
      deckColor,
      [],
      shellMat
    ).map((p) => ({ ...p, category: "pool" as const }))
  );

  const innerWidth = Math.max(0.3, sizeX - POOL_WALL_THICKNESS * 2);
  const innerDepth = Math.max(0.3, sizeZ - POOL_WALL_THICKNESS * 2);

  primitives.push({
    kind: "box",
    id: `${idPrefix}-floor`,
    category: "pool",
    label: `${label} Floor`,
    position: [cx, -config.waterDepth + 0.03, cz],
    rotation: [0, 0, 0],
    size: [innerWidth, 0.06, innerDepth],
    color: MATERIAL_COLORS.poolWater,
  });

  primitives.push({
    kind: "box",
    id: `${idPrefix}-water`,
    category: "pool",
    label: `${label} Water`,
    position: [cx, -0.15, cz],
    rotation: [0, 0, 0],
    size: [innerWidth, 0.06, innerDepth],
    color: MATERIAL_COLORS.poolWater,
  });

  return primitives;
}
