import type { HousePrimitive } from "@/lib/house/types";
import type { V3Material, V3Scene, Vec3 } from "./scene";
import { materializeV3ArchitecturalObject } from "./architecture";
import { deriveV3RoomBoundaries, hostLocalToWorld, resolveV3PartitionBoundary, resolveV3Storey, type V3Door, type V3Partition, type V3RoomBoundary } from "./interior";

/**
 * Derived interior wall construction. Semantic partitions + doors are the only authority; this module turns them
 * into wall segments with real door openings cut out. Nothing here is persisted or editable:
 *
 *   semantic partition + doors → `deriveV3InteriorWalls` (segments with openings) → render compiler (now)
 *                                                                                  → collision compiler (later)
 *
 * Opening cuts live only in `deriveV3PartitionWall`, so a future collision pass reads the same segments instead of
 * re-cutting doors.
 */

export type V3WallConstruction = "solid" | "glazed" | "screen";

/**
 * What a partition type constructs. Like the object capability registry, it is open vocabulary: unregistered types
 * fall back to `V3_FALLBACK_PARTITION_TYPE` (a plain solid wall), never an error.
 */
export interface V3PartitionTypeCapability {
  /** `null` builds no wall: open plan, or a facade the host mass already constructs. */
  construction: V3WallConstruction | null;
  /** Default thickness in metres, centred on the boundary; a partition's authored `thickness` overrides it. */
  thickness: number;
  /** Caps the wall height above the storey floor (a screen); absent = full storey height. */
  maxHeight?: number;
  /** Physical: whether the wall stops movement. Read by future collision, not by rendering. */
  blocksMovement: boolean;
}

/** Normal interior wall default: 120 mm finished stud/block partition. */
export const V3_INTERIOR_WALL_THICKNESS = .12;
export const V3_FALLBACK_PARTITION_TYPE: V3PartitionTypeCapability = { construction: "solid", thickness: V3_INTERIOR_WALL_THICKNESS, blocksMovement: true };

const PARTITION_TYPES = new Map<string, V3PartitionTypeCapability>([
  ["wall", V3_FALLBACK_PARTITION_TYPE],
  ["glazed", { construction: "glazed", thickness: .08, blocksMovement: true }],
  ["screen", { construction: "screen", thickness: .05, maxHeight: 2.1, blocksMovement: true }],
  ["open", { construction: null, thickness: 0, blocksMovement: false }],
  // The host mass compiles the facade; an interior partition on it must not build a second wall.
  ["exterior-wall", { construction: null, thickness: 0, blocksMovement: true }],
]);

export const v3PartitionTypeCapability = (type: unknown): V3PartitionTypeCapability => (typeof type === "string" && PARTITION_TYPES.get(type)) || V3_FALLBACK_PARTITION_TYPE;
export const isKnownV3PartitionType = (type: unknown) => typeof type === "string" && PARTITION_TYPES.has(type);
/** Registers (or replaces) one partition type; returns an undo. */
export function registerV3PartitionType(type: string, capability: V3PartitionTypeCapability): () => void {
  const previous = PARTITION_TYPES.get(type);
  PARTITION_TYPES.set(type, capability);
  return () => { if (previous) PARTITION_TYPES.set(type, previous); else PARTITION_TYPES.delete(type); };
}

/** Door head height (opening top above the storey floor) by program. Unregistered programs use the default. */
export const V3_DEFAULT_DOOR_HEAD_HEIGHT = 2.1;
const DOOR_HEAD_HEIGHTS = new Map<string, number>([["archway", 2.4], ["opening", 2.4], ["sliding-door", 2.2]]);
export const v3DoorHeadHeight = (program: unknown) => (typeof program === "string" && DOOR_HEAD_HEIGHTS.get(program)) || V3_DEFAULT_DOOR_HEAD_HEIGHT;

/** A header thinner than this is not built: the opening simply runs to the ceiling. */
const MIN_HEADER = .05;
/** Openings narrower than this after clamping to the boundary cut nothing. */
const MIN_OPENING = .05;

/**
 * One derived wall solid in host-local plan coordinates, with world placement precomputed. `id` is stable: it is
 * built from semantic ids (partition, door) and the piece's role, never from list position or geometry.
 */
export interface V3WallSegment {
  id: string;
  /** Semantic owner selection resolves to: the partition for wall runs, the door for the header it creates. */
  sourceId: string;
  partitionId: string;
  doorId?: string;
  role: "wall" | "header";
  construction: V3WallConstruction;
  blocksMovement: boolean;
  hostMassId: string;
  storeyId: string;
  /** Host-local span along the boundary, measured on the boundary line (`axis = at`). */
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  thickness: number;
  /** World Y of the solid's bottom and top. */
  bottomY: number;
  topY: number;
  /** World centre, box size in host-local axes [x, y, z], and the host rotation about Y. */
  centre: Vec3;
  size: Vec3;
  rotationY: number;
}

