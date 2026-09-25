import type { HousePrimitive } from "../types";
import type { ResolvedMaterial } from "../materials";
import { ROOF_OVERHANG } from "../constants";
import { box, paintOf, shade } from "./parts";

/**
 * Extra roof-edge layering for generic gable and hip roofs — the difference between a roof that is a sheet of
 * tiles and one that has a soffit under its eave, a drip board below the fascia, a crown moulding and a ridge cap.
 * `layers` is the tier's roofLayers: 1 adds the soffit and drip board, 2 adds the moulding and ridge cap.
 * Other roof forms already carry their own detail and are left alone.
 */
export function buildRoofDetail(
  kind: "gable" | "hip",
  width: number,
  depth: number,
  baseY: number,
  layers: 1 | 2,
  trim: ResolvedMaterial,
  roof: ResolvedMaterial
): HousePrimitive[] {
  const ridgeAlongX = width >= depth;
  const long = ridgeAlongX ? width : depth;
  const span = ridgeAlongX ? depth : width;
  const overhang = ROOF_OVERHANG;
  const ridgeY = baseY + Math.max(0.6, span * 0.35);
  const trimPaint = paintOf(trim);
  const out: HousePrimitive[] = [];

  // Runs of eave: the two long edges of a gable; every edge of a hip.
  const edges: { id: string; alongX: boolean; sign: 1 | -1 }[] = ridgeAlongX
    ? [{ id: "n", alongX: true, sign: -1 }, { id: "s", alongX: true, sign: 1 }]
    : [{ id: "w", alongX: false, sign: -1 }, { id: "e", alongX: false, sign: 1 }];
  if (kind === "hip") {
    edges.push(...(ridgeAlongX ? [{ id: "w", alongX: false, sign: -1 as const }, { id: "e", alongX: false, sign: 1 as const }] : [{ id: "n", alongX: true, sign: -1 as const }, { id: "s", alongX: true, sign: 1 as const }]));
  }

  for (const { id, alongX, sign } of edges) {
    // Length of this eave and how far out its tip sits from the centre line.
    const length = (alongX ? width : depth) + overhang * 2;
    const half = (alongX ? depth : width) / 2 + overhang;
    const at = (out2: number, y: number): [number, number, number] => (alongX ? [0, y, sign * out2] : [sign * out2, y, 0]);
    const size = (along: number, h: number, thick: number): [number, number, number] => (alongX ? [along, h, thick] : [thick, h, along]);

    out.push(
      box(`roof-soffit-${id}`, "roof", "Roof Soffit", at((half - overhang) + overhang / 2, baseY - 0.03), size(length, 0.05, overhang), trimPaint),
      box(`roof-drip-${id}`, "roof", "Roof Drip Board", at(half + 0.06, baseY - 0.31), size(length + 0.04, 0.07, 0.15), trimPaint)
    );
    if (layers >= 2) {
      out.push(box(`roof-crown-${id}`, "roof", "Roof Crown Moulding", at(half - overhang + 0.09, baseY - 0.11), size(length - overhang * 2 + 0.16, 0.12, 0.17), trimPaint));
    }
  }

  if (layers >= 2) {
    const ridgeLength = kind === "hip" ? Math.max(0.5, long - span) : long + overhang * 2;
    out.push(
      box("roof-ridge-cap", "roof", "Roof Ridge Cap", [0, ridgeY + 0.05, 0], ridgeAlongX ? [ridgeLength, 0.14, 0.34] : [0.34, 0.14, ridgeLength], paintOf(roof, shade(roof.color, 0.82)))
    );
  }
  return out;
}
