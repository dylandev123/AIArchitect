import type { V3Scene, V3SceneObject, Vec3 } from "./scene";
import type { V3SiteLevel, V3SupportRef } from "./siteHierarchy";
import { isV3ArchitecturalGeometry } from "./architecture";
import { effectiveV3Scene } from "./derivedSupport";
import { v3Capability, v3SupportCapability } from "./capabilities";
import { normalizeConnectionRoute } from "./siteHierarchy";
import { deriveV3SiteGrading, v3GradingFeatureLines, v3NaturalGroundHeight, v3PoolCarve, v3PoolExcavation, V3_GRADING_SUPPORT, type V3SiteGrading } from "./grading";

/**
 * Canonical V3 vertical-coordinate contract.
 *
 * `transform.position[1]` is always an object's centre. Site-level elevations
 * and support-surface elevations are world-space surface Y values. Keeping
 * that distinction here prevents a centre Y from ever being compared with a
 * floor, slab, or terrain surface.
 */
export const scaledDimensionsOf = (object: V3SceneObject): Vec3 => isV3ArchitecturalGeometry(object.architecture)
  ? [object.architecture.width, object.architecture.height, object.architecture.depth]
  : object.dimensions.map((value, index) => value * object.transform.scale[index]) as Vec3;
export const getObjectBaseY = (object: V3SceneObject) => isV3ArchitecturalGeometry(object.architecture) ? object.architecture.baseElevation : object.transform.position[1] - scaledDimensionsOf(object)[1] / 2;
export const getObjectTopY = (object: V3SceneObject) => getObjectBaseY(object) + scaledDimensionsOf(object)[1];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smooth = (value: number) => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
const localPoint = (object: V3SceneObject, x: number, z: number): [number, number] => {
  const [ox, , oz] = object.transform.position, angle = object.transform.rotation[1], c = Math.cos(angle), s = Math.sin(angle), dx = x - ox, dz = z - oz;
  return [dx * c - dz * s, dx * s + dz * c];
};
const containsLevel = (level: V3SiteLevel, x: number, z: number) => {
  const angle = level.region.rotation ?? 0, c = Math.cos(angle), s = Math.sin(angle), dx = x - level.region.x, dz = z - level.region.z;
  return Math.abs(dx * c - dz * s) <= level.region.width / 2 + .36 && Math.abs(dx * s + dz * c) <= level.region.depth / 2 + .36;
};
/** A modifier never feathers on a side that reaches the site boundary: that feather was an artificial site-edge lip. */
const modifierWeight = (object: V3SceneObject, x: number, z: number, feather: number, scene: V3Scene) => {
  const [lx, lz] = localPoint(object, x, z), [width, , depth] = scaledDimensionsOf(object);
  if (Math.abs(lx) > width / 2 || Math.abs(lz) > depth / 2) return 0;
  const unrotated = Math.abs(object.transform.rotation[1]) < 1e-4, [ox, , oz] = object.transform.position;
  const reaches = (extent: number, limit: number) => unrotated && extent >= limit - .01;
  const ex = lx >= 0 ? (reaches(ox + width / 2, scene.site.width / 2) ? Infinity : width / 2 - lx) : (reaches(-(ox - width / 2), scene.site.width / 2) ? Infinity : width / 2 + lx);
  const ez = lz >= 0 ? (reaches(oz + depth / 2, scene.site.depth / 2) ? Infinity : depth / 2 - lz) : (reaches(-(oz - depth / 2), scene.site.depth / 2) ? Infinity : depth / 2 + lz);
  const edge = Math.min(ex, ez);
  return edge === Infinity ? 1 : edge <= 0 ? 0 : smooth(edge / Math.max(.25, feather));
};
const modifierTarget = (object: V3SceneObject, current: number, x: number, z: number) => {
  const [lx, lz] = localPoint(object, x, z), [width, , depth] = scaledDimensionsOf(object), operation = object.terrain?.operation, rise = object.terrain?.rise ?? 0, direction = object.terrain?.direction ?? "z";
  const along = direction === "x" ? lx / width : direction === "-x" ? -lx / width : direction === "z" ? lz / depth : -lz / depth;
  if (operation === "slopeRegion" || operation === "gradePath") return object.transform.position[1] + along * rise;
  if (operation === "raiseRegion") return current + Math.abs(rise || object.dimensions[1]);
  if (operation === "lowerRegion" || operation === "cutIntoSlope") return current - Math.abs(rise || object.dimensions[1]);
  return object.transform.position[1];
};

/** Natural ground: the site's natural-ground model, with legacy terrain-region modifiers composed on top. */
export function sampleModifiedTerrainHeight(x: number, z: number, scene: V3Scene): number {
  return scene.objects.filter((object) => object.type === "terrain-region" && object.terrain).reduce((height, object) => {
    const [width, , depth] = scaledDimensionsOf(object), feather = Math.min(3, Math.max(1, Math.min(width, depth) * .07)), weight = modifierWeight(object, x, z, feather, scene);
    return height + (modifierTarget(object, height, x, z) - height) * weight;
  }, v3NaturalGroundHeight(scene.site, x, z));
}

