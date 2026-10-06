import type { V3Material, V3ObjectType, V3Scene, V3SceneObject, V3Transform, Vec3 } from "./scene";
import type { V3SiteConnection, V3SiteHierarchy, V3SiteLevel, V3SiteTransition, V3SupportRef } from "./siteHierarchy";

/**
 * Deliberately narrow, non-persistent recovery for a provider response which was
 * JSON but did not meet Terra's strict output contract. This is never used by
 * validation, operations, or project persistence.
 */
export interface V3FailedPreviewDiagnostics {
  strictValidationErrors: string[];
  skippedObjectIds: string[];
  skippedRelationshipIds: string[];
  unsupportedObjectIds: string[];
  normalizedFields: string[];
}

export interface V3FailedPreview {
  scene: V3Scene;
  diagnostics: V3FailedPreviewDiagnostics;
}

type RecordValue = Record<string, unknown>;
const OBJECT_TYPES: readonly V3ObjectType[] = ["volume", "wall", "slab", "surface", "glass-panel", "opening", "column", "beam", "railing", "stair", "ramp", "roof", "canopy", "path", "retaining-wall", "fence", "gate", "terrain-region", "pool", "water-surface", "proxy-asset", "native-asset", "light"];
const COLLISIONS = new Set(["solid", "walkable", "passable", "water", "none"]);
const SURFACES = new Set(["concrete", "stone", "wood", "glass", "metal", "stucco", "paving", "water", "grass"]);
const SUPPORT_KINDS = new Set(["terrain", "pad", "terrace", "slab", "deck", "roof", "object"]);
const SUPPORT_RELATIONSHIPS = new Set(["rests-on", "attached-to", "edge-hosted", "terrain-following", "embedded-in", "cantilevered-from", "suspended-from"]);
const GROUNDINGS = new Set(["grounded", "embedded", "floating", "suspended", "cantilevered"]);
const CONNECTION_TYPES = new Set(["driveway", "path", "stair", "ramp"]);
const TRANSITION_TYPES = new Set(["natural-slope", "graded-slope", "retaining-edge", "stair", "ramp"]);
const SUPPORT_TYPES = new Set(["terrain", "pad", "terrace", "slab", "deck", "roof", "object"]);
const RELATIONSHIP_KINDS = new Set(["supports", "contains", "aligns", "connects", "hosts"]);
const ID = /^[a-z][a-z0-9-]{1,63}$/;

const isRecord = (value: unknown): value is RecordValue => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const string = (value: unknown, max = 100): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const id = (value: unknown): value is string => typeof value === "string" && ID.test(value);
const vector = (value: unknown, positive = false): value is Vec3 => Array.isArray(value) && value.length === 3 && value.every(finite) && (!positive || value.every((n) => n > 0));

function materialOf(value: unknown): V3Material | undefined {
  if (!isRecord(value) || !string(value.id, 48) || typeof value.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.color)) return undefined;
  if ([value.roughness, value.metalness, value.opacity].some((number) => number !== undefined && (!finite(number) || number < 0 || number > 1))) return undefined;
  if (value.surface !== undefined && (typeof value.surface !== "string" || !SURFACES.has(value.surface))) return undefined;
  return {
    id: value.id,
    color: value.color,
    ...(finite(value.roughness) ? { roughness: value.roughness } : {}),
    ...(finite(value.metalness) ? { metalness: value.metalness } : {}),
    ...(finite(value.opacity) ? { opacity: value.opacity } : {}),
    ...(typeof value.surface === "string" && SURFACES.has(value.surface) ? { surface: value.surface as V3Material["surface"] } : {}),
  };
}

function transformOf(value: unknown): V3Transform | undefined {
  if (!isRecord(value) || !vector(value.position) || !vector(value.rotation) || !vector(value.scale, true)) return undefined;
  return { position: value.position, rotation: value.rotation, scale: value.scale };
}

function metadataOf(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!isRecord(value)) return undefined;
  const metadata: Record<string, string | number | boolean> = {};
  for (const [key, candidate] of Object.entries(value)) if (typeof candidate === "string" || typeof candidate === "boolean" || finite(candidate)) metadata[key] = candidate;
  return Object.keys(metadata).length ? metadata : undefined;
}

