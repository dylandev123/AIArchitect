import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { estateEndpoint, estateRoutePoints, estateRouteSegments, estateRouteVertices, spatialPlanPoints, siteAccessFits, estateRouteBounds, endpointFits } from '../routeGeometry';
import { auditEstateSpatial } from '../estateSpatial';
import { auditV3EstatePlan, v3EstatePlanSchema } from '../estatePlan';
import { executeV3SceneOperations } from '../operations';
import { auditV3Completeness } from '../completeness';
import { auditV3Blueprint } from '../blueprint';
import { ingestV3GenerationOutput } from '../ingestion';
import { compileV3Scene } from '../scene';
import { assessV3ObjectiveRevision, assessV3Revision } from '../safeRevision';
import { recoveredCloister, explicitlyCorrectedCloister } from '../parity/unifiedSpatial';
import { materializeV3ArchitecturalObject } from '../architecture';
import { curvedFixture } from '../parity/curved';

const blockers=(scene:ReturnType<typeof recoveredCloister>)=>auditEstateSpatial(scene).filter(d=>d.severity!=='advisory');
const report=(scene:ReturnType<typeof recoveredCloister>)=>{const diagnostics=blockers(scene);return {diagnostics,significant:diagnostics.length,repairRecommended:true};};

describe('one spatial route from blueprint through construction and repair (offline)',()=>{
 it('constructs an explicitly corrected geometric plan without changing buildings, roofs or finishes',()=>{
  const scene=explicitlyCorrectedCloister(), snapshot=structuredClone(scene), initial=recoveredCloister(1);
  const result=ingestV3GenerationOutput(scene,'flat',{requireBlueprint:true,requireDesignConsistency:true});
  expect(result.validation.errors).toEqual([]);
  expect(result.consistency?.findings.filter(f=>f.classification!=='advisory')).toEqual([]);
  expect(result.ok).toBe(true);expect(result.blueprintApproval).toBeDefined();
  expect(scene).toEqual(snapshot);
  for(const o of initial.objects){
   const after=scene.objects.find(n=>n.id===o.id)!;
   expect(after.material).toEqual(o.material);
   if(['building-mass','roof-form'].includes(o.type))expect(after).toEqual(o);
  }
  expect(blockers(scene)).toEqual([]);
  const initialIssues=ingestV3GenerationOutput(initial,'flat',{requireBlueprint:true}).validation.issues;
  expect(assessV3ObjectiveRevision(initial,result.scene,initialIssues).accepted).toBe(true);
  expect(auditV3Completeness(scene).findings.filter(f=>f.code==='AUTHORED_ACCESS_DISCONNECTED')).toEqual([]);
  if(process.env.UNIFIED_SPATIAL_PROOF_OUTPUT)writeFileSync(process.env.UNIFIED_SPATIAL_PROOF_OUTPUT,JSON.stringify({ok:result.ok,blueprint:result.blueprint,validation:result.validation,consistency:result.consistency,repair:assessV3ObjectiveRevision(initial,scene,ingestV3GenerationOutput(initial,'flat',{requireBlueprint:true}).validation.issues),scene},null,2)+'\n');
 });
 it.each([0,1] as const)('retains real collisions and the missing explicit boundary on untouched attempt %s',attempt=>{
  const scene=recoveredCloister(attempt), findings=blockers(scene);
  expect(findings.map(f=>[f.code,f.targetIds])).toEqual([
   ['ESTATE_ACCESS_POINT_MISSING',['siteNorth','driveway']],
   ['ESTATE_ROUTE_BLOCKED',['guestPath','guestPavilion']],
   ['ESTATE_ROUTE_BLOCKED',['wellnessPath','wellnessPavilion']],
  ]);
  expect(auditV3Completeness(scene).findings.filter(f=>f.code==='AUTHORED_ACCESS_DISCONNECTED')).toEqual([]);
 });
 it.each([
  ['north',[7,0,-60]],['south',[7,0,60]],['east',[75,0,7]],['west',[-75,0,7]],['boundary',[75,0,12]],
 ] as const)('supports authored %s boundary coordinates with stable identities', (boundary,point)=>{
  const scene=explicitlyCorrectedCloister();scene.estatePlan!.siteAccess=[{id:'entry-boundary',boundary,point:[...point]}];
  expect(v3EstatePlanSchema.safeParse(scene.estatePlan).success).toBe(true);
  expect(siteAccessFits(scene,'entry-boundary',[...point])).toBe(true);
  expect(siteAccessFits(scene,'entry-boundary',[point[0]+.5,point[1],point[2]])).toBe(false);
  const a=scene.estatePlan!.siteAccess[0];a.point=[0,0,0];expect(siteAccessFits(scene,a.id,a.point)).toBe(false);
 });
 it.each(['north','south','east','west'] as const)('compiles a %s entrance into an arrival area without a boundary object',boundary=>{
  const scene=explicitlyCorrectedCloister(),plan=scene.estatePlan!,route=plan.circulation[0];
  const point:[number,number,number]=boundary==='north'?[0,0,-60]:boundary==='south'?[0,0,60]:boundary==='east'?[75,0,0]:[-75,0,0];
  plan.siteAccess=[{id:'authored-gate',boundary,point}];plan.program=[];plan.zones=[];plan.architecture=[];plan.relationships=[];
  plan.circulation=[route];route.from='authored-gate';route.spatial!.from={};
  const inward:[number,number,number]=[point[0]*.9,0,point[2]*.9];route.spatial!.waypoints=[inward];
  scene.objects=scene.objects.filter(o=>['driveway','arrivalCourt'].includes(o.id));
  expect(blockers(scene)).toEqual([]);
  expect(compileV3Scene(scene).primitives.some(p=>p.id==='v3-connection-estate:route-driveway')).toBe(true);
  expect(scene.objects.some(o=>o.id==='authored-gate')).toBe(false);
  const edited=executeV3SceneOperations(scene,{intent:'Retain authored gate identity',operations:[{op:'replaceEstatePlan',estatePlan:structuredClone(plan)}]});
  expect(edited.ok).toBe(true);expect(edited.scene.estatePlan!.siteAccess).toEqual(plan.siteAccess);
 });
 it('does not turn aesthetic alignment into required access or a fatal missing mirror',()=>{
  const scene=explicitlyCorrectedCloister();
  scene.estatePlan!.relationships.push({id:'garden-axis',intent:'Optional visual axis',from:'mainResidence',to:'palmGarden',kind:'aligns'});
  expect(auditV3Blueprint(scene).ok).toBe(true);
  expect(auditV3EstatePlan(scene).find(f=>f.message.startsWith('garden-axis:'))?.severity).toBe('advisory');
 });
 it('derives unambiguous named endpoints, retaining explicit coordinates and declining missing choices',()=>{
  const scene=explicitlyCorrectedCloister(),route=scene.estatePlan!.circulation.find(r=>r.id==='route-entry')!;
  delete route.spatial!.to.point;
  expect(estateEndpoint(scene,route,'to')![0]).toBeCloseTo(0);expect(estateEndpoint(scene,route,'to')![2]).toBeCloseTo(-10);
  expect(blockers(scene)).toEqual([]);
  route.spatial!.to.point=[1,0,-10];expect(estateEndpoint(scene,route,'to')).toEqual([1,0,-10]);
  delete route.spatial!.to.point;delete route.spatial!.to.openingId;
  expect(estateEndpoint(scene,route,'to')).toBeUndefined();
  expect(blockers(scene).some(f=>f.code==='ESTATE_ACCESS_POINT_MISSING'&&f.targetIds[0]==='mainResidence')).toBe(true);
  const drive=scene.estatePlan!.circulation[0];delete drive.spatial!.from.point;
  expect(estateEndpoint(scene,drive,'from')).toEqual([0,0,-60]);
  delete drive.spatial!.to.point;expect(estateEndpoint(scene,drive,'to')).toBeUndefined();
 });
 it('derives endpoints on rotated, recessed and curved authored wall addresses',()=>{
  const scene=explicitlyCorrectedCloister(),route=scene.estatePlan!.circulation.find(r=>r.id==='route-entry')!;
  const circle=curvedFixture('circular-pavilion').objects.find(o=>o.type==='building-mass')!;
  scene.objects.push({...circle,id:'circle'});
  const door=circle.composition!.openings!.find(o=>['door','glazed-door'].includes(o.type))!;
  route.to='circle';route.spatial!.to={openingId:door.id};
  expect(estateEndpoint(scene,route,'to')?.every(Number.isFinite)).toBe(true);
  const mass=scene.objects.find(o=>o.id==='mainResidence')!;
  mass.architecture!.rotationY=Math.PI/2;
  scene.objects=scene.objects.map(materializeV3ArchitecturalObject);
  route.to=mass.id;route.spatial!.to={openingId:'mainEntryDoor'};
  const p=estateEndpoint(scene,route,'to')!;expect(p[0]).toBeCloseTo(-6);expect(p[2]).toBeCloseTo(-4);
 });
 it('uses route width and bends for allocations/contact even when compatibility boxes are deliberately wrong',()=>{
  const scene=explicitlyCorrectedCloister(),route=scene.estatePlan!.circulation.find(r=>r.id==='route-guest')!,owner=scene.objects.find(o=>o.id==='guestPath')!;
  const before=compileV3Scene(scene),points=spatialPlanPoints(scene,owner);
  owner.dimensions=[99,2,99];owner.transform.position=[0,1,0];
  expect(spatialPlanPoints(scene,owner)).toEqual(points);
  expect(compileV3Scene(scene)).toEqual(before);
  expect(auditV3EstatePlan(scene).filter(f=>f.code==='ESTATE_ALLOCATION_CONFLICT')).toEqual([]);
  const mesh=before.primitives.find(p=>p.id==='v3-connection-estate:route-guest')!;
  expect(mesh.kind).toBe('triMesh');if(mesh.kind==='triMesh')expect(mesh.vertices).toEqual(estateRouteVertices(scene,route));
  expect(estateRouteSegments(scene,route)).toHaveLength(4);
  expect(auditV3Completeness(scene).findings.filter(f=>f.code==='AUTHORED_ACCESS_DISCONNECTED')).toEqual([]);
  route.spatial!.width=23;
  expect(blockers(scene).some(f=>f.code==='ESTATE_ROUTE_BLOCKED')).toBe(true);
  expect(auditV3EstatePlan(scene).some(f=>f.code==='ESTATE_ALLOCATION_CONFLICT')).toBe(true);
 });
 it('constructs owner geometry from the plan when the provider authors identity/material only',()=>{
  const scene=explicitlyCorrectedCloister(),raw=JSON.parse(JSON.stringify(scene));
  for(const o of raw.objects.filter((o:{type:string})=>['path','driveway'].includes(o.type))){delete o.architecture;delete o.dimensions;delete o.transform;}
  const result=ingestV3GenerationOutput(raw,'flat',{requireBlueprint:true,requireDesignConsistency:true});
  expect(result.validation.errors).toEqual([]);expect(result.ok).toBe(true);
  expect(compileV3Scene(result.scene)).toEqual(compileV3Scene(scene));
 });
 it('edits canonical paths and refreshes their owner bounds atomically without moving architecture',()=>{
  const scene=explicitlyCorrectedCloister(),plan=structuredClone(scene.estatePlan!);
  plan.circulation.find(r=>r.id==='route-guest')!.spatial!.waypoints=[[28,0,-23],[34,0,-8],[34,0,7]];
  const result=executeV3SceneOperations(scene,{intent:'Refine the guest approach',operations:[{op:'replaceEstatePlan',estatePlan:plan}]});
  expect(result.errors).toEqual([]);expect(result.ok).toBe(true);
  const path=result.scene.objects.find(o=>o.id==='guestPath')!;
  expect(path.transform).toEqual(estateRouteBounds(result.scene,path)!.transform);
  expect(path.dimensions).toEqual(estateRouteBounds(result.scene,path)!.dimensions);
  expect(result.scene.objects.filter(o=>o.type==='building-mass')).toEqual(scene.objects.filter(o=>o.type==='building-mass'));
  expect(executeV3SceneOperations(scene,{intent:'Move a derived surface',operations:[{op:'move',target:'guestPath',position:[20,0,0]}]}).ok).toBe(false);
 });
 it('checks endpoints on actual bent corridors rather than empty areas of their envelope',()=>{
  const scene=explicitlyCorrectedCloister(),owner=scene.objects.find(o=>o.id==='guestPath')!;
  expect(endpointFits(owner,{point:[25,0,-5]},2,'pedestrian',scene)).toBe(false);
  expect(endpointFits(owner,{point:[35,0,3]},2,'pedestrian',scene)).toBe(true);
 });
 it('requires a proven passage, never a touching mass or a connects label alone',()=>{
  const scene=explicitlyCorrectedCloister();
  const wing=scene.objects.find(o=>o.id==='eastResidenceWing')!;
  wing.architecture!.x+=50;scene.objects=scene.objects.map(materializeV3ArchitecturalObject);
  expect(blockers(scene).some(f=>f.code==='ESTATE_ACCESS_MISSING'&&f.targetIds.includes(wing.id))).toBe(true);
 });
 it('rejects access through a compiled sealed shared wall even when the masses touch and connects is declared',()=>{
  const scene=explicitlyCorrectedCloister(),wing=scene.objects.find(o=>o.id==='eastResidenceWing')!;
  wing.composition!.openings=wing.composition!.openings!.filter(o=>o.id!=='eastPoolDoor');
  expect(blockers(scene).some(f=>f.code==='ESTATE_ACCESS_MISSING'&&f.targetIds.includes(wing.id))).toBe(false);
  scene.objects.push({...structuredClone(wing),id:'sealed-partition',type:'wall',label:'Sealed partition',composition:undefined,architecture:{x:14,z:2,width:8,depth:.4,height:7.2,baseElevation:0}});
  scene.objects=scene.objects.map(materializeV3ArchitecturalObject);
  expect(auditV3Completeness(scene).edges.some(e=>e.kind==='junction'&&[e.from,e.to].includes('eastResidenceWing#0'))).toBe(false);
  expect(blockers(scene).some(f=>f.code==='ESTATE_ACCESS_MISSING'&&f.targetIds.includes(wing.id))).toBe(true);
 });
 it('accepts dry pool approach, excludes roofs/planting and requires a separate approach for an isolated pool',()=>{
  const scene=explicitlyCorrectedCloister(),program=scene.estatePlan!.program.find(p=>p.kind==='amenity')!;
  program.objectIds.push('palmGarden');expect(blockers(scene)).toEqual([]);
  const pool=scene.objects.find(o=>o.id==='pool')!;pool.architecture!.x=65;scene.objects=scene.objects.map(materializeV3ArchitecturalObject);
  expect(blockers(scene).some(f=>f.code==='ESTATE_ACCESS_MISSING'&&f.targetIds.includes('pool'))).toBe(true);
  const entry=scene.estatePlan!.program.find(p=>p.objectIds.includes('pool'))!;entry.access='optional';
  expect(blockers(scene).some(f=>f.code==='ESTATE_ACCESS_MISSING'&&f.targetIds.includes('pool'))).toBe(false);
 });
 it('rejects 2m → 23m box/route repairs, new collisions and distant detours while permitting a local authored correction',()=>{
  const initial=explicitlyCorrectedCloister(),bad=structuredClone(initial),route=bad.estatePlan!.circulation.find(r=>r.id==='route-guest')!;
  route.spatial!.waypoints=[[28,0,-23],[38,0,-8],[38,0,7]];
  const failure=ingestV3GenerationOutput(bad,'flat',{requireBlueprint:true}),candidate=ingestV3GenerationOutput(initial,'flat',{requireBlueprint:true});
  const issues=failure.validation.issues;
  expect(assessV3ObjectiveRevision(failure.scene,candidate.scene,issues).accepted).toBe(true);
  expect(assessV3ObjectiveRevision(bad,initial,issues).accepted).toBe(true);
  expect(assessV3Revision(bad,initial,report(bad),report(initial)).accepted).toBe(true);
  const enlarged=structuredClone(initial);enlarged.estatePlan!.circulation.find(r=>r.id===route.id)!.spatial!.width=23;
  expect(assessV3ObjectiveRevision(bad,enlarged,issues).accepted).toBe(false);
  const box=structuredClone(bad);box.objects.find(o=>o.id==='guestPath')!.dimensions[0]=99;
  expect(assessV3ObjectiveRevision(bad,box,issues).reasons.some(r=>r.includes('Canonical route owner'))).toBe(true);
  const collision=structuredClone(initial);collision.estatePlan!.circulation.find(r=>r.id===route.id)!.spatial!.waypoints=[[0,0,-4]];
  expect(assessV3ObjectiveRevision(bad,collision,issues).reasons.some(r=>r.includes('Unsafe route repair'))).toBe(true);
  const distant=structuredClone(initial);distant.estatePlan!.circulation.find(r=>r.id===route.id)!.spatial!.waypoints=[[65,0,-45],[35,0,7]];
  expect(assessV3ObjectiveRevision(bad,distant,issues).reasons.some(r=>r.includes('local repair scope'))).toBe(true);
 });
 it('retains exact duplicate handling and never approves genuine blueprint contradictions',()=>{
  const scene=explicitlyCorrectedCloister(),route=scene.estatePlan!.circulation[0],before=compileV3Scene(scene);
  route.spatial!.waypoints=[route.spatial!.from.point!,...estateRoutePoints(route,scene),route.spatial!.to.point!];
  expect(compileV3Scene(scene)).toEqual(before);expect(auditV3Blueprint(scene).ok).toBe(true);
  scene.estatePlan!.siteAccess![0].point=[0,0,-59];
  expect(auditV3Blueprint(scene).ok).toBe(false);
 });
});
