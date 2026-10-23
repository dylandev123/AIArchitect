import { describe, expect, it } from 'vitest';
import { preparePlanEvaluation, checkoutPlanEvaluation } from '../architecturalPlanEvaluation';
import { reviewArchitecturalPlan } from '../architecturalPlanReview';
import { compactGardenHome } from '../parity/architecturalIntelligence';
import { articulatedWingsResidence } from '../parity/expressiveEstate';
import { v3SharedBoundaryId } from '../interior';

const compactScene = () => preparePlanEvaluation(compactGardenHome()).scene!;

describe('conceptual planning observations separate from architectural judgment', () => {
  it('keeps a connected simple home valid without calling its rectangular composition excellent', () => {
    const scene = compactScene(), before = JSON.stringify(scene), review = reviewArchitecturalPlan(scene);
    expect(review.findings).toEqual([]);
    expect(review.objective.potentialAccessRoomIds).toHaveLength(5);
    expect(review.architecturalJudgment.status).toBe('requires-design-review');
    expect(review).not.toHaveProperty('score');
    expect(JSON.stringify(scene)).toBe(before);
  });

  it('identifies an isolated room, retains the drawing and recomputes after a saved local correction', () => {
    const plan = compactGardenHome();
    const bed = plan.buildings[0].storeys[0].spaces.find(r => r.id === 'compact-bedroom')!;
    bed.footprint = {x: -3.5, z: 2.25, width: 3, depth: 3.5};
    const stage = preparePlanEvaluation(plan);
    expect(stage.ok).toBe(true);
    expect(stage.findings.some(f => f.code === 'PLAN_ROOM_ACCESS_UNVERIFIED' && f.targetIds.includes(bed.id))).toBe(true);
    expect(stage.plan!.buildings[0].storeys[0].spaces.find(r => r.id === bed.id)!.footprint).toEqual(bed.footprint);
    const saved = JSON.parse(JSON.stringify(stage.scene));
    saved.interior.rooms.find((r: {id: string}) => r.id === bed.id).footprint = {x: -3, z: 2, width: 4, depth: 4};
    saved.metadata.planQualityReview = {fake: 'old review must not govern'};
    const checked = checkoutPlanEvaluation(saved);
    expect(checked.ok).toBe(true);
    expect(checked.findings.filter(f => f.code === 'PLAN_ROOM_ACCESS_UNVERIFIED')).toEqual([]);
    expect(checked.scene!.metadata.planQualityReview).toHaveProperty('objective');
  });

  it('does not mistake a short declared adjacency for usable conceptual access', () => {
    const scene = compactScene(), bed = scene.interior!.rooms.find(r => r.id === 'compact-bedroom')!;
    bed.footprint = {x: -3, z: .2, width: 4, depth: .4};
    const review = reviewArchitecturalPlan(scene);
    expect(review.findings.some(f => f.code === 'PLAN_ADJACENCY_PASSAGE' && f.targetIds.includes(bed.id))).toBe(true);
    expect(review.objective.potentialAccessRoomIds).not.toContain(bed.id);
    bed.footprint = {x: -3.015, z: 2.015, width: 3.97, depth: 3.97};
    expect(reviewArchitecturalPlan(scene).objective.potentialAccessRoomIds).not.toContain(bed.id);
  });

  it('checks actual entrance contact rather than trusting a serves label, including rotated hosts', () => {
    const raw = compactGardenHome(); raw.connections = []; raw.buildings[0].location.rotationY = .47;
    const stage = preparePlanEvaluation(raw);
    expect(stage.ok).toBe(true);
    expect(stage.findings.filter(f => f.code === 'PLAN_ENTRY_ROOM_GAP')).toEqual([]);
    const scene = stage.scene!;
    const opening = scene.objects.find(o => o.type === 'building-mass')!.composition!.openings!.find(o => o.id === 'compact-entry')!;
    Object.assign(opening, {serves: 'compact-bedroom'});
    expect(reviewArchitecturalPlan(scene).findings.some(f => f.code === 'PLAN_ENTRY_ROOM_MISMATCH')).toBe(true);
    Object.assign(opening, {serves: 'compact-terrace'});
    expect(reviewArchitecturalPlan(scene).findings.filter(f => f.code === 'PLAN_ENTRY_ROOM_MISMATCH')).toEqual([]);
    scene.interior!.rooms.find(r => r.id === 'compact-hall')!.footprint.depth = 3;
    expect(reviewArchitecturalPlan(scene).findings.some(f => f.code === 'PLAN_ENTRY_ROOM_GAP')).toBe(true);
  });

  it('does not bridge missing landing zones between floors or treat a lift as a planning certificate', () => {
    const stage = preparePlanEvaluation(articulatedWingsResidence()), scene = stage.scene!;
    scene.interior!.rooms = scene.interior!.rooms.filter(r => r.id !== 'upper-stair-hall');
    const review = reviewArchitecturalPlan(scene);
    expect(review.findings.filter(f => f.code === 'PLAN_STAIR_LANDING_ZONE')).toHaveLength(2);
    expect(review.findings.some(f => f.code === 'PLAN_ROOM_ACCESS_UNVERIFIED' && f.targetIds.includes('wings-upper'))).toBe(true);
    expect(review.objective.potentialAccessRoomIds.some(id => id.startsWith('upper'))).toBe(false);
  });

  it('accounts for authored blocking partitions and fitting doors when deriving potential access', () => {
    const scene = compactScene(), bed = 'compact-bedroom';
    scene.relationships.push({kind: 'adjacent', from: 'compact-living', to: bed});
    scene.interior!.partitions = ['compact-hall', 'compact-living'].map((from, i) => ({id: `bed-wall-${i}`, storeyId: 'compact-floor', roomAId: from, roomBId: bed,
      boundaryId: v3SharedBoundaryId(from, bed), partitionType: 'wall', semanticRole: 'Bedroom privacy'}));
    expect(reviewArchitecturalPlan(scene).objective.potentialAccessRoomIds).not.toContain(bed);
    scene.interior!.doors = [{id: 'bed-door', partitionId: 'bed-wall-0', offset: 2, width: .9, program: 'door', semanticRole: 'Bedroom access'}];
    expect(reviewArchitecturalPlan(scene).objective.potentialAccessRoomIds).toContain(bed);
    scene.interior!.doors[0].offset = 8;
    expect(reviewArchitecturalPlan(scene).objective.potentialAccessRoomIds).not.toContain(bed);
  });

  it('reports narrow circulation without changing the acceptance policy', () => {
    const raw = compactGardenHome();
    raw.buildings[0].storeys[0].spaces.find(r => r.id === 'compact-hall')!.footprint.width = .7;
    const result = preparePlanEvaluation(raw);
    expect(result.ok).toBe(true);
    expect(result.findings.some(f => f.code === 'PLAN_NARROW_CIRCULATION' && f.severity === 'advisory')).toBe(true);
  });
});
