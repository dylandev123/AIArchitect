import type { V3Scene, V3SceneObject } from "./scene";
import { materializeV3ArchitecturalObject } from "./architecture";
import { getObjectBaseY, scaledDimensionsOf } from "./elevation";
import { v3HostClassOf } from "./capabilities";

/**
 * Semantic interior: authored storeys and rooms. Both are datums, never scene objects, so the exterior compiler
 * (which only walks `scene.objects`) cannot render, ground or support them. Rooms carry no Y: their vertical
 * position is always their storey's, and a storey's is always relative to its host mass base.
 *
 * Rooms → derived boundaries → authored partitions → authored door openings are all semantic. Partitions and doors
 * are the only interior datums with geometry, and it is always derived (`interiorWalls.ts`), never persisted.
 */

/** A floor datum inside one host mass. `elevation` is the finished-floor height above the host mass base. */
export interface V3Storey {
  id: string;
  hostMassId: string;
  /** 0 = lowest authored storey of the host. Unique per host. */
  index: number;
  elevation: number;
  /** Floor-to-floor height. */
  height: number;
  label: string;
  semanticRole: string;
}

/** Plan rectangle in host-mass local metres: centred on the mass, before its rotationY. */
export interface V3RoomFootprint { x: number; z: number; width: number; depth: number; }

/** Open program vocabulary (like `semanticRole`): known values are suggestions, not a whitelist. */
export type V3RoomProgram = "living" | "dining" | "kitchen" | "entry" | "hall" | "bedroom" | "bathroom" | "study" | "utility" | "storage" | (string & {});

export interface V3Room {
  id: string;
  storeyId: string;
  hostMassId: string;
  program: V3RoomProgram;
  footprint: V3RoomFootprint;
  label: string;
  semanticRole: string;
}

/** Open vocabulary: known values are suggestions. */
export type V3PartitionType = "wall" | "glazed" | "screen" | "open" | "exterior-wall" | (string & {});

/**
 * Authored semantic partition along one derived boundary. `roomBId: null` means the room's exterior side; the side is
 * carried by `boundaryId`. Never rendered; it only reserves the boundary for future wall construction.
 */
export interface V3Partition {
  id: string;
  storeyId: string;
  roomAId: string;
  roomBId: string | null;
  boundaryId: string;
  partitionType: V3PartitionType;
  semanticRole: string;
  /** Optional authored wall thickness in metres, centred on the boundary. Absent = the partition type's default. */
  thickness?: number;
}

export type V3DoorProgram = "door" | "double-door" | "sliding-door" | "pocket-door" | "opening" | "archway" | (string & {});

/** Authored semantic opening in a partition. `offset` is the opening centre, in metres from the boundary's `from` end. */
export interface V3Door {
  id: string;
  partitionId: string;
  offset: number;
  width: number;
  program: V3DoorProgram;
  semanticRole: string;
}

export type V3StairType = "straight" | "l-shaped" | "u-shaped" | "spiral";
export type V3PlanDirection = "north" | "south" | "east" | "west";

/**
 * Authored vertical circulation inside one host mass: a stair or lift connecting two of the host's storeys. Like
 * rooms it carries no Y; storey indices resolve against the host's compiled floor datums. `toLevel` equal to the
 * host's level count means its roof datum (rooftop terrace or a mass stacked on it). Treads, landings, floor
 * openings, guards and lift shafts are derived at compile time (`circulation.ts`), never persisted.
 */
export interface V3Circulation {
  id: string;
  type: "stair" | "lift";
  hostMassId: string;
  fromLevel: number;
  toLevel: number;
  /** Plan rectangle in host-local metres (centred on the mass, before rotationY). All geometry stays inside it. */
  footprint: V3RoomFootprint;
  stairType?: V3StairType;
  /** Host-local direction the first flight climbs toward (stairs), or the side the lift doors face. */
  direction?: V3PlanDirection;
  /** Which way an L/U stair turns at its landing, seen climbing the first flight. */
  turn?: "left" | "right";
  label?: string;
  semanticRole?: string;
}

/** `partitions`/`doors`/`circulation` are optional so storey/room-only scenes keep their exact persisted shape. */
export interface V3Interior { storeys: V3Storey[]; rooms: V3Room[]; partitions?: V3Partition[]; doors?: V3Door[]; circulation?: V3Circulation[]; }

