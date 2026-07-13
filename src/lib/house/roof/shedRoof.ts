import { quad, tri, type Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG } from "../constants";
import type { ResolvedMaterial } from "../materials";

/**
 * Single slope: high at north (–z), low at south (+z).
 * East and west gable ends are right-triangular fills in the exterior material.
 */
export function buildShedRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  const roofHeight = Math.max(0.6, depth * 0.28);
  const highY = baseY + roofHeight;
  const halfW = width / 2 + ROOF_OVERHANG;
  const halfD = depth / 2 + ROOF_OVERHANG;

  const { color, roughness, metalness } = roofMaterial;
  const { color: extColor, roughness: extRoughness, metalness: extMetalness } = exteriorMaterial;

  const FASCIA_H = 0.28;
  const FASCIA_T = 0.10;

  const slope: [Vec3, Vec3, Vec3, Vec3] = [
    [-halfW, highY,  -halfD], // NW high
    [ halfW, highY,  -halfD], // NE high
    [ halfW, baseY,   halfD], // SE low
    [-halfW, baseY,   halfD], // SW low
  ];

  // Gable triangular infill (right-triangle) closing east / west faces
  const gableW: [Vec3, Vec3, Vec3] = [[-halfW, baseY, -halfD], [-halfW, highY, -halfD], [-halfW, baseY, halfD]];
  const gableE: [Vec3, Vec3, Vec3] = [[ halfW, baseY, -halfD], [ halfW, baseY,  halfD], [ halfW, highY, -halfD]];

  return [
    { kind: "triMesh", id: `${idPrefix}-slope`,    category: "roof", label: "Roof Slope",      vertices: quad(...slope),    color, roughness, metalness },
    { kind: "triMesh", id: `${idPrefix}-gable-w`,  category: "roof", label: "Gable End (West)", vertices: tri(...gableW), color: extColor, roughness: extRoughness, metalness: extMetalness },
    { kind: "triMesh", id: `${idPrefix}-gable-e`,  category: "roof", label: "Gable End (East)", vertices: tri(...gableE), color: extColor, roughness: extRoughness, metalness: extMetalness },
    // High-end fascia (north) and low-end fascia (south)
    { kind: "box", id: `${idPrefix}-fascia-n`, category: "roof", label: "Roof Fascia (North)", position: [0, highY - FASCIA_H / 2, -halfD - FASCIA_T / 2], rotation: [0, 0, 0], size: [halfW * 2, FASCIA_H, FASCIA_T], color, roughness, metalness },
    { kind: "box", id: `${idPrefix}-fascia-s`, category: "roof", label: "Roof Fascia (South)", position: [0, baseY - FASCIA_H / 2,  halfD + FASCIA_T / 2], rotation: [0, 0, 0], size: [halfW * 2, FASCIA_H, FASCIA_T], color, roughness, metalness },
  ];
}
