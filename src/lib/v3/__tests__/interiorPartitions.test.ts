import { describe, expect, it } from "vitest";
import { compileV3Scene, type V3Scene } from "../scene";
import { validateV3Scene } from "../validation";
import { executeV3SceneOperations } from "../operations";
import { auditV3Interior, deriveV3RoomBoundaries, resolveV3PartitionBoundary, v3BoundariesOfRoom, v3ExteriorBoundaryId, v3SharedBoundaryId } from "../interior";
import { v3DependencyGraph, v3Dependents } from "../capabilities";
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from "../generation";
import { regressionLadder } from "./regressionLadder";
import { isV3InteriorWallPrimitive } from "../interiorWalls";
import { exteriorOnlyScene, interiorScene, partitionedScene } from "./interiorFixture";

const EXTERIOR_IDS = ["house", "house-roof", "pool", "terrace", "garden", "entry-path"];
const run = (scene: V3Scene, operations: unknown[]) => executeV3SceneOperations(scene, { intent: "interior edit", operations });
const byId = <T extends { id: string }>(list: T[] | undefined) => new Map((list ?? []).map((item) => [item.id, item]));
const issueCodes = (scene: V3Scene, id: string) => auditV3Interior(scene).filter((issue) => issue.targetId === id).map((issue) => issue.code);
/** Compiled output minus derived interior walls: everything a partition/door/room edit must never touch. */
const exteriorPrimitives = (scene: V3Scene) => compileV3Scene(scene).primitives.filter((primitive) => !isV3InteriorWallPrimitive(primitive));
function expectExteriorUnchanged(after: V3Scene, before: V3Scene) {
  expect(after.objects).toEqual(before.objects);
  expect(after.siteHierarchy).toEqual(before.siteHierarchy);
  expect(after.site).toEqual(before.site);
  expect(exteriorPrimitives(after)).toEqual(exteriorPrimitives(before));
  for (const id of EXTERIOR_IDS) expect(after.objects.find((object) => object.id === id), id).toEqual(before.objects.find((object) => object.id === id));
}
/** Ids whose value differs between two lists keyed by id (added, removed or edited). */
const changedIds = <T extends { id: string }>(a: T[] | undefined, b: T[] | undefined) => {
  const left = byId(a), right = byId(b);
  return [...new Set([...left.keys(), ...right.keys()])].filter((id) => JSON.stringify(left.get(id)) !== JSON.stringify(right.get(id))).sort();
};

