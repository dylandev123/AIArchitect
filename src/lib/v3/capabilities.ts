import type { HousePrimitive, PrimitiveCategory } from "@/lib/house/types";
import type { V3GeometryKind, V3Material, V3Scene, V3SceneObject, V3TerrainSurface } from "./scene";
import { v3CompileKit } from "./scene";
import { compileArchitecturalGlazing, compileVeranda } from "./construction";
import { roofHostId } from "./compositionPolicies";
import { v3StoreyBase } from "./stacking";
import type { V3Door, V3Partition, V3Room, V3Storey } from "./interior";

/**
 * The single authority for what each *known* V3 compiler type can do. Adding a type means registering it here
 * once: dispatch, category, renderability, validation behaviour, metrics and dependencies all read this table.
 *
 * It is a capability registry, not a noun whitelist. Unregistered semantic types are valid authoring and still
 * render through the generic/proxy fallback in `resolveV3Renderable` / `compileV3Scene`.
 */
export interface V3CompileContext {
  /** Effective scene: canonical runtime geometry plus derived (non-persisted) support. */
  scene: V3Scene;
  terrain: V3TerrainSurface;
  roofOverhangs: ReadonlyMap<string, number>;
  roofMaterial: V3Material;
  connectionSurfaceIds: ReadonlySet<string>;
  /** Masses whose roof is an authored walkable terrace (decided from authored, never derived, support). */
  rooftopTerraceHosts?: ReadonlySet<string>;
}
export interface V3CapabilityValidation {
  /** Compiled geometry legitimately differs from the authored box (terrain-following, hollow shells, ribbons). */
  compiledBoundsExempt?: boolean;
  /** Required compiled shape, checked by `validateV3CompiledGeometry`. */
  compiledShape?: "path-ribbon" | "terrain-following";
  /** The object is incomplete without a `terrain` operation. */
  requiresTerrainOperation?: boolean;
  /** Authored `levels` are checked against what the height can fit. */
  levelsBoundedByHeight?: boolean;
  /** Overlaps with other objects of the same type are reported as advisories. */
  overlapAdvisory?: boolean;
}
/**
 * Physical support behaviour. supportGraph, elevation and siteHierarchy read these flags instead of keeping their
 * own type lists. Every flag defaults to false/absent, which is the behaviour of an unregistered semantic type.
 */
