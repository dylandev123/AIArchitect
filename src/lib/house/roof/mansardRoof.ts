import { quad, type Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG, ROOF_THICKNESS } from "../constants";
import type { ResolvedMaterial } from "../materials";

/**
 * French two-zone roof: steep lower band rises from the eave up to a "knee" line,
 * then a flat upper deck spans the remaining interior.
 * Lower band panels are rendered as slope quads; the upper deck is a flat slab with
 * a low parapet.
 */
export function buildMansardRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  const lowerH     = Math.max(1.0, Math.min(width, depth) * 0.28); // steep band height
  const kneeInset  = Math.max(0.6, Math.min(width, depth) * 0.12); // horizontal inset at knee
  const kneeY      = baseY + lowerH;
  const halfW      = width  / 2;
  const halfD      = depth  / 2;
  const eaveHalfW  = halfW  + ROOF_OVERHANG;
  const eaveHalfD  = halfD  + ROOF_OVERHANG;
  const kneeHalfW  = halfW  - kneeInset;
  const kneeHalfD  = halfD  - kneeInset;

  const { color, roughness, metalness }                              = roofMaterial;
  const { color: extColor, roughness: extRoughness, metalness: extMetalness } = exteriorMaterial;

  const PARAPET_H  = 0.28;
  const PARAPET_T  = 0.12;
  const FASCIA_H   = 0.26;
  const FASCIA_T   = 0.10;
  const fasciaY    = baseY - FASCIA_H / 2;

  // ── Lower band slope quads ────────────────────────────────────────────────

  const northLower: [Vec3, Vec3, Vec3, Vec3] = [
    [-eaveHalfW, baseY, -eaveHalfD], // eave NW
    [ eaveHalfW, baseY, -eaveHalfD], // eave NE
    [ kneeHalfW, kneeY, -kneeHalfD], // knee NE
    [-kneeHalfW, kneeY, -kneeHalfD], // knee NW
  ];
  const southLower: [Vec3, Vec3, Vec3, Vec3] = [
    [-eaveHalfW, baseY,  eaveHalfD], // eave SW
    [-kneeHalfW, kneeY,  kneeHalfD], // knee SW
    [ kneeHalfW, kneeY,  kneeHalfD], // knee SE
    [ eaveHalfW, baseY,  eaveHalfD], // eave SE
  ];
  const westLower: [Vec3, Vec3, Vec3, Vec3] = [
    [-eaveHalfW, baseY, -eaveHalfD], // eave NW
    [-kneeHalfW, kneeY, -kneeHalfD], // knee NW
    [-kneeHalfW, kneeY,  kneeHalfD], // knee SW
    [-eaveHalfW, baseY,  eaveHalfD], // eave SW
  ];
  const eastLower: [Vec3, Vec3, Vec3, Vec3] = [
    [ eaveHalfW, baseY, -eaveHalfD], // eave NE
    [ eaveHalfW, baseY,  eaveHalfD], // eave SE
    [ kneeHalfW, kneeY,  kneeHalfD], // knee SE
    [ kneeHalfW, kneeY, -kneeHalfD], // knee NE
  ];

  // ── Upper flat deck ───────────────────────────────────────────────────────

  const deckW = kneeHalfW * 2;
  const deckD = kneeHalfD * 2;
  const deckY = kneeY + ROOF_THICKNESS / 2;

  const primitives: HousePrimitive[] = [
    // Lower band
    { kind: "triMesh", id: `${idPrefix}-lower-n`, category: "roof", label: "Mansard Lower (North)", vertices: quad(...northLower), color, roughness, metalness },
    { kind: "triMesh", id: `${idPrefix}-lower-s`, category: "roof", label: "Mansard Lower (South)", vertices: quad(...southLower), color, roughness, metalness },
    { kind: "triMesh", id: `${idPrefix}-lower-w`, category: "roof", label: "Mansard Lower (West)",  vertices: quad(...westLower),  color, roughness, metalness },
    { kind: "triMesh", id: `${idPrefix}-lower-e`, category: "roof", label: "Mansard Lower (East)",  vertices: quad(...eastLower),  color, roughness, metalness },
    // Upper deck slab
    { kind: "box", id: `${idPrefix}-deck`, category: "roof", label: "Mansard Deck", position: [0, deckY, 0], rotation: [0, 0, 0], size: [deckW, ROOF_THICKNESS, deckD], color, roughness, metalness },
    // Deck parapet walls
    { kind: "box", id: `${idPrefix}-par-n`, category: "roof", label: "Deck Parapet (N)", position: [0, kneeY + PARAPET_H / 2, -kneeHalfD + PARAPET_T / 2], rotation: [0, 0, 0], size: [deckW, PARAPET_H, PARAPET_T], color: extColor, roughness: extRoughness, metalness: extMetalness },
    { kind: "box", id: `${idPrefix}-par-s`, category: "roof", label: "Deck Parapet (S)", position: [0, kneeY + PARAPET_H / 2,  kneeHalfD - PARAPET_T / 2], rotation: [0, 0, 0], size: [deckW, PARAPET_H, PARAPET_T], color: extColor, roughness: extRoughness, metalness: extMetalness },
    { kind: "box", id: `${idPrefix}-par-e`, category: "roof", label: "Deck Parapet (E)", position: [ kneeHalfW - PARAPET_T / 2, kneeY + PARAPET_H / 2, 0], rotation: [0, 0, 0], size: [PARAPET_T, PARAPET_H, deckD], color: extColor, roughness: extRoughness, metalness: extMetalness },
    { kind: "box", id: `${idPrefix}-par-w`, category: "roof", label: "Deck Parapet (W)", position: [-kneeHalfW + PARAPET_T / 2, kneeY + PARAPET_H / 2, 0], rotation: [0, 0, 0], size: [PARAPET_T, PARAPET_H, deckD], color: extColor, roughness: extRoughness, metalness: extMetalness },
    // Eave fascia on all 4 lower edges
    { kind: "box", id: `${idPrefix}-fascia-n`, category: "roof", label: "Roof Fascia (N)", position: [0, fasciaY, -eaveHalfD - FASCIA_T / 2], rotation: [0, 0, 0], size: [eaveHalfW * 2, FASCIA_H, FASCIA_T], color, roughness, metalness },
    { kind: "box", id: `${idPrefix}-fascia-s`, category: "roof", label: "Roof Fascia (S)", position: [0, fasciaY,  eaveHalfD + FASCIA_T / 2], rotation: [0, 0, 0], size: [eaveHalfW * 2, FASCIA_H, FASCIA_T], color, roughness, metalness },
    { kind: "box", id: `${idPrefix}-fascia-e`, category: "roof", label: "Roof Fascia (E)", position: [ eaveHalfW + FASCIA_T / 2, fasciaY, 0], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, eaveHalfD * 2], color, roughness, metalness },
    { kind: "box", id: `${idPrefix}-fascia-w`, category: "roof", label: "Roof Fascia (W)", position: [-eaveHalfW - FASCIA_T / 2, fasciaY, 0], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, eaveHalfD * 2], color, roughness, metalness },
  ];

  return primitives;
}
