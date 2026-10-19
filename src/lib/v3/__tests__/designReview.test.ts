import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewV3ArchitecturalComposition, v3DesignRepairInstructions } from '../designReview';
import { compileV3Scene, type V3Scene } from '../scene';
import { ingestV3GenerationOutput } from '../ingestion';
import { PARITY_FIXTURES } from '../parity/fixtures';
import { regressionLadder } from './regressionLadder';
import { object } from './flatMansionFixture';

const CAPTURED = 'docs/architecture/parity/flat-mansion/scene-f2149916.json';
const captured = (): V3Scene => JSON.parse(readFileSync(CAPTURED, 'utf8')).v3Scene;
const codes = (s: V3Scene, brief?: string) => reviewV3ArchitecturalComposition(s, { brief }).diagnostics.map(d => d.code);
const ingest = (objects: unknown[]) => ingestV3GenerationOutput({ version: 3, site: { width: 120, depth: 120, baseElevation: 0 }, objects, relationships: [] }, 'flat').scene;
const primary = { composition: { massHierarchy: 'primary' } };

describe('V3 architectural composition review: captured flat mansion', () => {
  it('identifies weak hierarchy and limited depth on the unmodified captured scene', () => {
    const file = readFileSync(CAPTURED), hash = createHash('sha256').update(file).digest('hex');
    const scene = captured(), before = JSON.stringify(scene);
    const review = reviewV3ArchitecturalComposition(scene, { brief: scene.metadata.brief });
    const found = review.diagnostics.map(d => d.code);
    expect(found).toEqual(expect.arrayContaining(['WEAK_MASS_HIERARCHY', 'LIMITED_MASSING_DEPTH', 'FLUSH_MASS_COMPOSITION', 'SYMMETRICAL_COMPOSITION', 'BALCONY_ON_SHARED_WALL', 'INCONSISTENT_MATERIAL_ZONING', 'OUTDOOR_PLACEMENT_CONFLICT', 'MISSING_REQUESTED_FEATURE']));
    expect(review.diagnostics.find(d => d.code === 'WEAK_MASS_HIERARCHY')?.targetIds).toEqual(['main-living-pavilion', 'west-bedroom-wing']);
    expect(review.diagnostics.find(d => d.code === 'MISSING_REQUESTED_FEATURE')?.message).toContain('double-height');
    // The audit's three colliding outdoor objects and the pool overrun.
    const placement = review.diagnostics.filter(d => d.code === 'OUTDOOR_PLACEMENT_CONFLICT').map(d => d.targetIds[0]);
    expect(placement).toEqual(expect.arrayContaining(['outdoor-lounge-deck', 'fire-lounge', 'resort-pool']));
    // Site-proven reversed facades are reconciled first, so the corrected entry is not misreported.
    expect(found).not.toContain('ENTRY_ARRIVAL_MISMATCH');
    expect(review.repairRecommended).toBe(true);
    // Diagnostic only: neither the parsed scene nor the captured file changes.
    expect(JSON.stringify(scene)).toBe(before);
    expect(createHash('sha256').update(readFileSync(CAPTURED)).digest('hex')).toBe(hash);
  });

  it('turns findings into bounded, specific repair instructions', () => {
    const scene = captured(), lines = v3DesignRepairInstructions(reviewV3ArchitecturalComposition(scene, { brief: scene.metadata.brief }));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(12);
    expect(lines.join('\n')).toContain('main-living-pavilion');
    expect(lines.every(l => l.includes('Fix:'))).toBe(true);
    expect(lines.some(l => l.startsWith('SYMMETRICAL_COMPOSITION'))).toBe(false); // advisory only
  });

  it('leaves compilation of the captured scene and existing fixtures byte-identical', () => {
    const scenes = [captured(), ...Object.values(PARITY_FIXTURES).map(f => f())];
    for (const s of scenes) {
      const a = JSON.stringify(compileV3Scene(s));
      reviewV3ArchitecturalComposition(s, { brief: 'pool courtyard double-height balcony wings' });
      expect(JSON.stringify(compileV3Scene(s))).toBe(a);
    }
  });
});