export interface V3SupportCapability {
  /** Support kind recorded on objects resting on this type (default "object"). */
  surfaceKind?: "roof" | "slab" | "terrace";
  /** Can bear other objects in geometry-only support inference. */
  structural?: boolean;
  /** Walkable in support classification. */
  walkable?: boolean;
  /** Its top plane is the walking surface (`getWalkableSurfaceY`). */
  walkingSurface?: boolean;
  /** Occupiable: the site audit requires its support to resolve to a site level. */
  occupiable?: boolean;
  /** Never needs support in inference (non-physical or self-grounding). */
  inert?: boolean;
  /** Not required to meet a support surface in the site audit (facade/frame/overhead parts). */
  auditExempt?: boolean;
  /** Hosted along an edge rather than resting on a footprint. */
  edgeHosted?: boolean;
  /** Spans two supports (stair/ramp). */
  verticalConnector?: boolean;
  /** Flattens the terrain under its footprint when ground-bearing. */
  groundPad?: boolean;
  /** An existing structure that keeps an overlapping slab from becoming a ground pad. */
  padHost?: boolean;
  /** Host class other types can name in `hostedBy`. */
  hostClass?: V3HostClass;
  /** Architectural host classes this type may be supported by; [] = terrain only. Absent = any host. */
  hostedBy?: readonly V3HostClass[];
  /** Support follows deterministic architectural policy rather than authored hints. */
  deterministic?: boolean;
  /** Only an architectural host (never a bare level or terrain) can support it. */
  requiresHost?: boolean;
  /** Host inference picks the best `hostedBy` host by footprint (resting) or by facade contact (attached). */
  specializedHost?: "resting" | "attached";
  /** A freestanding asset that may settle onto terrain from a larger vertical gap. */
  settleable?: boolean;
}
export type V3HostClass = "mass" | "ground" | "wall" | "pool";
export interface V3CapabilityMetrics { mass?: boolean; roof?: (object: V3SceneObject) => boolean; coveredOutdoor?: boolean; siteAmenity?: boolean; landscape?: boolean; }
export interface V3Capability {
  /** Renderer primitive category; unregistered types default to "building". */
  category?: PrimitiveCategory;
  /** Specialized types own a construction compiler; generic types are known but use generic geometry. */
  renderability: "specialized" | "generic";
  /** Optional per-object gate for specialization (e.g. terrain regions need an operation). */
  specializedWhen?: (object: V3SceneObject) => boolean;
  /** Structural geometry implied by the type when no explicit geometryKind is authored. */
  geometryHint?: V3GeometryKind;
  /** Returns primitives, or `undefined` to defer to generic geometry. */
  compile?: (object: V3SceneObject, context: V3CompileContext) => HousePrimitive[] | undefined;
  validation?: V3CapabilityValidation;
  metrics?: V3CapabilityMetrics;
  support?: V3SupportCapability;
  /**
   * Other object ids whose authored data can change this object's compiled output. Extension point for future
   * scoped recompilation; nothing caches on it yet. Shared terrain is implicit and not listed.
   */
  dependsOn?: (object: V3SceneObject, scene: V3Scene) => string[];
}

const ids = (scene: V3Scene, keep: (object: V3SceneObject) => boolean, self: V3SceneObject) => scene.objects.filter((object) => object.id !== self.id && keep(object)).map((object) => object.id);
/** Roof clearance (eave trimming) and the composition roof material couple every mass and roof form. */
const roofComposition = (object: V3SceneObject, scene: V3Scene) => ids(scene, (candidate) => candidate.type === "building-mass" || candidate.type === "roof-form", object);
/** A walking surface is cut by any pool it overlaps. */
const poolCutouts = (object: V3SceneObject, scene: V3Scene) => ids(scene, (candidate) => (candidate.type === "pool" || candidate.type === "fountain"), object);
const deckOrGeneric = (object: V3SceneObject, context: V3CompileContext) => v3CompileKit.compilePoolDeck(object, context.scene);
const terrainLineValidation: V3CapabilityValidation = { compiledBoundsExempt: true, compiledShape: "terrain-following" };

