import type { V3Door, V3Partition, V3Room, V3Storey } from "../interior";
import type { V3Relationship, V3Scene } from "../scene";
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from "../generation";

/** Offline fixture: one 3-storey mass (16 × 12 m, 10.2 m tall) with 11 rooms, plus roof, pool, terrace, landscape and path. */
const object = (id: string, type: string, x: number, z: number, baseElevation: number, width: number, depth: number, height: number, extra = {}) => ({ id, type, semanticRole: id, label: id, architecture: { x, z, baseElevation, width, depth, height }, material: { id: `${id}-material`, color: "#d8d2c4", surface: "stucco" }, ...extra });

export const INTERIOR_EXTERIOR_RAW = {
  version: 3, site: { width: 120, depth: 120, baseElevation: 0 }, relationships: [],
  objects: [
    object("house", "building-mass", 0, 0, 0, 16, 12, 10.2, { levels: 3, facadePreset: "punched" }),
    object("house-roof", "roof-form", 0, 0, 10.2, 16, 12, .5, { hostId: "house", roofForm: "hip", pitch: 22 }),
    object("terrace", "terrace", 0, 10, 0, 18, 6, .24),
    object("pool", "pool", 0, 20, -1.4, 10, 4, 1.4),
    object("garden", "landscape-zone", -22, 6, 0, 10, 20, .18),
    object("entry-path", "path", 0, -18, 0, 2, 20, .12),
  ],
};

const storey = (id: string, index: number, label: string): V3Storey => ({ id, hostMassId: "house", index, elevation: index * 3.4, height: 3.4, label, semanticRole: `${label.toLowerCase()} storey` });
const room = (id: string, storeyId: string, program: string, x: number, z: number, width: number, depth: number): V3Room => ({ id, storeyId, hostMassId: "house", program, footprint: { x, z, width, depth }, label: id.replace(/-/g, " "), semanticRole: program });

export const INTERIOR_STOREYS: V3Storey[] = [storey("house-ground", 0, "Ground"), storey("house-first", 1, "First"), storey("house-second", 2, "Second")];
export const INTERIOR_ROOMS: V3Room[] = [
  room("living", "house-ground", "living", -3, -2, 10, 8),
  room("kitchen", "house-ground", "kitchen", 5, -2, 6, 8),
  room("entry-hall", "house-ground", "entry", -4, 4, 8, 4),
  room("utility", "house-ground", "utility", 2.5, 4, 5, 4),
  room("powder", "house-ground", "bathroom", 6.5, 4, 3, 4),
  room("primary-bedroom", "house-first", "bedroom", -3.5, -2, 9, 8),
  room("primary-bath", "house-first", "bathroom", 4.5, -2, 7, 8),
  room("first-hall", "house-first", "hall", 0, 4, 16, 4),
  room("bedroom-two", "house-second", "bedroom", -4, -2, 8, 8),
  room("bedroom-three", "house-second", "bedroom", 4, -2, 8, 8),
  room("study-landing", "house-second", "study", 0, 4, 16, 4),
];
const adjacent = (from: string, to: string): V3Relationship => ({ from, to, kind: "adjacent" });
export const INTERIOR_RELATIONSHIPS: V3Relationship[] = [
  adjacent("living", "kitchen"), adjacent("living", "entry-hall"), adjacent("kitchen", "utility"), adjacent("entry-hall", "utility"), adjacent("utility", "powder"), adjacent("kitchen", "powder"),
  adjacent("primary-bedroom", "primary-bath"), adjacent("primary-bedroom", "first-hall"), adjacent("primary-bath", "first-hall"),
  adjacent("bedroom-two", "bedroom-three"), adjacent("bedroom-two", "study-landing"), adjacent("bedroom-three", "study-landing"),
  // Vertical circulation reuses the existing `connects` kind between halls.
  { from: "entry-hall", to: "first-hall", kind: "connects" }, { from: "first-hall", to: "study-landing", kind: "connects" },
];

/** The exterior-only scene, exactly as an older V3 save would hold it. */
export function exteriorOnlyScene(): V3Scene {
  return repairV3GeneratedScene(normalizeV3GenerationOutput(structuredClone(INTERIOR_EXTERIOR_RAW)).scene, [], { reportDerivedSupport: false }).scene;
}

