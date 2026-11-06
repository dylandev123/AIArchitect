/* eslint-disable @typescript-eslint/no-explicit-any -- slice payloads are validated by zod at the boundary */
import {describe, expect, it} from 'vitest';
import {villaSpec} from './villa.fixture';
import {MockDesigner, sliceOf} from './mockDesigner';
import {runStagedGeneration} from './pipeline';
import {compileHouse} from './compile';
import {runEdit} from './edits';
import {MockEditPlanner} from './mockEditPlanner';
import {loadHouse, saveHouse} from './save';
import {validateMassing} from './validate';
import {isCanonicalPlan} from '../canonical/plan';

const brief = 'flat-site villa';
const base = () => runStagedGeneration({designer: new MockDesigner(villaSpec), brief, site: villaSpec.site, requiredBedrooms: 4});
const house = async () => { const r = await base(); return {spec: r.spec!, scene: r.scene!, components: r.components!}; };

describe('staged generation', () => {
  it('completes all five stages with checkpoints and five calls', async () => {
    const r = await base();
    expect(r.status).toBe('complete');
    expect(r.checkpoints.map(c => c.accepted)).toEqual([true, true, true, true, true]);
    expect(r.calls).toHaveLength(5);
    expect(r.scene!.terrain).toBeUndefined();
    expect(r.scene!.elements.length).toBeLessThanOrEqual(400);
  });
  it('stage 2 is real 3D volumes; later stages keep the same blocks', async () => {
    const r = await base();
    expect(r.checkpoints[1].scene!.elements.every(e => e.kind === 'volume')).toBe(true);
    expect(r.checkpoints[4].spec.blocks.map(b => b.id)).toEqual(villaSpec.blocks.map(b => b.id));
  });
  it('repairs a flawed stage once without restarting earlier stages', async () => {
    const bad = {blocks: (sliceOf(villaSpec, 2) as any).blocks.map((b: any) => b.id === 'living' ? {...b, cx: 40} : b)};
    const d = new MockDesigner(villaSpec, {2: bad});
    const r = await runStagedGeneration({designer: d, brief, site: villaSpec.site, requiredBedrooms: 4});
    expect(r.status).toBe('complete');
    expect(d.log.filter(l => l.startsWith('design 1'))).toHaveLength(1);
    expect(d.log.some(l => l.startsWith('correct 2: outside-site'))).toBe(true);
    expect(r.calls).toHaveLength(6);
  });
  it('preserves last good geometry and reports the failure when the bounded correction also fails', async () => {
    const slice = sliceOf(villaSpec, 4) as any;
    const bad = {...slice, exterior: {...slice.exterior, doors: slice.exterior.doors.map((d: any) => d.id === 'garden-living' ? {...d, room: 'kitchen', side: 'w'} : d)}};
    const r = await runStagedGeneration({designer: new MockDesigner(villaSpec, {4: bad}, {4: bad}), brief, site: villaSpec.site, requiredBedrooms: 4});
    expect(r.status).toBe('failed'); expect(r.failedStage).toBe(4);
    expect(r.findings.some(f => f.code === 'door-not-exterior')).toBe(true);
    expect(r.lastGood!.stage).toBe(3); expect(r.scene!.elements.length).toBeGreaterThan(50);
    expect(r.calls).toHaveLength(5); // 1,2,3 + design 4 + one correction; never a loop
  });
  it('enforces the call budget', async () => {
    const r = await runStagedGeneration({designer: new MockDesigner(villaSpec), brief, site: villaSpec.site, maxCalls: 2});
    expect(r.status).toBe('failed'); expect(r.findings[0].code).toBe('budget');
  });
  it('rejects unsupported/unsafe massing', () => {
    const blocks = villaSpec.blocks.map(b => b.id === 'suite' ? {...b, cx: 18, cz: 20} : b);
    expect(validateMassing({site: villaSpec.site, blocks}).map(f => f.code)).toEqual(expect.arrayContaining(['unsupported-upper']));
  });
  it('compiles deterministically with stable component identities', async () => {
    const a = compileHouse(villaSpec, 5), b = compileHouse(villaSpec, 5);
    expect(JSON.stringify(a.scene)).toBe(JSON.stringify(b.scene));
    expect(a.components['slab-entry']).toBe('block:entry');
  });
});

