import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import initial from './fixtures/blueprint-cloister-attempt-0.json';
import repair from './fixtures/blueprint-cloister-attempt-1.json';
import earlierInitial from './fixtures/canopy-meridian-attempt-0.json';
import earlierRepair from './fixtures/canopy-meridian-attempt-1.json';
import { ingestV3GenerationOutput } from '../ingestion';
import { normalizeV3GenerationOutput, repairV3GeneratedScene } from '../generation';
import { compileV3Scene, validateV3CompiledGeometry } from '../scene';
import { validateV3Scene } from '../validation';
import { auditV3DesignConsistency } from '../designConsistency';
import { reviewV3Architecture } from '../designReview';
import { recoverV3FailedPreview } from '../failedPreview';
import { assessV3ObjectiveRevision } from '../safeRevision';
import { resolveV3Circulation } from '../circulation';
import { estateRoutePoints, estateRouteSupported } from '../estateSpatial';
import { auditV3Completeness } from '../completeness';

function replay(raw: unknown, requireBlueprint: boolean) {
  const result = ingestV3GenerationOutput(raw, 'flat', { requireBlueprint, requireDesignConsistency: true });
  // Investigative only: production stops at a failed planning gate. Inspect the
  // downstream stages independently without claiming this scene was accepted.
  const normalized = normalizeV3GenerationOutput(raw, 'flat');
  const detailed = repairV3GeneratedScene(normalized.scene, normalized.notes);
  const validation = validateV3Scene(detailed.scene, { lenient: true, requireObjects: true });
  const compiled = compileV3Scene(detailed.scene);
  const preview = recoverV3FailedPreview(raw, result.validation.errors, 'flat');
  return {
    result, detailedNotes: detailed.notes, detailedValidation: validation,
    consistency: auditV3DesignConsistency(detailed.scene, validation.issues),
    geometry: validateV3CompiledGeometry(detailed.scene, compiled, { lenient: true }),
    review: reviewV3Architecture(detailed.scene), completeness: auditV3Completeness(detailed.scene), circulation: resolveV3Circulation(detailed.scene),
    routes: detailed.scene.estatePlan?.circulation.map(route => ({ id: route.id, supported: estateRouteSupported(detailed.scene, route), points: estateRoutePoints(route) })),
    preview: preview && { ids: preview.scene.objects.map(o => o.id), diagnostics: preview.diagnostics, geometry: validateV3CompiledGeometry(preview.scene, compileV3Scene(preview.scene), { lenient: true }) },
    inventory: detailed.scene.objects.map(o => ({ id: o.id, type: o.type, architecture: o.architecture,
      primitives: compiled.primitives.filter(p => p.sourceObjectId === o.id).map(p => ({ id: p.id, label: p.label })) })),
    primitiveCount: compiled.primitives.length,
  };
}

describe('recovered blueprint-first cloister mansion (offline)', () => {
  it('replays both latest and earlier responses through production ingestion without changing authored inputs', () => {
    const raws = [initial, repair, earlierInitial, earlierRepair], snapshots = raws.map(r => JSON.stringify(r));
    const attempts = raws.map((r, i) => replay(r, i < 2));
    const assessment = assessV3ObjectiveRevision(attempts[0].result.scene, attempts[1].result.scene, attempts[0].result.validation.issues);
    if (process.env.BLUEPRINT_LIVE_AUDIT_OUTPUT) writeFileSync(process.env.BLUEPRINT_LIVE_AUDIT_OUTPUT, JSON.stringify({ attempts, assessment }, null, 2) + '\n');
    expect(raws.map(r => JSON.stringify(r))).toEqual(snapshots);
    expect(attempts.slice(0, 2).map(a => a.result.scene.objects.length)).toEqual([23, 23]);
    expect(attempts.slice(2).map(a => a.result.scene.objects.length)).toEqual([19, 19]);
    expect(attempts.every(a => !a.result.ok)).toBe(true);
    expect(attempts.slice(0, 2).every(a => !a.result.blueprintApproval && !a.result.geometryAudit)).toBe(true);
  });
  it.each([initial, repair])('recovers every stable identity and exposes real route blockers without accepting the scene', raw => {
    const a = replay(raw, true);
    expect(a.result.scene.estatePlan).toEqual(raw.estatePlan);
    expect(a.result.notes.filter(n => n.code.endsWith('_OMITTED'))).toEqual([]);
    for (const o of raw.objects.filter(o => o.type === 'building-mass')) {
      expect(a.result.scene.objects.find(candidate => candidate.id === o.id)?.composition?.openings).toEqual(o.composition?.openings);
    }
    expect(a.preview?.ids).toEqual(raw.objects.map(o => o.id));
    expect(a.preview?.diagnostics.skippedObjectIds).toEqual([]);
    expect(a.preview?.geometry.errors).toEqual([]);
    expect(a.routes?.every(r => r.supported)).toBe(true);
    for (const id of ['driveway', 'entryWalk', 'poolWalk', 'guestPath', 'wellnessPath']) {
      expect(a.inventory.find(o => o.id === id)?.primitives.some(p => p.id.startsWith('v3-connection-estate:'))).toBe(true);
    }
    expect(a.result.ok).toBe(false);
    const issues = a.result.validation.issues;
    expect(issues.filter(i => i.code === 'ESTATE_ACCESS_MISSING').flatMap(i => i.targetIds)).toEqual([]);
    expect(issues.some(i => i.code === 'ESTATE_ROUTE_UNSUPPORTED')).toBe(false);
    expect(issues.find(i => i.code === 'ESTATE_ACCESS_POINT_MISSING')?.targetIds).toEqual(['siteNorth', 'driveway']);
    expect(issues.filter(i => i.code === 'ESTATE_ROUTE_BLOCKED').map(i => i.targetIds)).toEqual([['guestPath', 'guestPavilion'], ['wellnessPath', 'wellnessPavilion']]);
    expect(a.geometry.errors).toEqual([]);
    expect(a.circulation.map(c => [c.entry.id, c.usable])).toEqual([['mainStair', true], ['eastWingStair', true], ['westWingStair', true]]);
    expect(a.completeness.edges.filter(e => e.kind === 'junction' && (e.from.endsWith('#0') && e.to.endsWith('#0')))).toHaveLength(2);
  });
});
