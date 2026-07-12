import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG, ROOF_THICKNESS } from "../constants";
import type { ResolvedMaterial } from "../materials";

const PARAPET_H = 0.25;
const PARAPET_THICK = 0.10;

export function buildFlatRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  const primitives: HousePrimitive[] = [];

  primitives.push({
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
  });

  // Parapet walls on all 4 edges — low walls that ring the flat roof.
  const slabW = width + ROOF_OVERHANG * 2;
  const slabD = depth + ROOF_OVERHANG * 2;
  const halfSlabW = slabW / 2;
  const halfSlabD = slabD / 2;
  const parapetY = baseY + ROOF_THICKNESS + PARAPET_H / 2;

  ([
    { id: `${idPrefix}-par-n`, pos: [0, parapetY, -halfSlabD + PARAPET_THICK / 2] as [number, number, number], size: [slabW, PARAPET_H, PARAPET_THICK] as [number, number, number] },
    { id: `${idPrefix}-par-s`, pos: [0, parapetY,  halfSlabD - PARAPET_THICK / 2] as [number, number, number], size: [slabW, PARAPET_H, PARAPET_THICK] as [number, number, number] },
    { id: `${idPrefix}-par-e`, pos: [ halfSlabW - PARAPET_THICK / 2, parapetY, 0] as [number, number, number], size: [PARAPET_THICK, PARAPET_H, slabD] as [number, number, number] },
    { id: `${idPrefix}-par-w`, pos: [-halfSlabW + PARAPET_THICK / 2, parapetY, 0] as [number, number, number], size: [PARAPET_THICK, PARAPET_H, slabD] as [number, number, number] },
  ] as { id: string; pos: [number, number, number]; size: [number, number, number] }[]).forEach(({ id, pos, size }) => {
    primitives.push({
      kind: "box",
      id,
      category: "roof",
      label: "Roof Parapet",
      position: pos,
      rotation: [0, 0, 0],
      size,
      color: exteriorMaterial.color,
      roughness: exteriorMaterial.roughness,
      metalness: exteriorMaterial.metalness,
    });
  });

  return primitives;
}