describe('natural-language edits', () => {
  const planner = new MockEditPlanner();
  const edit = async (instruction: string, preserve: string[] = []) => { const h = await house(); return {h, out: await runEdit({planner, instruction, ...h, preserve, requiredBedrooms: 4})}; };
  const wallX = (s: any, id: string) => s.elements.find((e: any) => e.id === id).at[0];

  it('enlarges the primary bedroom: its partition really moves 2 m, other blocks untouched', async () => {
    const {h, out} = await edit('Enlarge the primary bedroom.');
    expect(out.accepted).toBe(true);
    expect(wallX(out.scene, 'p-primary-bedroom-upper-hall')).toBeCloseTo(wallX(h.scene, 'p-primary-bedroom-upper-hall') + 2, 3);
    const touched = Object.keys(out.diff!.byComponent);
    expect(touched.every(c => c.startsWith('room:'))).toBe(true);
    expect(out.diff!.unchanged).toBeGreaterThan(0.9 * out.scene!.elements.length); // nearly everything is untouched
  });
  it('changes roofs to Mediterranean without touching walls', async () => {
    const {out} = await edit('Change the roof to Mediterranean architecture.');
    expect(out.accepted).toBe(true);
    expect(Object.keys(out.diff!.byComponent).sort()).toEqual(['roof:east-wing', 'roof:suite', 'roof:tower']);
    expect(out.scene.elements.find(e => e.id === 'roof-tower')).toMatchObject({roofForm: 'hip', color: '#b5593a'});
  });
  it('adds a real second floor: new volume, lower roof replaced by slab', async () => {
    const {h, out} = await edit('Add a second floor above the east wing.');
    expect(out.accepted).toBe(true);
    expect(out.scene.elements.some(e => e.id === 'roof-east-wing')).toBe(false);
    expect(out.scene.elements.some(e => e.id === 'slab-up-east-wing')).toBe(true);
    expect(out.scene.elements.find(e => e.id === 'roof-east-upper')!.at[1]).toBeGreaterThan(h.scene.elements.find(e => e.id === 'roof-east-wing')!.at[1] + 3);
    expect(out.components['w-sky-lounge-e-0']).toBe('room:sky-lounge');
  });
  it('moves the pool to the veranda edge and removes only the lawn it now covers', async () => {
    const {h, out} = await edit('Move the swimming pool closer to the veranda.');
    expect(out.accepted).toBe(true);
    const z = (s: any) => s.elements.find((e: any) => e.id === 'pool').at[2];
    expect(z(out.scene)).toBeCloseTo(z(h.scene) - 2, 3);
    expect(out.diff!.removed).toEqual(['lawn-pool-gap']);
    expect(Object.keys(out.diff!.byComponent).sort()).toEqual(['landscape:pool-gap', 'pool']);
  });
  it('redesigns the entrance while every bedroom element stays identical', async () => {
    const {out} = await edit('Redesign the main entrance while preserving the bedrooms.', ['room:bedroom-guest', 'room:bedroom-2', 'room:bedroom-3', 'room:primary-bedroom']);
    expect(out.accepted).toBe(true); expect(out.violations).toEqual([]);
    expect(out.diff!.byComponent['entrance'].changed).toBeGreaterThan(3);
  });
  it('rejects an edit that violates preservation or validity, leaving the house unchanged', async () => {
    const h = await house();
    const out = await runEdit({planner, instruction: 'Enlarge the primary bedroom.', ...h, preserve: ['room:primary-bath'], requiredBedrooms: 4});
    expect(out.accepted).toBe(false); expect(out.violations.length).toBeGreaterThan(0);
    expect(out.scene).toBe(h.scene);
  });
  it('rejects model plans that fail the constrained schema', async () => {
    const h = await house();
    const out = await runEdit({planner: {label: 'x', plan: async () => ({plan: {summary: 's', ops: [{op: 'delete-everything'}]}})}, instruction: 'x', ...h});
    expect(out.accepted).toBe(false); expect(out.findings[0].code).toBe('plan-schema');
  });
});

describe('save / reload', () => {
  it('round-trips, stays a valid ordinary scene, and continues editing', async () => {
    const h = await house();
    const saved = saveHouse(h.spec, h.scene, []);
    const loaded = loadHouse(saved);
    expect(loaded.scene).toEqual(h.scene);
    expect(isCanonicalPlan(loaded.scene.architecturalPlan)).toBe(false);
    const out = await runEdit({planner: new MockEditPlanner(), instruction: 'Move the swimming pool closer to the veranda.', spec: loaded.spec, scene: loaded.scene, components: loaded.components, requiredBedrooms: 4});
    expect(out.accepted).toBe(true);
    expect(() => loadHouse(saveHouse(out.spec, out.scene, [{instruction: 'move pool'}]))).not.toThrow();
    const tampered = JSON.parse(saved); tampered.scene.elements[0].at[0] += 1;
    expect(() => loadHouse(JSON.stringify(tampered))).toThrow(/does not match/);
  });
});
