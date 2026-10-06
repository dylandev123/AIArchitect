import type { V3Scene, V3SceneObject, Vec3 } from "./scene";
import { getObjectBaseY, getObjectTopY, getSupportSurfaceY, getTerrainY, scaledDimensionsOf } from "./elevation";

export type V3SupportType = "terrain" | "pad" | "terrace" | "slab" | "deck" | "roof" | "object";
export type V3ConnectionType = "driveway" | "path" | "stair" | "ramp";
export type V3TransitionType = "natural-slope" | "graded-slope" | "retaining-edge" | "stair" | "ramp";
export type V3GroundingMode = "grounded" | "embedded" | "floating" | "suspended" | "cantilevered";
/** The authored physical reason an object is where it is. */
export type V3SupportRelationship = "rests-on" | "attached-to" | "edge-hosted" | "terrain-following" | "embedded-in" | "cantilevered-from" | "suspended-from";
export type V3Vec2 = [number, number];
/** Canonical world-space hierarchy route point: [east/west x, elevation y, north/south z]. */
export type V3RoutePoint = [number, number, number];
/** Persisted before the world-space route contract. Accepted only at the runtime compatibility boundary. */
export type V3LegacyRoutePoint = [number, number];
export type V3PersistedRoutePoint = V3RoutePoint | V3LegacyRoutePoint;

export interface V3LevelRegion { x: number; z: number; width: number; depth: number; rotation?: number; }
export interface V3SiteLevel { id: string; elevation: number; region: V3LevelRegion; role?: string; supportType: V3SupportType; access?: "entry" | "arrival"; }
export interface V3SiteConnection { id: string; fromLevelId: string; toLevelId: string; type: V3ConnectionType; route: V3PersistedRoutePoint[]; width: number; maxGrade?: number; surfaceObjectId?: string; }
export interface V3ResolvedSiteConnection extends Omit<V3SiteConnection, "route"> { route: V3RoutePoint[]; }
export interface V3ResolvedSiteHierarchy extends Omit<V3SiteHierarchy, "connections"> { connections: V3ResolvedSiteConnection[]; }
export interface V3SiteTransition { id: string; fromLevelId: string; toLevelId: string; type: V3TransitionType; objectId?: string; }
export interface V3SiteHierarchy { levels: V3SiteLevel[]; connections: V3SiteConnection[]; transitions?: V3SiteTransition[]; }
export interface V3SupportRef {
  kind: V3SupportType;
  levelId?: string;
  /** `objectId` is retained for persisted pre-contract scenes. New scenes author `hostId`. */
  objectId?: string;
  hostId?: string;
  relationship?: V3SupportRelationship;
  grounding?: V3GroundingMode;
}
export interface V3SiteIssue { id: string; code: string; targetId: string; message: string; severity: "error" | "warning"; }
export interface V3ResolvedSiteHierarchyResult { hierarchy: V3ResolvedSiteHierarchy; derived: boolean; }

const EPSILON = .36;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validPoint = (point: unknown, length: 2 | 3): point is number[] => Array.isArray(point) && point.length === length && point.every(finite);
/** Horizontal route travel deliberately ignores elevation: distance is measured in the X/Z ground plane. */
export const routeLength = (route: readonly V3RoutePoint[]) => route.slice(1).reduce((length, point, index) => length + Math.hypot(point[0] - route[index][0], point[2] - route[index][2]), 0);
/** The greatest authored segment grade.  Y is never reconstructed or discarded for canonical routes. */
export const routeGrade = (route: readonly V3RoutePoint[]) => route.slice(1).reduce((maximum, point, index) => {
  const previous = route[index], horizontal = Math.hypot(point[0] - previous[0], point[2] - previous[2]);
  return Math.max(maximum, horizontal > 0 ? Math.abs(point[1] - previous[1]) / horizontal : point[1] === previous[1] ? 0 : Infinity);
}, 0);

