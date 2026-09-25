import { ROOM_LIMITS, WALL_THICKNESS } from "./constants";

/** The fields of a room the layout pass reads and rewrites; anything else on the room is left alone. */
export interface LayoutRoom {
  level: number;
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface RoomLayoutResult<T extends LayoutRoom> {
  /** Same length and order as the input; rooms on nonexistent levels are returned untouched. */
  rooms: T[];
  errors: string[];
  /** How many rooms had their position or size changed. */
  adjusted: number;
}

/** Progressively smaller versions of a room to try when it can't be placed at full size. */
const SHRINK_STEPS = [1, 0.92, 0.85, 0.78, 0.7, 0.62, 0.55];
const EPS = 1e-6;

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.z < b.z + b.d - EPS && b.z < a.z + a.d - EPS;

/**
 * Interior space available to rooms. Mirrors the arithmetic in `validateRoom` exactly so that a
 * layout that fits here can never trigger one of its clamp warnings.
 */
export function roomInterior(house: { width: number; depth: number }) {
  const usableW = Math.max(ROOM_LIMITS.width.min, house.width - WALL_THICKNESS * 2);
  const usableD = Math.max(ROOM_LIMITS.depth.min, house.depth - WALL_THICKNESS * 2);
  return {
    usableW,
    usableD,
    maxW: Math.min(ROOM_LIMITS.width.max, usableW),
    maxD: Math.min(ROOM_LIMITS.depth.max, usableD),
  };
}

type Interior = ReturnType<typeof roomInterior>;

/** Clamps a box's size into the renderer's limits and its position into the interior (same order as validateRoom). */
function fitInBounds(box: Box, interior: Interior): Box {
  const w = round2(Math.min(interior.maxW, Math.max(ROOM_LIMITS.width.min, box.w)));
  const d = round2(Math.min(interior.maxD, Math.max(ROOM_LIMITS.depth.min, box.d)));
  const maxX = Math.max(0, interior.usableW - w);
  const maxZ = Math.max(0, interior.usableD - d);
  return { w, d, x: Math.min(maxX, Math.max(0, round2(box.x))), z: Math.min(maxZ, Math.max(0, round2(box.z))) };
}

/**
 * Finds the free spot closest to where the room wanted to be. Candidates are the interior's edges
 * and the edges of already-placed rooms, so rooms pack flush against each other and the walls.
 */
function findSpot(want: Box, placed: readonly Box[], interior: Interior): Box | null {
  const base = fitInBounds(want, interior);
  const free = (b: Box) => placed.every((p) => !overlaps(b, p));
  if (free(base)) return base;

  const maxX = Math.max(0, interior.usableW - base.w);
  const maxZ = Math.max(0, interior.usableD - base.d);
  const xs = new Set<number>([0, maxX, base.x]);
  const zs = new Set<number>([0, maxZ, base.z]);
  for (const p of placed) {
    xs.add(p.x + p.w).add(p.x - base.w).add(p.x);
    zs.add(p.z + p.d).add(p.z - base.d).add(p.z);
  }

  let best: { box: Box; cost: number } | null = null;
  for (const rawX of xs) {
    const x = Math.min(maxX, Math.max(0, round2(rawX)));
    for (const rawZ of zs) {
      const z = Math.min(maxZ, Math.max(0, round2(rawZ)));
      const box = { ...base, x, z };
      if (!free(box)) continue;
      const cost = Math.abs(x - base.x) + Math.abs(z - base.z);
      const better =
        !best ||
        cost < best.cost - EPS ||
        (Math.abs(cost - best.cost) <= EPS && (z < best.box.z - EPS || (Math.abs(z - best.box.z) <= EPS && x < best.box.x - EPS)));
      if (better) best = { box, cost };
    }
  }
  return best?.box ?? null;
}

/** Places rooms one at a time in the given order; returns null if any room cannot be placed even when shrunk. */
function packLevel(wants: readonly Box[], order: readonly number[], interior: Interior): Box[] | null {
  const result: Box[] = new Array(wants.length);
  const placed: Box[] = [];
  for (const i of order) {
    let spot: Box | null = null;
    for (const scale of SHRINK_STEPS) {
      const want = { ...wants[i], w: wants[i].w * scale, d: wants[i].d * scale };
      spot = findSpot(want, placed, interior);
      if (spot) break;
    }
    if (!spot) return null;
    result[i] = spot;
    placed.push(spot);
  }
  return result;
}

/**
 * Deterministic pre-render layout pass for generated rooms. Each level is handled independently:
 *
 *  1. Sizes are clamped to the renderer's limits and positions into the interior.
 *  2. Rooms that then don't overlap anything keep the model's placement exactly.
 *  3. Rooms that overlap are slid to the nearest free spot (flush against walls and neighbours, so
 *     relative placement and adjacency are preserved as far as possible), shrinking a room a little
 *     only when no free spot fits it at full size.
 *
 * Room types, levels and order are never changed and no room is dropped. Only when a level cannot
 * be packed at all does it report an error, so the caller can ask the model for a smaller plan.
 */
export function normalizeRoomLayout<T extends LayoutRoom>(
  rooms: readonly T[],
  house: { width: number; depth: number; floors: number }
): RoomLayoutResult<T> {
  const interior = roomInterior(house);
  const out: T[] = rooms.map((r) => r);
  const errors: string[] = [];
  let adjusted = 0;

  const byLevel = new Map<number, number[]>();
  rooms.forEach((room, i) => {
    const level = Math.round(room.level);
    // A level the house doesn't have can't be laid out; final validation reports it.
    if (!Number.isFinite(level) || level < 0 || level >= house.floors) return;
    byLevel.set(level, [...(byLevel.get(level) ?? []), i]);
  });

  for (const [level, indices] of [...byLevel].sort((a, b) => a[0] - b[0])) {
    const wants = indices.map((i) => ({ x: rooms[i].x, z: rooms[i].z, w: rooms[i].width, d: rooms[i].depth }));
    // Relative placement: north-to-south, then west-to-east, as the model laid them out.
    const spatial = wants.map((_, k) => k).sort((a, b) => wants[a].z - wants[b].z || wants[a].x - wants[b].x || a - b);
    // Fallback order for crowded floors: big rooms first leaves the fewest awkward gaps.
    const bySize = wants
      .map((_, k) => k)
      .sort((a, b) => wants[b].w * wants[b].d - wants[a].w * wants[a].d || a - b);

    const packed = packLevel(wants, spatial, interior) ?? packLevel(wants, bySize, interior);
    if (!packed) {
      const area = wants.reduce((sum, w) => sum + w.w * w.d, 0);
      errors.push(
        `Level ${level}: ${indices.length} rooms (${area.toFixed(0)} m² requested) cannot be laid out without overlapping inside the ${interior.usableW.toFixed(1)} × ${interior.usableD.toFixed(1)} m interior. Use fewer or smaller rooms on that floor.`
      );
      continue;
    }

    indices.forEach((roomIndex, k) => {
      const room = rooms[roomIndex];
      const box = packed[k];
      if (room.x !== box.x || room.z !== box.z || room.width !== box.w || room.depth !== box.d) adjusted++;
      out[roomIndex] = { ...room, level, x: box.x, z: box.z, width: box.w, depth: box.d };
    });
  }

  return { rooms: out, errors, adjusted };
}
