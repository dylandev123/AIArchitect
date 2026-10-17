import { normalizeV3FlatSite, type V3TerrainMode } from "./terrainMode";
import { deriveV3ConnectionBox, hasValidV3Box, isV3OptionalSiteObject } from "./siteObjectGeometry";
import { v3CompositionSchema } from "./composition";
import type { V3Material, V3Scene, Vec3 } from "./scene";
import type { V3SupportRef, V3SiteHierarchy } from "./siteHierarchy";
import { resolveV3EffectiveSupport } from "./derivedSupport";
import { isV3SupportHintCompatible, v3HasDeterministicSupportPolicy } from "./supportGraph";
import type { V3Issue } from "./validation";
import { inferV3GeometryKind, isKnownV3CompilerType, V3_GEOMETRY_KINDS } from "./renderability";
import { isV3ArchitecturalGeometry, runtimeGeometryFromArchitecture, type V3ArchitecturalGeometry } from "./architecture";
import { v3RelationshipTargetIds } from "./interior";
import { canonicalizeV3ProviderIntent, deriveV3NaturalGroundDatum } from "./intentCanonicalization";

/** A deterministic note about something the normalizer/repair pass changed or could not resolve. */
export interface V3GenerationNote { code: string; targetId: string; message: string; }
export interface V3NormalizedGeneration { scene: V3Scene; notes: V3GenerationNote[]; }

type Rec = Record<string, unknown>;
const isRecord = (value: unknown): value is Rec => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;
const number = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const vector = (value: unknown): Vec3 | undefined => {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const parsed = value.map(number);
  return parsed.every((item): item is number => item !== undefined) ? parsed as Vec3 : undefined;
};
const SUPPORT_KINDS = new Set<V3SupportRef["kind"]>(["terrain", "pad", "terrace", "slab", "deck", "roof", "object"]);
const SUPPORT_RELATIONSHIPS = new Set<NonNullable<V3SupportRef["relationship"]>>(["rests-on", "attached-to", "edge-hosted", "terrain-following", "embedded-in", "cantilevered-from", "suspended-from"]);
const SUPPORT_GROUNDING = new Set<NonNullable<V3SupportRef["grounding"]>>(["grounded", "embedded", "floating", "suspended", "cantilevered"]);
const COLLISIONS = new Set(["solid", "walkable", "passable", "water", "none"]);
const SURFACES = new Set(["concrete", "stone", "wood", "glass", "metal", "stucco", "paving", "water", "grass"]);
const FACADE_INTENTS = new Set(["glass-heavy", "punched", "solid", "privacy"]);
const ROOF_FORMS = new Set(["flat", "floating-flat", "mono-pitch", "hip", "gable", "butterfly", "terrace"]);

function normalizeArchitecture(raw: Rec, id: string, notes: V3GenerationNote[]): V3ArchitecturalGeometry | undefined {
  const nested = isRecord(raw.architecture) ? raw.architecture : undefined;
  const source = nested ?? raw;
  const supplied = !!nested || ["x", "z", "baseElevation", "width", "depth", "height", "rotationY"].some((key) => raw[key] !== undefined);
  if (!supplied) return undefined;
  const architecture = {
    x: number(source.x), z: number(source.z), baseElevation: number(source.baseElevation),
    width: number(source.width), depth: number(source.depth), height: number(source.height),
    ...(number(source.rotationY) !== undefined ? { rotationY: number(source.rotationY) } : {}),
  };
  if (!isV3ArchitecturalGeometry(architecture)) {
    notes.push({ code: "INVALID_ARCHITECTURE", targetId: id, message: `${id} supplied incomplete or non-positive named architectural geometry; valid legacy runtime arrays are still accepted.` });
    return undefined;
  }
  if (!nested) notes.push({ code: "ARCHITECTURE_NORMALIZED", targetId: id, message: `${id} flat named architectural fields were folded into the persistent architecture object.` });
  if (["x", "z", "baseElevation", "width", "depth", "height", "rotationY"].some((key) => typeof source[key] === "string" && Number.isFinite(Number(source[key])))) notes.push({ code: "NUMERIC_VALUE_COERCED", targetId: id, message: `${id} architectural geometry used numeric strings; they were converted to numbers.` });
  return architecture;
}

