import type { ExteriorOptions, HouseConfig, MaterialsConfig, RoofType, SiteConfig } from "@/types/house";
import { composeExteriorOptions } from "./catalog/composition";
import type { HouseModel, HousePrimitive } from "./types";
import { FLOOR_THICKNESS, HOUSE_LIMITS, LEVEL_HEIGHT, MATERIAL_COLORS, WALL_HEIGHT, WALL_THICKNESS } from "./constants";
import { buildFloorSlabPrimitive, buildWallRingPrimitives } from "./primitiveBuilders";
import { materialProps, resolveMaterial, validateMaterials } from "./materials";
import { buildFlatRoof } from "./roof/flatRoof";
import { buildGableRoof } from "./roof/gableRoof";
import { buildHipRoof } from "./roof/hipRoof";
import { buildMansardRoof } from "./roof/mansardRoof";
import { buildShedRoof } from "./roof/shedRoof";
import { buildButterflyRoof } from "./roof/butterflyRoof";
import { buildSawtoothRoof } from "./roof/sawtoothRoof";
import { FEATURE_JSON_KEY, FEATURE_LABEL, type FeatureType } from "./features/featureTypes";
import type { FeatureValidation } from "./features/validateHelpers";
import { buildWindow, validateWindow } from "./features/windows";
import { buildDoor, validateDoor } from "./features/doors";
import { buildGarage, validateGarage } from "./features/garages";
import { buildBalcony, validateBalcony } from "./features/balconies";
import { buildPatio, validatePatio } from "./features/patios";
import { buildPool, validatePool } from "./features/pools";
import { buildDriveway, validateDriveway } from "./features/driveways";
import { buildRoom, buildRoomPartitions, validateRoom } from "./features/rooms";
import { buildBuilding, validateBuilding } from "./features/buildings";
import { buildRoad, validateRoad } from "./features/roads";
import { buildParking, validateParking } from "./features/parking";
import { buildLandscapeZone, validateLandscapeZone } from "./features/landscapeZones";
import { buildDeck, validateDeck } from "./features/decks";
import { parseSiteSettings } from "./siteSettings";

const ROOF_TYPES: RoofType[] = ["flat", "gable", "hip", "mansard", "shed", "butterfly", "sawtooth"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface HouseValidationResult {
  config: HouseConfig | null;
  errors: string[];
  warnings: string[];
}

function validateConfig(raw: unknown): HouseValidationResult {
  const warnings: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { config: null, errors: ["Root JSON must be an object."], warnings };
  }
  const house = (raw as Record<string, unknown>).house;
  if (typeof house !== "object" || house === null) {
    return { config: null, errors: ['Missing required "house" object.'], warnings };
  }
  const h = house as Record<string, unknown>;

  const errors: string[] = [];
  const width = typeof h.width === "number" ? h.width : NaN;
  const depth = typeof h.depth === "number" ? h.depth : NaN;
  const floors = typeof h.floors === "number" ? h.floors : NaN;
  const roofRaw = typeof h.roof === "string" ? h.roof : "";

  if (!Number.isFinite(width)) errors.push('"house.width" must be a number.');
  if (!Number.isFinite(depth)) errors.push('"house.depth" must be a number.');
  if (!Number.isFinite(floors)) errors.push('"house.floors" must be a number.');
  if (errors.length > 0) return { config: null, errors, warnings };

  const clampedWidth = clamp(width, HOUSE_LIMITS.width.min, HOUSE_LIMITS.width.max);
  if (clampedWidth !== width) warnings.push(`"width" clamped to ${clampedWidth}.`);

  const clampedDepth = clamp(depth, HOUSE_LIMITS.depth.min, HOUSE_LIMITS.depth.max);
  if (clampedDepth !== depth) warnings.push(`"depth" clamped to ${clampedDepth}.`);

  const clampedFloors = clamp(Math.round(floors), HOUSE_LIMITS.floors.min, HOUSE_LIMITS.floors.max);
  if (clampedFloors !== floors) warnings.push(`"floors" clamped to ${clampedFloors}.`);

  const roof = ROOF_TYPES.includes(roofRaw as RoofType) ? (roofRaw as RoofType) : "flat";
  if (roof !== roofRaw) warnings.push(`Unknown "roof" type "${roofRaw}" — defaulting to "flat".`);

  return {
    config: { width: clampedWidth, depth: clampedDepth, floors: clampedFloors, roof },
    errors: [],
    warnings,
  };
}

