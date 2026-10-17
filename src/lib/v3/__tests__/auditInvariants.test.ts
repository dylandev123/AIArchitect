import { describe, expect, it } from 'vitest';
import { ingestV3GenerationOutput } from '../ingestion';
import { executeV3SceneOperations } from '../operations';
import { resolveActiveV3RenderSource } from '../activeRenderSource';
import { recoverV3FailedPreview } from '../failedPreview';
import { regressionLadder } from './regressionLadder';
import { compileV3Scene } from '../scene';
const fixture = () => ingestV3GenerationOutput(regressionLadder[0].raw).scene;
const json = (scene = fixture()) => JSON.stringify({ version: 3, generationMode: 'v3-scene', v3Scene: scene });
describe('V3 architectural audit invariants', () => {
  it('ignores implicit and cross-project history while honoring explicit matching history', () => {
    const persistedJson = json();
    const history = fixture(); history.objects[0].label = 'Historical';
    const input = { projectId: 'current', persistedJson, rendererJson: json(history), failedPreviewActive: false };
    expect(resolveActiveV3RenderSource(input).source).toBe('persisted');
    expect(resolveActiveV3RenderSource({ ...input, historyActive: true, historyProjectId: 'other' }).source).toBe('persisted');
    expect(resolveActiveV3RenderSource({ ...input, historyActive: true, historyProjectId: 'current' }).source).toBe('render-history');
    expect(resolveActiveV3RenderSource({ ...input, rendererJson: '{}' }).source).toBe('persisted');
  });
  it('normalizes unknown semantic create operations before validating and atomically commits', () => {
    const scene = fixture();
    const result = executeV3SceneOperations(scene, { intent: 'Add something new', commentary: 'harmless drift', operations: [{ op: 'create', object: { id: 'new-object', type: 'unseen-future-object', architecture: { x: '20', z: 0, baseElevation: 0, width: 2, depth: 3, height: 4 }, support: { kind: 'object', hostId: 'missing', relationship: 'rests-on' } } }] });
    expect(result.errors).toEqual([]);
    expect(result.scene.objects.at(-1)?.architecture?.x).toBe(20);
    expect(compileV3Scene(result.scene).primitives.some(p => p.sourceObjectId === 'new-object')).toBe(true);
    expect(scene.objects).toHaveLength(6);
  });
  it('rejects malformed operations, invalid geometry, and compiler-child targets without partial commit', () => {
    const scene = fixture();
    for (const bad of [{ op: 'move', target: 'living' }, { op: 'resize', target: 'living', dimensions: [10, -1, 8] }, { op: 'delete', target: 'living-slab-1' }, { op: 'nonsense', target: 'living' }]) {
      const result = executeV3SceneOperations(scene, { intent: 'Atomic change', operations: [{ op: 'editArchitecture', target: 'living', architecture: { width: 30 } }, bad] });
      expect(result.ok).toBe(false); expect(result.scene).toEqual(scene);
    }
  });
  it('updates named dimensions through move, resize, duplication and material edits', () => {
    const result = executeV3SceneOperations(fixture(), { intent: 'Local edits', operations: [
      { op: 'move', target: 'living', position: [3, 2, 7] },
      { op: 'resize', target: 'living', dimensions: [14, 4, 9] },
      { op: 'changeMaterial', target: 'living', material: { color: '#445566' } },
      { op: 'duplicate', target: 'living', id: 'living-copy', position: [30, 2, 7] },
    ] });
    expect(result.errors).toEqual([]);
    expect(result.scene.objects.find(o => o.id === 'living-copy')?.architecture).toMatchObject({ x: 30, z: 7, width: 14, height: 4, depth: 9, baseElevation: 0 });
  });
  it('preserves named architectural authority through failed-preview recovery', () => {
    const preview = recoverV3FailedPreview(regressionLadder[0].raw);
    expect(preview?.scene.objects).toHaveLength(6);
    expect(preview?.scene.objects[0].architecture).toEqual(regressionLadder[0].raw.objects[0].architecture);
  });
  it('returns fatal validation instead of throwing on unusable provider objects', () => {
    for (const objects of [[null], [5], [{ id: 'broken' }]]) {
      expect(() => ingestV3GenerationOutput({ version: 3, site: { width: 100, depth: 100 }, objects })).not.toThrow();
      expect(ingestV3GenerationOutput({ version: 3, site: { width: 100, depth: 100 }, objects }).ok).toBe(false);
    }
  });
});
