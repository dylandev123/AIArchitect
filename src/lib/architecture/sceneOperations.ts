import type { OutdoorAssetPlacement, OutdoorAssetTombstone } from "@/lib/outdoor/placements";
import { appendTombstone } from "@/lib/outdoor/ownership";
import { z } from "zod";
import { sitePlanElements, type SpatialReflow } from "./stages/spatialReflow";
import { siteFeatureRects, type SitePlan } from "./sitePlanContract";
import { sitePlanContextForDocument } from "./sitePlanContext";
import { validateArchitecturalDesignDocument, type ArchitecturalAssembly, type ArchitecturalDesignDocument, type SceneMaterial, type SceneObject } from "./document";
import { LEVEL_HEIGHT } from "@/lib/house/constants";
import { editCapabilityNeedSchema, editGoalSchema, type EditCapabilityNeed, type EditGoal } from "./editGoals";

/**
 * The edit-language boundary. Targets are stable scene identities, never request nouns.  Existing V2
 * assemblies remain the preferred facade-hosted representation; free-standing primitives live in sceneObjects.
 */
export type SceneTarget = `mass:${string}` | `assembly:${string}:${string}` | `part:${string}:${string}:${string}` | `scene:${string}` | `asset:${string}` | `asset-group:${string}` | `site:${string}`;
export type SceneOperation =
  | { op: "create"; object: { kind: "assembly"; massId: string; assembly: ArchitecturalAssembly } | { kind: "scene"; scene: SceneObject } }
  | { op: "delete"; target: SceneTarget }
  | { op: "move"; target: SceneTarget; position: readonly [number, number, number] }
  | { op: "rotate"; target: SceneTarget; rotation: readonly [number, number, number] }
  | { op: "resize"; target: SceneTarget; size: readonly [number, number, number] }
  | { op: "changeMaterial"; target: `mass:${string}` | `scene:${string}` | `asset:${string}`; material: SceneMaterial }
  | { op: "attach"; target: `scene:${string}`; host: SceneObject["host"] }
  | { op: "detach"; target: `scene:${string}` }
  | { op: "duplicate"; target: `scene:${string}`; id: string; position?: readonly [number, number, number] }
  | { op: "extrude" | "cut"; target: SceneTarget; intent: string };

/**
 * An edit can change the world, confirm that the requested state is already present, or report that the
 * available edit vocabulary cannot express it.  The latter two outcomes intentionally have no operations.
 */
export type SceneEditDisposition = "apply" | "already-satisfied" | "capability-needed";
export interface SceneEditPlan {
  intent: string;
  operations: readonly SceneOperation[];
  /** Required for an empty plan so absence of work is evidence-based rather than an accidental success. */
  status?: SceneEditDisposition;
  rationale?: string;
  siteReflow?: SpatialReflow;
  capabilityNeeds?: readonly EditCapabilityNeed[];
  /**
   * The Architect's ledger of the owner's design goals. Each goal is planned (operationIds), already satisfied
   * (evidence), or blocked (capabilityNeedIds). Mandatory for broad requests; see `editPlanCoverage`.
   */
  goals?: readonly EditGoal[];
}
export interface SceneEditState { document: ArchitecturalDesignDocument; sitePlan: SitePlan; outdoorAssetPlacements?: readonly OutdoorAssetPlacement[]; outdoorAssetTombstones?: readonly OutdoorAssetTombstone[]; }
export interface SceneEditResult { ok: boolean; document: ArchitecturalDesignDocument; sitePlan: SitePlan; outdoorAssetPlacements: OutdoorAssetPlacement[]; outdoorAssetTombstones: OutdoorAssetTombstone[]; errors: string[]; capabilityNeeds: EditCapabilityNeed[]; }
export interface EditableSceneTarget {
  id: SceneTarget;
  semanticType: string;
  label: string;
  transform?: { position: readonly [number, number, number]; rotation: readonly [number, number, number]; scale?: number; dimensions?: readonly [number, number, number] };
  host?: unknown;
  source?: { assetId?: string; kind?: string };
  material?: SceneMaterial;
}

/**
 * The single executable namespace for an edit attempt.  The Architect sees this
 * catalog and the executor resolves through the very same ids; renderer handles
 * and request wording never participate in target resolution.
 */
export interface TargetCatalogEntry extends EditableSceneTarget {
  kind: "mass" | "assembly" | "part" | "scene" | "asset" | "asset-group" | "site";
  /** Durable id in the authoritative document, Site Plan, or placement array. */
  persistentReference: string;
  /** A source record is context only; execution always uses persistentReference. */
  source?: EditableSceneTarget["source"];
  /** Non-renderer source detail for catalog-only records such as Site Plan targets. */
  context?: unknown;
  /** Host metadata for scene objects and support metadata for persistent assets. */
  hostOrSupport?: unknown;
  capabilities: readonly SceneOperation["op"][];
}

/**
 * The wire representation of the edit language.  Keep this beside `SceneOperation`: it is the one structured
 * output contract consumed by the Architect, while the executor below remains the final semantic validator.
 * Payloads are deliberately checked again by the executor/document validator so an operation can never bypass
 * the durable V2 contracts merely by satisfying this transport schema.
 */