/**
 * Converts only old persisted [x, z] routes to canonical [x, y, z]. Their Y
 * follows endpoint elevations by cumulative horizontal route distance. New
 * [x, y, z] routes pass through unchanged, preserving authored elevation.
 */
export function normalizeConnectionRoute(connection: V3SiteConnection, levels: readonly V3SiteLevel[]): V3RoutePoint[] {
  const route = connection.route as unknown[];
  if (route.every((point) => validPoint(point, 3))) return route.map(([x, y, z]) => [x, y, z]);
  if (!route.every((point) => validPoint(point, 2))) return [];
  const from = levels.find((level) => level.id === connection.fromLevelId), to = levels.find((level) => level.id === connection.toLevelId);
  if (!from || !to) return [];
  const horizontal = route.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - route[index][0], point[1] - route[index][1]), 0);
  let walked = 0;
  return route.map((point, index) => {
    if (index) walked += Math.hypot(point[0] - route[index - 1][0], point[1] - route[index - 1][1]);
    return [point[0], from.elevation + (to.elevation - from.elevation) * (horizontal > 0 ? walked / horizontal : 0), point[1]];
  });
}
const levelAt = (level: V3SiteLevel, x: number, z: number) => {
  const angle = level.region.rotation ?? 0, c = Math.cos(angle), s = Math.sin(angle), dx = x - level.region.x, dz = z - level.region.z;
  return Math.abs(dx * c - dz * s) <= level.region.width / 2 + EPSILON && Math.abs(dx * s + dz * c) <= level.region.depth / 2 + EPSILON;
};
const dimensionsOf = (object: V3SceneObject): Vec3 => scaledDimensionsOf(object);
const isIntentionalElevation = (object: V3SceneObject) => ["floating", "suspended", "cantilevered", "embedded"].includes(object.support?.grounding ?? "") || object.metadata?.embedded === true;
export const v3ObjectNeedsSupport = (object: V3SceneObject) => !["terrain-region", "light", "opening", "glass-panel", "roof", "canopy", "wall", "column", "beam"].includes(object.type) && !isIntentionalElevation(object);
const isOccupiable = (object: V3SceneObject) => object.collision === "walkable" || ["slab", "surface", "path", "stair", "ramp", "pool"].includes(object.type);

/**
 * Legacy V3 scenes did not persist a site graph. This conservative adapter keeps them renderable without pretending
 * that their arbitrary object heights are a complete authored hierarchy. New scenes must persist one through schema.
 */
export function resolveSiteHierarchy(scene: V3Scene): V3ResolvedSiteHierarchyResult {
  if (scene.siteHierarchy) return { hierarchy: { ...scene.siteHierarchy, connections: scene.siteHierarchy.connections.map((connection) => ({ ...connection, route: normalizeConnectionRoute(connection, scene.siteHierarchy!.levels) })) }, derived: false };
  const base = scene.site.baseElevation ?? 0;
  return { derived: true, hierarchy: { levels: [{ id: "legacy-terrain", elevation: base, region: { x: 0, z: 0, width: scene.site.width, depth: scene.site.depth }, supportType: "terrain" }], connections: [] } };
}

export const pointIsInLevel = levelAt;

export function levelForPoint(scene: V3Scene, x: number, z: number): V3SiteLevel | undefined {
  const { hierarchy } = resolveSiteHierarchy(scene);
  return hierarchy.levels.filter((level) => level.supportType !== "roof" && level.supportType !== "object" && levelAt(level, x, z)).sort((a, b) => b.elevation - a.elevation)[0];
}

export function heightFromHierarchy(scene: V3Scene, x: number, z: number): number | undefined {
  return levelForPoint(scene, x, z)?.elevation;
}

function objectSupportElevation(scene: V3Scene, object: V3SceneObject): number | undefined {
  return getSupportSurfaceY(object.support, object.transform.position[0], object.transform.position[2], scene);
}

