import { describe, expect, it } from 'vitest';
import { ingestV3GenerationOutput } from '../ingestion';
import { executeV3SceneOperations } from '../operations';
import { compileV3Scene } from '../scene';
import type { HousePrimitive } from '@/lib/house/types';

// Offline large-house fixture: 3 storeys, 4 masses, stairs, balcony, pool, driveway, landscape.
const mat = (id: string, color: string, surface?: string) => ({ id, color, ...(surface ? { surface } : {}) });
const largeHouse = () => ingestV3GenerationOutput({
  version: 3,
  site: { width: 120, depth: 120, baseElevation: 0 },
  siteHierarchy: { levels: [{ id: 'ground', elevation: 0, region: { x: 0, z: 0, width: 120, depth: 120 }, supportType: 'terrain', access: 'arrival' }], connections: [{ id: 'drive', fromLevelId: 'ground', toLevelId: 'ground', type: 'driveway', route: [[-50, 0, 40], [-10, 0, 12]], width: 5 }], transitions: [] },
  objects: [
    { id: 'main-wing', semanticRole: 'primary living wing', label: 'Main', type: 'building-mass', geometryKind: 'box', material: mat('stucco', '#e8e2d6', 'stucco'), architecture: { x: 0, z: 0, baseElevation: 0, width: 20, depth: 12, height: 10.2 }, levels: 3, roofForm: 'flat', composition: { openings: [{ id: 'entry', type: 'door', facade: 'south', start: .45, end: .55 }, { id: 'view', type: 'glazing-zone', facade: 'north', start: .1, end: .9, heightRatio: .8 }] } },
    { id: 'bedroom-wing', semanticRole: 'bedroom wing', label: 'Bedrooms', type: 'building-mass', geometryKind: 'box', material: mat('timber', '#8a6a4a', 'wood'), architecture: { x: 18, z: -2, baseElevation: 0, width: 12, depth: 10, height: 6.8 }, levels: 2, roofForm: 'gable', pitch: 20, facadePreset: 'punched' },
    { id: 'garage', semanticRole: 'garage', label: 'Garage', type: 'building-mass', geometryKind: 'box', material: mat('stone', '#9a948a', 'stone'), architecture: { x: -16, z: 4, baseElevation: 0, width: 8, depth: 8, height: 3.4 }, levels: 1, facadePreset: 'solid' },
    { id: 'studio', semanticRole: 'studio pavilion', label: 'Studio', type: 'building-mass', geometryKind: 'box', material: mat('glass', '#99bbcc', 'glass'), architecture: { x: 0, z: -18, baseElevation: 0, width: 8, depth: 6, height: 3.4 }, roofForm: 'floating-flat' },
    { id: 'main-balcony', semanticRole: 'balcony', label: 'Balcony', type: 'balcony', geometryKind: 'slab', material: mat('stone2', '#b8ae9d'), architecture: { x: 0, z: 7.5, baseElevation: 3.4, width: 8, depth: 3, height: .25 } },
    { id: 'main-stair', semanticRole: 'exterior stair', label: 'Stair', type: 'stair', geometryKind: 'box', material: mat('concrete', '#aaaaaa', 'concrete'), transform: { position: [12, 1.7, 10], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [1.4, 3.4, 5] },
    { id: 'pool-terrace', semanticRole: 'pool terrace', label: 'Terrace', type: 'terrace', geometryKind: 'slab', material: mat('paving', '#cfc6b4', 'paving'), architecture: { x: 0, z: 20, baseElevation: 0, width: 24, depth: 12, height: .2 } },
    { id: 'pool', semanticRole: 'pool', label: 'Pool', type: 'pool', geometryKind: 'water', material: mat('water', '#2f8fb0', 'water'), architecture: { x: 2, z: 20, baseElevation: -1.6, width: 12, depth: 5, height: 1.8 } },
    { id: 'garden', semanticRole: 'garden', label: 'Garden', type: 'landscape-zone', geometryKind: 'plane', material: mat('grass', '#4a7a42', 'grass'), architecture: { x: 30, z: 25, baseElevation: 0, width: 14, depth: 14, height: .1 } },
  ],
  relationships: [],
}).scene;

const byOwner = (primitives: HousePrimitive[], owner: string) => primitives.filter(p => p.sourceObjectId === owner).map(p => JSON.stringify(p)).sort();

describe('V3 future-proof architecture invariants', () => {
  it('compiles a large multi-mass house with unique, owned derived ids', () => {
    const primitives = compileV3Scene(largeHouse()).primitives;
    const ids = primitives.map(p => p.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    for (const o of largeHouse().objects) expect(primitives.some(p => p.sourceObjectId === o.id || p.id === o.id)).toBe(true);
  });

  it('keeps semantic ids and derived output identical across save/reload', () => {
    const scene = largeHouse(), reloaded = JSON.parse(JSON.stringify(scene));
    expect(reloaded.objects.map((o: { id: string }) => o.id)).toEqual(scene.objects.map(o => o.id));
    expect(compileV3Scene(reloaded)).toEqual(compileV3Scene(scene));
  });

  it('never persists compiler children into the authored scene after an edit', () => {
    const result = executeV3SceneOperations(largeHouse(), { intent: 'Widen bedrooms', operations: [{ op: 'editArchitecture', target: 'bedroom-wing', architecture: { width: 13 } }] });
    expect(result.ok).toBe(true);
    const derived = new Set(compileV3Scene(result.scene).primitives.map(p => p.id));
    expect(result.scene.objects.filter(o => derived.has(o.id) && !compileV3Scene(result.scene).primitives.some(p => p.id === o.id && p.sourceObjectId === o.id))).toEqual([]);
    expect(result.scene.objects).toHaveLength(largeHouse().objects.length);
  });

  it('a local wing edit leaves unrelated authored objects and their derived geometry untouched', () => {
    const before = largeHouse();
    const result = executeV3SceneOperations(before, { intent: 'Make bedroom wing larger', operations: [{ op: 'editArchitecture', target: 'bedroom-wing', architecture: { depth: 11 } }] });
    expect(result.ok).toBe(true);
    for (const id of ['pool', 'pool-terrace', 'garden', 'garage', 'studio', 'main-stair', 'main-balcony']) {
      expect(result.scene.objects.find(o => o.id === id)).toEqual(before.objects.find(o => o.id === id));
      expect(byOwner(compileV3Scene(result.scene).primitives, id)).toEqual(byOwner(compileV3Scene(before).primitives, id));
    }
  });
});
