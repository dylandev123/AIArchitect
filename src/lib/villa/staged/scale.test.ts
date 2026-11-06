/** Phase 2: architectural scale, layering and the element budget. Offline only; zero provider calls.
 * The three studies are developer-authored answers through the real five-stage pipeline (construction capability). */
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {advancePromptRun, type PromptRun} from './promptGeneration';
import {ScaleDesigner, SCALE_BRIEFS, SCALE_SITES, type ScaleKey} from './scale.fixture';
import {loadHouse, saveHouse} from './save';
import {compileHouse, ElementBudgetError} from './compile';
import {briefScaleFindings, briefScaleFloor, compositionMetrics, compositionReport, scalePlanConsistency, visionBriefFindings} from './composition';
import {allRooms} from './layout';
import {measure, runStagedGeneration, type Designer} from './pipeline';
import {featureAudit} from './featureAudit';
import {runEdit} from './edits';
import {applySceneOperations, validateScene, SCENE_ELEMENT_LIMIT, type ArchitecturalScene} from '../scene/model';
import {groupBoxes} from './grouping';

const builds = new Map<ScaleKey, Promise<{run: PromptRun; save: string}>>();
const build = (key: ScaleKey) => {
  if (!builds.has(key)) builds.set(key, (async () => {
    const run: PromptRun = {input: {brief: SCALE_BRIEFS[key], site: SCALE_SITES[key]}}, d = new ScaleDesigner(key);
    let out;
    for (let s = 1; s <= 5; s++) { out = await advancePromptRun(run, d); if (out.status === 'failed') throw Error(`${key} stage ${s}: ${JSON.stringify(out.findings)}`); }
    return {run, save: out!.save!};
  })());
  return builds.get(key)!;
};

describe('one generator, three scales', () => {
  it.each([
    ['modest', {levels: 1, gfa: [150, 260], beds: 3, maxElements: 150}],
    ['villa', {levels: 2, gfa: [900, 1400], beds: 6, maxElements: 600}],
    ['estate', {levels: 2, gfa: [2500, 4000], beds: 7, maxElements: 900}],
  ] as const)('%s: real metres, valid geometry, connected rooms, save/reopen identical', async (key, want) => {
    const {save} = await build(key), h = loadHouse(save), m = compositionMetrics(h.spec), rooms = allRooms(h.spec);
    expect(h.spec.construction).toBe('scale-1');
    expect(m.levels).toBe(want.levels);
    expect(m.grossFloorAreaM2).toBeGreaterThanOrEqual(want.gfa[0]); expect(m.grossFloorAreaM2).toBeLessThanOrEqual(want.gfa[1]);
    expect(rooms.filter(r => r.type === 'bedroom')).toHaveLength(want.beds);
    expect(measure(h.spec, 5, want.beds).findings).toEqual([]); // includes reachability through doors and stairs
    expect(featureAudit(h.spec, h.scene, h.components, 5, SCALE_BRIEFS[key]).findings).toEqual([]);
    expect(h.scene.elements.length).toBeLessThan(want.maxElements);
    expect(loadHouse(saveHouse(h.spec, h.scene, h.history)).scene.elements).toEqual(h.scene.elements);
  }, 60000);

  it('the estate is genuinely large and layered: wings, double-height halls, terraces, projection, upper access', async () => {
    const h = loadHouse((await build('estate')).save), m = compositionMetrics(h.spec);
    expect(m.wings).toBe(7); expect(m.footprintM2).toBeGreaterThan(2000);
    expect(m.doubleHeightM2).toBeGreaterThan(700); expect(m.upperTerraceM2).toBeGreaterThan(150); expect(m.cantileverM2).toBeGreaterThan(40);
    expect(m.distinctTops.length).toBeGreaterThanOrEqual(3); // low wings, terrace roofs, double-height and upper eaves
    const upperRooms = allRooms(h.spec).filter(r => r.level === 1);
    expect(upperRooms.length).toBeGreaterThan(10);
    expect(h.spec.stairs).toHaveLength(2);
    // A double-height great room is one occupied level: nothing is built above it.
    expect(h.scene.elements.some(e => e.id.startsWith('slab-up-great-room'))).toBe(false);
    // Grand entrance: a wide, tall door in the double-height arrival hall, a deep canopy and a formal court.
    const door = h.scene.elements.find(e => e.semanticType === 'front-door')!;
    expect(door.size[0]).toBeGreaterThan(2.5); expect(door.size[1]).toBeGreaterThan(4);
    expect(h.spec.exterior.entrance.court.w).toBeGreaterThanOrEqual(12);
    expect(h.spec.siteWork.pool).toMatchObject({w: 20, d: 7});
  }, 60000);

  it('the modest home stays modest: no grand entrance, no upper floor, no grouped-scale inflation', async () => {
    const h = loadHouse((await build('modest')).save), m = compositionMetrics(h.spec);
    expect(m.footprintM2).toBeLessThan(260); expect(h.spec.exterior.entrance.court).toEqual({w: 5, d: 4});
    expect(h.scene.elements.find(e => e.semanticType === 'front-door')!.size[0]).toBeLessThan(2);
  }, 60000);
});

