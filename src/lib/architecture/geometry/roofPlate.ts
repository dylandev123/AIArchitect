import type { HousePrimitive } from "@/lib/house/types";
import { extrudeOutline, flatPolygon, quadVerts, triMeshOf } from "@/lib/house/geometry/mesh";
import type { Paint } from "@/lib/house/architecture/parts";
import type { Point } from "./footprint";

const P2 = (p: Point): [number, number] => [p[0], p[1]];
const DARK: Paint = { color: "#111619", roughness: .88, metalness: 0 };

export interface PolygonRoofInput {
  id: string;
  /** The roof's own outline — the footprint already grown by its overhang (see `offsetFootprintOutline`). */
  outline: readonly Point[];
  /** The top floor's true wall line, for whatever closes the gap between wall plate and roof underside. */
  footprint: readonly Point[];
  wallPlateY: number;
  roof: Paint;
  exterior: Paint;
}

/**
 * A flat/floating-flat roof plate that follows any outline, angled edges included — the counterpart of
 * `buildRoofExpression`'s box plate for a footprint a rectangle decomposition can't represent (a chamfered
 * prow). Same datum: the plate sits `gap` above the wall plate, with a dark shadow reveal filling that gap
 * inside the true footprint so the plane reads as floating rather than detached.
 */
export function buildPolygonRoofPlate(input: PolygonRoofInput & { gap: number; thickness: number }): HousePrimitive[] {
  const planeBottom = input.wallPlateY + input.gap;
  const out: HousePrimitive[] = [
    triMeshOf(`${input.id}-plane`, "roof", "Roof Plane · expression", extrudeOutline(input.outline.map(P2), planeBottom, planeBottom + input.thickness, { bottom: true }), input.roof),
  ];
  if (input.gap > .015) out.push(triMeshOf(`${input.id}-shadow-gap`, "roof", "Roof Shadow Reveal", extrudeOutline(input.footprint.map(P2), input.wallPlateY, planeBottom), DARK));
  return out;
}

export type PolygonShedInput = PolygonRoofInput & { pitchDeg: number; thickness: number };

/** The shed's sloped datum: height of its underside and top surface at any plan point. */
export function shedSlope(input: Pick<PolygonShedInput, "outline" | "wallPlateY" | "pitchDeg" | "thickness">): { zMin: number; zMax: number; underside: (x: number, z: number) => number; top: (x: number, z: number) => number } {
  const zs = input.outline.map((p) => p[1]);
  const zMin = Math.min(...zs), zMax = Math.max(...zs);
  const run = Math.max(zMax - zMin, 1e-6);
  const rise = Math.max(0.45, Math.tan((input.pitchDeg * Math.PI) / 180) * run);
  const underside = (_x: number, z: number) => input.wallPlateY + rise * ((zMax - z) / run);
  return { zMin, zMax, underside, top: (x, z) => underside(x, z) + input.thickness };
}

/**
 * A single-slope roof over any outline: high along the outline's north (−z) edge, low along its south edge,
 * like `buildShedRoof` — but sized by the recipe's own overhang (the outline is already grown by it) and
 * pitch instead of a fixed constant, and following the real footprint rather than one bounding rectangle.
 * The wall line is closed up to the sloped underside with an exterior-material infill band.
 */
export function buildPolygonShedRoof(input: PolygonShedInput): HousePrimitive[] {
  const { underside, top } = shedSlope(input);

  const plane: number[] = [...flatPolygon(input.outline.map(P2), underside), ...flatPolygon(input.outline.map(P2), top)];
  const infill: number[] = [];
  const edgeBand = (loop: readonly Point[], out: number[], lo: (x: number, z: number) => number, hi: (x: number, z: number) => number) => {
    for (let i = 0; i < loop.length; i++) {
      const [ax, az] = loop[i];
      const [bx, bz] = loop[(i + 1) % loop.length];
      quadVerts(out, [ax, lo(ax, az), az], [bx, lo(bx, bz), bz], [bx, hi(bx, bz), bz], [ax, hi(ax, az), az]);
    }
  };
  edgeBand(input.outline, plane, underside, top);
  edgeBand(input.footprint, infill, () => input.wallPlateY, underside);
  return [
    triMeshOf(`${input.id}-slope`, "roof", "Roof Slope", plane, input.roof),
    triMeshOf(`${input.id}-infill`, "roof", "Roof Wall Infill", infill, input.exterior),
  ];
}
