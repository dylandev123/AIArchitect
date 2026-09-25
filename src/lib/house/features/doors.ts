import type { DoorConfig, HouseConfig, MaterialsConfig } from "@/types/house";
import type { ResolvedExteriorOptions } from "../catalog/types";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { DOOR_LIMITS, DOOR_PANEL_THICKNESS, FRAME_BORDER, FRAME_THICKNESS, MATERIAL_COLORS } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { paintOf } from "../architecture/parts";
import { buildReveal } from "../architecture/reveal";
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

export function buildDoor(config: DoorConfig, house: HouseConfig, materials: MaterialsConfig, index: number, opts?: ResolvedExteriorOptions, recess = 0): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, config.level);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const center: Vec3 = [base[0], anchor.origin[1] + config.height / 2, base[2]];

  const framePos = offsetOutward(center, anchor, FRAME_THICKNESS / 2);
  const panelPos = offsetOutward(center, anchor, FRAME_THICKNESS + DOOR_PANEL_THICKNESS / 2);
  const frameSize = wallMountedSize(config.wall, config.width + FRAME_BORDER * 2, config.height + FRAME_BORDER, FRAME_THICKNESS);
  const panelSize = wallMountedSize(config.wall, config.width, config.height, DOOR_PANEL_THICKNESS);

  const trim = resolveMaterial(materials.trim);

  // Lever handle — horizontal bar near the latch side of the door, at knob height.
  const HANDLE_ALONG = 0.12;
  const HANDLE_H = 0.035;
  const HANDLE_PROJ = 0.055;
  const handleBase = pointOnWall(anchor, config.offset + config.width * 0.78);
  const handleCenter: Vec3 = [handleBase[0], anchor.origin[1] + 1.0, handleBase[2]];
  const handlePos = offsetOutward(handleCenter, anchor, FRAME_THICKNESS + DOOR_PANEL_THICKNESS + HANDLE_PROJ / 2);
  const handleSize = wallMountedSize(config.wall, HANDLE_ALONG, HANDLE_H, HANDLE_PROJ);

  const idPrefix = `door-${index}`;
  const label = `Door ${index + 1}`;
  const style = opts?.doorStyle ?? "flush";

  const primitives: HousePrimitive[] = [
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
    {
      kind: "box",
      id: `${idPrefix}-handle`,
      category: "door",
      label: `${label} Handle`,
      position: handlePos,
      rotation: [0, 0, 0],
      size: handleSize,
      color: "#c09010",
      roughness: 0.28,
      metalness: 0.72,
    },
  ];

  if (style === "paneled") {
    // 4 raised inset panels arranged 2×2 on the door face
    const pW = config.width * 0.36;
    const pHUnit = config.height * 0.36;
    const panelDepth = DOOR_PANEL_THICKNESS + 0.018;
    const offsets: [number, number][] = [
      [-config.width * 0.22,  config.height * 0.22],
      [ config.width * 0.22,  config.height * 0.22],
      [-config.width * 0.22, -config.height * 0.22],
      [ config.width * 0.22, -config.height * 0.22],
    ];
    offsets.forEach(([dx, dy], pi) => {
      const pb = pointOnWall(anchor, config.offset + config.width / 2 + dx);
      const pCenter: Vec3 = [pb[0], anchor.origin[1] + config.height / 2 + dy, pb[2]];
      const pPos = offsetOutward(pCenter, anchor, FRAME_THICKNESS + panelDepth / 2);
      primitives.push({
        kind: "box",
        id: `${idPrefix}-panel-${pi}`,
        category: "door",
        label: `${label} Panel Detail`,
        position: pPos,
        rotation: [0, 0, 0],
        size: wallMountedSize(config.wall, pW, pHUnit, 0.016),
        color: MATERIAL_COLORS.door,
        roughness: 0.55,
      });
    });
  } else if (style === "glass-panel") {
    // Upper 40 % of door replaced with glass
    const glassH = config.height * 0.40;
    const glassY = anchor.origin[1] + config.height - glassH / 2;
    const glassCenter: Vec3 = [base[0], glassY, base[2]];
    const glassPos2 = offsetOutward(glassCenter, anchor, FRAME_THICKNESS + DOOR_PANEL_THICKNESS + 0.01);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-glass`,
      category: "door",
      label: `${label} Glass Panel`,
      position: glassPos2,
      rotation: [0, 0, 0],
      size: wallMountedSize(config.wall, config.width - 0.08, glassH - 0.04, 0.04),
      color: MATERIAL_COLORS.glass,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55,
    });
  } else if (style === "double") {
    // Centre divider creating two door leaves
    const divCenter: Vec3 = [base[0], anchor.origin[1] + config.height / 2, base[2]];
    const divPos = offsetOutward(divCenter, anchor, FRAME_THICKNESS + DOOR_PANEL_THICKNESS + 0.008);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-divider`,
      category: "door",
      label: `${label} Centre Divider`,
      position: divPos,
      rotation: [0, 0, 0],
      size: wallMountedSize(config.wall, 0.05, config.height + 0.02, 0.016),
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    });
  }

  primitives.push(
    ...buildReveal(
      idPrefix, "door", label, anchor, config.wall,
      { center: config.offset + config.width / 2, width: config.width, bottomY: anchor.origin[1], height: config.height },
      FRAME_THICKNESS + DOOR_PANEL_THICKNESS, recess, paintOf(trim), false
    )
  );

  // A proper threshold step at ground-floor doors once the design invests in detail.
  if (recess >= 0.1 && config.level === 0) {
    const stepDepth = 0.5;
    const stepBase = pointOnWall(anchor, config.offset + config.width / 2);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-threshold`,
      category: "door",
      label: `${label} Threshold`,
      position: offsetOutward([stepBase[0], anchor.origin[1] / 2, stepBase[2]], anchor, stepDepth / 2),
      rotation: [0, 0, 0],
      size: wallMountedSize(config.wall, config.width + 0.5, anchor.origin[1], stepDepth),
      color: trim.color,
      roughness: 0.85,
      metalness: 0,
    });
  }

  return primitives;
}
