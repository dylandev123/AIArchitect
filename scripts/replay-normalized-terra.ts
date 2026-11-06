/** Offline evidence replay only. Imports no provider, auth mutation or live Studio store. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {advancePromptRun,type PromptRun} from '@/lib/villa/staged/promptGeneration';
import {retainedMassingDownstream} from '@/lib/villa/staged/normalization.fixture';
import {loadHouse} from '@/lib/villa/staged/save';
import type {Designer} from '@/lib/villa/staged/pipeline';
const directory='docs/architecture/automatic-house/identifier-normalization';
const evidence=JSON.parse(await readFile('docs/architecture/automatic-house/first-automatic-live/evidence.json','utf8'));
const run:PromptRun={input:evidence.run.source.input};
const designer:Designer={label:'OFFLINE actual Terra Stage 1–2 replay; authored downstream mocks',design:async(stage,ctx)=>{
 const raw=stage<=2?evidence.calls[stage-1].raw:JSON.stringify(retainedMassingDownstream(stage,ctx));
 return {value:JSON.parse(raw),raw,usage:{model:'offline replay — no provider request',inputTokens:0,outputTokens:0,costUsd:0}};
},correct:async()=>{throw Error('No correction or paid retry allowed');}};
await mkdir(directory,{recursive:true});let out;
for(let stage=1;stage<=5;stage++){
 out=await advancePromptRun(run,designer);
 await writeFile(`${directory}/stage-${stage}.json`,JSON.stringify(run.result,null,2)+'\n');
 if(out.stage!==stage)throw Error(`Stage ${stage} rejected: ${JSON.stringify(out.findings)}`);
}
const loaded=loadHouse(out!.save!);
await writeFile(`${directory}/completed-mock-downstream.save.json`,out!.save!);
await writeFile(`${directory}/normalizations.json`,JSON.stringify(run.result!.checkpoints.map(c=>({stage:c.stage,normalizations:c.normalizations??[],warnings:c.warnings??[]})),null,2)+'\n');
console.log(JSON.stringify({status:out!.status,acceptedStages:run.result!.checkpoints.filter(c=>c.accepted).map(c=>c.stage),elements:loaded.scene.elements.length,paidCalls:0,provenance:designer.label}));
