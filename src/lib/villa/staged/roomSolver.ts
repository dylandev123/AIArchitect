import {SIDES, blockRect, roomEdges, sideLine, sideRun, snap, subtractIntervals, type Edge, type R, type Room} from './layout';
import {DOOR_WALL, NEEDS_EXTERIOR, OPEN_WALL, ROOM_RULES, STAIR_LONG, STAIR_SHORT, programmeIssues, stairPair, type Conflict, type ProgConnection, type ProgRoom, type Programme} from './programme';
import type {Block, HouseSpec, Link, PlanNode, Side} from './spec';
import type {Finding} from './validate';

/**
 * Room construction: turns a house-wide room programme into guillotine plans, links and stairs.
 *
 * The existing geometry kernel is the guillotine tree (`PlanNode`) + `layoutRooms`/`roomEdges`.
 * That kernel only EVALUATES a tree. This file adds the missing generator, kept deliberately
 * small: per block, a memoised beam search over (subset of rooms, rectangle) that tries every
 * two-way split of the subset on both axes at area-proportional cuts (plus a few alignment cuts
 * for stairs/landings), pruning by hard room rules. Blocks are then combined by backtracking over
 * their top candidates so that cross-block connections and the stair/landing stack line up.
 * It is NOT a general constraint solver: no non-rectangular rooms, no cuts other than the
 * proportional/alignment ones, bounded beam. When nothing fits it says which requirements clash.
 */
const EPS = 1e-6, GRID = 0.1, MATERIAL = 1.5;
const grid = (v: number) => Math.round(v / GRID) * GRID;
const WEIGHT: Record<ProgRoom['priority'], number> = {core: 0.4, normal: 1, flex: 2.5};

interface PRoom extends ProgRoom {tgt: number; idx: number}
type Leaf = R & {id: string};
/** `touch`: for every room that was asked to lie on a cut line, its stretch along that line (so the two sides of a cut can check they really overlap). */
interface Sub {node: PlanNode; pen: number; sig: string; touch?: Record<string, [number, number]>}
const r1 = (v: number) => Math.round(v * 10) / 10;
const leafSig = (id: string, r: R) => `${id}:${r1(r.x0)},${r1(r.x1)},${r1(r.z0)},${r1(r.z1)}`;
/** Rebuild leaf rectangles from a plan tree exactly as `layoutRooms` does. */
function leavesOf(node: PlanNode, r: R, out: Leaf[] = []): Leaf[] {
  if ('room' in node) { out.push({id: node.room.id, ...r}); return out; }
  if (node.split === 'x') { const m = snap(r.x0 + node.at); leavesOf(node.a, {...r, x1: m}, out); leavesOf(node.b, {...r, x0: m}, out); }
  else { const m = snap(r.z0 + node.at); leavesOf(node.a, {...r, z1: m}, out); leavesOf(node.b, {...r, z0: m}, out); }
  return out;
}
export interface BlockCandidate {block: string; node: PlanNode; leaves: Leaf[]; pen: number; unmet: string[]; sig: string}

export interface SolveOptions {
  maxOptions?: number; requiredBedrooms?: number; requiredBaths?: number;
  /** Beam width for sub-states / root candidates. */
  beam?: number; rootBeam?: number; nodeBudget?: number;
  /** Independent validation of a built slice (the real stage-3 measure); layouts it rejects are never offered. */
  check?: (slice: Stage3Slice) => Finding[];
}
export interface Stage3Slice {plans: Record<string, PlanNode>; links: Link[]; stairs: HouseSpec['stairs']}
export interface LayoutOption {
  id: string; score: number; slice: Stage3Slice; rooms: Room[];
  /** Links the software added so every room is reachable (not requested by the programme). */
  addedLinks: Link[];
  metrics: {facingMet: number; facingWanted: number; maxAspect: number; worstAreaDeviation: number; addedLinks: number};
}
export type SolveResult = {ok: true; options: LayoutOption[]; stats: SolveStats} | {ok: false; conflicts: Conflict[]; stats?: SolveStats};
export interface SolveStats {nodes: number; exhausted: boolean; blockCandidates: Record<string, number>; groundCombos: number; fullCandidates: number}

const leafSigKey = (l: Leaf) => `${l.x0.toFixed(2)},${l.x1.toFixed(2)},${l.z0.toFixed(2)},${l.z1.toFixed(2)}`;
const rectKey = (r: R) => `${r.x0.toFixed(2)},${r.x1.toFixed(2)},${r.z0.toFixed(2)},${r.z1.toFixed(2)}`;
const popcount = (m: number) => { let n = 0; for (; m; m &= m - 1) n++; return n; };
const containsRect = (outer: R, inner: R, tol = 0.05) => inner.x0 >= outer.x0 - tol && inner.x1 <= outer.x1 + tol && inner.z0 >= outer.z0 - tol && inner.z1 <= outer.z1 + tol;
const asRoom = (l: Leaf, p: ProgRoom, b: Block): Room => ({id: l.id, name: p.name, type: p.type, x0: l.x0, x1: l.x1, z0: l.z0, z1: l.z1, block: b.id, level: b.level});

/** Exterior wall of a block = its side minus stretches shared with a same-level neighbouring block. */
function exteriorIntervals(block: Block, blocks: Block[]): Record<Side, [number, number][]> {
  const r = blockRect(block), out = {} as Record<Side, [number, number][]>;
  const opp = {n: 's', s: 'n', e: 'w', w: 'e'} as const;
  for (const s of SIDES) {
    const [a, b] = sideRun(r, s), cover: [number, number][] = [];
    for (const o of blocks) if (o.id !== block.id && o.level === block.level) {
      const q = blockRect(o);
      if (Math.abs(sideLine(q, opp[s]) - sideLine(r, s)) > 0.02) continue;
      const [lo, hi] = sideRun(q, s);
      if (Math.min(hi, b) - Math.max(lo, a) > 0.01) cover.push([lo, hi]);
    }
    out[s] = subtractIntervals(a, b, cover);
  }
  return out;
}
const sideContact = (leaf: R, rect: R, ext: [number, number][], s: Side) => {
  if (Math.abs(sideLine(leaf, s) - sideLine(rect, s)) > 1e-4) return 0;
  const [a, b] = sideRun(leaf, s);
  return ext.reduce((t, [lo, hi]) => t + Math.max(0, Math.min(hi, b) - Math.max(lo, a)), 0);
};