function objectOf(value: unknown, index: number, diagnostics: V3FailedPreviewDiagnostics): V3SceneObject | undefined {
  const objectId = isRecord(value) && typeof value.id === "string" ? value.id : `object-${index}`;
  if (!isRecord(value) || !id(value.id) || typeof value.type !== "string" || !OBJECT_TYPES.includes(value.type as V3ObjectType) || !vector(value.dimensions, true)) {
    diagnostics.skippedObjectIds.push(objectId);
    return undefined;
  }
  const transform = transformOf(value.transform), material = materialOf(value.material);
  if (!transform || !material) {
    diagnostics.skippedObjectIds.push(objectId);
    return undefined;
  }
  if (!string(value.semanticRole, 80) || !string(value.label, 100)) diagnostics.normalizedFields.push(`${value.id}: filled missing semanticRole/label for preview`);
  const object: V3SceneObject = {
    id: value.id,
    type: value.type as V3ObjectType,
    semanticRole: string(value.semanticRole, 80) ? value.semanticRole : value.type,
    label: string(value.label, 100) ? value.label : value.id,
    transform,
    dimensions: value.dimensions,
    material,
    ...(typeof value.collision === "string" && COLLISIONS.has(value.collision) ? { collision: value.collision as V3SceneObject["collision"] } : {}),
    ...(metadataOf(value.metadata) ? { metadata: metadataOf(value.metadata) } : {}),
  };
  if (isRecord(value.terrain) && typeof value.terrain.operation === "string" && ["slopeRegion", "raiseRegion", "lowerRegion", "createTerrace", "cutIntoSlope", "gradePath"].includes(value.terrain.operation)) {
    object.terrain = { operation: value.terrain.operation as NonNullable<V3SceneObject["terrain"]>["operation"], ...(finite(value.terrain.rise) ? { rise: value.terrain.rise } : {}), ...(typeof value.terrain.direction === "string" && ["x", "z", "-x", "-z"].includes(value.terrain.direction) ? { direction: value.terrain.direction as NonNullable<V3SceneObject["terrain"]>["direction"] } : {}) };
  }
  return object;
}

function levelsOf(value: unknown, diagnostics: V3FailedPreviewDiagnostics): V3SiteLevel[] {
  if (!isRecord(value) || !Array.isArray(value.levels)) return [];
  const levels: V3SiteLevel[] = [];
  for (const [index, candidate] of value.levels.entries()) {
    if (!isRecord(candidate) || !id(candidate.id) || !finite(candidate.elevation) || !isRecord(candidate.region) || !finite(candidate.region.x) || !finite(candidate.region.z) || !finite(candidate.region.width) || candidate.region.width <= 0 || !finite(candidate.region.depth) || candidate.region.depth <= 0 || (candidate.region.rotation !== undefined && !finite(candidate.region.rotation)) || typeof candidate.supportType !== "string" || !SUPPORT_TYPES.has(candidate.supportType)) {
      diagnostics.normalizedFields.push(`siteHierarchy.levels.${index}: skipped malformed level`);
      continue;
    }
    levels.push({ id: candidate.id, elevation: candidate.elevation, region: { x: candidate.region.x, z: candidate.region.z, width: candidate.region.width, depth: candidate.region.depth, ...(finite(candidate.region.rotation) ? { rotation: candidate.region.rotation } : {}) }, supportType: candidate.supportType as V3SiteLevel["supportType"], ...(string(candidate.role, 80) ? { role: candidate.role } : {}), ...(candidate.access === "entry" || candidate.access === "arrival" ? { access: candidate.access } : {}) });
  }
  return levels.filter((level, index, all) => all.findIndex((candidate) => candidate.id === level.id) === index);
}

function normalizedRoute(value: unknown, from: V3SiteLevel, to: V3SiteLevel): { route: [number, number, number][]; normalized: boolean } | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 24) return undefined;
  if (value.every((point) => Array.isArray(point) && point.length === 3 && point.every(finite))) return { route: value as [number, number, number][], normalized: false };
  if (!value.every((point) => Array.isArray(point) && point.length === 2 && point.every(finite))) return undefined;
  const route2 = value as [number, number][];
  const distances = route2.map((point, index) => index ? Math.hypot(point[0] - route2[index - 1][0], point[1] - route2[index - 1][1]) : 0);
  const total = distances.reduce((sum, distance) => sum + distance, 0);
  let walked = 0;
  return { normalized: true, route: route2.map((point, index) => { walked += distances[index]; return [point[0], from.elevation + (to.elevation - from.elevation) * (total ? walked / total : 0), point[1]]; }) };
}

