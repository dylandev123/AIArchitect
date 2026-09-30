import type { HousePrimitive } from "@/lib/house/types";
import type { Paint } from "@/lib/house/architecture/parts";
import { add, cross, dot, planeCentre, scale, sub, unit } from "./planes";
import type { RoofAssembly, RoofEdge, V3 } from "./types";

const UP: V3 = [0, 1, 0];

/**
 * A straight member from `a` to `b`, appended to `out` as triangles: `width` across, `height` along the
 * direction nearest `upHint` that is square to the run. `shift` moves its centre line; `extend` lengthens
 * both ends (to close a corner).
 */
export function beam(out: number[], a: V3, b: V3, width: number, height: number, opts: { upHint?: V3; shift?: V3; extend?: number } = {}): void {
  const dir = unit(sub(b, a));
  const hint = opts.upHint ?? UP;
  const up = unit(sub(hint, scale(dir, dot(hint, dir))));
  const side = cross(dir, up);
  const shift = opts.shift ?? [0, 0, 0];
  const start = add(sub(a, scale(dir, opts.extend ?? 0)), shift);
  const end = add(add(b, scale(dir, opts.extend ?? 0)), shift);
  const corner = (p: V3, i: number, j: number) => add(add(p, scale(side, (i - 0.5) * width)), scale(up, (j - 0.5) * height));
  const quad = (p: V3, q: V3, r: V3, s: V3) => out.push(...p, ...q, ...r, ...p, ...r, ...s);
  for (const [i0, j0, i1, j1] of [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]] as const) quad(corner(start, i0, j0), corner(end, i0, j0), corner(end, i1, j1), corner(start, i1, j1));
  for (const p of [start, end]) quad(corner(p, 0, 0), corner(p, 1, 0), corner(p, 1, 1), corner(p, 0, 1));
}

const outward = (edge: RoofEdge): V3 => [edge.out![0], 0, edge.out![1]];

/**
 * Trim never widens a roof: the recipe's overhang is the roof's outermost line, so every member here sits on
 * or inside the edge it finishes.
 */
const BOARD_SETBACK = 0.012;

/** A board under an outer edge of a sheet roof (fascia on an eave, barge board on a rake), set just back from the covering's edge so the covering laps it. */
export function edgeBoard(out: number[], edge: RoofEdge, height: number, thickness: number): void {
  const dir = unit(sub(edge.b, edge.a));
  const up = unit(sub(UP, scale(dir, dot(UP, dir))));
  beam(out, edge.a, edge.b, thickness, height, { shift: add(scale(outward(edge), -(thickness / 2 + BOARD_SETBACK)), scale(up, -(height / 2 + 0.02))) });
}

/**
 * A raised rim along an outer edge of a roof that has its own thickness (a slab or plate): its outer face
 * continues the edge upward. It stops its own height short of each end, so on a sloped rake its square-cut end
 * never leans out past the eave.
 */
export function edgeRim(out: number[], edge: RoofEdge, width: number, height: number): void {
  const dir = unit(sub(edge.b, edge.a));
  const up = unit(sub(UP, scale(dir, dot(UP, dir))));
  beam(out, edge.a, edge.b, width, height, { shift: add(scale(outward(edge), -width / 2), scale(up, height / 2)), extend: -height });
}

/**
 * A cap over a ridge, hip or valley: one leaf lying on each face that meets there, so it follows the pitch
 * instead of hovering over it. A hip's cap starts one leaf up from the eave corner, where it would otherwise
 * splay past both eaves.
 */
export function lineCap(out: number[], edge: RoofEdge, leaf: number, thickness: number): void {
  const dir = unit(sub(edge.b, edge.a));
  const start = edge.kind === "hip" ? add(edge.a, scale(dir, leaf)) : edge.a;
  for (const plane of edge.planes ?? []) {
    const toward = sub(planeCentre(plane), edge.a);
    const inward = unit(sub(toward, scale(dir, dot(toward, dir))));
    // Lifted a hair off the face so the cap's underside never z-fights the roof seen from below.
    beam(out, start, edge.b, leaf + thickness / 2, thickness, { upHint: plane.normal, shift: add(scale(inward, leaf / 2 - thickness / 4), scale(plane.normal, thickness / 2 + 0.004)) });
  }
}

export interface PitchedTrimSpec { board: { height: number; thickness: number }; rim: { width: number; height: number }; cap: { leaf: number; thickness: number }; valley: { leaf: number; thickness: number } }

/** Edge trim for pitched faces, as two triangle soups: the members on outer edges, and the caps along lines where faces meet. */
export function pitchedTrim(assembly: RoofAssembly, spec: PitchedTrimSpec): { boards: number[]; caps: number[] } {
  const boards: number[] = [], caps: number[] = [];
  for (const edge of assembly.edges) {
    if (edge.kind === "eave" || edge.kind === "high-eave" || edge.kind === "rake") {
      if (!edge.out) continue;
      if (assembly.slab) edgeRim(boards, edge, spec.rim.width, spec.rim.height);
      else edgeBoard(boards, edge, spec.board.height, spec.board.thickness);
    }
    else if (edge.kind === "ridge" || edge.kind === "hip") lineCap(caps, edge, spec.cap.leaf, spec.cap.thickness);
    else if (edge.kind === "valley") lineCap(caps, edge, spec.valley.leaf, spec.valley.thickness);
  }
  return { boards, caps };
}

const COPING = { height: 0.05, lip: 0.02 };
const DRIP = { width: 0.08, height: 0.04 };
/** Mirrors `buildParapetPrimitives`: the parapet's outer face sits this far proud of the roof edge. */
const PARAPET_PROUD = 0.01;

/**
 * The edge detail a flat roof needs: a coping cap along the top of its parapet when it has one (a little wider
 * than the wall, so it throws a shadow line), otherwise a drip edge raised along the plate's rim.
 */
export function flatEdgeTrim(assembly: RoofAssembly): { vertices: number[]; label: string } {
  const vertices: number[] = [];
  const perimeter = assembly.edges.filter((e) => e.kind === "perimeter" && e.out);
  const parapet = assembly.parapet;
  for (const edge of perimeter) {
    if (parapet) {
      const width = parapet.thickness + COPING.lip * 2;
      const lift = parapet.topY - edge.a[1] + COPING.height / 2;
      beam(vertices, edge.a, edge.b, width, COPING.height, { shift: add(scale(outward(edge), PARAPET_PROUD - parapet.thickness / 2), [0, lift, 0]), extend: COPING.lip + PARAPET_PROUD });
    } else edgeRim(vertices, edge, DRIP.width, DRIP.height);
  }
  return { vertices, label: parapet ? "Parapet Coping" : "Roof Drip Edge" };
}

/** A merged trim mesh, or nothing when there is no trim to draw. */
export function trimMesh(id: string, label: string, vertices: number[], paint: Paint): HousePrimitive[] {
  return vertices.length ? [{ kind: "triMesh", id, category: "roof", label, vertices, ...paint }] : [];
}