export type V3ExteriorSide = "x-" | "x+" | "z-" | "z+";
/**
 * Derived (never persisted) boundary segment in host-local metres. It lies on the line `axis = at` and spans
 * `from`..`to` along the other axis. Shared boundaries join an `adjacent` room pair; exterior boundaries are a room
 * side lying on its host mass perimeter.
 */
export interface V3RoomBoundary {
  id: string;
  role: "shared" | "exterior";
  storeyId: string;
  hostMassId: string;
  roomAId: string;
  roomBId: string | null;
  side?: V3ExteriorSide;
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  length: number;
}

export interface V3ResolvedStorey { storey: V3Storey; host: V3SceneObject; floorY: number; ceilingY: number; }
export interface V3ResolvedRoom extends V3ResolvedStorey { room: V3Room; /** World [x, z] corners, counter-clockwise from local (-w/2, -d/2). */ corners: [number, number][]; centre: [number, number]; }

export interface V3InteriorIssue { code: string; targetId: string; message: string; severity: "fatal" | "physical" | "advisory"; }

const EPSILON = .05;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const hostOf = (scene: V3Scene, id: string) => scene.objects.find((object) => object.id === id);

/** Every id an interior datum owns. Object, storey, room, partition and door ids share one namespace. */
export const v3InteriorIds = (scene: V3Scene): string[] => [...(scene.interior?.storeys ?? []), ...(scene.interior?.rooms ?? []), ...(scene.interior?.partitions ?? []), ...(scene.interior?.doors ?? []), ...(scene.interior?.circulation ?? [])].map((datum) => datum.id);

/** Ids a scene relationship may reference: objects plus interior datums. */
export const v3RelationshipTargetIds = (scene: V3Scene): Set<string> => new Set([...(scene.objects ?? []).map((object) => object?.id).filter((id): id is string => !!id), ...v3InteriorIds(scene)]);

/** Host-local plan point → world [x, z], using the same rotation convention as the compiler's `localPoint`. */
export function hostLocalToWorld(host: V3SceneObject, [lx, lz]: [number, number]): [number, number] {
  const canonical = materializeV3ArchitecturalObject(host), [ox, , oz] = canonical.transform.position, angle = canonical.transform.rotation[1];
  const c = Math.cos(angle), s = Math.sin(angle);
  return [ox + lx * c + lz * s, oz - lx * s + lz * c];
}

export function resolveV3Storey(scene: V3Scene, storeyId: string): V3ResolvedStorey | undefined {
  const storey = scene.interior?.storeys.find((candidate) => candidate.id === storeyId);
  const host = storey && hostOf(scene, storey.hostMassId);
  if (!storey || !host) return undefined;
  const floorY = getObjectBaseY(materializeV3ArchitecturalObject(host)) + storey.elevation;
  return { storey, host, floorY, ceilingY: floorY + storey.height };
}

/** The only way a room acquires world elevation: through its storey, which is anchored to its host mass. */
export function resolveV3Room(scene: V3Scene, roomId: string): V3ResolvedRoom | undefined {
  const room = scene.interior?.rooms.find((candidate) => candidate.id === roomId);
  const storey = room && resolveV3Storey(scene, room.storeyId);
  if (!room || !storey) return undefined;
  const { x, z, width, depth } = room.footprint;
  const local: [number, number][] = [[x - width / 2, z - depth / 2], [x + width / 2, z - depth / 2], [x + width / 2, z + depth / 2], [x - width / 2, z + depth / 2]];
  return { ...storey, room, corners: local.map((point) => hostLocalToWorld(storey.host, point)), centre: hostLocalToWorld(storey.host, [x, z]) };
}

const intervalOverlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);
/** Minimum shared length for a declared adjacency to count as a real boundary. */
export const MIN_SHARED_BOUNDARY = .3;
/** Upper bound for an authored partition thickness. */
export const MAX_PARTITION_THICKNESS = 1;
type Segment = Pick<V3RoomBoundary, "axis" | "at" | "from" | "to" | "length">;
const spans = (f: V3RoomFootprint) => ({ x: [f.x - f.width / 2, f.x + f.width / 2], z: [f.z - f.depth / 2, f.z + f.depth / 2] });
/** Longest host-local segment two rectangles share (undefined when they only meet at a corner or are apart). */
export function sharedBoundarySegment(a: V3RoomFootprint, b: V3RoomFootprint): Segment | undefined {
  const sa = spans(a), sb = spans(b);
  let best: Segment | undefined;
  for (const axis of ["x", "z"] as const) {
    const other = axis === "x" ? "z" : "x";
    for (const [edgeA, edgeB] of [[sa[axis][1], sb[axis][0]], [sb[axis][1], sa[axis][0]]]) {
      if (Math.abs(edgeA - edgeB) > EPSILON) continue;
      const from = Math.max(sa[other][0], sb[other][0]), to = Math.min(sa[other][1], sb[other][1]), length = to - from;
      if (length > 0 && (!best || length > best.length)) best = { axis, at: (edgeA + edgeB) / 2, from, to, length };
    }
  }
  return best;
}
/** Length of shared boundary between two host-local rectangles (0 when they only meet at a corner or are apart). */
export function sharedBoundaryLength(a: V3RoomFootprint, b: V3RoomFootprint): number {
  return sharedBoundarySegment(a, b)?.length ?? 0;
}

/**
 * Stable boundary ids depend only on room ids and boundary role, never on geometry or list order. Room ids cannot
 * contain `:` or `|`, so these never collide with each other or with authored ids.
 */
export const v3SharedBoundaryId = (roomA: string, roomB: string) => `boundary:${[roomA, roomB].sort().join("|")}`;
export const v3ExteriorBoundaryId = (roomId: string, side: V3ExteriorSide) => `boundary:${roomId}|exterior:${side}`;
const EXTERIOR_SIDES: V3ExteriorSide[] = ["x-", "x+", "z-", "z+"];

/**
 * Derives every boundary from authored room footprints: one per `adjacent` same-storey pair with at least
 * MIN_SHARED_BOUNDARY of shared edge, plus each room side that lies on its host mass perimeter. Pure and
 * deterministic; sorted by id so adding or removing rooms never renames or reorders unrelated boundaries.
 */
