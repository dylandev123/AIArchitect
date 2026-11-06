import {SIDES, blockRect, sideLine, sideRun, subtractIntervals, type R} from './layout';
import {SLAB, WALL_H, levelTop, type HouseSpec, type Side} from './spec';
import type {SceneElement} from '../scene/model';

/**
 * Software-derived exterior trim. Terra chooses the character (`spec.trim`); everything here is measured from the
 * blocks and the actual openings the compiler cut: plinths, cornices, sills, lintels, shutters, entrance portal.
 * Nothing here is authored by a model. The scene is capped at 400 elements, so trim is added in priority order.
 */
export interface OpeningRec {level: number; axis: 'x' | 'z'; line: number; c: number; sill: number; width: number; height: number; door: boolean; block: string; main: boolean; trimIndex?: number}
export interface TrimEl {comp: string; id: string; kind: SceneElement['kind']; at: [number, number, number]; size: [number, number, number]; extra: Partial<SceneElement>}

const sideOfOpening = (o: OpeningRec, br: R): Side => o.axis === 'x' ? (o.line < (br.z0 + br.z1) / 2 ? 'n' : 's') : (o.line < (br.x0 + br.x1) / 2 ? 'w' : 'e');
function abutsSide(a: R, b: R, s: Side): [number, number] | undefined {
  const gap = s === 'n' ? b.z1 - a.z0 : s === 's' ? b.z0 - a.z1 : s === 'e' ? b.x0 - a.x1 : b.x1 - a.x0;
  const [lo, hi] = s === 'n' || s === 's' ? [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)] : [Math.max(a.z0, b.z0), Math.min(a.z1, b.z1)];
  return Math.abs(gap) < 0.02 && hi - lo > 0.05 ? [lo, hi] : undefined;
}
const dir = (s: Side) => s === 'n' || s === 'w' ? -1 : 1;