interface BlockCtx {
  block: Block; rect: R; rooms: PRoom[]; ext: Record<Side, [number, number][]>;
  /** Region the stair room must lie inside (the landing's upper block). */
  stairZone: Map<string, R>;
  /** Footprints no cut may pass through. */
  keepWhole: R[];
  /** Upper room that must contain the given footprint (the landing above a stair). */
  mustContain: Map<string, R>;
  conns: ProgConnection[];
  /** Cross-block connections: the room must touch the wall it shares with the other block. */
  borders: Map<string, Seg[]>;
}
interface Seg {axis: 'x' | 'z'; line: number; lo: number; hi: number; need: number; other: string}
function borderSegs(a: R, b: R): Omit<Seg, 'need' | 'other'> | undefined {
  if (Math.abs(a.x1 - b.x0) < 0.02 || Math.abs(b.x1 - a.x0) < 0.02) { const lo = Math.max(a.z0, b.z0), hi = Math.min(a.z1, b.z1); if (hi - lo > 0.05) return {axis: 'x', line: Math.abs(a.x1 - b.x0) < 0.02 ? a.x1 : a.x0, lo, hi}; }
  if (Math.abs(a.z1 - b.z0) < 0.02 || Math.abs(b.z1 - a.z0) < 0.02) { const lo = Math.max(a.x0, b.x0), hi = Math.min(a.x1, b.x1); if (hi - lo > 0.05) return {axis: 'z', line: Math.abs(a.z1 - b.z0) < 0.02 ? a.z1 : a.z0, lo, hi}; }
  return undefined;
}
const segContact = (r: R, g: Seg) => g.axis === 'x'
  ? (Math.abs(r.x1 - g.line) < 1e-3 || Math.abs(r.x0 - g.line) < 1e-3 ? Math.max(0, Math.min(r.z1, g.hi) - Math.max(r.z0, g.lo)) : 0)
  : (Math.abs(r.z1 - g.line) < 1e-3 || Math.abs(r.z0 - g.line) < 1e-3 ? Math.max(0, Math.min(r.x1, g.hi) - Math.max(r.x0, g.lo)) : 0);

/** Scale target areas so the rooms of a block fill it exactly; flex rooms absorb most of the change. */
function scaleTargets(rooms: ProgRoom[], total: number): PRoom[] {
  const min = (r: ProgRoom) => ROOM_RULES[r.type]?.minArea ?? 9;
  let tgt = rooms.map(r => Math.max(min(r), r.area));
  for (let pass = 0; pass < 4; pass++) {
    const sum = tgt.reduce((s, v) => s + v, 0), diff = total - sum;
    if (Math.abs(diff) < 1e-6) break;
    const w = tgt.map((v, i) => WEIGHT[rooms[i].priority] * v * (diff < 0 && v <= min(rooms[i]) + 1e-9 ? 0 : 1)), ws = w.reduce((s, v) => s + v, 0);
    if (ws <= 0) break;
    tgt = tgt.map((v, i) => Math.max(min(rooms[i]), v + diff * w[i] / ws));
  }
  const sum = tgt.reduce((s, v) => s + v, 0);
  tgt = tgt.map(v => v * total / sum);
  return rooms.map((r, i) => ({...r, tgt: tgt[i], idx: i}));
}

class Budget { nodes = 0; exhausted = false; constructor(readonly max: number) {} tick(work = 1) { this.nodes += work; if (this.nodes > this.max) { this.exhausted = true; return false; } return true; } }
/** A room that must touch one side of the rectangle it is being placed in (inherited from a cut it must connect across). */
interface Req {i: number; id: string; side: Side; need: number}
const reqKey = (q: Req[]) => q.map(x => `${x.id}${x.side}${x.need}`).sort().join(',');

function leafOf(ctx: BlockCtx, room: PRoom, r: R): {pen: number} | undefined {
  const w = r.x1 - r.x0, d = r.z1 - r.z0, a = w * d, rule = ROOM_RULES[room.type] ?? {minDim: 2.4, minArea: 9, maxAspect: 3};
  const short = Math.min(w, d), long = Math.max(w, d);
  if (short < rule.minDim - EPS || a < rule.minArea - 0.2 || long / short > rule.maxAspect + EPS) return undefined;
  if (room.type === 'stair') {
    if (!((w >= STAIR_LONG - 0.01 && d >= STAIR_SHORT - 0.01) || (d >= STAIR_LONG - 0.01 && w >= STAIR_SHORT - 0.01))) return undefined;
    const zone = ctx.stairZone.get(room.id);
    if (zone && !containsRect(zone, r)) return undefined;
  }
  for (const g of ctx.borders.get(room.id) ?? []) if (segContact(r, g) < g.need - EPS) return undefined;
  const must = ctx.mustContain.get(room.id);
  if (must && !containsRect(r, must)) return undefined;
  if (NEEDS_EXTERIOR.has(room.type)) {
    const contact = SIDES.reduce((t, s) => t + sideContact(r, ctx.rect, ctx.ext[s], s), 0);
    if (contact < (room.type === 'foyer' ? 2.7 : 1.5) - EPS) return undefined;
  }
  const dev = (a - room.tgt) / room.tgt;
  let pen = WEIGHT[room.priority] > 1 ? 1.2 * dev * dev : (room.priority === 'core' ? 5 : 3) * dev * dev;
  pen += 0.5 * Math.max(0, long / short - (room.type === 'hall' || room.type === 'gallery' ? 8 : 1.8)) ** 2;
  if (room.facing !== 'any' && sideContact(r, ctx.rect, ctx.ext[room.facing], room.facing) < 1.2) pen += 2.5;
  return {pen};
}

/**
 * A search item is one room, or an ensuite SUITE: a bathroom whose only connection is one bedroom is
 * placed together with it (the pair splits one rectangle), which shrinks the subset search a lot.
 */
