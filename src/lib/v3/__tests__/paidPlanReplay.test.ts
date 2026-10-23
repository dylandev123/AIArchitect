import { describe, expect, it } from 'vitest';
import plan from './fixtures/paid-plan-548137db.json';
import { preparePlanEvaluation, checkoutPlanEvaluation, unresolvedPlanItems } from '../architecturalPlanEvaluation';
import { compileV3Scene } from '../scene';
import { deriveArchitecturalPlan } from '../architecturalPlanning';

// Byte-identical to the retained original provider response (SHA-256 9591e120…); replayed with no retargeting.
describe('paid plan 548137db replay', () => {
  const result = preparePlanEvaluation(structuredClone(plan));
  const scene = result.scene!;

  it('is no longer discarded by the >600-character concept or by any single route', () => {
    expect(plan.concept.length).toBeGreaterThan(600);
    expect(result.findings.filter(f => f.code === 'PLAN_INPUT')).toEqual([]);
    expect(result.ok, JSON.stringify(result.findings.filter(f => f.severity === 'fatal'))).toBe(true);
  });

  it('keeps every authored building, room and feature and withholds only the three routes it cannot resolve', () => {
    expect(scene.objects.filter(o => o.type === 'building-mass').map(o => o.id).sort()).toEqual(['guest-pavilion', 'main-house']);
    expect(scene.interior!.rooms).toHaveLength(plan.buildings.flatMap(b => b.storeys.flatMap(s => s.spaces)).length);
    for (const f of plan.features) expect(scene.objects.some(o => o.id === f.id), f.id).toBe(true);
    expect(result.unresolved!.map(i => [i.kind, i.id]).sort()).toEqual([['connection', 'arrival-route'], ['connection', 'guest-walk'], ['connection', 'pool-walk']]);
    // pool-walk ends in water and is NOT retargeted; the authored endpoint is retained verbatim.
    const pool = result.unresolved!.find(i => i.id === 'pool-walk')!;
    expect(pool.findings[0].code).toBe('PLAN_REFERENCE');
    expect((pool.raw as {to: unknown}).to).toEqual(plan.connections.find(c => c.id === 'pool-walk')!.to);
    // The other two depend on an entrance whose wall address straddles a recess; it is left as authored.
    for (const id of ['arrival-route', 'guest-walk']) expect(result.unresolved!.find(i => i.id === id)!.findings.some(f => f.code === 'PLAN_ENTRANCE_UNRESOLVED')).toBe(true);
    expect(scene.estatePlan!.circulation).toEqual([]);
    expect(scene.estatePlan!.blueprint!.entrances.map(e => e.openingId)).toContain('main-entry');
  });

  it('displays the estate and both conceptual floor plans, then reopens identically for correction', () => {
    const model = compileV3Scene(scene);
    expect(deriveArchitecturalPlan(scene, model, null).buildings).toHaveLength(2);
    expect(deriveArchitecturalPlan(scene, model, 0).rooms.length).toBe(13);
    expect(deriveArchitecturalPlan(scene, model, 1).rooms.length).toBe(6);
    const reopened = checkoutPlanEvaluation(JSON.parse(JSON.stringify(scene)));
    expect(reopened.ok).toBe(true);
    expect(reopened.unresolved!.map(i => i.id).sort()).toEqual(unresolvedPlanItems(scene).map(i => i.id).sort());
  });

  it('resolves a route once the author corrects it, without touching anything else', () => {
    const edited = checkoutPlanEvaluation(JSON.parse(JSON.stringify(scene)));
    const fixed = structuredClone(edited.plan!) as typeof edited.plan & {connections: {id: string; to: unknown}[]};
    fixed.connections.find(c => c.id === 'pool-walk')!.to = {kind: 'surface', objectId: 'sea-terrace', local: [0, 3.5]};
    const next = preparePlanEvaluation(fixed);
    expect(next.ok).toBe(true);
    expect(next.unresolved!.map(i => i.id).sort()).toEqual(['arrival-route', 'guest-walk']);
    expect(next.scene!.estatePlan!.circulation.map(r => r.id)).toEqual(['pool-walk']);
  });
});
