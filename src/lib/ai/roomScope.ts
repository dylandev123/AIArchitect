import { WALL_THICKNESS } from "@/lib/house/constants";
import { FEATURE_JSON_KEY, type FeatureType } from "@/lib/house/features/featureTypes";
import { validateRoom } from "@/lib/house/features/rooms";
import { validateConfig } from "@/lib/house/generateHouse";
import type { HouseConfig, RoomType, WallSide } from "@/types/house";

type Item = Record<string, unknown>;

/** Wall-mounted parts that belong to a room by sitting on one of its exterior walls. */
export const ROOM_OPENING_TYPES = ["window", "door", "balcony"] as const satisfies readonly FeatureType[];
type OpeningType = (typeof ROOM_OPENING_TYPES)[number];

/** How close a room must sit to an exterior wall, or to a neighbour, to count as touching it. */
const EDGE_TOL = 0.6;
const SPAN_TOL = 0.05;
const MIN_SHARED_EDGE = 0.5;

/** "the ensuite", "its bathroom" — the only rooms besides the focused one a prompt can bring into scope. */
const ENSUITE_WORDS = /\b(en-?suites?|bath(room)?s?|toilet|wc|powder\s+room)\b/i;
const CLOSET_WORDS = /\b(closets?|wardrobes?|walk-in|dressing\s+room)\b/i;
const CONNECTED_TYPES: readonly RoomType[] = ["bathroom"];

/** One room's exterior wall frontage, in the same wall-offset coordinates windows/doors/balconies use. */
export interface RoomRegion {
  roomId: string;
  level: number;
  walls: Partial<Record<WallSide, [number, number]>>;
}

/** What a room-scoped edit is allowed to touch, derived from the project and checked against every op. */
export interface RoomGuard {
  regions: RoomRegion[];
  /** Existing openings in scope by id, so an update can be checked at the position it would produce. */
  openings: Record<OpeningType, Map<string, Item>>;
  /** Only the focused room may be removed; a connected ensuite can be changed but not deleted. */
  removableRoomId: string;
}

export interface RoomTargets {
  picks: Partial<Record<FeatureType, Item[]>>;
  guard: RoomGuard;
  /** Human-readable frontage of each editable room, shown to the model so it can place openings. */
  geometry: string;
}

export type RoomTargetResult = RoomTargets | { error: string };

const isRecord = (v: unknown): v is Item => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function itemsOf(root: Record<string, unknown>, type: FeatureType): Item[] {
  const arr = root[FEATURE_JSON_KEY[type]];
  return Array.isArray(arr) ? arr.filter(isRecord) : [];
}

interface Box {
  id: string;
  type: RoomType;
  level: number;
  x: number;
  z: number;
  width: number;
  depth: number;
}

function boxOf(item: Item, config: HouseConfig): Box | null {
  const room = validateRoom(item, config).value;
  if (!room || typeof item.id !== "string") return null;
  return { id: item.id, ...room };
}

function regionOf(box: Box, config: HouseConfig): RoomRegion {
  const innerW = config.width - WALL_THICKNESS * 2;
  const innerD = config.depth - WALL_THICKNESS * 2;
  const walls: RoomRegion["walls"] = {};
  if (box.z <= EDGE_TOL) walls.north = [WALL_THICKNESS + box.x, WALL_THICKNESS + box.x + box.width];
  if (box.z + box.depth >= innerD - EDGE_TOL) walls.south = [WALL_THICKNESS + box.x, WALL_THICKNESS + box.x + box.width];
  if (box.x <= EDGE_TOL) walls.west = [WALL_THICKNESS + box.z, WALL_THICKNESS + box.z + box.depth];
  if (box.x + box.width >= innerW - EDGE_TOL) walls.east = [WALL_THICKNESS + box.z, WALL_THICKNESS + box.z + box.depth];
  return { roomId: box.id, level: box.level, walls };
}

/** True when `b` shares a wall (not just a corner) with `a` on the same floor. */
function adjacent(a: Box, b: Box): boolean {
  if (a.level !== b.level || a.id === b.id) return false;
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapZ = Math.min(a.z + a.depth, b.z + b.depth) - Math.max(a.z, b.z);
  const touchX = Math.abs(a.x + a.width - b.x) <= EDGE_TOL || Math.abs(b.x + b.width - a.x) <= EDGE_TOL;
  const touchZ = Math.abs(a.z + a.depth - b.z) <= EDGE_TOL || Math.abs(b.z + b.depth - a.z) <= EDGE_TOL;
  return (touchX && overlapZ >= MIN_SHARED_EDGE) || (touchZ && overlapX >= MIN_SHARED_EDGE);
}

interface Placement {
  wall: WallSide;
  level: number;
  start: number;
  end: number;
}

function placementOf(item: Item): Placement | null {
  const [offset, width] = [num(item.offset), num(item.width)];
  const level = num(item.level);
  const wall = item.wall;
  if (offset === null || width === null || level === null) return null;
  if (wall !== "north" && wall !== "south" && wall !== "east" && wall !== "west") return null;
  return { wall, level, start: offset, end: offset + width };
}

