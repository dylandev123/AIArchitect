/**
 * TEST FIXTURE. Historical Terra answers were recorded before the structured-vision contract (Stage 1 `vision`,
 * Stage 2 `height`/`rank`), so they cannot satisfy today's strict provider schema unchanged. Replays through the
 * live SDK contract add these fields with NEUTRAL values that change no geometry: a uniform-height vision with no
 * signature features, every block standard height, the first enclosed block ranked primary. Labelled; never AI output.
 * Phase 2 adds a neutral `vision.scale`: the smallest plan consistent with the brief's own words (storeys, and the
 * floor area an explicit luxury/estate brief requires), so the replay is judged by its geometry, not by invented ambition.
 */
import {briefScaleFloor} from './composition';
import {promptRequirements} from './requirements';
export function neutralScale(brief: string) {
  let storeys: number | undefined; try { storeys = promptRequirements(brief).storeys; } catch { storeys = undefined; }
  const levels = storeys === 2 ? 2 : 1, gfa = Math.max(20, briefScaleFloor(brief)?.minGfa ?? 20);
  return {footprintM2: Math.max(20, Math.round(gfa / levels)), grossFloorAreaM2: gfa, levels, wings: 1, principalSpaces: [{name: 'Neutral replay value', kind: 'living', approxAreaM2: 4, height: 'standard'}], scaleEvidence: 'Neutral replay value (recorded before the scale contract)'};
}
export function withVisionContract(stage: number, value: unknown, brief: string): unknown {
  const v = structuredClone(value) as Record<string, unknown>;
  if (stage === 1 && !('vision' in v)) v.vision = {
    style: 'Recorded before the structured vision contract', character: 'Neutral replay value', ambition: 'comfortable', ambitionEvidence: 'Neutral replay value',
    composition: /\bl[ -]?shap(?:e|ed)\b/i.test(brief) ? 'l-shape' : /\bu[ -]?shap(?:e|ed)\b/i.test(brief) ? 'u-courtyard' : 'compact-volume',
    compositionIntent: 'Neutral replay value', primaryVolume: 'Neutral replay value', focalPoints: ['Neutral replay value'],
    heightStrategy: 'uniform', roofStrategy: 'single-roof-family', entranceConcept: 'sheltered-porch', signatureFeatures: [], briefConstraints: [],
  };
  if (stage === 1 && v.vision && typeof v.vision === 'object' && !('scale' in v.vision)) (v.vision as Record<string, unknown>).scale = neutralScale(brief);
  if (stage === 2 && Array.isArray(v.blocks)) {
    let primary = false;
    v.blocks = v.blocks.map((b: Record<string, unknown>) => {
      const rank = 'rank' in b ? b.rank : !b.open && !primary ? (primary = true, 'primary') : 'secondary';
      return {...b, height: b.height ?? 'standard', rank};
    });
  }
  return v;
}
export const withVisionContractRaw = (stage: number, raw: string, brief: string) => JSON.stringify(withVisionContract(stage, JSON.parse(raw), brief));
