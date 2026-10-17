import { v3CompositionSchema, type V3Composition } from "./composition";
import type { V3Scene, V3SceneObject, Vec3, V3Material } from "./scene";
import type { V3SiteHierarchy, V3SupportRef } from "./siteHierarchy";
import { validateV3Scene } from "./validation";
import { z } from "zod";
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from "./generation";
import { compileV3Scene, validateV3CompiledGeometry } from "./scene";
import { architectureFromRuntimeGeometry, materializeV3ArchitecturalObject, type V3ArchitecturalGeometry } from "./architecture";
import { auditV3Interior, MAX_PARTITION_THICKNESS, pruneV3InteriorForDeletedObjects, pruneV3InteriorForRemovedRooms, type V3Door, type V3Partition, type V3Room, type V3Storey } from "./interior";

export type V3SceneOperation =
  | { op: "setComposition"; target: string; composition: V3Composition }
  | { op: "create"; object: V3SceneObject } | { op: "delete"; target: string }
  | { op: "move"; target: string; position: Vec3 } | { op: "rotate"; target: string; rotation: Vec3 }
  | { op: "resize"; target: string; dimensions: Vec3 } | { op: "changeMaterial"; target: string; material: V3Material }
  | { op: "editArchitecture"; target: string; architecture: Partial<V3ArchitecturalGeometry> }
  | { op: "attach"; target: string; hostId: string } | { op: "detach"; target: string }
  | { op: "duplicate"; target: string; id: string; position?: Vec3 }
  | { op: "setSupport"; target: string; support: V3SupportRef }
  | { op: "setConnectorEndpoints"; target: string; fromSupportId: string; toSupportId: string }
  | { op: "replaceSiteHierarchy"; hierarchy: V3SiteHierarchy }
  // Semantic interior (runtime/local only; not offered to Terra). Rooms never take a Y: storeys own elevation.
  | { op: "setStorey"; storey: V3Storey }
  | { op: "setRoom"; room: V3Room }
  | { op: "editRoom"; target: string; room: Partial<Omit<V3Room, "id">> }
  | { op: "removeRoom"; target: string }
  // Semantic partitions and openings. Their wall geometry is derived at compile time. Re-setting an id edits it in place.
  | { op: "setPartition"; partition: V3Partition }
  | { op: "removePartition"; target: string }
  | { op: "setDoor"; door: V3Door }
  | { op: "removeDoor"; target: string };
export interface V3SceneEditPlan { intent: string; operations: V3SceneOperation[]; }

const finiteNumber = z.preprocess((v) => typeof v === "string" && v.trim() ? Number(v) : v, z.number().finite());
const vector = z.tuple([finiteNumber, finiteNumber, finiteNumber]);
const target = z.string().min(1);
const architecturePatch = z.object({ x: finiteNumber.optional(), z: finiteNumber.optional(), baseElevation: finiteNumber.optional(), width: finiteNumber.pipe(z.number().positive()).optional(), depth: finiteNumber.pipe(z.number().positive()).optional(), height: finiteNumber.pipe(z.number().positive()).optional(), rotationY: finiteNumber.optional() });
const label = z.string().min(1).max(100);
const storeySchema = z.object({ id: target, hostMassId: target, index: z.number().int().min(0), elevation: finiteNumber, height: finiteNumber.pipe(z.number().positive()), label, semanticRole: label }).strict();
// Strict: a room has no elevation/Y field to author.
const roomSchema = z.object({ id: target, storeyId: target, hostMassId: target, program: z.string().min(1).max(80), footprint: z.object({ x: finiteNumber, z: finiteNumber, width: finiteNumber.pipe(z.number().positive()), depth: finiteNumber.pipe(z.number().positive()) }).strict(), label, semanticRole: label }).strict();
const partitionSchema = z.object({ id: target, storeyId: target, roomAId: target, roomBId: target.nullable(), boundaryId: target, partitionType: z.string().min(1).max(80), semanticRole: label, thickness: finiteNumber.pipe(z.number().positive().max(MAX_PARTITION_THICKNESS)).optional() }).strict();
const doorSchema = z.object({ id: target, partitionId: target, offset: finiteNumber, width: finiteNumber.pipe(z.number().positive()), program: z.string().min(1).max(80), semanticRole: label }).strict();
const operationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setComposition"), target, composition: v3CompositionSchema }),
  z.object({ op: z.literal("create"), object: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal("delete"), target }),
  z.object({ op: z.literal("move"), target, position: vector }),
  z.object({ op: z.literal("rotate"), target, rotation: vector }),
  z.object({ op: z.literal("resize"), target, dimensions: vector.refine(v => v.every(n => n > 0)) }),
  z.object({ op: z.literal("editArchitecture"), target, architecture: architecturePatch.refine(v => Object.keys(v).length > 0) }),
  z.object({ op: z.literal("changeMaterial"), target, material: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal("attach"), target, hostId: target }),
  z.object({ op: z.literal("detach"), target }),
  z.object({ op: z.literal("duplicate"), target, id: target, position: vector.optional() }),
  z.object({ op: z.literal("setSupport"), target, support: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal("setConnectorEndpoints"), target, fromSupportId: target, toSupportId: target }),
  z.object({ op: z.literal("replaceSiteHierarchy"), hierarchy: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal("setStorey"), storey: storeySchema }),
  z.object({ op: z.literal("setRoom"), room: roomSchema }),
  z.object({ op: z.literal("editRoom"), target, room: roomSchema.omit({ id: true }).partial().refine(v => Object.keys(v).length > 0) }),
  z.object({ op: z.literal("removeRoom"), target }),
  z.object({ op: z.literal("setPartition"), partition: partitionSchema }),
  z.object({ op: z.literal("removePartition"), target }),
  z.object({ op: z.literal("setDoor"), door: doorSchema }),
  z.object({ op: z.literal("removeDoor"), target }),
]);

