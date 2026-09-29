import type { HousePrimitive } from "@/lib/house/types";
import { box, type Paint } from "@/lib/house/architecture/parts";
import type { Point } from "./footprint";

const EPS = 1e-6;
const OUTER_PROUD = 0.01;

/**
 * A low wall running the full perimeter of a flat/floating-flat roof's own polygon (already grown by its
 * overhang, see `offsetRectilinearPolygon`) — the classic modern-house parapet silhouette instead of a bare
 * roof edge. It spans `bottomY`..`topY` (the caller starts it at the wall plate so it wraps the roof plate's
 * edge), with its outer face flush with the polygon edge. One box per polygon edge, generic to any
 * direction: a horizontal/vertical edge keeps a plain unrotated box; an angled edge is rotated to follow it.
 */
export function buildParapetPrimitives(polygon: readonly Point[], bottomY: number, topY: number, thickness: number, paint: Paint, idPrefix: string): HousePrimitive[] {
  const height = topY - bottomY;
  if (height <= EPS) return [];
  const primitives: HousePrimitive[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < EPS) continue;
    // (dz, -dx)/length is the outward normal for this clockwise loop — same convention as buildPlainWallEdge.
    // The outer face sits 1cm proud of the edge so it never z-fights the roof plate's own edge face.
    const inset = thickness / 2 - OUTER_PROUD;
    const cx = (a[0] + b[0]) / 2 - (dz / length) * inset;
    const cz = (a[1] + b[1]) / 2 + (dx / length) * inset;
    const y = bottomY + height / 2;
    const id = `${idPrefix}-${i}`;
    const alongX = Math.abs(dz) < EPS;
    const alongZ = Math.abs(dx) < EPS;
    if (alongX || alongZ) {
      primitives.push(box(id, "wall", "Parapet", [cx, y, cz], alongX ? [length, height, thickness] : [thickness, height, length], paint));
    } else {
      primitives.push(box(id, "wall", "Parapet", [cx, y, cz], [thickness, height, length], paint, [0, Math.atan2(dx, dz), 0]));
    }
  }
  return primitives;
}
