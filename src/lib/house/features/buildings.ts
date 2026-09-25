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
  PAVING_THICKNESS,
  SITE_POSITION_LIMIT,
  WALL_HEIGHT,
} from "../constants";
import { buildFloorSlabPrimitive, buildWallRingPrimitives, translatePrimitive } from "../primitiveBuilders";
import { getWallAnchorForFootprint, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";
import { resolveMaterial } from "../materials";
import { buildFlatRoof } from "../roof/flatRoof";
import { buildGableRoof } from "../roof/gableRoof";
import { buildHipRoof } from "../roof/hipRoof";
import { buildMansardRoof } from "../roof/mansardRoof";
import { buildShedRoof } from "../roof/shedRoof";
import { buildButterflyRoof } from "../roof/butterflyRoof";
import { buildSawtoothRoof } from "../roof/sawtoothRoof";
import { clampNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { buildOutbuilding } from "./outbuildings";

const BUILDING_KINDS: BuildingKind[] = ["villa", "restaurant", "reception", "gazebo", "outdoor_bar", "shed", "detached_garage"];
const ROOF_TYPES: RoofType[] = ["flat", "gable", "hip", "mansard", "shed", "butterfly", "sawtooth"];

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

// ── Per-kind window/door helpers ──────────────────────────────────────────────

function addWindow(
  primitives: HousePrimitive[],
  anchor: ReturnType<typeof getWallAnchorForFootprint>,
  offset: number,
  winWidth: number,
  winHeight: number,
  sill: number,
  idKey: string,
  label: string,
  trim: { color: string; roughness?: number; metalness?: number },
  glass: { color: string; roughness?: number; metalness?: number; transparent?: boolean; opacity?: number }
) {
  const base = pointOnWall(anchor, offset);
  const y = FLOOR_THICKNESS + sill + winHeight / 2;
  const framePos = offsetOutward([base[0], y, base[2]], anchor, FRAME_THICKNESS / 2);
  const glassPos = offsetOutward([base[0], y, base[2]], anchor, FRAME_THICKNESS + 0.02);

  // Infer wall side from anchor outwardNormal
  const wall = anchor.outwardNormal[2] === 1 ? "south" : anchor.outwardNormal[2] === -1 ? "north" : anchor.outwardNormal[0] === 1 ? "east" : "west";

  primitives.push(
    {
      kind: "box",
      id: `${idKey}-frame`,
      category: "building",
      label: `${label} Frame`,
      position: framePos,
      rotation: [0, 0, 0],
      size: wallMountedSize(wall, winWidth + FRAME_BORDER * 2, winHeight + FRAME_BORDER * 2, FRAME_THICKNESS),
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    },
    {
      kind: "box",
      id: `${idKey}-glass`,
      category: "building",
      label: `${label} Glass`,
      position: glassPos,
      rotation: [0, 0, 0],
      size: wallMountedSize(wall, winWidth, winHeight, 0.03),
      color: glass.color,
      roughness: glass.roughness,
      metalness: glass.metalness,
      transparent: glass.transparent,
      opacity: glass.opacity,
    }
  );
}

// ── Gazebo builder ────────────────────────────────────────────────────────────

function buildGazebo(
  config: BuildingConfig,
  materials: MaterialsConfig,
  idPrefix: string,
  label: string
): HousePrimitive[] {
  const { x, z, width, depth } = config;
  const hw = width / 2;
  const hd = depth / 2;
  const decking = resolveMaterial(materials.decking);
  const roofMat = resolveMaterial(materials.roof);
  const trim = resolveMaterial(materials.trim);

  const POST_W = 0.20;
  const POST_H = 2.8;
  const SLAB_H = PAVING_THICKNESS;
  const POST_INSET = POST_W * 0.5;

  const primitives: HousePrimitive[] = [];

  // Floor slab
  primitives.push({
    kind: "box",
    id: `${idPrefix}-floor`,
    category: "building" as const,
    label: `${label} Floor`,
    position: [x, SLAB_H / 2, z],
    rotation: [0, 0, 0],
    size: [width, SLAB_H, depth],
    color: decking.color,
    roughness: decking.roughness,
    metalness: decking.metalness,
  });

  // 4 corner posts
  ([
    [-(hw - POST_INSET), -(hd - POST_INSET), "nw"],
    [ (hw - POST_INSET), -(hd - POST_INSET), "ne"],
    [ (hw - POST_INSET),  (hd - POST_INSET), "se"],
    [-(hw - POST_INSET),  (hd - POST_INSET), "sw"],
  ] as [number, number, string][]).forEach(([dx, dz, dir]) => {
    primitives.push({
      kind: "box",
      id: `${idPrefix}-post-${dir}`,
      category: "building" as const,
      label: `${label} Post`,
      position: [x + dx, SLAB_H + POST_H / 2, z + dz],
      rotation: [0, 0, 0],
      size: [POST_W, POST_H, POST_W],
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    });
  });

  // Hip roof on top of posts (built in local space, then translated to world space)
  const roofBaseY = SLAB_H + POST_H;
  primitives.push(
    ...buildHipRoof(width, depth, roofBaseY, idPrefix, roofMat, trim).map((p) =>
      translatePrimitive(p, x, z)
    )
  );

  return primitives;
}

// ── Outdoor bar builder ───────────────────────────────────────────────────────

function buildOutdoorBar(
  config: BuildingConfig,
  materials: MaterialsConfig,
  idPrefix: string,
  label: string
): HousePrimitive[] {
  const { x, z, width, depth } = config;
  const hw = width / 2;
  const hd = depth / 2;
  const decking = resolveMaterial(materials.decking);
  const exterior = resolveMaterial(materials.exterior);
  const roofMat = resolveMaterial(materials.roof);
  const trim = resolveMaterial(materials.trim);

  const SLAB_H = PAVING_THICKNESS;
  const COUNTER_H = 1.08;
  const COUNTER_D = 0.62;
  const POST_W = 0.16;
  const PERGOLA_H = 2.6;

  const primitives: HousePrimitive[] = [];

  // Floor slab
  primitives.push({
    kind: "box",
    id: `${idPrefix}-floor`,
    category: "building" as const,
    label: `${label} Floor`,
    position: [x, SLAB_H / 2, z],
    rotation: [0, 0, 0],
    size: [width, SLAB_H, depth],
    color: decking.color,
    roughness: decking.roughness,
    metalness: decking.metalness,
  });

  // Bar counter body along north interior face
  const counterZ = z - hd + COUNTER_D / 2;
  primitives.push({
    kind: "box",
    id: `${idPrefix}-counter`,
    category: "building" as const,
    label: `${label} Counter`,
    position: [x, SLAB_H + COUNTER_H / 2, counterZ],
    rotation: [0, 0, 0],
    size: [width - COUNTER_D * 0.5, COUNTER_H, COUNTER_D],
    color: exterior.color,
    roughness: exterior.roughness,
    metalness: exterior.metalness,
  });

  // Counter top surface (trim material, slight overhang)
  primitives.push({
    kind: "box",
    id: `${idPrefix}-countertop`,
    category: "building" as const,
    label: `${label} Counter Top`,
    position: [x, SLAB_H + COUNTER_H + 0.03, counterZ + 0.04],
    rotation: [0, 0, 0],
    size: [width - COUNTER_D * 0.3, 0.06, COUNTER_D + 0.08],
    color: trim.color,
    roughness: trim.roughness,
    metalness: trim.metalness,
  });

  // 4 pergola posts
  ([
    [-(hw - POST_W), -(hd - POST_W), "nw"],
    [ (hw - POST_W), -(hd - POST_W), "ne"],
    [ (hw - POST_W),  (hd - POST_W), "se"],
    [-(hw - POST_W),  (hd - POST_W), "sw"],
  ] as [number, number, string][]).forEach(([dx, dz, dir]) => {
    primitives.push({
      kind: "box",
      id: `${idPrefix}-post-${dir}`,
      category: "building" as const,
      label: `${label} Post`,
      position: [x + dx, SLAB_H + PERGOLA_H / 2, z + dz],
      rotation: [0, 0, 0],
      size: [POST_W, PERGOLA_H, POST_W],
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    });
  });

  // Flat pergola roof slab
  primitives.push({
    kind: "box",
    id: `${idPrefix}-pergola`,
    category: "building" as const,
    label: `${label} Pergola`,
    position: [x, SLAB_H + PERGOLA_H + 0.07, z],
    rotation: [0, 0, 0],
    size: [width + 0.2, 0.12, depth + 0.2],
    color: roofMat.color,
    roughness: roofMat.roughness,
    metalness: roofMat.metalness,
  });

  return primitives;
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildBuilding(
  config: BuildingConfig,
  materials: MaterialsConfig,
  index: number,
  opts?: ResolvedExteriorOptions
): HousePrimitive[] {
  const idPrefix = `building-${index}`;
  const kindLabel = config.kind.charAt(0).toUpperCase() + config.kind.slice(1).replace("_", " ");
  const label = `${kindLabel} ${index + 1}`;

  if (config.kind === "gazebo") return buildGazebo(config, materials, idPrefix, label);
  if (config.kind === "outdoor_bar") return buildOutdoorBar(config, materials, idPrefix, label);
  if (config.kind === "shed" || config.kind === "detached_garage") return buildOutbuilding(config, materials, idPrefix, label, opts);

  const footprint = { center: [config.x, config.z] as [number, number], width: config.width, depth: config.depth };
  const exteriorMaterial = resolveMaterial(materials.exterior);
  const roofMaterial = resolveMaterial(materials.roof);
  const trim = resolveMaterial(materials.trim);
  const glass = resolveMaterial({ material: "glass", color: MATERIAL_COLORS.glass });

  const primitives: HousePrimitive[] = [];

  // ── Shared: floor slabs + wall rings per level ───────────────────────────

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

  // ── Shared: roof ─────────────────────────────────────────────────────────

  const roofBaseY = config.floors * LEVEL_HEIGHT;
  const roofBuilders: Record<RoofType, typeof buildFlatRoof> = {
    flat:      buildFlatRoof,
    gable:     buildGableRoof,
    hip:       buildHipRoof,
    mansard:   buildMansardRoof,
    shed:      buildShedRoof,
    butterfly: buildButterflyRoof,
    sawtooth:  buildSawtoothRoof,
  };
  const localRoof = roofBuilders[config.roof](config.width, config.depth, roofBaseY, idPrefix, roofMaterial, exteriorMaterial);
  primitives.push(...localRoof.map((p) => translatePrimitive(p, config.x, config.z)));

  // ── Per-kind facade ───────────────────────────────────────────────────────

  const southAnchor = getWallAnchorForFootprint(footprint.center, config.width, config.depth, FLOOR_THICKNESS, "south");
  const eastAnchor  = getWallAnchorForFootprint(footprint.center, config.width, config.depth, FLOOR_THICKNESS, "east");
  const westAnchor  = getWallAnchorForFootprint(footprint.center, config.width, config.depth, FLOOR_THICKNESS, "west");

  if (config.kind === "restaurant") {
    // ─ Restaurant: storefront glass, sign band, wide entrance ─────────────

    // Double-glass storefront: 4 tall windows spread across south face
    const storeWinWidth = Math.min(2.2, config.width * 0.18);
    const storeWinHeight = 2.0;
    const storeSill = 0.4;
    const winOffsets = [0.1, 0.3, 0.64, 0.84].map((frac) => southAnchor.length * frac);
    winOffsets.forEach((offset, wi) => {
      addWindow(
        primitives,
        southAnchor,
        offset,
        storeWinWidth,
        storeWinHeight,
        storeSill,
        `${idPrefix}-storefront-${wi}`,
        `${label} Storefront`,
        trim,
        glass
      );
    });

    // Side windows (east + west)
    const sideWinWidth = Math.min(1.4, config.depth * 0.2);
    addWindow(primitives, eastAnchor, eastAnchor.length * 0.3, sideWinWidth, 1.4, 0.8, `${idPrefix}-east-win-0`, `${label} Side Window`, trim, glass);
    addWindow(primitives, eastAnchor, eastAnchor.length * 0.7, sideWinWidth, 1.4, 0.8, `${idPrefix}-east-win-1`, `${label} Side Window`, trim, glass);

    // Entrance door (center)
    const doorWidth = Math.min(1.8, config.width * 0.13);
    const doorHeight = 2.4;
    const doorBase = pointOnWall(southAnchor, southAnchor.length / 2);
    const doorPos = offsetOutward([doorBase[0], FLOOR_THICKNESS + doorHeight / 2, doorBase[2]], southAnchor, DOOR_PANEL_THICKNESS / 2);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-door`,
      category: "building",
      label: `${label} Entrance`,
      position: doorPos,
      rotation: [0, 0, 0],
      size: wallMountedSize("south", doorWidth, doorHeight, DOOR_PANEL_THICKNESS),
      color: "#2a2c30",
    });

    // Sign band at top of south face
    const signBase = pointOnWall(southAnchor, southAnchor.length / 2);
    const signY = FLOOR_THICKNESS + WALL_HEIGHT * 0.82;
    const signPos = offsetOutward([signBase[0], signY, signBase[2]], southAnchor, 0.04);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-sign`,
      category: "building",
      label: `${label} Sign`,
      position: signPos,
      rotation: [0, 0, 0],
      size: wallMountedSize("south", config.width * 0.65, 0.45, 0.07),
      color: "#1a1a20",
      roughness: 0.4,
      metalness: 0.6,
    });

  } else if (config.kind === "reception") {
    // ─ Reception: grand double-door, front canopy, columns ───────────────

    // Double entrance door
    const doorWidth = Math.min(2.0, config.width * 0.16);
    const doorHeight = 2.6;
    const doorBase = pointOnWall(southAnchor, southAnchor.length / 2);
    const doorPos = offsetOutward([doorBase[0], FLOOR_THICKNESS + doorHeight / 2, doorBase[2]], southAnchor, DOOR_PANEL_THICKNESS / 2);
    primitives.push({
      kind: "box",
      id: `${idPrefix}-door`,
      category: "building",
      label: `${label} Entrance`,
      position: doorPos,
      rotation: [0, 0, 0],
      size: wallMountedSize("south", doorWidth, doorHeight, DOOR_PANEL_THICKNESS),
      color: "#c8a84a",
      roughness: 0.25,
      metalness: 0.7,
    });

    // Front canopy projecting outward
    const canopyWidth = config.width * 0.5;
    const canopyDepth = 1.8;
    const canopyY = FLOOR_THICKNESS + WALL_HEIGHT * 0.80;
    const canopyCenter = pointOnWall(southAnchor, southAnchor.length / 2);
    const canopyPos = offsetOutward(
      [canopyCenter[0], canopyY, canopyCenter[2]],
      southAnchor,
      canopyDepth / 2
    );
    primitives.push({
      kind: "box",
      id: `${idPrefix}-canopy`,
      category: "building",
      label: `${label} Canopy`,
      position: canopyPos,
      rotation: [0, 0, 0],
      size: wallMountedSize("south", canopyWidth, 0.15, canopyDepth),
      color: roofMaterial.color,
      roughness: roofMaterial.roughness,
      metalness: roofMaterial.metalness,
    });

    // Flanking windows — 2 on each side of door
    const recWinW = Math.min(1.4, config.width * 0.12);
    const winOffsets = [0.1, 0.2, 0.78, 0.88].map((f) => southAnchor.length * f);
    winOffsets.forEach((offset, wi) => {
      addWindow(primitives, southAnchor, offset, recWinW, 1.6, 0.7, `${idPrefix}-win-${wi}`, `${label} Window`, trim, glass);
    });

  } else {
    // ─ Villa: residential with multi-side windows ────────────────────────

    const villaWinWidth = Math.min(1.4, config.width * 0.15);
    const villaSill = 0.9;

    // South face: door + 2 flanking windows (or 1 centered window if narrow)
    const doorWidth = Math.min(1.1, config.width * 0.15);
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

    const winH = 1.3;
    addWindow(primitives, southAnchor, southAnchor.length * 0.18, villaWinWidth, winH, villaSill, `${idPrefix}-s-win-0`, `${label} Window`, trim, glass);
    addWindow(primitives, southAnchor, southAnchor.length * 0.82, villaWinWidth, winH, villaSill, `${idPrefix}-s-win-1`, `${label} Window`, trim, glass);

    // East face windows
    const sideW = Math.min(1.1, config.depth * 0.18);
    addWindow(primitives, eastAnchor, eastAnchor.length * 0.28, sideW, winH, villaSill, `${idPrefix}-e-win-0`, `${label} Side Window`, trim, glass);
    addWindow(primitives, eastAnchor, eastAnchor.length * 0.72, sideW, winH, villaSill, `${idPrefix}-e-win-1`, `${label} Side Window`, trim, glass);

    // West face windows
    addWindow(primitives, westAnchor, westAnchor.length * 0.28, sideW, winH, villaSill, `${idPrefix}-w-win-0`, `${label} Side Window`, trim, glass);
    addWindow(primitives, westAnchor, westAnchor.length * 0.72, sideW, winH, villaSill, `${idPrefix}-w-win-1`, `${label} Side Window`, trim, glass);

    // Upper floor windows (if multi-storey)
    if (config.floors > 1) {
      const upperSouthAnchor = getWallAnchorForFootprint(footprint.center, config.width, config.depth, FLOOR_THICKNESS + LEVEL_HEIGHT, "south");
      addWindow(primitives, upperSouthAnchor, upperSouthAnchor.length * 0.25, villaWinWidth, winH, villaSill, `${idPrefix}-u-s-0`, `${label} Upper Window`, trim, glass);
      addWindow(primitives, upperSouthAnchor, upperSouthAnchor.length * 0.5,  villaWinWidth, winH, villaSill, `${idPrefix}-u-s-1`, `${label} Upper Window`, trim, glass);
      addWindow(primitives, upperSouthAnchor, upperSouthAnchor.length * 0.75, villaWinWidth, winH, villaSill, `${idPrefix}-u-s-2`, `${label} Upper Window`, trim, glass);
    }
  }

  return primitives.map((p) => ({ ...p, category: "building" as const }));
}
