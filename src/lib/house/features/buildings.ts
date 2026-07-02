import type { BuildingConfig, BuildingKind, MaterialsConfig, RoofType } from "@/types/house";
import type { HousePrimitive } from "../types";
import {
  BUILDING_LIMITS,
  DOOR_PANEL_THICKNESS,
  FLOOR_THICKNESS,
  FRAME_BORDER,
  FRAME_THICKNESS,
  LEVEL_HEIGHT,
  MATERIAL_COLORS,
  SITE_POSITION_LIMIT,
  WALL_HEIGHT,
} from "../constants";
import { buildFloorSlabPrimitive, buildWallRingPrimitives, translatePrimitive } from "../primitiveBuilders";
import { getWallAnchorForFootprint, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { buildFlatRoof } from "../roof/flatRoof";
import { buildGableRoof } from "../roof/gableRoof";
import { buildHipRoof } from "../roof/hipRoof";
import { clampNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

const BUILDING_KINDS: BuildingKind[] = ["villa", "restaurant", "reception"];
const ROOF_TYPES: RoofType[] = ["flat", "gable", "hip"];

export function validateBuilding(raw: unknown): FeatureValidation<BuildingConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const kindRaw = typeof o.kind === "string" ? o.kind : "";
  const kind = BUILDING_KINDS.includes(kindRaw as BuildingKind) ? (kindRaw as BuildingKind) : "villa";
  if (kind !== kindRaw) warnings.push(`Unknown "kind" value ${JSON.stringify(kindRaw)} — defaulting to "villa".`);

  const roofRaw = typeof o.roof === "string" ? o.roof : "";
  const roof = ROOF_TYPES.includes(roofRaw as RoofType) ? (roofRaw as RoofType) : "flat";
  if (roof !== roofRaw) warnings.push(`Unknown "roof" type ${JSON.stringify(roofRaw)} — defaulting to "flat".`);

  const width = clampNumber(values.width, BUILDING_LIMITS.width.min, BUILDING_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, BUILDING_LIMITS.depth.min, BUILDING_LIMITS.depth.max, "depth", warnings);
  const floors = clampNumber(
    Math.round(typeof o.floors === "number" ? o.floors : 1),
    BUILDING_LIMITS.floors.min,
    BUILDING_LIMITS.floors.max,
    "floors",
    warnings
  );
  const x = clampNumber(values.x, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x", warnings);
  const z = clampNumber(values.z, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z", warnings);

  return { value: { kind, x, z, width, depth, floors, roof }, errors: [], warnings };
}

/**
 * A freestanding structure: floor + walls + roof per the shared builders
 * (same as the main house and garage), translated to its own site position,
 * plus a deterministically-placed door and a couple of windows on its south
 * face so it reads as a real building without tracking them separately.
 */
export function buildBuilding(
  config: BuildingConfig,
  materials: MaterialsConfig,
  index: number
): HousePrimitive[] {
  const footprint = { center: [config.x, config.z] as [number, number], width: config.width, depth: config.depth };
  const exteriorMaterial = resolveMaterial(materials.exterior);
  const roofMaterial = resolveMaterial(materials.roof);
  const trim = resolveMaterial(materials.trim);
  const glass = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });

  const idPrefix = `building-${index}`;
  const kindLabel = config.kind.charAt(0).toUpperCase() + config.kind.slice(1);
  const label = `${kindLabel} ${index + 1}`;
  const primitives: HousePrimitive[] = [];

  for (let level = 0; level < config.floors; level++) {
    const floorY = level * LEVEL_HEIGHT;
    primitives.push(
      buildFloorSlabPrimitive(
        footprint,
        floorY,
        FLOOR_THICKNESS,
        `${idPrefix}-floor-${level}`,
        `${label} Floor ${level + 1}`,
        MATERIAL_COLORS.floor
      )
    );
    primitives.push(
      ...buildWallRingPrimitives(
        footprint,
        floorY + FLOOR_THICKNESS,
        WALL_HEIGHT,
        `${idPrefix}-wall-${level}`,
        `${label} Wall ${level + 1}`,
        exteriorMaterial.color,
        [],
        exteriorMaterial
      )
    );
  }

  const roofBaseY = config.floors * LEVEL_HEIGHT;
  const roofBuilders: Record<RoofType, typeof buildFlatRoof> = {
    flat: buildFlatRoof,
    gable: buildGableRoof,
    hip: buildHipRoof,
  };
  const localRoof = roofBuilders[config.roof](config.width, config.depth, roofBaseY, idPrefix, roofMaterial, exteriorMaterial);
  primitives.push(...localRoof.map((p) => translatePrimitive(p, config.x, config.z)));

  const southAnchor = getWallAnchorForFootprint(footprint.center, config.width, config.depth, FLOOR_THICKNESS, "south");

  const doorWidth = Math.min(1.2, config.width * 0.18);
  const doorHeight = 2.1;
  const doorBase = pointOnWall(southAnchor, southAnchor.length / 2);
  const doorPos = offsetOutward([doorBase[0], FLOOR_THICKNESS + doorHeight / 2, doorBase[2]], southAnchor, DOOR_PANEL_THICKNESS / 2);
  primitives.push({
    kind: "box",
    id: `${idPrefix}-door`,
    category: "building",
    label: `${label} Door`,
    position: doorPos,
    rotation: [0, 0, 0],
    size: wallMountedSize("south", doorWidth, doorHeight, DOOR_PANEL_THICKNESS),
    color: MATERIAL_COLORS.door,
  });

  const windowWidth = Math.min(1.4, config.width * 0.15);
  const windowHeight = 1.3;
  const windowY = FLOOR_THICKNESS + 0.9 + windowHeight / 2;
  const windowOffsets = [southAnchor.length * 0.18, southAnchor.length * 0.82];
  windowOffsets.forEach((offset, wi) => {
    const base = pointOnWall(southAnchor, offset);
    const framePos = offsetOutward([base[0], windowY, base[2]], southAnchor, FRAME_THICKNESS / 2);
    const glassPos = offsetOutward([base[0], windowY, base[2]], southAnchor, FRAME_THICKNESS + 0.02);
    primitives.push(
      {
        kind: "box",
        id: `${idPrefix}-window-${wi}-frame`,
        category: "building",
        label: `${label} Window Frame`,
        position: framePos,
        rotation: [0, 0, 0],
        size: wallMountedSize("south", windowWidth + FRAME_BORDER * 2, windowHeight + FRAME_BORDER * 2, FRAME_THICKNESS),
        color: trim.color,
        roughness: trim.roughness,
        metalness: trim.metalness,
      },
      {
        kind: "box",
        id: `${idPrefix}-window-${wi}-glass`,
        category: "building",
        label: `${label} Window Glass`,
        position: glassPos,
        rotation: [0, 0, 0],
        size: wallMountedSize("south", windowWidth, windowHeight, 0.03),
        color: glass.color,
        roughness: glass.roughness,
        metalness: glass.metalness,
        transparent: glass.transparent,
        opacity: glass.opacity,
      }
    );
  });

  return primitives.map((p) => ({ ...p, category: "building" as const }));
}