const BUILTIN: Record<string, V3Capability> = {
  "veranda": { renderability: "specialized", compile: (o, { scene }) => compileVeranda(o, scene) },
  "building-mass": {
    renderability: "specialized",
    // The implicit roof yields to an explicit roof-form, or to an authored walkable terrace resting on the roof.
    // A stacked mass resolves its storeys against the building, so its "upper" openings land on its own floors.
    compile: (o, { scene, roofOverhangs, roofMaterial, rooftopTerraceHosts }) => v3CompileKit.compileBuildingMass(o, !scene.objects.some((candidate) => candidate.type === "roof-form" && (candidate.hostId === o.id || candidate.support?.hostId === o.id || candidate.support?.objectId === o.id)) && !rooftopTerraceHosts?.has(o.id), roofOverhangs.get(o.id), roofMaterial, v3StoreyBase(o, scene), scene),
    validation: { levelsBoundedByHeight: true },
    metrics: { mass: true, roof: (o) => !!o.roofForm },
    dependsOn: roofComposition,
    support: { structural: true, groundPad: true, padHost: true, hostClass: "mass", hostedBy: ["ground"], deterministic: true },
  },
  "roof-form": {
    category: "roof", renderability: "specialized",
    compile: (o, { scene, roofOverhangs }) => v3CompileKit.compileRoofForm(o, scene, roofOverhangs.get(o.id)),
    metrics: { roof: () => true },
    dependsOn: (o, scene) => [...new Set([...roofComposition(o, scene), ...[roofHostId(o)].filter((id): id is string => !!id && id !== o.id)])],
    support: { surfaceKind: "roof", structural: true, padHost: true, hostedBy: ["mass"], deterministic: true, requiresHost: true, specializedHost: "resting" },
  },
  "pool": { category: "pool", renderability: "specialized", geometryHint: "water", compile: (o) => v3CompileKit.compilePool(o), validation: { compiledBoundsExempt: true }, metrics: { siteAmenity: true }, support: { occupiable: true, groundPad: true, hostClass: "pool", deterministic: true } },
  "fountain": { category: "pool", renderability: "specialized", geometryHint: "water", compile: (o, { scene }) => v3CompileKit.compileShapedSiteFeature(o, scene), validation: { compiledBoundsExempt: true }, metrics: { siteAmenity: true }, support: { hostedBy: [], deterministic: true } },
  "balcony": { renderability: "specialized", geometryHint: "slab", compile: (o) => v3CompileKit.compileBalcony(o), metrics: { coveredOutdoor: true, siteAmenity: true }, support: { hostedBy: ["mass", "wall"], deterministic: true, requiresHost: true, specializedHost: "attached" } },
  "terrace": { category: "floor", renderability: "specialized", geometryHint: "slab", compile: (o, context) => deckOrGeneric(o, context) ?? v3CompileKit.compileTerraceSurface(o), metrics: { coveredOutdoor: true, siteAmenity: true }, dependsOn: poolCutouts, support: { surfaceKind: "terrace", structural: true, groundPad: true, padHost: true, hostClass: "ground" } },
  "courtyard": { category: "floor", renderability: "specialized", compile: (o) => v3CompileKit.compileCourtyard(o), metrics: { siteAmenity: true }, support: { surfaceKind: "terrace", structural: true, groundPad: true, hostClass: "ground" } },
  "landscape-zone": { category: "landscape", renderability: "specialized", compile: (o) => v3CompileKit.compileLandscapeZone(o), metrics: { landscape: true }, support: { hostedBy: [], deterministic: true } },
  "planter": { category: "floor", renderability: "specialized", compile: (o) => v3CompileKit.compileLandscapeZone(o), metrics: { landscape: true }, support: { hostedBy: [], deterministic: true } },
  "glass-wall": { renderability: "specialized", compile: (o) => compileArchitecturalGlazing(o) },
  "window-band": { renderability: "specialized", compile: (o) => compileArchitecturalGlazing(o) },
  "column-line": { renderability: "specialized", compile: (o) => v3CompileKit.compileColumnLine(o) },
  "railing-run": { renderability: "specialized", compile: (o) => v3CompileKit.compileRailingRun(o) },
  "canopy": { category: "roof", renderability: "specialized", compile: (o) => v3CompileKit.compileCanopy(o), metrics: { coveredOutdoor: true, siteAmenity: true }, support: { structural: true, auditExempt: true, hostedBy: ["mass", "ground", "wall"], deterministic: true, specializedHost: "resting" } },
  "driveway": { renderability: "specialized", specializedWhen: o => !!o.composition?.footprint, geometryHint: "path", compile: (o, { scene }) => v3CompileKit.compileShapedSiteFeature(o, scene), dependsOn: poolCutouts },
  "path": {
    category: "path", renderability: "specialized", geometryHint: "path",
    compile: (o, { terrain, connectionSurfaceIds }) => connectionSurfaceIds.has(o.id) ? [] : [v3CompileKit.part(o, "path surface", v3CompileKit.pathRibbon(o, terrain))],
    validation: { compiledBoundsExempt: true, compiledShape: "path-ribbon" },
    support: { surfaceKind: "terrace", structural: true, walkable: true, occupiable: true },
  },
  "retaining-wall": { category: "retainingWall", renderability: "specialized", compile: (o, { terrain }) => v3CompileKit.terrainLine(o, terrain, true), validation: terrainLineValidation },
  "fence": { category: "wall", renderability: "specialized", compile: (o, { terrain }) => v3CompileKit.terrainLine(o, terrain, false), validation: terrainLineValidation, support: { edgeHosted: true } },
  "terrain-region": {
    category: "landscape", renderability: "specialized", specializedWhen: (o) => !!o.terrain,
    // Terrain intent is compiled once into the shared heightfield, not per object.
    compile: (o) => o.terrain ? [] : undefined,
    validation: { compiledBoundsExempt: true, requiresTerrainOperation: true },
    support: { inert: true, auditExempt: true },
  },
  "stair": { category: "stairs", renderability: "specialized", compile: (o) => v3CompileKit.compileConnector(o), support: { walkable: true, walkingSurface: true, occupiable: true, verticalConnector: true } },
  "ramp": { category: "stairs", renderability: "specialized", compile: (o) => v3CompileKit.compileConnector(o), support: { walkable: true, walkingSurface: true, occupiable: true, verticalConnector: true } },
  // Known generic types: understood by the compiler, rendered with generic geometry.
  "volume": { renderability: "generic", validation: { overlapAdvisory: true }, metrics: { mass: true }, support: { structural: true, groundPad: true, padHost: true, hostClass: "mass", hostedBy: ["ground"] } },
  "wall": { category: "wall", renderability: "generic", support: { structural: true, auditExempt: true, hostClass: "wall" } },
  "slab": { category: "floor", renderability: "generic", geometryHint: "slab", compile: deckOrGeneric, dependsOn: poolCutouts, support: { surfaceKind: "slab", structural: true, walkable: true, walkingSurface: true, occupiable: true, groundPad: true, padHost: true, hostClass: "ground" } },
  "surface": { category: "floor", renderability: "generic", geometryHint: "slab", compile: deckOrGeneric, dependsOn: poolCutouts, support: { surfaceKind: "terrace", structural: true, walkable: true, walkingSurface: true, occupiable: true, groundPad: true, padHost: true, hostClass: "ground" } },
  "glass-panel": { category: "window", renderability: "generic", support: { inert: true, auditExempt: true } },
  "opening": { category: "window", renderability: "generic", support: { inert: true, auditExempt: true } },
  "column": { renderability: "generic", support: { structural: true, auditExempt: true } },
  "beam": { renderability: "generic", support: { structural: true, auditExempt: true } },
  "railing": { renderability: "generic", support: { edgeHosted: true } },
  "roof": { category: "roof", renderability: "generic", support: { surfaceKind: "roof", structural: true, walkingSurface: true, auditExempt: true, padHost: true, hostedBy: ["mass"], requiresHost: true, specializedHost: "resting" } },
  "water-surface": { category: "pool", renderability: "generic", geometryHint: "water", support: { groundPad: true, hostedBy: ["pool"], deterministic: true, requiresHost: true, specializedHost: "resting" } },
  "proxy-asset": { renderability: "generic", geometryHint: "proxy", support: { settleable: true } },
  "native-asset": { renderability: "generic", geometryHint: "proxy", support: { settleable: true } },
  "light": { renderability: "generic", support: { inert: true, auditExempt: true } },
  "gate": { category: "wall", renderability: "generic", support: { settleable: true } },
};

