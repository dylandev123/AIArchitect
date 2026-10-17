import { describe, expect, it } from "vitest";
import type { BoxPrimitive, HousePrimitive } from "@/lib/house/types";
import { compileV3Scene, type V3Scene } from "../scene";
import { executeV3SceneOperations } from "../operations";
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from "../generation";
import { ingestV3GenerationOutput } from "../ingestion";
import { validateV3Scene } from "../validation";
import { auditV3Interior } from "../interior";
import { compileV3InteriorWalls, deriveV3InteriorWalls, isV3InteriorWallPrimitive, registerV3PartitionType, resolveV3SelectionTarget, V3_INTERIOR_WALL_THICKNESS, v3DoorHeaderId, v3WallSegmentId } from "../interiorWalls";
import { exteriorOnlyScene, INTERIOR_EXTERIOR_RAW, interiorScene, wallScene } from "./interiorFixture";

const run = (scene: V3Scene, operations: unknown[]) => {
  const result = executeV3SceneOperations(scene, { intent: "wall edit", operations });
  expect(result.ok, result.errors.join("; ")).toBe(true);
  return result.scene;
};
const walls = (scene: V3Scene) => compileV3InteriorWalls(scene) as BoxPrimitive[];
const exteriorOf = (scene: V3Scene) => compileV3Scene(scene).primitives.filter((primitive) => !isV3InteriorWallPrimitive(primitive));
const byId = (primitives: HousePrimitive[]) => new Map(primitives.map((primitive) => [primitive.id, primitive]));
const ownedBy = (primitives: HousePrimitive[], partitionId: string) => primitives.filter((primitive) => primitive.sourceObjectIds?.includes(partitionId));
/** Partition ids whose derived wall primitives differ between two scenes. */
function changedPartitions(before: V3Scene, after: V3Scene): string[] {
  const a = walls(before), b = walls(after);
  const ids = new Set([...a, ...b].flatMap((primitive) => primitive.sourceObjectIds!.slice(-1)));
  return [...ids].filter((id) => JSON.stringify(ownedBy(a, id)) !== JSON.stringify(ownedBy(b, id))).sort();
}
/** World point inside a (Y-rotated) box primitive. */
function inside(box: BoxPrimitive, [px, py, pz]: [number, number, number]): boolean {
  const angle = box.rotation[1], dx = px - box.position[0], dz = pz - box.position[2], c = Math.cos(angle), s = Math.sin(angle);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < box.size[0] / 2 && Math.abs(py - box.position[1]) < box.size[1] / 2 && Math.abs(lz) < box.size[2] / 2;
}
const solidAt = (scene: V3Scene, point: [number, number, number]) => walls(scene).filter((box) => inside(box, point)).map((box) => box.id);