interface Item {rooms: PRoom[]; tgt: number; minArea: number; minDim: number}
function buildItems(ctx: BlockCtx): Item[] {
  const paired = new Set<string>(), items: Item[] = [];
  const degree = (id: string) => ctx.conns.filter(k => k.a === id || k.b === id);
  for (const bath of ctx.rooms) {
    if (bath.type !== 'bath') continue;
    const ks = degree(bath.id);
    if (ks.length !== 1 || ks[0].kind !== 'door') continue;
    const other = ctx.rooms.find(r => r.id === (ks[0].a === bath.id ? ks[0].b : ks[0].a));
    if (!other || other.type !== 'bedroom' || paired.has(other.id)) continue;
    paired.add(other.id); paired.add(bath.id);
    items.push({rooms: [other, bath], tgt: other.tgt + bath.tgt, minArea: (ROOM_RULES.bedroom.minArea) + ROOM_RULES.bath.minArea, minDim: 3});
  }
  for (const r of ctx.rooms) if (!paired.has(r.id)) items.push({rooms: [r], tgt: r.tgt, minArea: ROOM_RULES[r.type]?.minArea ?? 9, minDim: ROOM_RULES[r.type]?.minDim ?? 2.4});
  return items;
}

function searchBlock(ctx: BlockCtx, beam: number, rootBeam: number, budget: Budget): Sub[] {
  const items = buildItems(ctx), n = items.length, memo = new Map<string, Sub[]>();
  const itemOf = (id: string) => items.findIndex(it => it.rooms.some(r => r.id === id));
  const minAxis = items.map(i => i.minDim), minArea = items.map(i => i.minArea), tgt = items.map(i => i.tgt);
  const connIdx = ctx.conns.map(k => [itemOf(k.a), itemOf(k.b), k.kind === 'door' ? 0.9 : 0.5, k.a, k.b] as const).filter(([a, b]) => a >= 0 && b >= 0 && a !== b);
  const sumOf = (arr: number[], m: number) => { let s = 0; for (let i = 0; i < n; i++) if (m & (1 << i)) s += arr[i]; return s; };
  const maxOf = (arr: number[], m: number) => { let s = 0; for (let i = 0; i < n; i++) if (m & (1 << i)) s = Math.max(s, arr[i]); return s; };
  const sideLen = (r: R, side: Side) => side === 'n' || side === 's' ? r.x1 - r.x0 : r.z1 - r.z0;
  const touchOf = (req: Req[], id: string, rr: R) => Object.fromEntries(req.filter(q => q.id === id).map(q => [`${q.id}${q.side}`, sideRun(rr, q.side)] as [string, [number, number]]));
  const roomNode = (p: PRoom): PlanNode => ({room: {id: p.id, name: p.name, type: p.type}});

  /** Necessary condition: the rooms of `mask` cannot all fit their required wall (exterior daylight, cut-line connections) along this rectangle's perimeter. */
  const wallCapacityOk = (mask: number, r: R, req: Req[]) => {
    let need = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) for (const room of items[i].rooms) if (NEEDS_EXTERIOR.has(room.type)) need += room.type === 'foyer' ? 2.7 : 1.5;
    if (need > 0 && need > SIDES.reduce((t, sd) => t + sideContact(r, ctx.rect, ctx.ext[sd], sd), 0) + EPS) return false;
    for (const sd of SIDES) { const want = req.filter(q => q.side === sd).reduce((t, q) => t + q.need, 0); if (want > sideLen(r, sd) + EPS) return false; }
    return true;
  };

  /** Place one item in rectangle r: a single room, or a bedroom+bath suite split four ways. */
  function leaf(i: number, r: R, req: Req[]): Sub[] {
    const it = items[i];
    if (it.rooms.length === 1) {
      const p = it.rooms[0];
      if (!req.every(q => q.id !== p.id || sideLen(r, q.side) >= q.need - EPS)) return [];
      const l = leafOf(ctx, p, r);
      return l ? [{node: roomNode(p), pen: l.pen, sig: leafSig(p.id, r), touch: touchOf(req, p.id, r)}] : [];
    }
    const [bed, bath] = it.rooms, out: Sub[] = [], w = r.x1 - r.x0, d = r.z1 - r.z0;
    for (const axis of ['x', 'z'] as const) {
      const ext = axis === 'x' ? w : d, other = axis === 'x' ? d : w, lo0 = axis === 'x' ? r.x0 : r.z0;
      const minBath = Math.max(ROOM_RULES.bath.minDim, ROOM_RULES.bath.minArea / other);
      for (const bathExt of new Set([Math.max(Math.ceil(minBath / GRID) * GRID, grid(bath.tgt / other)), Math.ceil(minBath / GRID) * GRID])) {
        if (ext - bathExt < ROOM_RULES.bedroom.minDim - EPS) continue;
        for (const bathFirst of [true, false]) {
          const at = snap(bathFirst ? bathExt : ext - bathExt), m = snap(lo0 + at);
          const ra = axis === 'x' ? {...r, x1: m} : {...r, z1: m}, rb = axis === 'x' ? {...r, x0: m} : {...r, z0: m};
          const rBath = bathFirst ? ra : rb, rBed = bathFirst ? rb : ra;
          // A requirement on a member needs that member's own rectangle to lie on the named side of r.
          const onSide = (q: Req) => { const rr = q.id === bath.id ? rBath : rBed; const line = sideLine(rr, q.side) ; return Math.abs(line - sideLine(r, q.side)) < 1e-6 && sideLen(rr, q.side) >= q.need - EPS; };
          if (!req.every(onSide)) continue;
          const lb = leafOf(ctx, bath, rBath), ld = leafOf(ctx, bed, rBed);
          if (!lb || !ld) continue;
          const [first, second] = bathFirst ? [bath, bed] : [bed, bath];
          out.push({node: {split: axis, at, a: roomNode(first), b: roomNode(second)}, pen: lb.pen + ld.pen, sig: `${leafSig(bath.id, rBath)}|${leafSig(bed.id, rBed)}`, touch: {...touchOf(req, bath.id, rBath), ...touchOf(req, bed.id, rBed)}});
        }
      }
    }
    return out.sort((x, y) => x.pen - y.pen).slice(0, 3);
  }

  function go(mask: number, r: R, K: number, req: Req[]): Sub[] {
    const key = `${K}|${mask}|${rectKey(r)}|${reqKey(req)}`, hit = memo.get(key);
    if (hit) return hit;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    let result: Sub[] = [];
    if (popcount(mask) === 1) result = leaf(31 - Math.clz32(mask), r, req);
    else if (w * d >= sumOf(minArea, mask) - 0.2 && Math.min(w, d) >= maxOf(minAxis, mask) - EPS && wallCapacityOk(mask, r, req) && budget.tick()) {
      const seen = new Set<string>();
      // Bounded best-K list: children are sorted by penalty, so a pair that cannot beat the worst kept entry ends its row.
      const offer = (pen: number, sig: string, touch: Sub['touch'], make: () => PlanNode) => {
        if (result.length >= K && pen >= result[K - 1].pen) return false;
        if (seen.has(sig)) return true;
        seen.add(sig);
        let at = result.length; while (at > 0 && result[at - 1].pen > pen) at--;
        result.splice(at, 0, {node: make(), pen, sig, touch}); if (result.length > K) result.pop();
        return true;
      };
      for (let S = (mask - 1) & mask; S > 0; S = (S - 1) & mask) {
        const T = mask ^ S, aS = sumOf(tgt, S), aT = sumOf(tgt, T);
        const crossing = connIdx.filter(([a, b]) => (((S >> a) & 1) && ((T >> b) & 1)) || (((S >> b) & 1) && ((T >> a) & 1)));
        const cross = crossing.reduce((t, c) => t + c[2], 0);
        for (const axis of ['x', 'z'] as const) {
          const ext = axis === 'x' ? w : d, lo0 = axis === 'x' ? r.x0 : r.z0;
          const mS = maxOf(minAxis, S), mT = maxOf(minAxis, T);
          const lo = Math.ceil(mS / GRID - 1e-9) * GRID, hi = Math.floor((ext - mT) / GRID + 1e-9) * GRID;
          if (lo > hi + 1e-9) continue;
          const sSide: Side = axis === 'x' ? 'e' : 's', tSide: Side = axis === 'x' ? 'w' : 'n';
          // Carry inherited requirements down only to the child that still owns that side of r.
          const keeps = (child: 'S' | 'T', side: Side) => axis === 'x' ? (side === 'n' || side === 's' || (child === 'S' ? side === 'w' : side === 'e')) : (side === 'e' || side === 'w' || (child === 'S' ? side === 'n' : side === 's'));
          if (req.some(q => ((S >> q.i) & 1) ? !keeps('S', q.side) : !keeps('T', q.side))) continue;
          const cuts = new Set<number>(), add = (v: number) => cuts.add(Math.min(hi, Math.max(lo, grid(v))));
          const prop = ext * aS / (aS + aT);
          add(prop);
          for (let i = 0; i < n; i++) if (items[i].rooms[0].type === 'stair') for (const L of [STAIR_LONG + 0.1, STAIR_SHORT + 0.1]) { if (S & (1 << i)) add(L); if (T & (1 << i)) add(ext - L); }
          // The stair room must end up inside its landing block: offer cuts on that block's edges.
          for (let i = 0; i < n; i++) { const zone = items[i].rooms[0].type === 'stair' ? ctx.stairZone.get(items[i].rooms[0].id) : undefined; if (zone && (mask & (1 << i))) for (const v of axis === 'x' ? [zone.x0, zone.x1] : [zone.z0, zone.z1]) add(v - lo0); }
          for (const z of ctx.keepWhole) { const zl = (axis === 'x' ? z.x0 : z.z0) - lo0, zh = (axis === 'x' ? z.x1 : z.z1) - lo0; if (prop > zl - 0.5 && prop < zh + 0.5) { add(zl); add(zh); } }
          for (const cut of cuts) {
            const at = snap(cut), m = snap(lo0 + at);
            if (ctx.keepWhole.some(z => (axis === 'x' ? z.x0 < m - 0.01 && m < z.x1 - 0.01 && z.z0 < r.z1 && z.z1 > r.z0 : z.z0 < m - 0.01 && m < z.z1 - 0.01 && z.x0 < r.x1 && z.x1 > r.x0))) continue;
            const rs = axis === 'x' ? {...r, x1: m} : {...r, z1: m}, rt = axis === 'x' ? {...r, x0: m} : {...r, z0: m};
            if ((rs.x1 - rs.x0) * (rs.z1 - rs.z0) < sumOf(minArea, S) - 0.2 || (rt.x1 - rt.x0) * (rt.z1 - rt.z0) < sumOf(minArea, T) - 0.2) continue;
            // Every required connection across this cut forces both rooms against it.
            const add2 = new Map<string, Req>(), put = (q: Req) => { const k = `${q.id}${q.side}`; const o = add2.get(k); if (!o || o.need < q.need) add2.set(k, q); };
            for (const q of req) put(q);
            for (const [a, b, wt, ida, idb] of crossing) { const need = wt > 0.7 ? DOOR_WALL : OPEN_WALL, aIn = (S >> a) & 1; put({i: aIn ? a : b, id: aIn ? ida : idb, side: sSide, need}); put({i: aIn ? b : a, id: aIn ? idb : ida, side: tSide, need}); }
            const rq = [...add2.values()], reqS = rq.filter(q => (S >> q.i) & 1), reqT = rq.filter(q => (T >> q.i) & 1);
            if (reqS.some(q => sideLen(rs, q.side) < q.need - EPS) || reqT.some(q => sideLen(rt, q.side) < q.need - EPS)) continue;
            const A = go(S, rs, beam, reqS); if (!A.length) continue;
            const B = go(T, rt, beam, reqT); if (!B.length) continue;
            budget.tick(A.length * B.length);
            for (const a of A) for (const b of B) {
              const pen = a.pen + b.pen + 0.6 * cross;
              if (result.length >= K && pen >= result[K - 1].pen) break;
              // Both rooms of every connection across the cut must really overlap along it.
              if (!crossing.every(([ca, , wt, ida, idb]) => { const aIn = (S >> ca) & 1, ia = (aIn ? a : b).touch?.[`${aIn ? ida : idb}${aIn ? sSide : tSide}`], ib = (aIn ? b : a).touch?.[`${aIn ? idb : ida}${aIn ? tSide : sSide}`]; return !ia || !ib || Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]) >= (wt > 0.7 ? DOOR_WALL : OPEN_WALL) - EPS; })) continue;
              offer(pen, a.sig < b.sig ? `${a.sig}|${b.sig}` : `${b.sig}|${a.sig}`, {...a.touch, ...b.touch}, () => ({split: axis, at, a: a.node, b: b.node}));
            }
          }
        }
        if (budget.exhausted) break;
      }
    }
    memo.set(key, result);
    return result;
  }
  return go((1 << n) - 1, ctx.rect, rootBeam, []);
}

