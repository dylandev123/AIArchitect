import type { HouseConfig, MaterialsConfig, WindowConfig } from "@/types/house";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { FRAME_BORDER, FRAME_THICKNESS, GLASS_THICKNESS, MATERIAL_COLORS, WINDOW_LIMITS } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateWindow(raw: unknown, house: HouseConfig): FeatureValidation<WindowConfig> {
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
  const width = clampNumber(values.width, WINDOW_LIMITS.width.min, WINDOW_LIMITS.width.max, "width", warnings);
  const height = clampNumber(values.height, WINDOW_LIMITS.height.min, WINDOW_LIMITS.height.max, "height", warnings);
  const sill = clampNumber(typeof o.sill === "number" ? o.sill : 0.9, WINDOW_LIMITS.sill.min, WINDOW_LIMITS.sill.max, "sill", warnings);

  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);

  return { value: { wall: wall.value, level, offset, width, height, sill }, errors: [], warnings };
}

export function buildWindow(config: WindowConfig, house: HouseConfig, materials: MaterialsConfig, index: number): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, config.level);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const center: Vec3 = [base[0], anchor.origin[1] + config.sill + config.height / 2, base[2]];

  const framePos = offsetOutward(center, anchor, FRAME_THICKNESS / 2);
  const glassPos = offsetOutward(center, anchor, FRAME_THICKNESS + GLASS_THICKNESS / 2);
  const frameSize = wallMountedSize(config.wall, config.width + FRAME_BORDER * 2, config.height + FRAME_BORDER * 2, FRAME_THICKNESS);
  const glassSize = wallMountedSize(config.wall, config.width, config.height, GLASS_THICKNESS);

  const trim = resolveMaterial(materials.trim);
  const glass = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });

  const idPrefix = `window-${index}`;
  const label = `Window ${index + 1}`;
  return [
    {
      kind: "box",
      id: `${idPrefix}-frame`,
      category: "window",
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
      id: `${idPrefix}-glass`,
      category: "window",
      label: `${label} Glass`,
      position: glassPos,
      rotation: [0, 0, 0],
      size: glassSize,
      color: glass.color,
      roughness: glass.roughness,
      metalness: glass.metalness,
      transparent: glass.transparent,
      opacity: glass.opacity,
    },
  ];
}
