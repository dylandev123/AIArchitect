import {blockRect, overlapArea, snap} from './layout';
import type {OpenSpace, Side} from './spec';

/** Roles that name an open architectural space. Used only when a model did not set `open` itself. */
export const OPEN_ROLE = /\b(veranda|verandah|terrace|loggia|porch|pergola|patio|deck)\b/i;

interface MassingBlock {id: string; role: string; cx: number; cz: number; w: number; d: number; level: 0 | 1; open?: boolean}

/**
 * Explicit, deterministic Stage-2 normalisation: ground-level blocks flagged `open` (or whose
 * role names a veranda/terrace/loggia/…) are not enclosed volumes. They keep id, position and
 * size as an open space attached to the enclosed block they share the longest wall with.
 * Everything else passes through byte-identical. Throws if an open block has no host.
 */
export function separateOpenSpaces<T extends MassingBlock>(input: T[]): {blocks: Omit<T, 'open'>[]; openSpaces: OpenSpace[]} {
  const isOpen = (b: T) => b.level === 0 && (b.open === true || (b.open === undefined && OPEN_ROLE.test(b.role)));
  const open = input.filter(isOpen), enclosed = input.filter(b => !isOpen(b));
  const openSpaces = open.map((o): OpenSpace => {
    const r = blockRect(o);
    let best: {host: string; side: Side; len: number} | undefined;
    for (const h of enclosed.filter(b => b.level === 0)) {
      const hr = blockRect(h);
      const cands: [Side, number, number][] = [
        ['s', hr.z1 - r.z0, Math.min(hr.x1, r.x1) - Math.max(hr.x0, r.x0)], ['n', r.z1 - hr.z0, Math.min(hr.x1, r.x1) - Math.max(hr.x0, r.x0)],
        ['e', r.x0 - hr.x1, Math.min(hr.z1, r.z1) - Math.max(hr.z0, r.z0)], ['w', hr.x0 - r.x1, Math.min(hr.z1, r.z1) - Math.max(hr.z0, r.z0)],
      ];
      for (const [side, gap, len] of cands) if (Math.abs(gap) < 0.02 && len > 1 && (!best || len > best.len)) best = {host: h.id, side, len};
      if (overlapArea(hr, r) > 0.01) throw Error(`Open space ${o.id} overlaps enclosed block ${h.id}.`);
    }
    if (!best) throw Error(`Open space ${o.id} does not touch any enclosed ground-level block.`);
    return {id: o.id, role: o.role, cx: snap(o.cx), cz: snap(o.cz), w: o.w, d: o.d, host: best.host, side: best.side};
  });
  return {blocks: enclosed.map(({open: _open, ...b}) => b), openSpaces};
}
