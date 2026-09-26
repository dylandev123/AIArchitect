import * as THREE from "three";
import type { HouseConfig, RoomType } from "@/types/house";
import type { HousePrimitive, PrimitiveCategory } from "./types";
import {
  FLOOR_THICKNESS,
  LEVEL_HEIGHT,
  ROOM_FLOOR_FINISH_THICKNESS,
  ROOM_TYPE_LABELS,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "./constants";
import { validateConfig } from "./generateHouse";
import { validateRoom } from "./features/rooms";

/** Where the user is looking: the room's position in the `rooms` array, plus its stable id once it has one. */
export interface RoomFocus {
  index: number;
  id?: string;
}

export interface RoomInfo {
  /** Position in the project's `rooms` array (the same index the renderer and the AI scope use). */
  index: number;
  /** Stable id, absent on legacy rooms until an edit backfills it. */
  id?: string;
  type: RoomType;
  level: number;
  /** "Kitchen", or "Bedroom 2" when the house has several of a type. */
  name: string;
  /** "Ground floor", "Floor 2", … */
  floorName: string;
  /** Interior-relative box, as validated for rendering. */
  x: number;
  z: number;
  width: number;
  depth: number;
  /** World-space centre of the floor. */
  center: [number, number];
}

export interface RoomList {
  rooms: RoomInfo[];
  floors: number;
}

export function floorName(level: number): string {
  return level === 0 ? "Ground floor" : `Floor ${level + 1}`;
}

export function floorShortName(level: number): string {
  return level === 0 ? "G" : String(level + 1);
}

/** Rooms of a project as the renderer sees them, keyed by their true array index. Unparseable or invalid input yields none. */
export function listRooms(houseConfigJson: string): RoomList {
  let raw: unknown;
  try {
    raw = JSON.parse(houseConfigJson);
  } catch {
    return { rooms: [], floors: 0 };
  }
  const { config } = validateConfig(raw);
  const rawRooms = (raw as Record<string, unknown> | null)?.rooms;
  if (!config || !Array.isArray(rawRooms)) return { rooms: [], floors: config?.floors ?? 0 };

  const found: Omit<RoomInfo, "name">[] = [];
  rawRooms.forEach((item, index) => {
    const room = validateRoom(item, config).value;
    if (!room) return;
    const id = (item as { id?: unknown }).id;
    found.push({
      index,
      id: typeof id === "string" ? id : undefined,
      type: room.type,
      level: room.level,
      floorName: floorName(room.level),
      x: room.x,
      z: room.z,
      width: room.width,
      depth: room.depth,
      center: [
        -config.width / 2 + WALL_THICKNESS + room.x + room.width / 2,
        -config.depth / 2 + WALL_THICKNESS + room.z + room.depth / 2,
      ],
    });
  });

  const perType = new Map<RoomType, number>();
  for (const r of found) perType.set(r.type, (perType.get(r.type) ?? 0) + 1);
  const seen = new Map<RoomType, number>();
  const rooms = found.map((r) => {
    const n = (seen.get(r.type) ?? 0) + 1;
    seen.set(r.type, n);
    const base = ROOM_TYPE_LABELS[r.type];
    return { ...r, name: (perType.get(r.type) ?? 0) > 1 ? `${base} ${n}` : base };
  });
  return { rooms, floors: config.floors };
}

/** Finds the focused room again after the project changed: by id when it has one, else by position. */
export function resolveRoomFocus(rooms: readonly RoomInfo[], focus: RoomFocus | null): RoomInfo | null {
  if (!focus) return null;
  if (focus.id) {
    const byId = rooms.find((r) => r.id === focus.id);
    if (byId) return byId;
  }
  return rooms.find((r) => r.index === focus.index && (!focus.id || !r.id)) ?? null;
}

// ── Camera ───────────────────────────────────────────────────────────────────

export interface CameraGoal {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/** How long a camera move between views takes. */
export const CAMERA_FLIGHT_MS = 900;

/** Wider than the exterior lens, so a small room still fits when the camera sits in its corner. */
export const ROOM_FOV = 70;
const CORNER_INSET = 0.4;
const CEILING_DROP = 0.35;
const MIN_LOOK_DISTANCE = 2.5;

/** Ceiling height of a level, from the level's floor finish up. */
function ceilingY(level: number): number {
  return level * LEVEL_HEIGHT + FLOOR_THICKNESS + WALL_HEIGHT;
}

/**
 * Inside the room, up by the ceiling in its south-east corner (the side the exterior camera looks from, so the move
 * in reads as continuous), looking down across the room at its centre.
 */
export function roomCameraGoal(room: RoomInfo): CameraGoal {
  const inset = Math.min(CORNER_INSET, room.width / 4, room.depth / 4);
  const [cx, cz] = room.center;
  const floorY = room.level * LEVEL_HEIGHT + FLOOR_THICKNESS + ROOM_FLOOR_FINISH_THICKNESS;

  const position = new THREE.Vector3(cx + room.width / 2 - inset, ceilingY(room.level) - CEILING_DROP, cz + room.depth / 2 - inset);
  const target = new THREE.Vector3(cx, floorY + 0.5, cz);
  const look = target.clone().sub(position);
  if (look.length() < MIN_LOOK_DISTANCE) target.copy(position).addScaledVector(look.normalize(), MIN_LOOK_DISTANCE);

  return { position: position.toArray(), target: target.toArray(), fov: ROOM_FOV };
}

// ── Cutaway ──────────────────────────────────────────────────────────────────

/** Site-scale things that are never part of the house shell, whatever their height. */
const SITE_CATEGORIES = new Set<PrimitiveCategory>([
  "building", "road", "parking", "landscape", "curvedWall", "retainingWall", "path", "waterway", "rock", "slope", "pool", "driveway", "patio",
]);
/** Wall-mounted or wall-attached parts that go with an exterior wall. */
const WALL_ATTACHED = new Set<PrimitiveCategory>(["wall", "window", "door", "balcony", "bay", "arch"]);

const EPS = 0.01;
/** Attached parts (balconies, overhanging roofs' supports) may sit slightly outside the footprint. */
const FOOTPRINT_MARGIN = 1.5;
const SIDE_TOLERANCE = WALL_THICKNESS * 1.5;

interface Bounds {
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
}

const scratch = { matrix: new THREE.Matrix4(), euler: new THREE.Euler() };

export function primitiveBounds(p: HousePrimitive): Bounds {
  if (p.kind === "triMesh") {
    const b: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    const v = p.vertices;
    for (let i = 0; i + 2 < v.length; i += 3) {
      if (v[i] < b.minX) b.minX = v[i];
      if (v[i] > b.maxX) b.maxX = v[i];
      if (v[i + 1] < b.minY) b.minY = v[i + 1];
      if (v[i + 1] > b.maxY) b.maxY = v[i + 1];
      if (v[i + 2] < b.minZ) b.minZ = v[i + 2];
      if (v[i + 2] > b.maxZ) b.maxZ = v[i + 2];
    }
    return b;
  }
  // Half-extent along each world axis of a rotated box: Σ |R[axis][j]| · half[j].
  scratch.matrix.makeRotationFromEuler(scratch.euler.set(p.rotation[0], p.rotation[1], p.rotation[2]));
  const e = scratch.matrix.elements; // column-major
  const half = p.size.map((s) => s / 2);
  const extent = (row: number) => Math.abs(e[row]) * half[0] + Math.abs(e[4 + row]) * half[1] + Math.abs(e[8 + row]) * half[2];
  const [ex, ey, ez] = [extent(0), extent(1), extent(2)];
  const [px, py, pz] = p.position;
  return { minX: px - ex, maxX: px + ex, minY: py - ey, maxY: py + ey, minZ: pz - ez, maxZ: pz + ez };
}

/**
 * Ids of the primitives to hide so a room on `level` can be seen into from above and from its south-east corner:
 *  - the roof;
 *  - everything of the house above that level (the ceiling slab included), so the room is open to the sky and its light;
 *  - the exterior walls of that level on the camera's two sides, with the windows, doors and balconies mounted on them.
 * Site objects and other levels' walls are left alone; nothing here changes the model itself.
 */
export function cutawayHiddenIds(primitives: readonly HousePrimitive[], house: Pick<HouseConfig, "width" | "depth">, level: number): Set<string> {
  const hidden = new Set<string>();
  const levelBottom = level * LEVEL_HEIGHT;
  const levelTop = (level + 1) * LEVEL_HEIGHT;
  const halfW = house.width / 2;
  const halfD = house.depth / 2;

  for (const p of primitives) {
    if (p.category === "roof") {
      hidden.add(p.id);
      continue;
    }
    if (SITE_CATEGORIES.has(p.category)) continue;

    const b = primitiveBounds(p);
    const inFootprint =
      b.maxX > -halfW - FOOTPRINT_MARGIN && b.minX < halfW + FOOTPRINT_MARGIN &&
      b.maxZ > -halfD - FOOTPRINT_MARGIN && b.minZ < halfD + FOOTPRINT_MARGIN;

    if (inFootprint && b.minY >= levelTop - EPS) {
      hidden.add(p.id);
      continue;
    }

    if (WALL_ATTACHED.has(p.category)) {
      const midY = (b.minY + b.maxY) / 2;
      if (midY <= levelBottom || midY >= levelTop) continue;
      const east = b.minX >= halfW - SIDE_TOLERANCE;
      const south = b.minZ >= halfD - SIDE_TOLERANCE;
      if (east || south) hidden.add(p.id);
    }
  }
  return hidden;
}