describe("V3 derived room boundaries", () => {
  it("derives one shared boundary per adjacent same-storey pair, with stable role-based ids and segments", () => {
    const boundaries = deriveV3RoomBoundaries(interiorScene()), shared = boundaries.filter((boundary) => boundary.role === "shared");
    expect(shared.map((boundary) => boundary.id)).toEqual([
      "boundary:bedroom-three|bedroom-two", "boundary:bedroom-three|study-landing", "boundary:bedroom-two|study-landing",
      "boundary:entry-hall|living", "boundary:entry-hall|utility", "boundary:first-hall|primary-bath", "boundary:first-hall|primary-bedroom",
      "boundary:kitchen|living", "boundary:kitchen|powder", "boundary:kitchen|utility", "boundary:powder|utility", "boundary:primary-bath|primary-bedroom",
    ]);
    // `connects` (vertical circulation between storeys) never forms a boundary.
    expect(boundaries.some((boundary) => boundary.id.includes("first-hall") && boundary.id.includes("entry-hall"))).toBe(false);
    expect(boundaries.find((boundary) => boundary.id === "boundary:kitchen|living")).toMatchObject({ roomAId: "kitchen", roomBId: "living", storeyId: "house-ground", axis: "x", at: 2, from: -6, to: 2, length: 8 });
    expect(boundaries.find((boundary) => boundary.id === v3ExteriorBoundaryId("living", "x-"))).toMatchObject({ role: "exterior", roomBId: null, axis: "x", at: -8, from: -6, to: 2, length: 8 });
    expect(v3SharedBoundaryId("living", "kitchen")).toBe(v3SharedBoundaryId("kitchen", "living"));
    expect(deriveV3RoomBoundaries(interiorScene())).toEqual(boundaries);
  });

  it("uses the existing adjacency minimum and ignores undeclared or cross-storey contact", () => {
    const scene = interiorScene();
    // living/powder never touch; declare it anyway → no boundary.
    const declared = { ...scene, relationships: [...scene.relationships, { from: "living", to: "powder", kind: "adjacent" as const }] };
    expect(deriveV3RoomBoundaries(declared)).toEqual(deriveV3RoomBoundaries(scene));
    // Utility slides west until it touches kitchen over only 0.2 m (< 0.3 m minimum, same rule as adjacency audit).
    const thin = run(scene, [{ op: "editRoom", target: "utility", room: { footprint: { x: -.3, z: 4, width: 5, depth: 4 } } }]).scene;
    expect(deriveV3RoomBoundaries(thin).some((boundary) => boundary.id === "boundary:kitchen|utility")).toBe(false);
    expect(auditV3Interior(thin).some((issue) => issue.code === "ROOM_ADJACENCY_NO_SHARED_BOUNDARY" && issue.targetId === "kitchen->utility")).toBe(true);
  });

  it("adding or removing a room never renames, reorders or reshapes unrelated boundaries", () => {
    const scene = interiorScene(), before = byId(deriveV3RoomBoundaries(scene));
    const added = run(scene, [
      { op: "setRoom", room: { id: "pantry", storeyId: "house-ground", hostMassId: "house", program: "storage", footprint: { x: 7, z: 4, width: 2, depth: 4 }, label: "Pantry", semanticRole: "storage" } },
      { op: "editRoom", target: "powder", room: { footprint: { x: 5, z: 4, width: 2, depth: 4 } } },
    ]);
    expect(added.ok, added.errors.join("; ")).toBe(true);
    const removed = run(scene, [{ op: "removeRoom", target: "powder" }]);
    for (const edit of [added.scene, removed.scene]) {
      const after = byId(deriveV3RoomBoundaries(edit));
      for (const [id, boundary] of before) if (!id.includes("powder")) expect(after.get(id), id).toEqual(boundary);
    }
    expect([...byId(deriveV3RoomBoundaries(removed.scene)).keys()].some((id) => id.includes("powder"))).toBe(false);
  });

  it("boundaries are derived, never persisted", () => {
    const scene = partitionedScene(), edited = run(scene, [{ op: "setDoor", door: { ...scene.interior!.doors![0], offset: 3 } }]).scene;
    const text = JSON.stringify(edited);
    expect(text.includes('"role":"shared"')).toBe(false);
    expect(Object.keys(edited.interior!).sort()).toEqual(["doors", "partitions", "rooms", "storeys"]);
  });
});

