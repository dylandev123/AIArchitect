import type { DoorConfig, HouseConfig, MaterialsConfig } from "@/types/house";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { DOOR_LIMITS, DOOR_PANEL_THICKNESS, FRAME_BORDER, FRAME_THICKNESS, MATERIAL_COLORS } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateDoor(raw: unknown, house: HouseConfig): FeatureValidation<DoorConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["width", "height", "offset"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);

  const level = clampNumber(Math.round(typeof o.level === "number" ? o.level : 0), 0, Math.max(0, house.floors - 1), "level", warnings);
  const width = clampNumber(values.width, DOOR_LIMITS.width.min, DOOR_LIMITS.width.max, "width", warnings);
  const height = clampNumber(values.height, DOOR_LIMITS.height.min, DOOR_LIMITS.height.max, "height", warnings);

  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);

  return { value: { wall: wall.value, level, offset, width, height }, errors: [], warnings };
}

export function buildDoor(config: DoorConfig, house: HouseConfig, materials: MaterialsConfig, index: number): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, config.level);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const center: Vec3 = [base[0], anchor.origin[1] + config.height / 2, base[2]];

  const framePos = offsetOutward(center, anchor, FRAME_THICKNESS / 2);
  const panelPos = offsetOutward(center, anchor, FRAME_THICKNESS + DOOR_PANEL_THICKNESS / 2);
  const frameSize = wallMountedSize(config.wall, config.width + FRAME_BORDER * 2, config.height + FRAME_BORDER, FRAME_THICKNESS);
  const panelSize = wallMountedSize(config.wall, config.width, config.height, DOOR_PANEL_THICKNESS);

  const trim = resolveMaterial(materials.trim);

  const idPrefix = `door-${index}`;
  const label = `Door ${index + 1}`;
  return [
    {
      kind: "box",
      id: `${idPrefix}-frame`,
      category: "door",
      label: `${label} Frame`,
      position: framePos,
      rotation: [0, 0, 0],
      size: frameSize,
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    },
    {
      kind: "box",
      id: `${idPrefix}-panel`,
      category: "door",
      label: `${label} Panel`,
      position: panelPos,
      rotation: [0, 0, 0],
      size: panelSize,
      color: MATERIAL_COLORS.door,
    },
  ];
}
