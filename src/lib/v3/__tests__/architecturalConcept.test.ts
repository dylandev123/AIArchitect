import { describe, expect, it, vi, afterEach } from 'vitest';
import { architecturalConceptPrompt, conceptEnvelopeSignature, conceptEvaluationEnabled, prepareArchitecturalConcept } from '../architecturalConcept';
import { compileV3Scene } from '../scene';
import { v3MassStoreys } from '../stacking';
import { conceptExample } from './fixtures/conceptExamples';

afterEach(() => vi.unstubAllEnvs());
describe('isolated architecture-first concepts', () => {
  it.each(['courtyard', 'l-shaped', 'pavilions', 'connected-wings', 'modest'])('builds actual V3 geometry and roofs for %s with zero rooms', name => {
    const input = conceptExample(name), before = JSON.stringify(input);
    const result = prepareArchitecturalConcept(input);
    expect(result.ok, JSON.stringify(result.findings)).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    if (!result.ok) return;
    expect(result.findings).toEqual([]);
    expect(result.scene.interior!.rooms).toEqual([]);
    const sceneBefore = JSON.stringify(result.scene);
    const { primitives } = compileV3Scene(result.scene);
    expect(primitives.some(p => p.category === 'window' || p.category === 'door')).toBe(false);
    expect(primitives.some(p => /proxy|unresolved/i.test(p.componentRole ?? ''))).toBe(false);
    for (const b of result.scene.objects.filter(o => o.type === 'building-mass')) {
      expect(primitives.some(p => p.sourceObjectId === b.id && p.category === 'wall')).toBe(true);
      expect(primitives.some(p => p.sourceObjectId === b.id && p.category === 'roof')).toBe(true);
      expect(v3MassStoreys(b, result.scene).map(s => s.height)).toEqual(input.buildings.find(x => x.id === b.id)!.storeyHeights);
    }
    expect(JSON.stringify(result.scene)).toBe(sceneBefore);
  });
  it('preserves envelopes, roof intent, compiled roofs and unequal storeys through JSON and future room additions', () => {
    const result = prepareArchitecturalConcept(conceptExample());
    expect(result.ok).toBe(true); if (!result.ok) return;
    const scene = result.scene, next = JSON.parse(JSON.stringify(scene));
    const signature = conceptEnvelopeSignature(scene);
    next.interior.rooms.push({ id: 'future-room', hostMassId: 'home', storeyId: 'home-storey-0', program: 'living', label: 'Living', semanticRole: 'living', footprint: { x: 0, z: -5, width: 6, depth: 4 } });
    expect(conceptEnvelopeSignature(next)).toBe(signature);
    expect(compileV3Scene(next).primitives.filter(p => p.category === 'roof')).toEqual(compileV3Scene(scene).primitives.filter(p => p.category === 'roof'));
    next.objects[0].overhang += .1;
    expect(conceptEnvelopeSignature(next)).not.toBe(signature);
    next.objects[0].overhang -= .1; next.objects[0].roofForm = 'flat';
    expect(conceptEnvelopeSignature(next)).not.toBe(signature);
  });
  it.each(['bad-footprint', 'bad-roof', 'skew', 'detached-connection', 'storey-height', 'outside', 'unknown-field', 'duplicate', 'outdoor-overlap', 'eaves-outside'])('rejects %s without returning a fallback scene', name => {
    const c = conceptExample('modest');
    if (name === 'bad-footprint') c.buildings[0].footprint = { kind: 'articulated', operations: [{ type: 'notch', corner: 'se', width: 100, depth: 100 }] };
    if (name === 'bad-roof') { c.buildings[0].footprint = { kind: 'articulated', operations: [{ type: 'notch', corner: 'se', width: 3, depth: 3 }] }; c.buildings[0].roof.form = 'hip'; }
    if (name === 'skew' || name === 'detached-connection') {
      c.buildings.push({ ...c.buildings[0], id: 'other', x: name === 'skew' ? 3 : 10, rotationDegrees: 25 }); c.connections = [{ from: 'home', to: 'other' }];
    }
    if (name === 'storey-height') c.buildings[0].storeyHeights = [1.9];
    if (name === 'outside') c.buildings[0].x = 20;
    if (name === 'unknown-field') Object.assign(c.buildings[0], { dome: true });
    if (name === 'duplicate') c.buildings.push({ ...c.buildings[0] });
    if (name === 'outdoor-overlap') c.outdoorSpaces = [{ id: 'court', label: 'Court', purpose: 'Garden', kind: 'courtyard', x: 0, z: 0, width: 3, depth: 3 }];
    if (name === 'eaves-outside') c.buildings[0].x = 8;
    const result = prepareArchitecturalConcept(c);
    expect(result.ok, name).toBe(false); expect(result).not.toHaveProperty('scene'); expect(result.findings.length).toBeGreaterThan(0);
  });
  it('rejects unsupported curved intersections and three mutually meeting roofs', () => {
    const c = conceptExample('pavilions'); c.buildings[1].x = -12;
    expect(prepareArchitecturalConcept(c).findings.some(f => /UNSUPPORTED/.test(f.code))).toBe(true);
    const t = conceptExample('modest');
    t.buildings.push({ ...t.buildings[0], id: 'b', x: 2 }, { ...t.buildings[0], id: 'c', x: -2 });
    expect(prepareArchitecturalConcept(t).findings.some(f => f.code === 'JUNCTION_MULTI_ROOF_UNSUPPORTED')).toBe(true);
  });
  it('accepts a separate pavilion inside a courtyard void without a false bounding-box junction', () => {
    const c = conceptExample('courtyard'); c.outdoorSpaces = [];
    c.buildings.push({ id: 'pavilion', label: 'Court pavilion', role: 'studio', x: 0, z: 4, width: 3, depth: 3, storeyHeights: [3], roof: { form: 'flat', overhang: .1 } });
    const result = prepareArchitecturalConcept(c);
    expect(result.ok, JSON.stringify(result.findings)).toBe(true);
  });
  it('gates on development AND explicit opt-in', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AI_V3_CONCEPT_EVALUATION', '0'); expect(conceptEvaluationEnabled()).toBe(false);
    vi.stubEnv('AI_V3_CONCEPT_EVALUATION', '1'); expect(conceptEvaluationEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production'); expect(conceptEvaluationEnabled()).toBe(false);
  });
  it('keeps the advertised contract concept-only', () => {
    const prompt = architecturalConceptPrompt();
    const schema = JSON.parse(prompt.slice(prompt.indexOf('{"$schema"')));
    expect(schema.properties.buildings.items.properties).not.toHaveProperty('rooms');
    expect(schema.properties.buildings.items.required).toContain('roof');
    expect(schema.additionalProperties).toBe(false);
  });
  it('reports explicit unsupported requirements without accepting a substitute', () => {
    expect(prepareArchitecturalConcept({ unsupportedFeatures: ['A domed roof is not supported by V3.'] })).toEqual({ ok: false, findings: [{ code: 'CONCEPT_UNSUPPORTED_INTENT', targetId: 'brief', message: 'A domed roof is not supported by V3.' }] });
  });
});