describe("V3 semantic partitions and doors", () => {
  it("fixture partitions and doors validate cleanly and resolve to their boundaries", () => {
    const scene = partitionedScene();
    expect(auditV3Interior(scene)).toEqual([]);
    expect(validateV3Scene(scene, { lenient: true }).ok).toBe(true);
    expect(validateV3Scene(scene).ok).toBe(true);
    for (const partition of scene.interior!.partitions!) expect(resolveV3PartitionBoundary(scene, partition.id)?.id, partition.id).toBe(partition.boundaryId);
  });

  it("partitions add only derived interior walls; exterior compile output is unchanged", () => {
    const exterior = exteriorOnlyScene(), rooms = interiorScene(), partitioned = partitionedScene();
    // Storeys/rooms alone still compile nothing.
    expect(compileV3Scene(rooms)).toEqual(compileV3Scene(exterior));
    const compiled = compileV3Scene(partitioned).primitives, exteriorCount = compileV3Scene(exterior).primitives.length;
    // Exterior primitives are an unchanged prefix; interior walls are appended after them.
    expect(compiled.slice(0, exteriorCount)).toEqual(compileV3Scene(exterior).primitives);
    expect(compiled.slice(exteriorCount).every(isV3InteriorWallPrimitive)).toBe(true);
    expect(compiled.slice(0, exteriorCount).some(isV3InteriorWallPrimitive)).toBe(false);
    // Derived pieces are owned by partitions/doors; boundaries and rooms never become render identities.
    const owners = new Set(compiled.slice(exteriorCount).map((primitive) => primitive.sourceObjectId));
    const semantic = new Set([...partitioned.interior!.partitions!, ...partitioned.interior!.doors!].map((datum) => datum.id));
    for (const owner of owners) expect(semantic.has(owner!), owner).toBe(true);
    expect(JSON.stringify(compiled).includes("boundary:")).toBe(false);
  });

  it("broken references are fatal on save", () => {
    const scene = partitionedScene();
    const cases: Array<[string, (s: V3Scene) => void]> = [
      ["PARTITION_MISSING_STOREY", (s) => { s.interior!.partitions![0].storeyId = "nope"; }],
      ["PARTITION_MISSING_ROOM", (s) => { s.interior!.partitions![0].roomBId = "nope"; }],
      ["PARTITION_STOREY_MISMATCH", (s) => { s.interior!.partitions![0].storeyId = "house-first"; }],
      ["PARTITION_BOUNDARY_MISMATCH", (s) => { s.interior!.partitions![0].boundaryId = "boundary:entry-hall|living"; }],
      ["PARTITION_BOUNDARY_MISMATCH", (s) => { s.interior!.partitions![3].boundaryId = "boundary:living|exterior:north"; }],
      ["DUPLICATE_PARTITION_BOUNDARY", (s) => { s.interior!.partitions!.push({ ...s.interior!.partitions![0], id: "second-kitchen-wall" }); }],
      ["DUPLICATE_SEMANTIC_ID", (s) => { s.interior!.partitions![0].id = "pool"; }],
      ["DOOR_MISSING_PARTITION", (s) => { s.interior!.doors![0].partitionId = "nope"; }],
      ["INVALID_DOOR", (s) => { s.interior!.doors![0].width = -1; }],
    ];
    for (const [code, mutate] of cases) {
      const broken = structuredClone(scene); mutate(broken);
      const lenient = validateV3Scene(broken, { lenient: true });
      expect(lenient.ok, code).toBe(false);
      expect(lenient.issues.some((issue) => issue.code === code && issue.severity === "fatal"), code).toBe(true);
    }
  });

  it("rooms that must share the boundary and doors that must fit are enforced when authored", () => {
    const scene = partitionedScene();
    // living/powder are not adjacent: correct boundary id, but no such boundary exists.
    const apart = run(scene, [{ op: "setPartition", partition: { id: "living-powder-wall", storeyId: "house-ground", roomAId: "living", roomBId: "powder", boundaryId: "boundary:living|powder", partitionType: "wall", semanticRole: "x" } }]);
    expect(apart.ok).toBe(false);
    expect(apart.errors.join()).toMatch(/PARTITION_BOUNDARY_UNRESOLVED/);
    expect(apart.scene).toEqual(scene);
    const tooWide = run(scene, [{ op: "setDoor", door: { id: "wide-door", partitionId: "utility-powder-wall", offset: 2, width: 5, program: "door", semanticRole: "x" } }]);
    expect(tooWide.ok).toBe(false);
    expect(tooWide.errors.join()).toMatch(/DOOR_OUTSIDE_BOUNDARY/);
    const offEnd = run(scene, [{ op: "setDoor", door: { ...scene.interior!.doors![0], offset: 7.8 } }]);
    expect(offEnd.ok).toBe(false);
    const unknownField = run(scene, [{ op: "setDoor", door: { ...scene.interior!.doors![0], height: 2.1 } }]);
    expect(unknownField.ok).toBe(false);
  });

  it("registers partition → storey + rooms and door → partition dependencies", () => {
    const scene = partitionedScene(), graph = v3DependencyGraph(scene);
    expect(graph.get("living-kitchen-wall")).toEqual(["house-ground", "living", "kitchen"]);
    expect(graph.get("living-west-facade")).toEqual(["house-ground", "living"]);
    expect(graph.get("kitchen-door")).toEqual(["living-kitchen-wall"]);
    expect([...v3Dependents(scene, "kitchen")].sort()).toEqual(["kitchen-door", "living-kitchen-wall"]);
    expect([...v3Dependents(scene, "living")].sort()).toEqual(["kitchen-door", "living-arch", "living-entry-wall", "living-kitchen-wall", "living-west-facade"]);
    expect([...v3Dependents(scene, "living-kitchen-wall")]).toEqual(["kitchen-door"]);
    expect(v3Dependents(scene, "kitchen-door")).toEqual(new Set());
    // The host mass reads its roof, so only true exterior leaves are checked here.
    for (const id of ["pool", "terrace", "garden", "entry-path"]) expect(v3Dependents(scene, id).has("kitchen-door"), id).toBe(false);
  });

  it("ids survive JSON save/reload, repair, unrelated edits and recompile", () => {
    const scene = partitionedScene();
    // Persistence stores the raw scene JSON (validated on commit); the generation normalizer is provider-only.
    const reloaded = repairV3GeneratedScene(JSON.parse(JSON.stringify(scene)), [], { reportDerivedSupport: false }).scene;
    expect(reloaded.interior).toEqual(scene.interior);
    const edited = run(reloaded, [{ op: "changeMaterial", target: "pool", material: { id: "blue", color: "#2266aa" } }, { op: "setDoor", door: { ...scene.interior!.doors![0], offset: 3 } }]);
    expect(edited.ok, edited.errors.join("; ")).toBe(true);
    expect(edited.scene.interior!.partitions).toEqual(scene.interior!.partitions);
    expect(edited.scene.interior!.doors!.map((door) => door.id)).toEqual(scene.interior!.doors!.map((door) => door.id));
    compileV3Scene(edited.scene);
    expect(validateV3Scene(edited.scene, { lenient: true }).ok).toBe(true);
  });
});