function normalizeTransform(raw: unknown, id: string, notes: V3GenerationNote[]): unknown {
  if (!isRecord(raw)) return raw;
  const position = vector(raw.position), rotation = vector(raw.rotation), scale = vector(raw.scale);
  if (position && Array.isArray(raw.position) && raw.position.some((item) => typeof item === "string")) notes.push({ code: "NUMERIC_VALUE_COERCED", targetId: id, message: `${id} position used numeric strings; they were converted to numbers.` });
  if (raw.rotation === undefined) notes.push({ code: "TRANSFORM_DEFAULTED", targetId: id, message: `${id} omitted rotation; zero rotation was used.` });
  if (raw.scale === undefined) notes.push({ code: "TRANSFORM_DEFAULTED", targetId: id, message: `${id} omitted scale; unit scale was used.` });
  return {
    ...raw,
    ...(position ? { position } : {}),
    rotation: raw.rotation === undefined ? [0, 0, 0] : rotation ?? raw.rotation,
    scale: raw.scale === undefined ? [1, 1, 1] : scale ?? raw.scale,
  };
}

function normalizeMaterial(raw: unknown, id: string, notes: V3GenerationNote[]): V3Material {
  const material = isRecord(raw) ? raw : {};
  const color = typeof material.color === "string" && /^#[0-9a-fA-F]{6}$/.test(material.color) ? material.color : "#808080";
  if (color === "#808080" && material.color !== "#808080") notes.push({ code: "MATERIAL_DEFAULTED", targetId: id, message: `${id} omitted a usable material color; a neutral preview material was used.` });
  const scalar = (key: "roughness" | "metalness" | "opacity") => {
    const value = number(material[key]);
    return value !== undefined && value >= 0 && value <= 1 ? value : undefined;
  };
  return {
    id: text(material.id) ?? `${id}-material`,
    color,
    ...(scalar("roughness") !== undefined ? { roughness: scalar("roughness") } : {}),
    ...(scalar("metalness") !== undefined ? { metalness: scalar("metalness") } : {}),
    ...(scalar("opacity") !== undefined ? { opacity: scalar("opacity") } : {}),
    ...(typeof material.surface === "string" && SURFACES.has(material.surface) ? { surface: material.surface as V3Material["surface"] } : {}),
  };
}

/**
 * Folds the flat provider-facing support object into the richer runtime `V3SupportRef`.
 * Neutral values ("" / "none") mean "not stated". This is deliberately tolerant of the legacy
 * runtime shape (optional fields, `objectId`) so older callers and fixtures keep working.
 */
function normalizeSupport(id: string, raw: unknown, notes: V3GenerationNote[]): V3SupportRef | undefined {
  if (!isRecord(raw)) {
    if (raw !== undefined) notes.push({ code: "UNRESOLVED_SUPPORT", targetId: id, message: `${id} support metadata was not an object and was omitted.` });
    return undefined;
  }
  const levelId = text(raw.levelId), hostId = text(raw.hostId) ?? text(raw.objectId);
  const authoredRelationship = raw.relationship === "none" || raw.relationship === undefined ? undefined : text(raw.relationship);
  let relationship = authoredRelationship && SUPPORT_RELATIONSHIPS.has(authoredRelationship as NonNullable<V3SupportRef["relationship"]>) ? authoredRelationship as V3SupportRef["relationship"] : undefined;
  if (authoredRelationship && !relationship) notes.push({ code: "UNRESOLVED_SUPPORT", targetId: id, message: `${id} used an unknown support relationship; it was omitted.` });
  const authoredKind = raw.kind === "none" || raw.kind === undefined ? undefined : text(raw.kind);
  let kind = authoredKind && SUPPORT_KINDS.has(authoredKind as V3SupportRef["kind"]) ? authoredKind as V3SupportRef["kind"] : undefined;
  if (authoredKind && !kind) notes.push({ code: "UNRESOLVED_SUPPORT", targetId: id, message: `${id} used an unknown support kind; it was inferred or omitted.` });
  if (relationship && !hostId && relationship !== "terrain-following") {
    notes.push({ code: "UNRESOLVED_SUPPORT", targetId: id, message: `${id} declared ${relationship} without a host; the relationship was dropped.` });
    relationship = undefined;
  }
  if (!kind) kind = hostId ? "object" : levelId ? "pad" : undefined;
  if (!kind) return undefined;
  const rawGrounding = text(raw.grounding);
  const grounding = rawGrounding && SUPPORT_GROUNDING.has(rawGrounding as NonNullable<V3SupportRef["grounding"]>) ? rawGrounding as V3SupportRef["grounding"] : undefined;
  return { kind, ...(levelId ? { levelId } : {}), ...(hostId ? { hostId } : {}), ...(relationship ? { relationship } : {}), ...(grounding ? { grounding } : {}) };
}