describe('element budget: grouping, not dropping', () => {
  it('groups stair flights, colonnades and window trim as single selectable components', async () => {
    const h = loadHouse((await build('villa')).save), groups = h.scene.elements.filter(e => e.parts);
    expect(h.scene.elements.filter(e => e.semanticType === 'stair').map(e => e.parts!.length)).toEqual([17, 17]);
    expect(groups.some(e => e.id.startsWith('lintels-'))).toBe(true); expect(groups.some(e => e.id.startsWith('shutters-'))).toBe(true);
    for (const e of groups) expect(h.components[e.id]).toMatch(/^(stair|veranda|block):/);
    const cp = (await build('villa')).run.result!.checkpoints.find(c => c.stage === 5)!;
    expect(cp.budget).toMatchObject({trimDropped: 0});
  }, 60000);

  it('the original construction could not build these houses: the villa drops trim and the estate fails outright', async () => {
    const villa = loadHouse((await build('villa')).save).spec, estate = loadHouse((await build('estate')).save).spec;
    const b = compileHouse({...villa, construction: undefined}, 5).budget!;
    expect(b.cap).toBe(400); expect(b.trimDropped).toBeGreaterThan(100);
    expect(() => compileHouse({...estate, construction: undefined}, 5)).toThrow(ElementBudgetError);
  }, 60000);

  it('grouped parts stay inside their element envelope; scene and model-operation limits are separate', () => {
    const g = groupBoxes([{at: [1.03, 0.5, 2], size: [0.3, 1, 0.3]}, {at: [4.07, 0.5, 2], size: [0.3, 1, 0.3]}]);
    const scene = validateScene({version: 'architectural-scene-1', name: 't', elements: [{id: 'g', label: 'g', kind: 'volume', ...g}]});
    expect(scene.elements[0].parts).toHaveLength(2);
    expect(() => validateScene({version: 'architectural-scene-1', name: 't', elements: [{id: 'g', label: 'g', kind: 'volume', at: [0, 0, 0], size: [1, 1, 1], parts: [[2, 0, 0, 1, 1, 1]]}]})).toThrow('envelope');
    expect(() => validateScene({version: 'architectural-scene-1', name: 't', elements: [{id: 'g', label: 'g', kind: 'wall', at: [0, 0, 0], size: [1, 1, 1], parts: [[0, 0, 0, 1, 1, 1]]}]})).toThrow('plain volume');
    const big: ArchitecturalScene = {version: 'architectural-scene-1', name: 'big', elements: Array.from({length: 1000}, (_, i) => ({id: `e-${i}`, label: 'e', kind: 'volume' as const, at: [i, 0.5, 0] as [number, number, number], size: [0.5, 1, 0.5] as [number, number, number], rotation: 0, material: 'ivory' as const, panels: 4}))};
    expect(validateScene(big).elements).toHaveLength(1000); expect(SCENE_ELEMENT_LIMIT).toBe(1600);
    // Element operations never grow a scene past the original 400-element budget.
    expect(() => applySceneOperations(big, [{op: 'add', element: {id: 'extra', label: 'x', kind: 'volume', at: [0, 0.5, 5], size: [1, 1, 1]}}])).toThrow('limited to 400');
  });
});