describe('V3 architectural composition review: existing fixtures and invariants', () => {
  it('does not request repair for the matched cottage, villa and large-house fixtures', () => {
    for (const [name, f] of Object.entries(PARITY_FIXTURES)) {
      const review = reviewV3ArchitecturalComposition(f());
      expect(review.repairRecommended, name).toBe(false);
      expect(review.significant, name).toBe(0);
    }
  });

  it('keeps the regression ladder repair-free while still diagnosing the equal-mass villa', () => {
    for (const { name, raw } of regressionLadder) expect(reviewV3ArchitecturalComposition(ingestV3GenerationOutput(raw).scene).repairRecommended, name).toBe(false);
    expect(codes(ingestV3GenerationOutput(regressionLadder[2].raw).scene)).toContain('WEAK_MASS_HIERARCHY');
  });

  it('accepts a flush, equal-height block and passes an articulated composition', () => {
    const weak = ingest([
      object('main', 'building-mass', 0, 0, 0, 12, 10, 7, { levels: 2, ...primary }),
      object('west', 'building-mass', -10, 0, 0, 8, 10, 7, { levels: 2 }),
      object('east', 'building-mass', 10, 0, 0, 8, 10, 7, { levels: 2 }),
    ]);
    expect(codes(weak)).toEqual(expect.arrayContaining(['WEAK_MASS_HIERARCHY', 'FLUSH_MASS_COMPOSITION', 'LIMITED_MASSING_DEPTH']));
    expect(reviewV3ArchitecturalComposition(weak).repairRecommended).toBe(false);
    const articulated = ingest([
      object('main', 'building-mass', 0, 0, 0, 16, 12, 8, { levels: 1, composition: { massHierarchy: 'primary', spaceHeight: 'double-height' } }),
      object('link', 'building-mass', -9.5, -2, 0, 3, 4, 3.2, { levels: 1, composition: { massHierarchy: 'connector' } }),
      object('bedrooms', 'building-mass', -16, -4, 0, 10, 14, 6.4, { levels: 2 }),
      object('terrace', 'terrace', 0, 10, 0, 18, 8, .2),
      object('pool', 'pool', 0, 11, -1.4, 10, 4, 1.4, { hostId: 'terrace' }),
    ]);
    expect(reviewV3ArchitecturalComposition(articulated, { brief: 'double-height living, pool' }).significant).toBe(0);
  });

  it('reports entry facing away from arrival geometry', () => {
    const scene = ingest([
      object('main', 'building-mass', 0, 0, 0, 14, 10, 7, { levels: 2, composition: { massHierarchy: 'primary', openings: [{ id: 'door', type: 'door', facade: 'south', floors: 'ground', start: .45, end: .55 }], mainEntry: { openingId: 'door', canopyDepth: 2 } } }),
      object('drive', 'driveway', 0, -20, 0, 6, 20, .1),
    ]);
    const d = reviewV3ArchitecturalComposition(scene).diagnostics.find(d => d.code === 'ENTRY_ARRIVAL_MISMATCH');
    expect(d?.severity).toBe('significant');
    expect(reviewV3ArchitecturalComposition(scene).repairRecommended).toBe(true);
  });

  it('reads requested features from the brief, respects negation and requires explicit intent', () => {
    const scene = ingest([object('main', 'building-mass', 0, 0, 0, 14, 10, 7, { levels: 2, label: 'Double-height great room', ...primary })]);
    expect(codes(scene, 'a house with a pool')).toContain('MISSING_REQUESTED_FEATURE');
    expect(codes(scene, 'a house without a pool')).not.toContain('MISSING_REQUESTED_FEATURE');
    // A descriptive label is not double-height intent.
    expect(codes(scene, 'double-height entrance')).toContain('MISSING_REQUESTED_FEATURE');
  });

  it('never treats symmetry alone as repair-worthy', () => {
    const scene = ingest([
      object('main', 'building-mass', 0, 0, 0, 14, 12, 9, { levels: 1, ...primary }),
      object('west', 'building-mass', -15, 4, 0, 8, 12, 4, { levels: 1 }),
      object('east', 'building-mass', 15, 4, 0, 8, 12, 4, { levels: 1 }),
    ]);
    const review = reviewV3ArchitecturalComposition(scene);
    expect(review.diagnostics.map(d => d.code)).toEqual(['SYMMETRICAL_COMPOSITION']);
    expect(review.repairRecommended).toBe(false);
  });
});

describe('V3 architectural composition review: non-rectangular building intent', () => {
  const intents = (s: V3Scene) => reviewV3ArchitecturalComposition(s).diagnostics.filter(d => d.code === 'UNSUPPORTED_ARCHITECTURAL_INTENT');
  it('reports a cylinder hint or named curved form on a building mass as advisory, without revising it', () => {
    const scene = ingest([
      object('drum', 'building-mass', 0, 0, 0, 14, 14, 9, { geometryKind: 'cylinder', levels: 2 }),
      object('rotunda-gallery', 'building-mass', 24, 0, 0, 10, 10, 6, { semanticRole: 'circular rotunda gallery' }),
      object('east-wing', 'building-mass', -24, 0, 0, 12, 8, 6, { semanticRole: 'year-round guest wing' }),
    ]), before = JSON.stringify(scene), found = intents(scene);
    expect(found.map(d => d.targetIds[0]).sort()).toEqual(['drum', 'rotunda-gallery']);
    expect(found.every(d => d.severity === 'advisory')).toBe(true);
    expect(reviewV3ArchitecturalComposition(scene).repairRecommended).toBe(false);
    expect(JSON.stringify(scene)).toBe(before);
  });
  it('leaves ordinary rectangular masses and the captured mansion without form findings', () => {
    expect(intents(captured()).filter(d => /non-rectangular/.test(d.message))).toEqual([]);
    expect(intents(ingest([object('house', 'building-mass', 0, 0, 0, 16, 12, 6)]))).toEqual([]);
  });
});
