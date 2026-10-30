import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {resolveSceneResult,SceneConstructionError} from './terra';
import {laderaScene} from './example';
import {laderaPlan} from './planning.fixture';
const read=(file:string)=>JSON.parse(readFileSync(`docs/architecture/terra-coordination-experiment/${file}.json`,'utf8'));
it.each(['refine','redesign','complete'] as const)('rejects the retained destructive incomplete replacement in %s and preserves original',editIntent=>{
 const current=read('before'),original=JSON.stringify(current),output=read('response').output;
 if(editIntent==='refine'){
  expect(()=>resolveSceneResult({mode:'edit',editIntent,current,prompt:'Remove salon-roof'},output)).toThrow(/scene metadata/);
  try{resolveSceneResult({mode:'edit',editIntent,current,prompt:'Remove salon-roof'},output);}catch(e){expect(e).not.toBeInstanceOf(SceneConstructionError);}
  expect(JSON.stringify(current)).toBe(original);return;
 }
 expect(()=>resolveSceneResult({mode:'edit',editIntent,current,prompt:'Remove salon-roof'},output)).toThrow(/Destructive incomplete replacement.*salon-roof-west/);
 try{resolveSceneResult({mode:'edit',editIntent,current,prompt:'Remove salon-roof'},output);}catch(e){expect(e).toBeInstanceOf(SceneConstructionError);expect((e as SceneConstructionError).recoverableDraft.elements).toHaveLength(87);}
 expect(JSON.stringify(current)).toBe(original);
});
it('allows intentional roof removal without replacement, even retaining legacy missing metadata',()=>{
 const current=read('before'),output=read('response').output;
 const result=resolveSceneResult({mode:'edit',current,prompt:'Remove the salon roof to create an open court'},{...output,summary:'Remove the salon roof without replacement.',architecturalPlan:current.architecturalPlan});
 expect(result.scene.elements).toHaveLength(87);
});
it('keeps unbuilt programme and quality issues as Generate warnings',()=>{
 const result=resolveSceneResult({mode:'generate',prompt:'A villa with extra bedrooms and amenities'},{name:'Incomplete villa',summary:'Partial accommodation',unsupported:['Room allocation remains incomplete'],architecturalPlan:{...laderaPlan,spaces:[...laderaPlan.spaces,{...laderaPlan.spaces[0],name:'Unbuilt amenity',floorIds:['unbuilt-floor']}]},operations:laderaScene.elements.map(element=>({op:'add',element}))});
 expect(result.architecturalAudit.findings.length).toBeGreaterThan(0);expect(result.scene.elements).toHaveLength(laderaScene.elements.length);
});
it('allows real roof replacement and still rejects unsafe support removal',()=>{
 const current={...laderaScene,architecturalPlan:laderaPlan};
 const roof=current.elements.find(e=>e.id==='bridge-roof')!;
 const output={architecturalPlan:laderaPlan,name:current.name,summary:'Replace the roof',unsupported:[],operations:[{op:'remove',id:roof.id},{op:'add',element:{...roof,id:'replacement-roof'}}]};
 expect(resolveSceneResult({mode:'edit',current,editIntent:'redesign',prompt:'Replace bridge-roof'},output).scene.elements.some(e=>e.id==='replacement-roof')).toBe(true);
 expect(()=>resolveSceneResult({mode:'edit',current,prompt:'Move floor'},{...output,operations:[{op:'move',id:'bridge-floor',at:[100,40,100]}]})).toThrow();
});

it('rejects an explicit replacement-roof claim even when a Refine response omits its plan',()=>{
 const current=read('before');const output={name:current.name,summary:'Remove salon-roof and replace it with two new flat roofs.',unsupported:[],operations:[{op:'remove',id:'salon-roof'}]};
 expect(()=>resolveSceneResult({mode:'edit',current,prompt:'Remove salon-roof'},output)).toThrow(/no replacement construction operations/);
 expect(resolveSceneResult({mode:'edit',current,prompt:'Remove salon-roof'},{...output,summary:'Replace the covered salon with an open courtyard.'}).scene.elements).toHaveLength(87);
});
