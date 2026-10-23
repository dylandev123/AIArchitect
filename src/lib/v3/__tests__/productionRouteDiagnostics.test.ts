import { describe, expect, it } from 'vitest';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { crescentEstateBlueprint } from '../parity/architecturalBlueprint';
import { compileV3Scene } from '../scene';
import { validateV3Scene } from '../validation';
import { auditArchitecturalConstructionFidelity } from '../architecturalConstructionFidelity';

describe('production estate route rendering diagnostics', () => {
  it('recognizes actual estate ribbons while preserving malformed-route and unknown-object diagnostics', () => {
    const bp = crescentEstateBlueprint();
    const built = constructV3ArchitecturalBlueprint(planV3ArchitecturalBlueprint(bp, { buildFirst: true }).approval!);
    expect(built.ok).toBe(true);
    const scene = built.scene!, owner = bp.connections[0].surfaceId;
    expect(validateV3Scene(scene, { lenient: true }).issues.some(i => i.code === 'FALLBACK_RENDER_USED' && i.targetId === owner)).toBe(false);
    expect(compileV3Scene(scene).primitives.some(p => p.kind === 'triMesh' && p.sourceObjectId === owner)).toBe(true);
    expect(auditArchitecturalConstructionFidelity(scene, compileV3Scene(scene))).toEqual([]);

    const malformed = structuredClone(scene);
    malformed.estatePlan!.circulation[0].spatial!.width = 0;
    const invalid = validateV3Scene(malformed, { lenient: true });
    expect(invalid.ok).toBe(false);
    expect(invalid.issues.some(i => i.code === 'INVALID_ESTATE_PLAN')).toBe(true);
    expect(invalid.issues.some(i => i.code === 'FALLBACK_RENDER_USED' && i.targetId === owner)).toBe(true);

    const unknown = structuredClone(scene);
    unknown.objects.push({ ...structuredClone(scene.objects.find(o => o.id === owner)!), id: 'unrelated-future-feature', type: 'future-feature' });
    expect(validateV3Scene(unknown, { lenient: true }).issues.some(i => i.code === 'FALLBACK_RENDER_USED' && i.targetId === 'unrelated-future-feature')).toBe(true);
  });
});
