import type { PathConfig } from "@/types/house";
import { pathCurve } from "@/lib/house/features/paths";
import type { P2 } from "@/lib/house/geometry/mesh";
import { fromMassLocal, massHalfExtents, toMassLocal, type MassFootprint } from "./massFootprint";

/** Kept between a path's edge and a building's wall. */
const WALL_CLEARANCE = 0.6;
/** A path point this far inside a wall is inside the building; a point on the wall line (a door) is not. */
const INSIDE_TOLERANCE = 0.05;
const MAX_DETOURS = 4;

type Rect = { hw: number; hd: number };
const strictlyInside = (p: P2, r: Rect, by = 0) => Math.abs(p[0]) < r.hw - by && Math.abs(p[1]) < r.hd - by;

/** Onto the nearest side of the rectangle (a point already outside is left where it is). */
function toBoundary(p: P2, r: Rect): P2 {
  if (!strictlyInside(p, r)) return p;
  const gaps = [r.hw - p[0], p[0] + r.hw, r.hd - p[1], p[1] + r.hd];
  const nearest = gaps.indexOf(Math.min(...gaps));
  return nearest === 0 ? [r.hw, p[1]] : nearest === 1 ? [-r.hw, p[1]] : nearest === 2 ? [p[0], r.hd] : [p[0], -r.hd];
}

/** Arc-length position of a boundary point, running -z edge (+x) → +x edge (+z) → +z edge (−x) → −x edge (−z). */
function perimeterPosition(p: P2, r: Rect): number {
  const d = [Math.abs(p[1] + r.hd), Math.abs(p[0] - r.hw), Math.abs(p[1] - r.hd), Math.abs(p[0] + r.hw)];
  const edge = d.indexOf(Math.min(...d));
  if (edge === 0) return p[0] + r.hw;
  if (edge === 1) return 2 * r.hw + p[1] + r.hd;
  if (edge === 2) return 2 * r.hw + 2 * r.hd + r.hw - p[0];
  return 4 * r.hw + 2 * r.hd + r.hd - p[1];
}

/** The corners passed walking the perimeter from `a` to `b`, forward (+1) or backward (−1). */
function cornersBetween(a: number, b: number, r: Rect, dir: 1 | -1): { corners: P2[]; length: number } {
  const total = 4 * r.hw + 4 * r.hd;
  const at: [number, P2][] = [[0, [-r.hw, -r.hd]], [2 * r.hw, [r.hw, -r.hd]], [2 * r.hw + 2 * r.hd, [r.hw, r.hd]], [4 * r.hw + 2 * r.hd, [-r.hw, r.hd]]];
  const span = (((dir === 1 ? b - a : a - b) % total) + total) % total;
  const ahead = (s: number) => (((dir === 1 ? s - a : a - s) % total) + total) % total;
  const corners = at.filter(([s]) => { const t = ahead(s); return t > 1e-6 && t < span - 1e-6; }).sort((x, y) => ahead(x[0]) - ahead(y[0])).map(([, p]) => p);
  return { corners, length: span };
}

/** True when the open segment a→b stays out of the rectangle's interior (its end points may sit on the boundary). */
function segmentClear(a: P2, b: P2, r: Rect): boolean {
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    if (strictlyInside([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], r, 0.02)) return false;
  }
  return true;
}

/**
 * The obstacle a path must go round when it runs into `hit`: that mass alone (its own turned rectangle), or — when
 * other masses stand within a path's clearance of it, so no path could pass between them — the box around the whole
 * cluster, so a detour around one never cuts through its neighbour.
 */