export function generateHouseModel(config: HouseConfig, materials: MaterialsConfig): HousePrimitive[] {
  const { width, depth, floors, roof } = config;
  const primitives: HousePrimitive[] = [];
  const footprint = { center: [0, 0] as [number, number], width, depth };
  const exteriorMaterial = resolveMaterial(materials.exterior);
  const roofMaterial = resolveMaterial(materials.roof);
  const trimMaterial = resolveMaterial(materials.trim);

  for (let level = 0; level < floors; level++) {
    const floorY = level * LEVEL_HEIGHT;

    primitives.push(
      buildFloorSlabPrimitive(
        footprint,
        floorY,
        FLOOR_THICKNESS,
        `floor-${level}`,
        `Floor Slab ${level + 1}`,
        MATERIAL_COLORS.floor
      )
    );

    primitives.push(
      ...buildWallRingPrimitives(
        footprint,
        floorY + FLOOR_THICKNESS,
        WALL_HEIGHT,
        `wall-${level}`,
        `Wall ${level + 1}`,
        exteriorMaterial.color,
        [],
        exteriorMaterial
      )
    );

    // Base-trim strip at the bottom of each floor's wall ring.
    const trimH = 0.26;
    const trimThick = 0.13;
    const trimY = floorY + FLOOR_THICKNESS + trimH / 2;
    const halfW = width / 2;
    const halfD = depth / 2;
    ([
      { id: `trim-${level}-n`, pos: [0, trimY, -halfD - trimThick / 2] as [number,number,number], size: [width + trimThick * 2, trimH, trimThick] as [number,number,number] },
      { id: `trim-${level}-s`, pos: [0, trimY,  halfD + trimThick / 2] as [number,number,number], size: [width + trimThick * 2, trimH, trimThick] as [number,number,number] },
      { id: `trim-${level}-e`, pos: [ halfW + trimThick / 2, trimY, 0] as [number,number,number], size: [trimThick, trimH, depth] as [number,number,number] },
      { id: `trim-${level}-w`, pos: [-halfW - trimThick / 2, trimY, 0] as [number,number,number], size: [trimThick, trimH, depth] as [number,number,number] },
    ] as { id: string; pos: [number,number,number]; size: [number,number,number] }[]).forEach(({ id, pos, size }) => {
      primitives.push({
        kind: "box",
        id,
        category: "wall",
        label: `Wall Trim ${level + 1}`,
        position: pos,
        rotation: [0, 0, 0],
        size,
        color: trimMaterial.color,
        ...materialProps(trimMaterial),
      });
    });

    // Corner column pillars — square posts at each outer corner for visible wall thickness.
    const pillarW = WALL_THICKNESS + 0.14;
    const pillarY = floorY + FLOOR_THICKNESS + WALL_HEIGHT / 2;
    ([
      { id: `pillar-${level}-nw`, pos: [-halfW, pillarY, -halfD] as [number,number,number] },
      { id: `pillar-${level}-ne`, pos: [ halfW, pillarY, -halfD] as [number,number,number] },
      { id: `pillar-${level}-se`, pos: [ halfW, pillarY,  halfD] as [number,number,number] },
      { id: `pillar-${level}-sw`, pos: [-halfW, pillarY,  halfD] as [number,number,number] },
    ] as { id: string; pos: [number,number,number] }[]).forEach(({ id, pos }) => {
      primitives.push({
        kind: "box",
        id,
        category: "wall",
        label: `Corner Pillar ${level + 1}`,
        position: pos,
        rotation: [0, 0, 0],
        size: [pillarW, WALL_HEIGHT, pillarW],
        color: trimMaterial.color,
        ...materialProps(trimMaterial),
      });
    });

    // Top cornice on the uppermost floor only — broad trim band at wall top.
    if (level === floors - 1) {
      const corniceH = 0.24;
      const corniceThick = 0.18;
      const corniceY = floorY + FLOOR_THICKNESS + WALL_HEIGHT - corniceH / 2;
      ([
        { id: "cornice-n", pos: [0, corniceY, -halfD - corniceThick / 2] as [number,number,number], size: [width + corniceThick * 2, corniceH, corniceThick] as [number,number,number] },
        { id: "cornice-s", pos: [0, corniceY,  halfD + corniceThick / 2] as [number,number,number], size: [width + corniceThick * 2, corniceH, corniceThick] as [number,number,number] },
        { id: "cornice-e", pos: [ halfW + corniceThick / 2, corniceY, 0] as [number,number,number], size: [corniceThick, corniceH, depth] as [number,number,number] },
        { id: "cornice-w", pos: [-halfW - corniceThick / 2, corniceY, 0] as [number,number,number], size: [corniceThick, corniceH, depth] as [number,number,number] },
      ] as { id: string; pos: [number,number,number]; size: [number,number,number] }[]).forEach(({ id, pos, size }) => {
        primitives.push({
          kind: "box",
          id,
          category: "wall",
          label: "Wall Cornice",
          position: pos,
          rotation: [0, 0, 0],
          size,
          color: trimMaterial.color,
          ...materialProps(trimMaterial),
        });
      });
    }
  }

  const roofBaseY = floors * LEVEL_HEIGHT;
  const roofBuilders: Record<RoofType, typeof buildFlatRoof> = {
    flat:      buildFlatRoof,
    gable:     buildGableRoof,
    hip:       buildHipRoof,
    mansard:   buildMansardRoof,
    shed:      buildShedRoof,
    butterfly: buildButterflyRoof,
    sawtooth:  buildSawtoothRoof,
  };
  primitives.push(...roofBuilders[roof](width, depth, roofBaseY, "roof", roofMaterial, exteriorMaterial));

  return primitives;
}