/**
 * JSON Schema's old tuple form (`items: [{...}, {...}, {...}]`) is rejected by
 * OpenAI structured outputs. Keep the durable TypeScript vectors as triples,
 * but express their wire representation as a bounded homogeneous array.
 */
const vector3Schema = z.array(z.number().finite()).min(3).max(3);
const targetSchema = z.string().regex(/^(mass|assembly|part|scene|asset|asset-group|site):[\w:-]+$/);
const materialSchema = z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), roughness: z.number().finite().optional(), metalness: z.number().finite().optional(), opacity: z.number().finite().optional() }).strict();
const sceneHostSchema = z.object({ kind: z.enum(["world", "mass"]), massId: z.string().min(1).optional(), anchor: z.enum(["center", "roof"]).optional() }).strict()
  .superRefine((value, ctx) => { if (value.kind === "mass" && !value.massId) ctx.addIssue({ code: "custom", path: ["massId"], message: "mass host needs massId." }); });
const assemblyHostSchema = z.object({ kind: z.enum(["floor", "facade", "entrance", "terrace", "roof", "slab"]), level: z.number().int().nonnegative().optional(), facade: z.enum(["north", "south", "east", "west"]).optional(), slabId: z.string().min(1).optional(), offset: z.number().finite().optional() }).strict()
  .superRefine((value, ctx) => {
    if ((value.kind === "floor" || value.kind === "facade") && value.level === undefined) ctx.addIssue({ code: "custom", path: ["level"], message: `${value.kind} host needs level.` });
    if ((value.kind === "facade" || value.kind === "entrance") && !value.facade) ctx.addIssue({ code: "custom", path: ["facade"], message: `${value.kind} host needs facade.` });
    if (value.kind === "slab" && !value.slabId) ctx.addIssue({ code: "custom", path: ["slabId"], message: "slab host needs slabId." });
  });
const assemblyPartSchema = z.object({
  id: z.string().min(1), type: z.enum(["slab", "railing", "post", "beam"]), facade: z.enum(["north", "south", "east", "west"]).optional(), start: z.number().finite().optional(), end: z.number().finite().optional(), at: z.number().finite().optional(), depth: z.number().finite().optional(), level: z.number().int().nonnegative().optional(), elevation: z.number().finite().optional(), host: assemblyHostSchema.optional(), thickness: z.number().positive().optional(), slabId: z.string().min(1).optional(), edges: z.array(z.enum(["outer", "start", "end"])).min(1).optional(), height: z.number().positive().optional(), size: z.number().positive().optional(),
}).strict();
const assemblySchema = z.object({ id: z.string().min(1), intent: z.string().min(1), parts: z.array(assemblyPartSchema).min(1).max(16) }).strict();
const sceneObjectSchema = z.object({ id: z.string().min(1), kind: z.enum(["mass", "wall", "surface", "slab", "post", "beam", "railing", "roof", "path", "asset-proxy"]), label: z.string().min(1), position: vector3Schema, rotation: vector3Schema.optional(), size: vector3Schema, host: sceneHostSchema.optional(), material: materialSchema.optional(), intent: z.string().optional() }).strict();
const createObjectSchema = z.object({ kind: z.enum(["assembly", "scene"]), massId: z.string().min(1).optional(), assembly: assemblySchema.optional(), scene: sceneObjectSchema.optional() }).strict()
  .superRefine((value, ctx) => {
    if (value.kind === "assembly" && (!value.massId || !value.assembly)) ctx.addIssue({ code: "custom", message: "assembly create needs massId and assembly." });
    if (value.kind === "scene" && !value.scene) ctx.addIssue({ code: "custom", message: "scene create needs scene." });
  });

/** A flat wire object avoids provider-rejected union roots and unconstrained passthrough payloads. */
const sceneOperationSchema = z.object({
  op: z.enum(["create", "delete", "move", "rotate", "resize", "changeMaterial", "attach", "detach", "duplicate", "extrude", "cut"]),
  object: createObjectSchema.optional(), target: targetSchema.optional(), position: vector3Schema.optional(), rotation: vector3Schema.optional(), size: vector3Schema.optional(), material: materialSchema.optional(), host: sceneHostSchema.optional(), id: z.string().min(1).optional(), intent: z.string().min(1).optional(),
}).strict().superRefine((value, ctx) => {
  const need = (field: keyof typeof value) => { if (value[field] === undefined) ctx.addIssue({ code: "custom", path: [field], message: `${String(field)} is required for ${value.op}.` }); };
  if (value.op === "create") need("object");
  if (value.op !== "create") need("target");
  if (value.op === "move") need("position");
  if (value.op === "rotate") need("rotation");
  if (value.op === "resize") need("size");
  if (value.op === "changeMaterial") need("material");
  if (value.op === "attach") need("host");
  if (value.op === "duplicate") need("id");
  if (value.op === "extrude" || value.op === "cut") need("intent");
});