export function normalizeObject(raw: unknown, notes: V3GenerationNote[]): unknown {
  if (!isRecord(raw)) return raw;
  const { sourceKind, sourceAssetId, sourceReplaceable, terrainOperation, terrainRise, terrainDirection, support, parentId, groupId, hostId, fromSupportId, toSupportId, ...rest } = raw;
  const id = text(raw.id) ?? "(unknown)";
  const architecture = normalizeArchitecture(raw, id, notes);
  const architecturalRuntime = architecture ? runtimeGeometryFromArchitecture(architecture) : undefined;
  const normalizedDimensions = architecturalRuntime?.dimensions ?? vector(raw.dimensions);
  const inferredGeometry = inferV3GeometryKind({ ...raw, ...(normalizedDimensions ? { dimensions: normalizedDimensions } : {}) });
  const out: Rec = {
    ...rest,
    ...(text(raw.id) ? { id: text(raw.id) } : {}),
    semanticRole: text(raw.semanticRole) ?? text(raw.type) ?? text(raw.label) ?? id,
    label: text(raw.label) ?? text(raw.semanticRole) ?? text(raw.type) ?? id,
    geometryKind: inferredGeometry,
    transform: architecturalRuntime?.transform ?? normalizeTransform(raw.transform, id, notes),
    ...(normalizedDimensions ? { dimensions: normalizedDimensions } : {}),
    ...(architecture ? { architecture } : {}),
    material: normalizeMaterial(raw.material, id, notes),
  };
  if ((typeof raw.geometryKind === "string" && !V3_GEOMETRY_KINDS.has(raw.geometryKind as never)) || (!text(raw.geometryKind) && !isKnownV3CompilerType(raw.type))) notes.push({ code: "GEOMETRY_INFERRED", targetId: id, message: `${id} geometry was inferred as ${inferredGeometry}.` });
  if (Array.isArray(raw.dimensions) && raw.dimensions.some((item) => typeof item === "string") && vector(raw.dimensions)) notes.push({ code: "NUMERIC_VALUE_COERCED", targetId: id, message: `${id} dimensions used numeric strings; they were converted to numbers.` });
  if (architecture && (raw.transform !== undefined || raw.dimensions !== undefined)) notes.push({ code: "RUNTIME_GEOMETRY_DERIVED", targetId: id, message: `${id} named architectural geometry overrode provider-authored runtime arrays.` });
  // New provider output can omit legacy `type`; retain a stable generic hint
  // so every persisted runtime object remains compatible with old tools.
  if (!text(raw.type)) out.type = inferredGeometry === "path" ? "path" : inferredGeometry === "water" ? "water-surface" : inferredGeometry === "proxy" ? "proxy-asset" : inferredGeometry === "slab" ? "slab" : "volume";
  if (!text(raw.semanticRole) || !text(raw.label)) notes.push({ code: "IDENTITY_DEFAULTED", targetId: id, message: `${id} omitted a semantic role or label; the stable authored identity was retained with a readable default.` });
  if (typeof raw.collision !== "string" || !COLLISIONS.has(raw.collision)) delete out.collision;
  for (const [key, value] of Object.entries({ parentId, groupId, hostId, fromSupportId, toSupportId })) if (text(value)) out[key] = value;
  const normalizedSupport = normalizeSupport(id, support, notes);
  if (normalizedSupport) out.support = normalizedSupport;
  else if (support === undefined) notes.push({ code: "UNRESOLVED_SUPPORT", targetId: id, message: `${id} omitted support metadata; geometry remains renderable and support may be inferred.` });
  // Flat generation fields win; a legacy nested `source`/`terrain` object is kept as-is.
  const nestedSource = isRecord(raw.source) ? raw.source : undefined;
  const normalizedSourceKind = text(sourceKind) ?? text(nestedSource?.kind);
  if (normalizedSourceKind === "proxy" || normalizedSourceKind === "glb" || normalizedSourceKind === "native") out.source = { kind: normalizedSourceKind, ...(text(sourceAssetId) || text(nestedSource?.assetId) ? { assetId: text(sourceAssetId) ?? text(nestedSource?.assetId) } : {}), ...(typeof sourceReplaceable === "boolean" || typeof nestedSource?.replaceable === "boolean" ? { replaceable: typeof sourceReplaceable === "boolean" ? sourceReplaceable : nestedSource?.replaceable } : {}) };
  const nestedTerrain = isRecord(raw.terrain) ? raw.terrain : undefined;
  const normalizedOperation = text(terrainOperation) ?? text(nestedTerrain?.operation);
  const normalizedRise = number(terrainRise) ?? number(nestedTerrain?.rise);
  const normalizedDirection = text(terrainDirection) ?? text(nestedTerrain?.direction);
  if (normalizedOperation && ["slopeRegion", "raiseRegion", "lowerRegion", "createTerrace", "cutIntoSlope", "gradePath"].includes(normalizedOperation)) out.terrain = { operation: normalizedOperation, ...(normalizedRise !== undefined ? { rise: normalizedRise } : {}), ...(normalizedDirection && ["x", "z", "-x", "-z"].includes(normalizedDirection) ? { direction: normalizedDirection } : {}) };
  if (isRecord(raw.metadata)) out.metadata = Object.fromEntries(Object.entries(raw.metadata).filter(([, value]) => typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)));
  const authoredLevels = number(raw.levels);
  if (authoredLevels !== undefined && Number.isInteger(authoredLevels) && authoredLevels > 0) out.levels = authoredLevels;
  else delete out.levels;
  for (const key of ["facadePreset", "facadeNorth", "facadeEast", "facadeSouth", "facadeWest"] as const) if (!FACADE_INTENTS.has(String(raw[key]))) delete out[key];
  const namedUnsupported = /\b(mansard|gambrel|sawtooth|barrel[- ]vault|dome|hyperbolic)\b/i.exec(`${raw.label ?? ''} ${raw.semanticRole ?? ''}`)?.[0];
  const unsupportedRoof = text(isRecord(raw.unsupportedIntent) ? raw.unsupportedIntent.roofForm : undefined)
    ?? (text(raw.roofForm) && !ROOF_FORMS.has(String(raw.roofForm)) ? String(raw.roofForm) : undefined)
    ?? (['roof-form','building-mass'].includes(String(raw.type)) ? namedUnsupported : undefined);
  if (unsupportedRoof) {
    out.unsupportedIntent = { roofForm: unsupportedRoof.slice(0,160) };
    notes.push({ code: 'UNSUPPORTED_ARCHITECTURAL_INTENT', targetId: id, message: `${id} retains unsupported roof intent "${unsupportedRoof.slice(0,160)}" (${text(raw.roofForm) && !ROOF_FORMS.has(String(raw.roofForm)) ? "authored roofForm" : raw.unsupportedIntent ? "retained semantic intent" : "named in description; roofForm absent or inconsistent"}). Current geometry is a preview only, not an implementation of this roof.` });
  }
  if (!ROOF_FORMS.has(String(raw.roofForm))) delete out.roofForm;
  if (raw.pitchUnit === "degrees" || raw.pitchUnit === "ratio") out.pitchUnit = raw.pitchUnit; else delete out.pitchUnit;
  const overhang = number(raw.overhang), pitch = number(raw.pitch);
  if (overhang !== undefined && overhang >= 0) out.overhang = overhang; else delete out.overhang;
  if (pitch !== undefined) out.pitch = Math.max(0, Math.min(89, pitch));
  else if (raw.roofForm === "flat" || raw.roofForm === "floating-flat" || raw.roofForm === "terrace") out.pitch = 0;
  if (raw.composition !== undefined) {
    const composition = v3CompositionSchema.safeParse(raw.composition);
    if (composition.success) out.composition = composition.data;
    else { delete out.composition; notes.push({ code: "COMPOSITION_FALLBACK", targetId: id, message: "Malformed composition omitted; facade preset geometry retained." }); }
  }
  const canonicalKeys = [
    "id", "type", "semanticRole", "label", "geometryKind", "architecture", "transform", "dimensions", "material", "collision",
    "parentId", "groupId", "hostId", "source", "terrain", "support", "fromSupportId", "toSupportId", "metadata",
    "canopyStyle", "railing", "terraceOpenEdges", "unsupportedIntent", "composition", "levels", "facadePreset", "facadeNorth", "facadeEast", "facadeSouth", "facadeWest", "roofForm", "overhang", "pitch", "pitchUnit",
  ];
  return Object.fromEntries(canonicalKeys.flatMap((key) => out[key] !== undefined ? [[key, out[key]]] : []));
}

