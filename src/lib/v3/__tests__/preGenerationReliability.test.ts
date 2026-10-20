import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import canopy0 from './fixtures/canopy-meridian-attempt-0.json';
import canopy1 from './fixtures/canopy-meridian-attempt-1.json';
import cloister0 from './fixtures/blueprint-cloister-attempt-0.json';
import cloister1 from './fixtures/blueprint-cloister-attempt-1.json';
import { preGenerationFixtures } from './preGenerationFixtures';
import { ingestV3GenerationOutput } from '../ingestion';
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from '../generation';
import { auditV3DesignConsistency, v3ConsistencyRepairInstructions } from '../designConsistency';
import { auditV3Completeness } from '../completeness';
import { validateV3Scene } from '../validation';
import { compileV3Scene, validateV3CompiledGeometry } from '../scene';
import { assessV3ObjectiveRevision } from '../safeRevision';
import { estateEndpoint, estateRouteVertices } from '../routeGeometry';
import { v3SceneArchitectPrompt, v3SceneOutputSchema, V3_SCENE_SCHEMA_BYTES } from '../schema';
import { resolveV3Circulation } from '../circulation';
import { reviewV3Architecture } from '../designReview';

const options = { requireBlueprint: true, requireDesignConsistency: true };
const fixtures = preGenerationFixtures();
const ingest = (raw: unknown) => ingestV3GenerationOutput(raw, 'flat', options);

