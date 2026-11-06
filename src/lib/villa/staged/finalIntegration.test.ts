import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {advancePromptRun,type PromptRun} from './promptGeneration';
import {retainedMassingDownstream} from './normalization.fixture';
import {compileHouse} from './compile';
import {featureAudit} from './featureAudit';
import {intentionFindings,outdoorIntentions} from './intentions';
import {validateMassing,validateInterior,validateExterior,validateSite,relationshipFindings} from './validate';
import {loadHouse} from './save';
import {LiveDesigner} from './liveDesigner';
import {allRooms} from './layout';
import {poolReservation} from './poolGeometry';
const e=JSON.parse(readFileSync('docs/architecture/automatic-house/first-automatic-live/evidence.json','utf8'));
async function replay(failStage?:4|5){
 const run:PromptRun={input:e.run.source.input};let out;
 const designer={label:'OFFLINE retained Terra 1–2 plus authored mock 3–5',design:async(stage:1|2|3|4|5,ctx:Parameters<typeof retainedMassingDownstream>[1])=>{
  const value=stage<=2?JSON.parse(e.calls[stage-1].raw):retainedMassingDownstream(stage,ctx);
  if(stage===failStage&&stage===4)(value as {exterior:{verandas:unknown[]}}).exterior.verandas=[];
  if(stage===failStage&&stage===5)delete (value as {siteWork:{pool:{sourceIntent?:string}}}).siteWork.pool!.sourceIntent;
  return {value,raw:stage<=2?e.calls[stage-1].raw:JSON.stringify(value)};
 },correct:async()=>{throw Error('No retries');}};
 for(let stage=1;stage<=5;stage++){out=await advancePromptRun(run,designer);if(out.status==='failed')break;}
 return {run,out:out!};
}
it('audits the old 91-element scene as geometrically valid but semantically incomplete',()=>{
 const old=loadHouse(readFileSync('docs/architecture/automatic-house/identifier-normalization/completed-mock-downstream.save.json','utf8'));
 expect(old.scene.elements).toHaveLength(91);expect(validateMassing(old.spec)).toEqual([]);expect(validateInterior(old.spec,3,2)).toEqual([]);expect(validateExterior(old.spec)).toEqual([]);expect(validateSite(old.spec)).toEqual([]);
 expect(intentionFindings(old.spec,5).some(f=>f.subject==='garden-pool')).toBe(true);
 expect(featureAudit(old.spec,old.scene,old.components,5,e.run.source.input.brief).findings.some(f=>f.subject==='planting')).toBe(true);
 expect(old.scene.elements.some(x=>x.id==='open-garden-pool')).toBe(true);expect(old.scene.elements.filter(x=>x.kind==='water')).toHaveLength(1);
});
it('constructs exactly one bound pool and preserves all rooms, terraces and covered outdoor intentions',async()=>{
 const {run,out}=await replay();expect(out.status,JSON.stringify(out.findings)).toBe('complete');const h=loadHouse(out.save!);
 expect(h.scene.elements).toHaveLength(90); // scale-1: veranda columns and beams are grouped components (was 93 single pieces)
 expect(h.spec.construction).toBe('scale-1');expect(h.spec.siteWork.pool!.sourceIntent).toBe('garden-pool');expect(h.spec.siteWork.pool!.intentResolution).toContain('5 × 5');
 expect(h.scene.elements.filter(x=>x.kind==='water')).toHaveLength(1);expect(h.scene.elements.some(x=>x.id==='open-garden-pool')).toBe(false);
 expect(h.scene.elements.find(x=>x.kind==='water')!.aliases).toContain('garden-pool');
 expect(h.scene.elements.some(x=>x.id==='open-limestone-terrace')).toBe(true);expect(h.scene.elements.some(x=>x.id==='veranda-garden-veranda-roof')).toBe(true);
 const a=featureAudit(h.spec,h.scene,h.components,5,e.run.source.input.brief);expect(a.findings).toEqual([]);expect(a.inventory).toMatchObject({bedrooms:3,bathrooms:2,kitchens:1,circulation:2,waterSurfaces:1,trees:1,plantingBeds:1});
 expect(relationshipFindings(h.scene,5)).toEqual([]);
 expect(h.spec.blocks.map(b=>[b.id,b.plan])).toEqual(run.result!.checkpoints[2].spec.blocks.map(b=>[b.id,b.plan]));
 expect(h.spec.openSpaces).toEqual(run.result!.checkpoints[1].spec.openSpaces);
 for(const cp of run.result!.checkpoints.filter(c=>c.stage>=2&&c.stage<5))expect(cp.scene!.elements.filter(x=>x.kind==='water')).toHaveLength(0);
});
for(const stage of [4,5] as const)it(`stops and preserves checkpoint ${stage-1} if a retained intention is omitted at stage ${stage}`,async()=>{
 const {run,out}=await replay(stage);expect(out.status).toBe('failed');expect(out.stage).toBe(stage-1);expect(out.findings.some(f=>f.code==='unresolved-architectural-intent')).toBe(true);
 expect(out.scene).toBe(run.result!.lastGood!.scene);expect(run.result!.calls).toHaveLength(stage);
});
it('detects silent compiler feature loss and missing declared rooms independently of geometry syntax',async()=>{
 const {out}=await replay();const h=loadHouse(out.save!);
 for(const predicate of [(id:string)=>id!=='roof-social-main',(id:string)=>id!=='open-limestone-terrace',(id:string)=>id!=='veranda-garden-veranda-roof',(id:string)=>id!=='pool-water',(id:string)=>id!=='bed-aromatic-bed',(id:string)=>!id.startsWith('tree-sculptural-tree'),(id:string)=>id!=='slab-social-main',(id:string)=>id!=='pool-wall-x-plus']){
  const scene={...h.scene,elements:h.scene.elements.filter(x=>predicate(x.id))};
  expect(featureAudit(h.spec,scene,h.components,5,e.run.source.input.brief).findings.length).toBeGreaterThan(0);
 }
 const missingKitchen=structuredClone(h.spec);const change=(p:typeof missingKitchen.blocks[number]['plan']):void=>{if('room'in p){if(p.room.type==='kitchen')p.room.type='hall';}else{change(p.a);change(p.b);}};missingKitchen.blocks.forEach(b=>change(b.plan));
 const built=compileHouse(missingKitchen,5);expect(featureAudit(missingKitchen,built.scene,built.components,5,e.run.source.input.brief).findings.some(f=>f.subject==='kitchen')).toBe(true);
});
it('passes complete retained intent, geometry, room and spatial context into all downstream provider requests',async()=>{
 const {run}=await replay(),designer=new LiveDesigner();
 for(const stage of [3,4,5] as const){
  const prior=run.result!.checkpoints.filter(c=>c.stage<stage),draft=prior.at(-1)!.spec;
  const request=designer.request(stage,{brief:e.run.source.input.brief,site:draft.site,draft,checkpoints:prior,requiredBedrooms:3,requiredBaths:2});
  for(const text of stage===3?['garden-pool','Modest rectangular swimming pool','social-main','24 x 9','BLOCK ADJACENCY','RETAINED OUTDOOR INTENTIONS']:stage===4?['garden-pool','Modest rectangular swimming pool','social-main','24 x 9','OPEN SPACES (fixed, not rooms)','pool;']:['garden-pool','Modest rectangular swimming pool','RETAINED POOL INTENTION','MEASURED POOL FIT'])expect(request.prompt).toContain(text);
  expect(outdoorIntentions(draft).find(i=>i.id==='limestone-terrace')!.kind).toBe('terrace');
  if(stage===4){expect(request.prompt).toContain('entry-foyer');expect(request.prompt).toContain('EXTERIOR WALLS (measured)');expect(request.prompt).toContain('ROOMS (solved, authoritative)');}
  // Stage 5 receives measured feasibility of the retained pool reservation, never coordinates to author.
  if(stage===5){expect(request.system).toContain('pool-intention');expect(request.prompt).toMatch(/pool-intention \(pool intention garden-pool, garden side s\)/);}
 }
});
it('requires an explicit measured resolution when the pool/deck cannot fit the conceptual pad',async()=>{
 const {out}=await replay();const h=loadHouse(out.save!);delete h.spec.siteWork.pool!.intentResolution;
 expect(intentionFindings(h.spec,5).some(f=>f.message.includes('intentResolution'))).toBe(true);
 const original=h.spec.openSpaces.find(o=>o.id==='garden-pool')!,actual=poolReservation(h.spec.siteWork.pool!);
 expect(original.w).toBe(5);expect(actual.x1-actual.x0).toBeCloseTo(8.2);
 expect(allRooms(h.spec).filter(r=>r.type==='bedroom')).toHaveLength(3);
});