function normalizeHierarchy(raw: unknown): V3SiteHierarchy | undefined {
  if (!isRecord(raw)) return undefined;
  const levels = (Array.isArray(raw.levels) ? raw.levels : []).filter(isRecord).map((level) => {
    const region = isRecord(level.region) ? level.region : {};
    return {
      id: text(level.id) ?? "",
      ...(number(level.elevation) !== undefined ? { elevation: number(level.elevation) } : {}),
      region: Object.fromEntries(["x", "z", "width", "depth", "rotation"].flatMap((key) => number(region[key]) !== undefined ? [[key, number(region[key])]] : [])),
      ...(text(level.role) ? { role: text(level.role) } : {}),
      ...(text(level.supportType) ? { supportType: text(level.supportType) } : {}),
      ...(level.access === "entry" || level.access === "arrival" ? { access: level.access } : {}),
    };
  });
  const connections = (Array.isArray(raw.connections) ? raw.connections : []).filter(isRecord).map((connection) => {
    const route = Array.isArray(connection.route) ? connection.route.map((point) => vector(point) ?? (Array.isArray(point) && point.length === 2 && point.map(number).every((item) => item !== undefined) ? point.map(number) : point)) : connection.route;
    return { id: text(connection.id) ?? "", fromLevelId: text(connection.fromLevelId) ?? "", toLevelId: text(connection.toLevelId) ?? "", type: text(connection.type), ...(number(connection.width) !== undefined ? { width: number(connection.width) } : {}), ...(number(connection.maxGrade) !== undefined ? { maxGrade: number(connection.maxGrade) } : {}), route: Array.isArray(route) ? route : [], ...(text(connection.surfaceObjectId) ? { surfaceObjectId: text(connection.surfaceObjectId) } : {}) };
  });
  const transitions = (Array.isArray(raw.transitions) ? raw.transitions : []).filter(isRecord).map((transition) => ({ id: text(transition.id) ?? "", fromLevelId: text(transition.fromLevelId) ?? "", toLevelId: text(transition.toLevelId) ?? "", type: text(transition.type), ...(text(transition.objectId) ? { objectId: text(transition.objectId) } : {}) }));
  return { levels, connections, transitions } as unknown as V3SiteHierarchy;
}

