/** Developer-authored interpretation of retained prose. Offline only; never model output. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {elementSchema,validateScene,type SceneElement,type SceneOperation} from '../src/lib/villa/scene/model';
import {Output} from 'ai';
import {resolveSceneResult,sceneResponseFormatSchema} from '../src/lib/villa/scene/terra';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const dir='docs/villa-playground/redesign-construction-fix';mkdirSync(dir,{recursive:true});
const raw=readFileSync('docs/villa-playground/redesign-live/provider-response.raw.json');
const before=validateScene(JSON.parse(readFileSync('docs/villa-playground/redesign-live/before.json','utf8')));
const concept=JSON.parse(readFileSync('docs/villa-playground/redesign-live/concept-only.NOT-CONSTRUCTED.json','utf8')).architecturalPlan;
const elements:SceneElement[]=[];
function part(id:string,kind:SceneElement['kind'],at:number[],size:number[],extra:Record<string,unknown>={}){
 const e=elementSchema.parse({id,label:`Developer study: ${id}`,kind,at,size,material:kind==='roof'?'timber':'limestone',...extra});elements.push(e);return e;
}
// These numeric choices are authored here, not inferred executable model instructions.
function room(id:string,x:number,z:number,w:number,d:number,h:number){
 part(`${id}-floor`,'plate',[x,.1,z],[w,.2,d]);
 const north=part(`${id}-north-wall`,'wall',[x,.2+h/2,z+d/2],[w,h,.3],{opening:{x:0,sill:0,width:2.4,height:2.8,glazed:false}});
 part(id==='gallery'?'main-entrance':`${id}-entry`,'entrance',[0,-h/2+1.4,0],[2.4,2.8,.15],{parent:north.id,material:'bronze'});
 part(`${id}-south-wall`,'wall',[x,.2+h/2,z-d/2],[w,h,.3],{opening:{x:0,sill:0,width:w*.7,height:h-.4,glazed:id!=='salon'}});
 for(const [side,sign] of [['west',-1],['east',1]] as const)part(`${id}-${side}-wall`,'wall',[x+sign*w/2,.2+h/2,z],[d,h,.3],{rotation:Math.PI/2,opening:{x:0,sill:.5,width:d*.55,height:h-1,glazed:true}});
 part(`${id}-roof`,'roof',[x,.2+h+.15,z],[w+1.6,.3,d+1.6]);
}
room('salon',0,0,14,12,5.2);room('owner',-14,0,8,10,3.2);room('guest',14,0,8,10,3.2);
// Gallery joins the salon at Z=6: use the salon boundary once, open at the passage.
room('gallery',0,8,8,4,3.2);
elements.splice(elements.findIndex(e=>e.id==='gallery-south-wall'),1);
part('loggia-deck','plate',[0,.1,-8],[16,.2,4]);
for(const [side,x]of [['west',-7.3],['east',7.3]] as const){
 part(`loggia-${side}-pier`,'volume',[x,1.8,-8],[.8,3.2,.8]);
 part(`loggia-${side}-screen`,'screen',[x,1.8,-8],[3.4,3.2,.15],{rotation:Math.PI/2,material:'timber'});
 part(`arrival-portal-${side}`,'volume',[x/4,1.8,10.4],[.45,3.2,.6]);
}
part('loggia-roof','roof',[0,3.55,-8],[17,.3,5]);
part('arrival-forecourt','plate',[0,.1,13],[10,.2,6]);
// Sheltered exterior suite routes. All rest directly on the existing ground datum.
for(const [side,x]of [['west',-9],['east',9]] as const){
 part(`${side}-route`,'plate',[x,.1,7],[10,.2,4]);
 part(`${side}-route-post`,'volume',[x,1.8,8],[.4,3.2,.4]);
 part(`${side}-route-canopy`,'roof',[x,3.55,7],[10,.3,4]);
}
const keep=before.elements.filter(e=>e.id.startsWith('pool-'));
const ids=new Set([...keep,...elements].map(e=>e.id));
const operations:SceneOperation[]=[...before.elements.filter(e=>!ids.has(e.id)).sort((a,b)=>Number(!!b.parent)-Number(!!a.parent)).map(e=>({op:'remove' as const,id:e.id})),...elements.map(element=>before.elements.some(e=>e.id===element.id)?{op:'replace' as const,id:element.id,element}:{op:'add' as const,element})];
const output={architecturalPlan:{...concept,designDecisions:concept.designDecisions.map((d:Record<string,unknown>)=>({...d,disposition:'considered'}))},name:'DEVELOPER-AUTHORED concept construction study',summary:'Offline developer interpretation; not a Terra-generated redesign.',unsupported:['All unprovided coordinates, suite dimensions, gallery/loggia spans, openings and routes are developer choices.','Concept omits kitchen, bathrooms and service programme; no complete residence or engineered construction claimed.','Original pool geometry retained unchanged; its completeness remains unverified.'],operations};
const snapshot=JSON.stringify(before);
const resolved=resolveSceneResult({mode:'edit',editIntent:'redesign',prompt:'Offline developer study',current:before},output);
assert.deepEqual(sceneRelationshipIssues(resolved.scene),[]);assert.equal(JSON.stringify(before),snapshot);
keep.forEach(e=>assert.deepEqual(resolved.scene.elements.find(v=>v.id===e.id),e));
assert.deepEqual(validateScene(JSON.parse(JSON.stringify(resolved.scene))),resolved.scene);
for(const [name,value]of Object.entries({output,scene:resolved.scene,audit:{authorship:'developer',terraGenerated:false,providerCalls:0,originalResponseSha256:createHash('sha256').update(raw).digest('hex'),operations:operations.length,elements:resolved.scene.elements.length,retainedIds:keep.map(e=>e.id),relationships:[],architecturalAudit:resolved.architecturalAudit}}))writeFileSync(`${dir}/developer-study.${name}.json`,JSON.stringify(value,null,2));
console.log(`Developer study: ${operations.length} operations, ${resolved.scene.elements.length} elements, zero provider calls.`);

async function retainSchema(){
 const input={mode:'edit' as const,editIntent:'redesign' as const,prompt:'Offline contract audit',current:before};
 const format=await Output.object({schema:await sceneResponseFormatSchema(input)}).responseFormat;
 assert(format?.type==='json');
 writeFileSync(`${dir}/redesign.response-format.json`,JSON.stringify({type:'json_schema',name:'response',strict:true,schema:format.schema},null,2));
}
void retainSchema();
