import * as THREE from "three";
import type { HouseModel, HousePrimitive } from "@/lib/house/types";
import { CAMERA_FOV } from "@/lib/house/cameraFit";
import { getObjectBaseY, getObjectTopY, sampleFinalTerrainHeight, scaledDimensionsOf } from "./elevation";
import { compileV3Scene, type V3Scene, type V3SceneObject, type Vec3 } from "./scene";

export interface V3Bounds { min: Vec3; max: Vec3; }
export interface V3PresentationBounds extends V3Bounds { center: Vec3; size: Vec3; source: "compiled" | "objects" | "site-fallback"; }

const TERRAIN_ID = "v3-terrain-surface";
/** Object types that are the ground itself, or have no physical extent worth framing. */
const NEVER_PRESENTED = new Set<V3SceneObject["type"]>(["terrain-region", "light"]);
/** A flat slab/surface this much of the site is the base ground plane in disguise, not a building. */
const GROUND_COVERAGE = 0.85;

const empty = (): V3Bounds => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const isEmpty = (b: V3Bounds) => !b.min.every(Number.isFinite);
function grow(b: V3Bounds, x: number, y: number, z: number) {
  if (![x, y, z].every(Number.isFinite)) return;
  b.min = [Math.min(b.min[0], x), Math.min(b.min[1], y), Math.min(b.min[2], z)];
  b.max = [Math.max(b.max[0], x), Math.max(b.max[1], y), Math.max(b.max[2], z)];
}
function growBox(b: V3Bounds, position: Vec3, size: Vec3, yaw: number) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * size[0] / 2, lz = sz * size[2] / 2;
    const x = position[0] + lx * c + lz * s, z = position[2] - lx * s + lz * c;
    grow(b, x, position[1] - size[1] / 2, z); grow(b, x, position[1] + size[1] / 2, z);
  }
}
/** Axis-aligned bounds of compiled primitives (boxes honour yaw; triMeshes use their vertices). */
export function primitivesBounds(primitives: readonly HousePrimitive[]): V3Bounds | undefined {
  const b = empty();
  for (const p of primitives) {
    if (p.kind === "box") growBox(b, p.position, p.size, p.rotation[1]);
    else for (let i = 0; i + 2 < p.vertices.length; i += 3) grow(b, p.vertices[i], p.vertices[i + 1], p.vertices[i + 2]);
  }
  return isEmpty(b) ? undefined : b;
}

/** True when an object is the ground / terrain / decorative site extent rather than designed content. */
export function isV3GroundLike(object: V3SceneObject, scene: V3Scene): boolean {
  if (NEVER_PRESENTED.has(object.type)) return true;
  if (object.type !== "slab" && object.type !== "surface") return false;
  const [w, , d] = scaledDimensionsOf(object);
  return w >= scene.site.width * GROUND_COVERAGE && d >= scene.site.depth * GROUND_COVERAGE;
}
const belongsTo = (primitiveId: string, objectId: string) => primitiveId === objectId || primitiveId.startsWith(objectId + "-");

/**
 * The bounds the camera should frame: architecture, driveway, pool, terraces, site structures. The base ground plane,
 * the heightfield, terrain regions and debug overlays are excluded, so a 180x180 site holding an 80x60 mansion frames
 * the mansion, not the lawn. Deterministic: depends only on the scene (and its compilation).
 */
export function getV3PresentationBounds(scene: V3Scene, compiled: HouseModel = compileV3Scene(scene)): V3PresentationBounds {
  const excluded = scene.objects.filter((o) => isV3GroundLike(o, scene)).map((o) => o.id);
  const presented = compiled.primitives.filter((p) => p.id !== TERRAIN_ID && !p.id.startsWith("v3-debug-") && !excluded.some((id) => belongsTo(p.id, id)));
  let bounds = primitivesBounds(presented), source: V3PresentationBounds["source"] = "compiled";
  if (!bounds) {
    const b = empty();
    for (const o of scene.objects) if (!isV3GroundLike(o, scene)) growBox(b, o.transform.position, scaledDimensionsOf(o), o.transform.rotation[1]);
    bounds = isEmpty(b) ? undefined : b; source = "objects";
  }
  if (!bounds) {
    const h = Math.min(scene.site.width, scene.site.depth) / 4;
    bounds = { min: [-h, 0, -h], max: [h, 8, h] }; source = "site-fallback";
  }
  const size: Vec3 = [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]];
  const center: Vec3 = [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
  return { min: bounds.min, max: bounds.max, center, size, source };
}

/** Orbit-camera pose that frames the presentation bounds' bounding sphere, centred on it (not on the origin). */
export function computeV3CameraFit(bounds: V3PresentationBounds, aspect = 1.6): { position: THREE.Vector3; target: THREE.Vector3 } {
  const radius = Math.max(4, Math.hypot(bounds.size[0], bounds.size[1], bounds.size[2]) / 2);
  const vHalf = THREE.MathUtils.degToRad(CAMERA_FOV) / 2, hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.4, aspect));
  const distance = radius / Math.sin(Math.min(vHalf, hHalf)) * 1.05;
  const target = new THREE.Vector3(bounds.center[0], bounds.min[1] + bounds.size[1] * 0.4, bounds.center[2]);
  return { target, position: target.clone().addScaledVector(new THREE.Vector3(1, 0.5, 1).normalize(), distance) };
}

