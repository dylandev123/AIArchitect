import { compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from "./scene";
import { auditV3SiteHierarchy, normalizeConnectionRoute, routeLength, type V3ConnectionType, type V3SiteConnection, type V3SiteLevel, type V3SupportRef } from "./siteHierarchy";
import { classifyV3SupportBehavior, resolveSupportSurface, supportEndpoints, type V3SupportResolution } from "./supportGraph";
import { getObjectBaseY, getObjectTopY, getRootSupportId, getTerrainY, scaledDimensionsOf } from "./elevation";
import { validateV3Scene } from "./validation";

export interface V3SiteHierarchyMigrationSupportAssignment { objectId: string; oldSupport?: V3SupportRef; support: V3SupportRef; levelId?: string; directSupportSurfaceY?: number; owningLevelId?: string; rootSupportId?: string; objectBaseY?: number; verticalGap?: number; confidence: number; evidence: string[]; }
export interface V3SupportGraphLink { objectId: string; supportId: string; levelId?: string; directSupportSurfaceY?: number; owningLevelId?: string; rootSupportId?: string; objectBaseY?: number; verticalGap?: number; confidence: number; evidence: string[]; }
export interface V3SiteHierarchyMigrationReport {
  migrated: boolean; levels: Array<{ id: string; elevation: number; role?: string }>;
  connections: Array<{ id: string; fromLevelId: string; toLevelId: string; type: V3ConnectionType; grade: number }>;
  supportAssignments: V3SiteHierarchyMigrationSupportAssignment[]; supportGraph: V3SupportGraphLink[];
  ambiguousObjectIds: string[]; warnings: string[]; groundingIssues: { before: string[]; after: string[] };
  improvements: { driveway: boolean; pool: boolean; retainingWalls: boolean; fences: boolean }; rendersCleanly: boolean;
}
export interface V3SiteHierarchyMigration { ok: boolean; scene: V3Scene; report: V3SiteHierarchyMigrationReport; errors: string[]; }
export interface V3LegacySupportInference { support?: V3SupportRef; levelId?: string; confidence: number; evidence: string[]; }

const dimensionsOf = (object: V3SceneObject) => scaledDimensionsOf(object) as [number, number, number];
const levelForObject = (object: V3SceneObject, elevation = getObjectBaseY(object)): V3SiteLevel => {
  const [width, , depth] = dimensionsOf(object);
  return { id: `level-${object.id}`, elevation, region: { x: object.transform.position[0], z: object.transform.position[2], width: Math.max(3, width), depth: Math.max(3, depth), rotation: object.transform.rotation[1] || undefined }, supportType: object.type === "slab" ? "slab" : object.type === "surface" || object.type === "path" ? "terrace" : "pad" };
};
/**
 * Legacy saves predate levels. Cluster authored bearing-surface elevations
 * before assigning regions so tiny authoring noise does not manufacture a
 * false stack of separate floors. Regions and stable ids remain individual,
 * allowing disconnected same-height pads to retain their own support graph.
 */
function clusterLegacyLevelSeeds(seeds: V3SiteLevel[], tolerance = .35): V3SiteLevel[] {
  const ordered = [...seeds].sort((a, b) => a.elevation - b.elevation || a.id.localeCompare(b.id));
  const clusters: V3SiteLevel[][] = [];
  for (const seed of ordered) {
    const cluster = clusters.at(-1);
    const mean = cluster ? cluster.reduce((sum, item) => sum + item.elevation, 0) / cluster.length : undefined;
    if (cluster && mean !== undefined && Math.abs(seed.elevation - mean) <= tolerance) cluster.push(seed);
    else clusters.push([seed]);
  }
  return clusters.flatMap((cluster) => {
    const elevation = cluster.reduce((sum, item) => sum + item.elevation, 0) / cluster.length;
    return cluster.map((level) => ({ ...level, elevation }));
  });
}
const isLevelSeed = (object: V3SceneObject) => {
  const behavior = classifyV3SupportBehavior(object);
  // Legacy authored walkable/structural surfaces are evidence of their own level
  // band. This intentionally does not compare against an old flat terrain datum.
  return behavior.isStructuralSupport && (object.type === "volume" || behavior.isWalkable) && !behavior.isVerticalConnector && object.terrain?.operation !== "gradePath";
};
const hasBearingHost = (object: V3SceneObject, objects: readonly V3SceneObject[]) => objects.some((candidate) => {
  if (candidate.id === object.id || !classifyV3SupportBehavior(candidate).isStructuralSupport) return false;
  const [ow, , od] = dimensionsOf(object), [cw, , cd] = dimensionsOf(candidate);
  const overlaps = Math.abs(object.transform.position[0] - candidate.transform.position[0]) < (ow + cw) / 2 && Math.abs(object.transform.position[2] - candidate.transform.position[2]) < (od + cd) / 2;
  const top = getObjectTopY(candidate);
  return overlaps && Math.abs(getObjectBaseY(object) - top) <= 1.35;
});

/** Backwards-compatible entrypoint now backed exclusively by the generic spatial resolver. */
export function inferLegacyV3Support(object: V3SceneObject, scene: V3Scene): V3LegacySupportInference {
  const result = resolveSupportSurface(object, scene, scene.siteHierarchy?.levels ?? []);
  return { support: result.support, levelId: result.levelId, confidence: result.confidence, evidence: result.evidence };
}

function endpointLevel(at: readonly [number, number], elevation: number, scene: V3Scene, levels: readonly V3SiteLevel[], inherited: ReadonlyMap<string, string>) {
  const probe: V3SceneObject = { id: "endpoint", type: "proxy-asset", semanticRole: "endpoint", label: "endpoint", transform: { position: [at[0], elevation + .05, at[1]], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [.1, .1, .1], material: { id: "debug", color: "#ffffff" }, collision: "none" };
  return resolveSupportSurface(probe, scene, levels, inherited);
}

/** Local-only generic support-graph adapter for pre-hierarchy V3 saves. */
export function upgradeLegacyV3SiteHierarchy(scene: V3Scene): V3SiteHierarchyMigration {
  const original = structuredClone(scene);
  const report: V3SiteHierarchyMigrationReport = { migrated: false, levels: [], connections: [], supportAssignments: [], supportGraph: [], ambiguousObjectIds: [], warnings: [], groundingIssues: { before: [], after: [] }, improvements: { driveway: false, pool: false, retainingWalls: false, fences: false }, rendersCleanly: false };
  if (scene.siteHierarchy) { report.warnings.push("Scene already has an explicit site hierarchy; no migration was applied."); return { ok: true, scene: original, report, errors: [] }; }

  report.groundingIssues.before = auditV3SiteHierarchy(original).map((issue) => `${issue.code}:${issue.targetId}`);
  const next = structuredClone(scene);
  const levels: V3SiteLevel[] = [], levelIds = new Set<string>();
  const addLevel = (level: V3SiteLevel) => { if (!levelIds.has(level.id)) { levels.push(level); levelIds.add(level.id); } return level; };

  // Volumes expose bearing footprints. Independent terrain-bearing walkables expose site levels.
  // Neither branch reads ids, labels, semantic roles, or any domain-specific nouns.
  const levelSeeds = next.objects.filter((object) => object.type === "volume" || isLevelSeed(object) && !hasBearingHost(object, next.objects)).map((object) => levelForObject(object));
  for (const level of clusterLegacyLevelSeeds(levelSeeds)) addLevel(level);
  if (!levels.length) addLevel({ id: "level-site-ground", elevation: next.site.baseElevation ?? 0, region: { x: 0, z: 0, width: next.site.width, depth: next.site.depth }, supportType: "terrain" });
  next.siteHierarchy = { levels, connections: [], transitions: [] };

  const inherited = new Map<string, string>();
  for (const object of next.objects) if (levelIds.has(`level-${object.id}`)) inherited.set(object.id, `level-${object.id}`);
  const unresolved = new Set<string>();
  const markUnresolved = (object: V3SceneObject, evidence: readonly string[]) => {
    if (!unresolved.has(object.id)) { unresolved.add(object.id); report.ambiguousObjectIds.push(object.id); report.warnings.push(`${object.id}: ${evidence.join("; ")}`); }
  };
  const assign = (object: V3SceneObject, result: V3SupportResolution) => {
    if (!result.support) return markUnresolved(object, result.evidence);
    const oldSupport = object.support && structuredClone(object.support), levelId = result.levelId ?? result.support.levelId;
    object.support = { ...result.support, ...(levelId ? { levelId } : {}) };
    const behavior = classifyV3SupportBehavior(object), [width, , depth] = dimensionsOf(object), lineLike = Math.max(width, depth) >= 12 && Math.max(width, depth) >= Math.min(width, depth) * 4;
    if ((behavior.terrainFollowing || lineLike) && object.support.kind === "terrain") object.metadata = { ...object.metadata, followsTerrain: true };
    // Legacy free-standing assets often preserve an arbitrary vertical editor offset. Once their
    // support is resolved, settle only this generic asset category onto the shared terrain.
    if (object.support.kind === "terrain" && !behavior.terrainFollowing && ["proxy-asset", "native-asset", "gate"].includes(object.type)) object.transform.position[1] = getTerrainY(object.transform.position[0], object.transform.position[2], next) + dimensionsOf(object)[1] / 2;
    if (levelId) inherited.set(object.id, levelId);
    const evidence = [...result.evidence];
    const surfaceY = result.directSupportSurfaceY ?? result.supportElevation, baseY = getObjectBaseY(object);
    const diagnostics = { ...(surfaceY !== undefined ? { directSupportSurfaceY: surfaceY, verticalGap: Math.abs(baseY - surfaceY) } : {}), ...(result.owningLevelId ?? levelId ? { owningLevelId: result.owningLevelId ?? levelId } : {}), rootSupportId: result.rootSupportId ?? getRootSupportId(object.support, next), objectBaseY: baseY };
    report.supportAssignments.push({ objectId: object.id, ...(oldSupport ? { oldSupport } : {}), support: structuredClone(object.support), ...(levelId ? { levelId } : {}), ...diagnostics, confidence: result.confidence, evidence });
    report.supportGraph.push({ objectId: object.id, supportId: object.support.objectId ?? object.support.levelId ?? "terrain", ...(levelId ? { levelId } : {}), ...diagnostics, confidence: result.confidence, evidence });
  };

  for (const object of next.objects.filter((candidate) => candidate.metadata?.embedded === true)) {
    const levelId = inherited.get(object.id);
    if (levelId) assign(object, { objectId: object.id, support: { kind: "pad", levelId, grounding: "embedded" }, levelId, confidence: 100, evidence: ["explicit embedded grounding", "bearing footprint level"] });
  }

  // Fixed-point support propagation: terrain/levels → volumes → slabs → assets.
  const resolvable = next.objects.filter((object) => { const behavior = classifyV3SupportBehavior(object); return behavior.requiresSupport && !behavior.isVerticalConnector && object.type !== "terrain-region"; });
  for (let pass = 0; pass < next.objects.length; pass++) {
    let changed = false;
    for (const object of resolvable) if (!object.support) {
      const result = resolveSupportSurface(object, next, levels, inherited);
      if (result.support) { assign(object, result); changed = true; }
    }
    if (!changed) break;
  }
  for (const object of resolvable.filter((object) => !object.support)) assign(object, resolveSupportSurface(object, next, levels, inherited));

  // Edge-hosted objects use a line-to-boundary test. This recovery pass is still wholly generic:
  // it only runs for the inferred behavior category and accepts any structural footprint edge.
  for (const object of resolvable.filter((candidate) => !candidate.support && classifyV3SupportBehavior(candidate).isEdgeHosted)) {
    const base = getObjectBaseY(object);
    const host = next.objects.filter((candidate) => candidate.id !== object.id && classifyV3SupportBehavior(candidate).isStructuralSupport).map((candidate) => {
      const [w, , d] = dimensionsOf(candidate), dx = Math.abs(object.transform.position[0] - candidate.transform.position[0]), dz = Math.abs(object.transform.position[2] - candidate.transform.position[2]);
      const edge = Math.hypot(Math.max(0, dx - w / 2), Math.max(0, dz - d / 2)) || Math.min(w / 2 - dx, d / 2 - dz);
      return { candidate, edge, vertical: Math.abs(base - getObjectTopY(candidate)) };
    }).filter((candidate) => candidate.edge <= .9 && candidate.vertical <= 1.1).sort((a, b) => a.edge - b.edge || a.vertical - b.vertical || a.candidate.id.localeCompare(b.candidate.id))[0];
    if (host) assign(object, { objectId: object.id, support: { kind: "object", objectId: host.candidate.id, ...(inherited.get(host.candidate.id) ? { levelId: inherited.get(host.candidate.id) } : {}) }, levelId: inherited.get(host.candidate.id), supportElevation: getObjectTopY(host.candidate), directSupportSurfaceY: getObjectTopY(host.candidate), owningLevelId: inherited.get(host.candidate.id), rootSupportId: getRootSupportId(host.candidate.support, next), confidence: 62, evidence: [`compatible structural boundary ${host.candidate.id}`, `edge distance ${host.edge.toFixed(2)}`, `vertical distance ${host.vertical.toFixed(2)}`] });
  }

  // Connectors resolve two independently-supported endpoints; they never borrow a fabricated host.
  for (const object of next.objects.filter((candidate) => classifyV3SupportBehavior(candidate).isVerticalConnector)) {
    const [a, b] = supportEndpoints(object), low = getObjectBaseY(object), high = getObjectTopY(object);
    const possibilities = [[a, b], [b, a]].map(([bottom, top]) => {
      const from = endpointLevel(bottom, low, next, levels, inherited), to = endpointLevel(top, high, next, levels, inherited);
      return from.levelId && to.levelId && from.levelId !== to.levelId ? { bottom, top, from, to, confidence: Math.min(from.confidence, to.confidence) } : undefined;
    }).filter((item): item is NonNullable<typeof item> => !!item).sort((x, y) => y.confidence - x.confidence);
    const best = possibilities[0], second = possibilities[1];
    if (!best || best.confidence < 62 || second && best.confidence - second.confidence < 5) { markUnresolved(object, ["connector endpoints do not resolve to distinct support levels"]); continue; }
    const connection: V3SiteConnection = { id: `connection-${object.id}`, fromLevelId: best.from.levelId!, toLevelId: best.to.levelId!, type: object.type === "stair" ? "stair" : "ramp", width: Math.max(.9, Math.min(dimensionsOf(object)[0], dimensionsOf(object)[2])), route: [[best.bottom[0], best.from.supportElevation ?? low, best.bottom[1]], [best.top[0], best.to.supportElevation ?? high, best.top[1]]], surfaceObjectId: object.id };
    next.siteHierarchy.connections.push(connection);
    const support: V3SupportRef = { kind: "object", levelId: best.from.levelId! }, evidence = [`bottom endpoint → ${best.from.levelId}`, `top endpoint → ${best.to.levelId}`, "vertical connector endpoint resolution"];
    object.support = support; inherited.set(object.id, best.from.levelId!);
    report.supportAssignments.push({ objectId: object.id, support, levelId: best.from.levelId, confidence: best.confidence, evidence });
    report.supportGraph.push({ objectId: object.id, supportId: `${best.from.levelId}→${best.to.levelId}`, levelId: best.from.levelId, confidence: best.confidence, evidence });
  }

  // A pre-existing graded path can become a graph edge only when both physical ends resolve.
  for (const object of next.objects.filter((candidate) => candidate.type === "path" && !next.siteHierarchy!.connections.some((connection) => connection.surfaceObjectId === candidate.id))) {
    const [a, b] = supportEndpoints(object), low = getObjectBaseY(object), rise = object.terrain?.operation === "gradePath" ? Math.abs(object.terrain.rise ?? 0) : 0;
    const from = endpointLevel(a, low - rise / 2, next, levels, inherited), to = endpointLevel(b, low + rise / 2, next, levels, inherited);
    if (from.levelId && to.levelId && from.levelId !== to.levelId && Math.min(from.confidence, to.confidence) >= 62) next.siteHierarchy.connections.push({ id: `connection-${object.id}`, fromLevelId: from.levelId, toLevelId: to.levelId, type: "path", width: Math.max(.9, Math.min(dimensionsOf(object)[0], dimensionsOf(object)[2])), route: [[a[0], from.supportElevation ?? low - rise / 2, a[1]], [b[0], to.supportElevation ?? low + rise / 2, b[1]]], surfaceObjectId: object.id });
  }

  for (const object of next.objects) if (object.support?.kind === "terrain" && !classifyV3SupportBehavior(object).terrainFollowing && ["proxy-asset", "native-asset", "gate"].includes(object.type)) object.transform.position[1] = getTerrainY(object.transform.position[0], object.transform.position[2], next) + dimensionsOf(object)[1] / 2;
  const siteIssues = auditV3SiteHierarchy(next);
  report.groundingIssues.after = siteIssues.map((issue) => `${issue.code}:${issue.targetId}`);
  report.levels = levels.map((level) => ({ id: level.id, elevation: level.elevation, role: level.role }));
  report.connections = next.siteHierarchy.connections.map((connection) => {
    const fromElevation = levels.find((level) => level.id === connection.fromLevelId)?.elevation ?? 0;
    const toElevation = levels.find((level) => level.id === connection.toLevelId)?.elevation ?? 0;
    return { id: connection.id, fromLevelId: connection.fromLevelId, toLevelId: connection.toLevelId, type: connection.type, grade: Math.abs(toElevation - fromElevation) / Math.max(.01, routeLength(normalizeConnectionRoute(connection, levels))) };
  });
  report.improvements = { driveway: next.siteHierarchy.connections.some((connection) => connection.surfaceObjectId && next.objects.find((object) => object.id === connection.surfaceObjectId)?.type === "path"), pool: report.supportAssignments.some((assignment) => assignment.support.objectId !== undefined), retainingWalls: false, fences: next.objects.filter((object) => classifyV3SupportBehavior(object).terrainFollowing).every((object) => object.support?.kind === "terrain") };
  const validation = validateV3Scene(next), compiled = validateV3CompiledGeometry(next, compileV3Scene(next)), errors = [...validation.errors, ...compiled.errors];
  report.rendersCleanly = errors.length === 0; report.migrated = errors.length === 0;
  return { ok: errors.length === 0, scene: errors.length === 0 ? next : original, report, errors };
}