describe("V3 derived interior walls: placement and openings", () => {
  it("centres thickness on the boundary, spans storey height, and cuts the door into left/header/right pieces", () => {
    const pieces = byId(walls(wallScene()));
    const left = pieces.get(v3WallSegmentId("living-kitchen-wall", "start", "kitchen-door")) as BoxPrimitive;
    const header = pieces.get(v3DoorHeaderId("living-kitchen-wall", "kitchen-door")) as BoxPrimitive;
    const right = pieces.get(v3WallSegmentId("living-kitchen-wall", "kitchen-door", "end")) as BoxPrimitive;
    // Boundary x = 2, z ∈ [-6, 2]; door centre 4 m from z = -6, 0.9 m wide → gap z ∈ [-2.45, -1.55].
    expect(left.position[0]).toBeCloseTo(2); expect(left.size[0]).toBeCloseTo(V3_INTERIOR_WALL_THICKNESS);
    expect(left.position[2] - left.size[2] / 2).toBeCloseTo(-6); expect(left.position[2] + left.size[2] / 2).toBeCloseTo(-2.45);
    expect(right.position[2] - right.size[2] / 2).toBeCloseTo(-1.55); expect(right.position[2] + right.size[2] / 2).toBeCloseTo(2);
    expect(left.position[1] - left.size[1] / 2).toBeCloseTo(0); expect(left.position[1] + left.size[1] / 2).toBeCloseTo(3.4);
    expect(header.position[1] - header.size[1] / 2).toBeCloseTo(2.1); expect(header.position[1] + header.size[1] / 2).toBeCloseTo(3.4);
    expect(header.size[2]).toBeCloseTo(.9);
    expect(ownedBy([...pieces.values()], "living-kitchen-wall").map((primitive) => primitive.id).sort()).toEqual([left.id, header.id, right.id].sort());
  });

  it("door holes are real: no solid behind the door, solid beside it and above the head", () => {
    const scene = wallScene();
    expect(solidAt(scene, [2, 1, -2])).toEqual([]);
    expect(solidAt(scene, [2, 2.05, -2])).toEqual([]);
    expect(solidAt(scene, [2, 2.6, -2])).toEqual([v3DoorHeaderId("living-kitchen-wall", "kitchen-door")]);
    expect(solidAt(scene, [2, 1, -4])).toEqual([v3WallSegmentId("living-kitchen-wall", "start", "kitchen-door")]);
    expect(solidAt(scene, [2, 1, 0])).toEqual([v3WallSegmentId("living-kitchen-wall", "kitchen-door", "end")]);
    // Ensuite (first storey, x = 1, door centre z = -1): hole sits on the first storey.
    expect(solidAt(scene, [1, 3.4 + 1, -1])).toEqual([]);
    expect(solidAt(scene, [1, 3.4 + 1, -4])).toHaveLength(1);
  });

  it("supports multiple doors on one partition, keyed by door ids", () => {
    const scene = wallScene(), ids = ownedBy(walls(scene), "bedroom-hall-wall").map((primitive) => primitive.id).sort();
    expect(ids).toEqual([
      v3DoorHeaderId("bedroom-hall-wall", "bedroom-door"), v3DoorHeaderId("bedroom-hall-wall", "wardrobe-door"),
      v3WallSegmentId("bedroom-hall-wall", "bedroom-door", "wardrobe-door"), v3WallSegmentId("bedroom-hall-wall", "start", "bedroom-door"), v3WallSegmentId("bedroom-hall-wall", "wardrobe-door", "end"),
    ].sort());
    // Boundary z = 2, x ∈ [-8, 1]; doors at x ∈ [-6.45, -5.55] and [-2.8, -1.2].
    for (const x of [-6, -2]) expect(solidAt(scene, [x, 3.4 + 1, 2]), String(x)).toEqual([]);
    for (const x of [-7.5, -4, .5]) expect(solidAt(scene, [x, 3.4 + 1, 2]), String(x)).toHaveLength(1);
    // The door-less hallway wall is one full run.
    expect(ownedBy(walls(scene), "bath-hall-wall").map((primitive) => primitive.id)).toEqual([v3WallSegmentId("bath-hall-wall", "start", "end")]);
  });

  it("overlapping or out-of-range doors still produce one clean gap", () => {
    const scene = run(wallScene(), [{ op: "setDoor", door: { id: "kitchen-door-two", partitionId: "living-kitchen-wall", offset: 4.5, width: .9, program: "opening", semanticRole: "x" } }]);
    const pieces = ownedBy(walls(scene), "living-kitchen-wall");
    expect(pieces.map((primitive) => primitive.id).sort()).toEqual([
      v3DoorHeaderId("living-kitchen-wall", "kitchen-door"), v3DoorHeaderId("living-kitchen-wall", "kitchen-door-two"),
      v3WallSegmentId("living-kitchen-wall", "kitchen-door-two", "end"), v3WallSegmentId("living-kitchen-wall", "start", "kitchen-door"),
    ].sort());
    expect(solidAt(scene, [2, 1, -1.5])).toEqual([]);
    for (const box of pieces as BoxPrimitive[]) expect(box.size.every((value) => value > 0)).toBe(true);
  });
});