/** Raw JSON enters here before canonical checks; operation intent itself remains strict. */
export function normalizeV3EditPlan(raw: unknown, scene: V3Scene): { plan?: V3SceneEditPlan; errors: string[] } {
  const parsed = z.object({ intent: z.string().trim().min(1), operations: z.array(operationSchema).min(1).max(12) }).safeParse(raw);
  if (!parsed.success) return { errors: parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`) };
  const normalized = parsed.data.operations.map(operation => {
    if (operation.op === "replaceSiteHierarchy") return { ...operation, hierarchy: normalizeV3GenerationOutput({ ...scene, siteHierarchy: operation.hierarchy }).scene.siteHierarchy };
    if (operation.op === "create") return { ...operation, object: normalizeV3GenerationOutput({ ...scene, objects: [operation.object] }).scene.objects[0] };
    if (operation.op === "changeMaterial" || operation.op === "setSupport") {
      const object = scene.objects.find(object => object.id === operation.target);
      if (!object) return operation;
      const field = operation.op === "changeMaterial" ? "material" : "support";
      const normalized = normalizeV3GenerationOutput({ ...scene, objects: [{ ...object, [field]: operation.op === "changeMaterial" ? operation.material : operation.support }] }).scene.objects[0];
      return { ...operation, [field]: normalized[field] };
    }
    return operation;
  });
  return { plan: { intent: parsed.data.intent, operations: normalized as V3SceneOperation[] }, errors: [] };
}

/** Atomic scene executor for local V3 edits; no V2 document is involved. */
export function executeV3SceneOperations(scene: V3Scene, rawPlan: unknown): { ok: boolean; scene: V3Scene; errors: string[]; warnings?: string[] } {
  const parsed = normalizeV3EditPlan(rawPlan, scene);
  if (!parsed.plan) return { ok: false, scene, errors: parsed.errors };
  const plan = parsed.plan;
  const original = structuredClone(scene); const next = structuredClone(scene); const errors: string[] = [];
  if (!plan.intent.trim() || !Array.isArray(plan.operations) || !plan.operations.length) errors.push("V3 edit requires an intent and operations.");
  const get = (id: string) => next.objects.find((object) => object.id === id);
  /** Partitions/doors written by this plan must be fully valid; ones a room edit invalidates are only reported. */
  const authored = new Set<string>();
  for (const operation of plan.operations ?? []) {
    if (operation.op === "replaceSiteHierarchy") { next.siteHierarchy = operation.hierarchy; continue; }
    if (operation.op === "setStorey" || operation.op === "setRoom") {
      const interior = next.interior ??= { storeys: [], rooms: [] };
      const list: Array<V3Storey | V3Room> = operation.op === "setStorey" ? interior.storeys : interior.rooms, datum = operation.op === "setStorey" ? operation.storey : operation.room;
      const index = list.findIndex((candidate) => candidate.id === datum.id);
      if (index >= 0) list[index] = datum; else list.push(datum);
      continue;
    }
    if (operation.op === "editRoom" || operation.op === "removeRoom") {
      const rooms = next.interior?.rooms ?? [], index = rooms.findIndex((room) => room.id === operation.target);
      if (index < 0) { errors.push(`Missing room ${operation.target}.`); continue; }
      if (operation.op === "editRoom") rooms[index] = { ...rooms[index], ...operation.room };
      else {
        rooms.splice(index, 1);
        next.relationships = next.relationships.filter((relationship) => relationship.from !== operation.target && relationship.to !== operation.target);
        pruneV3InteriorForRemovedRooms(next, new Set([operation.target]));
      }
      continue;
    }
    if (operation.op === "setPartition" || operation.op === "setDoor") {
      const interior = next.interior ??= { storeys: [], rooms: [] };
      const list: Array<V3Partition | V3Door> = operation.op === "setPartition" ? interior.partitions ??= [] : interior.doors ??= [];
      const datum = operation.op === "setPartition" ? operation.partition : operation.door, index = list.findIndex((candidate) => candidate.id === datum.id);
      if (index >= 0) list[index] = datum; else list.push(datum);
      authored.add(datum.id);
      continue;
    }
    if (operation.op === "removePartition" || operation.op === "removeDoor") {
      const interior = next.interior, key = operation.op === "removePartition" ? "partitions" : "doors";
      const list: Array<V3Partition | V3Door> = interior?.[key] ?? [], index = list.findIndex((candidate) => candidate.id === operation.target);
      if (index < 0) { errors.push(`Missing ${operation.op === "removePartition" ? "partition" : "door"} ${operation.target}.`); continue; }
      list.splice(index, 1);
      if (operation.op === "removePartition" && interior?.doors) interior.doors = interior.doors.filter((door) => door.partitionId !== operation.target);
      continue;
    }
    if (operation.op === "create") { if (get(operation.object.id)) errors.push(`Object ${operation.object.id} already exists.`); else next.objects.push(materializeV3ArchitecturalObject(operation.object)); continue; }
    const target = get(operation.target); if (!target) { errors.push(`Missing target ${operation.target}.`); continue; }
    if (operation.op === "delete") {
      const before = new Set(next.objects.map((object) => object.id));
      next.objects = next.objects.filter((object) => object.id !== target.id && object.parentId !== target.id && object.hostId !== target.id);
      for (const object of next.objects) before.delete(object.id);
      pruneV3InteriorForDeletedObjects(next, before);
      continue;
    }
    if (operation.op === "move") {
      if (target.architecture) target.architecture = { ...target.architecture, x: operation.position[0], z: operation.position[2], baseElevation: operation.position[1] - target.architecture.height / 2 };
      else target.transform.position = operation.position;
    }
    if (operation.op === "rotate") {
      if (target.architecture) target.architecture = { ...target.architecture, rotationY: operation.rotation[1] };
      else target.transform.rotation = operation.rotation;
    }
    if (operation.op === "resize") {
      if (target.architecture) target.architecture = { ...target.architecture, width: operation.dimensions[0], height: operation.dimensions[1], depth: operation.dimensions[2] };
      else target.dimensions = operation.dimensions;
    }
    if (operation.op === "setComposition") target.composition = operation.composition;
    if (operation.op === "editArchitecture") target.architecture = { ...(target.architecture ?? architectureFromRuntimeGeometry(target)), ...operation.architecture };
    if (operation.op === "changeMaterial") target.material = operation.material;
    if (operation.op === "attach") target.hostId = operation.hostId;
    if (operation.op === "detach") delete target.hostId;
    if (operation.op === "setSupport") target.support = operation.support;
    if (operation.op === "setConnectorEndpoints") { target.fromSupportId = operation.fromSupportId; target.toSupportId = operation.toSupportId; }
    if (operation.op === "duplicate") {
      if (get(operation.id)) errors.push(`Object ${operation.id} already exists.`);
      else {
        const duplicate = { ...structuredClone(target), id: operation.id, transform: { ...target.transform, position: operation.position ?? target.transform.position } };
        if (duplicate.architecture && operation.position) duplicate.architecture = { ...duplicate.architecture, x: operation.position[0], z: operation.position[2], baseElevation: operation.position[1] - duplicate.architecture.height / 2 };
        next.objects.push(materializeV3ArchitecturalObject(duplicate));
      }
    }
    if (target.architecture) Object.assign(target, materializeV3ArchitecturalObject(target));
  }
  // Edits persist only authored intent; derived support is re-resolved at compile/audit, never written here.
  const touched = new Set(plan.operations.flatMap((operation) => operation.op === "create" ? [operation.object.id] : operation.op === "duplicate" ? [operation.id, operation.target] : "target" in operation ? [operation.target] : []));
  const repaired = repairV3GeneratedScene(next, [], { reportDerivedSupport: false, scopeIds: touched });
  const valid = validateV3Scene(next, { lenient: true }); errors.push(...valid.errors);
  if (authored.size && !errors.length) for (const issue of auditV3Interior(next)) if (issue.severity !== "advisory" && authored.has(issue.targetId)) errors.push(`${issue.code} [${issue.targetId}]: ${issue.message}`);
  if (!errors.length) errors.push(...validateV3CompiledGeometry(next, compileV3Scene(next), { lenient: true }).errors);
  return errors.length ? { ok: false, scene: original, errors } : { ok: true, scene: next, errors: [], warnings: [...repaired.notes.map(note => `${note.code} [${note.targetId}]: ${note.message}`), ...valid.warnings] };
}
