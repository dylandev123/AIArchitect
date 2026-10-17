import { describe, expect, it } from "vitest";
import { compileV3Scene, type V3Scene } from "../scene";
import { validateV3Scene } from "../validation";
import { executeV3SceneOperations } from "../operations";
import { auditV3Interior, resolveV3Room, resolveV3Storey, sharedBoundaryLength, v3RoomAdjacency } from "../interior";
import { v3DependencyGraph, v3Dependents } from "../capabilities";
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from "../generation";
import { regressionLadder } from "./regressionLadder";
import { exteriorOnlyScene, interiorScene, INTERIOR_ROOMS } from "./interiorFixture";

const objectPrimitives = (scene: V3Scene, ids: string[]) => compileV3Scene(scene).primitives.filter((primitive) => ids.some((id) => primitive.id.startsWith(id) || (primitive as { sourceObjectIds?: string[] }).sourceObjectIds?.includes(id)));
const interiorIds = (scene: V3Scene) => [...scene.interior!.storeys.map((storey) => storey.id), ...scene.interior!.rooms.map((room) => room.id)];
const editRoom = (scene: V3Scene, target: string, room: Record<string, unknown>) => executeV3SceneOperations(scene, { intent: "edit room", operations: [{ op: "editRoom", target, room }] });

describe("V3 semantic storeys and rooms", () => {
  it("fixture: 3 storeys, 11 rooms, every room on a valid storey of its host mass", () => {
    const scene = interiorScene();
    expect(scene.interior!.storeys).toHaveLength(3);
    expect(scene.interior!.rooms).toHaveLength(11);
    expect(auditV3Interior(scene)).toEqual([]);
    const validation = validateV3Scene(scene, { lenient: true });
    expect(validation.ok).toBe(true);
    expect(validation.issues.filter((issue) => /ROOM|STOREY|RELATIONSHIP|INTERIOR|SEMANTIC/.test(issue.code))).toEqual([]);
    for (const room of scene.interior!.rooms) {
      const storey = scene.interior!.storeys.find((candidate) => candidate.id === room.storeyId);
      expect(storey, room.id).toBeDefined();
      expect(storey!.hostMassId).toBe(room.hostMassId);
      expect(scene.objects.find((object) => object.id === room.hostMassId)?.type).toBe("building-mass");
    }
  });

  it("save/reload is identical and ids/references are stable", () => {
    const scene = interiorScene();
    const reloaded = JSON.parse(JSON.stringify(scene)) as V3Scene;
    expect(reloaded).toEqual(scene);
    expect(JSON.stringify(reloaded)).toBe(JSON.stringify(scene));
    // A reload followed by the normal edit/repair path keeps every datum, id and relationship.
    const repaired = repairV3GeneratedScene(structuredClone(reloaded), [], { reportDerivedSupport: false });
    expect(repaired.notes).toEqual([]);
    expect(repaired.scene).toEqual(scene);
    const edited = editRoom(reloaded, "kitchen", { label: "Kitchen and pantry" });
    expect(edited.ok).toBe(true);
    expect(interiorIds(edited.scene)).toEqual(interiorIds(scene));
    expect(edited.scene.relationships).toEqual(scene.relationships);
  });

  it("storey elevation is the only vertical authority for rooms", () => {
    const scene = interiorScene();
    for (const room of scene.interior!.rooms) expect(Object.keys(room).sort()).toEqual(["footprint", "hostMassId", "id", "label", "program", "semanticRole", "storeyId"]);
    expect(Object.keys(INTERIOR_ROOMS[0].footprint).sort()).toEqual(["depth", "width", "x", "z"]);
    expect(resolveV3Room(scene, "living")).toMatchObject({ floorY: 0, ceilingY: 3.4 });
    expect(resolveV3Room(scene, "primary-bedroom")).toMatchObject({ floorY: 3.4, ceilingY: 6.8 });
    expect(resolveV3Room(scene, "study-landing")!.floorY).toBeCloseTo(6.8);
    // Moving the host mass moves storeys and rooms without any room data changing.
    const raised = executeV3SceneOperations(scene, { intent: "raise house", operations: [{ op: "editArchitecture", target: "house", architecture: { baseElevation: .6, x: 2 } }] });
    expect(raised.ok).toBe(true);
    expect(raised.scene.interior).toEqual(scene.interior);
    expect(resolveV3Storey(raised.scene, "house-first")!.floorY).toBeCloseTo(4);
    expect(resolveV3Room(raised.scene, "living")!.centre).toEqual([-1, -2]);
    // A room cannot be given its own Y.
    expect(executeV3SceneOperations(scene, { intent: "bad", operations: [{ op: "editRoom", target: "living", room: { elevation: 2 } }] }).ok).toBe(false);
    expect(executeV3SceneOperations(scene, { intent: "bad", operations: [{ op: "editRoom", target: "living", room: { footprint: { x: 0, y: 2, z: 0, width: 2, depth: 2 } } }] }).ok).toBe(false);
  });

  it("maps host-local footprints through the host rotation", () => {
    const scene = interiorScene();
    const rotated = executeV3SceneOperations(scene, { intent: "rotate", operations: [{ op: "editArchitecture", target: "house", architecture: { rotationY: Math.PI / 2 } }] });
    expect(rotated.ok).toBe(true);
    const [x, z] = resolveV3Room(rotated.scene, "kitchen")!.centre;
    // local (5, -2) rotated by +90° about Y (compiler convention): world x = lz, world z = -lx.
    expect(x).toBeCloseTo(-2); expect(z).toBeCloseTo(-5);
  });

  it("room adjacency uses the relationship system and shared boundaries", () => {
    const scene = interiorScene();
    const adjacency = v3RoomAdjacency(scene);
    expect([...adjacency.get("utility")!].sort()).toEqual(["entry-hall", "kitchen", "powder"]);
    expect(adjacency.get("first-hall")!.has("entry-hall")).toBe(false); // vertical `connects` is not plan adjacency
    for (const relationship of scene.relationships.filter((candidate) => candidate.kind === "adjacent")) {
      const a = INTERIOR_ROOMS.find((room) => room.id === relationship.from)!, b = INTERIOR_ROOMS.find((room) => room.id === relationship.to)!;
      expect(sharedBoundaryLength(a.footprint, b.footprint), `${a.id}-${b.id}`).toBeGreaterThan(.3);
    }
    const apart = { ...scene, relationships: [...scene.relationships, { from: "living", to: "powder", kind: "adjacent" as const }, { from: "living", to: "primary-bedroom", kind: "adjacent" as const }] };
    expect(auditV3Interior(apart).map((issue) => issue.code)).toEqual(["ROOM_ADJACENCY_NO_SHARED_BOUNDARY", "INVALID_ROOM_ADJACENCY"]);
  });

  it("registers storey → host and room → storey + host dependencies", () => {
    const scene = interiorScene(), graph = v3DependencyGraph(scene);
    expect(graph.get("house-first")).toEqual(["house"]);
    expect(graph.get("kitchen")).toEqual(["house-ground", "house"]);
    expect(v3Dependents(scene, "kitchen")).toEqual(new Set());
    expect([...v3Dependents(scene, "house-ground")].sort()).toEqual(["entry-hall", "kitchen", "living", "powder", "utility"]);
    const fromHouse = v3Dependents(scene, "house");
    for (const id of interiorIds(scene)) expect(fromHouse.has(id), id).toBe(true);
    for (const id of ["pool", "terrace", "garden", "entry-path"]) expect(fromHouse.has(id), id).toBe(false);
  });

  it("exterior compiles exactly as before; storeys and rooms never render", () => {
    const exterior = exteriorOnlyScene(), withInterior = interiorScene();
    const before = compileV3Scene(exterior), after = compileV3Scene(withInterior);
    expect(after).toEqual(before);
    const serialized = JSON.stringify(after);
    for (const id of interiorIds(withInterior)) expect(serialized.includes(`"${id}`), id).toBe(false);
  });

  it("room edits stay local: pools, roofs, landscape and the whole exterior are untouched", () => {
    const scene = interiorScene();
    const exteriorIds = ["house", "house-roof", "pool", "terrace", "garden", "entry-path"];
    const before = compileV3Scene(scene), protectedBefore = objectPrimitives(scene, ["house-roof", "pool", "garden", "terrace"]);
    expect(protectedBefore.length).toBeGreaterThan(0);
    const edits = [
      editRoom(scene, "kitchen", { footprint: { x: 5, z: -1.5, width: 6, depth: 9 }, program: "kitchen-dining" }),
      executeV3SceneOperations(scene, { intent: "add room", operations: [{ op: "setRoom", room: { id: "pantry", storeyId: "house-ground", hostMassId: "house", program: "storage", footprint: { x: 7, z: 4, width: 2, depth: 2 }, label: "Pantry", semanticRole: "storage" } }] }),
      executeV3SceneOperations(scene, { intent: "remove room", operations: [{ op: "removeRoom", target: "powder" }] }),
    ];
    for (const edit of edits) {
      expect(edit.ok, edit.errors.join("; ")).toBe(true);
      expect(edit.scene.objects).toEqual(scene.objects);
      expect(edit.scene.siteHierarchy).toEqual(scene.siteHierarchy);
      expect(edit.scene.interior!.storeys).toEqual(scene.interior!.storeys);
      expect(compileV3Scene(edit.scene)).toEqual(before);
      expect(objectPrimitives(edit.scene, ["house-roof", "pool", "garden", "terrace"])).toEqual(protectedBefore);
      for (const id of exteriorIds) expect(edit.scene.objects.find((object) => object.id === id)).toEqual(scene.objects.find((object) => object.id === id));
    }
    // Only the edited room changed.
    const changed = edits[0].scene.interior!.rooms.filter((room, index) => JSON.stringify(room) !== JSON.stringify(scene.interior!.rooms[index])).map((room) => room.id);
    expect(changed).toEqual(["kitchen"]);
    // Removing a room drops only its relationships.
    expect(edits[2].scene.relationships.filter((relationship) => relationship.from === "powder" || relationship.to === "powder")).toEqual([]);
    expect(edits[2].scene.relationships).toHaveLength(scene.relationships.length - 2);
  });

  it("rejects rooms without a valid storey or with a mismatched host", () => {
    const scene = interiorScene();
    const orphan = executeV3SceneOperations(scene, { intent: "orphan", operations: [{ op: "editRoom", target: "living", room: { storeyId: "missing-storey" } }] });
    expect(orphan.ok).toBe(false);
    expect(orphan.errors.join()).toMatch(/missing storey/);
    expect(orphan.scene).toEqual(scene);
    const mismatch = executeV3SceneOperations(scene, { intent: "mismatch", operations: [{ op: "editRoom", target: "living", room: { hostMassId: "terrace" } }] });
    expect(mismatch.ok).toBe(false);
    const duplicate = executeV3SceneOperations(scene, { intent: "dup", operations: [{ op: "setRoom", room: { ...INTERIOR_ROOMS[0], id: "pool" } }] });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.errors.join()).toMatch(/collides/);
  });

  it("deleting the host mass cascades its storeys, rooms and room relationships", () => {
    const scene = interiorScene();
    const deleted = executeV3SceneOperations(scene, { intent: "delete house", operations: [{ op: "delete", target: "house" }] });
    expect(deleted.ok, deleted.errors.join("; ")).toBe(true);
    expect(deleted.scene.interior).toEqual({ storeys: [], rooms: [] });
    expect(deleted.scene.relationships).toEqual([]);
    expect(deleted.scene.objects.find((object) => object.id === "pool")).toEqual(scene.objects.find((object) => object.id === "pool"));
  });

  it("older exterior-only scenes stay compatible and never gain rooms", () => {
    for (const { name, raw } of regressionLadder) {
      const scene = repairV3GeneratedScene(normalizeV3GenerationOutput(structuredClone(raw)).scene).scene;
      expect(scene.interior, name).toBeUndefined();
      expect(validateV3Scene(scene, { lenient: true }).ok, name).toBe(true);
      const edited = executeV3SceneOperations(scene, { intent: "recolour", operations: [{ op: "changeMaterial", target: scene.objects[0].id, material: { id: "white", color: "#ffffff" } }] });
      expect(edited.ok, name).toBe(true);
      expect(edited.scene.interior, name).toBeUndefined();
      expect("interior" in edited.scene, name).toBe(false);
    }
    const exterior = exteriorOnlyScene();
    expect("interior" in exterior).toBe(false);
    expect(auditV3Interior(exterior)).toEqual([]);
  });
});
