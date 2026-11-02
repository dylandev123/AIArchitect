import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {resolveSceneResult,SceneConstructionError} from './terra';
import {applySceneOperations,validateScene} from './model';
import {auditArchitecturalPlan,reviewSceneArchitecture} from './planning';
import {sceneRelationshipIssues} from './relationships';
const retained=JSON.parse(readFileSync('.data/scene-responses/437d25b1-ff69-462c-ab34-a8deb7861c67.json','utf8'));
it('reproduces all nine original errors and recovers exact geometry without a provider',()=>{
 const result=resolveSceneResult(retained.input,retained.output);
 const original=auditArchitecturalPlan(result.scene,retained.output.architecturalPlan);
 expect('Error: Architectural plan incomplete: '+original.issues.join(' ')).toBe(retained.error);
 expect(original.issues).toHaveLength(9);
 expect(sceneRelationshipIssues(result.scene)).toEqual([]);
 expect(result.scene.elements).toHaveLength(50);
 const withoutPlan=resolveSceneResult(retained.input,{...retained.output,architecturalPlan:undefined});
 expect(result.scene.elements).toEqual(withoutPlan.scene.elements);
 expect(result.architecturalAudit.geometry.waterSurfaceAreaM2).toBe(84);
 expect(result.architecturalAudit.issues.join(' ')).toContain('basin bottom');
 expect(result.architecturalAudit.issues.join(' ')).toContain('panel centre');
 expect(validateScene(JSON.parse(JSON.stringify(result.scene)))).toEqual(result.scene);
});
it('missing, malformed and wrong classifications never veto valid geometry',()=>{
 for(const architecturalPlan of [undefined,{bad:'metadata'},{...retained.output.architecturalPlan,levels:8,enclosedAreaM2:1}]) {
  const result=resolveSceneResult(retained.input,{...retained.output,architecturalPlan});
  expect(result.scene.elements).toHaveLength(50);expect(result.architecturalAudit.status).toBe('incomplete');
 }
});
it('invalid support fails atomically and retains a schema-valid recoverable draft',()=>{
 const base=resolveSceneResult(retained.input,retained.output).scene,before=JSON.stringify(base);
 const operations=[{op:'move',id:'terrace-south',at:[100,30,100]}];
 expect(()=>applySceneOperations(base,operations)).toThrow('needs contact');
 try {resolveSceneResult({mode:'edit',prompt:'Move terrace-south',current:base},{name:base.name,summary:'Invalid',unsupported:[],operations});throw Error('Expected rejection');}
 catch(error){expect(error).toBeInstanceOf(SceneConstructionError);expect(validateScene((error as SceneConstructionError).recoverableDraft).elements.find(e=>e.id==='terrace-south')?.at).toEqual([100,30,100]);}
 expect(JSON.stringify(base)).toBe(before);
});
it('overlapping physical floors withhold summed usable area independent of intent',()=>{
 const scene=resolveSceneResult(retained.input,retained.output).scene;
 const floor=scene.elements[0];scene.elements.push({...floor,id:'duplicate-floor'});
 const review=reviewSceneArchitecture(scene);expect(review.geometry.plateSurfaceAreaM2).toBeNull();expect(review.issues.join(' ')).toContain('overlap');
});
it('reads legacy lean intents while new provider intents require programme commitments',async()=>{
 const {sceneProviderOutputSchema}=await import('./terra');
 const plan=retained.output.architecturalPlan;
 const architecturalPlan={scaleRationale:plan.scaleRationale,arrivalAndCirculation:plan.arrivalAndCirculation,volumeHierarchy:plan.volumeHierarchy,relationshipsAndViews:plan.relationshipsAndViews,roofFacadeAndMaterials:plan.roofFacadeAndMaterials,intendedSpaces:['Primary suite','Pool court']};
 expect(sceneProviderOutputSchema(retained.input).safeParse({...retained.output,architecturalPlan}).success).toBe(false);
 const result=resolveSceneResult(retained.input,{...retained.output,architecturalPlan});
 expect(result.scene.elements).toHaveLength(50);expect(result.architecturalAudit.geometry.waterSurfaceAreaM2).toBe(84);expect(result.architecturalAudit.issues.join(' ')).toContain('completeness require review');
});