const registry = new Map<string, V3Capability>(Object.entries(BUILTIN));

export const v3Capability = (type: unknown): V3Capability | undefined => typeof type === "string" ? registry.get(type) : undefined;
export const isKnownV3CompilerType = (type: unknown): type is string => v3Capability(type) !== undefined;
export const v3CategoryFor = (type: unknown): PrimitiveCategory => v3Capability(type)?.category ?? "building";
export const v3SupportCapability = (type: unknown): V3SupportCapability => v3Capability(type)?.support ?? {};
/** `deck` predates the registry and was only ever a support-host alias for ground surfaces; it stays unregistered. */
export const v3HostClassOf = (type: unknown): V3HostClass | undefined => v3SupportCapability(type).hostClass ?? (type === "deck" ? "ground" : undefined);
export const v3TypesWith = (predicate: (capability: V3Capability) => boolean): string[] => [...registry].flatMap(([type, capability]) => predicate(capability) ? [type] : []);

/** Registers (or replaces) one capability; returns an undo. Built-ins are registered above. */
export function registerV3Capability(type: string, capability: V3Capability): () => void {
  const previous = registry.get(type);
  registry.set(type, capability);
  return () => { if (previous) registry.set(type, previous); else registry.delete(type); };
}

/**
 * Semantic interior datums share the dependency registry. They are not compiled, so nothing depends on them; they
 * depend on what anchors them (a storey on its host mass, a room on its storey and host mass, a partition on its
 * storey and rooms, a door on its partition).
 */