export function buildTrim(spec: HouseSpec, ctx: {openings: OpeningRec[]; nExisting: number}): TrimEl[] {
  const T = spec.trim!, out: TrimEl[] = [], cap = 400 - ctx.nExisting - 4, byId = new Map(spec.blocks.map(b => [b.id, b]));
  const push = (e: TrimEl) => { if (out.length < cap) out.push(e); };
  const at = (horiz: boolean, along: number, y: number, across: number): [number, number, number] => horiz ? [along, y, across] : [across, y, along];
  const sz = (horiz: boolean, len: number, h: number, dp: number): [number, number, number] => horiz ? [len, h, dp] : [dp, h, len];
  const ex = (m: 'limestone' | 'timber', color: string): Partial<SceneElement> => ({material: m, color});

  // 1. Entrance portal: stone piers and lintel framing the main door, under the canopy.
  const main = ctx.openings.find(o => o.main);
  if (main && T.portal) {
    const br = blockRect(byId.get(main.block)!), s = sideOfOpening(main, br), horiz = s === 'n' || s === 's', face = sideLine(br, s) + dir(s) * 0.1;
    for (const k of [-1, 1]) push({comp: 'entrance', id: `entrance-pier-${k > 0 ? 'b' : 'a'}`, kind: 'volume', at: at(horiz, main.c + k * (main.width / 2 + 0.225), (SLAB + 3.15) / 2, face), size: sz(horiz, 0.45, 3.15 - SLAB, 0.2), extra: ex('limestone', T.stoneColor)});
    push({comp: 'entrance', id: 'entrance-lintel', kind: 'volume', at: at(horiz, main.c, levelTop(0) + main.height + 0.075, face), size: sz(horiz, main.width, 0.15, 0.2), extra: ex('limestone', T.stoneColor)});
  }

  // 2. Cornice under the eaves of every uncovered block; plinth at the foot of every exposed ground wall.
  const upper = spec.blocks.filter(b => b.level === 1).map(blockRect);
  const covered = (b: HouseSpec['blocks'][number]) => { const r = blockRect(b); return upper.some(u => Math.max(0, Math.min(u.x1, r.x1) - Math.max(u.x0, r.x0)) * Math.max(0, Math.min(u.z1, r.z1) - Math.max(u.z0, r.z0)) > 0.01); };
  for (const b of spec.blocks) {
    const br = blockRect(b);
    for (const s of SIDES) {
      const [a0, a1] = sideRun(br, s), horiz = s === 'n' || s === 's', face = sideLine(br, s);
      const abut: [number, number][] = spec.blocks.filter(o => o.id !== b.id && o.level >= b.level).flatMap(o => { const r = abutsSide(br, blockRect(o), s); return r ? [r] : []; });
      const low: [number, number][] = ctx.openings.filter(o => o.block === b.id && o.level === 0 && sideOfOpening(o, br) === s && (o.sill < 0.7 || o.door)).map(o => [o.c - o.width / 2 - 0.15, o.c + o.width / 2 + 0.15]);
      for (const v of spec.exterior.verandas) if (v.block === b.id && v.side === s) low.push([v.from - 0.05, v.to + 0.05]);
      // A terrace-bearing lower block still needs a shadow line at its exposed wall head.
      if (T.cornice && (!covered(b) || T.visualRevision === 'stage4-v2')) {
        const wallTop = levelTop(b.level) + WALL_H;
        subtractIntervals(a0, a1, abut).filter(([x, y]) => y - x > 0.5).forEach(([x, y], i) => push({comp: `block:${b.id}`, id: `cornice-${b.id}-${s}-${i}`, kind: 'volume', at: at(horiz, (x + y) / 2, wallTop - 0.13, face + dir(s) * 0.09), size: sz(horiz, y - x + 0.1, 0.26, 0.18), extra: ex('limestone', T.stoneColor)}));
      }
      if (T.plinth && b.level === 0) {
        subtractIntervals(a0, a1, [...abut, ...low]).filter(([x, y]) => y - x > 0.6).forEach(([x, y], i) => push({comp: `block:${b.id}`, id: `plinth-${b.id}-${s}-${i}`, kind: 'volume', at: at(horiz, (x + y) / 2, 0.3, face + dir(s) * 0.06), size: sz(horiz, y - x, 0.6, 0.12), extra: ex('limestone', T.stoneColor)}));
      }
    }
  }

  // 3. Window surrounds (lintel, plus sill when the window has one), then shutters while the element budget lasts.
  const placed = ctx.openings.filter(o => !o.door && o.width > 0.5).map(o => { const br = blockRect(byId.get(o.block)!), s = sideOfOpening(o, br); return {o, s, horiz: s === 'n' || s === 's', face: sideLine(br, s)}; });
  if (T.windowTrim !== 'plain') {
    placed.forEach(({o, s, horiz, face}, index) => {
      const i = o.trimIndex ?? index;
      const y0 = levelTop(o.level) + o.sill;
      push({comp: `block:${o.block}`, id: `lintel-${i}`, kind: 'volume', at: at(horiz, o.c, y0 + o.height + 0.1, face + dir(s) * 0.07), size: sz(horiz, o.width + 0.5, 0.2, 0.14), extra: ex('limestone', T.stoneColor)});
      if (o.sill > 0.2) push({comp: `block:${o.block}`, id: `sill-${i}`, kind: 'volume', at: at(horiz, o.c, y0 - 0.045, face + dir(s) * 0.1), size: sz(horiz, o.width + 0.3, 0.09, 0.2), extra: ex('limestone', T.stoneColor)});
    });
  }
  if (T.windowTrim === 'stone-and-shutters') {
    placed.forEach(({o, s, horiz, face}, index) => {
      const i = o.trimIndex ?? index;
      if (o.sill < 0.3 || o.width < 0.9 || o.height > 2.35) return;
      // Privacy/bathroom openings and narrow circulation windows gain little from paired shutters.
      if (T.visualRevision === 'stage4-v2' && (o.width < 1.2 || o.height < 1.5)) return;
      const near = placed.filter((p, j) => j !== index && p.o.block === o.block && p.s === s && p.o.level === o.level).map(p => Math.abs(p.o.c - o.c) - (p.o.width + o.width) / 2);
      if (near.length && Math.min(...near) < 1.0) return;
      for (const k of [-1, 1]) push({comp: `block:${o.block}`, id: `shutter-${i}-${k > 0 ? 'b' : 'a'}`, kind: 'volume', at: at(horiz, o.c + k * (o.width / 2 + 0.3), levelTop(o.level) + o.sill + o.height / 2, face + dir(s) * 0.035), size: sz(horiz, 0.42, o.height, 0.07), extra: ex('timber', T.timberColor)});
    });
  }
  return out;
}