/** Exact within-block connection check on a finished candidate. */
function candidateOf(ctx: BlockCtx, s: Sub): BlockCandidate {
  const leaves = leavesOf(s.node, ctx.rect), rooms = leaves.map(l => asRoom(l, ctx.rooms.find(r => r.id === l.id)!, ctx.block)), edges = roomEdges(rooms), unmet: string[] = [];
  for (const k of ctx.conns) {
    if (!rooms.some(r => r.id === k.a) || !rooms.some(r => r.id === k.b)) continue;
    const len = Math.max(0, ...edges.filter(e => (e.a === k.a && e.b === k.b) || (e.a === k.b && e.b === k.a)).map(e => e.hi - e.lo));
    if (len < (k.kind === 'door' ? DOOR_WALL : OPEN_WALL) - EPS) unmet.push(`${k.a}—${k.b}`);
  }
  return {block: ctx.block.id, node: s.node, leaves, pen: s.pen, unmet, sig: s.sig};
}

const sharedLen = (p: R, q: R) => { let best = 0; if (Math.abs(p.x1 - q.x0) < 1e-4 || Math.abs(q.x1 - p.x0) < 1e-4) best = Math.max(best, Math.min(p.z1, q.z1) - Math.max(p.z0, q.z0)); if (Math.abs(p.z1 - q.z0) < 1e-4 || Math.abs(q.z1 - p.z0) < 1e-4) best = Math.max(best, Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0)); return Math.max(0, best); };

