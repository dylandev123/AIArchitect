import type { V3Scene, V3SceneObject, V3Transform, Vec3 } from "./scene";

/**
 * Semantic architectural geometry authored in plan/elevation terms.
 *
 * `baseElevation` is the bottom of the authored object, never its centre. The
 * V3 compiler is the sole authority that maps this shape to Three/runtime
 * arrays: position [x, y, z] and dimensions [width, height, depth].
 */
export interface V3ArchitecturalGeometry {
  x: number;
  z: number;
  baseElevation: number;
  width: number;
  depth: number;
  height: number;
  rotationY?: number;
}

export interface V3RuntimeGeometry {
  transform: V3Transform;
  dimensions: Vec3;
}

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function isV3ArchitecturalGeometry(value: unknown): value is V3ArchitecturalGeometry {
  if (!value || typeof value !== "object") return false;
  const geometry = value as Partial<V3ArchitecturalGeometry>;
  return finite(geometry.x) && finite(geometry.z) && finite(geometry.baseElevation)
    && finite(geometry.width) && geometry.width > 0
    && finite(geometry.depth) && geometry.depth > 0
    && finite(geometry.height) && geometry.height > 0
    && (geometry.rotationY === undefined || finite(geometry.rotationY));
}

/** Pure deterministic mapping shared by normalization, edits, and compile. */
export function runtimeGeometryFromArchitecture(geometry: V3ArchitecturalGeometry): V3RuntimeGeometry {
  return {
    transform: {
      position: [geometry.x, geometry.baseElevation + geometry.height / 2, geometry.z],
      rotation: [0, geometry.rotationY ?? 0, 0],
      scale: [1, 1, 1],
    },
    dimensions: [geometry.width, geometry.height, geometry.depth],
  };
}

/** Compatibility promotion used when a semantic edit targets an old array-only object. */
export function architectureFromRuntimeGeometry(object: V3SceneObject): V3ArchitecturalGeometry {
  return {
    x: object.transform.position[0],
    z: object.transform.position[2],
    baseElevation: object.transform.position[1] - object.dimensions[1] * object.transform.scale[1] / 2,
    width: object.dimensions[0] * object.transform.scale[0],
    height: object.dimensions[1] * object.transform.scale[1],
    depth: object.dimensions[2] * object.transform.scale[2],
    ...(object.transform.rotation[1] ? { rotationY: object.transform.rotation[1] } : {}),
  };
}

/**
 * Named geometry remains authoritative after persistence. Runtime arrays are a
 * derived compatibility/cache representation for the existing renderer and
 * low-level generic objects.
 */
export function materializeV3ArchitecturalObject(object: V3SceneObject): V3SceneObject {
  if (!object.architecture || !isV3ArchitecturalGeometry(object.architecture)) return object;
  const runtime = runtimeGeometryFromArchitecture(object.architecture);
  return { ...object, transform: runtime.transform, dimensions: runtime.dimensions };
}

export function materializeV3ArchitecturalScene(scene: V3Scene): V3Scene {
  if (!scene.objects.some((object) => object.architecture)) return scene;
  return { ...scene, objects: scene.objects.map(materializeV3ArchitecturalObject) };
}

export function runtimeGeometryMatchesArchitecture(object: V3SceneObject, epsilon = 1e-9): boolean {
  if (!object.architecture || !isV3ArchitecturalGeometry(object.architecture)) return false;
  const expected = runtimeGeometryFromArchitecture(object.architecture);
  return expected.transform.position.every((value, index) => Math.abs(value - object.transform.position[index]) <= epsilon)
    && expected.transform.rotation.every((value, index) => Math.abs(value - object.transform.rotation[index]) <= epsilon)
    && object.transform.scale.every((value) => Math.abs(value - 1) <= epsilon)
    && expected.dimensions.every((value, index) => Math.abs(value - object.dimensions[index]) <= epsilon);
}
