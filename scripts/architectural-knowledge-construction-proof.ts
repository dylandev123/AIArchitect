/** Deterministic hand-authored contract evidence, NOT generated designs or runtime templates. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS as entries } from '../src/lib/library/architecture/seeds';
import { retrieveArchitecturalKnowledge } from '../src/lib/library/architecture/retrieval';
import { resolveSceneResult, SCENE_SYSTEM_PROMPT } from '../src/lib/villa/scene/terra';
import { applySceneOperations, validateScene, type SceneElement } from '../src/lib/villa/scene/model';
import { reviewSceneArchitecture } from '../src/lib/villa/scene/planning';
globalThis.fetch = async () => { throw Error('Network forbidden'); };
const root='docs/architecture/knowledge-construction'; mkdirSync(root,{recursive:true});
const cases=[
 {id:'caribbean',brief:'A $25 million Caribbean waterfront mansion with private bedroom suites, covered terraces and a pool',rooms:[['living',0,0,18,12],['dining',19,0,20,12],['suite-one',-17,-8,16,12],['suite-two',-17,6,16,12],['kitchen',19,-12,20,12],['service',0,-12,18,12]],hip:false},
 {id:'compact',brief:'A compact three-bedroom family house without pool or gym',rooms:[['living-kitchen-dining',0,0,12,5],['bedroom-one',-4,-5,4,5],['bedroom-two',0,-5,4,5],['bedroom-three',4,-5,4,5],['bathroom',-3,4,6,3],['laundry-entry',3,4,6,3]],hip:false},
 {id:'mediterranean',brief:'A Mediterranean luxury courtyard estate with loggias and guest suites',rooms:[['living',0,-12,16,10],['dining-kitchen',-13,-12,10,10],['family-suites',-13,0,10,14],['guest-suites',13,0,10,14],['service',13,-12,10,10]],hip:true},
] as const;
const evidence=cases.map(c=>{
 const knowledge=retrieveArchitecturalKnowledge(entries,c.brief);
 const elements:SceneElement[]=[];
 const part=(id:string,kind:SceneElement['kind'],at:number[],size:number[],extra={})=>elements.push({id,kind,label:id,at,size,rotation:0,material:'limestone',...extra} as SceneElement);
 for(const [id,x,z,w,d] of c.rooms){
  part(id+'-floor','plate',[x,.1,z],[w,.2,d]);
  for(const [side,dx,dz,span,yaw] of [['front',0,d/2,w,0],['back',0,-d/2,w,0],['left',-w/2,0,d,Math.PI/2],['right',w/2,0,d,Math.PI/2]] as const){
   const wall=id+'-'+side;
   part(wall,'wall',[x+dx,1.8,z+dz],[span,3.2,.2],{rotation:yaw,opening:{x:0,sill:side==='front'?0:1,width:Math.min(span-1,side==='front'?1.5:2.4),height:side==='front'?2.5:1.6,glazed:side!=='front'}});
   if(side==='front')part(id+'-door','entrance',[0,-.35,0],[1.45,2.5,.12],{parent:wall,material:'timber'});
  }
  part(id+'-roof','roof',[x,c.hip?4.3:3.55,z],[w+.8,c.hip?1.8:.3,d+.8],c.hip?{roofForm:'hip',overhang:.5}:{});
 }
 const terrace=c.id==='compact'?[0,6.5,12,2] : c.id==='mediterranean'?[0,0,16,14]:[8,10,34,8];
 const [tx,tz,tw,td]=terrace;
 part('connected-terrace','plate',[tx,.1,tz],[tw,.2,td],{material:'timber'});
 if(c.id!=='compact'){
  part('terrace-canopy','roof',[tx,3.55,tz],[tw,.3,td]);
  for(const sign of [-1,1])part('canopy-post-'+(sign<0?'left':'right'),'volume',[tx+sign*(tw/2-.3),1.8,tz+td/2-.3],[.3,3.2,.3]);
 }
 if(c.id==='caribbean'){
  part('pool-bottom','plate',[8,.075,20],[16,.15,5]);
  part('pool-water','water',[8,.25,20],[15.6,.05,4.6]);
  for(const sign of [-1,1]){part('pool-long-'+sign,'wall',[8,.2,20+sign*2.5],[16,.4,.2]);part('pool-end-'+sign,'wall',[8+sign*8,.2,20],[5,.4,.2],{rotation:Math.PI/2});}
 }
 const intent={scaleRationale:'Hand-authored offline capability study sized for '+c.id,arrivalAndCirculation:'Doors face connected outdoor routes; internal navigation remains unverified.',volumeHierarchy:'Living primary; sleeping and service rooms subordinate.',relationshipsAndViews:'Terrace connects the occupied volumes; orientation assumed.',roofFacadeAndMaterials:'Coordinated roof sections, real openings and limestone/timber.',intendedSpaces:c.rooms.map(r=>r[0]),designDecisions:knowledge.selected.slice(0,3).map(k=>({knowledgeId:k.id,decision:'Offline representation of relevant massing, enclosure and sheltered outdoor relationships.',elementIds:(k.id==='infinity-pool' ? ['pool-bottom','pool-water','pool-long-1','pool-end-1'] : k.id==='guest-house' ? ['guest-suites-floor','guest-suites-door','guest-suites-roof'] : k.id==='compact-family' ? ['bedroom-one-floor','bedroom-two-floor','bedroom-three-floor','living-kitchen-dining-floor'] : ['connected-terrace',...elements.filter(e=>e.kind==='roof').slice(0,2).map(e=>e.id)]).filter(id=>elements.some(e=>e.id===id)),limitation:'Hand-authored demonstration; room servicing, navigation and architectural quality require review.'}))};
 const output={name:c.id+' offline study',summary:'Deterministic capability fixture, not Terra output.',unsupported:['No utilities, engineering or navigability verification.'],architecturalPlan:intent,operations:elements.map(element=>({op:'add' as const,element}))};
 const result=resolveSceneResult({mode:'generate',prompt:c.brief},output);
 const reloaded=validateScene(JSON.parse(JSON.stringify(result.scene)));assert.deepEqual(reloaded,result.scene);
 const id=elements[0].id;const edited=applySceneOperations(reloaded,[{op:'finish',id,material:'sage'}]);assert.equal(edited.elements.find(e=>e.id===id)?.material,'sage');assert.deepEqual(edited.elements.slice(1),reloaded.elements.slice(1));
 const missing=structuredClone(result.scene);(missing.architecturalPlan as typeof intent).designDecisions[0].elementIds=['unbuilt-grand-entrance'];assert(reviewSceneArchitecture(missing).issues.some(i=>i.includes('unbuilt-grand-entrance')));
 writeFileSync(`${root}/${c.id}.scene.json`,JSON.stringify(result.scene,null,2));
 return {id:c.id,brief:c.brief,retrieval:knowledge.selected,chars:knowledge.chars,roughKnowledgeTokens:Math.ceil(knowledge.chars/4),elements:elements.length,audit:result.architecturalAudit,roundTrip:true,targetedEdit:true,missingDecisionWarns:true};
});
const retained=['docs/villa-playground/plan-to-construction/corrected.scene.json'].map(file=>({file,audit:reviewSceneArchitecture(validateScene(JSON.parse(readFileSync(file,'utf8'))))}));
writeFileSync(`${root}/evidence.json`,JSON.stringify({providerCalls:0,entries:entries.length,systemPromptChars:SCENE_SYSTEM_PROMPT.length,provenance:'Hand-authored offline fixtures; not proof of revised Terra output quality.',cases:evidence,retained},null,2));
console.log(JSON.stringify(evidence.map(({id,retrieval,chars,elements})=>({id,retrieval,chars,elements})),null,2));