/** Fill omitted semantic bases from authored hosts without changing any explicit elevation. */
function deriveArchitecturalBases(objects: unknown[], siteBase: number, notes: V3GenerationNote[]): unknown[] {
  return objects.map((raw, index) => {
    if (!isRecord(raw)) return raw;
    const identified = text(raw.id) ? raw : { ...raw, id: `semantic-object-${index + 1}` };
    if (!text(raw.id)) notes.push({ code: "IDENTITY_DEFAULTED", targetId: identified.id as string, message: "Missing object id was assigned deterministically." });
    if (!isRecord(identified.architecture) || identified.architecture.baseElevation !== undefined) return identified;
    const host = objects.find(candidate => isRecord(candidate) && candidate.id === identified.hostId);
    const hostGeometry = isRecord(host) && isRecord(host.architecture) ? host.architecture : undefined;
    const hostBase = number(hostGeometry?.baseElevation) ?? siteBase;
    const hostTop = hostBase + (number(hostGeometry?.height) ?? 0);
    const baseElevation = hostGeometry
      ? identified.type === "roof-form" || identified.type === "roof" || (identified.type === "canopy" && isRecord(host) && ["slab", "terrace", "surface"].includes(String(host.type))) ? hostTop : hostBase
      : siteBase;
    notes.push({ code: "ARCHITECTURE_BASE_INFERRED", targetId: identified.id as string, message: "Omitted base elevation derived from host or site datum." });
    return { ...identified, architecture: { ...identified.architecture, baseElevation } };
  });
}

const RELATIONSHIP_KINDS = ["supports", "contains", "aligns", "connects", "hosts", "adjacent"];
const INTERIOR_LISTS = ["storeys", "rooms", "partitions", "doors"] as const;

/**
 * Preserves an already-canonical interior verbatim. Storeys/rooms/partitions/doors are never invented, reshaped or
 * filtered for validity here (that is `auditV3Interior`'s job); only non-record entries are dropped, and an interior
 * without storeys/rooms arrays is omitted, each with a note. Absent `interior` stays absent.
 */
