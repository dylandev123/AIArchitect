import type { V3Scene, V3SceneObject, Vec3 } from "./scene";
import type { V3SiteLevel, V3SupportRef } from "./siteHierarchy";

/**
 * Canonical V3 vertical-coordinate contract.
 *
 * `transform.position[1]` is always an object's centre. Site-level elevations
 * and support-surface elevations are world-space surface Y values. Keeping
 * that distinction here prevents a centre Y from ever being compared with a
 * floor, slab, or terrain surface.
 */
export const scaledDimensionsOf = (object: V3SceneObject): Vec3 => object.dimensions.map((value, index) => value * object.transform.scale[index]) as Vec3;
export const getObjectBaseY = (object: V3SceneObject) => object.transform.position[1] - scaledDimensionsOf(object)[1] / 2;
export const getObjectTopY = (object: V3SceneObject) => object.transform.position[1] + scaledDimensionsOf(object)[1] / 2;

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
const modifierWeight = (object: V3SceneObject, x: number, z: number, feather: number) => {
  const [lx, lz] = localPoint(object, x, z), [width, , depth] = scaledDimensionsOf(object), edge = Math.min(width / 2 - Math.abs(lx), depth / 2 - Math.abs(lz));
  return edge <= 0 ? 0 : smooth(edge / Math.max(.25, feather));
};
const modifierTarget = (object: V3SceneObject, current: number, x: number, z: number) => {
  const [lx, lz] = localPoint(object, x, z), [width, , depth] = scaledDimensionsOf(object), operation = object.terrain?.operation, rise = object.terrain?.rise ?? 0, direction = object.terrain?.direction ?? "z";
  const along = direction === "x" ? lx / width : direction === "-x" ? -lx / width : direction === "z" ? lz / depth : -lz / depth;
  if (operation === "slopeRegion" || operation === "gradePath") return object.transform.position[1] + along * rise;
  if (operation === "raiseRegion") return current + Math.abs(rise || object.dimensions[1]);
  if (operation === "lowerRegion" || operation === "cutIntoSlope") return current - Math.abs(rise || object.dimensions[1]);
  return object.transform.position[1];
};

/** Height from terrain modifiers only, before authored hierarchy pads are overlaid. */
export function sampleModifiedTerrainHeight(x: number, z: number, scene: V3Scene): number {
  return scene.objects.filter((object) => object.type === "terrain-region" && object.terrain).reduce((height, object) => {
    const [width, , depth] = scaledDimensionsOf(object), feather = Math.min(3, Math.max(1, Math.min(width, depth) * .07)), weight = modifierWeight(object, x, z, feather);
    return height + (modifierTarget(object, height, x, z) - height) * weight;
  }, scene.site.baseElevation ?? 0);
}

/** The authoritative post-modifier terrain surface used by render, support, and validation. */
export function sampleFinalTerrainHeight(x: number, z: number, scene: V3Scene): number {
  const terrain = sampleModifiedTerrainHeight(x, z, scene);
  if (!scene.siteHierarchy) return terrain;
  const level = scene.siteHierarchy.levels
    .filter((candidate) => candidate.supportType !== "roof" && candidate.supportType !== "object" && containsLevel(candidate, x, z))
    .sort((a, b) => b.elevation - a.elevation)[0];
  return level?.elevation ?? terrain;
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

/** The top walkable plane of an object at a point, falling back to its direct support. */
export function getWalkableSurfaceY(object: V3SceneObject, x: number, z: number, scene: V3Scene): number | undefined {
  if (object.type === "terrain-region" || object.metadata?.followsTerrain === true || object.support?.kind === "terrain" && object.type === "path") return getTerrainY(x, z, scene);
  if (object.collision === "walkable" || ["slab", "surface", "stair", "ramp", "roof"].includes(object.type)) return getObjectTopY(object);
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