describe('pre-generation reliability audit (offline, no providers)', () => {
  it.each(fixtures)('$name', fixture => {
    expect(v3SceneOutputSchema.safeParse(fixture.output).success).toBe(true);
    const before = JSON.stringify(fixture.output), result = ingest(fixture.output);
    expect(JSON.stringify(fixture.output)).toBe(before);
    expect(result.ok, JSON.stringify(result.validation.errors)).toBe(!fixture.expectedCodes.length);
    expect(result.scene.objects.map(o => o.id)).toEqual(fixture.output.objects.map(o => o.id));
    expect(result.notes.filter(n => n.code.endsWith('_OMITTED'))).toEqual([]);
    for (const code of fixture.expectedCodes) expect(result.validation.issues.some(i => i.code === code), code).toBe(true);
    if (!fixture.expectedCodes.length) {
      expect(result.blueprintApproval).toBeDefined();
      expect(result.geometryAudit?.errors).toEqual([]);
      expect(compileV3Scene(result.scene)).toEqual(compileV3Scene(result.scene));
    } else {
      expect(result.blueprintApproval).toBeUndefined();
      expect(result.geometryAudit).toBeUndefined();
    }
  });

  it('delivers allocation, roof and exterior assembly failures together to the single repair', () => {
    const fixture = fixtures.find(f => f.name.startsWith('allocation rejection'))!;
    const result = ingest(fixture.output);
    const instructions = v3ConsistencyRepairInstructions(result.consistency!).join('\n');
    for (const code of fixture.expectedCodes) expect(instructions).toContain(code);
    expect(instructions).toContain('sunshade/canopy');
    const keys = result.validation.issues.map(i => `${i.code}:${i.targetId}:${i.message}`);
    expect(new Set(keys).size).toBe(keys.length);
    const justRoof = structuredClone(fixture.output);
    justRoof.objects.find(o => o.type === 'building-mass')!.roofForm = 'flat';
    expect(ingest(justRoof).validation.issues.some(i => i.code === 'FOOTPRINT_ASSEMBLY_UNRESOLVED')).toBe(true);
  });

  it('never repairs references or grants approval while gathering failed-plan diagnostics', () => {
    const raw = structuredClone(fixtures[4].output);
    raw.relationships.push({ from: raw.objects[0].id, to: 'missing-counterpart', kind: 'connects' });
    const result = ingest(raw);
    expect(result.scene.relationships).toContainEqual(raw.relationships.at(-1));
    expect(result.blueprintApproval).toBeUndefined();
    expect(result.ok).toBe(false);
  });

  it('stops diagnostic construction at malformed or duplicate prerequisites', () => {
    const bad = JSON.parse(JSON.stringify(fixtures[0].output));
    bad.estatePlan.blueprint.buildings = 'invalid';
    const malformed = ingest(bad);
    expect(malformed.validation.issues.some(i => i.code === 'BLUEPRINT_INVALID_INPUT')).toBe(true);
    expect(malformed.consistency).toBeUndefined();
    const duplicate = structuredClone(fixtures[0].output);
    duplicate.objects.push(structuredClone(duplicate.objects[0]));
    const ambiguous = ingest(duplicate);
    expect(ambiguous.validation.issues.some(i => i.code === 'BLUEPRINT_DUPLICATE_ID')).toBe(true);
    expect(ambiguous.consistency).toBeUndefined();
  });

  it('uses named-door coordinates and canonical ribbons even with contradictory owner geometry', () => {
    const named = ingest(fixtures[1].output), boxes = ingest(fixtures[2].output);
    for (const route of named.scene.estatePlan!.circulation) {
      for (const side of ['from', 'to'] as const) if (route.spatial![side].openingId) expect(estateEndpoint(named.scene, route, side)).toBeDefined();
      const counterpart = boxes.scene.estatePlan!.circulation.find(r => r.id === route.id)!;
      const a = estateRouteVertices(named.scene, route), b = estateRouteVertices(boxes.scene, counterpart);
      expect(a.length).toBe(b.length);
      a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 8));
    }
  });

  it('cannot hide a blueprint/host contradiction by deleting its declarations during repair', () => {
    const bad = ingest(fixtures[7].output), candidate = structuredClone(bad.scene);
    candidate.estatePlan!.relationships = [];
    delete candidate.estatePlan!.blueprint;
    expect(ingest(candidate).ok).toBe(false);
    expect(assessV3ObjectiveRevision(bad.scene, candidate, bad.validation.issues).accepted).toBe(false);
  });

  it('audits constructed canonical ribbons without false owner-box warnings or silent mesh loss', () => {
    const scene = ingest(fixtures[1].output).scene, model = compileV3Scene(scene);
    expect(validateV3CompiledGeometry(scene, model, { lenient: true }).warnings.filter(w => w.includes('path ribbon'))).toEqual([]);
    const id = `v3-connection-estate:${scene.estatePlan!.circulation[0].id}`;
    const missing = { ...model, primitives: model.primitives.filter(p => p.id !== id) };
    expect(validateV3CompiledGeometry(scene, missing, { lenient: true }).errors.some(e => e.includes('canonical estate route'))).toBe(true);
    const changed = structuredClone(model), ribbon = changed.primitives.find(p => p.id === id)!;
    if (ribbon.kind === 'triMesh') ribbon.vertices[0] += 1;
    expect(validateV3CompiledGeometry(scene, changed, { lenient: true }).ok).toBe(false);
  });

  it('rejects a fitting stair reservation that cannot construct usable access', () => {
    const raw = structuredClone(fixtures[0].output);
    raw.circulation![0].width = .4; raw.circulation![0].depth = .5;
    const result = ingest(raw);
    expect(result.ok).toBe(false);
    expect(result.blueprintApproval).toBeUndefined();
    expect(result.validation.issues.some(i=>i.code==='CIRCULATION_NOT_USABLE')).toBe(true);
    expect(resolveV3Circulation(result.scene).every(c => !c.usable)).toBe(true);
    expect(result.consistency!.findings.some(f => f.code === 'CIRCULATION_INTENT_INCOMPLETE')).toBe(true);
    expect(reviewV3Architecture(result.scene).diagnostics.some(d => d.code === 'UNREACHABLE_STOREY')).toBe(true);
  });

  it('replays all four untouched responses and exports every diagnostic, separating investigation from acceptance', () => {
    const recovered = [
      { name: 'canopy-initial', raw: canopy0 }, { name: 'canopy-repair', raw: canopy1 },
      { name: 'cloister-initial', raw: cloister0 }, { name: 'cloister-repair', raw: cloister1 },
    ].map(({ name, raw }) => {
      const snapshot = JSON.stringify(raw);
      // Canopy predates the blueprint contract. Do not manufacture an index or
      // charge it with a missing requirement which was never active historically.
      const result = ingestV3GenerationOutput(raw, 'flat', { requireBlueprint: name.startsWith('cloister'), requireDesignConsistency: true });
      const normalized = normalizeV3GenerationOutput(raw, 'flat');
      const detailed = repairV3GeneratedScene(normalized.scene, normalized.notes);
      const validation = validateV3Scene(detailed.scene, { lenient: true, requireObjects: true });
      const consistency = auditV3DesignConsistency(detailed.scene, validation.issues);
      const model = compileV3Scene(detailed.scene);
      expect(JSON.stringify(raw)).toBe(snapshot);
      expect(result.ok).toBe(false);
      expect(result.scene.objects).toHaveLength(raw.objects.length);
      expect(result.notes.filter(n => n.code.endsWith('_OMITTED'))).toEqual([]);
      return {
        name, compactCharacters: snapshot.length, compactSha256: createHash('sha256').update(snapshot).digest('hex'),
        providerSchemaMatches: v3SceneOutputSchema.safeParse(raw).success,
        production: { accepted: result.ok, objects: result.scene.objects.map(o => o.id), issues: result.validation.issues,
          consistency: result.consistency, repairInstructions: result.consistency ? v3ConsistencyRepairInstructions(result.consistency) : [], notes: result.notes },
        investigationOnly: { validation, consistency, completeness: auditV3Completeness(detailed.scene).findings,
          designReview: reviewV3Architecture(detailed.scene),
          geometry: validateV3CompiledGeometry(detailed.scene, model, { lenient: true }), primitiveCount: model.primitives.length },
      };
    });
    const adversarial = fixtures.map(f => {
      const r = ingest(f.output);
      return { name: f.name, accepted: r.ok, expectedCodes: f.expectedCodes, issues: r.validation.issues,
        consistency: r.consistency, omitted: r.notes.filter(n => n.code.endsWith('_OMITTED')) };
    });
    const tinyStair = structuredClone(fixtures[0].output);
    tinyStair.circulation![0].width = .4; tinyStair.circulation![0].depth = .5;
    const stair = ingest(tinyStair);
    const prompt = v3SceneArchitectPrompt('flat', { blueprintFirst: true });
    if (process.env.PRE_GENERATION_AUDIT_OUTPUT) writeFileSync(process.env.PRE_GENERATION_AUDIT_OUTPUT, JSON.stringify({
      recovered, adversarial, knownAcceptanceGap: { accepted: stair.ok, circulation: resolveV3Circulation(stair.scene).map(c => ({ id: c.entry.id, usable: c.usable, issues: c.issues })), consistency: stair.consistency, designReview: reviewV3Architecture(stair.scene) },
      contract: { promptCharacters: prompt.length, estimatedPromptTokensCharsOver4: Math.ceil(prompt.length / 4),
        localSchemaCharacters: V3_SCENE_SCHEMA_BYTES, transmittedSchemaCharacters: 0, maxOutputTokens: 10000,
        tokenUsageAndCostMeasured: false },
    }, null, 2) + '\n');
  }, 20000);
});