function normalizeInterior(raw: unknown, notes: V3GenerationNote[]): V3Scene["interior"] {
  if (raw === undefined) return undefined;
  if (!isRecord(raw) || !Array.isArray(raw.storeys) || !Array.isArray(raw.rooms)) {
    notes.push({ code: "INTERIOR_OMITTED", targetId: "interior", message: "Interior lacked storeys/rooms arrays and was omitted." });
    return undefined;
  }
  const interior: Rec = {};
  for (const key of INTERIOR_LISTS) {
    const list = raw[key];
    if (list === undefined && (key === "partitions" || key === "doors")) continue;
    if (!Array.isArray(list)) { notes.push({ code: "INTERIOR_OMITTED", targetId: `interior.${key}`, message: `Interior ${key} was not an array and was omitted.` }); continue; }
    const records = list.filter(isRecord);
    if (records.length !== list.length) notes.push({ code: "INTERIOR_ENTRY_DROPPED", targetId: `interior.${key}`, message: `${list.length - records.length} non-object interior ${key} entries were dropped.` });
    interior[key] = structuredClone(records);
  }
  return interior as unknown as V3Scene["interior"];
}

/**
 * Immediately after the provider-facing parse: expands the flat generation shape into the runtime
 * `V3Scene`. Never throws and never rejects — structural judgement belongs to `validateV3Scene`.
 */
export function normalizeV3GenerationOutput(provider: unknown, terrainMode?: V3TerrainMode): V3NormalizedGeneration {
  const notes: V3GenerationNote[] = [];
  // Provider vocabulary/placement drift is canonicalized first, so no authored intent is dropped below.
  const raw = canonicalizeV3ProviderIntent(provider, notes);
  if (!isRecord(raw)) return { scene: raw as V3Scene, notes };
  const site = isRecord(raw.site) ? raw.site : raw.site;
  // Flat high-level natural-ground intent → runtime naturalGround / sea. Runtime-shaped input passes through.
  const naturalSite = (input: Record<string, unknown>) => {
    const fall = ["x", "-x", "z", "-z"].includes(input.naturalFall as string) ? input.naturalFall as "x" | "-x" | "z" | "-z" : undefined, grade = number(input.naturalGrade), at = number(input.cliffAt), drop = number(input.cliffDrop), sea = number(input.seaLevel);
    const naturalGround = isRecord(input.naturalGround) ? input.naturalGround : fall || grade !== undefined || (at !== undefined && drop !== undefined)
      ? { ...(fall ? { fall } : {}), ...(grade !== undefined ? { grade } : {}), ...(at !== undefined && drop !== undefined && drop > 0 ? { cliff: { at, drop } } : {}) } : undefined;
    const seaPlane = isRecord(input.sea) ? input.sea : sea !== undefined ? { level: sea } : undefined;
    return { ...(naturalGround ? { naturalGround } : {}), ...(seaPlane ? { sea: seaPlane } : {}) };
  };
  let normalizedSite = site;
  if (isRecord(site)) {
    const groundColor = typeof site.groundColor === "string" && /^#[0-9a-fA-F]{6}$/.test(site.groundColor) ? site.groundColor : isRecord(site.groundMaterial) && typeof site.groundMaterial.color === "string" && /^#[0-9a-fA-F]{6}$/.test(site.groundMaterial.color) ? site.groundMaterial.color : undefined;
    normalizedSite = { ...(number(site.width) !== undefined ? { width: number(site.width) } : {}), ...(number(site.depth) !== undefined ? { depth: number(site.depth) } : {}), ...(number(site.baseElevation) !== undefined ? { baseElevation: number(site.baseElevation) } : {}), ...(groundColor ? { groundMaterial: { id: "ground", color: groundColor, surface: "grass" } } : {}), ...naturalSite(site) };
  }
  const siteHierarchy = normalizeHierarchy(raw.siteHierarchy);
  const interior = normalizeInterior(raw.interior, notes);
  const scene = {
    version: number(raw.version) === 3 ? 3 : raw.version,
    site: normalizedSite,
    ...(siteHierarchy ? { siteHierarchy } : {}),
    objects: Array.isArray(raw.objects) ? deriveArchitecturalBases(raw.objects, terrainMode === "flat" ? 0 : isRecord(site) ? number(site.baseElevation) ?? 0 : 0, notes).map((object) => normalizeObject(object, notes)) : raw.objects,
    ...(interior ? { interior } : {}),
    // `adjacent` (room ↔ room) is canonical; repair still drops any relationship naming a missing object or datum.
    relationships: Array.isArray(raw.relationships) ? raw.relationships.filter((relationship) => isRecord(relationship) && text(relationship.from) && text(relationship.to) && RELATIONSHIP_KINDS.includes(String(relationship.kind))).map((relationship) => ({ from: text((relationship as Rec).from), to: text((relationship as Rec).to), kind: (relationship as Rec).kind })) : [],
    metadata: isRecord(raw.metadata) ? Object.fromEntries(Object.entries(raw.metadata).filter(([, value]) => typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value))) : {},
  } as unknown as V3Scene;
  if (terrainMode === "flat") normalizeV3FlatSite(scene, notes);
  else deriveV3NaturalGroundDatum(scene, notes);
  normalizeV3SiteObjectGeometry(scene, notes);
  return { scene, notes };
}

