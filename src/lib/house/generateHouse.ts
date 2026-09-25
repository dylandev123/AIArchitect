import type { DesignTier, ExteriorOptions, HouseConfig, MaterialsConfig, RoofType, SiteConfig, SiteSettings } from "@/types/house";
import type { ResolvedExteriorOptions } from "./catalog/types";
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
import { buildPorch, validatePorch } from "./features/porches";
import { buildChimney, validateChimney } from "./features/chimneys";
import { buildCurvedWall, validateCurvedWall } from "./features/curvedWalls";
import { buildArch, validateArch } from "./features/arches";
import { buildBay, validateBay } from "./features/bays";
import { buildFoundation, validateFoundation } from "./features/foundations";
import { buildStairs, validateStairs } from "./features/stairs";
import { buildCrossGable, buildDormer, validateCrossGable, validateDormer } from "./features/roofParts";
import { buildRetainingWall, validateRetainingWall } from "./features/retainingWalls";
import { buildPath, validatePath } from "./features/paths";
import { buildWaterway, validateWaterway } from "./features/waterways";
import { buildRockCluster, validateRockCluster } from "./features/rocks";
import { buildSlope, validateSlope } from "./features/slopes";
import type { BuildContext } from "./features/context";
import { planTerrain, terrainHeightAt } from "@/lib/landscaping/terrain";
import { resolveTier, TIER_PROFILES } from "./tiers";
import { buildRoofDetail } from "./architecture/roofDetail";
import { applyEdgeDetail } from "./architecture/edgeDetail";
import { parseSiteSettings } from "./siteSettings";
import { getArchitectureProfile } from "./architecture/profiles";
import { buildStyledShell } from "./architecture/shell";
import type { DoorSpan } from "./architecture/parts";

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

/** What the styled shell needs beyond the dimensions: the resolved style, site orientation and door openings. */
export interface ShellStyling {
  opts: ResolvedExteriorOptions;
  settings?: SiteSettings;
  doors: readonly DoorSpan[];
  tier?: DesignTier;
}

