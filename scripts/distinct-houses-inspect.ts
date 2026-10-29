/** Offline evidence only. Never overwrite retained generated scenes. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {applySceneOperations,validateScene} from '../src/lib/villa/scene/model';
import {computeCostUsd,getPricingTable} from '../src/lib/ai/pricing';
loadEnvConfig(process.cwd());
const rows=[];
for(const label of ['A','B']){
 const dir=`docs/architecture/distinct-houses/${label}`,read=(n:string)=>JSON.parse(readFileSync(`${dir}/${n}.json`,'utf8'));
 const scene=validateScene(read('scene.UNAPPROVED')),result=read('result'),door=scene.elements.find(e=>e.kind==='entrance')!;
 const edited=applySceneOperations(scene,[{op:'finish',id:door.id,material:'timber'}]);
 assert.deepEqual(edited.elements.map(e=>e.id),scene.elements.map(e=>e.id));
 for(const e of scene.elements.filter(e=>e.id!==door.id))assert.deepEqual(edited.elements.find(n=>n.id===e.id),e);
 const host=scene.elements.find(e=>e.id===door.parent)!;
 const moved=applySceneOperations(scene,[{op:'move',id:host.id,at:[host.at[0],host.at[1],host.at[2]+.02]}]);
 assert.deepEqual(moved.elements.find(e=>e.id===door.id),door,'Door keeps local transform with moved parent');
 assert.deepEqual(validateScene(JSON.parse(JSON.stringify(scene))),scene);
 const usage=result.usage,counts={inputTokens:usage.inputTokens,cachedInputTokens:usage.inputTokenDetails.cacheReadTokens??0,outputTokens:usage.outputTokens};
 const model=read('settings').model;
 const row={label,model,name:scene.name,usage,configuredRate:getPricingTable()[model],estimatedCostUsd:computeCostUsd(model,counts),actualBilledCostUsd:null,localizedEditPreservesAllUnrelatedElements:true,parentDoorTransformPreserved:true,jsonRoundtrip:true,wholeWingHierarchyUsed:false};
 writeFileSync(`${dir}/offline-inspection.json`,JSON.stringify(row,null,2));rows.push(row);
}
writeFileSync('docs/architecture/distinct-houses/usage-summary.json',JSON.stringify({calls:2,retries:0,rows,totalEstimatedCostUsd:rows.reduce((n,r)=>n+(r.estimatedCostUsd??0),0),costBasis:'Existing application pricing configuration; estimate, not provider invoice. Cache-write surcharge is not represented by this pricing table.'},null,2));
console.log(JSON.stringify(rows.map(r=>({label:r.label,cost:r.estimatedCostUsd}))))