const supportHostId = (support: V3SupportRef | undefined) => support?.hostId ?? support?.objectId;
const supportLevelId = (scene: V3Scene, support: V3SupportRef | undefined, seen = new Set<string>()): string | undefined => {
  if (support?.levelId) return support.levelId;
  const hostId = supportHostId(support);
  if (!hostId || seen.has(hostId)) return undefined;
  seen.add(hostId);
  return supportLevelId(scene, scene.objects.find((candidate) => candidate.id === hostId)?.support, seen);
};
const footprintOverlap = (a: V3SceneObject, b: V3SceneObject) => {
  const [aw, , ad] = dimensionsOf(a), [bw, , bd] = dimensionsOf(b);
  const x = Math.max(0, Math.min(a.transform.position[0] + aw / 2, b.transform.position[0] + bw / 2) - Math.max(a.transform.position[0] - aw / 2, b.transform.position[0] - bw / 2));
  const z = Math.max(0, Math.min(a.transform.position[2] + ad / 2, b.transform.position[2] + bd / 2) - Math.max(a.transform.position[2] - ad / 2, b.transform.position[2] - bd / 2));
  return x * z / Math.max(.01, Math.min(aw * ad, bw * bd));
};
const edgeDistance = (a: V3SceneObject, b: V3SceneObject) => {
  const [w, , d] = dimensionsOf(b), dx = Math.abs(a.transform.position[0] - b.transform.position[0]), dz = Math.abs(a.transform.position[2] - b.transform.position[2]);
  const outsideX = Math.max(0, dx - w / 2), outsideZ = Math.max(0, dz - d / 2);
  return outsideX || outsideZ ? Math.hypot(outsideX, outsideZ) : Math.min(w / 2 - dx, d / 2 - dz);
};
const boxGap = (a: V3SceneObject, b: V3SceneObject) => {
  const [aw, ah, ad] = dimensionsOf(a), [bw, bh, bd] = dimensionsOf(b);
  return Math.hypot(Math.max(0, Math.abs(a.transform.position[0] - b.transform.position[0]) - (aw + bw) / 2), Math.max(0, Math.abs(a.transform.position[1] - b.transform.position[1]) - (ah + bh) / 2), Math.max(0, Math.abs(a.transform.position[2] - b.transform.position[2]) - (ad + bd) / 2));
};
const endpointSupport = (scene: V3Scene, id: string) => scene.siteHierarchy?.levels.find((level) => level.id === id) ?? scene.objects.find((object) => object.id === id);
const endpointElevation = (endpoint: V3SiteLevel | V3SceneObject) => "region" in endpoint ? endpoint.elevation : getObjectTopY(endpoint);
const endpointContains = (endpoint: V3SiteLevel | V3SceneObject, x: number, z: number) => "region" in endpoint
  ? levelAt(endpoint, x, z)
  : Math.abs(x - endpoint.transform.position[0]) <= dimensionsOf(endpoint)[0] / 2 + EPSILON && Math.abs(z - endpoint.transform.position[2]) <= dimensionsOf(endpoint)[2] / 2 + EPSILON;

