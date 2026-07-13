import type { HouseConfig, RoomConfig, RoomType } from "@/types/house";
import type { HousePrimitive } from "../types";
import {
  FLOOR_THICKNESS,
  LEVEL_HEIGHT,
  MATERIAL_COLORS,
  PARTITION_WALL_THICKNESS,
  ROOM_FLOOR_COLORS,
  ROOM_FLOOR_FINISH_THICKNESS,
  ROOM_LIMITS,
  ROOM_TYPE_LABELS,
  ROOM_WALL_HEIGHT,
  WALL_THICKNESS,
} from "../constants";
import { buildFloorSlabPrimitive } from "../primitiveBuilders";
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
  cx: number,
  cz: number,
  lx: number,
  lz: number,
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
  const bedW = Math.min(1.5, hw * 1.6);
  const bedD = Math.min(2.0, hd * 1.6);
  const bedZ = -(hd - bedD / 2 - 0.15);
  return [
    fBox(`${pre}-rug`,       "Rug",        cx, cz,  0,    0.15, fy, Math.min(hw * 1.6, hw * 2 - 0.2), 0.018, Math.min(hd * 1.5, hd * 2 - 0.2), "#c4a070", 0.9),
    fBox(`${pre}-bed`,       "Bed",        cx, cz,  0,    bedZ + bedD * 0.08, fy, bedW, 0.30, bedD, "#f0ece4", 0.85),
    fBox(`${pre}-headboard`, "Headboard",  cx, cz,  0,    bedZ - bedD / 2 + 0.04, fy, bedW, 0.60, 0.09, "#4a3420", 0.7),
    fBox(`${pre}-pillow`,    "Pillow",     cx, cz,  0,    bedZ - bedD / 2 + 0.32, fy + 0.30, bedW * 0.80, 0.10, 0.35, "#f8f8f8"),
    fBox(`${pre}-nsl`,       "Nightstand", cx, cz,  -(Math.min(bedW / 2 + 0.26, hw - 0.24)), bedZ, fy, 0.44, 0.50, 0.36, "#6b4d2a", 0.65),
  ];
}

function buildLivingFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const sofaW = Math.min(2.2, hw * 1.55);
  const sofaZ = hd - 0.52;
  return [
    fBox(`${pre}-rug`,    "Rug",          cx, cz,  0,    0,     fy, Math.min(hw * 1.5, hw * 2 - 0.2), 0.018, Math.min(hd * 1.4, hd * 2 - 0.2), "#8a7264", 0.9),
    fBox(`${pre}-sofab`,  "Sofa",         cx, cz,  0,    sofaZ, fy, sofaW, 0.78, 0.46, "#5a7a9c", 0.8),
    fBox(`${pre}-sofas`,  "Sofa Seat",    cx, cz,  0,    sofaZ - 0.40, fy, sofaW, 0.40, 0.62, "#6a8aac", 0.8),
    fBox(`${pre}-table`,  "Coffee Table", cx, cz,  0,    0.15,  fy, Math.min(1.1, hw * 0.85), 0.38, Math.min(0.62, hd * 0.45), "#7a5c3c", 0.6),
    fBox(`${pre}-tvunit`, "TV Unit",      cx, cz,  0,    -(hd - 0.18), fy, Math.min(1.6, hw * 1.25), 0.42, 0.36, "#2a2e36", 0.5, 0.3),
    fBox(`${pre}-tv`,     "TV",           cx, cz,  0,    -(hd - 0.04), fy + 0.42, Math.min(1.15, hw * 0.95), 0.56, 0.04, "#111418", 0.2, 0.2),
  ];
}

function buildKitchenFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const counterH = 0.90;
  const counterD = 0.60;
  const southW = Math.max(0.8, hw * 2 - counterD * 0.8);
  const southZ = hd - counterD / 2;
  const eastX = hw - counterD / 2;
  const islandW = Math.min(1.0, hw * 0.75);
  const islandD = Math.min(0.60, hd * 0.45);
  return [
    fBox(`${pre}-cs`,     "Counter",    cx, cz,  0,        southZ,     fy, southW, counterH, counterD, "#e4e0d8", 0.5),
    fBox(`${pre}-cbs`,    "Backsplash", cx, cz,  0,        hd - 0.03,  fy + counterH, southW, 0.42, 0.04, "#d0ccc4", 0.35),
    fBox(`${pre}-ce`,     "Counter",    cx, cz,  eastX,    0,          fy, counterD, counterH, Math.max(0.6, hd * 2 - counterD), "#e4e0d8", 0.5),
    fBox(`${pre}-island`, "Island",     cx, cz, -0.25,     0.15,       fy, islandW, counterH, islandD, "#c4c0b8", 0.45),
    fBox(`${pre}-fridge`, "Fridge",     cx, cz,  Math.min(hw - 0.37, eastX + 0.01), -(hd - 0.37), fy, 0.70, 1.70, 0.70, "#e8e4e0", 0.5, 0.1),
  ];
}

function buildBathroomFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const tubW = Math.min(0.82, Math.min(hw * 1.35, hw * 2 - 0.6));
  const tubD = Math.min(1.52, Math.min(hd * 1.45, hd * 2 - 0.4));
  const tubX = -(hw - tubW / 2 - 0.10);
  const tubZ = -(hd - tubD / 2 - 0.10);
  return [
    fBox(`${pre}-tub`,     "Bathtub",  cx, cz,  tubX, tubZ,    fy, tubW, 0.52, tubD, "#f0f0ee", 0.5),
    fBox(`${pre}-tubinn`,  "Bathtub",  cx, cz,  tubX, tubZ,    fy + 0.07, tubW * 0.82, 0.42, tubD * 0.82, "#b8d8e8", 0.15),
    fBox(`${pre}-vanity`,  "Vanity",   cx, cz,  Math.min(hw - 0.28, hw - 0.1), 0.08, fy, Math.min(0.52, hw * 0.9), 0.82, Math.min(0.52, hd * 0.75), "#e4e0d8", 0.4),
    fBox(`${pre}-toilet`,  "Toilet",   cx, cz,  Math.min(hw - 0.21, hw - 0.1), hd - 0.36, fy, 0.38, 0.76, 0.58, "#f0f0ee", 0.5),
    fBox(`${pre}-mirror`,  "Mirror",   cx, cz,  Math.min(hw - 0.03, hw - 0.01), 0.08, fy + 0.90, 0.03, 0.52, 0.40, "#c8e4f0", 0.05, 0.05),
  ];
}

function buildDiningFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const tableW = Math.min(1.8, hw * 1.55);
  const tableD = Math.min(1.0, hd * 0.75);
  const chairS = 0.42;
  return [
    fBox(`${pre}-rug`,   "Rug",    cx, cz, 0, 0, fy, Math.min(hw * 1.5, hw * 2 - 0.2), 0.018, Math.min(hd * 1.35, hd * 2 - 0.2), "#a08060", 0.9),
    fBox(`${pre}-table`, "Table",  cx, cz, 0, 0, fy, tableW, 0.75, tableD, "#6a4c2e", 0.6),
    fBox(`${pre}-cN`,    "Chair",  cx, cz, 0, -(tableD / 2 + chairS / 2 + 0.07), fy, chairS, 0.80, chairS, "#3a3030", 0.7),
    fBox(`${pre}-cS`,    "Chair",  cx, cz, 0,  (tableD / 2 + chairS / 2 + 0.07), fy, chairS, 0.80, chairS, "#3a3030", 0.7),
    fBox(`${pre}-cW`,    "Chair",  cx, cz, -(tableW / 2 + chairS / 2 + 0.07), 0, fy, chairS, 0.80, chairS, "#3a3030", 0.7),
    fBox(`${pre}-cE`,    "Chair",  cx, cz,  (tableW / 2 + chairS / 2 + 0.07), 0, fy, chairS, 0.80, chairS, "#3a3030", 0.7),
  ];
}

function buildOfficeFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const deskD = Math.min(1.35, hd * 1.15);
  const deskX = Math.min(hw - 0.37, hw - 0.1);
  return [
    fBox(`${pre}-desk`,  "Desk",    cx, cz, deskX, 0, fy, 0.68, 0.76, deskD, "#7a6050", 0.6),
    fBox(`${pre}-mon`,   "Monitor", cx, cz, Math.min(hw - 0.07, hw - 0.01), -0.08, fy + 0.76, 0.04, 0.38, 0.26, "#1a1a22", 0.2, 0.3),
    fBox(`${pre}-chair`, "Chair",   cx, cz, Math.max(deskX - 0.60, -hw + 0.28), 0.18, fy, 0.46, 0.44, 0.46, "#2a3040", 0.7),
    fBox(`${pre}-shelf`, "Shelf",   cx, cz, 0, -(hd - 0.18), fy, Math.min(1.2, hw * 1.35), 1.02, 0.30, "#5a4030", 0.7),
  ];
}

function buildLaundryFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  const appW = 0.60;
  const appD = 0.58;
  const appH = 0.84;
  const gapX = Math.max(appW * 1.1, (hw - appW) - 0.08);
  return [
    fBox(`${pre}-wash`,  "Washer", cx, cz, -Math.min(gapX, hw - appW / 2 - 0.06), -(hd - appD / 2 - 0.08), fy, appW, appH, appD, "#e8e8e4", 0.4, 0.1),
    fBox(`${pre}-dry`,   "Dryer",  cx, cz,  Math.min(gapX, hw - appW / 2 - 0.06), -(hd - appD / 2 - 0.08), fy, appW, appH, appD, "#e8e8e4", 0.4, 0.1),
  ];
}

function buildHallwayFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  return [
    fBox(`${pre}-rug`,     "Rug",           cx, cz, 0, 0, fy, Math.min(hw * 1.45, hw * 2 - 0.2), 0.018, Math.min(hd * 1.55, hd * 2 - 0.2), "#9a8478", 0.9),
    fBox(`${pre}-console`, "Console Table", cx, cz, -(Math.min(hw - 0.17, hw - 0.05)), 0, fy, 0.28, 0.76, Math.min(0.75, hd * 0.95), "#6b4d2a", 0.65),
  ];
}

function buildGymFurniture(
  cx: number, cz: number, hw: number, hd: number, fy: number, pre: string
): HousePrimitive[] {
  return [
    fBox(`${pre}-mat`,   "Rubber Mat",   cx, cz, 0, 0, fy, Math.min(hw * 1.75, hw * 2 - 0.1), 0.025, Math.min(hd * 1.75, hd * 2 - 0.1), "#222222", 0.95),
    fBox(`${pre}-tmill`, "Treadmill",    cx, cz, Math.min(hw - 0.47, hw - 0.1), -(hd * 0.28), fy, 0.80, 1.12, 1.90, "#1a1a1a", 0.6, 0.3),
    fBox(`${pre}-rack`,  "Weights Rack", cx, cz, 0, -(hd - 0.21), fy, Math.min(1.75, hw * 1.45), 1.12, 0.40, "#242430", 0.5, 0.6),
    fBox(`${pre}-bench`, "Bench",        cx, cz, -(Math.min(hw - 0.43, hw - 0.1)), hd * 0.18, fy, 0.56, 0.42, Math.min(1.22, hd * 0.95), "#1a2030", 0.8),
    fBox(`${pre}-mirror`, "Mirror",      cx, cz, 0, -(hd - 0.03), fy + 0.60, Math.min(hw * 1.65, 2.6), 1.18, 0.03, "#a0b8cc", 0.05, 0.15),
  ];
}

