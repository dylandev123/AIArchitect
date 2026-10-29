/** Offline contract studies, never provider output or approved learning. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS as entries } from '../src/lib/library/architecture/seeds';
import { retrieveArchitecturalKnowledge as retrieve } from '../src/lib/library/architecture/retrieval';
import { resolveSceneResult, SCENE_SYSTEM_PROMPT } from '../src/lib/villa/scene/terra';
import { validateScene, type SceneElement } from '../src/lib/villa/scene/model';
globalThis.fetch=async()=>{throw Error('Offline: network forbidden');};
const root='docs/architecture/composable-knowledge';mkdirSync(root,{recursive:true});
const cases=[
 ['caribbean','A $25m Caribbean waterfront estate with infinity edge pool, stone deck and ocean-facing lounge','caribbean'],
 ['compact','A compact three-bedroom family villa without pool or gym','compact'],
 ['mediterranean','A Mediterranean courtyard mansion with loggias and private guest suites','mediterranean'],
 ['family-pool','A family villa with a pool sun shelf and submerged seating beside a shaded terrace','caribbean'],
 ['spa-pool','A luxury waterfront estate with rectangular lap pool, separate spa and private pool deck','caribbean'],
];
const results=cases.map(([id,brief,source])=>{
 const original=validateScene(JSON.parse(readFileSync(`docs/architecture/knowledge-construction/${source}.scene.json`,'utf8')));
 const elements=structuredClone(original.elements);
 if(id==='family-pool')elements.push({id:'submerged-shelf',kind:'plate',label:'Raised basin shelf',at:[2,.16,20],size:[3,.17,4.6],rotation:0,material:'limestone',panels:1});
 if(id==='spa-pool'){
  const part=(id:string,kind:SceneElement['kind'],at:[number,number,number],size:[number,number,number],rotation=0)=>elements.push({id,kind,label:id,at,size,rotation,material:'limestone',panels:1});
  part('spa-bottom','plate',[20,.075,20],[3,.15,3]);part('spa-water','water',[20,.25,20],[2.6,.05,2.6]);
  for(const sign of [-1,1]){part(`spa-edge-x-${sign}`,'wall',[20,.2,20+sign*1.5],[3,.4,.2]);part(`spa-edge-z-${sign}`,'wall',[20+sign*1.5,.2,20],[3,.4,.2],Math.PI/2);}
  part('spa-approach','plate',[20,.1,16],[3,.2,4]);
 }
 const knowledge=retrieve(entries,brief);
 const plan=original.architecturalPlan as Record<string,unknown>;
 const output={name:id,summary:'Hand-authored offline study; no claim of generated architectural quality.',unsupported:['Infinity overflow, heating, jets, lighting and pool hydraulics unsupported.'],architecturalPlan:{...plan,designDecisions:knowledge.selected.map(k=>({knowledgeId:k.id,decision:'Study of primitive construction; review relationships and completeness.',elementIds:elements.filter(e=>/pool|spa|shelf/.test(e.id)).slice(0,12).map(e=>e.id),limitation:'Fixture references are intentionally audited; unrelated kinds cannot prove a complete feature.',disposition:'constructed'}))},operations:elements.map(element=>({op:'add',element}))};
 const resolved=resolveSceneResult({mode:'generate',prompt:brief},output,knowledge.evidence);
 writeFileSync(`${root}/${id}.scene.json`,JSON.stringify(resolved.scene,null,2));
 return {id,brief,chars:knowledge.chars,budget:knowledge.budget,metrics:knowledge.metrics,selected:knowledge.selected,audit:resolved.architecturalAudit,elements:elements.length};
});
writeFileSync(`${root}/evidence.json`,JSON.stringify({providerCalls:0,provenance:'Deterministic hand-authored contract studies, not model generation or approved learning.',entries:entries.length,systemChars:SCENE_SYSTEM_PROMPT.length,results},null,2));
console.log(JSON.stringify(results.map(({id,chars,elements,metrics})=>({id,chars,elements,metrics})),null,2));