describe("V3 partition type behaviour", () => {
  const retype = (partitionType: string, extra = {}) => {
    const scene = wallScene(), partition = scene.interior!.partitions!.find((candidate) => candidate.id === "bath-hall-wall")!;
    return run(scene, [{ op: "setPartition", partition: { ...partition, partitionType, ...extra } }]);
  };
  it("wall → solid, open → nothing, exterior-wall → nothing (the facade owns it)", () => {
    const scene = wallScene(), compiled = walls(scene);
    expect(ownedBy(compiled, "living-entry-wall")).toEqual([]);
    expect(ownedBy(compiled, "living-west-facade")).toEqual([]);
    expect(ownedBy(compiled, "bath-hall-wall").every((primitive) => primitive.componentRole === "interior wall")).toBe(true);
    expect(solidAt(scene, [-4, 1, 2])).toEqual([]);
  });
  it("glazed → transparent glazed partition with door cuts intact", () => {
    const [glass] = ownedBy(walls(retype("glazed")), "bath-hall-wall") as BoxPrimitive[];
    expect(glass).toMatchObject({ componentRole: "glazed partition", transparent: true, surface: "glass" });
    expect(glass.size[2]).toBeLessThan(V3_INTERIOR_WALL_THICKNESS);
  });
  it("screen → thin divider capped below the ceiling", () => {
    const [screen] = ownedBy(walls(retype("screen")), "bath-hall-wall") as BoxPrimitive[];
    expect(screen.componentRole).toBe("screen partition");
    expect(screen.position[1] + screen.size[1] / 2).toBeCloseTo(3.4 + 2.1);
  });
  it("unknown types fall back to a solid wall; registered types are honoured without a noun switch", () => {
    const scene = retype("rammed-earth-feature");
    const wall = deriveV3InteriorWalls(scene).find((candidate) => candidate.partitionId === "bath-hall-wall")!;
    expect(wall).toMatchObject({ knownType: false, construction: "solid" });
    expect(validateV3Scene(scene, { lenient: true }).ok).toBe(true);
    const undo = registerV3PartitionType("rammed-earth-feature", { construction: "solid", thickness: .4, blocksMovement: true });
    try { expect(deriveV3InteriorWalls(scene).find((candidate) => candidate.partitionId === "bath-hall-wall")!.thickness).toBe(.4); } finally { undo(); }
  });
  it("authored thickness overrides the type default and is validated", () => {
    const [thick] = ownedBy(walls(retype("wall", { thickness: .25 })), "bath-hall-wall") as BoxPrimitive[];
    expect(thick.size[2]).toBeCloseTo(.25);
    const bad = executeV3SceneOperations(wallScene(), { intent: "x", operations: [{ op: "setPartition", partition: { ...wallScene().interior!.partitions![0], thickness: 3 } }] });
    expect(bad.ok).toBe(false);
    const raw = wallScene(); raw.interior!.partitions![0].thickness = -1;
    expect(auditV3Interior(raw).some((issue) => issue.code === "INVALID_PARTITION" && issue.severity === "fatal")).toBe(true);
  });
});

describe("V3 interior walls follow their host and storey", () => {
  it("world elevation follows the storey and the host mass base", () => {
    const scene = wallScene(), raised = run(scene, [{ op: "editArchitecture", target: "house", architecture: { baseElevation: 1.5 } }]);
    const before = byId(walls(scene)), after = walls(raised);
    expect(after.length).toBe(before.size);
    for (const box of after) {
      const original = before.get(box.id) as BoxPrimitive;
      expect(box.position[1]).toBeCloseTo(original.position[1] + 1.5);
      expect(box.position[0]).toBeCloseTo(original.position[0]); expect(box.position[2]).toBeCloseTo(original.position[2]);
    }
    const first = ownedBy(walls(scene), "bedroom-hall-wall") as BoxPrimitive[];
    expect(Math.min(...first.map((box) => box.position[1] - box.size[1] / 2))).toBeCloseTo(3.4);
  });
  it("host rotation carries walls and their holes", () => {
    const angle = Math.PI / 6, rotated = run(wallScene(), [{ op: "editArchitecture", target: "house", architecture: { rotationY: angle } }]);
    const toWorld = (lx: number, lz: number): [number, number] => [lx * Math.cos(angle) + lz * Math.sin(angle), -lx * Math.sin(angle) + lz * Math.cos(angle)];
    for (const box of walls(rotated)) expect(box.rotation).toEqual([0, angle, 0]);
    const [dx, dz] = toWorld(2, -2), [sx, sz] = toWorld(2, -4);
    expect(solidAt(rotated, [dx, 1, dz])).toEqual([]);
    expect(solidAt(rotated, [sx, 1, sz])).toEqual([v3WallSegmentId("living-kitchen-wall", "start", "kitchen-door")]);
  });
});

