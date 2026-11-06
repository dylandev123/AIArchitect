import {SCENE_ELEMENT_LIMIT, PART_LIMIT} from '../scene/model';
import {snap} from './layout';
import type {HouseSpec} from './spec';

/** Element budget of one scene: the original 400-element cap, kept exactly for houses built before `scale-1`. */
export const ELEMENT_CAP = 400;
/** `scale-1` construction groups repetitive geometry and is budgeted against the measured scene limit. */
export const elementCap = (spec: Pick<HouseSpec, 'construction'>) => spec.construction === 'scale-1' ? SCENE_ELEMENT_LIMIT : ELEMENT_CAP;
/** Several boxes (centre + size, world axes) as one element: envelope centre/size and parts in its frame. */
export function groupBoxes(boxes: {at: [number, number, number]; size: [number, number, number]}[]): {at: [number, number, number]; size: [number, number, number]; parts: number[][]} {
  const lo = [0, 1, 2].map(i => Math.min(...boxes.map(b => snap(b.at[i]) - snap(b.size[i]) / 2))), hi = [0, 1, 2].map(i => Math.max(...boxes.map(b => snap(b.at[i]) + snap(b.size[i]) / 2)));
  const at = [0, 1, 2].map(i => snap((lo[i] + hi[i]) / 2)) as [number, number, number];
  // The envelope is rounded outward so every snapped part stays inside it.
  const size = [0, 1, 2].map(i => snap(2 * Math.max(hi[i] - at[i], at[i] - lo[i]) + 0.002)) as [number, number, number];
  return {at, size, parts: boxes.map(b => [...[0, 1, 2].map(i => snap(snap(b.at[i]) - at[i])), ...b.size.map(v => snap(v))])};
}
/** Splits a long list into element-sized groups (`PART_LIMIT` boxes per element). */
export const chunks = <T,>(list: T[], n = PART_LIMIT): T[][] => Array.from({length: Math.ceil(list.length / n)}, (_, i) => list.slice(i * n, (i + 1) * n));
