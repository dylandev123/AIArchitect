import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG, ROOF_THICKNESS } from "../constants";
import type { ResolvedMaterial } from "../materials";

export function buildFlatRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  _exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  return [
    {
      kind: "box",
      id: `${idPrefix}-slab`,
      category: "roof",
      label: "Roof Slab",
      position: [0, baseY + ROOF_THICKNESS / 2, 0],
      rotation: [0, 0, 0],
      size: [width + ROOF_OVERHANG * 2, ROOF_THICKNESS, depth + ROOF_OVERHANG * 2],
      color: roofMaterial.color,
      roughness: roofMaterial.roughness,
      metalness: roofMaterial.metalness,
    },
  ];
}
