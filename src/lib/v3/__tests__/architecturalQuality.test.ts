import { describe, expect, it } from 'vitest';
import type { HousePrimitive } from '@/lib/house/types';
import { compileV3Scene, type V3Scene } from '../scene';
import { PARITY_FIXTURES } from '../parity/fixtures';
import { cottageObject } from '../parity/cottage';
import { ENTRY_DOOR_FINISH } from '../compositionPolicies';

const scene = (...objects: V3Scene['objects']): V3Scene => ({ version: 3, site: { width: 60, depth: 60 }, relationships: [], metadata: {}, objects });
const of = (primitives: HousePrimitive[], id: string, role?: string) => primitives.filter(p => p.sourceObjectId === id && (!role || p.componentRole === role));
const centre = (p: HousePrimitive) => p.kind === 'box' ? p.position : [0, 0, 0];

describe('V3 architectural composition quality rules', () => {
  it.each([
    ['south', 0, 6.3, 16, 3.6, 'z', 1],
    ['north', 0, -6.3, 16, 3.6, 'z', -1],
    ['east', 9.8, 0, 3.6, 9, 'x', 1],
    ['west', -9.8, 0, 3.6, 9, 'x', -1],
  ] as const)('puts the %s veranda colonnade on its open edge, away from the host wall', (_, x, z, w, d, axis, sign) => {
    const host = cottageObject('house', 'building-mass', 0, 0, 16, 9, 3.8, .3, { levels: 1 });
    const primitives = compileV3Scene(scene(host, cottageObject('veranda', 'veranda', x, z, w, d, 3.4, .3))).primitives;
    const posts = of(primitives, 'veranda', 'colonnade post'), i = axis === 'x' ? 0 : 2, mid = axis === 'x' ? x : z;
    expect(posts.length).toBeGreaterThanOrEqual(4);
    for (const post of posts) expect(sign * (centre(post)[i] - mid)).toBeGreaterThan((axis === 'x' ? w : d) / 2 - .3);
    // Post spacing follows the bounded structural grid along the open edge.
    const along = posts.map(p => centre(p)[2 - i]).sort((a, b) => a - b);
    for (let k = 1; k < along.length; k++) expect(along[k] - along[k - 1]).toBeLessThanOrEqual(3.01);
  });

  it('expresses every intermediate floor of a multi-storey mass as a slab-edge band on all four sides', () => {
    const primitives = compileV3Scene(scene(cottageObject('tower', 'building-mass', 0, 0, 10, 8, 9.9, 0, { levels: 3 }), cottageObject('pavilion', 'building-mass', 20, 0, 10, 8, 3.6, 0, { levels: 1 }))).primitives;
    const bands = of(primitives, 'tower', 'floor slab edge');
    expect(bands).toHaveLength(8);
    expect(new Set(bands.map(b => centre(b)[1].toFixed(2)))).toEqual(new Set(['3.30', '6.60']));
    expect(of(primitives, 'pavilion', 'floor slab edge')).toHaveLength(0);
  });

  it('builds flat roofs as a thin plate with a darker drip edge, and floats a floating-flat roof over discrete recessed bearings', () => {
    const primitives = compileV3Scene(scene(cottageObject('mass', 'building-mass', 0, 0, 12, 8, 3.5, 0, { roofForm: 'floating-flat', overhang: 1.2 }))).primitives;
    const plate = of(primitives, 'mass', 'floating roof plate')[0];
    expect(plate?.kind === 'box' && plate.size[1]).toBeLessThanOrEqual(.3);
    expect(plate?.kind === 'box' && plate.size[0]).toBeCloseTo(14.4);
    const fascia = of(primitives, 'mass', 'roof fascia');
    expect(fascia).toHaveLength(4);
    expect(fascia.every(f => f.color !== plate.color)).toBe(true);
    expect(of(primitives, 'mass', 'shadow reveal')).toHaveLength(0);
    const reveal = of(primitives, 'mass', 'floating roof bearing')[0];
    expect(reveal?.kind === 'box' && reveal.position[1] + reveal.size[1] / 2).toBeLessThanOrEqual(plate.kind === 'box' ? plate.position[1] - plate.size[1] / 2 + 1e-6 : 0);
  });

  it.each(Object.keys(PARITY_FIXTURES) as (keyof typeof PARITY_FIXTURES)[])('%s: pitched metal roofs are finished as one standing-seam system with flashing', name => {
    const fixture = PARITY_FIXTURES[name](), primitives = compileV3Scene(fixture).primitives;
    const pitched = fixture.objects.filter(o => ['gable', 'hip', 'mono-pitch'].includes(o.roofForm ?? '') && (o.type === 'roof-form' || !fixture.objects.some(r => r.type === 'roof-form' && r.hostId === o.id)));
    expect(pitched.length).toBeGreaterThan(0);
    for (const roof of pitched) {
      const parts = of(primitives, roof.id).filter(p => p.category === 'roof');
      expect(parts.some(p => p.componentRole === 'roof seams'), roof.id).toBe(true);
      expect(parts.some(p => p.componentRole === 'roof flashing'), roof.id).toBe(true);
      expect(parts.filter(p => p.componentRole === 'roof plane').every(p => p.surface === 'standing-seam-metal'), roof.id).toBe(true);
    }
  });

  it('gives the entry door the warm accent finish while window frames stay dark', () => {
    const primitives = compileV3Scene(PARITY_FIXTURES.large()).primitives, main = of(primitives, 'main-living');
    const door = main.filter(p => p.label === 'Door Frame');
    expect(door).toHaveLength(1);
    expect(door[0]).toMatchObject({ color: ENTRY_DOOR_FINISH.color, surface: 'wood' });
    expect(main.filter(p => p.componentRole === 'glazing frame' && p.label !== 'Door Frame').every(p => p.color !== ENTRY_DOOR_FINISH.color)).toBe(true);
  });

  it.each(Object.keys(PARITY_FIXTURES) as (keyof typeof PARITY_FIXTURES)[])('%s compiles every authored object without fallback or proxy geometry', name => {
    const fixture = PARITY_FIXTURES[name](), primitives = compileV3Scene(fixture).primitives;
    for (const object of fixture.objects) expect(primitives.some(p => p.sourceObjectId === object.id), object.id).toBe(true);
    // Authored plain geometry (e.g. a box accent wall) is legitimate; a render proxy never is.
    expect(primitives.filter(p => p.componentRole === 'render proxy')).toHaveLength(0);
  });
});
