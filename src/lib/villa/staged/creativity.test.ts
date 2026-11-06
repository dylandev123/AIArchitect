/** Phase 1 architectural creativity: structured vision, variable heights, composition checks. Offline only:
 * developer-authored stage answers (creativity.fixture.ts) through the real pipeline, compiler and validators. */
import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {advancePromptRun, type PromptRun} from './promptGeneration';
import {runStagedGeneration, type Checkpoint, type Designer} from './pipeline';
import {StudyDesigner, STUDY_BRIEFS, STUDY_SITES, type StudyKey} from './creativity.fixture';
import {loadHouse, saveHouse} from './save';
import {runEdit} from './edits';
import {compileHouse} from './compile';
import {relationshipFindings, validateMassing} from './validate';
import {featureAudit} from './featureAudit';
import {compositionMetrics, visionBriefFindings} from './composition';
import {wallTopOf, WALL_HEIGHTS, type HouseSpec, type Vision} from './spec';
import {blockRect} from './layout';
import type {SceneElement} from '../scene/model';

// Stage 5's site layout search grows with site area (about 11 s for the 96 x 72 m estate): allow for it.
vi.setConfig({testTimeout: 180000});
const cache = new Map<string, ReturnType<typeof buildUncached>>();
/** Each study is built once per file; tests only read the results. */
const build = (key: StudyKey, opts: ConstructorParameters<typeof StudyDesigner>[1] = {}) => {
  const k = `${key}:${opts.flatten ? 'flat' : 'full'}`;
  if (opts.stage2) return buildUncached(key, opts);
  if (!cache.has(k)) cache.set(k, buildUncached(key, opts));
  return cache.get(k)!;
};
async function buildUncached(key: StudyKey, opts: ConstructorParameters<typeof StudyDesigner>[1] = {}) {
  const run: PromptRun = {input: {brief: STUDY_BRIEFS[key], site: STUDY_SITES[key]}}, designer = new StudyDesigner(key, opts);
  let out;
  for (let stage = 1; stage <= 5; stage++) { out = await advancePromptRun(run, designer); if (out.status === 'failed') break; }
  return {run, out: out!, designer};
}
const cp = (run: PromptRun, stage: number) => run.result!.checkpoints.find(c => c.stage === stage && c.accepted) as Checkpoint;
const wallsOf = (els: SceneElement[], c: Record<string, string>, block: string, rooms: string[]) => els.filter(e => e.kind === 'wall' && /^w-/.test(e.id) && rooms.some(r => c[e.id] === `room:${r}` || (c[e.id] === 'entrance' && e.id.startsWith(`w-${r}-`))) && e.id.includes('-')).map(e => ({id: e.id, h: e.size[1], top: e.at[1] + e.size[1] / 2, opening: e.opening}));
const roomsIn = (spec: HouseSpec, block: string) => spec.blocks.filter(b => b.id === block).flatMap(b => { const ids: string[] = []; const walk = (n: HouseSpec['blocks'][number]['plan']): void => { if ('room' in n) ids.push(n.room.id); else { walk(n.a); walk(n.b); } }; walk(b.plan); return ids; });
const roofTop = (els: SceneElement[], id: string) => { const e = els.find(x => x.id === `roof-${id}`)!; return e.at[1] + e.size[1] / 2; };
const roofBase = (els: SceneElement[], id: string) => { const e = els.find(x => x.id === `roof-${id}`)!; return e.at[1] - e.size[1] / 2; };

describe.each(['modest', 'villa', 'estate'] as const)('%s study', key => {
  it('completes all five stages, audits clean, and saves/reopens identically', async () => {
    const {out, run} = await build(key);
    expect(out.status, JSON.stringify(out.findings)).toBe('complete');
    const h = loadHouse(out.save!);
    expect(relationshipFindings(h.scene, 5)).toEqual([]);
    expect(featureAudit(h.spec, h.scene, h.components, 5, STUDY_BRIEFS[key]).findings).toEqual([]);
    expect(loadHouse(saveHouse(h.spec, h.scene, h.history)).scene.elements).toEqual(h.scene.elements);
    expect(h.scene.elements.length).toBeLessThanOrEqual(400);
    // Every roof sits exactly on its block's own wall top.
    for (const b of h.spec.blocks.filter(b => h.scene.elements.some(e => e.id === `roof-${b.id}`))) expect(roofBase(h.scene.elements, b.id) + (b.roof.form === 'flat' ? 0 : 0)).toBeCloseTo(wallTopOf(b) + (b.roof.form === 'flat' ? 0 : 0), 2);
    // No unresolved vision discrepancy was needed: the composition builds its own vision.
    for (const c of run.result!.checkpoints) expect((c.warnings ?? []).filter(w => w.code.startsWith('vision-')), `stage ${c.stage}`).toEqual([]);
  });
});

