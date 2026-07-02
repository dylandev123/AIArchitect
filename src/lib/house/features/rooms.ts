import type { HouseConfig, RoomConfig, RoomType } from "@/types/house";
import type { HousePrimitive } from "../types";
import {
  FLOOR_THICKNESS,
  LEVEL_HEIGHT,
  MATERIAL_COLORS,
  ROOM_FLOOR_COLORS,
  ROOM_FLOOR_FINISH_THICKNESS,
  ROOM_LIMITS,
  ROOM_TYPE_LABELS,
  ROOM_WALL_HEIGHT,
  WALL_THICKNESS,
} from "../constants";
import { buildFloorSlabPrimitive, buildWallRingPrimitives } from "../primitiveBuilders";
import { clampNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

const ROOM_TYPES: RoomType[] = ["kitchen", "living", "bedroom", "bathroom", "hallway"];

export function validateRoom(raw: unknown, house: HouseConfig): FeatureValidation<RoomConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const typeRaw = typeof o.type === "string" ? o.type : "";
  const type = ROOM_TYPES.includes(typeRaw as RoomType) ? (typeRaw as RoomType) : "bedroom";
  if (type !== typeRaw) warnings.push(`Unknown "type" value ${JSON.stringify(typeRaw)} — defaulting to "bedroom".`);

  const level = clampNumber(
    Math.round(typeof o.level === "number" ? o.level : 0),
    0,
    Math.max(0, house.floors - 1),
    "level",
    warnings
  );

  const usableWidth = Math.max(ROOM_LIMITS.width.min, house.width - WALL_THICKNESS * 2);
  const usableDepth = Math.max(ROOM_LIMITS.depth.min, house.depth - WALL_THICKNESS * 2);

  const width = clampNumber(values.width, ROOM_LIMITS.width.min, Math.min(ROOM_LIMITS.width.max, usableWidth), "width", warnings);
  const depth = clampNumber(values.depth, ROOM_LIMITS.depth.min, Math.min(ROOM_LIMITS.depth.max, usableDepth), "depth", warnings);

  const x = clampNumber(values.x, 0, Math.max(0, usableWidth - width), "x", warnings);
  const z = clampNumber(values.z, 0, Math.max(0, usableDepth - depth), "z", warnings);

  return { value: { type, level, x, z, width, depth }, errors: [], warnings };
}

export function buildRoom(room: RoomConfig, house: HouseConfig, index: number): HousePrimitive[] {
  const floorY = room.level * LEVEL_HEIGHT;
  const baseY = floorY + FLOOR_THICKNESS;

  const halfW = house.width / 2;
  const halfD = house.depth / 2;
  const interiorOriginX = -halfW + WALL_THICKNESS;
  const interiorOriginZ = -halfD + WALL_THICKNESS;

  const centerX = interiorOriginX + room.x + room.width / 2;
  const centerZ = interiorOriginZ + room.z + room.depth / 2;
  const footprint = { center: [centerX, centerZ] as [number, number], width: room.width, depth: room.depth };

  const idPrefix = `room-${index}`;
  const label = ROOM_TYPE_LABELS[room.type];
  const primitives: HousePrimitive[] = [];

  primitives.push(
    buildFloorSlabPrimitive(
      footprint,
      baseY,
      ROOM_FLOOR_FINISH_THICKNESS,
      `${idPrefix}-floor`,
      `${label} Floor`,
      ROOM_FLOOR_COLORS[room.type]
    )
  );

  primitives.push(
    ...buildWallRingPrimitives(
      footprint,
      baseY + ROOM_FLOOR_FINISH_THICKNESS,
      ROOM_WALL_HEIGHT,
      `${idPrefix}-wall`,
      `${label} Wall`,
      MATERIAL_COLORS.wall
    )
  );

  return primitives.map((p) => ({ ...p, category: "room" as const }));
}
