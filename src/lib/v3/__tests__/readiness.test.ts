import {test,expect} from 'vitest';
import { READINESS_FIXTURES,readinessProvider,readinessFixture } from '../parity/readiness';
import { v3SceneOutputSchema,v3SceneArchitectPrompt } from '../schema';
import { ingestV3GenerationOutput } from '../ingestion';
import { compileV3Scene } from '../scene';
import { curvedFixture } from '../parity/curved';
import { assessV3ObjectiveRevision } from '../safeRevision';
import { auditV3EstatePlan } from '../estatePlan';
import { authoredOverlap,authoredPlan,planArea } from '../authoredPlan';
import { materializeV3ArchitecturalObject } from '../architecture';
import { executeV3SceneOperations } from '../operations';
for(const name of READINESS_FIXTURES)test(`offline provider → schema → ingestion → persistence → production compile: ${name}`,()=>{
 const wire=readinessProvider(name),parsed=v3SceneOutputSchema.safeParse(wire);
 expect(parsed.success,parsed.success?'':parsed.error.message).toBe(true);
 const prepared=ingestV3GenerationOutput(wire,'flat');
 expect(prepared.ok,JSON.stringify(prepared.validation.errors)).toBe(true);
 const restored=readinessFixture(name),model=compileV3Scene(restored);
 expect(model.primitives.length).toBeGreaterThan(20);
 expect(restored.objects.map(o=>o.id)).toEqual(wire.objects.map(o=>o.id));
 expect(restored.estatePlan).toEqual(wire.estatePlan);
 expect(compileV3Scene(JSON.parse(JSON.stringify(restored)))).toEqual(model);
 expect(auditV3EstatePlan(restored).filter(d=>d.code==='ESTATE_FORM_UNBUILT')).toEqual([]);
 console.log('READINESS',name,JSON.stringify(wire).length,'provider characters',model.primitives.length,'primitives');
});
test('every incompatible curved roof fails ingestion and edits; roof-only bounded repair preserves the outline',()=>{
 for(const roofForm of ['hip','gable','butterfly'] as const){
  const initial=curvedFixture('circular-pavilion');initial.objects[0].roofForm=roofForm;
  const bad=ingestV3GenerationOutput(initial,'flat');expect(bad.ok).toBe(false);
  expect(bad.validation.issues.some(i=>i.code==='ROOF_FOOTPRINT_UNSUPPORTED'&&i.severity==='fatal')).toBe(true);
  const raw=structuredClone(initial);raw.objects[0].roofForm='flat';const fixed=ingestV3GenerationOutput(raw,'flat');expect(fixed.ok).toBe(true);
  expect(assessV3ObjectiveRevision(bad.scene,fixed.scene,bad.validation.issues).accepted).toBe(true);
  fixed.scene.objects[0].material.color='#ffffff';expect(assessV3ObjectiveRevision(bad.scene,fixed.scene,bad.validation.issues).accepted).toBe(false);
 }
 const valid=curvedFixture('circular-pavilion'),composition=structuredClone(valid.objects[0].composition!);composition.footprint!.segments![0].radius=30;
 expect(executeV3SceneOperations(valid,{intent:'Invalid curve',operations:[{op:'setComposition',target:'residence',composition}]}).ok).toBe(false);
});
test('invalid outlines can be corrected locally but cannot become boxes or lose segment identities',()=>{
 const raw=curvedFixture('circular-pavilion');raw.objects[0].composition!.footprint!.segments![0].radius=30;
 const bad=ingestV3GenerationOutput(raw,'flat'),fixed=ingestV3GenerationOutput(curvedFixture('circular-pavilion'),'flat');
 expect(bad.ok).toBe(false);expect(assessV3ObjectiveRevision(bad.scene,fixed.scene,bad.validation.issues).accepted).toBe(true);
 delete fixed.scene.objects[0].composition!.footprint;
 expect(assessV3ObjectiveRevision(bad.scene,fixed.scene,bad.validation.issues).accepted).toBe(false);
});
test('actual curved occupancy prevents envelope false positives and blocks unsupported mass intersections',()=>{
 const s=curvedFixture('circular-pavilion'),a=s.objects[0];
 const b=materializeV3ArchitecturalObject({...a,id:'other',composition:{openings:[]},architecture:{x:10,z:10,width:3,depth:3,height:4,baseElevation:.15}});
 expect(authoredOverlap(a,b)).toBe(0);s.objects.push(b);expect(ingestV3GenerationOutput(s,'flat').ok).toBe(true);
 b.architecture!.x=0;b.architecture!.z=0;s.objects[1]=materializeV3ArchitecturalObject(b);
 expect(ingestV3GenerationOutput(s,'flat').validation.issues.map(i=>i.code)).toContain('CURVED_MASS_INTERSECTION_UNSUPPORTED');
 expect(planArea(authoredPlan(a))).toBeCloseTo(Math.PI*64,0);
});
test('Terra receives a coherent curved contract and named geometry cannot silently become generic volume',()=>{
 expect(v3SceneArchitectPrompt('flat')).not.toContain('Circular/curved buildings, arbitrary polygon outlines');
 const raw=readinessProvider('circular-luxury');delete (raw.objects[0] as {type?:string}).type;
 const ingested=ingestV3GenerationOutput(raw,'flat');expect(ingested.ok).toBe(true);expect(ingested.scene.objects[0].type).toBe('building-mass');
});
test('inferred hosted roofs are checked using the same effective support as rendering',()=>{
 const s=curvedFixture('circular-pavilion'),host=s.objects[0];
 s.objects.push(materializeV3ArchitecturalObject({...host,id:'detached-roof-record',type:'roof-form',composition:undefined,roofForm:'hip',architecture:{...host.architecture!,height:.3,baseElevation:4.35}}));
 const result=ingestV3GenerationOutput(s,'flat');expect(result.ok).toBe(false);expect(result.validation.issues.map(i=>i.code)).toContain('ROOF_FOOTPRINT_UNSUPPORTED');
});
test('estate checks measure real curved area and allocation, and report generic amenities honestly',()=>{
 const s=readinessFixture('circular-luxury');s.estatePlan!.zones=[{id:'round-zone',purpose:'Actual circular house envelope',objectIds:['residence'],allocation:{x:0,z:0,width:17,depth:17}}];
 s.estatePlan!.requirements=[{id:'round-area',source:'user',metric:'floorArea',statement:'Approximately 201 square metres',range:{min:200,max:202},objectIds:['residence']}];
 expect(auditV3EstatePlan(s).filter(d=>['ESTATE_ALLOCATION_CONFLICT','ESTATE_REQUIREMENT_CONFLICT'].includes(d.code))).toEqual([]);
 const p=materializeV3ArchitecturalObject({...s.objects[0],id:'fountain',type:'slab',label:'Fountain',composition:undefined,architecture:{x:20,z:0,width:2,depth:2,height:.3,baseElevation:0}});s.objects.push(p);
 s.estatePlan!.program.push({id:'water-program',role:'Fountain',kind:'amenity',source:'design',objectIds:['fountain']});
 expect(auditV3EstatePlan(s).map(d=>d.code)).toContain('ESTATE_AMENITY_UNVERIFIED');
});
test('unclosed, self-intersecting, invalid and over-sampled outlines fail without a rectangular fallback',()=>{
 for(const segments of [
  [{id:'rotunda',type:'arc',center:[0,0],radius:8,startAngle:0,sweep:180}],
  [{id:'rotunda',type:'arc',center:[0,0],radius:10000,startAngle:0,sweep:360}],
  [{id:'rotunda',type:'arc',center:[0,0],radius:0,startAngle:0,sweep:360}],
  [{id:'a',type:'line',start:[-5,-5],end:[5,5]},{id:'b',type:'line',start:[5,5],end:[5,-5]},{id:'c',type:'line',start:[5,-5],end:[-5,5]},{id:'d',type:'line',start:[-5,5],end:[-5,-5]}],
 ]){
  const s=curvedFixture('circular-pavilion');Object.assign(s.objects[0].composition!.footprint!,{segments});
  const result=ingestV3GenerationOutput(s,'flat');expect(result.ok).toBe(false);expect(result.validation.issues.map(i=>i.code)).toContain('FOOTPRINT_INVALID');
  expect(compileV3Scene(result.scene).primitives.some(p=>p.sourceObjectId==='residence')).toBe(false);
 }
});
test('flat normalized estate paths meet real circular doors and avoid empty envelope space',()=>{
 const s=readinessFixture('circular-luxury'),host=s.objects[0];
 const make=(id:string,type:string,z:number,width:number,depth:number)=>materializeV3ArchitecturalObject({...host,id,type,composition:undefined,architecture:{x:0,z,width,depth,height:.1,baseElevation:0}});
 s.objects.push(make('entry-garden','landscape-zone',-16,4,4),make('arrival-path','path',-11,2,6));
 s.estatePlan!.circulation=[{id:'entry-route',purpose:'Arrival',from:'entry-garden',to:'residence',via:['arrival-path'],spatial:{from:{point:[0,0,-14]},to:{point:[0,0,-8],openingId:'entry'},width:1.5,use:'pedestrian'}}];
 const valid=ingestV3GenerationOutput(s,'flat');expect(valid.ok,JSON.stringify(valid.validation.errors)).toBe(true);
 expect(compileV3Scene(valid.scene).primitives.some(p=>p.id.includes('v3-connection-estate:'))).toBe(true);
 s.estatePlan!.circulation[0].spatial!.to.point=[0,0,-11];
 expect(ingestV3GenerationOutput(s,'flat').validation.issues.map(i=>i.code)).toContain('ESTATE_ACCESS_POINT_MISSING');
});
test('requested storeys cannot silently disappear under the deterministic height clamp',()=>{
 const s=curvedFixture('circular-pavilion');s.objects[0].levels=3;
 const result=ingestV3GenerationOutput(s,'flat');expect(result.ok).toBe(false);expect(result.validation.issues.map(i=>i.code)).toContain('LEVEL_COUNT_APPROXIMATED');
});
test('double-height intent survives normalization, and invalid windows are retained for rejection',()=>{
 const s=curvedFixture('circular-pavilion');s.objects[0].composition!.spaceHeight='double-height';
 const valid=ingestV3GenerationOutput(s,'flat');expect(valid.scene.objects[0].composition?.spaceHeight).toBe('double-height');
 const op=s.objects[0].composition!.openings![1];if('start' in op)op.start=1.2;
 const bad=ingestV3GenerationOutput(s,'flat');expect(bad.ok).toBe(false);expect(bad.scene.objects[0].composition!.openings!.map(o=>o.id)).toContain('view');
});
test('a failed roof preview retains its authored curve instead of displaying a rectangular mansion',async()=>{
 const {recoverV3FailedPreview}=await import('../failedPreview');const s=curvedFixture('circular-pavilion');s.objects[0].roofForm='hip';
 const preview=recoverV3FailedPreview(s,['ROOF_FOOTPRINT_UNSUPPORTED'],'flat');
 expect(preview?.scene.objects[0].composition?.footprint).toEqual(s.objects[0].composition!.footprint);
 expect(compileV3Scene(preview!.scene).primitives.filter(p=>p.sourceObjectId==='residence'&&p.category==='roof')).toEqual([]);
});
test('an explicit cylinder building cannot pass as a rectangular shell without semantic geometry',()=>{
 const s=curvedFixture('circular-pavilion');delete s.objects[0].composition!.footprint;s.objects[0].geometryKind='cylinder';
 expect(ingestV3GenerationOutput(s,'flat').validation.issues.map(i=>i.code)).toContain('BUILDING_FORM_UNBUILT');
});
