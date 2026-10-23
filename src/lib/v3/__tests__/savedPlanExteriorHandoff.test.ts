import { describe, expect, it } from 'vitest';
import { planningStudioBlueprint } from '../parity/planningStudio';
import { checkoutPlanEvaluation, preparePlanEvaluation } from '../architecturalPlanEvaluation';
import { elaborateV3ArchitecturalPlan, planConstructionBlockers, sameArchitecturalPlan, splitV3ArchitecturalBlueprint } from '../architecturalPlanFirst';
import { constructV3ArchitecturalBlueprint, lowerV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '../architecturalBlueprint';
import paidPlan from './fixtures/paid-plan-548137db.json';

const deferredDesign = () => {
  const blueprint = planningStudioBlueprint();
  const design = splitV3ArchitecturalBlueprint(blueprint);
  for (const feature of design.plan.features) delete feature.height;
  design.exterior.features.forEach(f => { f.height = blueprint.features.find(p => p.id === f.id)!.height; });
  return design;
};

describe('saved 2D blueprint to exterior without user construction specifications', () => {
  it('lets Terra supply all missing heights and V3 construct them while retaining the entire plan', () => {
    const design = deferredDesign(), stage = preparePlanEvaluation(design.plan);
    const saved = JSON.stringify(stage.scene), original = JSON.stringify(stage.plan);
    expect(planConstructionBlockers(stage)).toEqual([]);
    const reopened = checkoutPlanEvaluation(JSON.parse(saved));
    expect(reopened.plan!.features.every(f => f.height === undefined)).toBe(true);
    const exterior = elaborateV3ArchitecturalPlan(reopened, design.exterior);
    expect(exterior.blueprint, JSON.stringify(exterior.findings)).toBeDefined();
    const approved = planV3ArchitecturalBlueprint(exterior.blueprint, { buildFirst: true });
    const built = approved.approval && constructV3ArchitecturalBlueprint(approved.approval);
    expect(built && built.ok, JSON.stringify(approved.findings)).toBe(true);
    expect(sameArchitecturalPlan(stage.scene!, built!.scene!)).toBe(true);
    expect(JSON.stringify(stage.scene)).toBe(saved);
    expect(JSON.stringify(stage.plan)).toBe(original);
    for (const f of design.exterior.features) expect(built!.scene!.objects.find(o => o.id === f.id)!.architecture!.height).toBe(f.height);
  });

  it('requires a real Terra height instead of constructing the runtime drawing proxy', () => {
    const design = deferredDesign(), stage = preparePlanEvaluation(design.plan);
    delete design.exterior.features[0].height;
    const result = elaborateV3ArchitecturalPlan(stage, design.exterior);
    expect(result.blueprint).toBeUndefined();
    expect(result.findings).toContainEqual(expect.objectContaining({ code: 'EXTERIOR_HEIGHT_REQUIRED', targetIds: [design.plan.features[0].id] }));
  });

  it('rejects replacing an explicitly saved height and rejects extra feature coordinates', () => {
    const design = splitV3ArchitecturalBlueprint(planningStudioBlueprint()), stage = preparePlanEvaluation(design.plan);
    design.exterior.features[0].height = design.plan.features[0].height! + .2;
    expect(elaborateV3ArchitecturalPlan(stage, design.exterior).findings[0].code).toBe('EXTERIOR_PLAN_OVERRIDE');
    delete design.exterior.features[0].height;
    Object.assign(design.exterior.features[0], { location: { x: 100, z: 0 } });
    expect(elaborateV3ArchitecturalPlan(stage, design.exterior).findings[0].code).toBe('EXTERIOR_INPUT');
  });

  it.each(['x', 'z', 'width', 'depth', 'baseElevation', 'rotationY'] as const)('keeps feature %s fixed even when height is delegated', key => {
    const design = deferredDesign(), stage = preparePlanEvaluation(design.plan);
    const exterior = elaborateV3ArchitecturalPlan(stage, design.exterior);
    const scene = lowerV3ArchitecturalBlueprint(exterior.blueprint!);
    expect(sameArchitecturalPlan(stage.scene!, scene)).toBe(true);
    const architecture = scene.objects.find(o => o.id === design.plan.features[0].id)!.architecture!;
    architecture[key] = (architecture[key] ?? 0) + .25;
    expect(sameArchitecturalPlan(stage.scene!, scene)).toBe(false);
  });

  it('cannot use candidate metadata to delegate an already authored height', () => {
    const design = splitV3ArchitecturalBlueprint(planningStudioBlueprint()), stage = preparePlanEvaluation(design.plan);
    const candidate = structuredClone(stage.scene!);
    candidate.metadata.planDeferredFeatureHeights = [design.plan.features[0].id];
    candidate.objects.find(o => o.id === design.plan.features[0].id)!.architecture!.height += .25;
    expect(sameArchitecturalPlan(stage.scene!, candidate)).toBe(false);
  });

  it('identifies fixed-plan blockers in the exact paid working plan without requiring exterior choices', () => {
    const plan = structuredClone(paidPlan);
    plan.connections.find(c => c.id === 'pool-walk')!.to = { kind: 'surface', objectId: 'sea-terrace', local: [0, 0] };
    const entry = plan.buildings[0].accessOpenings.find(o => o.id === 'main-entry')!;
    entry.start = .432; entry.end = .568;
    const stage = preparePlanEvaluation(plan);
    expect(stage.ok).toBe(true);
    expect(stage.unresolved).toEqual([]);
    expect(stage.scene!.interior!.rooms).toHaveLength(19);
    expect(stage.plan!.buildings.find(b => b.id === 'guest-pavilion')!.plan).toEqual(plan.buildings.find(b => b.id === 'guest-pavilion')!.plan);
    expect(stage.plan!.features.every(f => f.height === undefined)).toBe(true);
    expect(planConstructionBlockers(stage).map(f => [f.code, f.targetIds])).toEqual([
      ['BLUEPRINT_SITE_BOUNDS', ['pool-garden']],
      ['BLUEPRINT_ENTRANCE_WALL', ['main-house', 'primary-loggia-door']],
    ]);
  });
});
