/** Orientation-general Stage 5 derivation on three substantially different houses (OFFLINE provider doubles). */
import {expect, it} from 'vitest';
import {runStagedGeneration, type PipelineResult} from './pipeline';
import {PromptMockDesigner, MOCK_BRIEFS} from './promptMocks';
import {promptRequirements} from './requirements';
import {deriveSiteGeneral, generalSiteIssues, gardenAnchor, gardenFrame, routeWalk, siteContext} from './siteGeneral';
import {poolFootprint} from './validate';
import {overlapArea, type R} from './layout';
import {SIDES} from './layout';

const cache = new Map<number, Promise<PipelineResult>>();
const build = (i: number, stopAfter?: 4) => {
  const key = i + (stopAfter ? 10 : 0);
  if (!cache.has(key)) {
    const brief = MOCK_BRIEFS[i], req = promptRequirements(brief);
    cache.set(key, runStagedGeneration({designer: new PromptMockDesigner(brief), brief, site: {width: 60, depth: 48}, requiredBedrooms: req.bedrooms, requiredBaths: req.bathrooms, requiredStoreys: req.storeys, exactBedrooms: true, maxCorrectionsPerStage: 0, stopAfter}));
  }
  return cache.get(key)!;
};
const inside = (a: R, b: R) => b.x0 >= a.x0 - 1e-6 && b.x1 <= a.x1 + 1e-6 && b.z0 >= a.z0 - 1e-6 && b.z1 <= a.z1 + 1e-6;

for (const [i, garden] of (['s', 'n', 'e'] as const).entries()) it(`derives a complete coordinated site for house ${i + 1} with its garden facing ${garden}`, async () => {
  const r = await build(i);
  expect(r.status, JSON.stringify(r.findings)).toBe('complete');
  const spec = r.spec!, ctx = siteContext(spec), pool = spec.siteWork.pool!;
  expect(gardenAnchor(spec, i === 0 ? 'pool-intention' : 'veranda')!.side).toBe(garden);
  expect(spec.sitePresentation?.version).toBe('staged-site-2');
  expect(generalSiteIssues(spec)).toEqual([]);
  // One pool, fully inside the property, clear of every built element and the entrance court.
  const pf = poolFootprint(pool);
  expect(inside(ctx.site, pf)).toBe(true);
  for (const o of [...ctx.blocks.map(b => b.rect), ...ctx.verandas.map(v => v.rect), ...ctx.terraces.map(t => t.rect), ctx.court!]) expect(overlapArea(pf, o)).toBeLessThan(.01);
  expect(r.scene!.elements.filter(e => e.kind === 'water')).toHaveLength(1);
  // A retained pool reservation is bound to the one constructed pool, explained, and never rendered as a second pad.
  if (ctx.pools.length) {
    expect(pool.sourceIntent).toBe(ctx.pools[0].id);
    expect(pool.intentResolution).toContain(ctx.pools[0].id);
    expect(r.scene!.elements.some(e => e.id === `open-${ctx.pools[0].id}`)).toBe(false);
    expect(r.scene!.elements.find(e => e.kind === 'water')!.aliases).toContain(ctx.pools[0].id);
    // The constructed pool occupies its reservation: most of the reserved pad lies inside the built envelope.
    const pad = {x0: ctx.pools[0].cx - ctx.pools[0].w / 2, x1: ctx.pools[0].cx + ctx.pools[0].w / 2, z0: ctx.pools[0].cz - ctx.pools[0].d / 2, z1: ctx.pools[0].cz + ctx.pools[0].d / 2};
    expect(overlapArea(pf, pad) / ((pad.x1 - pad.x0) * (pad.z1 - pad.z0))).toBeGreaterThan(.8);
  }
  // The pool's long side runs parallel to the garden facade.
  expect(garden === 'e' ? pool.d > pool.w : pool.w > pool.d).toBe(true);
  // Every landscape component is a semantically editable scene element.
  for (const t of spec.siteWork.trees) expect(r.components![`tree-${t.id}`]).toBe(`landscape:${t.id}`);
  for (const f of spec.sitePresentation!.fixtures) expect(r.components![`site-${f.id}`]).toBe(`landscape:${f.id}`);
  expect(spec.siteWork.beds.length).toBeGreaterThan(2);
  expect(spec.siteWork.paths.some(p => p.id === 'arrival-drive')).toBe(true);
});

it('refuses a pool that cannot fit the measured garden instead of moving architecture', async () => {
  const r = await build(0, 4), base = {...r.spec!, site: {width: 60, depth: 30}};
  const design = (await new PromptMockDesigner(MOCK_BRIEFS[0]).design(5, {} as never)).value as Record<string, unknown>;
  const out = deriveSiteGeneral(base, {...design, pool: {scale: 'lap', anchor: 'veranda', separation: 'promenade', water: 'turquoise'}}, MOCK_BRIEFS[0]);
  expect(out.findings.map(f => f.code)).toContain('pool-space');
  expect(out.spec).toBe(base);
});

it('maps rectangles and sides through every quarter-turn garden frame and back exactly', () => {
  const r = {x0: -3, x1: 5, z0: 1, z1: 9};
  for (const g of SIDES) {
    const f = gardenFrame(g);
    expect(f.side(g)).toBe('s');
    expect(f.toWorld(f.toLocal(r))).toEqual(r);
  }
});

it('routes a dry walk around an obstacle with straight 1.5 m runs', () => {
  const runs = routeWalk({x0: -2, x1: 2, z0: -12, z1: -9}, [{x0: -2, x1: 2, z0: 9, z1: 12}], [{x0: -8, x1: 8, z0: -6, z1: 6}], {x0: -20, x1: 20, z0: -15, z1: 15})!;
  expect(runs.length).toBeGreaterThan(1);
  for (const w of runs) { expect(Math.min(w.x1 - w.x0, w.z1 - w.z0)).toBeCloseTo(1.5); expect(overlapArea(w, {x0: -8, x1: 8, z0: -6, z1: 6})).toBe(0); }
});