describe('variable heights construct coherent geometry', () => {
  it('modest home stays simple and proportional: one height, one storey, one roof family', async () => {
    const {out, run} = await build('modest'), h = loadHouse(out.save!);
    expect(h.spec.direction.vision!.ambition).toBe('modest');
    expect(h.spec.blocks.every(b => b.level === 0 && b.height === undefined)).toBe(true);
    expect(h.scene.elements.filter(e => e.kind === 'wall' && /^w-/.test(e.id)).every(e => Math.abs(e.size[1] - WALL_HEIGHTS.standard) < 1e-6)).toBe(true);
    expect(h.scene.elements.some(e => e.id.startsWith('band-'))).toBe(false);
    const m = cp(run, 2).composition!;
    expect(m.distinctTops).toEqual([3.4]); expect(m.footprintM2).toBeLessThan(160);
    expect(h.scene.elements.length).toBeLessThan(120);
  });

  it('villa: double-height pavilion, tall entrance, two-storey wing and low guest wing are real, distinct geometry', async () => {
    const {out, run} = await build('villa'), h = loadHouse(out.save!), els = h.scene.elements, c = h.components;
    const living = wallsOf(els, c, 'living-pavilion', roomsIn(h.spec, 'living-pavilion')), entrance = wallsOf(els, c, 'entrance-hall', roomsIn(h.spec, 'entrance-hall')), guest = wallsOf(els, c, 'guest-wing', roomsIn(h.spec, 'guest-wing'));
    expect(living.length).toBeGreaterThan(0); expect(living.every(w => Math.abs(w.h - 6.5) < 1e-6 && Math.abs(w.top - 6.8) < 1e-6)).toBe(true);
    expect(entrance.every(w => Math.abs(w.h - 4.3) < 1e-6)).toBe(true);
    expect(guest.every(w => Math.abs(w.h - 2.7) < 1e-6)).toBe(true);
    // A double-height room is one occupied level: no slab or room above the pavilion.
    expect(h.spec.blocks.find(b => b.id === 'living-pavilion')!.level).toBe(0);
    expect(els.some(e => e.id.startsWith('slab-up-living-pavilion'))).toBe(false);
    // Tall glazing follows the tall wall; the entrance door is taller than a standard door.
    expect(Math.max(...living.flatMap(w => w.opening ? [w.opening.height] : []))).toBeGreaterThan(5);
    expect(els.find(e => e.id.endsWith('-door') && e.semanticType === 'front-door')!.size[1]).toBeCloseTo(3.36, 2); // scale-1: 3.4 m door in a tall hall (3.3 m before)
    // The taller volume's exposed upper wall above a lower neighbour is a band in the taller block's finish.
    const bands = els.filter(e => e.id.startsWith('band-'));
    expect(bands.length).toBeGreaterThan(0);
    for (const b of bands) expect(c[b.id]).toMatch(/^block:/);
    // Layered roofs: the pavilion crowns, then the bedroom storey, then entrance and guest wing step down.
    const tops = ['living-pavilion', 'bedroom-storey', 'entrance-hall', 'guest-wing'].map(id => roofTop(els, id));
    expect(tops).toEqual([...tops].sort((a, b) => b - a)); expect(tops[0] - tops[3]).toBeGreaterThan(4);
    // The lower guest roof tucks under the bedroom storey's eave, which is kept over it.
    const upperRoof = els.find(e => e.id === 'roof-bedroom-storey')!;
    expect(upperRoof.eaves!.south).toBeGreaterThan(0);
    expect(roofTop(els, 'guest-wing')).toBeLessThan(wallTopOf(h.spec.blocks.find(b => b.id === 'bedroom-storey')!));
    const m = cp(run, 2).composition!;
    expect(m.court!.enclosedSides).toBe(3); expect(m.topRange).toBeGreaterThan(3); expect(m.primary).toBe('living-pavilion');
    expect(cp(run, 2).composition!.signatureStatus).toMatchObject({'double-height-living': 'built', 'entrance-volume': 'built', courtyard: 'built', 'layered-roofs': 'checked-at-stage-4'});
  });

  it('estate: glass double-height pavilion, cantilevered suite and low pitched wings', async () => {
    const {out, run} = await build('estate'), h = loadHouse(out.save!), els = h.scene.elements;
    const pavilion = wallsOf(els, h.components, 'living-pavilion', roomsIn(h.spec, 'living-pavilion'));
    expect(pavilion.every(w => Math.abs(w.top - 6.8) < 1e-6)).toBe(true);
    expect(pavilion.filter(w => w.opening && w.opening.sill === 0 && w.opening.glazed).every(w => w.opening!.height > 6)).toBe(true);
    for (const id of ['guest-wing', 'service-wing']) expect(roofBase(els, id)).toBeCloseTo(3.0, 3);
    expect(roofBase(els, 'living-pavilion')).toBeCloseTo(6.8, 3);
    // The veranda keeps its 3 m height beside the double-height host.
    expect(els.find(e => e.id === 'veranda-pavilion-veranda-roof')!.at[1]).toBeCloseTo(3.45, 3);
    expect(cp(run, 2).composition!.signatureStatus).toMatchObject({'cantilevered-upper-volume': 'built', 'tall-principal-volume': 'built', 'glass-pavilion': 'checked-at-stage-4'});
    expect(new Set(h.spec.blocks.map(b => b.roof.form))).toEqual(new Set(['flat', 'hip']));
  });

  it('ambitious designs differ meaningfully from the modest one in proportion and composition', async () => {
    const m = cp((await build('modest')).run, 2).composition!, v = cp((await build('villa')).run, 2).composition!, e = cp((await build('estate')).run, 2).composition!;
    expect(m.topRange).toBe(0); expect(v.topRange).toBeGreaterThan(3); expect(e.topRange).toBeGreaterThan(3);
    expect(v.footprintM2).toBeGreaterThan(3 * m.footprintM2); expect(e.footprintM2).toBeGreaterThan(5 * m.footprintM2);
    expect(v.outlineCorners).toBeGreaterThan(m.outlineCorners); expect(e.outlineCorners).toBeGreaterThan(m.outlineCorners);
  });
});