/** Whole opening lies on the room's frontage (used for new openings). */
function contained(p: Placement, r: RoomRegion): boolean {
  const span = r.walls[p.wall];
  return !!span && p.level === r.level && p.start >= span[0] - SPAN_TOL && p.end <= span[1] + SPAN_TOL;
}

/** Opening's centre lies on the room's frontage (used to claim existing openings and to allow resizing them). */
function centred(p: Placement, r: RoomRegion): boolean {
  const span = r.walls[p.wall];
  const mid = (p.start + p.end) / 2;
  return !!span && p.level === r.level && mid >= span[0] - SPAN_TOL && mid <= span[1] + SPAN_TOL;
}

function describeRegion(name: string, r: RoomRegion): string {
  const walls = Object.entries(r.walls).map(([w, s]) => `${w} wall offsets ${s![0].toFixed(1)}–${s![1].toFixed(1)}`);
  return `${name} (level ${r.level}): ${walls.length > 0 ? walls.join("; ") : "no exterior wall — windows, doors and balconies cannot be added"}`;
}

/**
 * Resolves what a room-scoped edit may touch: the focused room, the windows/doors/balconies on its
 * exterior walls, and — only when the prompt names it and exactly one candidate exists — the
 * bathroom directly connected to it. Ids are trusted over positions: a stale array index never
 * retargets a different room. Anything unresolvable or ambiguous is an `error`, never a wider scope.
 */
export function resolveRoomTargets(
  prepared: Record<string, unknown>,
  scope: { filter?: { indices?: number[] }; roomId?: string },
  prompt: string
): RoomTargetResult {
  const { config } = validateConfig(prepared);
  if (!config) return { error: "This project has no valid house to edit a room in." };

  const rawRooms = itemsOf(prepared, "room");
  const boxes = rawRooms.map((r) => boxOf(r, config)).filter((b): b is Box => b !== null);

  const pinned = scope.filter?.indices?.[0];
  const byId = scope.roomId ? boxes.find((b) => b.id === scope.roomId) : undefined;
  const byIndex = pinned !== undefined && rawRooms[pinned] ? boxOf(rawRooms[pinned], config) : null;
  // A known id wins; an index is only trusted while the room there is still the one that was focused.
  const focus = byId ?? (scope.roomId ? null : byIndex);
  if (!focus) return { error: "That room no longer exists in the design, so nothing was changed." };

  const editable: Box[] = [focus];
  let connected: Box | undefined;
  if (ENSUITE_WORDS.test(prompt) && !CONNECTED_TYPES.includes(focus.type)) {
    const candidates = boxes.filter((b) => CONNECTED_TYPES.includes(b.type) && adjacent(focus, b));
    if (candidates.length !== 1) {
      return {
        error:
          candidates.length === 0
            ? "I couldn't find an ensuite directly connected to this room, so nothing was changed."
            : "More than one bathroom touches this room, so I can't tell which one you mean. Step into it and ask again.",
      };
    }
    connected = candidates[0];
    editable.push(connected);
  } else if (CLOSET_WORDS.test(prompt)) {
    return { error: "Closets aren't a room type in this design yet, so I can't edit one. Nothing was changed." };
  }

  const regions = editable.map((b) => regionOf(b, config));
  const nameOf = (b: Box) => (b === focus ? "Focused room" : "Connected ensuite");

  const picks: RoomTargets["picks"] = { room: editable.map((b) => rawRooms.find((r) => r.id === b.id)!) };
  const openings = {} as RoomGuard["openings"];
  for (const type of ROOM_OPENING_TYPES) {
    const claimed = itemsOf(prepared, type).filter((item) => {
      const p = placementOf(item);
      return !!p && typeof item.id === "string" && regions.some((r) => centred(p, r));
    });
    picks[type] = claimed;
    openings[type] = new Map(claimed.map((i) => [String(i.id), i]));
  }

  return {
    picks,
    guard: { regions, openings, removableRoomId: focus.id },
    geometry: editable.map((b, i) => describeRegion(`${nameOf(b)} ${b.id}`, regions[i])).join("\n"),
  };
}

const OPENING_OP = /^(add|update|remove)(Window|Door|Balcony)$/;

/**
 * Placement rule for a room-scoped op: new openings must sit wholly on the room's frontage, and an
 * updated opening must keep its centre there. Returns a rejection reason, or null when acceptable.
 */
export function checkRoomOp(
  op: { op: string; id?: string; value?: Record<string, unknown>; fields?: Record<string, unknown> },
  guard: RoomGuard
): string | null {
  if (op.op === "removeRoom") return op.id === guard.removableRoomId ? null : "only the focused room may be removed";
  const m = OPENING_OP.exec(op.op);
  if (!m || m[1] === "remove") return null;
  const type = m[2].toLowerCase() as OpeningType;

  if (m[1] === "add") {
    const p = op.value ? placementOf(op.value) : null;
    return p && guard.regions.some((r) => contained(p, r)) ? null : "new openings must sit on this room's own exterior wall";
  }
  const existing = guard.openings[type].get(String(op.id));
  if (!existing) return "that item is not on this room's walls";
  const p = placementOf({ ...existing, ...op.fields });
  return p && guard.regions.some((r) => centred(p, r)) ? null : "the item would move off this room's exterior wall";
}