/** Objective physical checks. It deliberately does not infer taste or architectural quality. */
export function auditV3SiteHierarchy(scene: V3Scene, _legacyTerrainAt?: (x: number, z: number) => number): V3SiteIssue[] {
  const { hierarchy, derived } = resolveSiteHierarchy(scene), issues: V3SiteIssue[] = [];
  const issue = (code: string, targetId: string, message: string, severity: "error" | "warning" = "error") => issues.push({ id: `${code}:${targetId}`, code, targetId, message, severity });
  const levels = new Map<string, V3SiteLevel>();
  for (const level of hierarchy.levels) {
    if (levels.has(level.id)) issue("DUPLICATE_SITE_LEVEL", level.id, `Site level ${level.id} is duplicated.`);
    levels.set(level.id, level);
    if (!finite(level.elevation) || !finite(level.region.width) || !finite(level.region.depth) || level.region.width <= 0 || level.region.depth <= 0) issue("INVALID_SITE_LEVEL", level.id, `Site level ${level.id} has an invalid elevation or region.`);
  }
  const adjacency = new Map<string, Set<string>>();
  for (const level of hierarchy.levels) adjacency.set(level.id, new Set());
  for (const connection of hierarchy.connections) {
    const from = levels.get(connection.fromLevelId), to = levels.get(connection.toLevelId);
    if (!from || !to) { issue("MISSING_CONNECTION_LEVEL", connection.id, `Connection ${connection.id} references a missing site level.`); continue; }
    const route = normalizeConnectionRoute(connection, hierarchy.levels), length = routeLength(route);
    adjacency.get(from.id)?.add(to.id); adjacency.get(to.id)?.add(from.id);
    if (route.length < 2 || length < .1 || !finite(connection.width) || connection.width <= 0) issue("INVALID_SITE_CONNECTION", connection.id, `Connection ${connection.id} needs a valid route and width.`);
    if (route.length >= 2 && (!levelAt(from, route[0][0], route[0][2]) || !levelAt(to, route.at(-1)![0], route.at(-1)![2]))) issue("CONNECTION_ENDPOINT_OUTSIDE_LEVEL", connection.id, `Connection ${connection.id} does not begin and end on its declared levels.`);
    const grade = routeGrade(route);
    // Default grades are authoring guidance in Terra's prompt. Only an explicit
    // maxGrade is a hard contract, and it is checked from authored Y segments.
    const allowed = connection.maxGrade ?? Infinity;
    if (grade > allowed + .0001) issue(connection.type === "driveway" ? "DRIVEWAY_GRADE_TOO_STEEP" : "CONNECTION_GRADE_TOO_STEEP", connection.id, `${connection.type} ${connection.id} requires ${(grade * 100).toFixed(1)}% grade; maximum is ${(allowed * 100).toFixed(1)}%.`);
    // Authoring guidance, not a gate: a route past the preferred grade still renders, and is only reported.
    const preferred = connection.type === "driveway" ? .15 : connection.type === "ramp" ? .083 : undefined;
    if (preferred !== undefined && grade > preferred + .0001 && grade <= allowed + .0001) issue("CONNECTION_GRADE_EXCEEDS_PREFERRED", connection.id, `${connection.type} ${connection.id} has ${(grade * 100).toFixed(1)}% grade; preferred maximum is ${(preferred * 100).toFixed(1)}%.`, "warning");
    if (connection.surfaceObjectId && !scene.objects.some((object) => object.id === connection.surfaceObjectId)) issue("MISSING_CONNECTION_SURFACE", connection.id, `Connection ${connection.id} references a missing surface object.`);
  }
  for (const transition of hierarchy.transitions ?? []) {
    const from = levels.get(transition.fromLevelId), to = levels.get(transition.toLevelId);
    if (!from || !to) { issue("MISSING_TRANSITION_LEVEL", transition.id, `Transition ${transition.id} references a missing level.`); continue; }
    if (transition.type === "retaining-edge" && Math.abs(from.elevation - to.elevation) < .2) issue("RETAINING_EDGE_NO_GRADE_DIFFERENCE", transition.id, `Retaining edge ${transition.id} does not separate meaningful grades.`);
  }
  const entries = hierarchy.levels.filter((level) => level.access === "entry");
  const reachable = new Set(entries.map((level) => level.id)), queue = [...reachable];
  while (queue.length) for (const neighbour of adjacency.get(queue.shift()!) ?? []) if (!reachable.has(neighbour)) { reachable.add(neighbour); queue.push(neighbour); }
  for (const target of hierarchy.levels.filter((level) => level.access === "arrival")) {
    if (entries.length && !reachable.has(target.id)) issue("ARRIVAL_UNREACHABLE", target.id, `Arrival level ${target.id} is not reachable from a declared site entry.`);
  }
  // A hierarchy with no declared entry is an internal support graph. It is still strictly
  // validated for support resolution, but cannot truthfully be audited for public circulation.
  if (!derived && entries.length) for (const level of hierarchy.levels.filter((level) => level.supportType !== "roof" && level.access !== "entry")) {
    if (!adjacency.get(level.id)?.size) issue("DISCONNECTED_SITE_LEVEL", level.id, `Occupiable site level ${level.id} has no physical connection.`);
    else if (entries.length && !reachable.has(level.id)) issue("DISCONNECTED_SITE_LEVEL", level.id, `Occupiable site level ${level.id} is disconnected from the site entry graph.`);
  }
  const connectionSurfaceIds = new Set(hierarchy.connections.flatMap((connection) => connection.surfaceObjectId ? [connection.surfaceObjectId] : []));
  for (const object of scene.objects) {
    const connector = object.type === "stair" || object.type === "ramp";
    // Connectors are validated as two-ended graph edges, rather than as ordinary objects.
    if (connector) {
      const fromId = object.fromSupportId, toId = object.toSupportId;
      if (fromId || toId) {
        const from = fromId ? endpointSupport(scene, fromId) : undefined, to = toId ? endpointSupport(scene, toId) : undefined;
        if (!from || !to || !fromId || !toId || fromId === toId) {
          issue("INVALID_CONNECTOR_ENDPOINT", object.id, `${object.label} must reference two distinct existing supports.`);
        } else {
          const [a, b] = object.type === "stair" || object.type === "ramp"
            ? (() => { const [w, , d] = dimensionsOf(object), alongDepth = d >= w, half = (alongDepth ? d : w) / 2, angle = object.transform.rotation[1], dx = (alongDepth ? Math.sin(angle) : Math.cos(angle)) * half, dz = (alongDepth ? Math.cos(angle) : -Math.sin(angle)) * half; return [[object.transform.position[0] - dx, object.transform.position[2] - dz], [object.transform.position[0] + dx, object.transform.position[2] + dz]] as const; })()
            : [[object.transform.position[0], object.transform.position[2]], [object.transform.position[0], object.transform.position[2]]] as const;
          const direct = endpointContains(from, a[0], a[1]) && endpointContains(to, b[0], b[1]);
          const reversed = endpointContains(from, b[0], b[1]) && endpointContains(to, a[0], a[1]);
          const low = getObjectBaseY(object) - .45, high = getObjectTopY(object) + .45;
          const elevationsMeet = [endpointElevation(from), endpointElevation(to)].every((elevation) => elevation >= low && elevation <= high);
          if ((!direct && !reversed) || !elevationsMeet) issue("INVALID_CONNECTOR_ENDPOINT", object.id, `${object.label} endpoints do not physically meet their declared supports.`);
        }
      } else if (!connectionSurfaceIds.has(object.id)) issue("UNRESOLVED_CONNECTOR", object.id, `${object.label} does not resolve to two distinct support levels.`);
      continue;
    }
    // Explicit authored relationships are checked even for intentionally elevated objects.
    // A connection surface is grounded by its level-to-level ribbon, not by the legacy box's centre height.
    const explicit = objectSupportElevation(scene, object);
    const relationship = object.support?.relationship, hostId = supportHostId(object.support);
    if (relationship) {
      const host = hostId ? scene.objects.find((candidate) => candidate.id === hostId) : undefined;
      if (["rests-on", "edge-hosted", "attached-to", "embedded-in", "cantilevered-from", "suspended-from"].includes(relationship) && !host) {
        issue("INVALID_SUPPORT_RELATIONSHIP", object.id, `object: ${object.id}; host: ${hostId ?? "missing"}; reason: referenced host does not exist.`);
        continue;
      }
      if (relationship === "terrain-following") {
        const gap = Math.abs(getObjectBaseY(object) - getTerrainY(object.transform.position[0], object.transform.position[2], scene));
        if (gap > 1.1) { issue("INVALID_SUPPORT_RELATIONSHIP", object.id, `object: ${object.id}; host: terrain; reason: support gap ${gap.toFixed(1)}m exceeds tolerance.`); continue; }
      } else if (host) {
        const overlap = footprintOverlap(object, host), edge = edgeDistance(object, host), baseGap = Math.abs(getObjectBaseY(object) - getObjectTopY(host)), gap = boxGap(object, host);
        const invalid = relationship === "rests-on" ? overlap < .05 || baseGap > .45
          : relationship === "edge-hosted" ? edge > .75 || baseGap > .5
          : relationship === "embedded-in" ? gap > .01
          : relationship === "suspended-from" ? overlap < .05 || Math.abs(getObjectTopY(object) - getObjectBaseY(host)) > .45
          : relationship === "cantilevered-from" || relationship === "attached-to" ? gap > .45
          : false;
        if (invalid) {
          const measure = relationship === "edge-hosted" ? edge : relationship === "rests-on" || relationship === "suspended-from" ? baseGap : gap;
          issue("INVALID_SUPPORT_RELATIONSHIP", object.id, `object: ${object.id}; host: ${host.id}; reason: support gap ${measure.toFixed(1)}m exceeds tolerance for ${relationship}.`);
          continue;
        }
      }
    }
    if (connectionSurfaceIds.has(object.id) || !v3ObjectNeedsSupport(object)) continue;
    const implicit = heightFromHierarchy(scene, object.transform.position[0], object.transform.position[2]);
    const terrain = getTerrainY(object.transform.position[0], object.transform.position[2], scene);
    const expected = explicit ?? (object.support?.kind === "terrain" ? terrain : implicit ?? terrain);
    // One object gets one root support issue. Earlier checks emitted a cascade (missing support,
    // unsupported slab, missing level) for the same missing graph edge.
    if (!object.support && !derived) { issue("UNRESOLVED_SUPPORT", object.id, `${object.label} has no resolved physical support.`); continue; }
    // Terrain-following lines are compiled from the shared heightfield segment by segment. Their stored
    // vertical centre remains legacy placement context rather than an independent grounding plane.
    const terrainFollowingLine = object.metadata?.followsTerrain === true && object.support?.kind === "terrain";
    const tolerance = object.support?.objectId ? (object.collision === "water" ? 2.5 : 1.35) : EPSILON;
    if (!terrainFollowingLine && Math.abs(getObjectBaseY(object) - expected) > tolerance) { issue("UNRESOLVED_SUPPORT", object.id, `${object.label} base ${getObjectBaseY(object).toFixed(2)} does not meet its resolved support at ${expected.toFixed(2)}.`); continue; }
    if (isOccupiable(object) && !supportLevelId(scene, object.support) && !derived && !terrainFollowingLine) issue("UNRESOLVED_SUPPORT", object.id, `${object.label} is walkable but its support does not resolve to a site level.`);
  }
  for (const object of scene.objects.filter((candidate) => candidate.type === "retaining-wall")) {
    const [width, , depth] = dimensionsOf(object), side = Math.max(width, depth) * .5 + .3, angle = object.transform.rotation[1], alongX = width >= depth;
    const dx = alongX ? -Math.sin(angle) * side : Math.cos(angle) * side, dz = alongX ? Math.cos(angle) * side : -Math.sin(angle) * side;
    if (Math.abs(getTerrainY(object.transform.position[0] + dx, object.transform.position[2] + dz, scene) - getTerrainY(object.transform.position[0] - dx, object.transform.position[2] - dz, scene)) < .2) issue("RETAINING_WALL_NO_GRADE_DIFFERENCE", object.id, `${object.label} does not separate meaningful terrain elevations.`);
  }
  return issues;
}