describe('architectural intentions drive geometry and are checked', () => {
  it('the same design without heights (what the old generator could build) is flatter and is flagged against its own vision', async () => {
    const full = await build('villa'), flat = await build('villa', {flatten: true});
    expect(flat.out.status).toBe('complete');
    const a = loadHouse(full.out.save!).scene.elements, b = loadHouse(flat.out.save!).scene.elements;
    expect(roofTop(a, 'living-pavilion') - roofTop(b, 'living-pavilion')).toBeCloseTo(3.4, 3);
    const unresolved = flat.run.result!.checkpoints.flatMap(c => c.warnings ?? []).filter(w => w.code.startsWith('vision-')).map(w => `${w.code}:${w.subject}`);
    expect(unresolved).toEqual(expect.arrayContaining(['vision-signature-missing:double-height-living', 'vision-entrance:entrance']));
  });

  it('an unbuilt vision promise earns exactly one targeted correction, then the corrected massing is accepted', async () => {
    const real = new StudyDesigner('villa'), flatDesigner = new StudyDesigner('villa', {flatten: true}), prompts: string[] = [];
    const designer: Designer = {label: 'offline correction study', design: (s, ctx) => (s === 2 ? flatDesigner : real).design(s, ctx),
      correct: async (s, ctx, _prev, findings) => { prompts.push(findings.map(f => f.code).join(',')); return real.design(s, ctx); }};
    const r = await runStagedGeneration({designer, brief: STUDY_BRIEFS.villa, site: STUDY_SITES.villa, requiredBedrooms: 4, requiredBaths: 4, stopAfter: 2, maxCorrectionsPerStage: 1});
    expect(r.status).toBe('paused'); expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('vision-signature-missing'); expect(r.calls.filter(c => c.purpose === 'correction')).toHaveLength(1);
    const two = r.checkpoints.find(c => c.stage === 2)!;
    expect(two.accepted).toBe(true); expect(two.attempt).toBe(1); expect(two.spec.blocks.find(b => b.id === 'living-pavilion')!.height).toBe('double');
    expect((two.warnings ?? []).filter(w => w.code.startsWith('vision-'))).toEqual([]);
  });

  it('subjective or still-unbuilt promises never fail the house or loop: accepted with a recorded warning', async () => {
    const flat = new StudyDesigner('villa', {flatten: true});
    const designer: Designer = {label: 'offline', design: (s, ctx) => flat.design(s, ctx), correct: (s, ctx) => flat.design(s, ctx)};
    const r = await runStagedGeneration({designer, brief: STUDY_BRIEFS.villa, site: STUDY_SITES.villa, requiredBedrooms: 4, requiredBaths: 4, stopAfter: 2, maxCorrectionsPerStage: 1});
    const two = r.checkpoints.find(c => c.stage === 2)!;
    expect(two.accepted).toBe(true); expect(r.calls).toHaveLength(3); // stage 1, stage 2, one correction — no more
    expect(two.warnings!.some(w => w.message.startsWith('Unresolved vision discrepancy (accepted after 1 correction)'))).toBe(true);
  });
});