/** Conflicts that can be artefacts of the bounded search rather than of the programme itself. */
const SEARCH_LIMITED = new Set(['cross-block-connections', 'connection-unsatisfiable', 'block-unsolvable', 'search-budget']);
/**
 * Solve with the default bounded search; if it fails only for search-limited reasons, widen the per-block
 * candidate beams (the cross-block combination needs diverse block layouts) before reporting a conflict.
 * A programme that already solves is unaffected, so accepted historical layouts are reproduced exactly.
 */
export function solveProgramme(spec: Pick<HouseSpec, 'site' | 'blocks' | 'openSpaces'>, prog: Programme, opts: SolveOptions = {}): SolveResult {
  let result = solveProgrammeOnce(spec, prog, opts);
  if (result.ok || opts.beam !== undefined || opts.rootBeam !== undefined) return result;
  for (const wider of [{beam: 8, rootBeam: 120}, {beam: 12, rootBeam: 240, nodeBudget: 12000000}]) {
    if (result.ok || !result.conflicts.every(c => SEARCH_LIMITED.has(c.code))) return result;
    result = solveProgrammeOnce(spec, prog, {...opts, ...wider});
  }
  return result;
}

function solveProgrammeOnce(spec: Pick<HouseSpec, 'site' | 'blocks' | 'openSpaces'>, prog: Programme, opts: SolveOptions = {}): SolveResult {
  const issues = programmeIssues(prog, spec, {bedrooms: opts.requiredBedrooms, baths: opts.requiredBaths});
  if (issues.length) return {ok: false, conflicts: issues};
  const beam = opts.beam ?? 4, rootBeam = opts.rootBeam ?? 30, budget = new Budget(opts.nodeBudget ?? 4000000);
  const blockById = new Map(spec.blocks.map(b => [b.id, b])), roomById = new Map(prog.rooms.map(r => [r.id, r]));
  const stats: SolveStats = {nodes: 0, exhausted: false, blockCandidates: {}, groundCombos: 0, fullCandidates: 0};
  const connsOf = (b: string) => prog.connections.filter(k => roomById.get(k.a)?.block === b && roomById.get(k.b)?.block === b && !stairPair(prog, k.a, k.b));
  const crossConns = prog.connections.filter(k => { const a = roomById.get(k.a)!, b = roomById.get(k.b)!; return a.block !== b.block && a.id !== b.id && !stairPair(prog, k.a, k.b) && blockById.get(a.block)!.level === blockById.get(b.block)!.level; });
  const ctxFor = (b: Block, zones: Map<string, R>, keep: R[], must: Map<string, R>): BlockCtx => {
    const mine = prog.rooms.filter(r => r.block === b.id), borders = new Map<string, Seg[]>();
    for (const k of crossConns) for (const [me, they] of [[k.a, k.b], [k.b, k.a]] as const) {
      const mr = roomById.get(me)!, tr = roomById.get(they)!;
      if (mr.block !== b.id) continue;
      const g = borderSegs(blockRect(b), blockRect(blockById.get(tr.block)!));
      if (g) borders.set(me, [...(borders.get(me) ?? []), {...g, need: k.kind === 'door' ? DOOR_WALL : OPEN_WALL, other: they}]);
    }
    return {borders, block: b, rect: blockRect(b), rooms: scaleTargets(mine, b.w * b.d), ext: exteriorIntervals(b, spec.blocks as Block[]), stairZone: zones, keepWhole: keep, mustContain: must, conns: connsOf(b.id)};
  };
  const conflicts: Conflict[] = [];
  const stop = () => { if (budget.exhausted) conflicts.push({code: 'search-budget', subject: 'solver', message: `The bounded layout search stopped after ${budget.nodes} steps without finishing; the programme has too many rooms in one block (${Math.max(...spec.blocks.map(b => prog.rooms.filter(r => r.block === b.id).length))}). Split the largest block's rooms across blocks or merge small rooms.`}); stats.nodes = budget.nodes; stats.exhausted = budget.exhausted; };
  // Stair zones for ground stair rooms.
  const zones = new Map<string, R>();
  for (const s of prog.stairs) zones.set(s.room, blockRect(blockById.get(roomById.get(s.landing)!.block)!));

  const candidates = (ctx: BlockCtx): BlockCandidate[] => {
    let subs = searchBlock(ctx, beam, rootBeam, budget), cands = subs.map(s => candidateOf(ctx, s));
    if (!cands.some(c => !c.unmet.length) && !budget.exhausted) { // widen once before giving up on connections
      subs = searchBlock(ctx, beam * 4, rootBeam * 3, budget); cands = subs.map(s => candidateOf(ctx, s));
    }
    cands.sort((a, b) => a.unmet.length - b.unmet.length || a.pen - b.pen);
    return cands.filter(c => c.unmet.length === 0).concat(cands.filter(c => c.unmet.length > 0).slice(0, 2));
  };
  const explainBlock = (ctx: BlockCtx, cands: BlockCandidate[]) => {
    const b = ctx.block;
    const degree = ctx.rooms.map(r => [r.id, ctx.conns.filter(k => k.a === r.id || k.b === r.id).length] as const).filter(([, n]) => n >= 3).sort((x, y) => y[1] - x[1]).map(([id, n]) => `${id} (${n} connections)`);
    if (cands.length) { const best = cands[0]; conflicts.push({code: 'connection-unsatisfiable', subject: b.id, message: `In block ${b.id} (${(b.w).toFixed(1)}×${(b.d).toFixed(1)} m) every layout found leaves ${best.unmet.join(', ')} without ≥${DOOR_WALL} m of shared wall${degree.length ? `; most demanding rooms: ${degree.join(', ')}` : ''}. These connections need rooms that can sit side by side; reduce the number of rooms that must touch the same room, or split them across blocks.`}); return; }
    const rs = ctx.rooms, types = rs.map(r => `${r.id}(${r.type},~${r.tgt.toFixed(0)}m²)`).join(', ');
    const ext = rs.filter(r => NEEDS_EXTERIOR.has(r.type)).length;
    const perim = SIDES.reduce((t, s) => t + ctx.ext[s].reduce((u, [lo, hi]) => u + hi - lo, 0), 0);
    const need = rs.reduce((t, r) => t + (r.type === 'foyer' ? 2.7 : NEEDS_EXTERIOR.has(r.type) ? 1.5 : 0), 0);
    conflicts.push({code: 'block-unsolvable', subject: b.id, message: `No arrangement of ${types} fits block ${b.id} (${b.w.toFixed(1)}×${b.d.toFixed(1)} m = ${(b.w * b.d).toFixed(0)} m²) under the room rules (minimum sizes, aspect ratios, ${ext} rooms needing an exterior wall${need > perim ? `: they need ≥${need.toFixed(1)} m of free exterior wall but the block has ${perim.toFixed(1)} m` : ''}${[...ctx.stairZone.keys()].some(id => rs.some(r => r.id === id)) ? ', stair room must lie directly under its landing block' : ''}${ctx.mustContain.size ? ', landing must cover the stair below' : ''}). Remove or merge rooms, or move some to another block.${degree.length ? ` Rooms with many required connections: ${degree.join(', ')}.` : ''}`});
  };

  // ---- Ground (level 0) blocks ----
  const ground = spec.blocks.filter(b => b.level === 0), upper = spec.blocks.filter(b => b.level === 1);
  const gCtx = ground.map(b => ctxFor(b, zones, [], new Map())), gCands = gCtx.map(candidates);
  gCtx.forEach((c, i) => { stats.blockCandidates[c.block.id] = gCands[i].length; if (!gCands[i].length || gCands[i].every(x => x.unmet.length)) explainBlock(c, gCands[i]); });
  if (conflicts.length) { stop(); return {ok: false, conflicts, stats}; }

  const asRooms = (cands: BlockCandidate[]) => cands.flatMap(c => c.leaves.map(l => asRoom(l, roomById.get(l.id)!, blockById.get(c.block)!)));
  const crossBroken = (chosen: BlockCandidate[], level: number): string[] => {
    const rooms = asRooms(chosen), by = new Map(rooms.map(r => [r.id, r])), bad: string[] = [];
    for (const k of crossConns) { const a = by.get(k.a), b = by.get(k.b); if (a && b && a.level === level && sharedLen(a, b) < (k.kind === 'door' ? DOOR_WALL : OPEN_WALL) - EPS) bad.push(`${k.a}—${k.b}`); }
    return bad;
  };
  // Backtracking over the blocks of one level; returns best complete assignments by total penalty.
  function combine(order: number[], cands: BlockCandidate[][], level: number, keep: number, tick: () => boolean): BlockCandidate[][] {
    const found: {sel: BlockCandidate[]; pen: number}[] = [];
    const rec = (i: number, sel: BlockCandidate[], pen: number) => {
      if (!tick()) return;
      if (i === order.length) { found.push({sel: [...sel], pen}); return; }
      for (const c of cands[order[i]]) {
        sel.push(c);
        if (!crossBroken(sel, level).length) rec(i + 1, sel, pen + c.pen + 6 * c.unmet.length);
        sel.pop();
        if (found.length >= keep * 12) return;
      }
    };
    rec(0, [], 0);
    found.sort((a, b) => a.pen - b.pen);
    const out: BlockCandidate[][] = [], seen = new Set<string>();
    for (const f of found) { const s = f.sel.map(c => c.sig).join('#'); if (!seen.has(s)) { seen.add(s); out.push(f.sel); } if (out.length >= keep) break; }
    return out;
  }
  let ticks = 0; const tick = () => ++ticks < 200000;
  const gOrder = gCtx.map((_, i) => i).sort((a, b) => gCands[a].length - gCands[b].length);
  // `combine` returns selections in `order`; restore block order.
  // Offer the upper floor several different stair positions: keep the best ground combination per distinct stair footprint first.
  const stairSig = (g: BlockCandidate[]) => prog.stairs.map(st => g.flatMap(c => c.leaves).find(l => l.id === st.room)).map(l => l ? leafSigKey(l) : '').join(';');
  const allGround = combine(gOrder, gCands, 0, 60, tick), groundCombos: BlockCandidate[][] = [], seenStair = new Set<string>();
  for (const g of allGround) { const k = stairSig(g); if (!seenStair.has(k) && groundCombos.length < 12) { seenStair.add(k); groundCombos.push(g); } }
  for (const g of allGround) if (groundCombos.length < 12 && !groundCombos.includes(g)) groundCombos.push(g);
  stats.groundCombos = groundCombos.length;
  if (!groundCombos.length) {
    const bad = new Set<string>();
    for (const k of crossConns) if (blockById.get(roomById.get(k.a)!.block)!.level === 0) bad.add(`${k.a}—${k.b}`);
    conflicts.push({code: 'cross-block-connections', subject: 'ground', message: `No combination of ground-floor layouts satisfies all cross-block connections (${[...bad].join(', ')}) together with the room rules. Each cross-block connection needs both rooms against the shared block wall, and a wall can host only so many rooms.`});
    stop(); return {ok: false, conflicts, stats};
  }

  // ---- Upper blocks, once per ground combination (stair footprints are now fixed) ----
  const uCache = new Map<string, BlockCandidate[]>();
  const full: {ground: BlockCandidate[]; upper: BlockCandidate[]; pen: number}[] = [];
  const uFail = new Set<string>();
  for (const g of groundCombos) {
    const gl = new Map(g.flatMap(c => c.leaves.map(l => [l.id, l] as const)));
    const uCands: BlockCandidate[][] = [];
    let ok = true;
    for (const b of upper) {
      const keep: R[] = [], must = new Map<string, R>();
      for (const s of prog.stairs) if (roomById.get(s.landing)!.block === b.id) { const z = gl.get(s.room)!; keep.push(z); must.set(s.landing, z); }
      const key = `${b.id}|${keep.map(rectKey).join(';')}`;
      let cands = uCache.get(key);
      if (!cands) { const ctx = ctxFor(b, new Map(), keep, must); cands = candidates(ctx); uCache.set(key, cands); if (!cands.length || cands.every(x => x.unmet.length)) { if (!uFail.has(b.id)) { uFail.add(b.id); explainBlock(ctx, cands); } } }
      if (!cands.length) { ok = false; break; }
      uCands.push(cands);
    }
    if (!ok) continue;
    const uOrder = upper.map((_, i) => i).sort((a, b) => uCands[a].length - uCands[b].length);
    for (const u of combine(uOrder, uCands, 1, 3, tick)) full.push({ground: g, upper: u, pen: g.reduce((s, c) => s + c.pen + 6 * c.unmet.length, 0) + u.reduce((s, c) => s + c.pen + 6 * c.unmet.length, 0)});
  }
  stats.fullCandidates = full.length;
  stats.nodes = budget.nodes; stats.exhausted = budget.exhausted;
  if (!full.length) {
    stop();
    if (!conflicts.length) conflicts.push({code: 'upper-unsolvable', subject: 'upper', message: 'No upper-floor arrangement satisfies the room rules, the landing above each stair, and the cross-block connections together.'});
    return {ok: false, conflicts, stats};
  }

  // ---- Build slices, validate them with the real stage-3 measure, rank ----
  full.sort((a, b) => a.pen - b.pen);
  const options: LayoutOption[] = [], rejected: Finding[] = [], seenSig = new Set<string>();
  for (const f of full) {
    const sel = [...f.ground, ...f.upper], sig = sel.map(c => c.sig).join('#');
    if (seenSig.has(sig)) continue; seenSig.add(sig);
    // Options must differ materially (a wall moved ≥ MATERIAL m), otherwise a choice between them is meaningless.
    const leavesNow = sel.flatMap(c => c.leaves);
    if (options.some(o => !leavesNow.some(l => { const q = o.rooms.find(x => x.id === l.id)!; return Math.max(Math.abs(q.x0 - l.x0), Math.abs(q.x1 - l.x1), Math.abs(q.z0 - l.z0), Math.abs(q.z1 - l.z1)) >= MATERIAL; }))) continue;
    const built = buildSlice(spec, prog, sel);
    if ('conflicts' in built) { conflicts.push(...built.conflicts); continue; }
    const findings = opts.check?.(built.slice) ?? [];
    if (findings.length) { rejected.push(...findings); continue; }
    const rooms = sel.flatMap(c => c.leaves.map(l => asRoom(l, roomById.get(l.id)!, blockById.get(c.block)!)));
    const aspects = rooms.map(r => { const w = r.x1 - r.x0, d = r.z1 - r.z0; return Math.max(w, d) / Math.min(w, d); });
    const want = prog.rooms.filter(r => r.facing !== 'any'), tgts = new Map(sel.flatMap(c => ctxTargets(c, prog, blockById, spec)));
    const dev = rooms.map(r => Math.abs((r.x1 - r.x0) * (r.z1 - r.z0) - (tgts.get(r.id) ?? 0)) / (tgts.get(r.id) || 1));
    const facingMet = want.filter(w => { const r = rooms.find(x => x.id === w.id)!, b = blockById.get(r.block)!; return sideContact(r, blockRect(b), exteriorIntervals(b, spec.blocks as Block[])[w.facing as Side], w.facing as Side) >= 1.2; }).length;
    options.push({id: `layout-${options.length + 1}`, score: f.pen + 2 * built.added.length, slice: built.slice, rooms, addedLinks: built.added,
      metrics: {facingMet, facingWanted: want.length, maxAspect: Math.max(...aspects), worstAreaDeviation: Math.max(...dev), addedLinks: built.added.length}});
    if (options.length >= (opts.maxOptions ?? 3)) break;
  }
  if (!options.length) {
    if (!rejected.length) return {ok: false, conflicts: dedupe(conflicts), stats};
    const uniq = [...new Map(rejected.map(r => [r.code + r.subject, r])).values()].slice(0, 6);
    conflicts.push({code: 'validation-rejected', subject: 'layout', message: `Layouts were constructed but the stage-3 validators rejected all of them: ${uniq.map(r => `[${r.code}] ${r.message}`).join(' | ') || 'no detail'}`});
    return {ok: false, conflicts: dedupe(conflicts), stats};
  }
  options.sort((a, b) => a.score - b.score);
  return {ok: true, options, stats};
}

