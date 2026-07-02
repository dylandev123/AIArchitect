import { quad, tri, type Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG } from "../constants";
import type { ResolvedMaterial } from "../materials";

/**
 * Ridge runs along the longer footprint axis with length = longer - shorter
 * (collapsing to a single apex point — a pyramid hip — when width === depth).
 * Two trapezoidal slopes flank the ridge; two triangular slopes cap the ends.
 */
export function buildHipRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  _exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  const ridgeAlongX = width >= depth;
  const longer = Math.max(width, depth);
  const shorter = Math.min(width, depth);
  const roofHeight = Math.max(0.6, shorter * 0.35);
  const ridgeY = baseY + roofHeight;
  const halfRidge = Math.max(0, longer - shorter) / 2;
  const halfShort = shorter / 2 + ROOF_OVERHANG;
  const halfLong = longer / 2 + ROOF_OVERHANG;
  const color = roofMaterial.color;
  const roughness = roofMaterial.roughness;
  const metalness = roofMaterial.metalness;
  const primitives: HousePrimitive[] = [];

  if (ridgeAlongX) {
    const nw: Vec3 = [-halfLong, baseY, -halfShort];
    const ne: Vec3 = [halfLong, baseY, -halfShort];
    const se: Vec3 = [halfLong, baseY, halfShort];
    const sw: Vec3 = [-halfLong, baseY, halfShort];
    const ridgeW: Vec3 = [-halfRidge, ridgeY, 0];
    const ridgeE: Vec3 = [halfRidge, ridgeY, 0];

    const northFace: [Vec3, Vec3, Vec3, Vec3] = [nw, ne, ridgeE, ridgeW];
    const southFace: [Vec3, Vec3, Vec3, Vec3] = [sw, ridgeW, ridgeE, se];
    const eastFace: [Vec3, Vec3, Vec3] = [ne, se, ridgeE];
    const westFace: [Vec3, Vec3, Vec3] = [nw, ridgeW, sw];

    primitives.push(
      { kind: "triMesh", id: `${idPrefix}-hip-north`, category: "roof", label: "Roof Hip (North)", vertices: quad(...northFace), color, roughness, metalness },
      { kind: "triMesh", id: `${idPrefix}-hip-south`, category: "roof", label: "Roof Hip (South)", vertices: quad(...southFace), color, roughness, metalness },
      { kind: "triMesh", id: `${idPrefix}-hip-east`, category: "roof", label: "Roof Hip (East)", vertices: tri(...eastFace), color, roughness, metalness },
      { kind: "triMesh", id: `${idPrefix}-hip-west`, category: "roof", label: "Roof Hip (West)", vertices: tri(...westFace), color, roughness, metalness }
    );
  } else {
    const nw: Vec3 = [-halfShort, baseY, -halfLong];
    const ne: Vec3 = [halfShort, baseY, -halfLong];
    const se: Vec3 = [halfShort, baseY, halfLong];
    const sw: Vec3 = [-halfShort, baseY, halfLong];
    const ridgeN: Vec3 = [0, ridgeY, -halfRidge];
    const ridgeS: Vec3 = [0, ridgeY, halfRidge];

    const westFace: [Vec3, Vec3, Vec3, Vec3] = [nw, ridgeN, ridgeS, sw];
    const eastFace: [Vec3, Vec3, Vec3, Vec3] = [ne, se, ridgeS, ridgeN];
    const northFace: [Vec3, Vec3, Vec3] = [nw, ne, ridgeN];
    const southFace: [Vec3, Vec3, Vec3] = [sw, ridgeS, se];

    primitives.push(
      { kind: "triMesh", id: `${idPrefix}-hip-west`, category: "roof", label: "Roof Hip (West)", vertices: quad(...westFace), color, roughness, metalness },
      { kind: "triMesh", id: `${idPrefix}-hip-east`, category: "roof", label: "Roof Hip (East)", vertices: quad(...eastFace), color, roughness, metalness },
      { kind: "triMesh", id: `${idPrefix}-hip-north`, category: "roof", label: "Roof Hip (North)", vertices: tri(...northFace), color, roughness, metalness },
      { kind: "triMesh", id: `${idPrefix}-hip-south`, category: "roof", label: "Roof Hip (South)", vertices: tri(...southFace), color, roughness, metalness }
    );
  }

  return primitives;
}