describe("V3 interior wall locality and stable ids", () => {
  it("moving or resizing one door changes only its partition's geometry", () => {
    const scene = wallScene(), door = scene.interior!.doors!.find((candidate) => candidate.id === "kitchen-door")!;
    for (const edited of [run(scene, [{ op: "setDoor", door: { ...door, offset: 5.5 } }]), run(scene, [{ op: "setDoor", door: { ...door, width: 1.4 } }])]) {
      expect(changedPartitions(scene, edited)).toEqual(["living-kitchen-wall"]);
      expect(exteriorOf(edited)).toEqual(exteriorOf(scene));
    }
  });
  it("changing one partition type affects only that partition", () => {
    const scene = wallScene(), partition = scene.interior!.partitions!.find((candidate) => candidate.id === "bed-bath-wall")!;
    const edited = run(scene, [{ op: "setPartition", partition: { ...partition, partitionType: "glazed" } }]);
    expect(changedPartitions(scene, edited)).toEqual(["bed-bath-wall"]);
    expect(exteriorOf(edited)).toEqual(exteriorOf(scene));
  });
  it("room edits only affect partitions touching that room", () => {
    const scene = wallScene();
    // Kitchen shrinks to z ∈ [-6, 0], shortening its living boundary to 6 m; living/kitchen is the only kitchen partition.
    const kitchen = run(scene, [{ op: "editRoom", target: "kitchen", room: { footprint: { x: 5, z: -3, width: 6, depth: 6 } } }]);
    expect(solidAt(kitchen, [2, 1, 1])).toEqual([]);
    expect(changedPartitions(scene, kitchen)).toEqual(["living-kitchen-wall"]);
    // The first-storey hall touches both hallway walls; the ground storey and ensuite are untouched.
    const hall = run(scene, [{ op: "editRoom", target: "first-hall", room: { footprint: { x: 0, z: 4, width: 14, depth: 4 } } }]);
    expect(changedPartitions(scene, hall)).toEqual(["bath-hall-wall", "bedroom-hall-wall"]);
    for (const edited of [kitchen, hall]) expect(exteriorOf(edited)).toEqual(exteriorOf(scene));
  });
  it("adding a second door keeps the first door's pieces; removing one keeps the other's", () => {
    const scene = wallScene(), before = byId(walls(scene));
    const added = byId(walls(run(scene, [{ op: "setDoor", door: { id: "larder-door", partitionId: "living-kitchen-wall", offset: 1, width: .8, program: "door", semanticRole: "larder door" } }])));
    for (const id of [v3DoorHeaderId("living-kitchen-wall", "kitchen-door"), v3WallSegmentId("living-kitchen-wall", "kitchen-door", "end")]) expect(added.get(id), id).toEqual(before.get(id));
    expect(added.has(v3WallSegmentId("living-kitchen-wall", "larder-door", "kitchen-door"))).toBe(true);
    const removed = byId(walls(run(scene, [{ op: "removeDoor", target: "bedroom-door" }])));
    for (const id of [v3DoorHeaderId("bedroom-hall-wall", "wardrobe-door"), v3WallSegmentId("bedroom-hall-wall", "wardrobe-door", "end")]) expect(removed.get(id), id).toEqual(before.get(id));
    expect(removed.has(v3DoorHeaderId("bedroom-hall-wall", "bedroom-door"))).toBe(false);
    // Unrelated partitions keep every id and value.
    for (const [id, primitive] of before) if (!id.startsWith("bedroom-hall-wall:") && !id.startsWith("living-kitchen-wall:")) expect(removed.get(id), id).toEqual(primitive);
  });
  it("is independent of authoring order", () => {
    const scene = wallScene(), shuffled = structuredClone(scene);
    shuffled.interior!.doors!.reverse(); shuffled.interior!.partitions!.reverse();
    expect(walls(shuffled)).toEqual(walls(scene));
  });
});

