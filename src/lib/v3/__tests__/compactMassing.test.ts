import { afterEach, describe, expect, it, vi } from 'vitest';
import { compactMassingEnabled, compactMassingPrompt, expandCompactMassing, prepareCompactMassing, type CompactMassing } from '../compactMassing';
import { compactMassingExample, compactMassingExampleNames } from '../evaluation/compactMassingExamples';
import { conceptEnvelopeSignature, prepareArchitecturalConcept } from '../architecturalConcept';
import { compileV3Scene, type V3Scene } from '../scene';
import { authoredPlan } from '../authoredPlan';
import { pointInPolygon } from '@/lib/architecture/geometry/footprint';
import { primitivesBounds } from '../presentation';
import { v3MassStoreys } from '../stacking';
import { deriveV3MassJunctions } from '../junctions';

function accepted(input: unknown): V3Scene {
  const r = prepareCompactMassing(input);
  expect(r.ok, JSON.stringify(r.findings)).toBe(true);
  if (!r.ok) throw new Error(JSON.stringify(r.findings));
  return r.scene;
}
const area = (p: readonly (readonly [number, number])[]) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
afterEach(() => vi.unstubAllEnvs());
describe('compact architectural massing: deterministic fixtures, no Terra calls', () => {
  it.each(compactMassingExampleNames)('matches independently authored existing concept geometry: %s', name => {
    const { compact, legacy } = compactMassingExample(name), before = JSON.stringify(compact);
    const scene = accepted(compact), baseline = prepareArchitecturalConcept(legacy);
    expect(baseline.ok, JSON.stringify(baseline.findings)).toBe(true);
    if (!baseline.ok) return;
    expect(conceptEnvelopeSignature(scene)).toBe(conceptEnvelopeSignature(baseline.scene));
    const model = compileV3Scene(scene);
    expect(model.primitives).toEqual(compileV3Scene(baseline.scene).primitives);
    expect(scene.interior?.rooms).toEqual([]);
    expect(model.primitives.some(p => /proxy|unresolved/i.test(p.componentRole ?? ''))).toBe(false);
    expect(model.primitives.some(p => p.category === 'door' || p.category === 'window')).toBe(false);
    for (const mass of scene.objects) {
      expect(model.primitives.some(p => p.sourceObjectId === mass.id && p.category === 'wall')).toBe(true);
      expect(model.primitives.some(p => p.sourceObjectId === mass.id && p.category === 'roof')).toBe(true);
    }
    expect(prepareCompactMassing(compact)).toEqual(prepareCompactMassing(compact));
    expect(compileV3Scene(JSON.parse(JSON.stringify(scene)))).toEqual(model);
    expect(JSON.stringify(compact)).toBe(before);
  });
  it('retains asymmetric face contact and unequal wing/storey/roof datums', () => {
    const scene = accepted(compactMassingExample('asymmetric-wings').compact), [home, wing] = scene.objects;
    expect(wing.architecture).toMatchObject({ x: 12, z: 2, width: 8, depth: 6, height: 3.4 });
    expect(v3MassStoreys(home, scene)).toEqual([{ elevation: 0, height: 3.8 }, { elevation: 3.8, height: 3.1 }]);
    const junctions = deriveV3MassJunctions(scene);
    expect(junctions.diagnostics).toEqual([]);
    expect(junctions.junctions[0]).toMatchObject({ supported: true, relationship: 'touching', roof: { relationship: 'stepped' } });
  });
  it('preserves exact L/U solid and void regions, including compiled top roof voids', () => {
    for (const name of ['l-residence', 'u-courtyard'] as const) {
      const scene = accepted(compactMassingExample(name).compact), mass = scene.objects[0];
      const p = authoredPlan(mass, 0);
      expect(area(p)).toBe(name === 'l-residence' ? 342 : 312);
      const voidPoint: [number, number] = name === 'l-residence' ? [7, 5] : [0, 5];
      expect(pointInPolygon(voidPoint, p)).toBe(false);
      expect(pointInPolygon([-10, 0], p)).toBe(true);
      const roofs = compileV3Scene(scene).primitives.filter(p => p.sourceObjectId === mass.id && p.category === 'roof');
      // Verify actual roof triangles/boxes do not cap the central void.
      for (const roof of roofs) {
        if (roof.kind === 'triMesh') for (let i = 0; i < roof.vertices.length; i += 9) {
          const tri = [0, 3, 6].map(j => [roof.vertices[i + j], roof.vertices[i + j + 2]] as [number, number]);
          expect(pointInPolygon(voidPoint, tri), roof.id).toBe(false);
        }
        if (roof.kind === 'box') {
          const bounds = primitivesBounds([roof])!;
          expect(voidPoint[0] > bounds.min[0] && voidPoint[0] < bounds.max[0] && voidPoint[1] > bounds.min[2] && voidPoint[1] < bounds.max[2], roof.id).toBe(false);
        }
      }
    }
  });
  it('keeps full ground floor, reduced upper floor and top roof at the intended height', () => {
    const scene = accepted(compactMassingExample('upper-setback').compact), mass = scene.objects[0];
    expect(area(authoredPlan(mass, 0))).toBe(432);
    expect(area(authoredPlan(mass, 1))).toBe(342);
    expect(pointInPolygon([7, 5], authoredPlan(mass, 0))).toBe(true);
    expect(pointInPolygon([7, 5], authoredPlan(mass, 1))).toBe(false);
    const bounds = primitivesBounds(compileV3Scene(scene).primitives.filter(p => p.category === 'roof'))!;
    expect(bounds.min[1]).toBeCloseTo(6.9, 1);
  });
  it('constructs an entrance indentation with the authored width, depth and offset', () => {
    const scene = accepted(compactMassingExample('recessed-entrance').compact), p = authoredPlan(scene.objects[0], 0);
    expect(area(p)).toBe(420);
    expect(pointInPolygon([-3, -8], p)).toBe(false);
    expect(pointInPolygon([-3, -6], p)).toBe(true);
    expect(pointInPolygon([3, -8], p)).toBe(true);
  });
  it('combines a court, entrance recess and upper setbacks across every upper storey', () => {
    const c = compactMassingExample('u-courtyard').compact, v = c.volumes[0];
    v.heights = [3.8, 3.1, 3]; v.roof.form = 'floating-flat';
    v.recesses = [{ side: 'north', width: 4, depth: 2 }];
    v.upperSetbacks = [{ corner: 'nw', width: 3, depth: 3 }];
    const scene = accepted(c), mass = scene.objects[0];
    expect([0, 1, 2].map(f => area(authoredPlan(mass, f)))).toEqual([304, 295, 295]);
    expect(v3MassStoreys(mass, scene).map(s => s.height)).toEqual([3.8, 3.1, 3]);
  });
  it('derives exact arc extrema and ids without recentering or rescaling', () => {
    const c = compactMassingExample('exact-outline').compact;
    c.volumes[0].plan = { kind: 'outline', segments: [{ type: 'arc', center: [2, 1], radius: 5, startAngle: 17, sweep: 360 }] };
    const scene = accepted(c), mass = scene.objects[0];
    expect(mass.architecture).toMatchObject({ x: 0, z: 0, width: 14, depth: 12 });
    expect(mass.composition?.footprint?.segments?.[0]).toMatchObject({ id: 'edge-1', center: [2, 1], radius: 5 });
  });
  it('derives rotated attachments and forward references without changing identity on reorder', () => {
    const c = compactMassingExample('asymmetric-wings').compact;
    c.volumes[0].rotation = 90;
    const first = accepted(c);
    expect(first.objects[1].architecture?.x).toBeCloseTo(2);
    expect(first.objects[1].architecture?.z).toBeCloseTo(-12);
    c.volumes.reverse(); const reordered = accepted(c);
    expect(reordered.objects.find(o => o.id === 'mass-wing')).toEqual(first.objects[1]);
  });
  it.each(['flat', 'floating-flat', 'mono-pitch', 'terrace'] as const)('keeps a compatible %s roof on the U boundary', form => {
    const c = compactMassingExample('u-courtyard').compact; c.volumes[0].roof.form = form; accepted(c);
  });
  it.each(['hip', 'gable', 'butterfly'] as const)('keeps rectangular %s roof choice', form => {
    const c = compactMassingExample('exact-outline').compact; c.volumes[0].plan = { kind: 'rectangle', width: 12, depth: 10 }; c.volumes[0].roof.form = form; accepted(c);
  });
  const invalid: [string, (c: CompactMassing) => void, string][] = [
    ['missing placement', c => { delete c.volumes[0].at; }, 'MASSING_AMBIGUOUS_PLACEMENT'],
    ['two placements', c => { c.volumes[1].at = [12,2]; }, 'MASSING_AMBIGUOUS_PLACEMENT'],
    ['attachment rotation', c => { c.volumes[1].rotation = 25; }, 'MASSING_AMBIGUOUS_PLACEMENT'],
    ['unknown host', c => { c.volumes[1].attach!.to = 'missing'; }, 'MASSING_UNKNOWN_REFERENCE'],
    ['cycle', c => { delete c.volumes[0].at; c.volumes[0].attach = { to: 'wing', side: 'west' }; }, 'MASSING_REFERENCE_CYCLE'],
    ['duplicate name', c => { c.volumes[1].name = 'home'; }, 'MASSING_DUPLICATE_NAME'],
    ['no shared face', c => { c.volumes[1].attach!.offset = 8; }, 'MASSING_ATTACHMENT_NO_FACE'],
    ['nonrectangular attachment', c => { c.volumes[0].plan = { kind: 'l', width: 16, depth: 10, cut: { corner: 'nw', width: 3, depth: 3 } }; }, 'MASSING_ATTACHMENT_UNSUPPORTED'],
    ['upper without storey', c => { c.volumes[1].upperSetbacks = [{ corner: 'se', width: 2, depth: 2 }]; }, 'MASSING_SETBACK_WITHOUT_UPPER'],
    ['oversized corner', c => { c.volumes[1].upperSetbacks = [{ corner: 'se', width: 8, depth: 2 }]; }, 'MASSING_NOTCH_RANGE'],
    ['clipped recess', c => { c.volumes = [c.volumes[0]]; c.volumes[0].upperSetbacks = [{ corner: 'se', width: 5, depth: 3 }]; c.volumes[0].recesses = [{ side: 'south', width: 8, depth: 2 }]; }, 'MASSING_CLIPPED_RECESS'],
    ['oversized recess', c => { c.volumes[0].recesses = [{ side: 'south', width: 16, depth: 2 }]; }, 'MASSING_RECESS_RANGE'],
    ['near roof datum', c => { c.volumes[1].heights = [6.5]; }, 'JUNCTION_AMBIGUOUS_DATUM'],
    ['unsupported roof meeting', c => { c.volumes[1].roof.form = 'terrace'; }, 'JUNCTION_ROOF_UNSUPPORTED'],
    ['unknown executable field', c => { Object.assign(c.volumes[0], { dome: true }); }, 'MASSING_INPUT'],
    ['outside site', c => { c.volumes[0].at = [100, 0]; }, 'CONCEPT_OUTSIDE_SITE'],
  ];
  it.each(invalid)('rejects %s precisely without a scene or input mutation', (_name, change, code) => {
    const c = compactMassingExample('asymmetric-wings').compact; change(c); const before = JSON.stringify(c);
    const r = prepareCompactMassing(c);
    expect(r.ok, JSON.stringify(r.findings)).toBe(false); expect(r).not.toHaveProperty('scene');
    expect(r.findings.map(f => f.code)).toContain(code); expect(JSON.stringify(c)).toBe(before);
  });
  it('rejects malformed exact outlines, conflicting segment ids and unsupported upper outline edits', () => {
    for (const mode of ['open', 'duplicate', 'upper']) {
      const c = compactMassingExample('exact-outline').compact, p = c.volumes[0].plan;
      if (p.kind !== 'outline') throw new Error('fixture');
      if (mode === 'open') p.segments.pop();
      if (mode === 'duplicate') p.segments.forEach(s => { s.id = 'same'; });
      if (mode === 'upper') c.volumes[0].upperSetbacks = [{ corner: 'se', width: 2, depth: 2 }];
      const r = prepareCompactMassing(c); expect(r.ok).toBe(false); expect(r).not.toHaveProperty('scene');
    }
  });
  it('rejects nonrectangular pitched roofs without substitution', () => {
    const c = compactMassingExample('u-courtyard').compact; c.volumes[0].roof.form = 'hip';
    const r = prepareCompactMassing(c); expect(r.findings.map(f => f.code)).toContain('ROOF_FOOTPRINT_UNSUPPORTED'); expect(r).not.toHaveProperty('scene');
  });
  it('gates development, concept and compact flags independently', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AI_V3_CONCEPT_EVALUATION', '1'); vi.stubEnv('AI_V3_COMPACT_MASSING_EVALUATION', '1'); expect(compactMassingEnabled()).toBe(true);
    for (const key of ['AI_V3_CONCEPT_EVALUATION', 'AI_V3_COMPACT_MASSING_EVALUATION']) { vi.stubEnv(key, '0'); expect(compactMassingEnabled()).toBe(false); vi.stubEnv(key, '1'); }
    vi.stubEnv('NODE_ENV', 'production'); expect(compactMassingEnabled()).toBe(false);
  });
  it('advertises compact architectural decisions and exact controls, not runtime geometry', () => {
    const prompt = compactMassingPrompt(), schema = JSON.parse(prompt.slice(prompt.indexOf('{"$schema"')));
    expect(schema.properties.volumes.items.properties).not.toHaveProperty('transform');
    expect(schema.properties.volumes.items.properties).not.toHaveProperty('id');
    expect(expandCompactMassing({ format: 'unknown' }).ok).toBe(false);
    expect(prepareCompactMassing({ unsupportedFeatures: ['A closed courtyard hole is unsupported.'] })).toMatchObject({ ok: false, findings: [{ code: 'MASSING_UNSUPPORTED_INTENT' }] });
  });
});