export function deriveV3RoomBoundaries(scene: V3Scene): V3RoomBoundary[] {
  const rooms = new Map((scene.interior?.rooms ?? []).filter((room) => room?.footprint).map((room) => [room.id, room]));
  const boundaries = new Map<string, V3RoomBoundary>();
  for (const relationship of scene.relationships ?? []) {
    if (relationship.kind !== "adjacent") continue;
    const a = rooms.get(relationship.from), b = rooms.get(relationship.to);
    if (!a || !b || a.id === b.id || a.storeyId !== b.storeyId || a.hostMassId !== b.hostMassId) continue;
    const segment = sharedBoundarySegment(a.footprint, b.footprint);
    if (!segment || segment.length < MIN_SHARED_BOUNDARY) continue;
    const [roomAId, roomBId] = [a.id, b.id].sort(), id = v3SharedBoundaryId(roomAId, roomBId);
    boundaries.set(id, { id, role: "shared", storeyId: a.storeyId, hostMassId: a.hostMassId, roomAId, roomBId, ...segment });
  }
  for (const room of rooms.values()) {
    const host = hostOf(scene, room.hostMassId);
    if (!host) continue;
    const [width, , depth] = scaledDimensionsOf(materializeV3ArchitecturalObject(host)), span = spans(room.footprint);
    for (const side of EXTERIOR_SIDES) {
      const axis = side[0] as "x" | "z", other = axis === "x" ? "z" : "x", half = (axis === "x" ? width : depth) / 2;
      const at = span[axis][side[1] === "-" ? 0 : 1], perimeter = side[1] === "-" ? -half : half;
      if (Math.abs(at - perimeter) > EPSILON) continue;
      const from = Math.max(span[other][0], -((other === "x" ? width : depth) / 2)), to = Math.min(span[other][1], (other === "x" ? width : depth) / 2);
      if (to - from < MIN_SHARED_BOUNDARY) continue;
      const id = v3ExteriorBoundaryId(room.id, side);
      boundaries.set(id, { id, role: "exterior", storeyId: room.storeyId, hostMassId: room.hostMassId, roomAId: room.id, roomBId: null, side, axis, at: perimeter, from, to, length: to - from });
    }
  }
  return [...boundaries.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Derived boundaries a room contributes to; a room edit can only affect these. */
export const v3BoundariesOfRoom = (scene: V3Scene, roomId: string) => deriveV3RoomBoundaries(scene).filter((boundary) => boundary.roomAId === roomId || boundary.roomBId === roomId);

/** The boundary id a partition must name, from its own room references (or undefined when they cannot form one). */
function expectedPartitionBoundaryIds(partition: V3Partition): string[] {
  if (partition.roomBId === null) return EXTERIOR_SIDES.map((side) => v3ExteriorBoundaryId(partition.roomAId, side));
  return [v3SharedBoundaryId(partition.roomAId, partition.roomBId)];
}

/** Resolves a partition's boundary segment, or undefined when its rooms no longer form that boundary. */
export function resolveV3PartitionBoundary(scene: V3Scene, partitionId: string, boundaries = deriveV3RoomBoundaries(scene)): V3RoomBoundary | undefined {
  const partition = scene.interior?.partitions?.find((candidate) => candidate.id === partitionId);
  return partition && boundaries.find((boundary) => boundary.id === partition.boundaryId && expectedPartitionBoundaryIds(partition).includes(boundary.id));
}
const footprintOverlapArea = (a: V3RoomFootprint, b: V3RoomFootprint) => Math.max(0, intervalOverlap(a.x - a.width / 2, a.x + a.width / 2, b.x - b.width / 2, b.x + b.width / 2)) * Math.max(0, intervalOverlap(a.z - a.depth / 2, a.z + a.depth / 2, b.z - b.depth / 2, b.z + b.depth / 2));

/** Objective interior checks. Absent `interior` (every exterior-only scene) yields no issues. */
export function auditV3Interior(scene: V3Scene): V3InteriorIssue[] {
  const interior = scene.interior, issues: V3InteriorIssue[] = [];
  if (!interior) return issues;
  const issue = (severity: V3InteriorIssue["severity"], code: string, targetId: string, message: string) => issues.push({ severity, code, targetId, message });
  if (!Array.isArray(interior.storeys) || !Array.isArray(interior.rooms)) { issue("fatal", "INVALID_INTERIOR", "interior", "Interior needs storeys and rooms arrays."); return issues; }
  const objectIds = new Set(scene.objects.map((object) => object.id)), seen = new Set<string>();
  const claim = (id: unknown, kind: string) => {
    if (typeof id !== "string" || !/^[a-zA-Z][a-zA-Z0-9-]{1,63}$/.test(id)) { issue("fatal", "INVALID_INTERIOR_ID", String(id), `${kind} id ${String(id)} is not a stable id.`); return false; }
    if (seen.has(id) || objectIds.has(id)) { issue("fatal", "DUPLICATE_SEMANTIC_ID", id, `${kind} id ${id} collides with another object, storey or room.`); return false; }
    seen.add(id); return true;
  };
  const storeys = new Map<string, V3Storey>();
  for (const storey of interior.storeys) {
    if (!claim(storey?.id, "Storey")) continue;
    if (!Number.isInteger(storey.index) || storey.index < 0 || !finite(storey.elevation) || !finite(storey.height) || storey.height <= 0) { issue("fatal", "INVALID_STOREY", storey.id, `Storey ${storey.id} needs a non-negative integer index, finite elevation and positive height.`); continue; }
    storeys.set(storey.id, storey);
    const host = hostOf(scene, storey.hostMassId);
    if (!host) { issue("fatal", "MISSING_STOREY_HOST", storey.id, `Storey ${storey.id} references missing host mass ${storey.hostMassId}.`); continue; }
    if (v3HostClassOf(host.type) !== "mass") issue("fatal", "STOREY_HOST_NOT_MASS", storey.id, `Storey ${storey.id} host ${host.id} is not a building mass.`);
    const hostHeight = scaledDimensionsOf(materializeV3ArchitecturalObject(host))[1];
    if (storey.elevation < -EPSILON || storey.elevation + storey.height > hostHeight + EPSILON) issue("advisory", "STOREY_OUTSIDE_HOST", storey.id, `Storey ${storey.id} (${storey.elevation}–${storey.elevation + storey.height}m) exceeds host ${host.id} height ${hostHeight}m.`);
  }
  const byHost = new Map<string, V3Storey[]>();
  for (const storey of storeys.values()) byHost.set(storey.hostMassId, [...(byHost.get(storey.hostMassId) ?? []), storey]);
  for (const list of byHost.values()) {
    const sorted = [...list].sort((a, b) => a.index - b.index);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].index === sorted[i - 1].index) issue("physical", "DUPLICATE_STOREY_INDEX", sorted[i].id, `Storeys ${sorted[i - 1].id} and ${sorted[i].id} share index ${sorted[i].index}.`);
      else if (sorted[i].elevation < sorted[i - 1].elevation + sorted[i - 1].height - EPSILON) issue("advisory", "STOREY_OVERLAP", sorted[i].id, `Storey ${sorted[i].id} starts inside storey ${sorted[i - 1].id}.`);
    }
  }
  const rooms = new Map<string, V3Room>();
  for (const room of interior.rooms) {
    if (!claim(room?.id, "Room")) continue;
    const f = room.footprint;
    if (!f || !finite(f.x) || !finite(f.z) || !finite(f.width) || !finite(f.depth) || f.width <= 0 || f.depth <= 0) { issue("fatal", "INVALID_ROOM_FOOTPRINT", room.id, `Room ${room.id} needs a finite positive local footprint.`); continue; }
    rooms.set(room.id, room);
    const storey = storeys.get(room.storeyId);
    if (!storey) { issue("fatal", "ROOM_MISSING_STOREY", room.id, `Room ${room.id} references missing storey ${room.storeyId}.`); continue; }
    if (storey.hostMassId !== room.hostMassId) { issue("fatal", "ROOM_HOST_MISMATCH", room.id, `Room ${room.id} host ${room.hostMassId} differs from its storey host ${storey.hostMassId}.`); continue; }
    const host = hostOf(scene, room.hostMassId);
    if (!host) continue;
    const [width, , depth] = scaledDimensionsOf(materializeV3ArchitecturalObject(host));
    if (Math.abs(f.x) + f.width / 2 > width / 2 + EPSILON || Math.abs(f.z) + f.depth / 2 > depth / 2 + EPSILON) issue("advisory", "ROOM_OUTSIDE_HOST", room.id, `Room ${room.id} footprint extends beyond host ${host.id}.`);
  }
  const perStorey = new Map<string, V3Room[]>();
  for (const room of rooms.values()) perStorey.set(room.storeyId, [...(perStorey.get(room.storeyId) ?? []), room]);
  for (const list of perStorey.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (footprintOverlapArea(list[i].footprint, list[j].footprint) > EPSILON) issue("advisory", "ROOM_OVERLAP", list[j].id, `Rooms ${list[i].id} and ${list[j].id} overlap on storey ${list[i].storeyId}.`);
  }
  for (const relationship of scene.relationships ?? []) {
    if (relationship.kind !== "adjacent") continue;
    const a = rooms.get(relationship.from), b = rooms.get(relationship.to), target = `${relationship.from}->${relationship.to}`;
    if (!a || !b) { issue("physical", "INVALID_ROOM_ADJACENCY", target, `Adjacency ${target} must join two rooms.`); continue; }
    if (a.storeyId !== b.storeyId) { issue("physical", "INVALID_ROOM_ADJACENCY", target, `Adjacent rooms ${a.id} and ${b.id} are on different storeys.`); continue; }
    if (sharedBoundaryLength(a.footprint, b.footprint) < MIN_SHARED_BOUNDARY) issue("advisory", "ROOM_ADJACENCY_NO_SHARED_BOUNDARY", target, `Rooms ${a.id} and ${b.id} are declared adjacent but share no boundary.`);
  }
  auditPartitionsAndDoors(scene, storeys, rooms, claim, issue);
  // Saved-scene validation keeps circulation geometry advisory and its ids in the shared namespace.
  // New-generation consistency separately rejects objectively unusable authored circulation.
  if (interior.circulation !== undefined && !Array.isArray(interior.circulation)) issue("fatal", "INVALID_INTERIOR", "interior", "Interior circulation must be an array.");
  else for (const entry of interior.circulation ?? []) claim(entry?.id, "Circulation");
  return issues;
}

