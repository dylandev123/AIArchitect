/** Live v3 (2026-11-06): real Terra Stages 1–5 replayed OFFLINE. No provider is contacted. */
import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {advancePromptRun, type PromptRun} from './promptGeneration';
import {poolFit} from './automaticRequests';
import {deriveSiteGeneral, siteContext} from './siteGeneral';
import {featureAudit} from './featureAudit';
import {validateSite} from './validate';
import {loadHouse} from './save';
import {compileHouse} from './compile';
import {overlapArea} from './layout';
import {fromRect} from './site';
import type {HouseSpec} from './spec';

const e = JSON.parse(readFileSync('docs/architecture/automatic-house/live-v3/evidence.json', 'utf8'));
const brief: string = e.run.source.input.brief;
const raw = (stage: number, purpose = 'design') => e.calls.find((c: {stage: number; purpose: string}) => c.stage === stage && c.purpose === purpose).raw as string;
const accepted4: HouseSpec = e.run.source.result.checkpoints.find((c: {stage: number; accepted: boolean}) => c.stage === 4 && c.accepted).spec;
const architecture = (s: HouseSpec) => JSON.stringify({blocks: s.blocks, openSpaces: s.openSpaces, exterior: s.exterior, direction: s.direction});

/** Real Terra answers for Stages 1–4; Stage 5 is the real answer, optionally with ONE field substituted (labelled). */
async function replay(stage5: (value: Record<string, unknown>) => unknown = v => v) {
  const run: PromptRun = {input: e.run.source.input};
  const designer = {label: 'OFFLINE replay of live v3', design: async (stage: 1 | 2 | 3 | 4 | 5) => {
    const text = raw(stage), value = stage === 5 ? stage5(JSON.parse(text)) : JSON.parse(text);
    return {value, raw: JSON.stringify(value)};
  }, correct: async () => { throw Error('No correction calls in offline replay'); }};
  let out;
  for (let stage = 1; stage <= 5; stage++) { out = await advancePromptRun(run, designer); if (out.status === 'failed') break; }
  return {run, out: out!};
}

it('reproduces the accepted live Stage 4 house exactly from the real Terra responses', async () => {
  const {run} = await replay(() => { throw Error('stop before Stage 5'); });
  const four = run.result!.checkpoints.find(c => c.stage === 4 && c.accepted)!;
  expect(architecture(four.spec)).toBe(architecture(accepted4));
  // The preserved Stage 4 checkpoint rebuilds exactly (all 210 elements) from its spec.
  const kept = JSON.parse(readFileSync('docs/architecture/automatic-house/live-v3/stage4-accepted.checkpoint.json', 'utf8'));
  expect(JSON.stringify(compileHouse(kept.spec, 4).scene.elements)).toBe(JSON.stringify(kept.scene.elements));
  expect(kept.scene.elements).toHaveLength(210);
});

it('root cause: the accepted open terrace covers the entrance court, so the straight drive could only cross it', () => {
  const ctx = siteContext(accepted4), terrace = ctx.terraces.find(t => t.id === 'private-garden-terrace')!;
  expect(ctx.entranceSide).toBe('s');
  expect(overlapArea(terrace.rect, ctx.court!)).toBeCloseTo(5 * 2, 6); // 5 m wide x 2 m deep of the 5 x 4 m court
});

it('no longer reports a pool-independent driveway failure as "every pool does not fit"', () => {
  const fit = poolFit(accepted4, brief), reservation = Object.entries(fit).find(([k]) => k.startsWith('pool-intention'))![1];
  expect(reservation).toEqual({plunge: 'fits', intimate: 'fits', generous: 'fits', lap: 'fits'});
  // The drive now ends at the terrace's outer edge, clear of every building, veranda and pool.
  const d = deriveSiteGeneral(accepted4, {...JSON.parse(raw(5)), pool: {...JSON.parse(raw(5)).pool, scale: 'intimate'}}, brief);
  expect(d.findings).toEqual([]);
  const drive = d.spec.siteWork.paths.find(p => p.id === 'arrival-drive')!;
  expect(fromRect(drive.rect)).toMatchObject({z0: 11, z1: 24});
  expect(validateSite(d.spec)).toEqual([]);
});

it('both real Stage 5 answers remain rejected verbatim: Terra chose pool "none" although the brief requires a pool', async () => {
  for (const purpose of ['design', 'correction']) {
    const v = JSON.parse(raw(5, purpose));
    expect(v.pool.scale).toBe('none');
    expect(deriveSiteGeneral(accepted4, v, brief).findings.map(f => f.code)).toEqual(['pool-intention-dropped', 'pool-required']);
  }
});

for (const scale of ['plunge', 'intimate', 'generous', 'lap'] as const) it(`completes the house from the real Stage 5 answer with only pool.scale=${scale} substituted (developer substitution), preserving Stages 1–4`, async () => {
  const {out} = await replay(v => ({...v, pool: {...(v.pool as object), scale}}));
  expect(out.status, JSON.stringify(out.findings)).toBe('complete');
  expect(out.findings).toEqual([]);
  const h = loadHouse(out.save!);
  expect(architecture(h.spec)).toBe(architecture(accepted4));
  expect(featureAudit(h.spec, h.scene, h.components, 5, brief).findings).toEqual([]);
  expect(h.spec.siteWork.pool?.sourceIntent).toBe('pool-garden-reservation');
  expect(loadHouse(out.save!).spec).toEqual(h.spec);
});

it('keeps the forecourt rule narrow: a court-covering terrace narrower than the drive still blocks arrival', () => {
  const narrow = structuredClone(accepted4), t = narrow.openSpaces.find(o => o.id === 'private-garden-terrace')!;
  t.w = 4; // 4 m < 4.8 m drive: it cannot serve as the forecourt
  const v = JSON.parse(raw(5));
  expect(deriveSiteGeneral(narrow, {...v, pool: {...v.pool, scale: 'intimate'}}, brief).findings.map(f => f.code)).toEqual(['arrival-space']);
});
