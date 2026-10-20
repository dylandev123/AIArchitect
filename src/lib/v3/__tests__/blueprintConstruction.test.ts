import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { blueprintCanopy, blueprintCloister, blueprintCircle } from '../parity/blueprintConstruction';
import { estateEndpoint, estateEntranceApproach, estateRoutePoints, estateRouteVertices, estateRouteBounds, spatialPlanPoints } from '../routeGeometry';
import { auditV3EstatePlan, v3EstatePlanSchema } from '../estatePlan';
import { auditEstateSpatial } from '../estateSpatial';
import { auditV3Blueprint } from '../blueprint';
import { approveV3Blueprint, auditV3BlueprintElaboration } from '../blueprintApproval';
import { compileV3Scene, type V3Scene } from '../scene';
import { normalizeV3GenerationOutput } from '../generation';
import { ingestV3GenerationOutput } from '../ingestion';
import { auditV3Completeness } from '../completeness';
import { executeV3SceneOperations } from '../operations';
import { assessV3ObjectiveRevision } from '../safeRevision';
import { resolveV3ZoneGeometry } from '../zoneGeometry';
import { recoveredCloister } from '../parity/unifiedSpatial';
import canopy0 from './fixtures/canopy-meridian-attempt-0.json';
import canopy1 from './fixtures/canopy-meridian-attempt-1.json';
import cloister0 from './fixtures/blueprint-cloister-attempt-0.json';
import cloister1 from './fixtures/blueprint-cloister-attempt-1.json';

const route=(s:V3Scene,id='route-entry')=>s.estatePlan!.circulation.find(r=>r.id===id)!;
const mesh=(s:V3Scene,id='route-entry')=>compileV3Scene(s).primitives.find(p=>p.id===`v3-connection-estate:${id}`)!;
const ingest=(s:V3Scene)=>ingestV3GenerationOutput(s,'flat',{requireBlueprint:true,requireDesignConsistency:true});
const issues=(s:V3Scene)=>auditEstateSpatial(s).filter(f=>f.severity!=='advisory');

