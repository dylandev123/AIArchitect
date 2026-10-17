import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { V3ObjectInspector } from '../V3ObjectInspector';
import { ingestV3GenerationOutput } from '@/lib/v3/ingestion';
import { regressionLadder } from '@/lib/v3/__tests__/regressionLadder';
import { compileV3Scene } from '@/lib/v3/scene';
const state = vi.hoisted(() => ({ json: '', source: 'persisted', append: vi.fn(), select: vi.fn() }));
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(), useState: (initial: unknown) => [initial, vi.fn()] }));
vi.mock('@/store/useProjectStore', () => ({ useProjectStore: (selector: (value: unknown) => unknown) => selector({ getProject: () => ({ houseConfigJson: state.json }), appendVersion: state.append }) }));
vi.mock('@/store/useSceneStore', () => ({ useSceneStore: (selector: (value: unknown) => unknown) => selector({ selectKey: state.select }) }));
vi.mock('@/store/useActiveV3RenderSource', () => ({ useActiveV3RenderSource: () => ({ source: state.source }) }));
type Props = { children?: ReactNode; type?: string; value?: unknown; onChange?: (event: unknown) => void; onClick?: () => void };
function descendants(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...descendants(node.props.children)];
}
beforeEach(() => {
  state.json = JSON.stringify({ version: 3, generationMode: 'v3-scene', v3Scene: ingestV3GenerationOutput(regressionLadder[0].raw).scene });
  state.source = 'persisted';
  state.append.mockReset();
  state.append.mockImplementation((_id: string, _summary: string, json: string) => { state.json = json; });
});
describe('V3 semantic inspector callbacks', () => {
  const controls = () => descendants(V3ObjectInspector({ projectId: 'ui', objectId: 'living' }));
  it('moves, resizes, recolors and duplicates authored geometry through the atomic executor', () => {
    const before = JSON.parse(state.json).v3Scene;
    let inputs = controls().filter(node => node.type === 'input' && node.props.type === 'number');
    inputs[0].props.onChange!({ target: { valueAsNumber: 5 } });
    inputs = controls().filter(node => node.type === 'input' && node.props.type === 'number');
    inputs[3].props.onChange!({ target: { valueAsNumber: 18 } });
    controls().find(node => node.type === 'input' && node.props.type === 'color')!.props.onChange!({ target: { value: '#334455' } });
    const scene = JSON.parse(state.json).v3Scene;
    expect(scene.objects[0]).toMatchObject({ id: 'living', architecture: { x: 5, width: 18 }, transform: { position: [5, 1.7, 0] }, dimensions: [18, 3.4, 8], material: { color: '#334455' } });
    expect(scene.objects).toHaveLength(before.objects.length);
    expect(compileV3Scene(scene).primitives).not.toEqual(compileV3Scene(before).primitives);
    controls().find(node => node.type === 'button' && node.props.children === 'Duplicate')!.props.onClick!();
    expect(JSON.parse(state.json).v3Scene.objects).toHaveLength(before.objects.length + 1);
  });
  it('does not commit invalid dimensions or allow edits while a preview/history is active', () => {
    const before = state.json;
    const input = controls().filter(node => node.type === 'input' && node.props.type === 'number')[3];
    input.props.onChange!({ target: { valueAsNumber: -1 } });
    expect(state.append).not.toHaveBeenCalled();
    expect(state.json).toBe(before);
    for (const source of ['failed-preview', 'render-history']) {
      state.source = source;
      expect(controls().some(node => node.type === 'input')).toBe(false);
    }
  });
});
