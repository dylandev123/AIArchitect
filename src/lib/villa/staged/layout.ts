import type {Block, HouseSpec, PlanNode, RoomType, Side} from './spec';

export interface R {x0: number; x1: number; z0: number; z1: number}
export interface Room extends R {id: string; name: string; type: RoomType; block: string; level: number}
export interface Edge {a: string; b: string; axis: 'x' | 'z'; line: number; lo: number; hi: number; sameBlock: boolean}

export const snap = (v: number) => Math.round(v * 1000) / 1000;
export const blockRect = (b: Pick<Block, 'cx' | 'cz' | 'w' | 'd'>): R => ({x0: snap(b.cx - b.w / 2), x1: snap(b.cx + b.w / 2), z0: snap(b.cz - b.d / 2), z1: snap(b.cz + b.d / 2)});
export const area = (r: R) => (r.x1 - r.x0) * (r.z1 - r.z0);
export const overlapArea = (a: R, b: R) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
export const inside = (r: R, x: number, z: number) => x > r.x0 - 1e-6 && x < r.x1 + 1e-6 && z > r.z0 - 1e-6 && z < r.z1 + 1e-6;

export function layoutRooms(block: Block): Room[] {
  const out: Room[] = [];
  const walk = (node: PlanNode, r: R) => {
    if ('room' in node) { out.push({...node.room, ...r, block: block.id, level: block.level}); return; }
    if (node.split === 'x') {
      const m = snap(r.x0 + node.at);
      walk(node.a, {...r, x1: m}); walk(node.b, {...r, x0: m});
    } else {
      const m = snap(r.z0 + node.at);
      walk(node.a, {...r, z1: m}); walk(node.b, {...r, z0: m});
    }
  };
  walk(block.plan, blockRect(block));
  return out;
}

export const allRooms = (spec: Pick<HouseSpec, 'blocks'>) => spec.blocks.flatMap(layoutRooms);

/** Shared wall segments between every pair of same-level rooms. */
export function roomEdges(rooms: Room[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const p = rooms[i], q = rooms[j];
    if (p.level !== q.level) continue;
    const sameBlock = p.block === q.block;
    // Vertical line x = const (wall runs along z).
    for (const [left, right] of [[p, q], [q, p]] as const) {
      if (Math.abs(left.x1 - right.x0) < 1e-4) {
        const lo = Math.max(left.z0, right.z0), hi = Math.min(left.z1, right.z1);
        if (hi - lo > 0.05) edges.push({a: left.id, b: right.id, axis: 'x', line: left.x1, lo, hi, sameBlock});
      }
      if (Math.abs(left.z1 - right.z0) < 1e-4) {
        const lo = Math.max(left.x0, right.x0), hi = Math.min(left.x1, right.x1);
        if (hi - lo > 0.05) edges.push({a: left.id, b: right.id, axis: 'z', line: left.z1, lo, hi, sameBlock});
      }
    }
  }
  return edges;
}

/** Axis-aligned rectangle difference: `r` minus every cut, as up to many disjoint strips. */
export function rectDiff(r: R, cuts: R[]): R[] {
  let pieces: R[] = [r];
  for (const c of cuts) {
    pieces = pieces.flatMap(p => {
      if (c.x1 <= p.x0 + 1e-6 || c.x0 >= p.x1 - 1e-6 || c.z1 <= p.z0 + 1e-6 || c.z0 >= p.z1 - 1e-6) return [p];
      const res: R[] = [];
      if (c.z0 > p.z0 + 1e-6) res.push({...p, z1: c.z0});
      if (c.z1 < p.z1 - 1e-6) res.push({...p, z0: c.z1});
      const z0 = Math.max(p.z0, c.z0), z1 = Math.min(p.z1, c.z1);
      if (c.x0 > p.x0 + 1e-6) res.push({x0: p.x0, x1: c.x0, z0, z1});
      if (c.x1 < p.x1 - 1e-6) res.push({x0: c.x1, x1: p.x1, z0, z1});
      return res;
    });
  }
  return pieces.filter(p => p.x1 - p.x0 > 0.02 && p.z1 - p.z0 > 0.02);
}

/** Intervals [lo,hi] of [a,b] not covered by any of `cover`. */
export function subtractIntervals(a: number, b: number, cover: [number, number][]): [number, number][] {
  let free: [number, number][] = [[a, b]];
  for (const [lo, hi] of cover) free = free.flatMap(([x, y]) => hi <= x + 1e-6 || lo >= y - 1e-6 ? [[x, y] as [number, number]] : [[x, Math.max(x, lo)] as [number, number], [Math.min(y, hi), y] as [number, number]].filter(([p, q]) => q - p > 1e-6));
  return free;
}

export const SIDES: Side[] = ['n', 's', 'e', 'w'];
export const sideLine = (r: R, s: Side) => s === 'n' ? r.z0 : s === 's' ? r.z1 : s === 'e' ? r.x1 : r.x0;
/** Edge-axis of the wall running along a side: n/s walls run along x. */
export const sideRun = (r: R, s: Side): [number, number] => s === 'n' || s === 's' ? [r.x0, r.x1] : [r.z0, r.z1];
export const roomSideInterval = (room: R, block: R, s: Side): [number, number] | undefined => {
  if (Math.abs(sideLine(room, s) - sideLine(block, s)) > 1e-4) return undefined;
  const [lo, hi] = sideRun(room, s);
  return hi - lo > 0.05 ? [lo, hi] : undefined;
};

/** Longest shared wall (m) between two same-level rectangles that touch along an edge; 0 when they do not. */
export function roomEdgesBetween(p: R, q: R): number {
  let best = 0;
  if (Math.abs(p.x1 - q.x0) < 0.02 || Math.abs(q.x1 - p.x0) < 0.02) best = Math.max(best, Math.min(p.z1, q.z1) - Math.max(p.z0, q.z0));
  if (Math.abs(p.z1 - q.z0) < 0.02 || Math.abs(q.z1 - p.z0) < 0.02) best = Math.max(best, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0));
  return Math.max(0, best);
}