describe('blueprint entrance → authored approach → constructed destination',()=>{
 it('accepts and constructs the complete corrected Cloister through production ingestion',()=>{
  const scene=blueprintCloister(),before=structuredClone(scene),result=ingest(scene);
  expect(result.validation.errors).toEqual([]);expect(result.ok).toBe(true);expect(result.blueprintApproval).toBeDefined();
  expect(issues(scene)).toEqual([]);
  for(const r of scene.estatePlan!.circulation.filter(r=>r.spatial)){
   const primitive=mesh(scene,r.id);expect(primitive.kind).toBe('triMesh');
   if(primitive.kind==='triMesh')expect(primitive.vertices).toEqual(estateRouteVertices(scene,r));
  }
  expect(auditV3Completeness(scene).findings.filter(f=>f.code==='AUTHORED_ACCESS_DISCONNECTED')).toEqual([]);
  expect(scene).toEqual(before);
 });
 it('closes five Canopy door/route gaps at actual recessed/side doors without correcting unrelated architecture',()=>{
  const scene=blueprintCanopy(),r=route(scene,'plan-entry-walk');
  expect(estateEndpoint(scene,r,'to')).toEqual([0,0,-9.6]);
  expect(estateEntranceApproach(scene,r,'to')![2]).toBeCloseTo(-12.6);
  expect(estateRoutePoints(r,scene).at(-1)![2]).toBeCloseTo(-9.6);
  expect(issues(scene).filter(f=>['ESTATE_ROUTE_BLOCKED','ESTATE_ACCESS_POINT_MISSING'].includes(f.code))).toEqual([]);
  expect(auditV3EstatePlan(scene).filter(f=>f.code==='ESTATE_ACCESS_DISCONNECTED')).toEqual([]);
  expect(auditV3Completeness(scene).findings.filter(f=>f.code==='AUTHORED_ACCESS_DISCONNECTED')).toEqual([]);
  const original=normalizeV3GenerationOutput(canopy1,'flat').scene;
  expect(scene.objects.filter(o=>!['entryWalk','guestWalk','wellnessWalk'].includes(o.id))).toEqual(original.objects.filter(o=>!['entryWalk','guestWalk','wellnessWalk'].includes(o.id)));
  expect(ingest(scene).ok).toBe(false); // Original reservations, garden overrun and joined water-garden remain.
 });
 it('updates contact, approach, rendered ribbon, allocation and selectable bounds after an authoritative entrance edit',()=>{
  const scene=blueprintCanopy(),r=route(scene,'plan-entry-walk'),host=scene.objects.find(o=>o.id==='mainResidence')!;
  const composition=structuredClone(host.composition!);const door=composition.openings!.find(o=>o.id==='mainEntryDoor')!;
  if(!('start' in door))throw Error('fixture door');door.start+=.01;door.end+=.01;
  // Canopy retains unrelated invalid commitments, so exercise its derivation here and use valid Cloister below for atomic persistence.
  const changed=structuredClone(scene);changed.objects.find(o=>o.id===host.id)!.composition=composition;
  expect(estateEndpoint(changed,r,'to')![0]).toBeCloseTo(.46);
  expect(estateEntranceApproach(changed,r,'to')![0]).toBeCloseTo(.46);
  expect(mesh(changed,r.id)).not.toEqual(mesh(scene,r.id));
  const owner=changed.objects.find(o=>o.id==='entryWalk')!,zone={id:'walk-zone',purpose:'Approach measurement',objectIds:['entryWalk'],allocationMode:'derived' as const};
  const points=spatialPlanPoints(changed,owner),bounds=estateRouteBounds(changed,owner)!;
  expect(resolveV3ZoneGeometry(changed,zone).envelope!.width).toBeCloseTo(bounds.dimensions[0]);
  expect(Math.max(...points.map(p=>p[0]))).toBeCloseTo(bounds.transform.position[0]+bounds.dimensions[0]/2);
 });
 it('persists references through atomic edits and JSON reload without persisting derived endpoint/anchor coordinates',()=>{
  const scene=blueprintCloister(),host=scene.objects.find(o=>o.id==='mainResidence')!,composition=structuredClone(host.composition!);
  const door=composition.openings!.find(o=>o.id==='mainEntryDoor')!;if(!('start' in door))throw Error('fixture');door.start+=.01;door.end+=.01;
  const result=executeV3SceneOperations(scene,{intent:'Move the principal entrance along its existing wall',operations:[{op:'setComposition',target:host.id,composition}]});
  expect(result.errors).toEqual([]);expect(result.ok).toBe(true);expect(issues(result.scene)).toEqual([]);
  expect(estateEndpoint(result.scene,route(result.scene),'to')![0]).toBeCloseTo(.36);
  expect(route(result.scene).spatial!.to).toEqual({entranceId:'bp-main-entry',approachDistance:3});
  for(const o of scene.objects.filter(o=>o.id!==host.id&&o.id!=='entryWalk'))expect(result.scene.objects.find(n=>n.id===o.id)).toEqual(o);
  const persisted=JSON.parse(JSON.stringify(result.scene)),reloaded=ingest(persisted);
  expect(reloaded.ok).toBe(true);expect(mesh(reloaded.scene)).toEqual(mesh(result.scene));
  expect(route(reloaded.scene).spatial!.to).toEqual(route(scene).spatial!.to);
  const approval=approveV3Blueprint(scene).approval!;
  expect(auditV3BlueprintElaboration(approval,result.scene).ok).toBe(false); // Editing is explicit replanning, never an unnoticed elaboration.
 });
 it.each([blueprintCircle,blueprintCanopy])('constructs actual curved/articulated entrance geometry',make=>{
  const scene=make(),r=route(scene,make===blueprintCircle?'circle-route':'plan-entry-walk'),p=estateEndpoint(scene,r,'to')!,a=estateEntranceApproach(scene,r,'to')!;
  expect(Math.hypot(a[0]-p[0],a[2]-p[2])).toBeCloseTo(3);
  expect(mesh(scene,r.id).kind).toBe('triMesh');expect(issues(scene).filter(f=>f.code==='ESTATE_ROUTE_BLOCKED')).toEqual([]);
 });
 it.each([blueprintCircle,blueprintCanopy])('rotates curved/articulated contact and approach together without changing the blueprint',make=>{
  const scene=make(),r=route(scene,make===blueprintCircle?'circle-route':'plan-entry-walk'),p=estateEndpoint(scene,r,'to')!,a=estateEntranceApproach(scene,r,'to')!;
  const host=scene.objects.find(o=>o.id===r.to)!,origin=host.transform.position;
  host.architecture!.rotationY=Math.PI/2;
  const rotated=normalizeV3GenerationOutput(scene,'flat').scene;
  for(const [before,after] of [[p,estateEndpoint(rotated,r,'to')!],[a,estateEntranceApproach(rotated,r,'to')!]]){
   expect(after[0]).toBeCloseTo(origin[0]+before[2]-origin[2]);expect(after[2]).toBeCloseTo(origin[2]-before[0]+origin[0]);
  }
  expect(route(rotated,r.id)).toEqual(r);
 });
 it('updates a moved arc opening and its normal without adding a waypoint or flattening the arc',()=>{
  const scene=blueprintCircle(),r=route(scene,'circle-route'),host=scene.objects.find(o=>o.id===r.to)!,before=structuredClone(host.composition!.footprint),composition=structuredClone(host.composition!);
  const opening=composition.openings!.find(o=>o.id==='entry')!;if(!('start' in opening))throw Error('fixture');opening.start+=.025;opening.end+=.025;
  const edited=executeV3SceneOperations(scene,{intent:'Move the entrance along its arc',operations:[{op:'setComposition',target:host.id,composition}]});
  expect(edited.errors).toEqual([]);expect(edited.ok).toBe(true);
  const p=estateEndpoint(edited.scene,r,'to')!,a=estateEntranceApproach(edited.scene,r,'to')!;
  expect(Math.hypot(p[0],p[2])).toBeCloseTo(8);expect(Math.hypot(a[0],a[2])).toBeCloseTo(11);
  expect(p).not.toEqual(estateEndpoint(scene,r,'to'));expect(route(edited.scene,r.id)).toEqual(r);
  expect(edited.scene.objects.find(o=>o.id===host.id)!.composition!.footprint).toEqual(before);
 });
 it('rejects ambiguous or blocked reference edits atomically and preserves the original scene',()=>{
  const scene=blueprintCloister();
  for(const mutate of [(s:V3Scene)=>{route(s).spatial!.to.entranceId='no-decision';},(s:V3Scene)=>{route(s,'route-guest').spatial!.waypoints=[[0,0,-4]];}]){
   const changed=structuredClone(scene);mutate(changed);
   const result=executeV3SceneOperations(scene,{intent:'Invalid approach change',operations:[{op:'replaceEstatePlan',estatePlan:changed.estatePlan}]});
   expect(result.ok).toBe(false);expect(result.scene).toEqual(scene);
  }
 });
 it.each([
  {entranceId:'bp-main-entry',point:[0,0,-10]}, {entranceId:'bp-main-entry',openingId:'mainEntryDoor'},
  {approachDistance:3,openingId:'mainEntryDoor'}, {entranceId:'bp-main-entry',approachDistance:0},
 ])('rejects competing endpoint geometry or unbound approach intent: %j',access=>{
  const scene=blueprintCloister();Object.assign(route(scene).spatial!,{to:access});
  expect(v3EstatePlanSchema.safeParse(scene.estatePlan).success).toBe(false);expect(ingest(scene).ok).toBe(false);
 });
 it.each(['missing','wrong-host','upper-level','duplicate','missing-opening','multi-plane'] as const)('requires an explicit decision for %s destinations',kind=>{
  const scene=kind==='multi-plane'?blueprintCanopy():blueprintCloister(),r=route(scene,kind==='multi-plane'?'plan-entry-walk':'route-entry'),bp=scene.estatePlan!.blueprint!;
  const entry=bp.entrances.find(e=>e.id===r.spatial!.to.entranceId)!;
  if(kind==='missing')r.spatial!.to.entranceId='undecided';
  if(kind==='wrong-host')entry.objectId='guestPavilion';
  if(kind==='upper-level')entry.level=1;
  if(kind==='duplicate')bp.entrances.push({...entry});
  if(kind==='missing-opening')entry.openingId='not-a-door';
  if(kind==='multi-plane'){
   const door=scene.objects.find(o=>o.id===entry.objectId)!.composition!.openings!.find(o=>o.id===entry.openingId)!;
   if('start' in door){door.start=.2;door.end=.8;}
  }
  expect(estateEndpoint(scene,r,'to')).toBeUndefined();
  expect(mesh(scene,r.id)).toBeUndefined();expect(auditV3Blueprint(scene).ok).toBe(false);expect(ingest(scene).ok).toBe(false);
 });
 it('rejects wall-following approaches, obstacles and water without changing authored bends',()=>{
  for(const water of [false,true]){
   const scene=blueprintCloister(),r=route(scene),before=structuredClone(r);
   scene.objects.push({...structuredClone(scene.objects.find(o=>o.id==='arrivalCourt')!),id:'obstacle',type:water?'pool':'volume',collision:water?'water':'solid',architecture:{x:0,z:-14,width:4,depth:1,height:2,baseElevation:0}});
   const normalized=normalizeV3GenerationOutput(scene,'flat').scene;
   expect(issues(normalized).some(f=>f.code===(water?'ESTATE_POOL_CROSSING':'ESTATE_ROUTE_BLOCKED'))).toBe(true);
   expect(ingest(normalized).ok).toBe(false);expect(route(normalized)).toEqual(before);
  }
  const scene=blueprintCloister(),r=route(scene,'route-guest');r.spatial!.to={entranceId:'bp-guest-entry'};r.spatial!.waypoints=[[28,0,-23],[38,0,-8]];
  expect(issues(scene).some(f=>f.code==='ESTATE_ROUTE_BLOCKED')).toBe(true);expect(ingest(scene).ok).toBe(false);
 });
 it('permits canonical owner refresh after a diagnosed entrance-span repair without permitting an unrelated door move',()=>{
  const good=blueprintCanopy(),host=good.objects.find(o=>o.id==='mainResidence')!,door=host.composition!.openings!.find(o=>o.id==='mainEntryDoor')!;
  if(!('start' in door))throw Error('fixture');door.start=.46;door.end=.56;
  const candidate=ingest(good),bad=blueprintCanopy(),badDoor=bad.objects.find(o=>o.id===host.id)!.composition!.openings!.find(o=>o.id===door.id)!;
  if(!('start' in badDoor))throw Error('fixture');badDoor.start=.2;badDoor.end=.8;
  const failure=ingest(bad);
  expect(failure.validation.issues.some(i=>i.code.startsWith('FOOTPRINT_')&&i.message.includes('mainEntryDoor'))).toBe(true);
  const decision=assessV3ObjectiveRevision(failure.scene,candidate.scene,failure.validation.issues);
  expect(decision.reasons).toEqual(['Only diagnosed technical fields changed.']);expect(decision.accepted).toBe(true);
  const unauthorized=assessV3ObjectiveRevision(blueprintCanopy(),candidate.scene,[]);
  expect(unauthorized.accepted).toBe(false);
 });
 it('repair validates the same derived corridor and protects entrance identity, approach decision and architecture',()=>{
  const good=blueprintCloister(),bad=structuredClone(good),r=route(bad,'route-guest');r.spatial!.waypoints=[[28,0,-23],[38,0,-8],[38,0,4]];
  const failure=ingest(bad),candidate=ingest(good);expect(failure.ok).toBe(false);expect(candidate.ok).toBe(true);
  expect(assessV3ObjectiveRevision(failure.scene,candidate.scene,failure.validation.issues).accepted).toBe(true);
  for(const mutate of [(s:V3Scene)=>{route(s,'route-guest').spatial!.to.entranceId='bp-wellness-entry';},(s:V3Scene)=>{route(s,'route-guest').spatial!.to.approachDistance=5;},(s:V3Scene)=>{s.objects.find(o=>o.id==='mainResidence')!.architecture!.x+=1;},(s:V3Scene)=>{route(s,'route-guest').spatial!.waypoints=[[0,0,-4]];}]){
   const unsafe=structuredClone(candidate.scene);mutate(unsafe);
   expect(assessV3ObjectiveRevision(failure.scene,unsafe,failure.validation.issues).accepted).toBe(false);
  }
 });
});

