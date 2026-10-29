// Deterministic authored experiment, not a model-quality evaluation. No provider imports/calls.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {validateScene,type ArchitecturalScene,type SceneOperation,type SceneElement} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {developmentRequest,compositionRequest} from '../src/lib/villa/scene/twoStage';
import {retrieveArchitecturalKnowledge} from '../src/lib/library/architecture/retrieval';
import {ARCHITECTURAL_KNOWLEDGE_SEEDS} from '../src/lib/library/architecture/seeds';
const dir='docs/villa-playground/two-stage';mkdirSync(dir,{recursive:true});
const retained=JSON.parse(readFileSync('.data/scene-responses/eb6a91b2-dc5d-497b-9296-8fa53f612978.json','utf8'));
const original=resolveSceneResult(retained.input,retained.output).scene;
let ops:SceneOperation[]=[];
function add(id:string,kind:SceneElement['kind'],at:number[],size:number[],extra:object={}){ops.push({op:'add',element:{id,label:id,kind,at,size,rotation:0,material:'ivory',panels:4,...extra} as SceneElement});}
// Composition revision: preserve the ground-floor programme and outdoor estate.
// The west wing becomes an inhabited two-storey anchor; east stays subordinate.
ops.push({op:'replace',id:'west-wing-roof',element:{...original.elements.find(e=>e.id==='west-wing-roof')!,kind:'plate',roofForm:undefined,overhang:undefined,at:[-13,3.7,-1],size:[10,.3,10],material:'limestone'}});
add('west-upper-floor','plate',[-13,3.92,-2],[8,.14,8],{material:'limestone'});
for(const [id,at,size,rotation] of [
 ['west-upper-land',[-13,5.8,-6],[8,3.6,.3],0],['west-upper-sea',[-13,5.8,2],[8,3.6,.3],0],
 ['west-upper-outer',[-17,5.8,-2],[8,3.6,.3],Math.PI/2],['west-upper-inner',[-9,5.8,-2],[8,3.6,.3],Math.PI/2],
] as const)add(id,'wall',[...at],[...size],{rotation});
add('west-upper-roof','roof',[-13,7.75,-2],[9,.3,9]);
// Complete the tall salon landward enclosure above its low entrance wall.
add('salon-entry-clerestory','wall',[0,4.1,-6],[16,1,.25],{opening:{x:0,sill:.15,width:14,height:.7,glazed:true},panels:8});
for(const x of [-8,8])add(`salon-side-clerestory-${x<0?'west':'east'}`,'wall',[x,4.1,0],[12,1,.25],{rotation:Math.PI/2,opening:{x:0,sill:.15,width:10.5,height:.7,glazed:true},panels:6});
const revisedPlan={...original.architecturalPlan as object,scaleRationale:'Offline composition revision: retain the ground-floor residence and add a recessed 64 m² upper west suite. Budget adequacy and full programme remain unproven.',volumeHierarchy:'Two-storey recessed west anchor, intermediate tall salon, low east wing and shaded sea veranda. Distinct heights and setbacks replace equal lateral bars.',roofFacadeAndMaterials:'Coordinated stepped flat roofs; west lower roof becomes terrace slab. Upper suite has its own smaller cap.',designDecisions:[]};
const composition=resolveSceneResult({mode:'edit',current:original,prompt:'Offline composition revision'},{name:original.name,summary:'Recompose the main residence',architecturalPlan:revisedPlan,unsupported:['Upper-suite stair unresolved'],operations:ops}).scene;const compositionOps=ops;ops=[];
// Development reworks architecture on the actual composition, including bay depth.
function bays(scene:ArchitecturalScene,id:string,count:number){
 const host=scene.elements.find(e=>e.id===id)!;const width=host.size[0]/count;
 for(let i=0;i<count;i++){
 const offset=-host.size[0]/2+(i+.5)*width;
 const e={...host,id:i===0?id:`${id}-bay-${i}`,at:[host.at[0]+Math.cos(host.rotation)*offset,host.at[1],host.at[2]-Math.sin(host.rotation)*offset] as [number,number,number],size:[width,host.size[1],host.size[2]] as [number,number,number],opening:{x:0,sill:.45,width:width-.8,height:host.size[1]-1,glazed:true},panels:2};
 ops.push(i===0?{op:'replace',id,element:e}:{op:'add',element:e});
 }
}
for(const id of ['west-rear-wall','east-rear-wall','west-front-wall','east-front-wall','west-outer-wall','east-outer-wall'])bays(composition,id,3);
for(const id of ['west-upper-land','west-upper-sea','west-upper-outer','west-upper-inner'])bays(composition,id,2);
// West sea terrace is the exposed portion of the existing roof slab.
add('west-upper-terrace-rail','balcony',[-13,4.4,3.8],[9.4,1.1,.12]);
// Replace upper seaward window with a usable doorway and a solid door child.
const sea=ops.find(o=>o.op==='replace'&&o.id==='west-upper-sea') as Extract<SceneOperation,{op:'replace'}>;
sea.element.opening={x:0,sill:0,width:2.5,height:2.8,glazed:false};
add('west-upper-terrace-door','entrance',[0,-.4,0],[2.5,2.8,.12],{parent:'west-upper-sea',material:'bronze'});
for(const x of [-2.5,2.5])add(`entry-portal-${x<0?'west':'east'}`,'volume',[x,2.3,-6.35],[.55,4.2,.8],{material:'limestone'});
add('entry-portal-head','volume',[0,4.25,-6.35],[5.55,.3,.8],{material:'limestone'});
// Material hierarchy and thin roof edges, instead of another full roof layer.
ops.push({op:'finish',id:'west-upper-land',material:'limestone'},{op:'resize',id:'east-wing-roof',size:[10.4,.22,10.4]},{op:'finish',id:'east-wing-roof',material:'ivory'},{op:'resize',id:'salon-roof',size:[16.6,.22,12.8]},{op:'move',id:'salon-roof',at:[0,4.71,0]},{op:'finish',id:'salon-roof',material:'limestone'});
const devOps=ops;
async function proof(name:string,before:ArchitecturalScene,operations:SceneOperation[]){
 const request=developmentRequest(before,'Develop entrance portal, window rhythm, recessed facade bays, terrace doors and roof edges. Preserve unrelated elements.');
 const knowledge=retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,request.prompt,'edit');
 const result=resolveSceneResult(request,{name:before.name,summary:'Offline authored coordinated development',unsupported:['Upper private suite interior stair/access remains unresolved; not a complete navigable residence.'],operations},knowledge.evidence);
 const after=result.scene;
 const changed=new Set(operations.flatMap(o=>'id'in o?[o.id]:[]));
 for(const e of before.elements)if(!changed.has(e.id))assert.deepEqual(after.elements.find(a=>a.id===e.id),e);
 assert.equal(JSON.stringify(validateScene(JSON.parse(JSON.stringify(after)))),JSON.stringify(after));
 const snapshot=JSON.stringify(before);
 assert.throws(()=>resolveSceneResult(request,{name:'failed',summary:'invalid batch',unsupported:[],operations:[{op:'finish',id:before.elements[0].id,material:'bronze'},{op:'move',id:'missing-element',at:[0,0,0]}]}));
 assert.equal(JSON.stringify(before),snapshot);
 // Valid schema but unsupported slab yields recoverable draft, without mutation.
 let recovered=false;
 try{resolveSceneResult(request,{name:'bad-support',summary:'bad support',unsupported:[],operations:[{op:'add',element:{id:'unsupported-deck',label:'bad',kind:'plate',at:[90,40,90],size:[4,.2,4]}}]});}catch(e){assert(e instanceof SceneConstructionError);validateScene(e.recoverableDraft);recovered=true;}
 assert(recovered);assert.equal(JSON.stringify(before),snapshot);
 for(const [suffix,value] of Object.entries({before,after,operations,request,knowledge,audit:{beforeIssues:sceneRelationshipIssues(before),afterIssues:sceneRelationshipIssues(after),unchangedPreserved:true,persistenceRoundtrip:true,atomicFailure:true,recoverableDraft:true,providerCalls:0}}))writeFileSync(`${dir}/${name}.${suffix}.json`,JSON.stringify(value,null,2));
 return after;
}
writeFileSync(`${dir}/retained.original.json`,JSON.stringify(original,null,2));
writeFileSync(`${dir}/retained.composition-operations.json`,JSON.stringify(compositionOps,null,2));
writeFileSync(`${dir}/composition-request.json`,JSON.stringify(compositionRequest('$25m contemporary tropical waterfront main residence'),null,2));
await proof('retained',composition,devOps);
const study=validateScene(JSON.parse(readFileSync('docs/villa-playground/terra-basic-diagnosis/study.scene.json','utf8')));ops=[];
// Stronger baseline: differentiate the central salon and entry from repetitive wings.
ops.push({op:'resize',id:'grand-salon-1-roof',size:[15,.22,13]},{op:'finish',id:'portal-beam',material:'bronze'});
for(const x of [-4.2,4.2])add(`salon-arrival-pier-${x<0?'west':'east'}`,'volume',[x,4.3,3.4],[.5,8.2,.8],{material:'limestone'});
add('salon-arrival-crown','volume',[0,8.25,3.4],[8.9,.3,.8],{material:'limestone'});
const entryHost=study.elements.find(e=>e.id==='grand-salon-0-1-1-wall')!;
ops.push({op:'replace',id:entryHost.id,element:{...entryHost,opening:{...entryHost.opening!,glazed:false}}});
const entry=study.elements.find(e=>e.id==='entry-door')!;
ops.push({op:'replace',id:entry.id,element:{...entry,parent:entryHost.id,at:[0,-.125,0],size:[2.8,3.25,.18]}});
for(const x of [-5.5,5.5])add(`salon-sea-reveal-${x<0?'west':'east'}`,'volume',[x,4.3,-9.35],[.6,8.2,.85],{material:'limestone'});
add('salon-sea-crown','volume',[0,8.25,-9.35],[11.6,.3,.85],{material:'limestone'});
await proof('study',study,ops);
console.log('Offline composition + development proofs passed; provider calls: 0');
