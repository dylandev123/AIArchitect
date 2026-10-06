import type { V3Scene, V3SceneObject, Vec3 } from "./scene";
import type { V3SiteLevel, V3SupportRef, V3Vec2 } from "./siteHierarchy";
import { getObjectBaseY, getObjectTopY, getRootSupportId, getTerrainY, scaledDimensionsOf } from "./elevation";

/** Geometry-only support resolution used by the legacy hierarchy upgrader. */
export interface V3SupportBehavior {
  requiresSupport: boolean;
  isWalkable: boolean;
  isStructuralSupport: boolean;
  isEdgeHosted: boolean;
  isVerticalConnector: boolean;
  terrainFollowing: boolean;
  intentionalElevation: boolean;
}

export interface V3SupportResolution {
  objectId: string;
  support?: V3SupportRef;
  levelId?: string;
  supportElevation?: number;
  directSupportSurfaceY?: number;
  owningLevelId?: string;
  rootSupportId?: string;
  confidence: number;
  evidence: string[];
}

const EPSILON = .45;
const dimensionsOf = (object: V3SceneObject): Vec3 => scaledDimensionsOf(object);
/** @deprecated Use getObjectBaseY from elevation.ts. */
export const supportBaseOf = getObjectBaseY;
/** @deprecated Use getObjectTopY from elevation.ts. */
export const supportTopOf = getObjectTopY;
export const supportPointOf = (object: V3SceneObject): V3Vec2 => [object.transform.position[0], object.transform.position[2]];

function overlap(a: V3SceneObject, b: V3SceneObject) {
  const [aw, , ad] = dimensionsOf(a), [bw, , bd] = dimensionsOf(b);
  const x = Math.max(0, Math.min(a.transform.position[0] + aw / 2, b.transform.position[0] + bw / 2) - Math.max(a.transform.position[0] - aw / 2, b.transform.position[0] - bw / 2));
  const z = Math.max(0, Math.min(a.transform.position[2] + ad / 2, b.transform.position[2] + bd / 2) - Math.max(a.transform.position[2] - ad / 2, b.transform.position[2] - bd / 2));
  return x * z / Math.max(.01, Math.min(aw * ad, bw * bd));
}

function edgeDistance(a: V3SceneObject, b: V3SceneObject) {
  const [w, , d] = dimensionsOf(b), dx = Math.abs(a.transform.position[0] - b.transform.position[0]), dz = Math.abs(a.transform.position[2] - b.transform.position[2]);
  const outsideX = Math.max(0, dx - w / 2), outsideZ = Math.max(0, dz - d / 2);
  return outsideX || outsideZ ? Math.hypot(outsideX, outsideZ) : Math.min(w / 2 - dx, d / 2 - dz);
}

function contains(level: V3SiteLevel, [x, z]: V3Vec2) {
  const angle = level.region.rotation ?? 0, c = Math.cos(angle), s = Math.sin(angle), dx = x - level.region.x, dz = z - level.region.z;
  return Math.abs(dx * c - dz * s) <= level.region.width / 2 + EPSILON && Math.abs(dx * s + dz * c) <= level.region.depth / 2 + EPSILON;
}

function levelOverlap(object: V3SceneObject, level: V3SiteLevel) {
  const [w, , d] = dimensionsOf(object);
  const proxy = { ...object, transform: { ...object.transform, position: [level.region.x, object.transform.position[1], level.region.z] as Vec3 }, dimensions: [level.region.width, object.dimensions[1], level.region.depth] as Vec3 };
  return overlap(object, proxy) * Math.min(1, level.region.width * level.region.depth / Math.max(.01, w * d));
}

const supportKind = (object: V3SceneObject): V3SupportRef["kind"] => object.type === "roof" ? "roof" : object.type === "slab" ? "slab" : object.type === "surface" || object.type === "path" ? "terrace" : "object";

export function classifyV3SupportBehavior(object: V3SceneObject): V3SupportBehavior {
  const intentionalElevation = object.metadata?.embedded === true || ["floating", "suspended", "cantilevered", "embedded"].includes(object.support?.grounding ?? "");
  const inert = ["terrain-region", "light", "opening", "glass-panel"].includes(object.type);
  return {
    requiresSupport: !inert && !intentionalElevation,
    isWalkable: object.collision === "walkable" || ["slab", "surface", "path", "stair", "ramp"].includes(object.type),
    isStructuralSupport: object.metadata?.supportsObjects === true || ["volume", "slab", "surface", "roof", "canopy", "path", "wall", "beam", "column"].includes(object.type),
    isEdgeHosted: object.type === "railing" || object.type === "fence",
    isVerticalConnector: object.type === "stair" || object.type === "ramp",
    terrainFollowing: object.metadata?.followsTerrain === true || object.terrain?.operation === "gradePath",
    intentionalElevation,
  };
}

/**
 * Scores every support from physical capabilities and geometry. Semantic labels are deliberately
 * absent: renaming a scene cannot change the result.
 */
