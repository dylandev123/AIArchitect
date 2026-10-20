import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { HouseModel, HousePrimitive } from '@/lib/house/types';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint, reviseV3ArchitecturalBlueprint, type V3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { auditArchitecturalConstructionFidelity } from '../architecturalConstructionFidelity';
import { fullPropertyBlueprint } from '../parity/fullPropertyBlueprint';
import * as compiler from '../scene';

afterEach(() => vi.restoreAllMocks());

describe('objective blueprint preflight', () => {
  const cases: [string, string, (bp: V3ArchitecturalBlueprint) => void][] = [
    ['reversed opening', 'ARCHITECTURAL_OPENING_SPAN', bp => { const op = bp.buildings[0].facade.openings![0]; if ('start' in op) op.end = op.start - .1; }],
    ['absent upper storey', 'ARCHITECTURAL_OPENING_TARGET', bp => { bp.buildings[1].facade.openings![0].floors = 'upper'; }],
    ['missing segment', 'ARCHITECTURAL_OPENING_TARGET', bp => { bp.buildings[0].facade.openings![1].segmentId = 'missing'; }],
    ['segment on rectangle', 'ARCHITECTURAL_OPENING_TARGET', bp => { bp.buildings[1].facade.openings![0].segmentId = 'missing'; }],
    ['clipped tall door', 'ARCHITECTURAL_OPENING_CLIPPED', bp => { const op = bp.buildings[0].facade.openings![0]; if (op.type === 'door') op.height = 12; }],
    ['enlarged short door', 'ARCHITECTURAL_OPENING_CLIPPED', bp => { const op = bp.buildings[0].facade.openings![0]; if (op.type === 'door') op.height = 1; }],
    ['dropped glazing', 'ARCHITECTURAL_OPENING_CLIPPED', bp => { const op = bp.buildings[0].facade.openings![1]; if (op.type === 'glazing-zone') op.heightRatio = 0; }],
    ['overlapping windows', 'ARCHITECTURAL_OPENING_OVERLAP', bp => { const b = bp.buildings[0]; b.facade.openings!.push({ ...b.facade.openings![1], id: 'duplicate-span' }); }],
    ['gate shadows object', 'ARCHITECTURAL_DUPLICATE_ID', bp => { bp.site.access[0].id = bp.buildings[0].id; }],
    ['dangling room adjacency', 'ARCHITECTURAL_REFERENCE', bp => { bp.roomAdjacencies[0].to = 'missing'; }],
    ['self adjacency', 'ARCHITECTURAL_REFERENCE', bp => { bp.roomAdjacencies[0].to = bp.roomAdjacencies[0].from; }],
    ['arched cutout', 'ARCHITECTURAL_INTERIOR_UNSUPPORTED', bp => { bp.doors[0].program = 'archway'; }],
    ['merged interior openings', 'ARCHITECTURAL_DOOR_OVERLAP', bp => { bp.doors.push({ ...bp.doors[0], id: 'second-door' }); }],
    ['dropped tiny door', 'ARCHITECTURAL_DOOR_CLIPPED', bp => { bp.doors[0].width = .01; }],
    ['door on absent wall', 'ARCHITECTURAL_DOOR_CLIPPED', bp => { bp.partitions[0].partitionType = 'open'; }],
    ['implicit facade-role windows', 'ARCHITECTURAL_COMPILER_OVERRIDE', bp => { bp.buildings[1].facade.facadeRoles = { south: 'view' }; }],
  ];
  it.each(cases)('rejects %s before full construction', (_name, code, mutate) => {
    const bp = fullPropertyBlueprint(); mutate(bp);
    const compile = vi.spyOn(compiler, 'compileV3Scene');
    const result = planV3ArchitecturalBlueprint(bp);
    expect(result.ok).toBe(false); expect(result.approval).toBeUndefined();
    expect(result.findings.map(f => f.code)).toContain(code); expect(compile).not.toHaveBeenCalled();
  });
  it('diagnoses malformed segments without throwing before footprint validation', () => {
    const bp = fullPropertyBlueprint(); if (bp.buildings[0].plan.kind === 'outline') delete bp.buildings[0].plan.segments[0].start;
    expect(planV3ArchitecturalBlueprint(bp).ok).toBe(false);
  });
  it('retains subjective style, privacy and budget as unverified intent', () => {
    const bp = fullPropertyBlueprint();
    bp.character = 'A restrained classical tropical home with informal asymmetry';
    bp.requirements.push({ id: 'style-intent', source: 'user', statement: bp.character, metric: 'style', value: 'classical tropical', objectIds: ['crescent-house'] },
      { id: 'budget-intent', source: 'user', statement: 'Conceptual budget USD 3M', metric: 'budget', value: 'USD 3M', objectIds: [] });
    const result = planV3ArchitecturalBlueprint(bp);
    expect(result.ok).toBe(true); expect(result.findings.some(f => f.severity === 'advisory')).toBe(true);
  });
  it('allows a facade role backed by explicit opening decisions', () => {
    const bp = fullPropertyBlueprint(); bp.buildings[1].facade.facadeRoles = { north: 'private' };
    expect(planV3ArchitecturalBlueprint(bp).ok).toBe(true);
  });
});

