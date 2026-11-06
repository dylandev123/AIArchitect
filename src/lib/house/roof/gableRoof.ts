import { quad, tri, type Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG } from "../constants";
import type { ResolvedMaterial } from "../materials";
import type { RoofShape } from "../architecture/profiles";
import { withFascia } from "./fascia";

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
  exteriorMaterial: ResolvedMaterial,
  shape?: Partial<RoofShape>
): HousePrimitive[] {
  const ridgeAlongX = width >= depth;
  const span = ridgeAlongX ? depth : width;
  const roofHeight = Math.max(0.6, span * (shape?.pitch ?? 0.35));
  const ridgeY = baseY + roofHeight;
  const eave = shape?.overhang ?? ROOF_OVERHANG;
  const rake = shape?.rakeOverhang ?? eave;
  // Projection per side (builder compass, north = -z): eaves on the two long sides, rakes at the gable ends; `eaves` overrides single sides.
  const side = {
    north: shape?.eaves?.north ?? (ridgeAlongX ? eave : rake), south: shape?.eaves?.south ?? (ridgeAlongX ? eave : rake),
    west: shape?.eaves?.west ?? (ridgeAlongX ? rake : eave), east: shape?.eaves?.east ?? (ridgeAlongX ? rake : eave),
  };
  const ridgeLen = (ridgeAlongX ? width : depth) / 2;
  // Extents of the roof beyond the nominal centre in each direction.
  const e0 = ridgeAlongX ? ridgeLen + side.west : ridgeLen + side.north, e1 = ridgeAlongX ? ridgeLen + side.east : ridgeLen + side.south;
  const s0 = span / 2 + (ridgeAlongX ? side.north : side.west), s1 = span / 2 + (ridgeAlongX ? side.south : side.east);
  const roofColor = roofMaterial.color;
  const wallColor = exteriorMaterial.color;
  const primitives: HousePrimitive[] = [];

  const FASCIA_H = 0.28;
  const FASCIA_T = 0.10;
  const fasciaY = baseY - FASCIA_H / 2;

  if (ridgeAlongX) {
    const north: [Vec3, Vec3, Vec3, Vec3] = [
      [-e0, baseY, -s0],
      [e1, baseY, -s0],
      [e1, ridgeY, 0],
      [-e0, ridgeY, 0],
    ];
    const south: [Vec3, Vec3, Vec3, Vec3] = [
      [-e0, ridgeY, 0],
      [e1, ridgeY, 0],
      [e1, baseY, s1],
      [-e0, baseY, s1],
    ];
    const west: [Vec3, Vec3, Vec3] = [
      [-e0, baseY, -s0],
      [-e0, ridgeY, 0],
      [-e0, baseY, s1],
    ];
    const east: [Vec3, Vec3, Vec3] = [
      [e1, baseY, -s0],
      [e1, baseY, s1],
      [e1, ridgeY, 0],
    ];

    primitives.push(
      { kind: "triMesh", id: `${idPrefix}-slope-north`, category: "roof", label: "Roof Slope (North)", vertices: quad(...north), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-slope-south`, category: "roof", label: "Roof Slope (South)", vertices: quad(...south), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-west`, category: "roof", label: "Gable End (West)", vertices: tri(...west), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-east`, category: "roof", label: "Gable End (East)", vertices: tri(...east), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness }
    );

    // Fascia boards on the two long eave edges.
    primitives.push(
      { kind: "box", id: `${idPrefix}-fascia-n`, category: "roof", label: "Roof Fascia (North)", position: [(e1 - e0) / 2, fasciaY, -s0 - FASCIA_T / 2], rotation: [0, 0, 0], size: [e0 + e1, FASCIA_H, FASCIA_T], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "box", id: `${idPrefix}-fascia-s`, category: "roof", label: "Roof Fascia (South)", position: [(e1 - e0) / 2, fasciaY,  s1 + FASCIA_T / 2], rotation: [0, 0, 0], size: [e0 + e1, FASCIA_H, FASCIA_T], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness }
    );
  } else {
    const west: [Vec3, Vec3, Vec3, Vec3] = [
      [-s0, baseY, -e0],
      [0, ridgeY, -e0],
      [0, ridgeY, e1],
      [-s0, baseY, e1],
    ];
    const east: [Vec3, Vec3, Vec3, Vec3] = [
      [0, ridgeY, -e0],
      [s1, baseY, -e0],
      [s1, baseY, e1],
      [0, ridgeY, e1],
    ];
    const north: [Vec3, Vec3, Vec3] = [
      [-s0, baseY, -e0],
      [0, ridgeY, -e0],
      [s1, baseY, -e0],
    ];
    const south: [Vec3, Vec3, Vec3] = [
      [-s0, baseY, e1],
      [s1, baseY, e1],
      [0, ridgeY, e1],
    ];

    primitives.push(
      { kind: "triMesh", id: `${idPrefix}-slope-west`, category: "roof", label: "Roof Slope (West)", vertices: quad(...west), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-slope-east`, category: "roof", label: "Roof Slope (East)", vertices: quad(...east), color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-north`, category: "roof", label: "Gable End (North)", vertices: tri(...north), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness },
      { kind: "triMesh", id: `${idPrefix}-gable-south`, category: "roof", label: "Gable End (South)", vertices: tri(...south), color: wallColor, roughness: exteriorMaterial.roughness, metalness: exteriorMaterial.metalness }
    );

    // Fascia boards on the two long eave edges.
    primitives.push(
      { kind: "box", id: `${idPrefix}-fascia-w`, category: "roof", label: "Roof Fascia (West)", position: [-s0 - FASCIA_T / 2, fasciaY, (e1 - e0) / 2], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, e0 + e1], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness },
      { kind: "box", id: `${idPrefix}-fascia-e`, category: "roof", label: "Roof Fascia (East)",  position: [ s1 + FASCIA_T / 2, fasciaY, (e1 - e0) / 2], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, e0 + e1], color: roofColor, roughness: roofMaterial.roughness, metalness: roofMaterial.metalness }
    );
  }

  return withFascia(primitives, shape?.fascia);
}