export const sceneEditPlanSchema = z.object({
  intent: z.string().min(1),
  operations: z.array(sceneOperationSchema),
  status: z.enum(["apply", "already-satisfied", "capability-needed"]).optional(),
  rationale: z.string().min(1).optional(),
  siteReflow: z.object({ elements: z.array(z.object({ id: z.string().min(1), action: z.enum(["move", "resize", "rotate", "reroute"]), dependsOn: z.string().min(1), reason: z.string().min(1) }).strict()).min(1) }).strict().optional(),
  capabilityNeeds: z.array(editCapabilityNeedSchema).optional(),
  goals: z.array(editGoalSchema).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.operations.length > 0) {
    if (value.status === "already-satisfied" || value.status === "capability-needed") {
      ctx.addIssue({ code: "custom", path: ["status"], message: `${value.status} plans cannot contain operations.` });
    }
    return;
  }
  if (value.siteReflow) ctx.addIssue({ code: "custom", path: ["siteReflow"], message: "An empty operation plan cannot reflow the site." });
  if (value.status === "already-satisfied") {
    if (!value.rationale) ctx.addIssue({ code: "custom", path: ["rationale"], message: "An already-satisfied plan needs a rationale." });
    return;
  }
  if (value.status === "capability-needed" || value.capabilityNeeds?.length) {
    if (!value.capabilityNeeds?.length) ctx.addIssue({ code: "custom", path: ["capabilityNeeds"], message: "A capability-needed plan needs at least one Capability Need." });
    return;
  }
  ctx.addIssue({ code: "custom", path: ["operations"], message: "An empty operation plan needs already-satisfied status and rationale, or a Capability Need." });
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const finite3 = (v: unknown): v is readonly [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
const positive3 = (v: unknown): v is readonly [number, number, number] => finite3(v) && v.every((n) => n > 0);
const materialOk = (m: unknown): m is SceneMaterial => Boolean(m && typeof m === "object" && typeof (m as SceneMaterial).color === "string" && /^#[0-9a-fA-F]{6}$/.test((m as SceneMaterial).color));
const targetParts = (target: string) => target.split(":");

function assemblyAt(doc: ArchitecturalDesignDocument, target: string): { mass: number; assembly: number } | undefined {
  const [, massId, assemblyId] = targetParts(target);
  const mass = doc.massing.masses.findIndex((m) => m.id === massId);
  const assembly = mass < 0 ? -1 : (doc.massing.masses[mass].assemblies ?? []).findIndex((a) => a.id === assemblyId);
  return mass < 0 || assembly < 0 ? undefined : { mass, assembly };
}

function partAt(doc: ArchitecturalDesignDocument, target: string): { mass: number; assembly: number; part: number } | undefined {
  const [, massId, assemblyId, partId] = targetParts(target);
  const at = assemblyAt(doc, `assembly:${massId}:${assemblyId}`);
  const part = at ? (doc.massing.masses[at.mass].assemblies ?? [])[at.assembly].parts.findIndex((p) => p.id === partId) : -1;
  return !at || part < 0 ? undefined : { ...at, part };
}

const siteRectId = (label: string): string | undefined => label === "driveway" ? "site:driveway" : label === "pool" ? "site:pool" : label === "terrace" ? "site:terrace" : label === "pool deck" ? "site:poolDeck" : label.startsWith("parking ") ? `site:parking:${Number(label.slice(8)) - 1}` : undefined;

/**
 * Resolve the durable support plane for a free-standing object.  Site-plan surfaces
 * are all ground-level today; the explicit elevation field makes this the single
 * extension point for raised slabs, roofs, and future terrain sampling.
 */
function supportAt(plan: SitePlan, document: ArchitecturalDesignDocument, x: number, z: number, existing?: OutdoorAssetPlacement["support"]): NonNullable<OutdoorAssetPlacement["support"]> {
  const context = sitePlanContextForDocument(document.brief, document);
  const rects = context ? siteFeatureRects(plan, context) : [];
  const contains = (label: string) => rects.some((rect) => rect.label === label && x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1);
  if (contains("pool deck")) return { kind: "deck", elevation: 0 };
  if (contains("terrace")) return { kind: "patio", elevation: 0 };
  // A roof label is not support. Retain it only when an executable V2 mass owns
  // the point; legacy metadata with no host falls through to actual terrain.
  if (existing?.kind === "roof" && existing.massId) {
    const mass = document.massing.masses.find((candidate) => candidate.id === existing.massId);
    if (mass) {
      const dx = x - mass.position.x, dz = z - mass.position.z, c = Math.cos(mass.rotation), s = Math.sin(mass.rotation);
      const localX = dx * c - dz * s, localZ = dx * s + dz * c;
      if (Math.abs(localX) <= mass.width / 2 && Math.abs(localZ) <= mass.depth / 2)
        return { ...existing, elevation: mass.elevation + (mass.height ?? mass.floors * LEVEL_HEIGHT) };
    }
  }
  return { kind: "terrain", elevation: 0 };
}

function groundPlacement(placement: OutdoorAssetPlacement, plan: SitePlan, document: ArchitecturalDesignDocument, position: readonly [number, number, number]): OutdoorAssetPlacement {
  const support = supportAt(plan, document, position[0], position[2], placement.support);
  const localMinY = placement.localBounds?.min[1] ?? 0;
  return { ...placement, position: [position[0], support.elevation - localMinY * placement.scale, position[2]], support };
}

/** Post-generation audit used by callers that materialize or import assets. */
export function auditPlacementSupports(state: Pick<SceneEditState, "document" | "sitePlan" | "outdoorAssetPlacements">): { placementId: string; reason: string }[] {
  return (state.outdoorAssetPlacements ?? []).flatMap((placement) => {
    const resolved = supportAt(state.sitePlan, state.document, placement.position[0], placement.position[2], placement.support);
    const base = placement.position[1] + (placement.localBounds?.min[1] ?? 0) * placement.scale;
    if (!placement.support || placement.support.kind !== resolved.kind)
      return [{ placementId: placement.id, reason: `No executable ${placement.support?.kind ?? "declared"} support exists at this location.` }];
    if (Math.abs(base - resolved.elevation) > 0.001)
      return [{ placementId: placement.id, reason: `Asset base ${base} is not grounded on support elevation ${resolved.elevation}.` }];
    return [];
  });
}

function worldFromGroup(anchor: readonly [number, number, number], rotation: readonly [number, number, number], local: readonly [number, number, number]): [number, number, number] {
  const yaw = rotation[1];
  return [anchor[0] + local[0] * Math.cos(yaw) + local[2] * Math.sin(yaw), anchor[1] + local[1], anchor[2] - local[0] * Math.sin(yaw) + local[2] * Math.cos(yaw)];
}

function localFromGroup(anchor: readonly [number, number, number], rotation: readonly [number, number, number], world: readonly [number, number, number]): [number, number, number] {
  const yaw = rotation[1], x = world[0] - anchor[0], z = world[2] - anchor[2];
  return [x * Math.cos(yaw) - z * Math.sin(yaw), world[1] - anchor[1], x * Math.sin(yaw) + z * Math.cos(yaw)];
}

/** Keep a member's group-relative transform truthful after an individual edit. */
function updateGroupLocal(placement: OutdoorAssetPlacement): OutdoorAssetPlacement {
  if (!placement.group) return placement;
  return { ...placement, group: { ...placement.group, localPosition: localFromGroup(placement.group.anchor, placement.group.rotation, placement.position), localRotation: [placement.rotation[0] - placement.group.rotation[0], placement.rotation[1] - placement.group.rotation[1], placement.rotation[2] - placement.group.rotation[2]] } };
}
/** Apply only coordinate/size fields represented by a stable Site Plan target. Wall-attached items may slide along
 * their host wall; moving them away from that host is intentionally rejected rather than silently redesigning them. */
function editSiteTarget(plan: SitePlan, document: ArchitecturalDesignDocument, operation: Extract<SceneOperation, { op: "move" | "rotate" | "resize" }>, errors: string[]): SitePlan | undefined {
  const target = operation.target;
  const context = sitePlanContextForDocument(document.brief, document);
  if (!context) { errors.push(`${operation.op} cannot resolve ${target}: no Site Plan frame.`); return; }
  const value = operation.op === "move" ? operation.position : operation.op === "rotate" ? operation.rotation : operation.size;
  const movePoint = operation.op === "move" ? { x: value[0], z: value[2] } : undefined;
  const resize = operation.op === "resize" ? value : undefined;
  const rotated = operation.op === "rotate" ? value : undefined;
  const replace = <K extends keyof SitePlan>(key: K, value: SitePlan[K]) => ({ ...plan, [key]: value });
  const rect = siteFeatureRects(plan, context).find((candidate) => siteRectId(candidate.label) === target);
  const center = rect ? { x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2 } : undefined;
  if (target.startsWith("site:parking:")) {
    const index = Number(target.slice("site:parking:".length)), parking = [...plan.parking], current = parking[index];
    if (!current || rotated) { errors.push(`${operation.op} cannot resolve ${target}.`); return; }
    parking[index] = movePoint ? { ...current, x: movePoint.x, z: movePoint.z } : { ...current, width: resize![0], depth: resize![2] };
    return replace("parking", parking);
  }
  if (target === "site:poolDeck") {
    if (rotated) { errors.push(`${operation.op} cannot resolve ${target}.`); return; }
    return replace("poolDeck", movePoint ? { ...plan.poolDeck, x: movePoint.x, z: movePoint.z } : { ...plan.poolDeck, width: resize![0], depth: resize![2] });
  }
  if (target.startsWith("site:landscape:")) {
    const index = Number(target.split(":").at(-1)), landscape = [...plan.landscape], current = landscape[index];
    if (!current || rotated) { errors.push(`${operation.op} cannot resolve ${target}.`); return; }
    landscape[index] = movePoint ? { ...current, x: movePoint.x, z: movePoint.z } : { ...current, width: resize![0], depth: resize![2] };
    return replace("landscape", landscape);
  }
  if (target.startsWith("site:feature:")) {
    const index = (plan.features ?? []).findIndex((feature) => feature.id === target.slice("site:feature:".length)), features = [...(plan.features ?? [])], current = features[index];
    if (!current) { errors.push(`${operation.op} cannot resolve ${target}.`); return; }
    features[index] = movePoint ? { ...current, x: movePoint.x, z: movePoint.z } : rotated ? { ...current, rotation: rotated[1] * 180 / Math.PI } : { ...current, width: resize![0], depth: resize![2] };
    return replace("features", features);
  }
  if (target.startsWith("site:path:")) {
    const index = Number(target.split(":").at(-1)), paths = [...plan.paths], current = paths[index];
    if (!current || !center || !movePoint || rotated || resize) { errors.push(`${operation.op} cannot resolve ${target}.`); return; }
    const dx = movePoint.x - center.x, dz = movePoint.z - center.z; paths[index] = { ...current, x1: current.x1 + dx, z1: current.z1 + dz, x2: current.x2 + dx, z2: current.z2 + dz };
    return replace("paths", paths);
  }
  if (target === "site:entrance" || target === "site:driveway" || target === "site:pool" || target === "site:terrace") {
    if (!center || rotated) { errors.push(`${operation.op} cannot resolve ${target}.`); return; }
    const item = target === "site:entrance" ? plan.entrance : plan[target.slice(5) as "driveway" | "pool" | "terrace"];
    const alongX = item.wall === "north" || item.wall === "south";
    if (movePoint) {
      const along = alongX ? movePoint.x - center.x : movePoint.z - center.z;
      const offWall = alongX ? Math.abs(movePoint.z - center.z) : Math.abs(movePoint.x - center.x);
      if (offWall > 1e-6) { errors.push(`move cannot detach wall-hosted ${target}; move it along its host wall.`); return; }
      return target === "site:entrance" ? replace("entrance", { ...plan.entrance, offset: plan.entrance.offset + along }) : replace(target.slice(5) as "driveway" | "pool" | "terrace", { ...item, offset: item.offset + along } as never);
    }
    if (target === "site:entrance") { errors.push("resize cannot change the point-only site:entrance."); return; }
    const key = target.slice(5) as "driveway" | "pool" | "terrace";
    return replace(key, key === "driveway" ? { ...plan.driveway, width: resize![0], length: resize![2] } : key === "pool" ? { ...plan.pool, width: resize![0], depth: resize![2] } : { ...plan.terrace, width: resize![0], depth: resize![2] } as never);
  }
  errors.push(`${operation.op} cannot resolve ${target}.`);
}

/** Executes atomically: invalid input returns the original saved world with no partial mutations. */
export function executeSceneEditPlan(state: SceneEditState, plan: SceneEditPlan): SceneEditResult {
  const original = clone(state);
  const next = clone(state);
  const errors: string[] = [];
  const needs = [...(plan.capabilityNeeds ?? [])];
  if (!plan.intent.trim()) errors.push("Edit plan needs an intent.");
  if (!Array.isArray(plan.operations)) errors.push("Edit plan needs operations.");
  const fail = () => ({ ok: false, document: original.document, sitePlan: original.sitePlan, outdoorAssetPlacements: [...(original.outdoorAssetPlacements ?? [])], outdoorAssetTombstones: [...(original.outdoorAssetTombstones ?? [])], errors, capabilityNeeds: needs });

  // The transport schema normally establishes this invariant. Keep it at the execution boundary as well,
  // because callers may construct a SceneEditPlan directly.
  if (!plan.operations.length) {
    if (plan.siteReflow) errors.push("An empty operation plan cannot reflow the site.");
    if (plan.status === "already-satisfied" && !plan.rationale?.trim()) errors.push("An already-satisfied plan needs a rationale.");
    if (plan.status === "capability-needed" && !needs.length) errors.push("A capability-needed plan needs at least one Capability Need.");
    if (plan.status !== "already-satisfied" && plan.status !== "capability-needed" && !needs.length) errors.push("An empty operation plan needs already-satisfied status and rationale, or a Capability Need.");
    return errors.length ? fail() : { ok: true, document: original.document, sitePlan: original.sitePlan, outdoorAssetPlacements: [...(original.outdoorAssetPlacements ?? [])], outdoorAssetTombstones: [...(original.outdoorAssetTombstones ?? [])], errors, capabilityNeeds: needs };
  }

  for (const operation of plan.operations) {
    if (!operation || typeof operation !== "object" || !("op" in operation)) { errors.push("Invalid scene operation."); continue; }
    // Resolve every existing target through the canonical catalog before an
    // operation branch can interpret its prefix. The catalog is rebuilt after
    // each operation, so create/delete chains have the same atomic semantics as
    // a one-operation plan and no advertised id can be non-executable.
    if ("target" in operation) {
      const target = targetCatalog(next).find((entry) => entry.id === operation.target);
      if (!target) { errors.push(`${operation.op} targets nonexistent ${operation.target}.`); continue; }
      if (!target.capabilities.includes(operation.op)) { errors.push(`${operation.op} does not support ${operation.target}.`); continue; }
    }
    if (operation.op === "create") {
      const create = operation.object;
      if (create.kind === "assembly") {
        const mass = next.document.massing.masses.findIndex((m) => m.id === create.massId);
        if (mass < 0) errors.push(`Create references unknown host mass ${create.massId}.`);
        else if ((next.document.massing.masses[mass].assemblies ?? []).some((a) => a.id === create.assembly.id)) errors.push(`Assembly ${create.assembly.id} already exists.`);
        else { const masses = [...next.document.massing.masses], current = masses[mass]; masses[mass] = { ...current, assemblies: [...(current.assemblies ?? []), clone(create.assembly)] }; next.document = { ...next.document, massing: { ...next.document.massing, masses } }; }
      } else if (create.kind === "scene") {
        const object = create.scene;
        if ((next.document.sceneObjects ?? []).some((existing) => existing.id === object.id)) errors.push(`Scene object ${object.id} already exists.`);
        else if (!finite3(object.position) || !positive3(object.size)) errors.push(`Scene object ${object.id} has invalid geometry.`);
        else next.document = { ...next.document, sceneObjects: [...(next.document.sceneObjects ?? []), clone(object)] };
      } else errors.push("Unsupported create object.");
    } else if (operation.op === "delete") {
      if (operation.target.startsWith("scene:")) {
        const id = operation.target.slice(6), objects = next.document.sceneObjects ?? [];
        if (!objects.some((o) => o.id === id)) errors.push(`Delete targets nonexistent ${operation.target}.`);
        else next.document = { ...next.document, sceneObjects: objects.filter((o) => o.id !== id) };
      } else if (operation.target.startsWith("asset:")) {
        const id = operation.target.slice(6), placements = next.outdoorAssetPlacements ?? [];
        if (!placements.some((p) => p.id === id)) errors.push(`Delete targets nonexistent ${operation.target}.`);
        else {
          const placement = placements.find((p) => p.id === id)!;
          next.outdoorAssetPlacements = placements.filter((p) => p.id !== id);
          next.outdoorAssetTombstones = appendTombstone(next.outdoorAssetTombstones, placement);
        }
      } else if (operation.target.startsWith("assembly:")) {
        const at = assemblyAt(next.document, operation.target);
        if (!at) errors.push(`Delete targets nonexistent ${operation.target}.`);
        else { const masses = [...next.document.massing.masses], mass = masses[at.mass]; masses[at.mass] = { ...mass, assemblies: (mass.assemblies ?? []).filter((_, i) => i !== at.assembly) }; next.document = { ...next.document, massing: { ...next.document.massing, masses } }; }
      } else errors.push(`Delete does not support ${operation.target}.`);
    } else if (operation.op === "move" || operation.op === "rotate" || operation.op === "resize") {
      const value = operation.op === "move" ? operation.position : operation.op === "rotate" ? operation.rotation : operation.size;
      if (!(operation.op === "resize" ? positive3(value) : finite3(value))) { errors.push(`${operation.op} needs valid ${operation.op === "resize" ? "positive size" : "transform"}.`); continue; }
      if (operation.target.startsWith("scene:")) {
        const id = operation.target.slice(6), index = (next.document.sceneObjects ?? []).findIndex((o) => o.id === id);
        if (index < 0) errors.push(`${operation.op} targets nonexistent ${operation.target}.`);
        else { const objects = [...(next.document.sceneObjects ?? [])], object = objects[index]; objects[index] = operation.op === "move" ? { ...object, position: value } : operation.op === "rotate" ? { ...object, rotation: value } : { ...object, size: value }; next.document = { ...next.document, sceneObjects: objects }; }
      } else if (operation.target.startsWith("asset-group:")) {
        const groupId = operation.target.slice("asset-group:".length), placements = next.outdoorAssetPlacements ?? [];
        const members = placements.filter((placement) => placement.group?.id === groupId);
        if (!members.length || operation.op === "resize") errors.push(`${operation.op} cannot resolve ${operation.target}.`);
        else {
          const anchor = members[0].group!.anchor;
          const rotation = members[0].group!.rotation;
          const requestedAnchor = operation.op === "move" ? [...value] as [number, number, number] : [...anchor] as [number, number, number];
          const nextAnchor = operation.op === "move"
            ? groundPlacement(members[0], next.sitePlan, next.document, requestedAnchor).position
            : requestedAnchor;
          const nextRotation = operation.op === "rotate" ? [...value] as [number, number, number] : [...rotation] as [number, number, number];
          next.outdoorAssetPlacements = placements.map((placement) => {
            if (placement.group?.id !== groupId) return placement;
            const position = worldFromGroup(nextAnchor, nextRotation, placement.group.localPosition);
            const transformed = { ...placement, position, rotation: [nextRotation[0] + placement.group.localRotation[0], nextRotation[1] + placement.group.localRotation[1], nextRotation[2] + placement.group.localRotation[2]] as [number, number, number], group: { ...placement.group, anchor: nextAnchor, rotation: nextRotation } };
            return operation.op === "move" ? groundPlacement(transformed, next.sitePlan, next.document, position) : transformed;
          });
        }
      } else if (operation.target.startsWith("asset:")) {
        const id = operation.target.slice(6), index = (next.outdoorAssetPlacements ?? []).findIndex((p) => p.id === id);
        if (index < 0) errors.push(`${operation.op} cannot resolve ${operation.target}.`);
        else {
          const placements = [...(next.outdoorAssetPlacements ?? [])], p = placements[index];
          if (operation.op === "move") placements[index] = updateGroupLocal(groundPlacement(p, next.sitePlan, next.document, value));
          else if (operation.op === "rotate") placements[index] = updateGroupLocal({ ...p, rotation: [...value] as [number, number, number] });
          else placements[index] = { ...p, dimensions: { width: value[0], height: value[1], depth: value[2] } };
          next.outdoorAssetPlacements = placements;
        }
      } else if (operation.target.startsWith("mass:")) {
        const id = operation.target.slice(5), index = next.document.massing.masses.findIndex((m) => m.id === id);
        if (index < 0 || operation.op === "move" && value[1] !== 0) errors.push(`${operation.op} cannot resolve ${operation.target}.`);
        else { const masses = [...next.document.massing.masses], m = masses[index]; masses[index] = operation.op === "move" ? { ...m, position: { x: value[0], z: value[2] } } : operation.op === "rotate" ? { ...m, rotation: value[1] } : { ...m, width: value[0], height: value[1], depth: value[2] }; next.document = { ...next.document, massing: { ...next.document.massing, masses } }; }
      } else if (operation.target.startsWith("part:") && operation.op === "resize") {
        const at = partAt(next.document, operation.target);
        if (!at) errors.push(`resize targets nonexistent ${operation.target}.`);
        else {
          const masses = [...next.document.massing.masses], mass = masses[at.mass], assemblies = [...(mass.assemblies ?? [])], assembly = assemblies[at.assembly], parts = [...assembly.parts], part = parts[at.part];
          if (part.type === "slab") parts[at.part] = { ...part, depth: value[2], thickness: value[1] };
          else if (part.type === "post") parts[at.part] = { ...part, size: value[0], height: value[1], depth: value[2] };
          else if (part.type === "beam") parts[at.part] = { ...part, thickness: value[2], height: value[1] };
          else parts[at.part] = { ...part, thickness: value[2], height: value[1] };
          assemblies[at.assembly] = { ...assembly, parts }; masses[at.mass] = { ...mass, assemblies }; next.document = { ...next.document, massing: { ...next.document.massing, masses } };
        }
      } else if (operation.target.startsWith("site:")) {
        const edited = editSiteTarget(next.sitePlan, next.document, operation, errors);
        if (edited) next.sitePlan = edited;
      } else errors.push(`${operation.op} does not support ${operation.target}.`);
    } else if (operation.op === "changeMaterial") {
      if (!materialOk(operation.material)) errors.push(`Invalid material for ${operation.target}.`);
      else if (operation.target.startsWith("mass:") && !next.document.massing.masses.some((m) => `mass:${m.id}` === operation.target)) errors.push(`Material targets nonexistent ${operation.target}.`);
      else if (operation.target.startsWith("scene:") && !(next.document.sceneObjects ?? []).some((o) => `scene:${o.id}` === operation.target)) errors.push(`Material targets nonexistent ${operation.target}.`);
      else if (operation.target.startsWith("asset:")) {
        const id = operation.target.slice(6), index = (next.outdoorAssetPlacements ?? []).findIndex((p) => p.id === id);
        if (index < 0) errors.push(`Material targets nonexistent ${operation.target}.`);
        else { const placements = [...(next.outdoorAssetPlacements ?? [])]; placements[index] = { ...placements[index], material: clone(operation.material) }; next.outdoorAssetPlacements = placements; }
      }
      else next.document = { ...next.document, materialOverrides: [...(next.document.materialOverrides ?? []).filter((m) => m.target !== operation.target), { target: operation.target, material: clone(operation.material) }] };
    } else if (operation.op === "attach" || operation.op === "detach") {
      const id = operation.target.slice(6), index = (next.document.sceneObjects ?? []).findIndex((o) => o.id === id);
      if (index < 0) errors.push(`${operation.op} targets nonexistent ${operation.target}.`);
      else {
        const host = operation.op === "attach" ? operation.host : undefined;
        if (host?.kind === "mass" && !next.document.massing.masses.some((m) => m.id === host.massId)) errors.push(`Attach references unknown host mass ${host.massId}.`);
        else { const objects = [...(next.document.sceneObjects ?? [])]; objects[index] = operation.op === "attach" ? { ...objects[index], host: clone(operation.host) } : { ...objects[index], host: { kind: "world" } }; next.document = { ...next.document, sceneObjects: objects }; }
      }
    } else if (operation.op === "duplicate") {
      const id = operation.target.slice(6), source = (next.document.sceneObjects ?? []).find((o) => o.id === id);
      if (!source) errors.push(`Duplicate targets nonexistent ${operation.target}.`);
      else if ((next.document.sceneObjects ?? []).some((o) => o.id === operation.id)) errors.push(`Duplicate id ${operation.id} already exists.`);
      else next.document = { ...next.document, sceneObjects: [...(next.document.sceneObjects ?? []), { ...clone(source), id: operation.id, position: operation.position ?? source.position }] };
    } else if (operation.op === "extrude" || operation.op === "cut") {
      needs.push({ capability: operation.op, reason: operation.intent });
    } else errors.push("Unknown scene operation.");
  }
  if (errors.length) return fail();
  errors.push(...validateArchitecturalDesignDocument(next.document));
  // SitePlan schema/integrity remains owned by the existing reflow gate; this executor only applies targeted data.
  if (errors.length) return fail();
  return { ok: true, document: next.document, sitePlan: next.sitePlan, outdoorAssetPlacements: [...(next.outdoorAssetPlacements ?? [])], outdoorAssetTombstones: [...(next.outdoorAssetTombstones ?? [])], errors: [], capabilityNeeds: needs };
}

/** Builds the authoritative target catalog used verbatim by planning and execution. */
export function targetCatalog(state: Pick<SceneEditState, "document" | "sitePlan" | "outdoorAssetPlacements">): TargetCatalogEntry[] {
  const masses = state.document.massing.masses.flatMap((mass) => {
    const massEntry: TargetCatalogEntry = {
      id: `mass:${mass.id}`, kind: "mass", semanticType: "mass", label: mass.role, persistentReference: mass.id,
      transform: { position: [mass.position.x, 0, mass.position.z], rotation: [0, mass.rotation, 0], dimensions: [mass.width, mass.height ?? 0, mass.depth] },
      capabilities: ["move", "rotate", "resize", "changeMaterial", "extrude", "cut"],
    };
    const assemblies = (mass.assemblies ?? []).flatMap((assembly) => {
      const assemblyEntry: TargetCatalogEntry = {
        id: `assembly:${mass.id}:${assembly.id}`, kind: "assembly", semanticType: "assembly", label: assembly.intent, persistentReference: `${mass.id}:${assembly.id}`,
        capabilities: ["delete", "extrude", "cut"],
      };
      const parts = assembly.parts.map((part) => ({
        id: `part:${mass.id}:${assembly.id}:${part.id}` as SceneTarget, kind: "part" as const, semanticType: part.type, label: part.type,
        persistentReference: `${mass.id}:${assembly.id}:${part.id}`, capabilities: ["resize", "extrude", "cut"] as const,
      } satisfies TargetCatalogEntry));
      return [assemblyEntry, ...parts];
    });
    return [massEntry, ...assemblies];
  });
  const scenes = (state.document.sceneObjects ?? []).map((object) => ({
    id: `scene:${object.id}` as SceneTarget, kind: "scene" as const, semanticType: object.kind, label: object.label, persistentReference: object.id,
    transform: { position: object.position, rotation: object.rotation ?? [0, 0, 0], dimensions: object.size }, host: object.host, hostOrSupport: object.host, material: object.material,
    capabilities: ["delete", "move", "rotate", "resize", "changeMaterial", "attach", "detach", "duplicate", "extrude", "cut"] as const,
  } satisfies TargetCatalogEntry));
  const assets = (state.outdoorAssetPlacements ?? []).map((asset) => ({
    id: `asset:${asset.id}` as SceneTarget, kind: "asset" as const, semanticType: "asset", label: asset.role, persistentReference: asset.id,
    transform: { position: asset.position, rotation: asset.rotation, scale: asset.scale, dimensions: [asset.dimensions.width, asset.dimensions.height, asset.dimensions.depth] },
    host: asset.support ?? asset.relationship, hostOrSupport: asset.support ?? asset.relationship,
    source: { assetId: asset.assetId, kind: asset.proxy?.objectType ?? asset.category }, material: asset.material,
    // A support surface is not a structural attachment. Moving an asset updates
    // its support metadata through groundPlacement; detach is intentionally not
    // meaningful for it.
    capabilities: ["delete", "move", "rotate", "resize", "changeMaterial", "extrude", "cut"] as const,
  } satisfies TargetCatalogEntry));
  const groups = [...new Map((state.outdoorAssetPlacements ?? [])
    .filter((asset) => asset.group)
    .map((asset) => [asset.group!.id, asset.group!] as const)).entries()]
    .map(([id, group]) => ({
      id: `asset-group:${id}` as SceneTarget, kind: "asset-group" as const, semanticType: "asset-group", label: group.role ?? "asset group", persistentReference: id,
      transform: { position: group.anchor, rotation: group.rotation },
      capabilities: ["move", "rotate"] as const,
    } satisfies TargetCatalogEntry));
  const sites = [...sitePlanElements(state.sitePlan).entries()].map(([id, value]) => ({
    id: id as SceneTarget, kind: "site" as const, semanticType: "site", label: id, persistentReference: id, context: value,
    capabilities: ["move", "rotate", "resize", "extrude", "cut"] as const,
  } satisfies TargetCatalogEntry));
  return [...masses, ...scenes, ...assets, ...groups, ...sites].sort((a, b) => a.id.localeCompare(b.id));
}

export const sceneOperationTargets = (state: Pick<SceneEditState, "document" | "sitePlan" | "outdoorAssetPlacements">): string[] => targetCatalog(state).map((target) => target.id);

/** Semantic edit context for the Architect. It intentionally contains no renderer instances or ephemeral state. */
export function editableSceneTargets(state: Pick<SceneEditState, "document" | "sitePlan" | "outdoorAssetPlacements">): EditableSceneTarget[] {
  return targetCatalog(state).filter((target) => target.kind !== "site");
}