/** A door opening cut into a partition, in metres along the boundary from its `from` end. */
export interface V3WallOpening { doorId: string; start: number; end: number; headY: number; }

export interface V3PartitionWall {
  partitionId: string;
  partitionType: string;
  /** False when the type was unregistered and fell back to a solid wall. */
  knownType: boolean;
  boundary: V3RoomBoundary;
  construction: V3WallConstruction | null;
  thickness: number;
  floorY: number;
  ceilingY: number;
  openings: V3WallOpening[];
  segments: V3WallSegment[];
}

/** Stable derived ids. `:` cannot occur in authored ids, so these never collide with objects or datums. */
export const v3WallSegmentId = (partitionId: string, left: string, right: string) => `${partitionId}:wall:${left}~${right}`;
export const v3DoorHeaderId = (partitionId: string, doorId: string) => `${partitionId}:header:${doorId}`;
const START = "start", END = "end";
const DERIVED_WALL_ID = /^[a-z][a-z0-9-]*:(wall:[a-z0-9-]+~[a-z0-9-]+|header:[a-z][a-z0-9-]*)$/;
/** True for a primitive derived from an interior partition (never for exterior/object geometry). */
export const isV3InteriorWallPrimitive = (primitive: { id: string }) => DERIVED_WALL_ID.test(primitive.id);

/**
 * Derives one partition's wall: the boundary segment at full storey height, minus each door opening. Doors are
 * ordered by position (then id) so the result is independent of authoring order. Overlapping openings merge into one
 * gap; each door still owns only the header over its own, not-yet-covered span.
 */
export function deriveV3PartitionWall(scene: V3Scene, partition: V3Partition, boundaries = deriveV3RoomBoundaries(scene)): V3PartitionWall | undefined {
  const boundary = resolveV3PartitionBoundary(scene, partition.id, boundaries), storey = resolveV3Storey(scene, partition.storeyId);
  if (!boundary || !storey || boundary.length <= 0) return undefined;
  const capability = v3PartitionTypeCapability(partition.partitionType), construction = capability.construction;
  const thickness = partition.thickness ?? capability.thickness;
  const { floorY, ceilingY } = storey, topY = Math.min(ceilingY, floorY + (capability.maxHeight ?? Infinity));
  const doors = (scene.interior?.doors ?? []).filter((door) => door.partitionId === partition.id);
  const openings = doors.flatMap((door): V3WallOpening[] => {
    const start = Math.max(0, door.offset - door.width / 2), end = Math.min(boundary.length, door.offset + door.width / 2);
    return end - start >= MIN_OPENING ? [{ doorId: door.id, start, end, headY: Math.min(topY, floorY + v3DoorHeadHeight(door.program)) }] : [];
  }).sort((a, b) => a.start - b.start || (a.doorId < b.doorId ? -1 : a.doorId > b.doorId ? 1 : 0));
  const wall: V3PartitionWall = { partitionId: partition.id, partitionType: partition.partitionType, knownType: isKnownV3PartitionType(partition.partitionType), boundary, construction, thickness, floorY, ceilingY, openings, segments: [] };
  if (!construction || thickness <= 0 || topY <= floorY) return wall;

  const host = materializeV3ArchitecturalObject(storey.host), rotationY = host.transform.rotation[1];
  const segment = (id: string, sourceId: string, role: V3WallSegment["role"], from: number, to: number, bottomY: number, top: number, doorId?: string): V3WallSegment => {
    const along = boundary.from + (from + to) / 2, length = to - from;
    const local: [number, number] = boundary.axis === "x" ? [boundary.at, along] : [along, boundary.at];
    const [x, z] = hostLocalToWorld(host, local);
    return {
      id, sourceId, partitionId: partition.id, ...(doorId ? { doorId } : {}), role, construction, blocksMovement: capability.blocksMovement,
      hostMassId: boundary.hostMassId, storeyId: partition.storeyId, axis: boundary.axis, at: boundary.at, from: boundary.from + from, to: boundary.from + to,
      thickness, bottomY, topY: top, centre: [x, (bottomY + top) / 2, z],
      size: boundary.axis === "x" ? [thickness, top - bottomY, length] : [length, top - bottomY, thickness], rotationY,
    };
  };

  // Walk the boundary: a solid run before each merged gap, then the run after the last gap.
  let cursor = 0, leftId = START, gapEnd = -Infinity;
  for (const opening of openings) {
    if (opening.start > gapEnd) {
      // A new gap starts: close the solid run to its left.
      if (opening.start - cursor > 0) wall.segments.push(segment(v3WallSegmentId(partition.id, leftId, opening.doorId), partition.id, "wall", cursor, opening.start, floorY, topY));
    }
    const headerFrom = Math.max(opening.start, gapEnd);
    if (opening.end - headerFrom > 0 && topY - opening.headY >= MIN_HEADER) wall.segments.push(segment(v3DoorHeaderId(partition.id, opening.doorId), opening.doorId, "header", headerFrom, opening.end, opening.headY, topY, opening.doorId));
    if (opening.end > gapEnd) { gapEnd = opening.end; leftId = opening.doorId; }
    cursor = Math.max(cursor, gapEnd);
  }
  if (boundary.length - cursor > 0) wall.segments.push(segment(v3WallSegmentId(partition.id, leftId, END), partition.id, "wall", cursor, boundary.length, floorY, topY));
  return wall;
}