describe('modest briefs are never forced into luxury', () => {
  const vision = (v: Partial<Vision>): Vision => ({style: 's', character: 'c', ambition: 'modest', ambitionEvidence: 'e', composition: 'linear-bar', compositionIntent: 'i', primaryVolume: 'p', focalPoints: ['f'], heightStrategy: 'uniform', roofStrategy: 'single-roof-family', entranceConcept: 'discreet', signatureFeatures: [], briefConstraints: [], ...v});
  it('flags an inflated ambition, an upper storey in a single-storey brief and a contradicted plan shape', () => {
    expect(visionBriefFindings(vision({ambition: 'luxury'}), STUDY_BRIEFS.modest).map(f => f.subject)).toEqual(['ambition']);
    expect(visionBriefFindings(vision({signatureFeatures: [{feature: 'roof-terrace', intent: 'x'}]}), STUDY_BRIEFS.modest).map(f => f.subject)).toEqual(['roof-terrace']);
    expect(visionBriefFindings(vision({ambition: 'modest'}), STUDY_BRIEFS.villa).map(f => f.subject)).toEqual(['ambition']);
    expect(visionBriefFindings(vision({composition: 'pavilion-cluster'}), 'A single-storey house in an L shape').map(f => f.subject)).toEqual(['composition']);
    expect(visionBriefFindings(vision({ambition: 'comfortable'}), 'A beautiful single-storey Caribbean home with a small swimming pool')).toEqual([]);
    expect(visionBriefFindings(undefined, STUDY_BRIEFS.modest)).toEqual([]);
  });
  it('a modest design is not asked for heights, signature features or luxury proportions', async () => {
    const {run} = await build('modest');
    expect(run.result!.checkpoints.flatMap(c => [...c.findings, ...(c.warnings ?? [])]).filter(f => /^vision-|composition-note/.test(f.code))).toEqual([]);
  });
  it('rejects a Stage 1 vision that inflates a modest brief (hard, after the one correction)', async () => {
    const study = new StudyDesigner('modest');
    const designer: Designer = {label: 'offline', design: async (s, ctx) => { const r = await study.design(s, ctx); if (s === 1) (r.value as {vision: Vision}).vision.ambition = 'estate'; return r; }, correct: async () => { throw Error('none'); }};
    const r = await runStagedGeneration({designer, brief: STUDY_BRIEFS.modest, site: STUDY_SITES.modest, stopAfter: 1, maxCorrectionsPerStage: 0});
    expect(r.status).toBe('failed'); expect(r.findings.map(f => f.code)).toEqual(['brief-vision-contradiction']);
  });
});