function obstacleAround(hit: MassFootprint, masses: readonly MassFootprint[], pad: number): { obstacle: MassFootprint; members: MassFootprint[] } {
  const box = (m: MassFootprint) => { const { halfW, halfD } = massHalfExtents(m); return { x0: m.cx - halfW - pad, x1: m.cx + halfW + pad, z0: m.cz - halfD - pad, z1: m.cz + halfD + pad }; };
  const members = [hit];
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of masses) {
      if (members.includes(m)) continue;
      const b = box(m);
      if (members.some((n) => { const a = box(n); return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0; })) { members.push(m); grew = true; }
    }
  }
  if (members.length === 1) return { obstacle: hit, members };
  const boxes = members.map((m) => ({ m, ...massHalfExtents(m) }));
  const x0 = Math.min(...boxes.map((b) => b.m.cx - b.halfW)), x1 = Math.max(...boxes.map((b) => b.m.cx + b.halfW));
  const z0 = Math.min(...boxes.map((b) => b.m.cz - b.halfD)), z1 = Math.max(...boxes.map((b) => b.m.cz + b.halfD));
  return { obstacle: { id: members.map((m) => m.id).join("+"), cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, width: x1 - x0, depth: z1 - z0, rotation: 0 }, members };
}

/**
 * Executes an authored path without letting it cross a building. A path whose line enters a mass (a point on the
 * wall itself, such as a door, does not count) is carried around that mass instead: from where it would enter to
 * where it would leave, along the mass's outline kept `WALL_CLEARANCE` clear of its walls, the shorter way round (or,
 * when both ways are about as long, the side the authored bend already bowed toward), cutting each corner the walls
 * allow. Masses standing too close together to pass between are gone round as one. Its end points, width and
 * surface are kept; a detoured path is straight between turns.
 */
export function routePathAroundMasses(path: PathConfig, masses: readonly MassFootprint[], depth = 0): PathConfig[] {
  if (!masses.length || depth >= MAX_DETOURS) return [path];
  const curve = pathCurve(path);
  const struck = masses.find((m) => curve.some((p) => strictlyInside(toMassLocal(m, p[0], p[1]), { hw: m.width / 2, hd: m.depth / 2 }, INSIDE_TOLERANCE)));
  if (!struck) return [path];

  const pad = path.width / 2 + WALL_CLEARANCE;
  const { obstacle: hit, members } = obstacleAround(struck, masses, pad);
  const r: Rect = { hw: hit.width / 2 + pad, hd: hit.depth / 2 + pad };
  const local = curve.map((p) => toMassLocal(hit, p[0], p[1]));
  const first = local.findIndex((p) => strictlyInside(p, r));
  const last = local.length - 1 - [...local].reverse().findIndex((p) => strictlyInside(p, r));
  const entry = toBoundary(local[first], r), exit = toBoundary(local[last], r);
  const sa = perimeterPosition(entry, r), sb = perimeterPosition(exit, r);
  const forward = cornersBetween(sa, sb, r, 1), backward = cornersBetween(sa, sb, r, -1);
  const mid = local[Math.floor(local.length / 2)];
  const nearMid = (w: { corners: P2[] }) => Math.min(Infinity, ...w.corners.map((c) => Math.hypot(c[0] - mid[0], c[1] - mid[1])));
  const walk = Math.abs(forward.length - backward.length) > 1 ? (forward.length < backward.length ? forward : backward) : (nearMid(forward) <= nearMid(backward) ? forward : backward);

  const start = local[0], end = local[local.length - 1];
  const raw: P2[] = [start, entry, ...walk.corners, exit, end];
  // Cut every corner the building allows: from each kept point, jump to the farthest point still reachable in a
  // straight line clear of the mass.
  const pts: P2[] = [raw[0]];
  for (let i = 0; i < raw.length - 1;) {
    let j = raw.length - 1;
    while (j > i + 1 && !segmentClear(raw[i], raw[j], r)) j--;
    pts.push(raw[j]);
    i = j;
  }
  const world = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-3).map((p) => fromMassLocal(hit, p[0], p[1]));
  const others = masses.filter((m) => !members.includes(m));
  return world.slice(1).flatMap((b, i) => {
    const a = world[i];
    return routePathAroundMasses({ ...path, x1: a[0], z1: a[1], x2: b[0], z2: b[1], bend: 0 }, others, depth + 1);
  });
}