function hierarchyOf(value: unknown, objectIds: Set<string>, diagnostics: V3FailedPreviewDiagnostics): V3SiteHierarchy | undefined {
  const levels = levelsOf(value, diagnostics);
  if (!levels.length) return undefined;
  const levelIds = new Map(levels.map((level) => [level.id, level]));
  const connections: V3SiteConnection[] = [];
  const rawConnections = isRecord(value) && Array.isArray(value.connections) ? value.connections : [];
  for (const [index, candidate] of rawConnections.entries()) {
    const connectionId = isRecord(candidate) && typeof candidate.id === "string" ? candidate.id : `connection-${index}`;
    if (!isRecord(candidate) || !id(candidate.id) || !id(candidate.fromLevelId) || !id(candidate.toLevelId) || typeof candidate.type !== "string" || !CONNECTION_TYPES.has(candidate.type) || !finite(candidate.width) || candidate.width <= 0 || candidate.width > 30) {
      diagnostics.normalizedFields.push(`${connectionId}: skipped malformed hierarchy connection`);
      continue;
    }
    const from = levelIds.get(candidate.fromLevelId), to = levelIds.get(candidate.toLevelId), route = from && to ? normalizedRoute(candidate.route, from, to) : undefined;
    if (!from || !to || !route) { diagnostics.normalizedFields.push(`${connectionId}: skipped route with unknown levels or unsafe tuple shape`); continue; }
    if (route.normalized) diagnostics.normalizedFields.push(`${connectionId}: normalized legacy [x,z] route points to [x,y,z]`);
    connections.push({ id: candidate.id, fromLevelId: candidate.fromLevelId, toLevelId: candidate.toLevelId, type: candidate.type as V3SiteConnection["type"], route: route.route, width: candidate.width, ...(finite(candidate.maxGrade) && candidate.maxGrade > 0 && candidate.maxGrade <= 1 ? { maxGrade: candidate.maxGrade } : {}), ...(id(candidate.surfaceObjectId) && objectIds.has(candidate.surfaceObjectId) ? { surfaceObjectId: candidate.surfaceObjectId } : {}) });
  }
  const transitions: V3SiteTransition[] = [];
  const rawTransitions = isRecord(value) && Array.isArray(value.transitions) ? value.transitions : [];
  for (const [index, candidate] of rawTransitions.entries()) {
    const transitionId = isRecord(candidate) && typeof candidate.id === "string" ? candidate.id : `transition-${index}`;
    if (!isRecord(candidate) || !id(candidate.id) || !id(candidate.fromLevelId) || !id(candidate.toLevelId) || !levelIds.has(candidate.fromLevelId) || !levelIds.has(candidate.toLevelId) || typeof candidate.type !== "string" || !TRANSITION_TYPES.has(candidate.type) || (candidate.objectId !== undefined && (!id(candidate.objectId) || !objectIds.has(candidate.objectId)))) { diagnostics.normalizedFields.push(`${transitionId}: skipped malformed hierarchy transition`); continue; }
    transitions.push({ id: candidate.id, fromLevelId: candidate.fromLevelId, toLevelId: candidate.toLevelId, type: candidate.type as V3SiteTransition["type"], ...(id(candidate.objectId) ? { objectId: candidate.objectId } : {}) });
  }
  return { levels, connections, ...(transitions.length ? { transitions } : {}) };
}

function supportOf(value: unknown, objectIds: Set<string>, levelIds: Set<string>): V3SupportRef | undefined {
  if (!isRecord(value) || typeof value.kind !== "string" || !SUPPORT_KINDS.has(value.kind)) return undefined;
  const hasHost = id(value.hostId) && objectIds.has(value.hostId);
  const hasObject = id(value.objectId) && objectIds.has(value.objectId);
  const hostId = hasHost ? value.hostId as string : undefined;
  const objectId = hasObject ? value.objectId as string : undefined;
  const relationship = typeof value.relationship === "string" && SUPPORT_RELATIONSHIPS.has(value.relationship) ? value.relationship : undefined;
  // A host-dependent relationship is unsafe without a valid host. Keep no misleading relationship in preview.
  if (relationship && relationship !== "terrain-following" && !hasHost && !hasObject) return undefined;
  return { kind: value.kind as V3SupportRef["kind"], ...(id(value.levelId) && levelIds.has(value.levelId) ? { levelId: value.levelId } : {}), ...(objectId ? { objectId } : {}), ...(hostId ? { hostId } : {}), ...(relationship ? { relationship: relationship as V3SupportRef["relationship"] } : {}), ...(typeof value.grounding === "string" && GROUNDINGS.has(value.grounding) ? { grounding: value.grounding as V3SupportRef["grounding"] } : {}) };
}