describe("V3 interior locality", () => {
  it("add / move / remove a door leaves exterior, rooms and other partitions untouched", () => {
    const scene = partitionedScene();
    const edits = [
      run(scene, [{ op: "setDoor", door: { id: "facade-door", partitionId: "living-west-facade", offset: 4, width: 1.2, program: "door", semanticRole: "garden door" } }]),
      run(scene, [{ op: "setDoor", door: { ...scene.interior!.doors![0], offset: 6.5 } }]),
      run(scene, [{ op: "removeDoor", target: "powder-door" }]),
    ];
    const expected = [["facade-door"], ["kitchen-door"], ["powder-door"]];
    edits.forEach((edit, index) => {
      expect(edit.ok, edit.errors.join("; ")).toBe(true);
      expectExteriorUnchanged(edit.scene, scene);
      expect(edit.scene.interior!.storeys).toEqual(scene.interior!.storeys);
      expect(edit.scene.interior!.rooms).toEqual(scene.interior!.rooms);
      expect(edit.scene.interior!.partitions).toEqual(scene.interior!.partitions);
      expect(edit.scene.relationships).toEqual(scene.relationships);
      expect(changedIds(scene.interior!.doors, edit.scene.interior!.doors)).toEqual(expected[index]);
    });
  });

  it("changing or removing one partition leaves unrelated rooms and partitions unchanged", () => {
    const scene = partitionedScene();
    const retyped = run(scene, [{ op: "setPartition", partition: { ...scene.interior!.partitions![2], partitionType: "glazed" } }]);
    expect(retyped.ok, retyped.errors.join("; ")).toBe(true);
    expect(changedIds(scene.interior!.partitions, retyped.scene.interior!.partitions)).toEqual(["utility-powder-wall"]);
    expect(retyped.scene.interior!.doors).toEqual(scene.interior!.doors);
    const removed = run(scene, [{ op: "removePartition", target: "utility-powder-wall" }]);
    expect(removed.ok, removed.errors.join("; ")).toBe(true);
    expect(changedIds(scene.interior!.partitions, removed.scene.interior!.partitions)).toEqual(["utility-powder-wall"]);
    expect(changedIds(scene.interior!.doors, removed.scene.interior!.doors)).toEqual(["powder-door"]);
    for (const edit of [retyped, removed]) {
      expectExteriorUnchanged(edit.scene, scene);
      expect(edit.scene.interior!.rooms).toEqual(scene.interior!.rooms);
      expect(deriveV3RoomBoundaries(edit.scene)).toEqual(deriveV3RoomBoundaries(scene));
    }
  });

  it("resizing one room affects only boundaries/partitions touching it, and invalidations are reported, not rewritten", () => {
    const scene = partitionedScene(), boundariesBefore = deriveV3RoomBoundaries(scene);
    // Kitchen shrinks to 4 m wide: it pulls away from living (x = 2 → 4), so that boundary disappears.
    const resized = run(scene, [{ op: "editRoom", target: "kitchen", room: { footprint: { x: 6, z: -2, width: 4, depth: 8 } } }]);
    expect(resized.ok, resized.errors.join("; ")).toBe(true);
    const after = resized.scene, boundariesAfter = deriveV3RoomBoundaries(after);
    const changed = changedIds(boundariesBefore, boundariesAfter);
    expect(changed.length).toBeGreaterThan(0);
    for (const id of changed) expect(id.includes("kitchen"), id).toBe(true);
    expect(changed).toEqual(changedIds(v3BoundariesOfRoom(scene, "kitchen"), v3BoundariesOfRoom(after, "kitchen")));
    // Authored partitions/doors are never rewritten by a room edit.
    expect(after.interior!.partitions).toEqual(scene.interior!.partitions);
    expect(after.interior!.doors).toEqual(scene.interior!.doors);
    // Only dependents of the kitchen are flagged.
    const flagged = new Set(auditV3Interior(after).filter((issue) => issue.severity !== "advisory").map((issue) => issue.targetId));
    expect([...flagged].sort()).toEqual(["kitchen-door", "living-kitchen-wall"]);
    for (const id of flagged) expect(v3Dependents(scene, "kitchen").has(id), id).toBe(true);
    expect(issueCodes(after, "living-kitchen-wall")).toEqual(["PARTITION_BOUNDARY_UNRESOLVED"]);
    expect(issueCodes(after, "kitchen-door")).toEqual(["DOOR_BOUNDARY_UNRESOLVED"]);
    expect(validateV3Scene(after, { lenient: true }).ok).toBe(true);
    expect(validateV3Scene(after).ok).toBe(false);
    expectExteriorUnchanged(after, scene);
  });

  it("shortening a boundary flags only doors that no longer fit", () => {
    const scene = partitionedScene();
    // Living keeps touching kitchen at x = 2 but over z ∈ [-6, -1]: 5 m. kitchen-door centre at 4 m still fits; widen it to test.
    const shortened = run(scene, [{ op: "editRoom", target: "kitchen", room: { footprint: { x: 5, z: -3.5, width: 6, depth: 5 } } }]).scene;
    expect(resolveV3PartitionBoundary(shortened, "living-kitchen-wall")?.length).toBeCloseTo(5);
    expect(issueCodes(shortened, "kitchen-door")).toEqual([]);
    const tight = run(scene, [{ op: "editRoom", target: "kitchen", room: { footprint: { x: 5, z: -4.5, width: 6, depth: 3 } } }]).scene;
    expect(issueCodes(tight, "kitchen-door")).toEqual(["DOOR_OUTSIDE_BOUNDARY"]);
    expect(issueCodes(tight, "living-kitchen-wall")).toEqual([]);
  });

  it("removing a room cascades only its own partitions and their doors; deleting the host clears all", () => {
    const scene = partitionedScene();
    const removed = run(scene, [{ op: "removeRoom", target: "powder" }]);
    expect(removed.ok, removed.errors.join("; ")).toBe(true);
    expect(changedIds(scene.interior!.partitions, removed.scene.interior!.partitions)).toEqual(["utility-powder-wall"]);
    expect(changedIds(scene.interior!.doors, removed.scene.interior!.doors)).toEqual(["powder-door"]);
    expectExteriorUnchanged(removed.scene, scene);
    const deleted = run(scene, [{ op: "delete", target: "house" }]);
    expect(deleted.ok, deleted.errors.join("; ")).toBe(true);
    expect(deleted.scene.interior).toEqual({ storeys: [], rooms: [], partitions: [], doors: [] });
    expect(deleted.scene.objects.find((object) => object.id === "pool")).toEqual(scene.objects.find((object) => object.id === "pool"));
  });
});

describe("V3 interior compatibility", () => {
  it("old scenes never gain partitions or doors; storey/room scenes keep their exact shape", () => {
    for (const { name, raw } of regressionLadder) {
      const scene = repairV3GeneratedScene(normalizeV3GenerationOutput(structuredClone(raw)).scene).scene;
      const edited = run(scene, [{ op: "changeMaterial", target: scene.objects[0].id, material: { id: "white", color: "#ffffff" } }]);
      expect(edited.ok, name).toBe(true);
      expect("interior" in edited.scene, name).toBe(false);
    }
    const rooms = interiorScene();
    const edited = run(rooms, [{ op: "editRoom", target: "kitchen", room: { program: "kitchen-dining" } }]);
    expect(edited.ok).toBe(true);
    expect(Object.keys(edited.scene.interior!).sort()).toEqual(["rooms", "storeys"]);
    expect(auditV3Interior(rooms)).toEqual([]);
  });
});