export interface V3VolumeVisibility { id: string; baseY: number; topY: number; terrainY: number; visibleHeight: number; buried: boolean; }
export interface V3SceneDiagnosis {
  objectCount: number;
  objects: Array<{ id: string; type: string; position: Vec3; dimensions: Vec3 }>;
  siteBounds: V3Bounds;
  terrainBounds?: V3Bounds;
  architectureBounds: V3PresentationBounds;
  compiledBounds?: V3Bounds;
  compiledPrimitiveCount: number;
  /** Authored objects that produced no compiled primitive at all. */
  notCompiled: string[];
  nonFinite: string[];
  zeroScale: string[];
  transparent: string[];
  /** Objects whose top lies at/below the legacy flat ground plane (y = 0) that V3 projects still draw. */
  belowGroundPlane: string[];
  volumes: V3VolumeVisibility[];
  buriedVolumes: number;
}

/** Offline, model-free account of whether a scene's objects compile into visible geometry above the terrain. */
export function diagnoseV3Scene(scene: V3Scene, compiled: HouseModel = compileV3Scene(scene)): V3SceneDiagnosis {
  const objectBounds = empty();
  for (const o of scene.objects) growBox(objectBounds, o.transform.position, scaledDimensionsOf(o), o.transform.rotation[1]);
  const terrain = compiled.primitives.find((p) => p.id === TERRAIN_ID);
  const volumes = scene.objects.filter((o) => o.type === "volume").map((o): V3VolumeVisibility => {
    const baseY = getObjectBaseY(o), topY = getObjectTopY(o), terrainY = sampleFinalTerrainHeight(o.transform.position[0], o.transform.position[2], scene);
    const visibleHeight = topY - Math.max(baseY, terrainY);
    return { id: o.id, baseY, topY, terrainY, visibleHeight, buried: topY <= terrainY + 0.01 };
  });
  return {
    objectCount: scene.objects.length,
    objects: scene.objects.map((o) => ({ id: o.id, type: o.type, position: o.transform.position, dimensions: scaledDimensionsOf(o) })),
    siteBounds: { min: [-scene.site.width / 2, scene.site.baseElevation ?? 0, -scene.site.depth / 2], max: [scene.site.width / 2, scene.site.baseElevation ?? 0, scene.site.depth / 2] },
    terrainBounds: terrain ? primitivesBounds([terrain]) : undefined,
    architectureBounds: getV3PresentationBounds(scene, compiled),
    compiledBounds: primitivesBounds(compiled.primitives.filter((p) => p.id !== TERRAIN_ID)),
    compiledPrimitiveCount: compiled.primitives.length,
    notCompiled: scene.objects.filter((o) => o.type !== "terrain-region" && !compiled.primitives.some((p) => belongsTo(p.id, o.id) || p.id === o.id + "-water")).map((o) => o.id),
    nonFinite: scene.objects.filter((o) => ![...o.transform.position, ...scaledDimensionsOf(o)].every(Number.isFinite)).map((o) => o.id),
    zeroScale: scene.objects.filter((o) => scaledDimensionsOf(o).some((v) => !(v > 1e-6))).map((o) => o.id),
    transparent: scene.objects.filter((o) => o.material.opacity === 0).map((o) => o.id),
    belowGroundPlane: scene.objects.filter((o) => !isV3GroundLike(o, scene) && getObjectTopY(o) <= 0).map((o) => o.id),
    volumes,
    buriedVolumes: volumes.filter((v) => v.buried).length,
  };
}

export interface V3RenderDiagnostics { hideTerrain: boolean; debugMaterial: boolean; architectureBounds: boolean; }
/** Development-only view of a compiled V3 model; never touches the authored scene. */
export function applyV3RenderDiagnostics(model: HouseModel, scene: V3Scene, options: V3RenderDiagnostics): HouseModel {
  if (!options.hideTerrain && !options.debugMaterial && !options.architectureBounds) return model;
  let primitives = options.hideTerrain ? model.primitives.filter((p) => p.id !== TERRAIN_ID) : [...model.primitives];
  if (options.debugMaterial) primitives = primitives.map((p) => p.id === TERRAIN_ID ? p : { ...p, color: "#ff2d95", transparent: false, opacity: 1, surface: undefined });
  if (options.architectureBounds) {
    const b = getV3PresentationBounds(scene, model);
    primitives.push({ kind: "box", id: "v3-debug-architecture-bounds", category: "landscape", label: "V3 architecture bounds", position: b.center, rotation: [0, 0, 0], size: [Math.max(.1, b.size[0]), Math.max(.1, b.size[1]), Math.max(.1, b.size[2])], color: "#00e5ff", transparent: true, opacity: .16 });
  }
  return { ...model, primitives };
}