/**
 * Broken references (missing storey/room/partition, a boundary id the rooms cannot name, malformed numbers) are
 * fatal. Geometry that a room move/resize can invalidate (rooms no longer share the boundary, a door no longer fits)
 * is `physical`, so the room edit still saves and the affected partition/door is reported, never silently changed.
 */
function auditPartitionsAndDoors(scene: V3Scene, storeys: Map<string, V3Storey>, rooms: Map<string, V3Room>, claim: (id: unknown, kind: string) => boolean, issue: (severity: V3InteriorIssue["severity"], code: string, targetId: string, message: string) => void) {
  const interior = scene.interior!;
  if (interior.partitions === undefined && interior.doors === undefined) return;
  if ((interior.partitions !== undefined && !Array.isArray(interior.partitions)) || (interior.doors !== undefined && !Array.isArray(interior.doors))) { issue("fatal", "INVALID_INTERIOR", "interior", "Interior partitions and doors must be arrays."); return; }
  const boundaries = new Map(deriveV3RoomBoundaries(scene).map((boundary) => [boundary.id, boundary]));
  const partitions = new Map<string, V3RoomBoundary | undefined>(), boundaryOwners = new Map<string, string>();
  for (const partition of interior.partitions ?? []) {
    if (!claim(partition?.id, "Partition")) continue;
    const fail = (code: string, message: string) => issue("fatal", code, partition.id, message);
    if (typeof partition.boundaryId !== "string" || typeof partition.roomAId !== "string" || (partition.roomBId !== null && typeof partition.roomBId !== "string") || typeof partition.partitionType !== "string" || !partition.partitionType) { fail("INVALID_PARTITION", `Partition ${partition.id} needs roomAId, roomBId (or null for exterior), boundaryId and partitionType.`); continue; }
    if (partition.thickness !== undefined && (!finite(partition.thickness) || partition.thickness <= 0 || partition.thickness > MAX_PARTITION_THICKNESS)) { fail("INVALID_PARTITION", `Partition ${partition.id} thickness must be a positive number up to ${MAX_PARTITION_THICKNESS}m.`); continue; }
    if (!storeys.has(partition.storeyId)) { fail("PARTITION_MISSING_STOREY", `Partition ${partition.id} references missing storey ${partition.storeyId}.`); continue; }
    const roomIds = [partition.roomAId, ...(partition.roomBId === null ? [] : [partition.roomBId])];
    const missing = roomIds.find((id) => !rooms.has(id));
    if (missing) { fail("PARTITION_MISSING_ROOM", `Partition ${partition.id} references missing room ${missing}.`); continue; }
    if (partition.roomAId === partition.roomBId) { fail("INVALID_PARTITION", `Partition ${partition.id} must join two different rooms.`); continue; }
    const offStorey = roomIds.find((id) => rooms.get(id)!.storeyId !== partition.storeyId);
    if (offStorey) { fail("PARTITION_STOREY_MISMATCH", `Partition ${partition.id} room ${offStorey} is not on storey ${partition.storeyId}.`); continue; }
    if (!expectedPartitionBoundaryIds(partition).includes(partition.boundaryId)) { fail("PARTITION_BOUNDARY_MISMATCH", `Partition ${partition.id} boundary ${partition.boundaryId} is not a boundary of its rooms.`); continue; }
    const owner = boundaryOwners.get(partition.boundaryId);
    if (owner) { fail("DUPLICATE_PARTITION_BOUNDARY", `Partitions ${owner} and ${partition.id} both claim boundary ${partition.boundaryId}.`); continue; }
    boundaryOwners.set(partition.boundaryId, partition.id);
    const boundary = boundaries.get(partition.boundaryId);
    partitions.set(partition.id, boundary);
    if (!boundary) issue("physical", "PARTITION_BOUNDARY_UNRESOLVED", partition.id, partition.roomBId === null
      ? `Partition ${partition.id}: room ${partition.roomAId} no longer has exterior boundary ${partition.boundaryId}.`
      : `Partition ${partition.id}: rooms ${partition.roomAId} and ${partition.roomBId} no longer share a declared adjacent boundary of at least ${MIN_SHARED_BOUNDARY}m.`);
  }
  const perPartition = new Map<string, V3Door[]>();
  for (const door of interior.doors ?? []) {
    if (!claim(door?.id, "Door")) continue;
    if (!finite(door.offset) || !finite(door.width) || door.width <= 0 || typeof door.program !== "string" || !door.program) { issue("fatal", "INVALID_DOOR", door.id, `Door ${door.id} needs a finite offset, positive width and program.`); continue; }
    if (!partitions.has(door.partitionId)) { issue("fatal", "DOOR_MISSING_PARTITION", door.id, `Door ${door.id} references missing partition ${door.partitionId}.`); continue; }
    const boundary = partitions.get(door.partitionId);
    if (!boundary) { issue("physical", "DOOR_BOUNDARY_UNRESOLVED", door.id, `Door ${door.id} sits on partition ${door.partitionId}, whose boundary no longer resolves.`); continue; }
    if (door.offset - door.width / 2 < -EPSILON || door.offset + door.width / 2 > boundary.length + EPSILON) issue("physical", "DOOR_OUTSIDE_BOUNDARY", door.id, `Door ${door.id} (${door.width}m at ${door.offset}m) does not fit boundary ${boundary.id} (${boundary.length.toFixed(2)}m).`);
    perPartition.set(door.partitionId, [...(perPartition.get(door.partitionId) ?? []), door]);
  }
  for (const list of perPartition.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (Math.abs(list[i].offset - list[j].offset) < (list[i].width + list[j].width) / 2 - EPSILON) issue("advisory", "DOOR_OVERLAP", list[j].id, `Doors ${list[i].id} and ${list[j].id} overlap on partition ${list[i].partitionId}.`);
  }
}