/** Shared by production ingestion and failed-preview recovery before box validation. */
export function normalizeV3SiteObjectGeometry(scene: V3Scene, notes: V3GenerationNote[]): void {
  if (!Array.isArray(scene.objects)) return;
  scene.objects = scene.objects.filter(object => {
    if (!object || typeof object !== "object") return true;
    const derived = deriveV3ConnectionBox(object, scene.siteHierarchy);
    if (derived) {
      if (JSON.stringify(object.transform) !== JSON.stringify(derived.transform) || JSON.stringify(object.dimensions) !== JSON.stringify(derived.dimensions) || object.architecture) {
        Object.assign(object, derived);
        delete object.architecture;
        notes.push({ code: "SITE_GEOMETRY_DERIVED", targetId: object.id, message: `${object.id} compatibility bounds derived from its explicit connection route and width.` });
      }
      return true;
    }
    // Host geometry is structural: do not silently remove an object carrying other authored objects.
    const hostsOthers = scene.objects.some(other => other && (other.hostId === object.id || other.parentId === object.id || other.support?.hostId === object.id || other.support?.objectId === object.id));
    if (isV3OptionalSiteObject(object) && !hasValidV3Box(object) && !hostsOthers) {
      notes.push({ code: "SITE_OBJECT_OMITTED", targetId: object.id, message: `${object.id} omitted: unusable geometry and no explicit usable connection; architectural intent was not invented.` });
      return false;
    }
    return true;
  });
}

/**
 * Deterministic, bounded, model-free repair. It only removes information that cannot be true; it never moves
 * geometry, invents objects, or writes derived support into authored data.
 *  - dangling parent/host/support references are removed (and reported)
 *  - physically incompatible support hints on deterministic-policy objects are removed (and reported);
 *    `scopeIds` limits this re-evaluation to the objects an edit actually touched
 *  - ordinary terrain/slab/host support is derived on demand (`resolveV3EffectiveSupport`), never persisted
 *  - relationships to missing objects are dropped
 * `reportDerivedSupport` adds informational notes describing what derivation currently resolves.
 */
