import { describe, expect, it } from 'vitest';
import { formalArrivalEstate, articulatedWingsResidence, referenceExterior } from '../parity/expressiveEstate';
import { checkoutPlanEvaluation, preparePlanEvaluation, planEvaluationPrompt } from '../architecturalPlanEvaluation';
import { elaborateV3ArchitecturalPlan, planConstructionBlockers, sameArchitecturalPlan } from '../architecturalPlanFirst';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { auditArchitecturalConstructionFidelity } from '../architecturalConstructionFidelity';
import { deriveArchitecturalPlan, primitiveTriangles } from '../architecturalPlanning';
import { authoredPlan, planArea } from '../authoredPlan';
import { estateRoutePoints, estateRouteVertices } from '../routeGeometry';
import { auditV3Interior, sharedBoundaryLength } from '../interior';
import { sampleRoutePath } from '../curvedFootprint';
import { pointInPolygon } from '@/lib/architecture/geometry/footprint';
import { v3PlanAuthoringSchema } from '../architecturalPlanAuthoring';
import { v3VegetationPlacements } from '../vegetation';
import { footprintContains } from '../footprint';

const buildReference=(make:typeof formalArrivalEstate)=>{
 const raw=make(),untouched=JSON.stringify(raw),stage=preparePlanEvaluation(raw);
 expect(stage.ok,JSON.stringify(stage.findings)).toBe(true);
 expect(stage.unresolved).toEqual([]);
 expect(planConstructionBlockers(stage)).toEqual([]);
 expect(stage.findings.filter(f=>['BLUEPRINT_SPACE_OUTSIDE_HOST','BLUEPRINT_SPACE_OVERLAP','ROOM_ADJACENCY_NO_SHARED_BOUNDARY'].includes(f.code))).toEqual([]);
 const developed=elaborateV3ArchitecturalPlan(stage,referenceExterior(raw));
 expect(developed.blueprint,JSON.stringify(developed.findings)).toBeDefined();
 const approved=planV3ArchitecturalBlueprint(developed.blueprint,{buildFirst:true});
 expect(approved.ok,JSON.stringify(approved.findings)).toBe(true);
 const built=constructV3ArchitecturalBlueprint(approved.approval!);
 expect(built.ok,JSON.stringify(built.findings)).toBe(true);
 expect(built.outcome).toBe('complete');
 expect(sameArchitecturalPlan(stage.scene!,built.scene!)).toBe(true);
 expect(JSON.stringify(raw)).toBe(untouched);
 expect(auditArchitecturalConstructionFidelity(built.scene!,built.model!)).toEqual([]);
 return {raw,stage,built};
};

