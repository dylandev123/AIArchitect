import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { expandPlanAuthoring, v3PlanAuthoringSchema } from '../architecturalPlanAuthoring';
import { preparePlanEvaluation, checkoutPlanEvaluation } from '../architecturalPlanEvaluation';
import { prepareV3ArchitecturalPlan, splitV3ArchitecturalBlueprint, constructV3PlanMassing, sameArchitecturalPlan, elaborateV3ArchitecturalPlan } from '../architecturalPlanFirst';
import { planningStudioBlueprint } from '../parity/planningStudio';
import { distinctArchitecturalBlueprints } from '../parity/architecturalBlueprint';
import { auditV3StairUsability } from '../stairUsability';
import { deriveArchitecturalPlan } from '../architecturalPlanning';
import * as compiler from '../scene';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/plan-authoring-estate.plan.json', import.meta.url), 'utf8'));

describe('compact authoring into existing V3 plan semantics', () => {
  it('draws an articulated line/arc estate with room zones and derives its bookkeeping without construction', () => {
    const raw = fixture(), before = JSON.stringify(raw), compile = vi.spyOn(compiler, 'compileV3Scene');
    try {
      expect(v3PlanAuthoringSchema.safeParse(raw).success).toBe(true);
      const result = preparePlanEvaluation(raw);
      expect(result.ok, JSON.stringify(result.findings)).toBe(true);
      expect(compile).not.toHaveBeenCalled();
      expect(JSON.stringify(raw)).toBe(before);
      expect(result.scene!.objects.some(o => o.type === 'roof-form')).toBe(false);
      expect(result.plan!.program).toHaveLength(2);
      expect(result.plan!.entrances).toHaveLength(3);
      expect(new Set(result.plan!.connections.map(c => c.surfaceId)).size).toBe(5);
      const reloaded = JSON.parse(JSON.stringify(result.scene));
      expect(checkoutPlanEvaluation(reloaded).ok).toBe(true);
      expect(sameArchitecturalPlan(result.scene!, checkoutPlanEvaluation(reloaded).scene!)).toBe(true);
      for (const floor of [null, 0, 1]) {
        const drawing = deriveArchitecturalPlan(result.scene!, null, floor);
        expect(drawing.buildings.length).toBeGreaterThan(0);
        if (floor !== null) expect(drawing.rooms.length).toBeGreaterThan(0);
      }
    } finally { compile.mockRestore(); }
    const stage = preparePlanEvaluation(raw), massing = constructV3PlanMassing(stage)!;
    expect(massing.model.primitives.length).toBeGreaterThan(0);
    expect(sameArchitecturalPlan(stage.scene!, massing.scene)).toBe(true);
  });

  it('accepts a conceptual stair reservation without certifying a buildable flight', () => {
    const raw = fixture();
    raw.verticalCirculation[0].footprint = {x: -14, z: -3, width: 2.5, depth: 3};
    const plan = preparePlanEvaluation(raw);
    expect(plan.ok, JSON.stringify(plan.findings)).toBe(true);
    expect(auditV3StairUsability(plan.scene!).length).toBeGreaterThan(0);
    expect(prepareV3ArchitecturalPlan(plan.plan).ok).toBe(false);
    raw.verticalCirculation[0].footprint.x = 500;
    const outside = preparePlanEvaluation(raw);
    expect(outside.ok).toBe(false);
    expect(outside.findings.some(f => f.code === 'BLUEPRINT_VERTICAL')).toBe(true);
    raw.verticalCirculation = [];
    expect(preparePlanEvaluation(raw).ok).toBe(false);
  });

  it('authors a whole estate without storey/door heights, vertical feature dimensions or repeated roles', () => {
    const raw=fixture();
    for(const b of raw.buildings){for(const s of b.storeys)delete s.height;for(const op of b.accessOpenings)delete op.height;}
    for(const f of raw.features)delete f.height;
    const result=preparePlanEvaluation(raw);
    expect(result.ok,JSON.stringify(result.findings)).toBe(true);
    expect(result.plan!.buildings[0].storeys[0].height).toBe(3.6);
    expect(result.plan!.buildings[0].accessOpenings[0].height).toBe(2.4);
    expect(result.scene!.metadata.planDeferredFeatureHeights).toHaveLength(raw.features.length);
    expect(checkoutPlanEvaluation(result.scene!).plan!.features.every(f=>f.height===undefined)).toBe(true);
  });

  it('allows only deferred flight details within an existing reservation', () => {
    const full=splitV3ArchitecturalBlueprint(planningStudioBlueprint());
    const stage=preparePlanEvaluation(full.plan);
    const wrong=structuredClone(full.exterior);
    wrong.verticalCirculation=[{id:'library-stair',stairType:'straight',direction:'north'}];
    expect(elaborateV3ArchitecturalPlan(stage,wrong).findings.some(f=>f.code==='EXTERIOR_PLAN_OVERRIDE')).toBe(true);
    const unknown=structuredClone(full.exterior);
    unknown.verticalCirculation=[{id:'unknown-stair',stairType:'straight',direction:'south'}];
    expect(elaborateV3ArchitecturalPlan(stage,unknown).findings.some(f=>f.code==='EXTERIOR_HOSTS')).toBe(true);
    const geometry=structuredClone(full.exterior);
    Object.assign(geometry,{verticalCirculation:[{id:'library-stair',stairType:'straight',direction:'south',footprint:{x:0,z:0,width:3,depth:8}}]});
    expect(elaborateV3ArchitecturalPlan(stage,geometry).findings.some(f=>f.code==='EXTERIOR_INPUT')).toBe(true);
  });

  it('retains invalid references, duplicate identities and unsupported/contradictory geometry diagnostics', () => {
    const unresolved = fixture(); unresolved.connections[0].to.objectId = 'missing-court';
    expect(preparePlanEvaluation(unresolved).findings.some(f => f.code === 'PLAN_REFERENCE')).toBe(true);
    const duplicate = fixture(); duplicate.features[0].id = duplicate.buildings[0].id;
    expect(preparePlanEvaluation(duplicate).findings.some(f => f.code === 'ARCHITECTURAL_DUPLICATE_ID')).toBe(true);
    const broken = fixture(); delete broken.buildings[0].plan.segments[0].start;
    expect(preparePlanEvaluation(broken).findings.some(f => f.code === 'PLAN_GEOMETRY')).toBe(true);
    const outside = fixture(); outside.buildings[0].location.x = 500;
    expect(preparePlanEvaluation(outside).ok).toBe(false);
    const unknown = fixture(); unknown.buildings[0].plan = {kind:'spline', points:[]};
    expect(preparePlanEvaluation(unknown).findings.some(f => f.code === 'PLAN_INPUT')).toBe(true);
  });

  it('does not guess an ambiguous opening reference or overwrite an explicit ledger', () => {
    const ambiguous = fixture();
    ambiguous.buildings[1].accessOpenings[0].id = 'house-entry';
    const bad = preparePlanEvaluation(ambiguous);
    // The ambiguous endpoint is never guessed; only its own route is left unresolved.
    expect(bad.ok).toBe(true);
    expect(bad.findings.some(f => f.code === 'PLAN_REFERENCE')).toBe(true);
    expect(bad.unresolved!.every(i => i.kind === 'connection')).toBe(true);
    expect(bad.unresolved!.length).toBeGreaterThan(0);
    const raw = fixture(); raw.program = []; raw.zones = null;
    expect(preparePlanEvaluation(raw).ok).toBe(false);
    delete raw.zones;
    expect(preparePlanEvaluation(raw).findings.some(f => f.code === 'PLAN_PROGRAM')).toBe(true);
  });

  it.each(distinctArchitecturalBlueprints())('preserves every explicit legacy field for $name', ({blueprint}) => {
    const legacy = splitV3ArchitecturalBlueprint(blueprint).plan;
    const expanded = expandPlanAuthoring(legacy);
    expect(expanded.success).toBe(true);
    if (expanded.success) expect(expanded.data).toEqual(legacy);
  });
});
