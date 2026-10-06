import type { V3Scene, V3SceneObject, Vec3, V3Material } from "./scene";
import type { V3SiteHierarchy, V3SupportRef } from "./siteHierarchy";
import { validateV3Scene } from "./validation";

export type V3SceneOperation =
  | { op: "create"; object: V3SceneObject } | { op: "delete"; target: string }
  | { op: "move"; target: string; position: Vec3 } | { op: "rotate"; target: string; rotation: Vec3 }
  | { op: "resize"; target: string; dimensions: Vec3 } | { op: "changeMaterial"; target: string; material: V3Material }
  | { op: "attach"; target: string; hostId: string } | { op: "detach"; target: string }
  | { op: "duplicate"; target: string; id: string; position?: Vec3 }
  | { op: "setSupport"; target: string; support: V3SupportRef }
  | { op: "setConnectorEndpoints"; target: string; fromSupportId: string; toSupportId: string }
  | { op: "replaceSiteHierarchy"; hierarchy: V3SiteHierarchy };
export interface V3SceneEditPlan { intent: string; operations: V3SceneOperation[]; }

/** Atomic scene executor for local V3 edits; no V2 document is involved. */
export function executeV3SceneOperations(scene: V3Scene, plan: V3SceneEditPlan): { ok: boolean; scene: V3Scene; errors: string[] } {
  const original = structuredClone(scene); const next = structuredClone(scene); const errors: string[] = [];
  if (!plan.intent.trim() || !Array.isArray(plan.operations) || !plan.operations.length) errors.push("V3 edit requires an intent and operations.");
  const get = (id: string) => next.objects.find((object) => object.id === id);
  for (const operation of plan.operations ?? []) {
    if (operation.op === "replaceSiteHierarchy") { next.siteHierarchy = operation.hierarchy; continue; }
    if (operation.op === "create") { if (get(operation.object.id)) errors.push(`Object ${operation.object.id} already exists.`); else next.objects.push(operation.object); continue; }
    const target = get(operation.target); if (!target) { errors.push(`Missing target ${operation.target}.`); continue; }
    if (operation.op === "delete") { next.objects = next.objects.filter((object) => object.id !== target.id && object.parentId !== target.id && object.hostId !== target.id); continue; }
    if (operation.op === "move") target.transform.position = operation.position;
    if (operation.op === "rotate") target.transform.rotation = operation.rotation;
    if (operation.op === "resize") target.dimensions = operation.dimensions;
    if (operation.op === "changeMaterial") target.material = operation.material;
    if (operation.op === "attach") target.hostId = operation.hostId;
    if (operation.op === "detach") delete target.hostId;
    if (operation.op === "setSupport") target.support = operation.support;
    if (operation.op === "setConnectorEndpoints") { target.fromSupportId = operation.fromSupportId; target.toSupportId = operation.toSupportId; }
    if (operation.op === "duplicate") { if (get(operation.id)) errors.push(`Object ${operation.id} already exists.`); else next.objects.push({ ...structuredClone(target), id: operation.id, transform: { ...target.transform, position: operation.position ?? target.transform.position } }); }
  }
  const valid = validateV3Scene(next); errors.push(...valid.errors);
  return errors.length ? { ok: false, scene: original, errors } : { ok: true, scene: next, errors: [] };
}