it('records untouched recovered failures beside explicitly authored offline variants',()=>{
 const originals=[['canopy-initial',canopy0],['canopy-repair',canopy1],['cloister-initial',cloister0],['cloister-repair',cloister1]] as const;
 const raw=originals.map(([name,input])=>{
  const before=JSON.stringify(input),result=ingestV3GenerationOutput(input,'flat',{requireBlueprint:name.startsWith('cloister'),requireDesignConsistency:true});
  expect(result.ok).toBe(false);expect(JSON.stringify(input)).toBe(before);
  return {name,sha256:createHash('sha256').update(before).digest('hex'),accepted:result.ok,issues:result.validation.issues};
 });
 const variants=[['canopy-access-only',blueprintCanopy()],['cloister-complete',blueprintCloister()]] as const;
 const corrected=variants.map(([name,scene])=>{const result=ingest(scene);return {name,accepted:result.ok,issues:result.validation.issues,completeness:auditV3Completeness(scene),routeGeometry:scene.estatePlan!.circulation.filter(r=>r.spatial).map(r=>({id:r.id,authored:r.spatial,resolvedPoints:estateRoutePoints(r,scene)})),scene};});
 expect(corrected.map(r=>r.accepted)).toEqual([false,true]);
 expect(compileV3Scene(recoveredCloister(1))).toEqual(compileV3Scene(normalizeV3GenerationOutput(cloister1,'flat').scene));
 if(process.env.BLUEPRINT_CONSTRUCTION_PROOF)writeFileSync(process.env.BLUEPRINT_CONSTRUCTION_PROOF,JSON.stringify({raw,corrected},null,2)+'\n');
},20000);
