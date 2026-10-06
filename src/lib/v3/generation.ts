import type { V3Scene, V3SceneObject } from "./scene";
import type { V3SupportRef, V3SiteHierarchy } from "./siteHierarchy";
import { v3ObjectNeedsSupport } from "./siteHierarchy";
import { resolveSupportSurface } from "./supportGraph";
import type { V3Issue } from "./validation";

/** A deterministic note about something the normalizer/repair pass changed or could not resolve. */
export interface V3GenerationNote { code: string; targetId: string; message: string; }
export interface V3NormalizedGeneration { scene: V3Scene; notes: V3GenerationNote[]; }

type Rec = Record<string, unknown>;
const isRecord = (value: unknown): value is Rec => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;

/**
 * Folds the flat provider-facing support object into the richer runtime `V3SupportRef`.
 * Neutral values ("" / "none") mean "not stated". This is deliberately tolerant of the legacy
 * runtime shape (optional fields, `objectId`) so older callers and fixtures keep working.
 */
function normalizeSupport(id: string, raw: unknown, notes: V3GenerationNote[]): V3SupportRef | undefined {
  if (!isRecord(raw)) return undefined;
  const levelId = text(raw.levelId), hostId = text(raw.hostId) ?? text(raw.objectId);
  let relationship = raw.relationship === "none" ? undefined : text(raw.relationship) as V3SupportRef["relationship"] | undefined;
  let kind = raw.kind === "none" ? undefined : text(raw.kind) as V3SupportRef["kind"] | undefined;
  if (relationship && !hostId && relationship !== "terrain-following") {
    notes.push({ code: "UNRESOLVED_SUPPORT", targetId: id, message: `${id} declared ${relationship} without a host; the relationship was dropped.` });
    relationship = undefined;
  }
  if (!kind) kind = hostId ? "object" : levelId ? "pad" : undefined;
  if (!kind) return undefined;
  const grounding = text(raw.grounding) as V3SupportRef["grounding"] | undefined;
  return { kind, ...(levelId ? { levelId } : {}), ...(hostId ? { hostId } : {}), ...(relationship ? { relationship } : {}), ...(grounding ? { grounding } : {}) };
}

function normalizeObject(raw: unknown, notes: V3GenerationNote[]): unknown {
  if (!isRecord(raw)) return raw;
  const { sourceKind, sourceAssetId, sourceReplaceable, terrainOperation, terrainRise, terrainDirection, support, parentId, groupId, hostId, fromSupportId, toSupportId, ...rest } = raw;
  const id = typeof raw.id === "string" ? raw.id : "(unknown)";
  const out: Rec = { ...rest };
  for (const [key, value] of Object.entries({ parentId, groupId, hostId, fromSupportId, toSupportId })) if (text(value)) out[key] = value;
  const normalizedSupport = normalizeSupport(id, support, notes);
  if (normalizedSupport) out.support = normalizedSupport;
  // Flat generation fields win; a legacy nested `source`/`terrain` object is kept as-is.
  if (text(sourceKind)) out.source = { kind: sourceKind, ...(text(sourceAssetId) ? { assetId: sourceAssetId } : {}), ...(typeof sourceReplaceable === "boolean" ? { replaceable: sourceReplaceable } : {}) };
  if (text(terrainOperation)) out.terrain = { operation: terrainOperation, ...(typeof terrainRise === "number" ? { rise: terrainRise } : {}), ...(text(terrainDirection) ? { direction: terrainDirection } : {}) };
  return out;
}

function normalizeHierarchy(raw: unknown): V3SiteHierarchy | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.levels) || !Array.isArray(raw.connections)) return raw as V3SiteHierarchy | undefined;
  const connections = raw.connections.map((connection) => {
    if (!isRecord(connection)) return connection;
    const { surfaceObjectId, ...rest } = connection;
    return { ...rest, ...(text(surfaceObjectId) ? { surfaceObjectId } : {}) };
  });
  const transitions = Array.isArray(raw.transitions) ? raw.transitions.map((transition) => {
    if (!isRecord(transition)) return transition;
    const { objectId, ...rest } = transition;
    return { ...rest, ...(text(objectId) ? { objectId } : {}) };
  }) : [];
  return { ...raw, connections, ...(transitions.length ? { transitions } : {}) } as unknown as V3SiteHierarchy;
}

