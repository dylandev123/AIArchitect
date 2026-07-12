import { quad, tri, type Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG } from "../constants";
import type { ResolvedMaterial } from "../materials";

/**
 * Ridge runs along the longer footprint axis; the roof slopes down across
 * the shorter axis, with triangular gable-end infill closing the two ends.
 * The infill is a continuation of the exterior wall up into the peak, so it
 * uses the exterior material rather than the roof material.
 */
export function buildGableRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  const ridgeAlongX = width >= depth;
  const span = ridgeAlongX ? depth : width;
  const roofHeight = Math.max(0.6, span * 0.35);
  const ridgeY = baseY + roofHeight;
  const halfRidgeLen = (ridgeAlongX ? width : depth) / 2 + ROOF_OVERHANG;
  const halfSpan = span / 2 + ROOF_OVERHANG;
  const roofColor = roofMaterial.color;
  const wallColor = exteriorMaterial.color;
  const primitives: HousePrimitive[] = [];

  const FASCIA_H = 0.22;
  const FASCIA_T = 0.08;
  const fasciaY = baseY - FASCIA_H / 2;

  if (ridgeAlongX) {
    const north: [Vec3, Vec3, Vec3, Vec3] = [
      [-halfRidgeLen, baseY, -halfSpan],
      [halfRidgeLen, baseY, -halfSpan],
      [halfRidgeLen, ridgeY, 0],
      [-halfRidgeLen, ridgeY, 0],
    ];
    const south: [Vec3, Vec3, Vec3, Vec3] = [
      [-halfRidgeLen, ridgeY, 0],
      [halfRidgeLen, ridgeY, 0],
      [halfRidgeLen, baseY, halfSpan],
      [-halfRidgeLen, baseY, halfSpan],
    ];
    const west: [Vec3, Vec3, Vec3] = [
      [-halfRidgeLen, baseY, -halfSpan],
      [-halfRidgeLen, ridgeY, 0],
      [-halfRidgeLen, baseY, halfSpan],
    ];
    const east: [Vec3, Vec3, Vec3] = [
      [halfRidgeLen, baseY, -halfSpan],
      [halfRidgeLen, baseY, halfSpan],
      [halfRidgeLen, ridgeY, 0],
    ];

    primitives.push(
      { kind: "triMesh", id: `${idPrefix}-slope-north`, category: "roof", label: "Roof Slope (North)", vertices: quad(...north), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-slope-south`, category: "roof", label: "Roof Slope (South)", vertices: quad(...south), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-west`, category: "roof", label: "Gable End (West)", vertices: tri(...west), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-east`, category: "roof", label: "Gable End (East)", vertices: tri(...east), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness }
    );

    // Fascia boards on the two long eave edges.
    primitives.push(
      { kind: "box", id: `${idPrefix}-fascia-n`, category: "roof", label: "Roof Fascia (North)", position: [0, fasciaY, -halfSpan - FASCIA_T / 2], rotation: [0, 0, 0], size: [halfRidgeLen * 2, FASCIA_H, FASCIA_T], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "box", id: `${idPrefix}-fascia-s`, category: "roof", label: "Roof Fascia (South)", position: [0, fasciaY,  halfSpan + FASCIA_T / 2], rotation: [0, 0, 0], size: [halfRidgeLen * 2, FASCIA_H, FASCIA_T], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness }
    );
  } else {
    const west: [Vec3, Vec3, Vec3, Vec3] = [
      [-halfSpan, baseY, -halfRidgeLen],
      [0, ridgeY, -halfRidgeLen],
      [0, ridgeY, halfRidgeLen],
      [-halfSpan, baseY, halfRidgeLen],
    ];
    const east: [Vec3, Vec3, Vec3, Vec3] = [
      [0, ridgeY, -halfRidgeLen],
      [halfSpan, baseY, -halfRidgeLen],
      [halfSpan, baseY, halfRidgeLen],
      [0, ridgeY, halfRidgeLen],
    ];
    const north: [Vec3, Vec3, Vec3] = [
      [-halfSpan, baseY, -halfRidgeLen],
      [0, ridgeY, -halfRidgeLen],
      [halfSpan, baseY, -halfRidgeLen],
    ];
    const south: [Vec3, Vec3, Vec3] = [
      [-halfSpan, baseY, halfRidgeLen],
      [halfSpan, baseY, halfRidgeLen],
      [0, ridgeY, halfRidgeLen],
    ];

    primitives.push(
      { kind: "triMesh", id: `${idPrefix}-slope-west`, category: "roof", label: "Roof Slope (West)", vertices: quad(...west), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-slope-east`, category: "roof", label: "Roof Slope (East)", vertices: quad(...east), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-north`, category: "roof", label: "Gable End (North)", vertices: tri(...north), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-south`, category: "roof", label: "Gable End (South)", vertices: tri(...south), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness }
    );

    // Fascia boards on the two long eave edges.
    primitives.push(
      { kind: "box", id: `${idPrefix}-fascia-w`, category: "roof", label: "Roof Fascia (West)", position: [-halfSpan - FASCIA_T / 2, fasciaY, 0], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, halfRidgeLen * 2], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "box", id: `${idPrefix}-fascia-e`, category: "roof", label: "Roof Fascia (East)",  position: [ halfSpan + FASCIA_T / 2, fasciaY, 0], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, halfRidgeLen * 2], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness }
    );
  }

  return primitives;
}