/** Recover only compiler-safe scene fields. A return value is always non-persisted preview data. */
export function recoverV3FailedPreview(raw: unknown, strictValidationErrors: readonly string[] = []): V3FailedPreview | undefined {
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try { candidate = JSON.parse(raw); } catch { return undefined; }
  }
  if (!isRecord(candidate) || candidate.version !== 3 || !isRecord(candidate.site) || !finite(candidate.site.width) || candidate.site.width <= 0 || candidate.site.width > 1000 || !finite(candidate.site.depth) || candidate.site.depth <= 0 || candidate.site.depth > 1000 || !Array.isArray(candidate.objects)) return undefined;
  const diagnostics: V3FailedPreviewDiagnostics = { strictValidationErrors: [...strictValidationErrors], skippedObjectIds: [], skippedRelationshipIds: [], unsupportedObjectIds: [], normalizedFields: [] };
  const objects = candidate.objects.map((object, index) => objectOf(object, index, diagnostics)).filter((object): object is V3SceneObject => !!object);
  const duplicateIds = new Set<string>();
  const uniqueObjects = objects.filter((object) => duplicateIds.has(object.id) ? (diagnostics.skippedObjectIds.push(object.id), false) : (duplicateIds.add(object.id), true));
  const objectIds = new Set(uniqueObjects.map((object) => object.id));
  const hierarchy = hierarchyOf(candidate.siteHierarchy, objectIds, diagnostics);
  const levelIds = new Set(hierarchy?.levels.map((level) => level.id) ?? []);
  for (const object of uniqueObjects) {
    const rawObject = candidate.objects.find((value) => isRecord(value) && value.id === object.id);
    if (!rawObject) continue;
    const support = supportOf(rawObject.support, objectIds, levelIds);
    if (support) object.support = support;
    else if (rawObject.support !== undefined || !["terrain-region", "light", "opening", "glass-panel", "roof", "canopy", "wall", "column", "beam"].includes(object.type)) {
      diagnostics.unsupportedObjectIds.push(object.id);
      diagnostics.normalizedFields.push(`${object.id}: omitted invalid or missing support metadata`);
    }
    if (id(rawObject.parentId) && objectIds.has(rawObject.parentId)) object.parentId = rawObject.parentId;
    if (id(rawObject.hostId) && objectIds.has(rawObject.hostId)) object.hostId = rawObject.hostId;
    if (id(rawObject.groupId)) object.groupId = rawObject.groupId;
    if (id(rawObject.fromSupportId) && id(rawObject.toSupportId) && (objectIds.has(rawObject.fromSupportId) || levelIds.has(rawObject.fromSupportId)) && (objectIds.has(rawObject.toSupportId) || levelIds.has(rawObject.toSupportId))) { object.fromSupportId = rawObject.fromSupportId; object.toSupportId = rawObject.toSupportId; }
  }
  const relationships: V3Scene["relationships"] = [];
  const rawRelationships = Array.isArray(candidate.relationships) ? candidate.relationships : [];
  for (const [index, relationship] of rawRelationships.entries()) {
    const relationshipId = isRecord(relationship) && typeof relationship.id === "string" ? relationship.id : isRecord(relationship) && typeof relationship.from === "string" && typeof relationship.to === "string" ? `${relationship.from}->${relationship.to}` : `relationship-${index}`;
    if (!isRecord(relationship) || !id(relationship.from) || !id(relationship.to) || !objectIds.has(relationship.from) || !objectIds.has(relationship.to) || typeof relationship.kind !== "string" || !RELATIONSHIP_KINDS.has(relationship.kind)) { diagnostics.skippedRelationshipIds.push(relationshipId); continue; }
    relationships.push({ from: relationship.from, to: relationship.to, kind: relationship.kind as V3Scene["relationships"][number]["kind"] });
  }
  const groundMaterial = materialOf(candidate.site.groundMaterial);
  const scene: V3Scene = { version: 3, site: { width: candidate.site.width, depth: candidate.site.depth, ...(finite(candidate.site.baseElevation) ? { baseElevation: candidate.site.baseElevation } : {}), ...(groundMaterial ? { groundMaterial } : {}) }, ...(hierarchy ? { siteHierarchy: hierarchy } : {}), objects: uniqueObjects, relationships, metadata: {} };
  return { scene, diagnostics };
}
