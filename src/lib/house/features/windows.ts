import type { HouseConfig, MaterialsConfig, WindowConfig } from "@/types/house";
import type { Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { FRAME_BORDER, FRAME_THICKNESS, GLASS_THICKNESS, MATERIAL_COLORS, WINDOW_LIMITS } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { getArchitectureProfile } from "../architecture/profiles";
import { buildWindowDecor } from "../architecture/windowDecor";
import { paintOf } from "../architecture/parts";
import { buildReveal } from "../architecture/reveal";

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

export function buildWindow(config: WindowConfig, house: HouseConfig, materials: MaterialsConfig, index: number, opts?: ResolvedExteriorOptions, recess = 0): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, config.level);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const center: Vec3 = [base[0], anchor.origin[1] + config.sill + config.height / 2, base[2]];

  const framePos = offsetOutward(center, anchor, FRAME_THICKNESS / 2);
  const glassPos = offsetOutward(center, anchor, FRAME_THICKNESS + GLASS_THICKNESS / 2);
  const frameSize = wallMountedSize(config.wall, config.width + FRAME_BORDER * 2, config.height + FRAME_BORDER * 2, FRAME_THICKNESS);
  const glassSize = wallMountedSize(config.wall, config.width, config.height, GLASS_THICKNESS);

  const trim = resolveMaterial(materials.trim);
  const glass = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });

  // Sill ledge — flat shelf projecting outward below the window opening.
  const SILL_PROJ = 0.20;
  const SILL_H = 0.06;
  const sillCenter: Vec3 = [base[0], anchor.origin[1] + config.sill - SILL_H / 2, base[2]];
  const sillPos = offsetOutward(sillCenter, anchor, SILL_PROJ / 2);
  const sillSize = wallMountedSize(config.wall, config.width + FRAME_BORDER * 2 + 0.06, SILL_H, SILL_PROJ);

  const idPrefix = `window-${index}`;
  const label = `Window ${index + 1}`;
  const style = opts?.windowStyle ?? "casement";

  const primitives: HousePrimitive[] = [
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
    {
      kind: "box",
      id: `${idPrefix}-sill`,
      category: "window",
      label: `${label} Sill`,
      position: sillPos,
      rotation: [0, 0, 0],
      size: sillSize,
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    },
  ];

  if (style === "double-hung") {
    // Horizontal centre rail dividing the two sashes
    const railY: Vec3 = [center[0], center[1], center[2]];
    const railPos = offsetOutward(railY, anchor, FRAME_THICKNESS + GLASS_THICKNESS / 2);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-rail`,
      category: "window",
      label: `${label} Centre Rail`,
      position: railPos,
      rotation: [0, 0, 0],
      size: wallMountedSize(config.wall, config.width, 0.05, GLASS_THICKNESS + 0.02),
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    });
  } else if (style === "louvered") {
    // Horizontal louver slats — 5 equally-spaced bars across glass area
    const N = 5;
    const step = config.height / (N + 1);
    for (let i = 1; i <= N; i++) {
      const slY = anchor.origin[1] + config.sill + step * i;
      const slCenter: Vec3 = [base[0], slY, base[2]];
      const slPos = offsetOutward(slCenter, anchor, FRAME_THICKNESS + 0.02);
      primitives.push({
        kind: "box",
        id: `${idPrefix}-louver-${i}`,
        category: "window",
        label: `${label} Louver`,
        position: slPos,
        rotation: [0, 0, 0],
        size: wallMountedSize(config.wall, config.width - 0.06, 0.04, 0.08),
        color: trim.color,
        roughness: trim.roughness,
        metalness: trim.metalness,
      });
    }
  } else if (style === "arched") {
    // Arch lintel cap — wider, slightly taller box sitting above the frame top
    const archCapH = Math.min(0.28, config.width * 0.18);
    const topY = anchor.origin[1] + config.sill + config.height + archCapH / 2;
    const capCenter: Vec3 = [base[0], topY, base[2]];
    const capPos = offsetOutward(capCenter, anchor, FRAME_THICKNESS / 2);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-arch`,
      category: "window",
      label: `${label} Arch Lintel`,
      position: capPos,
      rotation: [0, 0, 0],
      size: wallMountedSize(config.wall, config.width + FRAME_BORDER * 2 + 0.04, archCapH, FRAME_THICKNESS),
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    });
  }

  const profile = getArchitectureProfile(opts?.style);
  if (profile) primitives.push(...buildWindowDecor(profile.windows.decor, config, house, index, paintOf(trim)));
  // Styles with their own surrounds (timber, shutters) keep them; otherwise the tier's reveal recesses the glass.
  if (!profile || profile.windows.decor === "none") {
    primitives.push(
      ...buildReveal(
        `${idPrefix}`, "window", label, anchor, config.wall,
        { center: config.offset + config.width / 2, width: config.width, bottomY: anchor.origin[1] + config.sill, height: config.height },
        FRAME_THICKNESS + GLASS_THICKNESS, recess, paintOf(trim), true
      )
    );
  }

  return primitives;
}
