import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {elementSchema,validateScene,type ArchitecturalScene} from './model';
import {generationQualityFindings} from './generationQuality';
import {architecturalReferenceDependencies,refinementConstructionContext} from './visualEvidence';
import {generationReviewProviderSchema,generationReviewSchema} from './generationReview';

it.each([0,.73,Math.PI/2])('finds independent nested flat-roof penetration at yaw %s, allows touching and separation',rotation=>{
 const frame=elementSchema.parse({id:'frame',kind:'plate',label:'frame',at:[18,0,9],size:[1,.1,1],rotation});
 const a=elementSchema.parse({id:'roof-a',kind:'roof',label:'a',parent:'frame',at:[0,3.43,0],size:[12,.16,8]});
 const b=elementSchema.parse({id:'roof-b',kind:'roof',label:'b',parent:'frame',at:[0,3.3,-5.35],size:[8,.18,4]});
 const scene:ArchitecturalScene={version:'architectural-scene-1',name:'Roof test',elements:[frame,a,b]};
 const bytes=JSON.stringify(scene);
 expect(generationQualityFindings(scene).find(f=>f.code==='flat-roof-junction-review')?.message).toContain('0.04 m');
 expect(JSON.stringify(scene)).toBe(bytes);
 for(const at of [[0,3.26,-5.35],[0,3.3,-7]] as [number,number,number][]){
  expect(generationQualityFindings({...scene,elements:[frame,a,{...b,at}]}).some(f=>f.code==='flat-roof-junction-review')).toBe(false);
 }
 expect(generationQualityFindings({...scene,elements:[frame,a,{...b,roofForm:'gable'}]}).some(f=>f.code==='flat-roof-junction-review')).toBe(false);
});
it('exposes retained dependencies and accurate datums without remapping original evidence',()=>{
 const scene=validateScene(JSON.parse(readFileSync('docs/architecture/retained-visual-review/original.scene.json','utf8')));
 const bytes=JSON.stringify(scene),refs=architecturalReferenceDependencies(scene);
 expect(refs.some(r=>r.elementId==='garden-door'&&r.path.includes('.accessIds['))).toBe(true);
 expect(refs.some(r=>r.path.includes('.spatialRelationships['))).toBe(true);
 expect(refs.some(r=>r.path.includes('.designDecisions['))).toBe(true);
 const context=refinementConstructionContext(scene,['main-floor','garden-door']);
 expect(context.targets.find(e=>e.id==='main-floor')?.renderedTop).toBeCloseTo(.15);
 expect(context.preservedReferences.every(r=>['main-floor','garden-door'].includes(r.elementId))).toBe(true);
 expect(JSON.stringify(scene)).toBe(bytes);
});
it('requires an architectural selection explanation for newly requested reviews, reads historical reviews',()=>{
 const review=JSON.parse(readFileSync('docs/architecture/retained-visual-review/refine.input.json','utf8')).review;
 expect(generationReviewSchema.safeParse(review).success).toBe(true);
 const provider=generationReviewProviderSchema;
 expect(provider.safeParse(review).success).toBe(false);
 expect(provider.safeParse({...review,selectionReason:'A local rear facade change leaves the major roof hierarchy unresolved; a coordinated roof revision needs broader dependencies.'}).success).toBe(true);
});