describe('height rules and editing', () => {
  it('rejects a double-height upper block and a raised block carrying an upper floor', async () => {
    const {out} = await build('villa'), s = loadHouse(out.save!).spec;
    const bad = {...s, blocks: s.blocks.map(b => b.id === 'bedroom-storey' ? {...b, height: 'double' as const} : b.id === 'family-wing' ? {...b, height: 'tall' as const} : b)};
    expect(validateMassing(bad).map(f => f.code).sort()).toEqual(['height-double-upper', 'height-under-upper']);
  });

  it('natural-language height edit re-derives walls, roof and openings, and preserves unrelated components', async () => {
    const {out} = await build('villa'), h = loadHouse(out.save!);
    const planner = {label: 'offline', plan: async () => ({plan: {summary: 'Raise the guest wing to standard height', ops: [{op: 'set-block-height', block: 'guest-wing', height: 'standard'}]}})};
    const r = await runEdit({planner, instruction: 'Make the guest wing as tall as the family rooms', spec: h.spec, scene: h.scene, components: h.components, requiredBedrooms: 4, preserve: ['roof:living-pavilion', 'block:living-pavilion', 'pool']});
    expect(r.accepted, JSON.stringify(r.findings)).toBe(true);
    expect(r.spec!.blocks.find(b => b.id === 'guest-wing')!.height).toBeUndefined();
    expect(roofBase(r.scene!.elements, 'guest-wing')).toBeCloseTo(3.4, 3);
    const reopened = loadHouse(saveHouse(r.spec!, r.scene!, [{instruction: 'raise guest wing'}]));
    expect(JSON.stringify(reopened.scene.elements)).toBe(JSON.stringify(r.scene!.elements)); // JSON form: a save stores -0 as 0
    const invalid = await runEdit({planner: {label: 'offline', plan: async () => ({plan: {summary: 'x', ops: [{op: 'set-block-height', block: 'bedroom-storey', height: 'double'}]}})}, instruction: 'x', spec: h.spec, scene: h.scene, components: h.components, requiredBedrooms: 4});
    expect(invalid.accepted).toBe(false); expect(invalid.findings.map(f => f.code)).toContain('height-double-upper');
  });

  it('keeps semantic identities: every block, roof and room remains a selectable component', async () => {
    const {out} = await build('estate'), h = loadHouse(out.save!), comps = new Set(Object.values(h.components));
    for (const b of h.spec.blocks) expect(comps.has(`block:${b.id}`), b.id).toBe(true);
    for (const id of ['living-pavilion', 'entry-gallery', 'master-suite', 'guest-wing', 'service-wing']) expect(comps.has(`roof:${id}`), id).toBe(true);
  });
});

describe('scene element budget', () => {
  it('reserves the site before decorative trim, keeps every required element and reports what was dropped', async () => {
    const {out, run} = await build('villa'), five = cp(run, 5), h = loadHouse(out.save!);
    // Phase 2 (scale-1): trim is grouped per facade and the whole villa fits; nothing is dropped.
    expect(five.budget!).toMatchObject({cap: 1600, trimDropped: 0}); expect(five.budget!.total).toBe(h.scene.elements.length);
    expect(five.warnings!.some(w => w.code === 'element-budget-trim')).toBe(false);
    // The same design under the original construction (400 cap, single pieces) still reserves the site first and reports.
    const budget = compileHouse({...h.spec, construction: undefined}, 5).budget!;
    expect(budget.total).toBeLessThanOrEqual(400);
    expect(budget.architecture + budget.site + budget.trimPlaced).toBe(budget.total);
    expect(budget.trimDropped).toBeGreaterThan(0);
    // Without the site reservation, trim alone would have filled the scene and Stage 5 could not have compiled.
    expect(budget.architecture + budget.site + budget.trimRequested).toBeGreaterThan(400);
    const comps = new Set(Object.values(h.components));
    for (const id of ['pool', 'entrance', 'veranda:court-loggia', ...h.spec.siteWork.trees.map(t => `landscape:${t.id}`)]) expect(comps.has(id), id).toBe(true);
  });

  it('reports the budget for the preserved baseline without changing it', () => {
    const spec = loadHouse(readFileSync('docs/architecture/automatic-house/live-v3-final/completed.save.json', 'utf8')).spec;
    const b = compileHouse(spec, 5).budget!;
    expect(b).toMatchObject({cap: 400, total: 263, trimDropped: 0});
    expect(compositionMetrics(spec).distinctTops).toEqual([3.4]);
    expect(spec.blocks.map(blockRect)).toHaveLength(3);
  });
});