export function resolveSupportSurface(object: V3SceneObject, scene: V3Scene, levels: readonly V3SiteLevel[], inheritedLevels: ReadonlyMap<string, string> = new Map()): V3SupportResolution {
  const behavior = classifyV3SupportBehavior(object);
  if (!behavior.requiresSupport) return { objectId: object.id, confidence: 100, evidence: ["explicit intentional or non-physical behavior"] };
  const candidates: Array<V3SupportResolution> = [];
  const base = getObjectBaseY(object), at = supportPointOf(object);
  const relation = new Set([object.hostId, object.parentId].filter((id): id is string => !!id));

  for (const host of scene.objects) {
    if (host.id === object.id || !classifyV3SupportBehavior(host).isStructuralSupport) continue;
    const hostLevel = inheritedLevels.get(host.id) ?? host.support?.levelId;
    const surfaceY = getObjectTopY(host), vertical = Math.abs(base - surfaceY), footprint = overlap(object, host), edge = edgeDistance(object, host);
    const relationship = relation.has(host.id) ? 22 : 0;
    const geometry = behavior.isEdgeHosted ? Math.max(0, 34 - edge * 34) : Math.min(42, footprint * 46);
    const verticalScore = Math.max(0, 30 - vertical * 32);
    const confidence = Math.min(100, relationship + geometry + verticalScore + (footprint >= .75 ? 10 : 0) + (hostLevel ? 6 : 0));
    const insetAllowance = object.collision === "water" ? 2.5 : 1.35;
    const compatible = behavior.isEdgeHosted ? edge <= .9 && vertical <= 1.1 : footprint >= .08 && vertical <= insetAllowance;
    if (compatible) {
      const support = { kind: supportKind(host), objectId: host.id, ...(hostLevel ? { levelId: hostLevel } : {}) } as V3SupportRef;
      candidates.push({ objectId: object.id, support, levelId: hostLevel, owningLevelId: hostLevel, supportElevation: surfaceY, directSupportSurfaceY: surfaceY, rootSupportId: getRootSupportId(support, scene), confidence, evidence: [`object support ${host.id}`, `footprint overlap ${(footprint * 100).toFixed(0)}%`, `vertical distance ${vertical.toFixed(2)}`, `edge distance ${edge.toFixed(2)}`, ...(relationship ? ["authored host/parent relationship"] : [])] });
    }
  }

  for (const level of levels) {
    const vertical = Math.abs(base - level.elevation), contained = contains(level, at), footprint = levelOverlap(object, level);
    const confidence = Math.min(100, (contained ? 24 : 0) + Math.min(34, footprint * 38) + Math.max(0, 34 - vertical * 34) + (object.hostId ? 0 : 5));
    if ((contained || footprint >= .08) && vertical <= 1.15) {
      const support = { kind: level.supportType, levelId: level.id } as V3SupportRef;
      candidates.push({ objectId: object.id, support, levelId: level.id, owningLevelId: level.id, supportElevation: level.elevation, directSupportSurfaceY: level.elevation, rootSupportId: getRootSupportId(support, scene), confidence, evidence: [`site level ${level.id}`, `footprint overlap ${(footprint * 100).toFixed(0)}%`, `vertical distance ${vertical.toFixed(2)}`, contained ? "center contained" : "footprint intersects"] });
    }
  }

  const [width, , depth] = dimensionsOf(object), lineLike = Math.max(width, depth) >= 12 && Math.max(width, depth) >= Math.min(width, depth) * 4;
  if (behavior.terrainFollowing || lineLike) {
    const terrain = getTerrainY(...at, scene), support = { kind: "terrain" } as V3SupportRef;
    candidates.push({ objectId: object.id, support, supportElevation: terrain, directSupportSurfaceY: terrain, rootSupportId: "terrain", confidence: 64, evidence: ["long terrain-following line", `sampled final terrain ${terrain.toFixed(2)}`] });
  } else if (!behavior.isEdgeHosted) {
    const terrain = getTerrainY(...at, scene), vertical = Math.abs(base - terrain), confidence = Math.max(0, 68 - vertical * 46), support = { kind: "terrain" } as V3SupportRef;
    if (vertical <= 1.15 || ["proxy-asset", "native-asset", "gate"].includes(object.type)) candidates.push({ objectId: object.id, support, supportElevation: terrain, directSupportSurfaceY: terrain, rootSupportId: "terrain", confidence: Math.max(confidence, 64), evidence: ["final terrain surface", `vertical distance ${vertical.toFixed(2)}`, ...vertical > 1.15 ? ["settleable freestanding asset"] : []] });
  }
  candidates.sort((a, b) => b.confidence - a.confidence || (a.support?.objectId ?? a.levelId ?? "terrain").localeCompare(b.support?.objectId ?? b.levelId ?? "terrain"));
  const best = candidates[0], second = candidates[1];
  if (!best || best.confidence < 62 || second && best.confidence - second.confidence < 5) return { objectId: object.id, confidence: best?.confidence ?? 0, evidence: best ? [...best.evidence, "below deterministic confidence threshold or ambiguous"] : ["no compatible support surface"] };
  return best;
}

export function supportEndpoints(object: V3SceneObject): [V3Vec2, V3Vec2] {
  const [w, , d] = dimensionsOf(object), alongDepth = d >= w, half = (alongDepth ? d : w) / 2, angle = object.transform.rotation[1];
  const dx = (alongDepth ? Math.sin(angle) : Math.cos(angle)) * half, dz = (alongDepth ? Math.cos(angle) : -Math.sin(angle)) * half;
  return [[object.transform.position[0] - dx, object.transform.position[2] - dz], [object.transform.position[0] + dx, object.transform.position[2] + dz]];
}