export function generateHouseModel(config: HouseConfig, materials: MaterialsConfig, styling?: ShellStyling): HousePrimitive[] {
  // Styles with an architectural profile build their own envelope; every other style keeps the generic shell below.
  const profile = getArchitectureProfile(styling?.opts.style);
  if (styling && profile) {
    return buildStyledShell(config, materials, {
      profile,
      view: styling.settings?.viewDirection ?? "south",
      approach: styling.settings?.approachSide ?? "south",
      doors: styling.doors,
    });
  }

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

  // Higher tiers layer the roof edge: soffit, drip board, crown moulding and ridge cap.
  const roofLayers = TIER_PROFILES[resolveTier(styling?.tier)].detail.roofLayers;
  if (roofLayers !== 0 && (roof === "gable" || roof === "hip")) {
    primitives.push(...buildRoofDetail(roof, width, depth, roofBaseY, roofLayers, trimMaterial, roofMaterial));
  }

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

/** Ground-floor door openings, so plinths and foundations can stay clear of them. */
function groundFloorDoorSpans(rawDoors: unknown, config: HouseConfig): DoorSpan[] {
  if (!Array.isArray(rawDoors)) return [];
  const spans: DoorSpan[] = [];
  for (const item of rawDoors) {
    const door = validateDoor(item, config).value;
    if (door && door.level === 0) spans.push({ wall: door.wall, from: door.offset, to: door.offset + door.width });
  }
  return spans;
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

  // Parse and resolve exterior options (optional; defaults applied when absent)
  const rawExtOpts = root.exteriorOptions;
  const { opts, warnings: extWarnings } = composeExteriorOptions(
    typeof rawExtOpts === "object" && rawExtOpts !== null ? (rawExtOpts as ExteriorOptions) : {},
    config
  );
  warnings.push(...extWarnings);

  const settings = parseSiteSettings(root.site, warnings);
  const tier = resolveTier(settings?.designTier);
  const detail = TIER_PROFILES[tier].detail;
  const doorSpans = groundFloorDoorSpans(root.doors, config);
  const primitives = generateHouseModel(config, materials, { opts, settings, doors: doorSpans, tier });

  const windows = processFeatureArray(root, "window", (i) => validateWindow(i, config), (v, idx) => buildWindow(v, config, materials, idx, opts, detail.recess), errors, warnings, primitives);
  const doors = processFeatureArray(root, "door", (i) => validateDoor(i, config), (v, idx) => buildDoor(v, config, materials, idx, opts, detail.recess), errors, warnings, primitives);
  const garages = processFeatureArray(root, "garage", validateGarage, (v, idx) => buildGarage(v, config, materials, idx), errors, warnings, primitives);
  const balconies = processFeatureArray(root, "balcony", (i) => validateBalcony(i, config), (v, idx) => buildBalcony(v, config, materials, idx, opts), errors, warnings, primitives);
  const patios = processFeatureArray(root, "patio", validatePatio, (v, idx) => buildPatio(v, config, materials, idx, opts), errors, warnings, primitives);
  const pools = processFeatureArray(root, "pool", validatePool, (v, idx) => buildPool(v, config, materials, idx, opts), errors, warnings, primitives);
  const driveways = processFeatureArray(root, "driveway", validateDriveway, (v, idx) => buildDriveway(v, config, idx, opts), errors, warnings, primitives);
  const rooms = processFeatureArray(root, "room", (i) => validateRoom(i, config), (v, idx) => buildRoom(v, config, idx), errors, warnings, primitives);
  primitives.push(...buildRoomPartitions(rooms, config));
  const buildings = processFeatureArray(root, "building", validateBuilding, (v, idx) => buildBuilding(v, materials, idx, opts), errors, warnings, primitives);
  const roads = processFeatureArray(root, "road", validateRoad, (v, idx) => buildRoad(v, idx), errors, warnings, primitives);
  const parking = processFeatureArray(root, "parking", validateParking, (v, idx) => buildParking(v, idx), errors, warnings, primitives);
  const landscaping = processFeatureArray(root, "landscape", validateLandscapeZone, (v, idx) => buildLandscapeZone(v, idx), errors, warnings, primitives);
  const decks = processFeatureArray(root, "deck", validateDeck, (v, idx) => buildDeck(v, materials, idx), errors, warnings, primitives);
  const porches = processFeatureArray(root, "porch", (i) => validatePorch(i, config), (v, idx) => buildPorch(v, config, materials, idx, opts), errors, warnings, primitives);
  const chimneys = processFeatureArray(root, "chimney", (i) => validateChimney(i, config), (v, idx) => buildChimney(v, config, materials, idx, opts), errors, warnings, primitives);

  // Parts attached to the house: independent of the ground, so they build straight away.
  const ctx: BuildContext = { house: config, materials, opts, tier, doors: doorSpans, groundAt: () => 0, groundColor: "#48ae36" };
  const arches = processFeatureArray(root, "arch", (i) => validateArch(i, config), (v, idx) => buildArch(v, ctx, idx), errors, warnings, primitives);
  const bays = processFeatureArray(root, "bay", (i) => validateBay(i, config), (v, idx) => buildBay(v, ctx, idx), errors, warnings, primitives);
  const foundations = processFeatureArray(root, "foundation", validateFoundation, (v, idx) => buildFoundation(v, ctx, idx), errors, warnings, primitives);
  const stairs = processFeatureArray(root, "stairs", (i) => validateStairs(i, config), (v, idx) => buildStairs(v, ctx, idx), errors, warnings, primitives);
  const dormers = processFeatureArray(root, "dormer", (i) => validateDormer(i, config), (v, idx) => buildDormer(v, ctx, idx), errors, warnings, primitives);
  const crossGables = processFeatureArray(root, "crossGable", (i) => validateCrossGable(i, config), (v, idx) => buildCrossGable(v, ctx, idx), errors, warnings, primitives);

  // Ground-following site features: validated now, built once the terrain is known (below).
  const none = () => [] as HousePrimitive[];
  const curvedWalls = processFeatureArray(root, "curvedWall", validateCurvedWall, none, errors, warnings, primitives);
  const retainingWalls = processFeatureArray(root, "retainingWall", validateRetainingWall, none, errors, warnings, primitives);
  const paths = processFeatureArray(root, "path", validatePath, none, errors, warnings, primitives);
  const waterways = processFeatureArray(root, "waterway", validateWaterway, none, errors, warnings, primitives);
  const rocks = processFeatureArray(root, "rockCluster", validateRockCluster, none, errors, warnings, primitives);
  const slopes = processFeatureArray(root, "slope", validateSlope, none, errors, warnings, primitives);

  const site: SiteConfig = {
    house: config,
    settings,
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
    porches,
    chimneys,
    curvedWalls,
    arches,
    bays,
    foundations,
    stairs,
    dormers,
    crossGables,
    retainingWalls,
    paths,
    waterways,
    rocks,
    slopes,
    exteriorOptions: opts,
  };

  // Now the ground is known, build what sits on it.
  const plan = planTerrain(site);
  const groundCtx: BuildContext = { ...ctx, groundAt: plan ? (x, z) => terrainHeightAt(plan, x, z) : () => 0, groundColor: plan?.groundColor ?? "#48ae36" };
  curvedWalls.forEach((v, i) => primitives.push(...buildCurvedWall(v, groundCtx, i)));
  retainingWalls.forEach((v, i) => primitives.push(...buildRetainingWall(v, groundCtx, i)));
  paths.forEach((v, i) => primitives.push(...buildPath(v, groundCtx, i)));
  waterways.forEach((v, i) => primitives.push(...buildWaterway(v, groundCtx, i)));
  rocks.forEach((v, i) => primitives.push(...buildRockCluster(v, groundCtx, i)));
  slopes.forEach((v, i) => primitives.push(...buildSlope(v, groundCtx, i)));

  return { model: { id: "house", primitives: applyEdgeDetail(primitives, detail.bevel) }, config, site, errors, warnings };
}
