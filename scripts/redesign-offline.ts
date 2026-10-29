/** Offline evidence only: transplant retained authored studies, never generate a house. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {validateScene,type ArchitecturalScene,type SceneOperation} from '../src/lib/villa/scene/model';
import {resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {developmentRequest} from '../src/lib/villa/scene/twoStage';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const dir='docs/villa-playground/redesign-audit';mkdirSync(dir,{recursive:true});
const load=(p:string)=>validateScene(JSON.parse(readFileSync(p,'utf8')));
const before=load('docs/villa-playground/property-value-development/before.json');
function prove(name:string,current:ArchitecturalScene,operations:SceneOperation[],intent:string){
 const snapshot=JSON.stringify(current);
 const input=developmentRequest(current,intent,{intent:'redesign'});
 const result=resolveSceneResult(input,{name:current.name,summary:intent,unsupported:['Offline authored study, not model output. Vertical access, room allocation, engineering and architectural completeness remain unverified.'],operations});
 assert.deepEqual(sceneRelationshipIssues(result.scene),[]);
 assert.equal(JSON.stringify(current),snapshot);
 assert.equal(JSON.stringify(validateScene(JSON.parse(JSON.stringify(result.scene)))),JSON.stringify(result.scene));
 const touched=new Set(operations.flatMap(op=>'id'in op?[op.id]:op.op==='add'?[op.element.id]:[]));
 const retained=current.elements.filter(e=>!touched.has(e.id));
 retained.forEach(e=>assert.deepEqual(result.scene.elements.find(a=>a.id===e.id),e));
 const bad=[...operations,{op:'move',id:result.scene.elements.find(e=>e.kind==='plate')!.id,at:[99,80,99]}];
 let recovered=false;
 try{resolveSceneResult(input,{name:'bad',summary:'invalid support',unsupported:[],operations:bad});}
 catch(e){assert(e instanceof SceneConstructionError);validateScene(e.recoverableDraft);assert(sceneRelationshipIssues(e.recoverableDraft).length);recovered=true;}
 assert(recovered);assert.equal(JSON.stringify(current),snapshot);
 for(const [key,value] of Object.entries({before:current,after:result.scene,operations,request:input,audit:{providerCalls:0,operations:operations.length,beforeElements:current.elements.length,afterElements:result.scene.elements.length,retainedUnchangedIds:retained.map(e=>e.id),beforeIssues:sceneRelationshipIssues(current),afterIssues:sceneRelationshipIssues(result.scene),atomicFailure:true,recoveryDraft:true,serialization:true}}))writeFileSync(`${dir}/${name}.${key}.json`,JSON.stringify(value,null,2));
}
// Relocate the entire occupied upper suite, including floor, enclosure, roof and child door.
const suite=before.elements.filter(e=>e.id.startsWith('west-upper-'));
const eastSlab = {...before.elements.find(e=>e.id==='west-wing-roof')!, id:'east-wing-roof',at:[13,3.7,-1] as [number,number,number]};
prove('relocated-suite',before,[{op:'replace',id:'east-wing-roof',element:eastSlab},...suite.filter(e=>!e.parent).map(e=>({op:'move',id:e.id,at:[e.at[0]+26,e.at[1],e.at[2]]} as SceneOperation)),], 'Relocate the upper private suite from west to east, changing the main-house balance while retaining the salon and site.');
// Recompose the retained main residence using an independently authored, stronger study.
// This is test input, not a runtime template or automatic redesign algorithm.
for(const [name,path] of [['study','docs/villa-playground/terra-basic-diagnosis/study.scene.json'],['developed-study','docs/villa-playground/two-stage/study.after.json']]){
 const study=load(path);
 const keep=before.elements.filter(e=>/^(pool|ocean-|terrace-|screen-)/.test(e.id));
 const map:Record<string,string>={'grand-salon-0-floor':'salon-floor','grand-salon-1-roof':'salon-roof','east-residence-0-floor':'west-wing-floor','west-residence-0-floor':'east-wing-floor'};
 const architecture=study.elements.filter(e=>!/^(pool$|coping-|sea-terrace$|loggia-|colonnade-)/.test(e.id)).map(e=>({...e,id:map[e.id]??e.id,parent:e.parent?(map[e.parent]??e.parent):undefined,...(!e.parent?{at:[-e.at[0],e.at[1],-e.at[2]] as [number,number,number],rotation:e.rotation+Math.PI}:{})}));
 const target=[...keep,...architecture];const ids=new Set(target.map(e=>e.id));
 const removals=before.elements.filter(e=>!ids.has(e.id)).sort((a,b)=>Number(!!b.parent)-Number(!!a.parent));
 const operations:SceneOperation[]=[...removals.map(e=>({op:'remove' as const,id:e.id})),...architecture.map(element=>before.elements.some(e=>e.id===element.id)?{op:'replace' as const,id:element.id,element}:{op:'add' as const,element})];
 prove(name,before,operations,'Replace the inadequate main-house composition with the retained multi-level architectural study; retain pool, pavilion and outdoor-room geometry.');
}
console.log('Three offline redesign transactions passed; zero provider calls.');
