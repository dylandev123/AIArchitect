"use client";

import { Mesh, MeshPhysicalMaterial, type Group, type Material } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { parseGlb } from "@/lib/assets/glbModels";
import { createModelCache } from "@/lib/assets/modelCache";

// Separate, read-only cache: never registers an asset or touches a project's library.
export const villaModels = createModelCache(async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Villa download failed (${response.status}).`);
  return parseGlb(await response.arrayBuffer());
});

export function instantiateVilla(template: Group): Group {
  const instance = clone(template) as Group;
  instance.name = "Villa No. 01";
  instance.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    // Each mesh owns its finish, including meshes sharing a material in the source.
    // Geometry/textures remain shared; authored hierarchy and local transforms stay intact.
    node.material = Array.isArray(node.material)
      ? node.material.map((material: Material) => material.clone())
      : node.material.clone();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const glass = materials.some(material => material instanceof MeshPhysicalMaterial && material.transmission > 0);
    node.castShadow = !glass; // Standard shadow maps cannot transmit through glass.
    node.receiveShadow = !glass;
    node.userData.playgroundPart = node.name;
  });
  return instance;
}

export function disposeVilla(instance: Group) {
  instance.traverse((node) => {
    if (node instanceof Mesh) {
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
    }
  });
}