// ── Room floor + furniture (no wall rings — handled by buildRoomPartitions) ───

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

// ── Centralised partition wall generator ─────────────────────────────────────
//
// Runs after ALL rooms have been collected. Uses an edge-union algorithm:
//   • computes the 4 boundary edges for every room in world space
//   • skips edges that coincide with the house exterior wall (no doubling)
//   • groups edges by (level, axis, position) — each unique edge position
//     gets ONE wall covering the bounding-box union of all rooms that share it
//   • result: minimal, non-overlapping partition wall set
//
export function buildRoomPartitions(
  rooms: RoomConfig[],
  house: HouseConfig
): HousePrimitive[] {
  if (rooms.length === 0) return [];

  const EPSILON = 0.005;
  const halfW = house.width / 2;
  const halfD = house.depth / 2;

  // Interior face positions of the four exterior walls
  const WEST_INT  = -halfW + WALL_THICKNESS;
  const EAST_INT  =  halfW - WALL_THICKNESS;
  const NORTH_INT = -halfD + WALL_THICKNESS;
  const SOUTH_INT =  halfD - WALL_THICKNESS;

  // key: "level:axis:pos_fixed4"  → bounding range [min, max] along the perpendicular axis
  const edgeMap = new Map<string, { min: number; max: number; level: number }>();

  const addEdge = (
    level: number,
    axis: "X" | "Z",
    pos: number,
    rangeStart: number,
    rangeEnd: number
  ) => {
    const key = `${level}:${axis}:${pos.toFixed(4)}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.min = Math.min(existing.min, rangeStart);
      existing.max = Math.max(existing.max, rangeEnd);
    } else {
      edgeMap.set(key, { min: rangeStart, max: rangeEnd, level });
    }
  };

  for (const room of rooms) {
    const cx = WEST_INT + room.x + room.width / 2;
    const cz = NORTH_INT + room.z + room.depth / 2;
    const hw = room.width / 2;
    const hd = room.depth / 2;

    const west  = cx - hw;
    const east  = cx + hw;
    const north = cz - hd;
    const south = cz + hd;

    // X-axis walls (run N↔S, separate rooms in X direction)
    if (Math.abs(west  - WEST_INT)  > EPSILON) addEdge(room.level, "X", west,  north, south);
    if (Math.abs(east  - EAST_INT)  > EPSILON) addEdge(room.level, "X", east,  north, south);
    // Z-axis walls (run E↔W, separate rooms in Z direction)
    if (Math.abs(north - NORTH_INT) > EPSILON) addEdge(room.level, "Z", north, west, east);
    if (Math.abs(south - SOUTH_INT) > EPSILON) addEdge(room.level, "Z", south, west, east);
  }

  const primitives: HousePrimitive[] = [];
  let wallIdx = 0;

  for (const [key, { min, max, level }] of edgeMap) {
    const parts = key.split(":");
    const axis  = parts[1] as "X" | "Z";
    const pos   = parseFloat(parts[2]);
    const length = max - min;
    if (length < 0.01) continue;

    const center = (min + max) / 2;
    const baseY  = level * LEVEL_HEIGHT + FLOOR_THICKNESS + ROOM_FLOOR_FINISH_THICKNESS;

    primitives.push({
      kind: "box",
      id: `room-partition-${wallIdx++}`,
      category: "room",
      label: "Partition Wall",
      position: axis === "X"
        ? [pos, baseY + ROOM_WALL_HEIGHT / 2, center]
        : [center, baseY + ROOM_WALL_HEIGHT / 2, pos],
      rotation: [0, 0, 0],
      size: axis === "X"
        ? [PARTITION_WALL_THICKNESS, ROOM_WALL_HEIGHT, length]
        : [length, ROOM_WALL_HEIGHT, PARTITION_WALL_THICKNESS],
      color: MATERIAL_COLORS.wall,
      roughness: 0.85,
    });
  }

  return primitives;
}