/**
 * Every partition's derived wall, in partition-id order. Partitions whose boundary or storey no longer resolves are
 * skipped (the interior audit reports them); one broken partition never affects another.
 */
export function deriveV3InteriorWalls(scene: V3Scene): V3PartitionWall[] {
  const partitions = scene.interior?.partitions;
  if (!partitions?.length) return [];
  const boundaries = deriveV3RoomBoundaries(scene);
  return [...partitions].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).flatMap((partition) => {
    const wall = deriveV3PartitionWall(scene, partition, boundaries);
    return wall ? [wall] : [];
  });
}

const MATERIALS: Record<V3WallConstruction, V3Material> = {
  solid: { id: "interior-plaster", color: "#ece6dc", roughness: .86, surface: "stucco" },
  glazed: { id: "interior-glass", color: "#a9cdd6", roughness: .08, metalness: .05, opacity: .38, surface: "glass" },
  screen: { id: "interior-screen", color: "#a07a55", roughness: .7, surface: "wood" },
};
const COMPONENT_ROLES: Record<V3WallConstruction, string> = { solid: "interior wall", glazed: "glazed partition", screen: "screen partition" };

/**
 * Render compiler for derived interior walls. Each primitive names its semantic owner (`sourceObjectId`: partition,
 * or door for a header) so selection resolves to the partition/door, never to the derived piece.
 */
export function compileV3InteriorWalls(scene: V3Scene): HousePrimitive[] {
  const partitions = new Map((scene.interior?.partitions ?? []).map((partition) => [partition.id, partition]));
  const doors = new Map((scene.interior?.doors ?? []).map((door) => [door.id, door] as [string, V3Door]));
  return deriveV3InteriorWalls(scene).flatMap((wall) => wall.segments.map((segment): HousePrimitive => {
    const material = MATERIALS[segment.construction], partition = partitions.get(segment.partitionId)!, door = segment.doorId ? doors.get(segment.doorId) : undefined;
    return {
      kind: "box", id: segment.id, category: "wall", label: `${door ? door.semanticRole : partition.semanticRole} · ${segment.role === "header" ? "door header" : COMPONENT_ROLES[segment.construction]}`,
      position: segment.centre, rotation: [0, segment.rotationY, 0], size: segment.size,
      color: material.color, roughness: material.roughness, metalness: material.metalness, transparent: material.opacity !== undefined && material.opacity < 1, opacity: material.opacity, surface: material.surface === "stucco" || material.surface === "glass" || material.surface === "wood" ? material.surface : undefined,
      sourceObjectId: segment.sourceId, sourceObjectIds: segment.doorId ? [segment.doorId, segment.partitionId] : [segment.partitionId],
      semanticRole: door ? door.semanticRole : partition.semanticRole, componentRole: segment.role === "header" ? "door header" : COMPONENT_ROLES[segment.construction],
    };
  }));
}

export type V3SelectionTarget = { kind: "object" | "partition" | "door" | "storey" | "room"; id: string };
/**
 * Resolves a selection key (an authored id, or a derived primitive id) to the semantic datum that owns it. Derived
 * wall pieces resolve to their partition or door; they are never targets themselves.
 */
export function resolveV3SelectionTarget(scene: V3Scene, key: string): V3SelectionTarget | undefined {
  if (scene.objects.some((object) => object.id === key)) return { kind: "object", id: key };
  const interior = scene.interior;
  if (interior?.doors?.some((door) => door.id === key)) return { kind: "door", id: key };
  if (interior?.partitions?.some((partition) => partition.id === key)) return { kind: "partition", id: key };
  if (interior?.rooms.some((room) => room.id === key)) return { kind: "room", id: key };
  if (interior?.storeys.some((storey) => storey.id === key)) return { kind: "storey", id: key };
  const [owner, role, rest] = key.split(":");
  if (role === "header" && rest && interior?.doors?.some((door) => door.id === rest)) return { kind: "door", id: rest };
  if ((role === "wall" || role === "header") && interior?.partitions?.some((partition) => partition.id === owner)) return { kind: "partition", id: owner };
  return undefined;
}
