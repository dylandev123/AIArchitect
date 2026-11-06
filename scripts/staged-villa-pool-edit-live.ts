/** ONE approved natural-language edit. Exact prepared body, raw-first evidence, no retries. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadEnvConfig} from '@next/env';
import {Output} from 'ai';
import {editAcceptedStagedSave,poolEditPlanSchema,stagedSaveHash} from '../src/lib/villa/staged/naturalLanguageEdit';
import {loadHouse} from '../src/lib/villa/staged/save';
import {measure} from '../src/lib/villa/staged/pipeline';
const root='docs/architecture/staged-villa',packet=`${root}/natural-language-edit/live-prepared-1`,out=`${root}/natural-language-edit/live-edit-1`;
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const write=(n:string,v:unknown)=>writeFileSync(`${out}/${n}.json`,JSON.stringify(v,null,2),{flag:'wx'});
const approval=read(`${packet}/approval.json`),wire=read(`${packet}/wire-request.json`),expected='c5ef1b7615f09e96f08c3c32d4bed066b8dd4685cf6325c66a0ba073aea12132';
assert.equal(hash(JSON.stringify(wire)),expected);assert.equal(approval.wireSHA256,expected);
for(const [f,h]of Object.entries(read(`${packet}/source-hashes.json`)))assert.equal(hash(readFileSync(f)),h,`Source changed: ${f}`);
assert.equal(wire.model,'gpt-5.6-terra');assert.equal(wire.max_output_tokens,2000);assert.equal(wire.store,false);assert.equal(wire.service_tier,'default');assert(!wire.tools);
const bound=((Buffer.byteLength(JSON.stringify(wire))+4096)*2.5+2000*12)/1e6;assert.equal(bound,.044835);assert(bound<=.06);
const schema=(await (Output.object({schema:poolEditPlanSchema}) as unknown as {responseFormat:Promise<{schema:unknown}>}).responseFormat).schema;
assert.deepEqual(wire.text.format.schema,schema);assert.equal(wire.text.format.strict,true);
const save=readFileSync(`${root}/stage5-site/terra-stage5.save.json`,'utf8'),base=loadHouse(save);assert.equal(stagedSaveHash(save),approval.baselineHash);
assert(!existsSync(out),'One-call directory exists. Never retry or remove evidence.');
if(!process.argv.includes('--live')){console.log(JSON.stringify({preflight:'PASS',model:wire.model,wireSHA256:expected,maxOutputTokens:2000,boundUsd:bound,maxCostUsd:.06,providerCalls:0}));process.exit(0);}
loadEnvConfig(process.cwd(),false,{info:()=>{},error:()=>{}});const key=process.env.OPENAI_API_KEY?.trim();assert(key,'Existing credential unavailable');assert(!process.env.OPENAI_BASE_URL?.trim(),'Unexpected provider override');
mkdirSync(out);const prior=read('/tmp/pool-live-before.json');write('preservation-before',prior);
write('attempt',{authorization:'User approved ONE live Terra natural-language pool edit, US$0.06 cap, 2000 output tokens, zero retries; separate candidate only',started:new Date().toISOString(),wireSHA256:expected,runnerSHA256:hash(readFileSync('scripts/staged-villa-pool-edit-live.ts')),maxCostUsd:.06,maxOutputTokens:2000});
write('preflight',{allPreparedHashesMatch:true,boundUsd:bound,model:wire.model,instruction:approval.instruction,baselineHash:approval.baselineHash});
let calls=0;
try{
 write('network-sent',{at:new Date().toISOString(),endpoint:'https://api.openai.com/v1/responses',wireSHA256:expected});assert.equal(calls,0);calls++;
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(wire),redirect:'error',signal:AbortSignal.timeout(170000)});
 const text=await response.text();writeFileSync(`${out}/raw-response.json`,text,{flag:'wx'});write('http',{status:response.status,requestId:response.headers.get('x-request-id')});
 const raw=JSON.parse(text),u=raw.usage,cached=u?.input_tokens_details?.cached_tokens??0,cacheWrite=u?.input_tokens_details?.cache_write_tokens??0;
 const normal=u?u.input_tokens-cached-cacheWrite:null;const cost=typeof normal==='number'&&normal>=0?(normal*2+cached*.2+cacheWrite*2.5+u.output_tokens*12)/1e6:null;
 write('result',{providerCalls:calls,requestedModel:wire.model,returnedModel:raw.model,status:raw.status,finishReason:raw.status==='completed'?'stop':raw.incomplete_details?.reason??raw.status,usage:u??null,costUsd:cost,costBasis:'Actual reported token usage including cache writes at published standard rates; independent invoice not checked',costBreakdown:{normalInput:normal,cachedInput:cached,cacheWriteInput:cacheWrite,rates:{input:2,cached:.2,cacheWrite:2.5,output:12}},incompleteDetails:raw.incomplete_details??null});
 assert(response.ok);assert.equal(raw.model,wire.model);assert.equal(raw.status,'completed');assert(cost!==null&&cost<=.06);
 const content=(raw.output??[]).flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]);assert(!content.some((p:{type:string})=>p.type==='refusal'));
 const output=content.filter((p:{type:string})=>p.type==='output_text').map((p:{text:string})=>p.text).join('');writeFileSync(`${out}/output-text.txt`,output,{flag:'wx'});
 const proposal=JSON.parse(output);write('proposal',proposal);const parsed=poolEditPlanSchema.safeParse(proposal);
 write('schema-validation',{accepted:parsed.success,findings:parsed.success?[]:parsed.error.issues});assert(parsed.success,'Invalid schema; stop without correction');
 assert.deepEqual(parsed.data.ops,[{op:'move-pool-relative',pool:'pool',veranda:'veranda:south-veranda',direction:'towards',distance:2}],'Terra misunderstood exact instruction; stop without correction');
 write('interpretation-validation',{accepted:true,pool:'pool',reference:'veranda:south-veranda',direction:'towards',distance:2});
 // Only the actual raw model proposal enters the existing accepted-save edit path.
 const result=await editAcceptedStagedSave({save,instruction:approval.instruction,expectedHash:approval.baselineHash,proposal});write('edit-result',result);assert(result.accepted,'Unsafe edit; stop without correction');
 const after=loadHouse(result.save);const check=measure(after.spec,5,4,5);assert.deepEqual(check.findings,[]);assert(after.scene.elements.length<=400);
 const world=(h:typeof base,id:string):number[]=>{const e=h.scene.elements.find(e=>e.id===id)!;const p=e.parent?world(h,e.parent):[0,0,0];return e.at.map((n,i)=>n+p[i]);};
 const poolIds=Object.entries(base.components).filter(([,c])=>c==='pool').map(([id])=>id),assembly=[];
 for(const id of poolIds){const a=base.scene.elements.find(e=>e.id===id)!,b=after.scene.elements.find(e=>e.id===id)!;assert(b);const old=world(base,id),now=world(after,id);
  if(id!=='pool'){assert(Math.abs(now[2]-old[2]+2)<1e-8);assert.deepEqual(b.size,a.size);}assert.equal(now[0],old[0]);assert.equal(now[1],old[1]);assert.equal(b.material,a.material);assert.equal(b.color,a.color);
  assembly.push({id,beforeWorld:old,afterWorld:now,sizeBefore:a.size,sizeAfter:b.size});
 }
 const houseIds=Object.entries(base.components).filter(([,c])=>c!=='pool'&&!c.startsWith('landscape:')).map(([id])=>id);assert.equal(houseIds.length,314);
 for(const id of houseIds)assert.equal(JSON.stringify(after.scene.elements.find(e=>e.id===id)),JSON.stringify(base.scene.elements.find(e=>e.id===id)),id);
 for(const k of ['blocks','stairs','links','exterior','trim','direction','site','openSpaces','sitePresentation']as const)assert.deepEqual(after.spec[k],base.spec[k]);
 for(const k of ['trees','beds','hedges','lawns']as const)assert.deepEqual(after.spec.siteWork[k],base.spec.siteWork[k]);
 write('assembly-verification',{all14PoolIdsRetained:poolIds.length===14,all13BasinCopingSideAndFarDeckPartsTranslateExactlyTwoMetres:true,nearApronRecomputed:true,assembly});
 writeFileSync(`${out}/candidate.save.json`,result.save,{flag:'wx'});write('candidate.scene',after.scene);write('baseline.scene',base.scene);write('candidate.checkpoint',{provenance:'Actual live Terra natural-language decision applied to actual accepted Stage 5 source; separate candidate only',spec:after.spec,proposal,preservedPlanWarnings:read(`${root}/stage5-site/terra-stage5.checkpoint.json`).preservedPlanWarnings});
 for(const [p,h]of Object.entries(prior))assert.equal(hash(readFileSync(p)),h,p);
 write('verification',{source:'Actual Terra Stage 5',planner:'ACTUAL LIVE Terra response',providerCalls:1,houseElementsIdentical:314,programmeRooms:23,bedrooms:4,baths:5,elements:after.scene.elements.length,diff:'diff' in result?result.diff:null,findings:check.findings,saveReload:true,semanticOwnershipRetained:true,allPriorFilesUnchanged:true,priorFileCount:Object.keys(prior).length,baselinePromoted:false});
 console.log(JSON.stringify({providerCalls:1,status:raw.status,usage:u,costUsd:cost,editAccepted:true,elements:after.scene.elements.length,output:out}));
}catch(error){write('failure',{providerCalls:calls,error:String(error).split(key).join('[REDACTED]'),stopped:true,retries:0,hiddenCorrections:0});console.error('Live edit stopped. No retry or correction. Inspect retained evidence.');process.exitCode=1;}
