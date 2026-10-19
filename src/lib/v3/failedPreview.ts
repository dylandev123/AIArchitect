import { v3CompositionSchema } from './composition';
import { normalizeV3FlatSite, v3FlatSiteErrors, type V3TerrainMode } from "./terrainMode";
import { normalizeObject, normalizeV3GenerationOutput, normalizeV3SiteObjectGeometry, type V3GenerationNote } from "./generation";
import { isV3ArchitecturalGeometry } from "./architecture";
import { canonicalizeV3ProviderIntent } from "./intentCanonicalization";
import type { V3Material, V3Scene, V3SceneObject, V3Transform, Vec3 } from "./scene";
import { inferV3GeometryKind, v3RenderWarnings } from "./renderability";
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
  unresolvedSupportObjectIds: string[];
  normalizedFields: string[];
  renderWarnings: Array<{ code: string; targetId: string; message: string }>;
}

export interface V3FailedPreview {
  scene: V3Scene;
  diagnostics: V3FailedPreviewDiagnostics;
}

type RecordValue = Record<string, unknown>;
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

function sourceOf(value: RecordValue): V3SceneObject["source"] | undefined {
  const nested = isRecord(value.source) ? value.source : undefined;
  const kind = value.sourceKind ?? nested?.kind;
  if (kind !== "proxy" && kind !== "glb" && kind !== "native") return undefined;
  const assetId = value.sourceAssetId ?? nested?.assetId;
  const replaceable = value.sourceReplaceable ?? nested?.replaceable;
  return {
    kind,
    ...(string(assetId, 160) ? { assetId } : {}),
    ...(typeof replaceable === "boolean" ? { replaceable } : {}),
  };
}

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
  // The ingestion object normalizer (named geometry, numeric coercion, transform defaults) applies to preview too.
  if (isRecord(value)) value = normalizeObject(value, []);
  const objectId = isRecord(value) && typeof value.id === "string" ? value.id : `object-${index}`;
  if (!isRecord(value) || !id(value.id) || !vector(value.dimensions, true)) {
    diagnostics.skippedObjectIds.push(objectId);
    return undefined;
  }
  const transform = transformOf(value.transform), material = materialOf(value.material);
  if (!transform || !material) {
    diagnostics.skippedObjectIds.push(objectId);
    return undefined;
  }
  if (!string(value.semanticRole, 80) || !string(value.label, 100)) diagnostics.normalizedFields.push(`${value.id}: filled missing semanticRole/label for preview`);
  const authoredLevels = finite(value.levels) && Number.isInteger(value.levels) && value.levels >= 1 ? value.levels : undefined;
  const composition=value.composition===undefined?undefined:v3CompositionSchema.safeParse(value.composition);
  if(composition&&!composition.success){diagnostics.skippedObjectIds.push(objectId);diagnostics.renderWarnings.push({code:'INVALID_COMPOSITION',targetId:objectId,message:'Invalid architectural composition omitted from failed preview; no rectangular substitute built.'});return undefined;}
  const object: V3SceneObject = {
    ...(composition?.success?{composition:composition.data}:{}),
    ...(isRecord(value.unsupportedIntent)&&typeof value.unsupportedIntent.roofForm==='string'?{unsupportedIntent:{roofForm:value.unsupportedIntent.roofForm}}:{}),
    ...(value.pitchUnit==='ratio'||value.pitchUnit==='degrees'?{pitchUnit:value.pitchUnit}:{}),
    id: value.id,
    type: string(value.type, 80) ? value.type : value.geometryKind === "path" ? "path" : value.geometryKind === "water" ? "water-surface" : value.geometryKind === "proxy" ? "proxy-asset" : "volume",
    semanticRole: string(value.semanticRole, 80) ? value.semanticRole : string(value.type, 80) ? value.type : "unlabelled object",
    label: string(value.label, 100) ? value.label : value.id,
    transform,
    ...(isRecord(value) && isV3ArchitecturalGeometry(value.architecture) ? { architecture: value.architecture } : {}),
    dimensions: value.dimensions,
    material,
    geometryKind: inferV3GeometryKind(value),
    ...(sourceOf(value) ? { source: sourceOf(value) } : {}),
    ...(typeof value.collision === "string" && COLLISIONS.has(value.collision) ? { collision: value.collision as V3SceneObject["collision"] } : {}),
    ...(metadataOf(value.metadata) ? { metadata: metadataOf(value.metadata) } : {}),
    // A strict-output mismatch must not discard architecturally useful intent.
    // The preview compiler supports the same broad range as normal V3 scenes.
    ...(value.facadePreset === "glass-heavy" || value.facadePreset === "punched" || value.facadePreset === "solid" || value.facadePreset === "privacy" ? { facadePreset: value.facadePreset } : {}),
    ...(value.facadeNorth === "glass-heavy" || value.facadeNorth === "punched" || value.facadeNorth === "solid" || value.facadeNorth === "privacy" ? { facadeNorth: value.facadeNorth } : {}),
    ...(value.facadeEast === "glass-heavy" || value.facadeEast === "punched" || value.facadeEast === "solid" || value.facadeEast === "privacy" ? { facadeEast: value.facadeEast } : {}),
    ...(value.facadeSouth === "glass-heavy" || value.facadeSouth === "punched" || value.facadeSouth === "solid" || value.facadeSouth === "privacy" ? { facadeSouth: value.facadeSouth } : {}),
    ...(value.facadeWest === "glass-heavy" || value.facadeWest === "punched" || value.facadeWest === "solid" || value.facadeWest === "privacy" ? { facadeWest: value.facadeWest } : {}),
    ...(value.roofForm === "flat" || value.roofForm === "floating-flat" || value.roofForm === "mono-pitch" || value.roofForm === "hip" || value.roofForm === "butterfly" || value.roofForm === "gable" || value.roofForm === "terrace" ? { roofForm: value.roofForm } : {}),
    ...(finite(value.overhang) && value.overhang >= 0 ? { overhang: value.overhang } : {}),
    ...(finite(value.pitch) && value.pitch >= 0 ? { pitch: Math.min(value.pitch, 89) } : {}),
  };
  if (authoredLevels) {
    object.levels = Math.min(authoredLevels, 20);
    if (authoredLevels > 20) {
      object.metadata = { ...object.metadata, requestedLevels: authoredLevels };
      diagnostics.normalizedFields.push(`${value.id}: level count approximated to 20 for preview`);
      diagnostics.renderWarnings.push({ code: "LEVEL_COUNT_APPROXIMATED", targetId: value.id, message: `${value.id} requested ${authoredLevels} levels; preview renders 20 and preserves the authored count in metadata.` });
    }
  } else if (value.levels !== undefined) diagnostics.normalizedFields.push(`${value.id}: omitted unsafe level count`);
  if (finite(value.pitch) && value.pitch > 89) diagnostics.normalizedFields.push(`${value.id}: roof pitch approximated to 89°`);
  const terrain = isRecord(value.terrain) ? value.terrain : value;
  const operation = terrain.operation ?? terrain.terrainOperation;
  const rise = terrain.rise ?? terrain.terrainRise;
  const direction = terrain.direction ?? terrain.terrainDirection;
  if (typeof operation === "string" && ["slopeRegion", "raiseRegion", "lowerRegion", "createTerrace", "cutIntoSlope", "gradePath"].includes(operation)) {
    object.terrain = { operation: operation as NonNullable<V3SceneObject["terrain"]>["operation"], ...(finite(rise) ? { rise } : {}), ...(typeof direction === "string" && ["x", "z", "-x", "-z"].includes(direction) ? { direction: direction as NonNullable<V3SceneObject["terrain"]>["direction"] } : {}) };
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
  if (!Array.isArray(value) || value.length < 2) return undefined;
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
    if (!isRecord(candidate) || !id(candidate.id) || !id(candidate.fromLevelId) || !id(candidate.toLevelId) || typeof candidate.type !== "string" || !CONNECTION_TYPES.has(candidate.type) || !finite(candidate.width) || candidate.width <= 0) {
      diagnostics.normalizedFields.push(`${connectionId}: skipped malformed hierarchy connection`);
      continue;
    }
    const from = levelIds.get(candidate.fromLevelId), to = levelIds.get(candidate.toLevelId), route = from && to ? normalizedRoute(candidate.route, from, to) : undefined;
    if (!from || !to || !route) { diagnostics.normalizedFields.push(`${connectionId}: skipped route with unknown levels or unsafe tuple shape`); continue; }
    if (route.normalized) diagnostics.normalizedFields.push(`${connectionId}: normalized legacy [x,z] route points to [x,y,z]`);
    connections.push({ id: candidate.id, fromLevelId: candidate.fromLevelId, toLevelId: candidate.toLevelId, type: candidate.type as V3SiteConnection["type"], route: route.route, width: candidate.width, ...(finite(candidate.maxGrade) && candidate.maxGrade > 0 ? { maxGrade: candidate.maxGrade } : {}), ...(id(candidate.surfaceObjectId) && objectIds.has(candidate.surfaceObjectId) ? { surfaceObjectId: candidate.surfaceObjectId } : {}) });
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
export function recoverV3FailedPreview(raw: unknown, strictValidationErrors: readonly string[] = [], terrainMode?: V3TerrainMode): V3FailedPreview | undefined {
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try { candidate = JSON.parse(raw); } catch { return undefined; }
  }
  // Same provider-shape canonicalization as persistence, so preview and ingestion read identical intent.
  const canonicalNotes: V3GenerationNote[] = [];
  if (terrainMode === "flat") {
    const normalized = normalizeV3GenerationOutput(candidate, terrainMode);
    candidate = normalized.scene;
    canonicalNotes.push(...normalized.notes);
  } else candidate = canonicalizeV3ProviderIntent(candidate, canonicalNotes);
  if (!isRecord(candidate) || candidate.version !== 3 || !isRecord(candidate.site) || !finite(candidate.site.width) || candidate.site.width <= 0 || !finite(candidate.site.depth) || candidate.site.depth <= 0 || !Array.isArray(candidate.objects)) return undefined;
  const diagnostics: V3FailedPreviewDiagnostics = { strictValidationErrors: [...strictValidationErrors], skippedObjectIds: [], skippedRelationshipIds: [], unsupportedObjectIds: [], unresolvedSupportObjectIds: [], normalizedFields: [], renderWarnings: [] };
  const siteNotes: V3GenerationNote[] = [];
  const siteCandidate = { ...candidate, objects: structuredClone(candidate.objects).map(object => isRecord(object) && object.architecture ? normalizeObject(object, siteNotes) : object), siteHierarchy: hierarchyOf(candidate.siteHierarchy, new Set(candidate.objects.filter(isRecord).map(o => String(o.id))), diagnostics) } as unknown as V3Scene;
  normalizeV3SiteObjectGeometry(siteCandidate, siteNotes);
  diagnostics.normalizedFields.push(...canonicalNotes.map(note => note.message), ...siteNotes.map(note => note.message));
  diagnostics.renderWarnings.push(...siteNotes);
  diagnostics.skippedObjectIds.push(...siteNotes.filter(note => note.code === "SITE_OBJECT_OMITTED").map(note => note.targetId));
  const objects = siteCandidate.objects.map((object, index) => objectOf(object, index, diagnostics)).filter((object): object is V3SceneObject => !!object);
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
      diagnostics.unresolvedSupportObjectIds.push(object.id);
      diagnostics.normalizedFields.push(`${object.id}: omitted invalid or missing support metadata`);
      diagnostics.renderWarnings.push({ code: "UNRESOLVED_SUPPORT", targetId: object.id, message: `${object.id} has unresolved support metadata; visible geometry was preserved.` });
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
  diagnostics.renderWarnings.push(...v3RenderWarnings(scene.objects));
  if (terrainMode === "flat") {
    normalizeV3FlatSite(scene, []);
    // An incompatible terrain preview must not suggest flat-mode acceptance.
    if (v3FlatSiteErrors(scene).length) return undefined;
  }
  return { scene, diagnostics };
}
