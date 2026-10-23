import { describe, expect, it } from 'vitest';
import reproduction from './fixtures/concept-estate-reproduction-2026-10-22.json';
import { prepareArchitecturalConcept } from '../architecturalConcept';
import { conceptExample } from './fixtures/conceptExamples';
import { footprintContains, resolveFootprint } from '../footprint';
import { compileV3Scene } from '../scene';

describe('concept footprint investigation (original failed response was not retained)', () => {
  it('replays the single live reproduction unchanged, with exact U-shaped geometry and bounds', () => {
    const before = JSON.stringify(reproduction);
    const result = prepareArchitecturalConcept(reproduction);
    expect(result.ok, JSON.stringify(result.findings)).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(reproduction)).toBe(before);
    const mass = result.scene.objects.find(o => o.id === 'main-residence')!;
    expect(mass.composition!.footprint).toEqual(reproduction.buildings[0].footprint);
    expect(mass.dimensions).toEqual([46, 8.2, 32]);
    expect(mass.transform.position).toEqual([0, .3 + 8.2 / 2, 0]);
    const polygon = resolveFootprint(mass, 0)!.polygon;
    expect(polygon).toHaveLength(8);
    const expected = [[-23,-16],[-15.18,-16],[-15.18,-2],[15.18,-2],[15.18,-16],[23,-16],[23,16],[-23,16]];
    polygon.forEach((p, i) => p.forEach((v, j) => expect(v).toBeCloseTo(expected[i][j])));
    expect(result.footprintTrace![0].floors).toHaveLength(2);
    expect(result.footprintTrace![0].floors.every(f => !f.failure && f.resolved)).toBe(true);
    expect(result.footprintTrace![0].floors[0].bounds).toEqual({ min: [-23, -16], max: [23, 16] });
    expect(footprintContains(mass, [[-2,-10],[2,-10],[2,-6],[-2,-6]])).toBe(false);
    expect(compileV3Scene(result.scene).primitives.some(p => p.sourceObjectId === mass.id && p.category === 'roof' && p.kind === 'triMesh')).toBe(true);
  });

  it.each(['l-shaped', 'courtyard', 'h-shaped'])('keeps %s articulations, voids and polygon roofs intact', name => {
    const input = conceptExample(name === 'h-shaped' ? 'courtyard' : name);
    if (name === 'h-shaped') {
      input.outdoorSpaces = [];
      input.buildings[0].footprint = { kind: 'articulated', operations: [
        { type: 'recess', facade: 'north', start: .3, end: .7, depth: 4 },
        { type: 'recess', facade: 'south', start: .3, end: .7, depth: 4 },
      ] };
    }
    const result = prepareArchitecturalConcept(input);
    expect(result.ok, JSON.stringify(result.findings)).toBe(true);
    if (!result.ok) return;
    const mass = result.scene.objects[0];
    expect(mass.composition!.footprint).toEqual(input.buildings[0].footprint);
    expect(resolveFootprint(mass, 0)!.polygon).toHaveLength(name === 'h-shaped' ? 12 : name === 'l-shaped' ? 6 : 8);
    expect(compileV3Scene(result.scene).primitives.some(p => p.sourceObjectId === mass.id && p.category === 'roof' && p.kind === 'triMesh')).toBe(true);
    if (name === 'h-shaped') for (const z of [-7, 7]) expect(footprintContains(mass, [[-1,z-1],[1,z-1],[1,z+1],[-1,z+1]])).toBe(false);
  });

  it('reports the actual overlapping-operation branch, before rectangular fallback', () => {
    const input = conceptExample(); input.outdoorSpaces = [];
    input.buildings[0].footprint!.operations.push({ type: 'recess', facade: 'south', start: .4, end: .8, depth: 3 });
    const before = JSON.stringify(input), result = prepareArchitecturalConcept(input);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('scene');
    expect(result.findings[0].message).toContain('overlapping operations on south facade');
    expect(result.findings[0].message).not.toContain('fallback used');
    expect(result.footprintTrace![0].authoredGeometry).toEqual(input.buildings[0].footprint);
    expect(result.footprintTrace![0].floors[0].polygon).toBeDefined();
    expect(JSON.stringify(input)).toBe(before);
  });

  it('still rejects a closed, positive-area self-intersecting outline', () => {
    const input = conceptExample(); input.outdoorSpaces = [];
    const points = [[-8,-6],[8,6],[-8,6],[4,-6]] as [number,number][];
    input.buildings[0].footprint = { kind: 'outline', operations: [], segments: points.map((start,i) => ({ id: `edge-${i}`, type: 'line', start, end: points[(i+1)%points.length] })) };
    const result = prepareArchitecturalConcept(input);
    expect(result.ok).toBe(false);
    expect(result.findings[0].message).toContain('self-intersects');
    expect(result).not.toHaveProperty('scene');
  });

  it('distinguishes envelope failures and retains offending bounds without guessing a repair', () => {
    const input = conceptExample(); input.outdoorSpaces = [];
    const points = [[-14,-6],[14,-6],[14,6],[-14,6]] as [number,number][];
    input.buildings[0].footprint = { kind: 'outline', operations: [], segments: points.map((start,i) => ({ id: `edge-${i}`, type: 'line', start, end: points[(i+1)%points.length] })) };
    const result = prepareArchitecturalConcept(input);
    expect(result.ok).toBe(false);
    expect(result.findings[0].message).toContain('exceeds centred 24 x 18m');
    expect(result.footprintTrace![0].floors[0].bounds).toEqual({ min: [-14,-6], max: [14,6] });
  });
});
