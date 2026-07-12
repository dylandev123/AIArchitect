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

const ROOM_TYPES: RoomType[] = [
  "kitchen", "living", "bedroom", "bathroom", "hallway",
  "dining", "office", "laundry", "gym",
];

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

// ── Furniture helpers ─────────────────────────────────────────────────────────

function fBox(
  id: string,
  label: string,
  cx: number,   // world center X of room
  cz: number,   // world center Z of room
  lx: number,   // local X offset from room center
  lz: number,   // local Z offset from room center
  floorY: number,
  w: number,
  h: number,
  d: number,
  color: string,
  roughness?: number,
  metalness?: number,
): HousePrimitive {
  return {
    kind: "box",
    id,
    category: "room" as const,
    label,
    position: [cx + lx, floorY + h / 2, cz + lz],
    rotation: [0, 0, 0],
    size: [w, h, d],
    color,
    roughness,
    metalness,
  };
}

// ── Per-room furniture builders ───────────────────────────────────────────────

function buildBedroomFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const bedW = Math.min(1.5, hw * 1.7);
  const bedD = Math.min(2.0, hd * 1.7);
  // bed pushed to north wall (low Z)
  const bedZ = -(hd - bedD / 2 - 0.15);
  return [
    // Rug
    fBox(`${pre}-rug`,       "Rug",        cx, cz,  0,    0.3,  fy,  hw * 1.5,  0.018, hd * 1.5,  "#c4a070",  0.9),
    // Mattress
    fBox(`${pre}-bed`,       "Bed",        cx, cz,  0,    bedZ + bedD * 0.1, fy,  bedW, 0.30, bedD,       "#f0ece4",  0.85),
    // Headboard
    fBox(`${pre}-headboard`, "Headboard",  cx, cz,  0,    bedZ - bedD / 2 + 0.04, fy, bedW, 0.60, 0.09, "#4a3420",  0.7),
    // Pillows
    fBox(`${pre}-pillow`,    "Pillow",     cx, cz,  0,    bedZ - bedD / 2 + 0.35, fy + 0.30, bedW * 0.85, 0.10, 0.38, "#f8f8f8"),
    // Left nightstand
    fBox(`${pre}-nsl`,       "Nightstand", cx, cz,  -(bedW / 2 + 0.28), bedZ, fy, 0.45, 0.52, 0.38, "#6b4d2a",  0.65),
    // Right nightstand
    fBox(`${pre}-nsr`,       "Nightstand", cx, cz,   (bedW / 2 + 0.28), bedZ, fy, 0.45, 0.52, 0.38, "#6b4d2a",  0.65),
    // Wardrobe against east wall
    fBox(`${pre}-wardrobe`,  "Wardrobe",   cx, cz,   hw - 0.30, 0.1, fy, 0.52, 1.05, hd * 0.65, "#8a6040",  0.7),
  ];
}

function buildLivingFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const sofaW = Math.min(2.3, hw * 1.6);
  // sofa against south wall (high Z)
  const sofaZ = hd - 0.55;
  return [
    // Rug
    fBox(`${pre}-rug`,     "Rug",          cx, cz,  0,    0,     fy, hw * 1.55, 0.018, hd * 1.4, "#8a7264",  0.9),
    // Sofa back
    fBox(`${pre}-sofab`,   "Sofa",         cx, cz,  0,    sofaZ, fy, sofaW, 0.78, 0.48, "#5a7a9c",  0.8),
    // Sofa seat
    fBox(`${pre}-sofas`,   "Sofa",         cx, cz,  0,    sofaZ - 0.42, fy, sofaW, 0.40, 0.65, "#6a8aac",  0.8),
    // Sofa cushions (left + right)
    fBox(`${pre}-cushL`,   "Cushion",      cx, cz,  -(sofaW / 2 - 0.30), sofaZ - 0.22, fy + 0.40, 0.45, 0.18, 0.42, "#7898bc"),
    fBox(`${pre}-cushR`,   "Cushion",      cx, cz,   (sofaW / 2 - 0.30), sofaZ - 0.22, fy + 0.40, 0.45, 0.18, 0.42, "#7898bc"),
    // Coffee table (center)
    fBox(`${pre}-table`,   "Coffee Table", cx, cz,  0,    0.2,   fy, Math.min(1.1, hw * 0.9), 0.38, Math.min(0.65, hd * 0.5), "#7a5c3c",  0.6),
    // TV unit against north wall (low Z)
    fBox(`${pre}-tvunit`,  "TV Unit",      cx, cz,  0,    -(hd - 0.18), fy, Math.min(1.6, hw * 1.3), 0.42, 0.38, "#2a2e36",  0.5, 0.3),
    // TV screen
    fBox(`${pre}-tv`,      "TV",           cx, cz,  0,    -(hd - 0.04), fy + 0.42, Math.min(1.15, hw * 1.0), 0.58, 0.04, "#111418",  0.2, 0.2),
  ];
}

function buildKitchenFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const counterH = 0.90;
  const counterD = 0.62;
  // South counter (long, against south wall)
  const southW = Math.max(1.0, hw * 2 - counterD);
  const southZ = hd - counterD / 2;
  // East counter (side, against east wall)
  const eastD = Math.max(1.0, hd * 2 - counterD);
  const eastX = hw - counterD / 2;
  // Island (center, slightly south)
  const islandW = Math.min(1.0, hw * 0.8);
  const islandD = Math.min(0.65, hd * 0.5);

  return [
    // South counter
    fBox(`${pre}-cs`,      "Counter",     cx, cz,   0,            southZ,        fy, southW,  counterH, counterD, "#e4e0d8",  0.5),
    // Counter backsplash
    fBox(`${pre}-cbs`,     "Backsplash",  cx, cz,   0,            hd - 0.04,     fy + counterH, southW, 0.45, 0.05, "#d8d4cc",  0.35),
    // East counter
    fBox(`${pre}-ce`,      "Counter",     cx, cz,   eastX,        0,             fy, counterD,  counterH, eastD,    "#e4e0d8",  0.5),
    // Island
    fBox(`${pre}-island`,  "Island",      cx, cz,  -0.3,          0.2,           fy, islandW,   counterH, islandD,  "#c4c0b8",  0.45),
    // Fridge (tall, NE corner)
    fBox(`${pre}-fridge`,  "Fridge",      cx, cz,   hw - 0.38,   -(hd - 0.38),  fy, 0.72,  1.72, 0.72, "#e8e4e0",  0.5, 0.1),
    // Stove
    fBox(`${pre}-stove`,   "Stove",       cx, cz,   hw - 1.15,    southZ - 0.04, fy, 0.65,  0.45, 0.65, "#3a3a3a",  0.4, 0.3),
    // Stove top markings
    fBox(`${pre}-stovet`,  "Stove Top",   cx, cz,   hw - 1.15,    southZ - 0.04, fy + 0.45, 0.63, 0.02, 0.63, "#2a2a2a",  0.3, 0.4),
    // Sink area
    fBox(`${pre}-sink`,    "Sink",        cx, cz,  -0.5,          southZ - 0.04, fy + counterH - 0.06, 0.55, 0.08, 0.42, "#c0bdb8",  0.3, 0.4),
  ];
}

function buildBathroomFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  // Tub against north wall (low Z)
  const tubW = Math.min(0.85, hw * 1.4);
  const tubD = Math.min(1.55, hd * 1.5);
  const tubX = -(hw - tubW / 2 - 0.12);  // west side
  const tubZ = -(hd - tubD / 2 - 0.12);  // north side
  return [
    // Tub outer shell
    fBox(`${pre}-tub`,      "Bathtub",     cx, cz,  tubX, tubZ,        fy, tubW,  0.55, tubD,  "#f0f0ee",  0.5),
    // Tub inner (slightly smaller, dark)
    fBox(`${pre}-tubinner`, "Bathtub",     cx, cz,  tubX, tubZ,        fy + 0.08, tubW * 0.85, 0.45, tubD * 0.85, "#b8d8e8",  0.15),
    // Vanity / sink against east wall
    fBox(`${pre}-vanity`,   "Vanity",      cx, cz,   hw - 0.30, 0.1,  fy, 0.55, 0.85, Math.min(0.55, hd * 0.8), "#e4e0d8",  0.4),
    // Basin on vanity
    fBox(`${pre}-basin`,    "Basin",       cx, cz,   hw - 0.30, 0.1,  fy + 0.85, 0.38, 0.08, 0.32, "#c4c0be",  0.2, 0.3),
    // Toilet against south wall (high Z)
    fBox(`${pre}-toilet`,   "Toilet",      cx, cz,   hw - 0.22, hd - 0.38, fy, 0.40, 0.78, 0.60, "#f0f0ee",  0.5),
    // Toilet lid
    fBox(`${pre}-tlid`,     "Toilet",      cx, cz,   hw - 0.22, hd - 0.55, fy + 0.78, 0.38, 0.06, 0.45, "#e8e8e6",  0.5),
    // Mirror (flat, against east wall above vanity)
    fBox(`${pre}-mirror`,   "Mirror",      cx, cz,   hw - 0.04, 0.1,  fy + 0.85 + 0.05, 0.04, 0.55, 0.42, "#c8e4f0",  0.05, 0.05),
  ];
}

function buildDiningFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const tableW = Math.min(1.8, hw * 1.6);
  const tableD = Math.min(1.0, hd * 0.8);
  const chairS = 0.42;
  return [
    // Rug
    fBox(`${pre}-rug`,    "Rug",        cx, cz,  0,  0,           fy, hw * 1.5, 0.018, hd * 1.4, "#a08060",  0.9),
    // Dining table
    fBox(`${pre}-table`,  "Table",      cx, cz,  0,  0,           fy, tableW, 0.75, tableD, "#6a4c2e",  0.6),
    // Chairs: N S W E of table
    fBox(`${pre}-cN`,     "Chair",      cx, cz,  0,  -(tableD / 2 + chairS / 2 + 0.08), fy, chairS, 0.80, chairS, "#3a3030",  0.7),
    fBox(`${pre}-cS`,     "Chair",      cx, cz,  0,   (tableD / 2 + chairS / 2 + 0.08), fy, chairS, 0.80, chairS, "#3a3030",  0.7),
    fBox(`${pre}-cW`,     "Chair",      cx, cz,  -(tableW / 2 + chairS / 2 + 0.08), 0, fy, chairS, 0.80, chairS, "#3a3030",  0.7),
    fBox(`${pre}-cE`,     "Chair",      cx, cz,   (tableW / 2 + chairS / 2 + 0.08), 0, fy, chairS, 0.80, chairS, "#3a3030",  0.7),
    // Sideboard against north wall
    fBox(`${pre}-side`,   "Sideboard",  cx, cz,  0, -(hd - 0.22), fy, Math.min(1.4, hw * 1.2), 0.85, 0.40, "#5a4030",  0.65),
  ];
}

function buildOfficeFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  return [
    // Desk against east wall
    fBox(`${pre}-desk`,   "Desk",       cx, cz,   hw - 0.38,  0,           fy, 0.70, 0.76, Math.min(1.4, hd * 1.2), "#7a6050",  0.6),
    // Monitor
    fBox(`${pre}-mon`,    "Monitor",    cx, cz,   hw - 0.08,  -0.1,        fy + 0.76, 0.04, 0.40, 0.28, "#1a1a22",  0.2, 0.3),
    // Desk chair
    fBox(`${pre}-chair`,  "Chair",      cx, cz,   hw - 0.75,  0.2,         fy, 0.48, 0.46, 0.48, "#2a3040",  0.7),
    // Chair back
    fBox(`${pre}-chairb`, "Chair Back", cx, cz,   hw - 0.75,  0.2 - 0.20,  fy + 0.46, 0.46, 0.48, 0.06, "#2a3040",  0.7),
    // Bookshelf against north wall
    fBox(`${pre}-shelf`,  "Bookshelf",  cx, cz,   0, -(hd - 0.20), fy, Math.min(1.2, hw * 1.4), 1.05, 0.32, "#5a4030",  0.7),
    // Books (colorful top strip)
    fBox(`${pre}-books`,  "Books",      cx, cz,   0, -(hd - 0.04), fy + 0.75, Math.min(1.1, hw * 1.2), 0.20, 0.12, "#7a5060",  0.8),
  ];
}

function buildLaundryFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const appW = 0.60;
  const appD = 0.60;
  const appH = 0.85;
  const gapX = (hw - appW) - 0.1;
  return [
    // Washer
    fBox(`${pre}-wash`,   "Washer",     cx, cz,  -gapX / 2, -(hd - appD / 2 - 0.1), fy, appW, appH, appD, "#e8e8e4",  0.4, 0.1),
    // Dryer
    fBox(`${pre}-dry`,    "Dryer",      cx, cz,   gapX / 2, -(hd - appD / 2 - 0.1), fy, appW, appH, appD, "#e8e8e4",  0.4, 0.1),
    // Shelf above
    fBox(`${pre}-shelf`,  "Shelf",      cx, cz,   0,         -(hd - appD / 2 - 0.1), fy + appH + 0.05, hw * 1.6, 0.22, 0.32, "#c0c0bc",  0.5),
    // Hamper
    fBox(`${pre}-hamper`, "Hamper",     cx, cz,  -hw + 0.28, hd - 0.30, fy, 0.45, 0.58, 0.40, "#9a8878",  0.8),
  ];
}

function buildHallwayFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  return [
    // Rug runner down the center
    fBox(`${pre}-rug`,     "Rug",           cx, cz,  0,  0,          fy, hw * 1.5, 0.018, hd * 1.6, "#9a8478",  0.9),
    // Console table at one end
    fBox(`${pre}-console`, "Console Table", cx, cz,  -(hw - 0.18), 0, fy, 0.30, 0.78, Math.min(0.8, hd * 1.0), "#6b4d2a",  0.65),
    // Mirror above console
    fBox(`${pre}-mirror`,  "Mirror",        cx, cz,  -(hw - 0.04), 0, fy + 0.78 + 0.08, 0.04, 0.60, 0.42, "#c8e4f0",  0.05, 0.05),
  ];
}

function buildGymFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  return [
    // Dark rubber floor mat covering most of the room
    fBox(`${pre}-mat`,    "Rubber Mat",     cx, cz,  0,           0,              fy,           hw * 1.8, 0.025, hd * 1.8,  "#222222",  0.95),
    // Treadmill along east wall
    fBox(`${pre}-tmill`,  "Treadmill",      cx, cz,  hw - 0.48,  -(hd * 0.3),    fy,           0.82,  1.15, 1.95,  "#1a1a1a",  0.6,  0.3),
    fBox(`${pre}-tbelt`,  "Treadmill Belt", cx, cz,  hw - 0.48,  -(hd * 0.3) + 0.08, fy + 0.28, 0.74, 0.06, 1.65, "#333333",  0.85),
    // Weights rack along north wall
    fBox(`${pre}-rack`,   "Weights Rack",   cx, cz,  0,          -(hd - 0.22),   fy,           Math.min(1.8, hw * 1.5), 1.15, 0.42, "#242430",  0.5,  0.6),
    // Dumbbell rows on rack
    fBox(`${pre}-db1`,    "Dumbbell",       cx, cz, -0.55,       -(hd - 0.22),   fy + 0.32,    0.28, 0.20, 0.20, "#1a1a1a", 0.5, 0.5),
    fBox(`${pre}-db2`,    "Dumbbell",       cx, cz,  0,          -(hd - 0.22),   fy + 0.32,    0.28, 0.20, 0.20, "#1a1a1a", 0.5, 0.5),
    fBox(`${pre}-db3`,    "Dumbbell",       cx, cz,  0.55,       -(hd - 0.22),   fy + 0.32,    0.28, 0.20, 0.20, "#1a1a1a", 0.5, 0.5),
    // Adjustable bench
    fBox(`${pre}-bench`,  "Bench",          cx, cz, -(hw - 0.45), hd * 0.2,      fy,           0.58, 0.44, 1.25,  "#1a2030",  0.8),
    // Mirror along north wall (large, reflective)
    fBox(`${pre}-mirror`, "Mirror",         cx, cz,  0,          -(hd - 0.04),   fy + 0.65,    Math.min(hw * 1.7, 2.8), 1.20, 0.04, "#a0b8cc",  0.05, 0.15),
  ];
}

// ── Room builder ──────────────────────────────────────────────────────────────

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

  // Furniture
  const furnitureFy = baseY + ROOM_FLOOR_FINISH_THICKNESS;
  const hw = room.width / 2;
  const hd = room.depth / 2;

  switch (room.type) {
    case "bedroom":
      primitives.push(...buildBedroomFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "living":
      primitives.push(...buildLivingFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "kitchen":
      primitives.push(...buildKitchenFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "bathroom":
      primitives.push(...buildBathroomFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "hallway":
      primitives.push(...buildHallwayFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "dining":
      primitives.push(...buildDiningFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "office":
      primitives.push(...buildOfficeFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "laundry":
      primitives.push(...buildLaundryFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
    case "gym":
      primitives.push(...buildGymFurniture(centerX, centerZ, hw, hd, furnitureFy, idPrefix));
      break;
  }

  return primitives.map((p) => ({ ...p, category: "room" as const }));
}
