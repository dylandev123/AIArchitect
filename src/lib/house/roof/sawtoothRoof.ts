import { quad, type Vec3 } from "../geometryUtils";
import type { HousePrimitive } from "../types";
import { ROOF_OVERHANG } from "../constants";
import type { ResolvedMaterial } from "../materials";

/**
 * Multiple north-facing ridges with vertical clerestory glazing.
 * Teeth run east–west (along the x-axis); the profile repeats north–south.
 * Each tooth has: a slope panel (rising south→north) + a vertical glazing panel
 * at the north ridge edge.
 */
export function buildSawtoothRoof(
  width: number,
  depth: number,
  baseY: number,
  idPrefix: string,
  roofMaterial: ResolvedMaterial,
  _exteriorMaterial: ResolvedMaterial
): HousePrimitive[] {
  const numTeeth = Math.max(2, Math.round(depth / 3.5));
  const toothD   = depth / numTeeth;
  const ridgeH   = Math.max(1.0, depth * 0.22);
  const halfW    = width / 2 + ROOF_OVERHANG;
  const halfD    = depth / 2; // no overhang on z — overhangs only on south eave and north wall

  const { color, roughness, metalness } = roofMaterial;

  const FASCIA_H = 0.28;
  const FASCIA_T = 0.10;
  const GLASS_COLOR = "#a8c4d8";

  const primitives: HousePrimitive[] = [];

  for (let i = 0; i < numTeeth; i++) {
    // South edge of this tooth (z — higher value = more south in our coord system)
    const zSouth = halfD - i * toothD + (i === 0 ? ROOF_OVERHANG : 0);
    // North edge (where the glazing sits)
    const zNorth = halfD - (i + 1) * toothD - (i === numTeeth - 1 ? ROOF_OVERHANG : 0);

    const lowY  = baseY;          // south eave is at wall-top level
    const highY = baseY + ridgeH; // north ridge is elevated

    // Slope panel: rises from south-low to north-high
    const slope: [Vec3, Vec3, Vec3, Vec3] = [
      [-halfW, lowY,  zSouth], // SW
      [ halfW, lowY,  zSouth], // SE
      [ halfW, highY, zNorth], // NE
      [-halfW, highY, zNorth], // NW
    ];

    primitives.push({
      kind: "triMesh",
      id: `${idPrefix}-slope-${i}`,
      category: "roof",
      label: `Sawtooth Slope ${i + 1}`,
      vertices: quad(...slope),
      color, roughness, metalness,
    });

    // Vertical glazing panel at the north ridge edge
    const glazH = ridgeH;
    primitives.push({
      kind: "box",
      id: `${idPrefix}-glaz-${i}`,
      category: "roof",
      label: `Sawtooth Glazing ${i + 1}`,
      position: [0, baseY + glazH / 2, zNorth],
      rotation: [0, 0, 0],
      size: [width + ROOF_OVERHANG * 2, glazH, 0.05],
      color: GLASS_COLOR,
      roughness: 0.10,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55,
    });
  }

  // South eave fascia
  primitives.push({
    kind: "box",
    id: `${idPrefix}-fascia-s`,
    category: "roof",
    label: "Roof Fascia (South)",
    position: [0, baseY - FASCIA_H / 2, halfD + ROOF_OVERHANG + FASCIA_T / 2],
    rotation: [0, 0, 0],
    size: [halfW * 2, FASCIA_H, FASCIA_T],
    color, roughness, metalness,
  });

  // East / west fascias running full depth
  primitives.push(
    { kind: "box", id: `${idPrefix}-fascia-e`, category: "roof", label: "Roof Fascia (East)",  position: [ halfW + FASCIA_T / 2, baseY - FASCIA_H / 2, 0], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, depth + ROOF_OVERHANG * 2], color, roughness, metalness },
    { kind: "box", id: `${idPrefix}-fascia-w`, category: "roof", label: "Roof Fascia (West)",  position: [-halfW - FASCIA_T / 2, baseY - FASCIA_H / 2, 0], rotation: [0, 0, 0], size: [FASCIA_T, FASCIA_H, depth + ROOF_OVERHANG * 2], color, roughness, metalness }
  );

  return primitives;
}
