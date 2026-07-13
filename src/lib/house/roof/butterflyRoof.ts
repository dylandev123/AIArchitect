import { quad, tri, type Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG } from "../constants";
import type { ResolvedMaterial } from "../materials";

/**
 * Inverted V ("butterfly / V-roof"): outer eaves are high, centre valley is low.
 * The valley runs east–west at z=0; two slopes fall inward from north and south eaves.
 * A shallow gutter box marks the valley centre.
 */
export function buildButterflyRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  const ridgeH   = Math.max(0.8, depth * 0.30);
  const outerY   = baseY + ridgeH; // eave height (outer edges are high)
  const valleyY  = baseY;          // valley at wall-top level
  const halfW    = width  / 2 + ROOF_OVERHANG;
  const halfD    = depth  / 2 + ROOF_OVERHANG;

  const { color, roughness, metalness } = roofMaterial;
  const { color: extColor, roughness: extRoughness, metalness: extMetalness } = exteriorMaterial;

  const FASCIA_H = 0.28;
  const FASCIA_T = 0.10;

  // Corner vertices
  const nw: Vec3 = [-halfW, outerY, -halfD];
  const ne: Vec3 = [ halfW, outerY, -halfD];
  const se: Vec3 = [ halfW, outerY,  halfD];
  const sw: Vec3 = [-halfW, outerY,  halfD];
  const vw: Vec3 = [-halfW, valleyY, 0];  // valley west
  const ve: Vec3 = [ halfW, valleyY, 0];  // valley east

  // North slope: falls from north eave DOWN toward valley
  const northSlope: [Vec3, Vec3, Vec3, Vec3] = [nw, ne, ve, vw];
  // South slope: rises from valley UP toward south eave
  const southSlope: [Vec3, Vec3, Vec3, Vec3] = [vw, ve, se, sw];

  // Gable triangular fill closing east / west faces
  const gableW: [Vec3, Vec3, Vec3] = [nw, vw, sw];
  const gableE: [Vec3, Vec3, Vec3] = [ne, se, ve];

  const fasciaY = outerY - FASCIA_H / 2;

  return [
    { kind: "triMesh", id: `${idPrefix}-slope-n`, category: "roof", label: "Roof Slope (North)", vertices: quad(...northSlope), color, roughness, metalness },
    { kind: "triMesh", id: `${idPrefix}-slope-s`, category: "roof", label: "Roof Slope (South)", vertices: quad(...southSlope), color, roughness, metalness },
    { kind: "triMesh", id: `${idPrefix}-gable-w`, category: "roof", label: "Gable End (West)",   vertices: tri(...gableW),      color: extColor, roughness: extRoughness, metalness: extMetalness },
    { kind: "triMesh", id: `${idPrefix}-gable-e`, category: "roof", label: "Gable End (East)",   vertices: tri(...gableE),      color: extColor, roughness: extRoughness, metalness: extMetalness },
    // Valley gutter box
    { kind: "box", id: `${idPrefix}-gutter`, category: "roof", label: "Valley Gutter", position: [0, valleyY + 0.04, 0], rotation: [0, 0, 0], size: [width + ROOF_OVERHANG * 2, 0.08, 0.22], color, roughness, metalness },
    // Fascias on north and south outer eaves
    { kind: "box", id: `${idPrefix}-fascia-n`, category: "roof", label: "Roof Fascia (North)", position: [0, fasciaY, -halfD - FASCIA_T / 2], rotation: [0, 0, 0], size: [halfW * 2, FASCIA_H, FASCIA_T], color, roughness, metalness },
    { kind: "box", id: `${idPrefix}-fascia-s`, category: "roof", label: "Roof Fascia (South)", position: [0, fasciaY,  halfD + FASCIA_T / 2], rotation: [0, 0, 0], size: [halfW * 2, FASCIA_H, FASCIA_T], color, roughness, metalness },
  ];
}