export function repairV3GeneratedScene(scene: V3Scene, notes: V3GenerationNote[] = [], options: { reportDerivedSupport?: boolean; scopeIds?: ReadonlySet<string> } = {}): V3NormalizedGeneration {
  if (!scene || !Array.isArray(scene.objects)) return { scene, notes };
  const ids = new Set(scene.objects.map((object) => object?.id).filter(Boolean));
  const levelIds = new Set((scene.siteHierarchy?.levels ?? []).map((level) => level.id));
  for (const object of scene.objects) {
    if (!object || typeof object !== "object") continue;
    for (const key of ["parentId", "hostId"] as const) if (object[key] && !ids.has(object[key]!)) {
      notes.push({ code: "MISSING_HOST", targetId: object.id, message: `${object.id} referenced missing ${key} ${object[key]}; the reference was dropped.` });
      delete object[key];
    }
    const support = object.support;
    if (!support) continue;
    const hostId = support.hostId ?? support.objectId;
    if (hostId && !ids.has(hostId)) {
      notes.push({ code: "SUPPORT_HINT_REPLACED", targetId: object.id, message: `${object.id} referenced missing support host ${hostId}; support will be inferred.` });
      delete object.support;
    } else if (support.levelId && !levelIds.has(support.levelId)) {
      notes.push({ code: "UNRESOLVED_SUPPORT", targetId: object.id, message: `${object.id} referenced missing support level ${support.levelId}.` });
      if (hostId) delete support.levelId; else delete object.support;
    }
    if (object.support && (!options.scopeIds || options.scopeIds.has(object.id)) && v3HasDeterministicSupportPolicy(object) && !isV3SupportHintCompatible(object, scene)) {
      const previous = object.support.hostId ?? object.support.objectId ?? object.support.levelId ?? object.support.kind;
      notes.push({ code: "SUPPORT_HINT_REPLACED", targetId: object.id, message: `${object.id} had an incompatible support hint (${previous}); geometry-based architectural support is derived instead.` });
      delete object.support;
    }
  }
  const relationshipIds = v3RelationshipTargetIds(scene);
  scene.relationships = (scene.relationships ?? []).filter((relationship) => {
    const keep = relationshipIds.has(relationship.from) && relationshipIds.has(relationship.to);
    if (!keep) notes.push({ code: "MISSING_RELATIONSHIP_OBJECT", targetId: `${relationship.from}->${relationship.to}`, message: `Relationship ${relationship.kind} referenced a missing object and was dropped.` });
    return keep;
  });
  if (options.reportDerivedSupport ?? true) {
    try {
      const effective = resolveV3EffectiveSupport(scene);
      for (const entry of effective.derived.values()) {
        const hostObjectId = entry.support.hostId ?? entry.support.objectId, object = scene.objects.find((candidate) => candidate.id === entry.objectId);
        const edge = object?.type === "railing" || object?.type === "fence";
        notes.push({ code: edge && hostObjectId ? "EDGE_SUPPORT_INFERRED" : "SUPPORT_INFERRED", targetId: entry.objectId, message: `${entry.objectId} support derived from geometry (${entry.support.kind}${hostObjectId ? ` ${hostObjectId}` : ""}, confidence ${entry.confidence.toFixed(0)}); derived support is not persisted.` });
      }
    } catch {
      // Reporting is best-effort; the audit reports whatever stays unresolved.
    }
  }
  return { scene, notes };
}

const LABELS: Record<string, [string, string]> = {
  UNRESOLVED_SUPPORT: ["unresolved support", "unresolved supports"],
  UNRESOLVED_CONNECTOR: ["stair/ramp connector unresolved", "stair/ramp connectors unresolved"],
  DRIVEWAY_GRADE_TOO_STEEP: ["driveway exceeds its maximum grade", "driveways exceed their maximum grade"],
  CONNECTION_GRADE_TOO_STEEP: ["connection exceeds its maximum grade", "connections exceed their maximum grade"],
  CONNECTION_GRADE_EXCEEDS_PREFERRED: ["route exceeds preferred grade", "routes exceed preferred grade"],
  INVALID_SUPPORT_RELATIONSHIP: ["support relationship out of tolerance", "support relationships out of tolerance"],
  SUPPORT_INFERRED: ["support inferred", "supports inferred"],
  EDGE_SUPPORT_INFERRED: ["edge-hosted object inferred", "edge-hosted objects inferred"],
  SUPPORT_HINT_REPLACED: ["incompatible support hint replaced", "incompatible support hints replaced"],
  MISSING_HOST: ["dangling host reference dropped", "dangling host references dropped"],
  MISSING_PARENT: ["dangling parent reference", "dangling parent references"],
  INCOMPLETE_TERRAIN: ["terrain region without an operation", "terrain regions without an operation"],
  DISCONNECTED_SITE_LEVEL: ["site level disconnected", "site levels disconnected"],
  ARRIVAL_UNREACHABLE: ["arrival level unreachable", "arrival levels unreachable"],
  VOLUME_OVERLAP: ["volume overlap", "volume overlaps"],
};

export interface V3GenerationAudit { status: "clean" | "rendered-with-warnings"; counts: Record<string, number>; summary: string; }

/** Groups every note and non-fatal issue into counted, human-readable lines. Nothing is hidden. */
export function summarizeV3Generation(notes: readonly V3GenerationNote[], issues: readonly V3Issue[]): V3GenerationAudit {
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const item of [...notes, ...issues.filter((issue) => issue.severity !== "fatal")]) {
    const key = `${item.code}:${item.targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[item.code] = (counts[item.code] ?? 0) + 1;
  }
  const lines = Object.entries(counts).map(([code, count]) => { const [one, many] = LABELS[code] ?? [code.toLowerCase().replaceAll("_", " "), code.toLowerCase().replaceAll("_", " ")]; return `${count} ${count === 1 ? one : many}`; });
  return lines.length
    ? { status: "rendered-with-warnings", counts, summary: `V3 scene rendered with warnings: ${lines.join(", ")}.` }
    : { status: "clean", counts, summary: "" };
}
