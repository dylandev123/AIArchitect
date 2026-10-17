import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { PrimitiveMesh } from '../PrimitiveMesh';
import { ingestV3GenerationOutput } from '@/lib/v3/ingestion';
import { compileV3Scene } from '@/lib/v3/scene';
import { regressionLadder } from '@/lib/v3/__tests__/regressionLadder';
import { wallScene } from '@/lib/v3/__tests__/interiorFixture';
import { compileV3InteriorWalls, resolveV3SelectionTarget } from '@/lib/v3/interiorWalls';
const state = vi.hoisted(() => ({ selectedKey: null, selectKey: vi.fn(), focusedRoom: null, enterRoom: vi.fn() }));
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(), useMemo: (factory: () => unknown) => factory(), useEffect: () => {}, useRef: () => ({ current: null }), useState: (initial: unknown) => [initial, vi.fn()] }));
vi.mock('@/store/useSceneStore', () => ({ useSceneStore: Object.assign((selector: (value: typeof state) => unknown) => selector(state), { getState: () => state }) }));
vi.mock('@/store/useAssetStore', () => ({ useAssetStore: (selector: (value: { catalog: never[] }) => unknown) => selector({ catalog: [] }) }));
vi.mock('@/lib/pbrLibrary', () => ({ usePbrSet: () => ({ textures: null, failed: false }), SURFACE_PBR: {} }));
beforeEach(() => vi.clearAllMocks());
describe('V3 actual mesh click handlers', () => {
  const scene = ingestV3GenerationOutput(regressionLadder[0].raw).scene;
  const parts = compileV3Scene(scene).primitives;
  for (const role of ['facade wall', 'facade glazing', 'roof plane', 'pool basin', 'pool shell', 'pool coping', 'water surface']) {
    it(`selects the authored object when clicking ${role}`, () => {
      const primitive = parts.find(p => p.componentRole === role)!;
      expect(primitive, role).toBeDefined();
      const mesh = PrimitiveMesh({ primitive }) as ReactElement<{ onClick: (event: unknown) => void }>;
      const event = { stopPropagation: vi.fn() };
      mesh.props.onClick(event);
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(state.selectKey).toHaveBeenCalledWith(primitive.sourceObjectId);
      expect(state.selectKey).not.toHaveBeenCalledWith(primitive.id);
      expect(state.enterRoom).not.toHaveBeenCalled();
    });
  }
  it('clicking a derived interior wall or header selects its semantic partition or door, never the piece', () => {
    const interior = wallScene();
    for (const primitive of compileV3InteriorWalls(interior)) {
      vi.clearAllMocks();
      const mesh = PrimitiveMesh({ primitive }) as ReactElement<{ onClick: (event: unknown) => void }>;
      mesh.props.onClick({ stopPropagation: vi.fn() });
      expect(state.selectKey).toHaveBeenCalledWith(primitive.sourceObjectId);
      expect(state.selectKey).not.toHaveBeenCalledWith(primitive.id);
      expect(resolveV3SelectionTarget(interior, primitive.sourceObjectId!)?.kind).toBe(primitive.id.includes(':header:') ? 'door' : 'partition');
    }
  });
  it('makes failed-preview/history water read-only', () => {
    const primitive = parts.find(p => p.componentRole === 'water surface')!;
    const mesh = PrimitiveMesh({ primitive, readOnly: true }) as ReactElement<{ onClick: (event: unknown) => void }>;
    mesh.props.onClick({ stopPropagation: vi.fn() });
    expect(state.selectKey).not.toHaveBeenCalled();
  });
});