/** Validates + builds every entry of one feature array, prefixing messages with its type and 1-based index. */
function processFeatureArray<T>(
  raw: Record<string, unknown>,
  type: FeatureType,
  validate: (item: unknown) => FeatureValidation<T>,
  build: (value: T, index: number) => HousePrimitive[],
  errors: string[],
  warnings: string[],
  primitives: HousePrimitive[]
): T[] {
  const jsonKey = FEATURE_JSON_KEY[type];
  const label = FEATURE_LABEL[type];
  const arr = (raw as Record<string, unknown>)[jsonKey];
  const valid: T[] = [];

  if (arr === undefined) return valid;
  if (!Array.isArray(arr)) {
    warnings.push(`"${jsonKey}" must be an array — ignoring.`);
    return valid;
  }

  arr.forEach((item, index) => {
    const result = validate(item);
    result.errors.forEach((e) => errors.push(`${label} ${index + 1}: ${e}`));
    result.warnings.forEach((w) => warnings.push(`${label} ${index + 1}: ${w}`));
    if (result.value) {
      valid.push(result.value);
      primitives.push(...build(result.value, index));
    }
  });

  return valid;
}

export interface HouseGenerationResult {
  model: HouseModel | null;
  config: HouseConfig | null;
  site: SiteConfig | null;
  errors: string[];
  warnings: string[];
}

export function generateHouseFromJson(jsonText: string): HouseGenerationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch (e) {
    return {
      model: null,
      config: null,
      site: null,
      errors: [`Invalid JSON: ${(e as Error).message}`],
      warnings: [],
    };
  }

  const { config, errors, warnings } = validateConfig(raw);
  if (!config) return { model: null, config: null, site: null, errors, warnings };

  const root = raw as Record<string, unknown>;
  const materials = validateMaterials(root.materials, warnings);
  const primitives = generateHouseModel(config, materials);

  // Parse and resolve exterior options (optional; defaults applied when absent)
  const rawExtOpts = root.exteriorOptions;
  const { opts, warnings: extWarnings } = composeExteriorOptions(
    typeof rawExtOpts === "object" && rawExtOpts !== null ? (rawExtOpts as ExteriorOptions) : {},
    config
  );
  warnings.push(...extWarnings);

  const windows = processFeatureArray(root, "window", (i) => validateWindow(i, config), (v, idx) => buildWindow(v, config, materials, idx, opts), errors, warnings, primitives);
  const doors = processFeatureArray(root, "door", (i) => validateDoor(i, config), (v, idx) => buildDoor(v, config, materials, idx, opts), errors, warnings, primitives);
  const garages = processFeatureArray(root, "garage", validateGarage, (v, idx) => buildGarage(v, config, materials, idx), errors, warnings, primitives);
  const balconies = processFeatureArray(root, "balcony", (i) => validateBalcony(i, config), (v, idx) => buildBalcony(v, config, materials, idx, opts), errors, warnings, primitives);
  const patios = processFeatureArray(root, "patio", validatePatio, (v, idx) => buildPatio(v, config, materials, idx, opts), errors, warnings, primitives);
  const pools = processFeatureArray(root, "pool", validatePool, (v, idx) => buildPool(v, config, materials, idx, opts), errors, warnings, primitives);
  const driveways = processFeatureArray(root, "driveway", validateDriveway, (v, idx) => buildDriveway(v, config, idx, opts), errors, warnings, primitives);
  const rooms = processFeatureArray(root, "room", (i) => validateRoom(i, config), (v, idx) => buildRoom(v, config, idx), errors, warnings, primitives);
  primitives.push(...buildRoomPartitions(rooms, config));
  const buildings = processFeatureArray(root, "building", validateBuilding, (v, idx) => buildBuilding(v, materials, idx), errors, warnings, primitives);
  const roads = processFeatureArray(root, "road", validateRoad, (v, idx) => buildRoad(v, idx), errors, warnings, primitives);
  const parking = processFeatureArray(root, "parking", validateParking, (v, idx) => buildParking(v, idx), errors, warnings, primitives);
  const landscaping = processFeatureArray(root, "landscape", validateLandscapeZone, (v, idx) => buildLandscapeZone(v, idx), errors, warnings, primitives);
  const decks = processFeatureArray(root, "deck", validateDeck, (v, idx) => buildDeck(v, materials, idx), errors, warnings, primitives);

  const site: SiteConfig = {
    house: config,
    settings: parseSiteSettings(root.site, warnings),
    materials,
    windows,
    doors,
    garages,
    balconies,
    patios,
    pools,
    driveways,
    rooms,
    buildings,
    roads,
    parking,
    landscaping,
    decks,
    exteriorOptions: opts,
  };

  return { model: { id: "house", primitives }, config, site, errors, warnings };
}