/**
 * Mesh topology shared by terrain rendering and sampling between its vertices. A uniform lattice, plus paired
 * feature lines a few cm apart on aligned pad and pool edges so grade breaks and pool shells are represented exactly.
 */
export function v3TerrainGrid(scene: V3Scene) {
  const step = clamp(Math.max(scene.site.width, scene.site.depth) / 72, 1.5, 2.5);
  const minX = -scene.site.width / 2, minZ = -scene.site.depth / 2, features = v3GradingFeatureLines(scene);
  const axis = (min: number, size: number, extra: number[]) => {
    const count = Math.ceil(size / step), inside = extra.filter((value) => value > min + .05 && value < min + size - .05).sort((a, b) => a - b);
    // Uniform lattice is never thinned, so moving one feature line only re-cuts the cells it crosses.
    const uniform = Array.from({ length: count + 1 }, (_, i) => min + size * i / count);
    return [...new Set([...uniform, ...inside].map((value) => Math.round(value * 1e4) / 1e4))].sort((a, b) => a - b);
  };
  const xs = axis(minX, scene.site.width, features.xs), zs = axis(minZ, scene.site.depth, features.zs);
  return { minX, minZ, columns: xs.length - 1, rows: zs.length - 1, step, xs, zs };
}

const gradingCache = new WeakMap<V3Scene, V3SiteGrading>();
/** The derived site grading for the effective scene (natural ground → corridors → pads → walls). */
export function resolveV3SiteGrading(input: V3Scene): V3SiteGrading { return gradingOfEffective(effectiveV3Scene(input)); }
/** `scene` must already be effective; re-deriving here would recurse into support inference. */
function gradingOfEffective(scene: V3Scene): V3SiteGrading {
  const hit = gradingCache.get(scene);
  if (hit) return hit;
  const natural = (x: number, z: number) => sampleModifiedTerrainHeight(x, z, scene);
  const levels = scene.siteHierarchy?.levels ?? [];
  const routes = new Map((scene.siteHierarchy?.connections ?? []).map((connection) => [connection.id, normalizeConnectionRoute(connection, levels)]));
  const grading = deriveV3SiteGrading(scene, natural, routes, v3TerrainGrid(scene).step);
  gradingCache.set(scene, grading);
  return grading;
}

export type V3TerrainSampler = ((x: number, z: number) => number) & { grading: V3SiteGrading; gradedAt(x: number, z: number): number };
/** The renderer and support graph share exactly this post-grading heightfield. */
export function createV3TerrainSampler(input: V3Scene): V3TerrainSampler {
  // Ground pads depend on support; derived support participates exactly as authored support does.
  const scene = effectiveV3Scene(input);
  const grid = v3TerrainGrid(scene), grading = gradingOfEffective(scene);
  const shoulder = grid.step * 1.5;
  const levels = new Map((scene.siteHierarchy?.levels ?? []).map((level) => [level.id, level]));
  // Legacy object pads only for ground-bearing objects that are NOT on a graded level: a graded level owns its terrain.
  const onGradedLevel = (object: V3SceneObject) => {
    const level = object.support?.levelId ? levels.get(object.support.levelId) : undefined;
    return !!level && V3_GRADING_SUPPORT.has(level.supportType) && containsLevel(level, object.transform.position[0], object.transform.position[2]);
  };
  const pads = scene.objects.flatMap((object) => {
    const elevated = object.metadata?.embedded === true || ["embedded", "floating", "suspended", "cantilevered"].includes(object.support?.grounding ?? "");
    if (!v3SupportCapability(object.type).groundPad || elevated || onGradedLevel(object)) return [];
    if (object.hostId || object.support?.hostId || object.support?.objectId || object.support?.kind === "roof" || object.support?.kind === "object") return [];
    const base = getObjectBaseY(object);
    // A physically hosted upper slab is not a ground pad merely because its
    // author omitted host metadata. Otherwise its own terrain mound competes
    // with the actual host during deterministic support inference.
    const [width,,depth] = scaledDimensionsOf(object);
    const aboveStructure = scene.objects.some((host) => {
      if (host.id === object.id || !v3SupportCapability(host.type).padHost) return false;
      if (getObjectBaseY(host) >= base - .15 || Math.abs(getObjectTopY(host) - base) > 1.35) return false;
      const [hw,,hd] = scaledDimensionsOf(host);
      const overlapX = Math.max(0, Math.min(object.transform.position[0]+width/2,host.transform.position[0]+hw/2)-Math.max(object.transform.position[0]-width/2,host.transform.position[0]-hw/2));
      const overlapZ = Math.max(0, Math.min(object.transform.position[2]+depth/2,host.transform.position[2]+hd/2)-Math.max(object.transform.position[2]-depth/2,host.transform.position[2]-hd/2));
      return overlapX * overlapZ / Math.min(width*depth,hw*hd) >= .08;
    });
    if (aboveStructure) return [];
    // Resolve against the graded (pre-object-pad) terrain to avoid a recursive/self-supported
    // sampling graph. Authored footprints never move in response to support.
    const support = getLevelY(object.support?.levelId, scene) ?? (object.support?.kind === "terrain" ? grading.graded(object.transform.position[0], object.transform.position[2]) : undefined);
    const elevation = support !== undefined && Math.abs(support - base) <= .45 ? support : base;
    return Number.isFinite(elevation) ? [{ object, elevation }] : [];
  // Blended in id order: the heightfield never depends on authored object order.
  }).sort((a, b) => a.object.id.localeCompare(b.object.id));
  const pools = v3PoolExcavation(scene, grid.step);
  const gradedAt = (x: number, z: number) => pads.reduce((height, pad) => {
    const [lx,lz] = localPoint(pad.object,x,z), [width,,depth] = scaledDimensionsOf(pad.object);
    const outside = Math.max(Math.abs(lx)-width/2, Math.abs(lz)-depth/2, 0);
    const weight = outside >= shoulder ? 0 : smooth(1-outside/shoulder);
    return height + (pad.elevation-height)*weight;
  }, grading.graded(x,z));
  // Pool excavation stays inside the shell (feature lines make that exact for aligned pools).
  const rawHeight = (x: number, z: number) => v3PoolCarve(pools, x, z, gradedAt(x, z));
  const { xs, zs } = grid;
  const samples = new Map<number, number>();
  const vertex = (column: number, row: number) => {
    const key = row * (grid.columns + 1) + column;
    if (!samples.has(key)) samples.set(key, rawHeight(xs[column], zs[row]));
    return samples.get(key)!;
  };
  const cell = (values: number[], value: number) => { let lo = 0, hi = values.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (values[mid] <= value) lo = mid; else hi = mid; } return lo; };
  const sampler = ((x: number, z: number) => {
    if (x < xs[0] || z < zs[0] || x > xs[xs.length - 1] || z > zs[zs.length - 1]) return rawHeight(x,z);
    const column = cell(xs, x), row = cell(zs, z);
    const u = (x - xs[column]) / (xs[column + 1] - xs[column]), v = (z - zs[row]) / (zs[row + 1] - zs[row]);
    const a = vertex(column,row), b = vertex(column+1,row), c = vertex(column+1,row+1), d = vertex(column,row+1);
    // Same a-b-c / a-c-d diagonal emitted by buildV3TerrainSurface.
    return u >= v ? a+(b-a)*u+(c-b)*v : a+(c-d)*u+(d-a)*v;
  }) as V3TerrainSampler;
  sampler.grading = grading;
  sampler.gradedAt = gradedAt;
  return sampler;
}

