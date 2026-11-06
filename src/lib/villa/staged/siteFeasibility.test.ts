/** Stage 5 safeguards on the real live v3 house (OFFLINE; no provider). */
import {readFileSync} from 'node:fs';
import {expect, it, vi} from 'vitest';
import {siteFeasibility, siteAccessBlockers, stage5Preflight} from './siteFeasibility';
import {deriveSiteGeneral} from './siteGeneral';
import {runStagedGeneration, type Checkpoint} from './pipeline';
import {poolRequirement, promptRequirements} from './requirements';
import type {HouseSpec} from './spec';

const e = JSON.parse(readFileSync('docs/architecture/automatic-house/live-v3/evidence.json', 'utf8'));
const brief: string = e.run.source.input.brief, accepted: Checkpoint[] = e.run.source.result.checkpoints.filter((c: Checkpoint) => c.accepted);
const spec4: HouseSpec = accepted.at(-1)!.spec;
const raw = (stage: number, purpose = 'design') => JSON.parse(e.calls.find((c: {stage: number; purpose: string}) => c.stage === stage && c.purpose === purpose).raw);
/** Real accepted house with the court-covering terrace narrowed below the 4.8 m drive: arrival is genuinely blocked. */
const blocked = () => { const s = structuredClone(spec4); s.openSpaces.find(o => o.id === 'private-garden-terrace')!.w = 4; return s; };
const resume = (spec: HouseSpec, designer: {design: ReturnType<typeof vi.fn>; correct: ReturnType<typeof vi.fn>}) => {
  const req = promptRequirements(brief), cps = structuredClone(accepted); cps.at(-1)!.spec = spec;
  return runStagedGeneration({designer: {label: 'offline', ...designer} as never, brief, site: e.run.source.input.site, requiredBedrooms: req.bedrooms, requiredBaths: req.bathrooms, requiredStoreys: req.storeys, exactBedrooms: true, resumeFrom: cps, maxCorrectionsPerStage: 1});
};

it('accepted live house: no access blocker, the reserved pool fits, Stage 5 may be dispatched', () => {
  const f = siteFeasibility(spec4, brief);
  expect(f.blockers).toEqual([]);expect(f.feasible).toBe(true);expect(stage5Preflight(spec4, brief)).toEqual([]);
});

it('never attributes a pool-independent access blocker to pool placement', () => {
  const f = siteFeasibility(blocked(), brief);
  expect(f.blockers.map(b => b.code)).toEqual(['arrival-space']);
  for (const v of Object.values(f.options)) for (const text of Object.values(v)) expect(text).toMatch(/^not assessed: site access is blocked independently of any pool/);
  expect(f.feasible).toBe(false);
});

it('does not dispatch Stage 5, nor any correction, when access is blocked', async () => {
  const designer = {design: vi.fn(), correct: vi.fn()};
  const r = await resume(blocked(), designer);
  expect(designer.design).not.toHaveBeenCalled();expect(designer.correct).not.toHaveBeenCalled();
  expect(r.status).toBe('failed');expect(r.findings.map(f => f.code)).toEqual(['site-infeasible']);expect(r.lastGood?.stage).toBe(4);
});

it('does not dispatch Stage 5 when a required pool cannot fit anywhere', async () => {
  // Same house plus a wide paved court across the whole garden in front of the pool reservation; arrival stays open.
  const s = structuredClone(spec4), t = s.openSpaces.find(o => o.id === 'private-garden-terrace')!;
  s.openSpaces.push({...t, id: 'test-wide-court', role: 'paved court', cx: 14, cz: 11, w: 30, d: 20});
  const f = siteFeasibility(s, brief);
  expect(f.blockers).toEqual([]);
  expect(Object.entries(f.options).filter(([k]) => k.startsWith('pool-intention')).flatMap(([, v]) => Object.values(v)).every(x => x.startsWith('does not fit'))).toBe(true);
  expect(f.feasible).toBe(false);
  const designer = {design: vi.fn(), correct: vi.fn()};
  expect((await resume(s, designer)).findings[0].code).toBe('site-infeasible');expect(designer.design).not.toHaveBeenCalled();
});

it('still allows exactly one justified correction when a fitting pool exists but Terra chose none', async () => {
  const designer = {design: vi.fn(async () => ({value: raw(5), raw: JSON.stringify(raw(5))})), correct: vi.fn(async () => ({value: raw(5, 'correction'), raw: JSON.stringify(raw(5, 'correction'))}))};
  const r = await resume(spec4, designer);
  expect(designer.design).toHaveBeenCalledTimes(1);expect(designer.correct).toHaveBeenCalledTimes(1);
  expect(r.findings.map(f => f.code)).toEqual(['pool-intention-dropped', 'pool-required']);
});

it('allows a no-pool answer for a brief that genuinely excludes a pool, even with a massing reservation', () => {
  const noPool = brief.replace('a modest swimming pool, ', '') + ' Design it without a swimming pool.';
  expect(poolRequirement(noPool)).toBe('excluded');
  expect(deriveSiteGeneral(spec4, raw(5), noPool).findings).toEqual([]);
  expect(siteFeasibility(spec4, noPool).feasible).toBe(true);
  expect(deriveSiteGeneral(spec4, {...raw(5), pool: {...raw(5).pool, scale: 'intimate'}}, noPool).findings.map(f => f.code)).toEqual(['pool-excluded']);
});

it('checks entrance access at Stage 4, when a different entrance can still repair it', async () => {
  expect(siteAccessBlockers(blocked()).length).toBe(1);
  // Accepted real Stages 1–3 with the terrace narrowed, then Terra's real Stage 4 answer: rejected for access before any Stage 5 call.
  const cps = structuredClone(accepted.slice(0, 3)); cps[2].spec.openSpaces.find(o => o.id === 'private-garden-terrace')!.w = 4;
  const designer = {design: vi.fn(async (stage: number) => ({value: raw(stage), raw: JSON.stringify(raw(stage))})), correct: vi.fn(async (stage: number) => ({value: raw(stage), raw: JSON.stringify(raw(stage))}))};
  const req = promptRequirements(brief);
  const r = await runStagedGeneration({designer: {label: 'offline', ...designer} as never, brief, site: e.run.source.input.site, requiredBedrooms: req.bedrooms, requiredBaths: req.bathrooms, requiredStoreys: req.storeys, exactBedrooms: true, resumeFrom: cps, maxCorrectionsPerStage: 1});
  expect(r.failedStage).toBe(4);expect(r.findings.map(f => f.code)).toContain('arrival-access');
  expect(designer.design.mock.calls.map(c => c[0])).toEqual([4]);expect(designer.correct.mock.calls.map(c => c[0])).toEqual([4]);
});