describe('independent ambitious estate references through production handoff',()=>{
 it.each([{name:'formal arrival estate',make:formalArrivalEstate},{name:'articulated wings residence',make:articulatedWingsResidence}])('constructs $name without replacing the approved 2D geometry',({make})=>{
  const {raw,stage,built}=buildReference(make);
  const saved=JSON.parse(JSON.stringify(stage.scene)),reopened=checkoutPlanEvaluation(saved);
  expect(reopened.ok).toBe(true);expect(reopened.plan).toEqual(stage.plan);
  expect(sameArchitecturalPlan(saved,reopened.scene!)).toBe(true);
  for(const floor of [0,1]){
   const drawing=deriveArchitecturalPlan(stage.scene!,null,floor);
   expect(drawing.rooms.length).toBe(raw.buildings.flatMap(b=>b.storeys[floor]?.spaces??[]).length);
   for(const adjacency of raw.roomAdjacencies){
    const a=stage.scene!.interior!.rooms.find(r=>r.id===adjacency.from)!,b=stage.scene!.interior!.rooms.find(r=>r.id===adjacency.to)!;
    expect(a.storeyId).toBe(b.storeyId);expect(sharedBoundaryLength(a.footprint,b.footprint)).toBeGreaterThanOrEqual(.8);
   }
  }
  expect(auditV3Interior(built.scene!).filter(f=>f.severity!=='advisory')).toEqual([]);
 },20000);
 it('constructs a hollow circular fountain and a real motor-court island rather than water over paving',()=>{
  const {stage,built}=buildReference(formalArrivalEstate),scene=built.scene!,fountain=scene.objects.find(o=>o.id==='arrival-fountain')!;
  expect(planArea(authoredPlan(fountain))).toBeCloseTo(Math.PI*16,1);
  const parts=built.model!.primitives.filter(p=>p.sourceObjectId===fountain.id);
  expect(parts.map(p=>p.componentRole)).toEqual(expect.arrayContaining(['shaped basin floor','shaped basin shell','shaped basin coping','water surface','fountain jet']));
  const court=built.model!.primitives.filter(p=>p.sourceObjectId==='motor-court');
  expect(court.every(p=>p.surface==='paving')).toBe(true);
  const caps=court.flatMap(primitiveTriangles).filter(t=>Math.max(t[1],t[4],t[7])-Math.min(t[1],t[4],t[7])<1e-8);
  expect(caps.length).toBeGreaterThan(20);
  expect(caps.some(t=>pointInPolygon([1,43.3],[[t[0],t[2]],[t[3],t[5]],[t[6],t[8]]]))).toBe(false);
  const paths=deriveArchitecturalPlan(stage.scene!,null,null).parts.find(p=>p.owner==='motor-court')!.paths;
  expect(paths.reduce((n,p)=>n+planArea(p),0)).toBeCloseTo(Math.PI*(256-16),0);
  const removed={...built.model!,primitives:built.model!.primitives.filter(p=>p.id!=='arrival-fountain-shell')};
  expect(auditArchitecturalConstructionFidelity(scene,removed).some(f=>f.code==='ARCHITECTURAL_PART_UNBUILT')).toBe(true);
 });
 it('preserves exact curved approach semantics across save/checkout, drawing and 3D',()=>{
  const {stage,built}=buildReference(formalArrivalEstate),route=stage.scene!.estatePlan!.circulation.find(r=>r.id==='curved-gate-approach')!;
  const points=estateRoutePoints(route,stage.scene!);
  expect(points.length).toBeGreaterThan(60);
  // All arc samples remain on the independently specified 21m radius.
  for(const p of points.slice(1,-1))if(p[0]>19&&p[2]<70)expect(Math.hypot(p[0]-19,p[2]-70)).toBeCloseTo(21,8);
  const saved=checkoutPlanEvaluation(JSON.parse(JSON.stringify(stage.scene)));
  expect(saved.plan!.connections[0].path).toEqual(stage.plan!.connections[0].path);
  const actual=built.model!.primitives.find(p=>p.id==='v3-connection-estate:curved-gate-approach')!;
  expect(actual.kind).toBe('triMesh');if(actual.kind==='triMesh')expect(actual.vertices).toEqual(estateRouteVertices(built.scene!,built.scene!.estatePlan!.circulation.find(r=>r.id===route.id)!));
  const drift=structuredClone(built.scene!);drift.estatePlan!.circulation.find(r=>r.id===route.id)!.spatial!.path![1].radius!+=.1;
  expect(sameArchitecturalPlan(stage.scene!,drift)).toBe(false);
 });
 it('keeps ground-only pavilions and circulation out of nonexistent upper floors',()=>{
  const plan=preparePlanEvaluation(articulatedWingsResidence());
  expect(deriveArchitecturalPlan(plan.scene!,null,0).buildings.map(b=>b.id)).toContain('low-library');
  expect(deriveArchitecturalPlan(plan.scene!,null,1).buildings.map(b=>b.id)).not.toContain('low-library');
  expect(deriveArchitecturalPlan(plan.scene!,null,2).buildings).toEqual([]);
  expect(deriveArchitecturalPlan(plan.scene!,null,2).parts.filter(p=>p.category==='stairs')).toEqual([]);
 });
 it('keeps presentation planting inside an actual curved garden rather than its bounding rectangle',()=>{
  const stage=preparePlanEvaluation(formalArrivalEstate()),zone=stage.scene!.objects.find(o=>o.id==='east-arrival-garden')!;
  zone.semanticRole='tropical garden';
  const scene={...stage.scene!,objects:[zone]};
  const plants=v3VegetationPlacements(scene,()=>0);expect(plants.length).toBeGreaterThan(0);
  for(const p of plants)expect(footprintContains(zone,[[p.position[0]-zone.transform.position[0],p.position[2]-zone.transform.position[2]]])).toBe(true);
  expect(v3VegetationPlacements(scene,()=>0)).toEqual(plants);
 });
 it('fails closed on malformed, disconnected or too-tight curved routes and conflicting path authorities',()=>{
  const line={id:'one',type:'line' as const,start:[0,0] as [number,number],end:[1,0] as [number,number]};
  expect(sampleRoutePath([line,{...line,id:'two',start:[2,0],end:[3,0]}])).toBeUndefined();
  expect(sampleRoutePath([line,line])).toBeUndefined();
  for(const mutate of [
   (p:ReturnType<typeof formalArrivalEstate>)=>{p.connections[0].path![1].radius=2;},
   (p:ReturnType<typeof formalArrivalEstate>)=>{p.connections[0].waypoints=[[10,0,10]];},
   (p:ReturnType<typeof formalArrivalEstate>)=>{p.connections[0].path![0].start=[40,79];},
  ]){const raw=formalArrivalEstate();mutate(raw);const stage=preparePlanEvaluation(raw);expect(stage.unresolved!.some(i=>i.id==='curved-gate-approach')).toBe(true);expect(planConstructionBlockers(stage).length).toBeGreaterThan(0);}
 });
 it('retains explicit construction limitations rather than accepting a shaped canopy or invalid inset',()=>{
  const raw=formalArrivalEstate();raw.features.find(f=>f.id==='west-shade')!.footprint=raw.features.find(f=>f.id==='arrival-fountain')!.footprint;
  expect(planConstructionBlockers(preparePlanEvaluation(raw)).some(f=>f.targetIds.includes('west-shade'))).toBe(true);
  const bad=formalArrivalEstate(),f=bad.features.find(f=>f.id==='arrival-fountain')!;
  f.footprint={kind:'outline',operations:[],segments:[{id:'tiny-circle',type:'arc',center:[3.7,3.7],radius:.5,startAngle:0,sweep:360}]};
  expect(planConstructionBlockers(preparePlanEvaluation(bad)).some(issue=>issue.targetIds.includes(f.id))).toBe(true);
 });
 it('offers floor-plan intelligence and real supported geometry in the production authoring contract',()=>{
  expect(v3PlanAuthoringSchema.shape.roomAdjacencies).toBeDefined();
  expect(v3PlanAuthoringSchema.shape.connections.unwrap().element.shape.path).toBeDefined();
  const prompt=planEvaluationPrompt();
  for(const phrase of ['circulation skeleton','privacy','aligned landing','roomAdjacencies','fountain','WORLD x/z','No splines']){
   expect(prompt).toContain(phrase);
  }
 });
});
