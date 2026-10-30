import {expect,it} from 'vitest';
import {elementSchema,type ArchitecturalScene} from './model';
import {generationQualityFindings} from './generationQuality';
import {exteriorStudy} from './exteriorFirst.fixture';
import {sceneSystemPrompt,sceneProviderOutputSchema,sceneRuntimeOutputSchema} from './terra';
import {laderaPlan} from './planning.fixture';

it.each([0,.73,Math.PI/2])('detects an applied root door against a nested rotated solid wall (%s)',rotation=>{
 const scene:ArchitecturalScene={version:'architectural-scene-1',name:'Blocked arrival',elements:[
  elementSchema.parse({id:'frame',label:'frame',kind:'plate',at:[10,.1,5],rotation,size:[8,.2,8]}),
  elementSchema.parse({id:'wall',label:'wall',kind:'wall',parent:'frame',at:[0,1.6,0],size:[6,3,.25]}),
  elementSchema.parse({id:'door',label:'door',kind:'entrance',at:[10,1.4,5],rotation,size:[1.4,2.4,.1]}),
 ]};
 expect(generationQualityFindings(scene).map(f=>f.code)).toEqual(['entrance-solid-wall']);
 scene.elements[1].opening={x:0,sill:0,width:1.4,height:2.4,glazed:false};
 expect(generationQualityFindings(scene)).toEqual([]);
 scene.elements[1].opening.glazed=true;
 expect(generationQualityFindings(scene)[0].code).toBe('entrance-solid-wall');
 scene.elements[2].at[0]+=20;
 expect(generationQualityFindings(scene)).toEqual([]);
});
it('finds identical world-space parts across parent frames without mutating the scene',()=>{
 const {scene}=exteriorStudy(false);
 const original=JSON.stringify(scene);
 expect(generationQualityFindings(scene)).toEqual([]);
 const slab=scene.elements.find(e=>e.id==='main-floor')!;
 const duplicate=elementSchema.parse({...slab,id:'duplicate',parent:slab.id,at:[0,0,0]});
 const findings=generationQualityFindings({...scene,elements:[...scene.elements,duplicate]});
 expect(findings.find(f=>f.code==='duplicate-rendered-part')?.elementIds).toEqual(['main-floor','duplicate']);
 expect(JSON.stringify(scene)).toBe(original);
 expect(generationQualityFindings({...scene,elements:[...scene.elements,{...duplicate,at:[0,.3,0]}]})).toEqual([]);
});
it('keeps numeric design and four-view checks in Generate without expanding targeted edits',()=>{
 const generation=sceneSystemPrompt({mode:'generate',prompt:'A compact modern house on a narrow lot'});
 for(const text of ['slab TOP datums','ELEVATIONS BEFORE ORNAMENT','FINAL FOUR-VIEW SELF-CHECK','No editable planting/tree kind','400 elements'])expect(generation).toContain(text);
 const {scene}=exteriorStudy(false);
 expect(sceneSystemPrompt({mode:'edit',prompt:'Make the roof timber',current:scene})).not.toContain('FINAL FOUR-VIEW SELF-CHECK');
});
it('requires programme evidence for new provider generation while retaining historical plan readability',()=>{
 const input={mode:'generate' as const,prompt:'A house'};
 const output={name:'Legacy',summary:'Historical plan',unsupported:[],operations:[],architecturalPlan:laderaPlan};
 expect(sceneProviderOutputSchema(input).safeParse(output).success).toBe(false);
 expect(sceneRuntimeOutputSchema(input).safeParse(output).success).toBe(true);
});