describe("V3 interior wall render authority", () => {
  it("derived pieces carry semantic ownership and resolve selection to their partition or door", () => {
    const scene = wallScene();
    for (const box of walls(scene)) {
      const target = resolveV3SelectionTarget(scene, box.sourceObjectId!);
      expect(target?.kind, box.id).toBe(box.id.includes(":header:") ? "door" : "partition");
      expect(resolveV3SelectionTarget(scene, box.id)).toEqual(target);
      expect(box.semanticRole).toBeTruthy();
    }
  });
  it("derived pieces are never persisted or editable", () => {
    const scene = wallScene(), derivedId = v3WallSegmentId("living-kitchen-wall", "start", "kitchen-door");
    const edited = run(scene, [{ op: "changeMaterial", target: "pool", material: { id: "blue", color: "#2266aa" } }]);
    expect(JSON.stringify(edited).includes(":wall:")).toBe(false);
    expect(edited.objects.some((object) => object.id.includes(":"))).toBe(false);
    for (const op of [{ op: "move", target: derivedId, position: [0, 0, 0] }, { op: "delete", target: derivedId }, { op: "removeDoor", target: v3DoorHeaderId("living-kitchen-wall", "kitchen-door") }]) {
      const attempt = executeV3SceneOperations(scene, { intent: "x", operations: [op] });
      expect(attempt.ok, op.op).toBe(false);
      expect(attempt.scene).toEqual(scene);
    }
  });
  it("save/reload reproduces identical scene and walls", () => {
    const scene = wallScene(), reloaded = JSON.parse(JSON.stringify(scene)) as V3Scene;
    expect(reloaded).toEqual(scene);
    expect(compileV3Scene(reloaded)).toEqual(compileV3Scene(scene));
    expect(validateV3Scene(reloaded).ok).toBe(true);
  });
  it("exterior compile output is unchanged by interior additions", () => {
    const exterior = compileV3Scene(exteriorOnlyScene()).primitives, compiled = compileV3Scene(wallScene()).primitives;
    expect(compiled.slice(0, exterior.length)).toEqual(exterior);
    expect(compiled.length).toBeGreaterThan(exterior.length);
    expect(compiled.slice(exterior.length).every(isV3InteriorWallPrimitive)).toBe(true);
    for (const id of ["house-roof", "pool", "terrace", "garden", "entry-path"]) {
      const owned = (list: HousePrimitive[]) => list.filter((primitive) => primitive.sourceObjectId === id || primitive.id.startsWith(id));
      expect(owned(compiled), id).toEqual(owned(exterior));
    }
  });
});

describe("V3 normalization preserves canonical interior", () => {
  const expectInteriorPreserved = (out: V3Scene, scene: V3Scene) => {
    expect(out.interior).toEqual(scene.interior);
    expect(out.relationships).toEqual(scene.relationships);
    expect(walls(out)).toEqual(walls(scene));
  };
  it("normalize → repair round-trips storeys, rooms, partitions, doors and adjacent/connects relationships", () => {
    const scene = wallScene();
    const normalized = normalizeV3GenerationOutput(JSON.parse(JSON.stringify(scene)));
    expectInteriorPreserved(normalized.scene, scene);
    expectInteriorPreserved(repairV3GeneratedScene(normalized.scene, normalized.notes, { reportDerivedSupport: false }).scene, scene);
    expectInteriorPreserved(repairV3GeneratedScene(JSON.parse(JSON.stringify(scene)), [], { reportDerivedSupport: false }).scene, scene);
    // Normalizing twice is a fixed point.
    expectInteriorPreserved(normalizeV3GenerationOutput(normalizeV3GenerationOutput(JSON.parse(JSON.stringify(scene))).scene).scene, scene);
  });
  it("the full ingestion boundary keeps a canonical interior", () => {
    const scene = wallScene(), ingested = ingestV3GenerationOutput(JSON.parse(JSON.stringify(scene)));
    expect(ingested.ok, ingested.validation.errors.join("; ")).toBe(true);
    expectInteriorPreserved(ingested.scene, scene);
  });
  it("storey/room-only interiors keep their exact shape (no partitions/doors invented)", () => {
    const scene = interiorScene(), out = normalizeV3GenerationOutput(JSON.parse(JSON.stringify(scene))).scene;
    expect(Object.keys(out.interior!).sort()).toEqual(["rooms", "storeys"]);
    expectInteriorPreserved(out, scene);
  });
  it("stays forgiving for provider output: no interior → none; malformed interior → omitted with a note", () => {
    expect("interior" in normalizeV3GenerationOutput(structuredClone(INTERIOR_EXTERIOR_RAW)).scene).toBe(false);
    const malformed = normalizeV3GenerationOutput({ ...structuredClone(INTERIOR_EXTERIOR_RAW), interior: { rooms: "lots" } });
    expect("interior" in malformed.scene).toBe(false);
    expect(malformed.notes.some((note) => note.code === "INTERIOR_OMITTED")).toBe(true);
    const stray = normalizeV3GenerationOutput({ ...JSON.parse(JSON.stringify(wallScene())), interior: { ...wallScene().interior, doors: [...wallScene().interior!.doors!, "junk"] } });
    expect(stray.scene.interior!.doors).toEqual(wallScene().interior!.doors);
    expect(stray.notes.some((note) => note.code === "INTERIOR_ENTRY_DROPPED")).toBe(true);
  });
  it("a no-op edit plan through the executor keeps the interior", () => {
    const scene = wallScene(), edited = run(scene, [{ op: "changeMaterial", target: "terrace", material: { id: "stone", color: "#bbbbbb" } }]);
    expectInteriorPreserved(edited, scene);
  });
});
