import { Box3, Mesh, MathUtils, PointLight, SpotLight, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Test scene helpers: load an exported GLB with three's real GLTFLoader (what the viewer uses) and ask how much light a lit
 * surface point would receive from the lights it carries, using three's physically-based light model: candela, inverse-square
 * falloff windowed to `distance`, and a smoothstepped spot cone. Not shipped.
 */

export type SceneLight = PointLight | SpotLight;

export interface LoadedScene {
  scene: Object3D;
  lights: SceneLight[];
  triangles: number;
  box: Box3;
}

export async function loadGlb(glb: ArrayBuffer): Promise<LoadedScene> {
  const gltf = await new GLTFLoader().parseAsync(glb, "");
  gltf.scene.updateMatrixWorld(true);
  const lights: SceneLight[] = [];
  let triangles = 0;
  gltf.scene.traverse((o) => {
    if ((o as PointLight).isPointLight || (o as SpotLight).isSpotLight) lights.push(o as SceneLight);
    const mesh = o as Mesh;
    if (mesh.isMesh) triangles += (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.getAttribute("position").count) / 3;
  });
  return { scene: gltf.scene, lights, triangles, box: new Box3().setFromObject(gltf.scene) };
}

/** Light arriving at `point` on a surface facing `normal`, before the surface's own albedo. 0 when out of range, behind the surface or outside the cone. */
export function irradiance(light: SceneLight, point: Vector3, normal: Vector3): number {
  const at = light.getWorldPosition(new Vector3());
  const toLight = at.clone().sub(point);
  const d = toLight.length();
  const l = toLight.clone().normalize();
  const cos = Math.max(0, normal.dot(l));
  let falloff = 1 / Math.max(Math.pow(d, light.decay), 0.01);
  if (light.distance > 0) falloff *= Math.pow(MathUtils.clamp(1 - Math.pow(d / light.distance, 4), 0, 1), 2);
  let cone = 1;
  if ((light as SpotLight).isSpotLight) {
    const spot = light as SpotLight;
    const aim = spot.target.getWorldPosition(new Vector3()).sub(at).normalize();
    cone = MathUtils.smoothstep(aim.dot(l.clone().negate()), Math.cos(spot.angle), Math.cos(spot.angle * (1 - spot.penumbra)));
  }
  return light.intensity * cos * falloff * cone;
}

/** Total light at a point from every light in the scene. */
export const illuminate = (lights: readonly SceneLight[], point: Vector3, normal: Vector3): number => lights.reduce((sum, l) => sum + irradiance(l, point, normal), 0);

export const UP = new Vector3(0, 1, 0);
export const DOWN = new Vector3(0, -1, 0);