const dedupe = (c: Conflict[]) => [...new Map(c.map(x => [x.message, x])).values()];
function ctxTargets(c: BlockCandidate, prog: Programme, blocks: Map<string, Block>, _spec: unknown): [string, number][] {
  const b = blocks.get(c.block)!;
  return scaleTargets(prog.rooms.filter(r => r.block === c.block), b.w * b.d).map(r => [r.id, r.tgt] as [string, number]);
}

type Built = {slice: Stage3Slice; added: Link[]} | {conflicts: Conflict[]};
/** Links from the programme, stair orientation, then circulation completion so every room is reachable. */
function buildSlice(spec: Pick<HouseSpec, 'blocks'>, prog: Programme, sel: BlockCandidate[]): Built {
  const blockById = new Map(spec.blocks.map(b => [b.id, b])), pById = new Map(prog.rooms.map(r => [r.id, r]));
  const rooms = sel.flatMap(c => c.leaves.map(l => asRoom(l, pById.get(l.id)!, blockById.get(c.block)!))), rById = new Map(rooms.map(r => [r.id, r]));
  const edges = roomEdges(rooms);
  const edgeBetween = (a: string, b: string): Edge | undefined => edges.filter(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)).sort((x, y) => (y.hi - y.lo) - (x.hi - x.lo))[0];
  const links: Link[] = prog.connections.filter(k => !stairPair(prog, k.a, k.b)).map(k => ({a: k.a, b: k.b, kind: k.kind, t: 0.5}));
  const stairs: HouseSpec['stairs'] = [];
  for (const s of prog.stairs) {
    const room = rById.get(s.room)!, w = room.x1 - room.x0, d = room.z1 - room.z0;
    const fitsZ = d >= STAIR_LONG - 0.02 && w >= 2.0, fitsX = w >= STAIR_LONG - 0.02 && d >= 2.0;
    if (!fitsZ && !fitsX) return {conflicts: [{code: 'stair-geometry', subject: s.id, message: `Stair room ${room.id} came out ${w.toFixed(1)}×${d.toFixed(1)} m; a flight needs ${STAIR_LONG}×2.0 m.`}]};
    const alongZ = fitsZ && (!fitsX || d >= w);
    let start: Side = alongZ ? 'n' : 'w', hug: Side = alongZ ? 'e' : 's';
    const link = links.find(l => (l.a === room.id || l.b === room.id) && rById.get(l.a === room.id ? l.b : l.a)?.level === room.level);
    const other = link && rById.get(link.a === room.id ? link.b : link.a), e = other && edgeBetween(room.id, other.id);
    if (e) {
      const mid = (e.lo + e.hi) / 2, cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
      if (alongZ) {
        if (e.axis === 'z') { start = Math.abs(e.line - room.z0) < 1e-3 ? 'n' : 's'; hug = e.lo + (e.hi - e.lo) / 2 < cx ? 'e' : 'w'; link.t = hug === 'e' ? 0.25 : 0.75; }
        else { hug = Math.abs(e.line - room.x0) < 1e-3 ? 'e' : 'w'; start = mid < cz ? 'n' : 's'; link.t = start === 'n' ? 0.2 : 0.8; }
      } else if (e.axis === 'x') { start = Math.abs(e.line - room.x0) < 1e-3 ? 'w' : 'e'; hug = mid < cz ? 's' : 'n'; link.t = hug === 's' ? 0.25 : 0.75; }
      else { hug = Math.abs(e.line - room.z0) < 1e-3 ? 's' : 'n'; start = mid < cx ? 'w' : 'e'; link.t = start === 'w' ? 0.2 : 0.8; }
    }
    stairs.push({id: s.id, room: s.room, start, hug, width: 1.2});
  }
  // Circulation completion: reachability from the foyer through links and stairs.
  const foyer = prog.rooms.find(r => r.type === 'foyer')!.id, added: Link[] = [];
  const adj = new Map<string, Set<string>>(rooms.map(r => [r.id, new Set()]));
  const connect = (a: string, b: string) => { adj.get(a)!.add(b); adj.get(b)!.add(a); };
  for (const l of links) if (edgeBetween(l.a, l.b)) connect(l.a, l.b);
  for (const s of prog.stairs) connect(s.room, s.landing);
  const reach = () => { const seen = new Set([foyer]), q = [foyer]; while (q.length) for (const n of adj.get(q.shift()!)!) if (!seen.has(n)) { seen.add(n); q.push(n); } return seen; };
  const rank = (x: ProgRoom, y: ProgRoom): number => {
    if (y.type === 'bath' || y.type === 'stair') return 99;
    if (x.type === 'bedroom') return ['hall', 'gallery'].includes(y.type) ? 0 : y.type === 'lounge' ? 1 : 99;
    if (x.type === 'bath') return y.type === 'bedroom' ? 0 : ['hall', 'gallery'].includes(y.type) ? 1 : y.type === 'foyer' ? 99 : 2;
    if (y.type === 'bedroom') return 99;
    return ['hall', 'gallery'].includes(y.type) ? 0 : ['foyer', 'living', 'lounge'].includes(y.type) ? 1 : 2;
  };
  for (let guard = 0; guard < rooms.length + 2; guard++) {
    const seen = reach(), pending = rooms.filter(r => !seen.has(r.id));
    if (!pending.length) break;
    let best: {x: string; y: string; rank: number; len: number} | undefined;
    for (const x of pending) for (const y of rooms) if (seen.has(y.id) && y.level === x.level) {
      const e = edgeBetween(x.id, y.id), len = e ? e.hi - e.lo : 0, rk = rank(pById.get(x.id)!, pById.get(y.id)!);
      if (len >= DOOR_WALL && rk < 99 && (!best || rk < best.rank || (rk === best.rank && len > best.len))) best = {x: x.id, y: y.id, rank: rk, len};
    }
    if (!best) break;
    const l: Link = {a: best.y, b: best.x, kind: 'door', t: 0.5}; links.push(l); added.push(l); connect(best.x, best.y);
  }
  const seen = reach(), lost = rooms.filter(r => !seen.has(r.id));
  if (lost.length) return {conflicts: [{code: 'unreachable-rooms', subject: lost.map(r => r.id).join(','), message: `${lost.map(r => r.id).join(', ')} cannot be reached from the foyer: none of their neighbouring rooms may legally open onto them (≥${DOOR_WALL} m shared wall; bedrooms only off a hall/gallery/lounge, never off living/dining/kitchen). Add a hall or gallery beside them or declare a connection.`}]};
  return {slice: {plans: Object.fromEntries(sel.map(c => [c.block, c.node])), links, stairs}, added};
}