/** Room adjacency graph from authored `adjacent` relationships (undirected). */
export function v3RoomAdjacency(scene: V3Scene): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>((scene.interior?.rooms ?? []).map((room) => [room.id, new Set<string>()]));
  for (const relationship of scene.relationships ?? []) if (relationship.kind === "adjacent" && graph.has(relationship.from) && graph.has(relationship.to)) {
    graph.get(relationship.from)!.add(relationship.to); graph.get(relationship.to)!.add(relationship.from);
  }
  return graph;
}

/**
 * Cascades a host-mass deletion to the storeys and rooms it hosted (and relationships naming them). Only datums
 * hosted by `removedIds` are touched; never invents datums, and a scene without `interior` keeps none.
 */
export function pruneV3InteriorForDeletedObjects(scene: V3Scene, removedIds: ReadonlySet<string>): void {
  if (!scene.interior || !removedIds.size) return;
  if (scene.interior.circulation?.some((entry) => removedIds.has(entry.hostMassId))) {
    const dropped = new Set(scene.interior.circulation.filter((entry) => removedIds.has(entry.hostMassId)).map((entry) => entry.id));
    scene.interior = { ...scene.interior, circulation: scene.interior.circulation.filter((entry) => !dropped.has(entry.id)) };
    scene.relationships = scene.relationships.filter((relationship) => !dropped.has(relationship.from) && !dropped.has(relationship.to));
  }
  const storeys = scene.interior.storeys.filter((storey) => !removedIds.has(storey.hostMassId));
  const removedStoreys = new Set(scene.interior.storeys.filter((storey) => removedIds.has(storey.hostMassId)).map((storey) => storey.id));
  const rooms = scene.interior.rooms.filter((room) => !removedIds.has(room.hostMassId) && !removedStoreys.has(room.storeyId));
  if (storeys.length === scene.interior.storeys.length && rooms.length === scene.interior.rooms.length) return;
  const removed = new Set([...v3InteriorIds(scene)].filter((id) => !storeys.some((storey) => storey.id === id) && !rooms.some((room) => room.id === id)));
  scene.interior = { ...scene.interior, storeys, rooms };
  pruneV3InteriorForRemovedRooms(scene, removed);
  scene.relationships = scene.relationships.filter((relationship) => !removed.has(relationship.from) && !removed.has(relationship.to));
}

/** Drops partitions naming a removed room/storey, and doors on dropped partitions. Unrelated datums keep identity. */
export function pruneV3InteriorForRemovedRooms(scene: V3Scene, removedIds: ReadonlySet<string>): void {
  const interior = scene.interior;
  if (!interior?.partitions && !interior?.doors) return;
  if (interior.partitions) {
    const kept = interior.partitions.filter((partition) => !removedIds.has(partition.storeyId) && !removedIds.has(partition.roomAId) && !(partition.roomBId && removedIds.has(partition.roomBId)));
    const dropped = new Set(interior.partitions.filter((partition) => !kept.includes(partition)).map((partition) => partition.id));
    interior.partitions = kept;
    if (interior.doors) interior.doors = interior.doors.filter((door) => !dropped.has(door.partitionId));
  }
}