export interface V3DatumCapabilities {
  storey: { dependsOn: (storey: V3Storey, scene: V3Scene) => string[] };
  room: { dependsOn: (room: V3Room, scene: V3Scene) => string[] };
  partition: { dependsOn: (partition: V3Partition, scene: V3Scene) => string[] };
  door: { dependsOn: (door: V3Door, scene: V3Scene) => string[] };
}
const DATUMS: V3DatumCapabilities = {
  storey: { dependsOn: (storey) => [storey.hostMassId] },
  room: { dependsOn: (room) => [room.storeyId, room.hostMassId] },
  partition: { dependsOn: (partition) => [partition.storeyId, partition.roomAId, ...(partition.roomBId ? [partition.roomBId] : [])] },
  door: { dependsOn: (door) => [door.partitionId] },
};
export const v3StoreyDependencies = (storey: V3Storey, scene: V3Scene) => DATUMS.storey.dependsOn(storey, scene);
export const v3RoomDependencies = (room: V3Room, scene: V3Scene) => DATUMS.room.dependsOn(room, scene);
export const v3PartitionDependencies = (partition: V3Partition, scene: V3Scene) => DATUMS.partition.dependsOn(partition, scene);
export const v3DoorDependencies = (door: V3Door, scene: V3Scene) => DATUMS.door.dependsOn(door, scene);

/** Every declared dependency edge (id → ids it reads), objects and interior datums alike. */
export function v3DependencyGraph(scene: V3Scene): Map<string, string[]> {
  const graph = new Map<string, string[]>(scene.objects.map((object) => [object.id, v3ObjectDependencies(object, scene)]));
  for (const storey of scene.interior?.storeys ?? []) graph.set(storey.id, v3StoreyDependencies(storey, scene));
  for (const room of scene.interior?.rooms ?? []) graph.set(room.id, v3RoomDependencies(room, scene));
  for (const partition of scene.interior?.partitions ?? []) graph.set(partition.id, v3PartitionDependencies(partition, scene));
  for (const door of scene.interior?.doors ?? []) graph.set(door.id, v3DoorDependencies(door, scene));
  return graph;
}

/** Ids whose output can change when `id` changes (transitive reverse dependencies, excluding `id`). */
export function v3Dependents(scene: V3Scene, id: string): Set<string> {
  const graph = v3DependencyGraph(scene), result = new Set<string>(), queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const [candidate, deps] of graph) if (deps.includes(current) && candidate !== id && !result.has(candidate)) { result.add(candidate); queue.push(candidate); }
  }
  return result;
}

/** Declared cross-object inputs for one object; empty when its type declares none. */
export function v3ObjectDependencies(object: V3SceneObject, scene: V3Scene): string[] {
  return v3Capability(object.type)?.dependsOn?.(object, scene) ?? [];
}