describe('scale is planned, measured and enforced', () => {
  it('an explicit luxury/estate brief is never satisfied by a modest residence with the right bedroom labels', async () => {
    expect(briefScaleFloor(SCALE_BRIEFS.estate)).toMatchObject({ambition: 'estate', minGfa: 550});
    expect(briefScaleFloor(SCALE_BRIEFS.modest)).toBeUndefined();
    const modest = loadHouse((await build('modest')).save).spec;
    expect(briefScaleFindings(modest, SCALE_BRIEFS.estate).map(f => f.code)).toEqual(['brief-scale']);
    // Through the pipeline: the modest massing answering the estate brief fails Stage 2 after its one correction.
    const d = new ScaleDesigner('modest'), estateLike: Designer = {label: 'offline mismatch', correct: async (s, c) => d.design(s, c),
      design: async (s, c) => { const r = await d.design(s, c); if (s === 1) Object.assign((r.value as {vision: object}).vision, {ambition: 'estate', ambitionEvidence: 'test', briefConstraints: [], scale: {footprintM2: 700, grossFloorAreaM2: 700, levels: 1, wings: 2, principalSpaces: [{name: 'x', kind: 'living', approxAreaM2: 60, height: 'standard'}], scaleEvidence: 'test'}}); return r; }};
    const res = await runStagedGeneration({designer: estateLike, brief: SCALE_BRIEFS.estate.replace('two storeys', ''), site: SCALE_SITES.estate, requiredBedrooms: 3, stopAfter: 2});
    expect(res.status).toBe('failed'); expect(res.failedStage).toBe(2); expect(res.findings.some(f => f.code === 'brief-scale')).toBe(true);
  }, 60000);

  it('Stage 1 plans are checked against the brief and the property; Stage 2 must build the planned scale', async () => {
    const v = loadHouse((await build('villa')).save).spec;
    const plan = v.direction.vision!;
    expect(visionBriefFindings({...plan, scale: {...plan.scale!, grossFloorAreaM2: 250}}, SCALE_BRIEFS.villa).map(f => f.subject)).toContain('scale');
    expect(scalePlanConsistency({...plan, scale: {...plan.scale!, footprintM2: 4000}}, v.site).map(f => f.subject)).toContain('footprint');
    // Halve the built massing: the vision's own scale plan flags it (correctable, accepted with a warning after one correction).
    const small = {...v, blocks: v.blocks.filter(b => b.level === 0 && b.id !== 'east-wing' && b.id !== 'family-wing')};
    const codes = compositionReport(small, 2).findings.map(f => `${f.code}:${f.subject}`);
    expect(codes).toEqual(expect.arrayContaining(['vision-scale:gross-floor-area', 'vision-scale:levels', 'vision-scale:wings']));
  }, 60000);

  it('semantic edits on the large houses stay atomic and preserve unrelated components', async () => {
    const h = loadHouse((await build('estate')).save);
    const r = await runEdit({planner: {label: 'fixed', plan: async () => ({plan: {summary: 'tall great room', ops: [{op: 'set-block-height', block: 'great-room', height: 'tall'}]}})}, instruction: 'Lower the great room.', spec: h.spec, scene: h.scene, components: h.components, preserve: ['block:family-suites', 'stair:family-stair-flight', 'pool'], requiredBedrooms: 7});
    expect(r.accepted, JSON.stringify(r.findings)).toBe(true); expect(r.diff!.unchanged).toBeGreaterThan(0.9 * h.scene.elements.length);
    expect(JSON.stringify(loadHouse(saveHouse(r.spec, r.scene)).scene.elements)).toBe(JSON.stringify(r.scene.elements));
  }, 60000);
});

it('the preserved real-Terra house still rebuilds byte-identically under the original construction', () => {
  const text = readFileSync('docs/architecture/automatic-house/live-v3-final/completed.save.json', 'utf8'), h = loadHouse(text);
  expect(h.spec.construction).toBeUndefined();
  expect(compileHouse(h.spec, 5).budget).toMatchObject({cap: 400, total: 263});
  expect(h.scene.elements.some(e => e.parts)).toBe(false);
});