/** The authoritative terrain surface used by render, support, and validation. */
export function sampleFinalTerrainHeight(x: number, z: number, scene: V3Scene): number {
  return createV3TerrainSampler(scene)(x,z);
}

export const getTerrainY = (x: number, z: number, scene: V3Scene) => sampleFinalTerrainHeight(x, z, scene);
export function getLevelY(levelId: string | undefined, scene: V3Scene): number | undefined {
  return levelId ? scene.siteHierarchy?.levels.find((level) => level.id === levelId)?.elevation : undefined;
}

/** Returns the direct physical support surface, never an ancestor terrain datum. */
export function getSupportSurfaceY(candidate: V3SupportRef | V3SceneObject | V3SiteLevel | undefined, x: number, z: number, scene: V3Scene): number | undefined {
  if (!candidate) return undefined;
  if ("transform" in candidate) return getObjectTopY(candidate);
  if ("region" in candidate) return candidate.elevation;
  const hostId = candidate.hostId ?? candidate.objectId;
  if (hostId) {
    const object = scene.objects.find((item) => item.id === hostId);
    return object ? getObjectTopY(object) : undefined;
  }
  return getLevelY(candidate.levelId, scene) ?? (candidate.kind === "terrain" ? getTerrainY(x, z, scene) : undefined);
}

/** Capabilities whose compiler derives elevation directly from the terrain mesh (a compiled terrain shape). */
export const v3FollowsTerrain = (object: V3SceneObject) => !!v3Capability(object.type)?.validation?.compiledShape || (object.type === "gate" && object.metadata?.followsTerrain === true);

/** The top walkable plane of an object at a point, falling back to its direct support. */
export function getWalkableSurfaceY(object: V3SceneObject, x: number, z: number, scene: V3Scene): number | undefined {
  if (object.type === "terrain-region" || v3FollowsTerrain(object)) return getTerrainY(x, z, scene);
  if (object.collision === "walkable" || v3SupportCapability(object.type).walkingSurface) return getObjectTopY(object);
  return getSupportSurfaceY(object.support, x, z, scene);
}

export function getRootSupportId(support: V3SupportRef | undefined, scene: V3Scene): string {
  const seen = new Set<string>();
  let current = support;
  while ((current?.hostId ?? current?.objectId) && !seen.has(current.hostId ?? current.objectId!)) {
    const hostId = current.hostId ?? current.objectId!;
    seen.add(hostId);
    const object = scene.objects.find((candidate) => candidate.id === hostId);
    if (!object?.support) return object?.id ?? "terrain";
    current = object.support;
  }
  // Levels are elevated terrain/pad surfaces, not separate vertical roots.
  return "terrain";
}
