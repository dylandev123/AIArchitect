import retained from './__tests__/fixtures/first-live-vision.json';
import { executeCompositionPatch } from './composition';
import { constructVision } from './image-vision';

/** Human-audited corrections to contradictions inside the FIRST retained interpretation.
 * Never infer coordinates, alter roof/massing, or apply this patch to another response.
 * Exact replay remains constructVision(raw); this is an explicit, separate local edit.
 */
export const firstImageFidelityPatch = {
  appearance: { exterior: 'sand', glazing: 'panoramic' },
} as const;
export const firstImageFidelityAudit = [
  { path:'appearance.exterior', before:'warm-stone', after:'sand', evidence:'materials; warm-wall-finish', reason:'Pale warm stucco is stated in the interpretation. Sand uses the existing render finish instead of dark articulated stone. The interpretation also allows limestone; this is a disclosed local choice, not recovered material certainty.' },
  { path:'appearance.glazing', before:'divided', after:'panoramic', evidence:'glazing; near-window', reason:'The interpretation says simple blue glazing. The existing panoramic option removes the divided horizontal bar and reduces panels from three to two. It does not recover the single window or its position.' },
];
export function replayFirstImageFidelity(raw: unknown) {
  // Parsed JSON equality is independent of whitespace, but requires the exact interpretation.
  if (JSON.stringify(raw) !== JSON.stringify(retained)) throw new Error('Fidelity patch is scoped to the exact first retained interpretation');
  const replay = constructVision(raw);
  return { ...replay, config:executeCompositionPatch(replay.config, firstImageFidelityPatch), fidelityAudit:firstImageFidelityAudit };
}
