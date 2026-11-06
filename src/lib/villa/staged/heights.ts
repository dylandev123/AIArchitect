import {wallTopOf, type Block} from './spec';

/**
 * Junction rules between abutting volumes of different heights. Software derives every consequence of a
 * Stage 2 height decision from these: eaves, cornices and the exposed upper wall of a taller volume.
 * Houses whose blocks carry no `height` keep the original level-based rule exactly.
 */
export const hasHeight = (b: Pick<Block, 'height'>) => b.height !== undefined;

/** Top of a block's highest roof surface (flat roofs are 0.3 m slabs). */
export const roofPeak = (b: Block) => wallTopOf(b) + (b.roof.form === 'flat' ? 0.3 : (b.roof.rise ?? 1.8));

/**
 * Whether an abutting neighbour `o` stops `b`'s eave (and cornice) on the shared side.
 * A neighbour at least as tall always does. A lower neighbour does only when its roof would reach the eave,
 * so a tall volume keeps its eave over a lower wing and the lower roof tucks beneath it.
 */
export function neighbourStopsEave(b: Block, o: Block): boolean {
  if (!hasHeight(b) && !hasHeight(o)) return o.level >= b.level;
  if (wallTopOf(o) >= wallTopOf(b) - 1e-6) return true;
  return roofPeak(o) > wallTopOf(b) - 0.05;
}

/** Same rule without roof knowledge (Stage 4 derivation, before roofs exist): only wall tops are compared. */
export function neighbourAtLeastAsTall(b: Block, o: Block): boolean {
  if (!hasHeight(b) && !hasHeight(o)) return o.level >= b.level;
  return wallTopOf(o) >= wallTopOf(b) - 1e-6;
}
