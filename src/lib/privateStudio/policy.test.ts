/** Mathematical checks of the active live spending policy (offline). */
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {computeCostUsd} from '@/lib/ai/pricing';
import {LIVE_POLICY, reservationMicros, stageOutputTokens} from './policy';
import {runStagedGeneration, type StageNo} from '@/lib/villa/staged/pipeline';
import {PromptMockDesigner, MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
import {promptRequirements} from '@/lib/villa/staged/requirements';
import {LiveDesigner} from '@/lib/villa/staged/liveDesigner';

const P = LIVE_POLICY, STAGES = [1, 2, 3, 4, 5] as const;
const billed = (inputTokens: number, outputTokens: number, cachedInputTokens: number) => Math.ceil(computeCostUsd(P.model, {inputTokens, outputTokens, cachedInputTokens}, {[P.model]: P.price})! * 1e6);

it('bounds every billable outcome of one call by its reservation (any input up to bytes+margin, any cached share, output up to the stage cap)', () => {
  for (const stage of STAGES) for (const bytes of [1, 4000, 19066, P.maxWireBytes]) {
    const r = reservationMicros(P, bytes, stage), maxIn = bytes + P.inputTokenMargin, maxOut = stageOutputTokens(P, stage);
    for (const fin of [0, .5, 1]) for (const fout of [0, .5, 1]) for (const fc of [0, .5, 1]) {
      const input = Math.floor(maxIn * fin);
      expect(billed(input, Math.floor(maxOut * fout), Math.floor(input * fc))).toBeLessThanOrEqual(r);
    }
  }
});

it('uses a request-size bound that real Terra billing respects by a wide margin', () => {
  // Retained live calls: serialized request bytes versus billed input tokens.
  const e = JSON.parse(readFileSync('docs/architecture/automatic-house/first-automatic-live/evidence.json', 'utf8'));
  const calls = (Array.isArray(e.calls) ? e.calls : Object.values(e.calls)) as {wireRequestBody?: string; usage?: {inputTokens: number; outputTokens: number}; stage: number}[];
  for (const c of calls.filter(c => c.wireRequestBody && c.usage)) {
    expect(c.usage!.inputTokens).toBeLessThan(Buffer.byteLength(c.wireRequestBody!) / 4);
    expect(c.usage!.outputTokens * 3).toBeLessThanOrEqual(stageOutputTokens(P, c.stage as StageNo));
  }
});

it('never admits a call whose bound exceeds the remaining budget, so worst-case billing cannot pass the ceiling', () => {
  // Adversarial run: every admitted call bills exactly its reservation; sizes grow until refusals occur.
  let spent = 0, admitted = 0, refused = 0;
  for (let i = 0; i < 40; i++) {
    const stage = STAGES[i % 5], r = reservationMicros(P, 5000 + i * 1500, stage);
    if (spent + r > P.maxCostMicros) { refused++; continue; }
    spent += r; admitted++;
  }
  expect(spent).toBeLessThanOrEqual(P.maxCostMicros);
  expect(admitted).toBeGreaterThan(0);expect(refused).toBeGreaterThan(0);
});

it('fits all five stage calls plus all five corrections within US$1.40 at worst-case output for three different houses', async () => {
  const live = new LiveDesigner(P.stageOutputTokens);
  for (const brief of MOCK_BRIEFS) {
    const req = promptRequirements(brief);
    const r = await runStagedGeneration({designer: new PromptMockDesigner(brief), brief, site: P.site, requiredBedrooms: req.bedrooms, requiredBaths: req.bathrooms, requiredStoreys: req.storeys, exactBedrooms: true, maxCorrectionsPerStage: 0});
    expect(r.status).toBe('complete');
    let worst = 0;
    for (const stage of STAGES) {
      const prior = r.checkpoints.filter(c => c.stage < stage), ctx = {brief, site: P.site, draft: prior.at(-1)?.spec ?? r.checkpoints[0].input!.draft, checkpoints: prior, requiredBedrooms: req.bedrooms ?? 0, requiredBaths: req.bathrooms ?? 0};
      const design = live.wireBytes(stage, ctx), correction = live.wireBytes(stage, ctx, {previous: r.checkpoints[stage - 1].slice, findings: Array.from({length: 24}, (_, i) => ({stage: Math.max(2, stage) as 2, code: 'schema', subject: `subject-${i}`, message: 'A measured problem description of typical length for a correction request.'}))});
      expect(correction).toBeLessThan(P.maxWireBytes);
      worst += reservationMicros(P, design, stage) + reservationMicros(P, correction, stage);
    }
    expect(worst, brief).toBeLessThanOrEqual(P.maxCostMicros);
  }
});
