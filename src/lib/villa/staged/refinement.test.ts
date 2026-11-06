import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {Output} from 'ai';
import {loadHouse, saveHouse} from './save';
import {refinementBaseline, stageRefinement, stagedReviewSchema} from './refinement';
import {strictSchemaIssues} from '../scene/strictSchema';

const saved = loadHouse(readFileSync('docs/architecture/staged-villa/stage5-site/terra-stage5.save.json', 'utf8'));
const base = refinementBaseline(saved.spec);
const policy = {baseline: base.hash, finishBlocks: [], siteItems: ['palm-5'], components: ['landscape:palm-5'], maxChanged: 1};
const proposal = {summary: 'OFFLINE transaction fixture, not AI or an aesthetic recommendation', observations: [{view: 'arrival', responsibility: 'architecture', component: 'landscape:palm-5', evidence: 'Test-only semantic movement; visual merit unverified.'}], ops: [{op: 'move-site-item', id: 'palm-5', dx: .2, dz: 0}]};

describe('Stage 6 bounded offline boundary on the actual Stage 5 source', () => {
  it('retains the exact 377-element accepted baseline and a provider-compatible contract', async () => {
    expect(JSON.stringify(base.scene.elements)).toBe(JSON.stringify(saved.scene.elements));
    expect(base.scene.elements).toHaveLength(377);
    const wire = (await (Output.object({schema: stagedReviewSchema}) as unknown as {responseFormat: Promise<{schema: Record<string, unknown>}>}).responseFormat).schema;
    expect(strictSchemaIssues(wire)).toEqual([]);
  });
  it('accepts one semantic move, preserves 376 elements and reloads the candidate', async () => {
    const original = JSON.stringify(saved);
    const out = await stageRefinement(saved.spec, proposal, policy);
    expect(out.accepted, JSON.stringify(out.reasons)).toBe(true);
    if (!out.accepted) return;
    expect(out.diff!.changed).toEqual(['tree-palm-5']);
    expect(out.diff!.unchanged).toBe(376);
    expect(JSON.stringify(loadHouse(saveHouse(out.spec, out.scene)).scene.elements)).toBe(JSON.stringify(out.scene.elements));
    expect(JSON.stringify(saved)).toBe(original);
  });
  it('bounds a finish-only candidate and rejects an undersized semantic scope', async () => {
    const roomIds: string[] = [];
    const walk = (n: typeof saved.spec.blocks[number]['plan']): void => {if ('room' in n) roomIds.push(`room:${n.room.id}`); else {walk(n.a); walk(n.b);}};
    walk(saved.spec.blocks.find(b => b.id === 'entry-pavilion')!.plan);
    const components = ['block:entry-pavilion', 'roof:entry-pavilion', 'entrance', ...roomIds];
    const finishPolicy = {...policy, finishBlocks: ['entry-pavilion'], siteItems: [], components, maxChanged: 80};
    const finish = {...proposal, observations: [{...proposal.observations[0], component: roomIds[0]}], ops: [{op: 'set-finish', block: 'entry-pavilion', wall: 'sage', wallColor: '#b9a88f'}]};
    const out = await stageRefinement(saved.spec, finish, finishPolicy);
    expect(out.accepted, JSON.stringify(out.reasons)).toBe(true);
    if (!out.accepted) return;
    expect(out.spec.blocks.map(b => b.plan)).toEqual(saved.spec.blocks.map(b => b.plan));
    expect(out.spec.blocks.map(b => b.roof)).toEqual(saved.spec.blocks.map(b => b.roof));
    expect(out.spec.stairs).toEqual(saved.spec.stairs);
    expect(out.spec.siteWork).toEqual(saved.spec.siteWork);
    expect(out.diff!.added).toEqual([]); expect(out.diff!.removed).toEqual([]);
    expect((await stageRefinement(saved.spec, finish, {...finishPolicy, components: [roomIds[0]]})).accepted).toBe(false);
  });
  it.each([
    ['stale baseline', proposal, {...policy, baseline: '0'.repeat(64)}],
    ['unauthorized site', {...proposal, ops: [{...proposal.ops[0], id: 'palm-6'}]}, policy],
    ['wrong component', proposal, {...policy, components: ['pool']}],
    ['unsupported roof edit', {...proposal, ops: [{op: 'set-roof', blocks: ['plinth'], roof: {form: 'flat', overhang: 0, material: 'ivory'}}]}, policy],
    ['excess displacement', {...proposal, ops: [{...proposal.ops[0], dx: 20}]}, policy],
    ['renderer critique only', {...proposal, observations: [{...proposal.observations[0], responsibility: 'renderer'}]}, policy],
    ['unknown semantic observation', {...proposal, observations: [{...proposal.observations[0], component: 'room:invented'}]}, policy],
    ['no change', {...proposal, ops: [{...proposal.ops[0], dx: 0}]}, policy],
  ])('rejects %s atomically', async (_label, review, permissions) => {
    const out = await stageRefinement(saved.spec, review, permissions);
    expect(out.accepted).toBe(false);
    expect(out.spec).toBe(saved.spec);
    expect(JSON.stringify(out.scene.elements)).toBe(JSON.stringify(saved.scene.elements));
  });
});