/**
 * Immediately after the provider-facing parse: expands the flat generation shape into the runtime
 * `V3Scene`. Never throws and never rejects — structural judgement belongs to `validateV3Scene`.
 */
export function normalizeV3GenerationOutput(raw: unknown): V3NormalizedGeneration {
  const notes: V3GenerationNote[] = [];
  if (!isRecord(raw)) return { scene: raw as V3Scene, notes };
  const site = isRecord(raw.site) ? raw.site : raw.site;
  let normalizedSite = site;
  if (isRecord(site)) {
    const { groundColor, ...rest } = site;
    normalizedSite = { ...rest, ...(text(groundColor) ? { groundMaterial: { id: "ground", color: groundColor, surface: "grass" } } : {}) };
  }
  const siteHierarchy = normalizeHierarchy(raw.siteHierarchy);
  const scene = {
    ...raw,
    site: normalizedSite,
    ...(siteHierarchy ? { siteHierarchy } : {}),
    objects: Array.isArray(raw.objects) ? raw.objects.map((object) => normalizeObject(object, notes)) : raw.objects,
    relationships: Array.isArray(raw.relationships) ? raw.relationships : [],
    metadata: isRecord(raw.metadata) ? raw.metadata : {},
  } as unknown as V3Scene;
  return { scene, notes };
}

/**
 * Deterministic, bounded, model-free repair. It only ever *adds* resolvable information or drops
 * references to things that do not exist; it never moves geometry or invents objects.
 *  - dangling parent/host/support references are removed (and reported)
 *  - missing support is inferred through the support graph when the evidence is unambiguous
 *  - relationships to missing objects are dropped
 */
export function repairV3GeneratedScene(scene: V3Scene, notes: V3GenerationNote[] = []): V3NormalizedGeneration {
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
      notes.push({ code: "UNRESOLVED_SUPPORT", targetId: object.id, message: `${object.id} referenced missing support host ${hostId}; support will be inferred.` });
      delete object.support;
    } else if (support.levelId && !levelIds.has(support.levelId)) {
      notes.push({ code: "UNRESOLVED_SUPPORT", targetId: object.id, message: `${object.id} referenced missing support level ${support.levelId}.` });
      if (hostId) delete support.levelId; else delete object.support;
    }
  }
  scene.relationships = (scene.relationships ?? []).filter((relationship) => {
    const keep = ids.has(relationship.from) && ids.has(relationship.to);
    if (!keep) notes.push({ code: "MISSING_RELATIONSHIP_OBJECT", targetId: `${relationship.from}->${relationship.to}`, message: `Relationship ${relationship.kind} referenced a missing object and was dropped.` });
    return keep;
  });
  const levels = scene.siteHierarchy?.levels ?? [];
  for (const object of scene.objects as V3SceneObject[]) {
    if (!object || object.support || object.type === "stair" || object.type === "ramp" || !v3ObjectNeedsSupport(object)) continue;
    try {
      const resolved = resolveSupportSurface(object, scene, levels);
      const found = resolved.support;
      if (!found) continue;
      const hostObjectId = found.objectId ?? found.hostId;
      const edge = object.type === "railing" || object.type === "fence";
      object.support = hostObjectId
        ? { kind: found.kind, hostId: hostObjectId, relationship: edge ? "edge-hosted" : "rests-on", ...(found.levelId ? { levelId: found.levelId } : {}) }
        : { kind: found.kind, ...(found.levelId ? { levelId: found.levelId } : {}) };
      notes.push({ code: edge && hostObjectId ? "EDGE_SUPPORT_INFERRED" : "SUPPORT_INFERRED", targetId: object.id, message: `${object.id} support inferred from geometry (${found.kind}${hostObjectId ? ` ${hostObjectId}` : ""}, confidence ${resolved.confidence.toFixed(0)}).` });
    } catch {
      // Inference is best-effort; the audit reports whatever stays unresolved.
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