describe('construction fidelity against approved components', () => {
  let scene: compiler.V3Scene, model: HouseModel;
  beforeAll(() => {
    const planned = planV3ArchitecturalBlueprint(fullPropertyBlueprint());
    const built = constructV3ArchitecturalBlueprint(planned.approval!);
    expect(built.findings.filter(f => f.severity === 'fatal')).toEqual([]);
    scene = built.scene!; model = built.model!;
  });
  const missing: [string, (p: HousePrimitive) => boolean][] = [
    ['upper slab', p => p.id === 'crescent-house-slab-2-outline'],
    ['plain wall', p => p.id.startsWith('crescent-house:west-wall:level-1:')],
    ['window glass', p => p.id === 'crescent-house:salon-glass:level-0:glass'],
    ['pool water', p => p.id === 'long-pool-water'],
    ['pool shell', p => p.id === 'long-pool-shell-ns-0'],
    ['pool basin', p => p.id === 'long-pool-basin'],
    ['pergola slat', p => p.id === 'poolside-shade-slat-0'],
    ['pergola header', p => p.id === 'poolside-shade-header-1'],
    ['pergola post', p => p.id === 'poolside-shade-pergola-post-1-1'],
    ['interior partition', p => p.sourceObjectIds?.includes('service-partition') === true],
    ['balcony guard', p => p.id === 'crescent-house-assembly-arc-balcony-guard-outer'],
  ];
  it.each(missing)('rejects loss of %s even when the owning object still emits other geometry', (_name, remove) => {
    expect(model.primitives.some(remove)).toBe(true);
    const damaged = { ...model, primitives: model.primitives.filter(p => !remove(p)) };
    expect(auditArchitecturalConstructionFidelity(scene, damaged).map(f => f.code)).toContain('ARCHITECTURAL_PART_UNBUILT');
  });
  it.each(['shape', 'position', 'finish', 'owner', 'duplicate', 'extra'] as const)('rejects %s substitution', kind => {
    const damaged = structuredClone(model), index = damaged.primitives.findIndex(p => p.id === 'crescent-house-slab-1-outline'), p = damaged.primitives[index];
    if (kind === 'shape') damaged.primitives[index] = { kind: 'box', id: p.id, category: p.category, label: p.label, sourceObjectId: p.sourceObjectId, position: [0, .13, 0], rotation: [0, 0, 0], size: [44, .26, 20], color: p.color };
    if (kind === 'position' && p.kind === 'triMesh') p.vertices = p.vertices.map((v, i) => v + (i % 3 === 0 ? 1 : 0));
    if (kind === 'finish') p.color = '#ff0000';
    if (kind === 'owner') p.sourceObjectId = 'orchard-atelier';
    if (kind === 'duplicate') damaged.primitives.push(structuredClone(p));
    if (kind === 'extra') damaged.primitives.push({ ...structuredClone(p), id: 'unrequested-wing' });
    expect(auditArchitecturalConstructionFidelity(scene, damaged).some(f => f.severity === 'fatal')).toBe(true);
  });
  it('refuses a partial save when full production compilation loses one window', () => {
    const plan = planV3ArchitecturalBlueprint(fullPropertyBlueprint()), compile = compiler.compileV3Scene;
    vi.spyOn(compiler, 'compileV3Scene').mockImplementation(s => { const built = compile(s); return { ...built, primitives: built.primitives.filter(p => p.id !== 'crescent-house:salon-glass:level-0:glass') }; });
    const result = constructV3ArchitecturalBlueprint(plan.approval!);
    expect(result.ok).toBe(false); expect(result.scene).toBeUndefined(); expect(result.model).toBeUndefined();
    expect(result.findings.map(f => f.code)).toContain('ARCHITECTURAL_PART_UNBUILT');
  });
  it('independently detects a builder replacing the curved floor with a box', () => {
    const damaged = structuredClone(model), index = damaged.primitives.findIndex(p => p.id === 'crescent-house-slab-1-outline'), p = damaged.primitives[index];
    const box: HousePrimitive = { kind: 'box', id: p.id, category: p.category, label: p.label, sourceObjectId: p.sourceObjectId, componentRole: p.componentRole, position: [0, .13, 0], rotation: [0, 0, 0], size: [44, .26, 20], color: p.color };
    damaged.primitives[index] = box;
    const build = compiler.v3CompileKit.compileBuildingMass;
    vi.spyOn(compiler.v3CompileKit, 'compileBuildingMass').mockImplementation((...args) => build(...args).map(part => part.id === p.id ? box : part));
    expect(auditArchitecturalConstructionFidelity(scene, damaged).map(f => f.code)).toContain('ARCHITECTURAL_OUTLINE_LOST');
  });
  it('preserves unrelated ordinary editor objects during blueprint replan', () => {
    const bp = fullPropertyBlueprint(), plan = planV3ArchitecturalBlueprint(bp), current = structuredClone(scene);
    current.objects.push({ id: 'local-marker', type: 'slab', geometryKind: 'slab', label: 'Local marker', semanticRole: 'User addition',
      architecture: { x: 52, z: 50, width: 1, depth: 1, height: .1, baseElevation: 0 },
      transform: { position: [52, .05, 50], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [1, .1, 1], material: { id: 'local-stone', color: '#aaaaaa', surface: 'stone' }, collision: 'none' });
    bp.buildings[0].location.x += 1;
    const revised = reviseV3ArchitecturalBlueprint(current, plan.approval!, bp);
    expect(revised.findings.filter(f => f.severity === 'fatal')).toEqual([]);
    expect(revised.scene!.objects.find(o => o.id === 'local-marker')).toEqual(current.objects.at(-1));
  });
});