/** Same exterior, plus authored storeys, rooms and room relationships. */
export function interiorScene(): V3Scene {
  const scene = exteriorOnlyScene();
  return { ...scene, interior: { storeys: structuredClone(INTERIOR_STOREYS), rooms: structuredClone(INTERIOR_ROOMS) }, relationships: [...scene.relationships, ...structuredClone(INTERIOR_RELATIONSHIPS)] };
}

export const INTERIOR_PARTITIONS: V3Partition[] = [
  { id: "living-kitchen-wall", storeyId: "house-ground", roomAId: "living", roomBId: "kitchen", boundaryId: "boundary:kitchen|living", partitionType: "wall", semanticRole: "living kitchen partition" },
  { id: "living-entry-wall", storeyId: "house-ground", roomAId: "entry-hall", roomBId: "living", boundaryId: "boundary:entry-hall|living", partitionType: "open", semanticRole: "entry living partition" },
  { id: "utility-powder-wall", storeyId: "house-ground", roomAId: "utility", roomBId: "powder", boundaryId: "boundary:powder|utility", partitionType: "wall", semanticRole: "utility powder partition" },
  { id: "living-west-facade", storeyId: "house-ground", roomAId: "living", roomBId: null, boundaryId: "boundary:living|exterior:x-", partitionType: "exterior-wall", semanticRole: "living facade" },
  { id: "bed-bath-wall", storeyId: "house-first", roomAId: "primary-bedroom", roomBId: "primary-bath", boundaryId: "boundary:primary-bath|primary-bedroom", partitionType: "wall", semanticRole: "ensuite partition" },
];
export const INTERIOR_DOORS: V3Door[] = [
  { id: "kitchen-door", partitionId: "living-kitchen-wall", offset: 4, width: .9, program: "door", semanticRole: "kitchen door" },
  { id: "living-arch", partitionId: "living-entry-wall", offset: 3, width: 2.4, program: "archway", semanticRole: "living archway" },
  { id: "powder-door", partitionId: "utility-powder-wall", offset: 2, width: .8, program: "door", semanticRole: "powder door" },
  { id: "ensuite-door", partitionId: "bed-bath-wall", offset: 5, width: .9, program: "pocket-door", semanticRole: "ensuite door" },
];

/** Interior scene plus authored partitions and door openings. */
export function partitionedScene(): V3Scene {
  const scene = interiorScene();
  return { ...scene, interior: { ...scene.interior!, partitions: structuredClone(INTERIOR_PARTITIONS), doors: structuredClone(INTERIOR_DOORS) } };
}

/**
 * Wall-construction fixture: the partitioned scene plus first-storey hallway walls.
 *  - bed-bath-wall        bedroom/bathroom wall, one door (ensuite)
 *  - living-kitchen-wall  kitchen/living wall, one door
 *  - bedroom-hall-wall    hallway wall, two doors
 *  - bath-hall-wall       hallway wall, no doors
 *  - living-entry-wall    open partition (with an archway, which cuts nothing)
 */
export const WALL_PARTITIONS: V3Partition[] = [
  { id: "bedroom-hall-wall", storeyId: "house-first", roomAId: "first-hall", roomBId: "primary-bedroom", boundaryId: "boundary:first-hall|primary-bedroom", partitionType: "wall", semanticRole: "bedroom hallway wall" },
  { id: "bath-hall-wall", storeyId: "house-first", roomAId: "first-hall", roomBId: "primary-bath", boundaryId: "boundary:first-hall|primary-bath", partitionType: "wall", semanticRole: "bathroom hallway wall" },
];
export const WALL_DOORS: V3Door[] = [
  { id: "bedroom-door", partitionId: "bedroom-hall-wall", offset: 2, width: .9, program: "door", semanticRole: "bedroom door" },
  { id: "wardrobe-door", partitionId: "bedroom-hall-wall", offset: 6, width: 1.6, program: "double-door", semanticRole: "wardrobe hall door" },
];

export function wallScene(): V3Scene {
  const scene = partitionedScene();
  return { ...scene, interior: { ...scene.interior!, partitions: [...scene.interior!.partitions!, ...structuredClone(WALL_PARTITIONS)], doors: [...scene.interior!.doors!, ...structuredClone(WALL_DOORS)] } };
}
