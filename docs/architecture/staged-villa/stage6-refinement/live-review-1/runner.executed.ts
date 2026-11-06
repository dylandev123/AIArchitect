/** Approved one-shot Stage 6 review only. Never imports an edit executor or writes a scene. */
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadEnvConfig} from '@next/env';
import {Output} from 'ai';
import {sha256,verifyReviewWire,reviewCostBound,visualReviewSchema,checkVisualReviewProposal,type VisualReviewWire} from '../src/lib/villa/staged/visualReviewRequest';
import {loadHouse} from '../src/lib/villa/staged/save';

const root='docs/architecture/staged-villa',packet=`${root}/stage6-refinement/review-request-2`,out=`${root}/stage6-refinement/live-review-1`;
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const write=(n:string,v:unknown)=>writeFileSync(`${out}/${n}.json`,JSON.stringify(v,null,2),{flag:'wx'});
const expectedHash='54c8755445fbe7fd6c9f99a645627c2a629eaddfbad3914bae6a884ffbc98e14';
const approval=read(`${packet}/approval.json`),wire=read(`${packet}/wire-request.json`) as VisualReviewWire;
assert.equal(sha256(JSON.stringify(wire)),expectedHash);assert.equal(approval.wireSHA256,expectedHash);
assert.equal(approval.endpoint,'https://api.openai.com/v1/responses');assert.equal(approval.model,'gpt-5.6-terra');
assert.equal(approval.maxCostUsd,.20);assert.equal(approval.maxCalls,1);assert.equal(approval.maxRetries,0);assert.equal(approval.timeoutMs,170000);
const pinned=read(`${packet}/source-hashes.json`) as Record<string,string>;
for(const [p,h]of Object.entries(pinned))assert.equal(sha256(readFileSync(p)),h,`Pinned source changed: ${p}`);
const images=read(`${packet}/images.json`);verifyReviewWire(wire,images);
for(const im of images)assert.equal(sha256(readFileSync(`${root}/stage5-site/terra-stage5-${im.view}.png`)),im.sha256);
const bound=reviewCostBound(wire);assert(bound.conservativeBoundUsd<=.20);assert.equal(bound.conservativeBoundUsd,.193935);
const house=loadHouse(readFileSync(`${root}/stage5-site/terra-stage5.save.json`,'utf8'));
assert.equal(house.scene.elements.length,377);
const schema=(await (Output.object({schema:visualReviewSchema(house.spec)}) as unknown as {responseFormat:Promise<{schema:unknown}>}).responseFormat).schema;
assert.equal(sha256(JSON.stringify(schema)),sha256(JSON.stringify(wire.text.format.schema)));
assert(!existsSync(out),'One-shot evidence directory exists. Never retry or remove its markers.');
if(!process.argv.includes('--live')){
 console.log(JSON.stringify({preflight:'PASS',wireSHA256:expectedHash,images:4,model:wire.model,maxOutputTokens:4000,conservativeBoundUsd:bound.conservativeBoundUsd,maxCostUsd:.20,providerRequests:0,refinementsExecuted:0}));
 process.exit(0);
}
loadEnvConfig(process.cwd(),false,{info:()=>{},error:()=>{}});
const key=process.env.OPENAI_API_KEY?.trim();assert(key,'Existing credential unavailable.');
assert(!process.env.OPENAI_BASE_URL?.trim(),'Unexpected provider override.');
assert.equal(process.env.AI_HOUSE_MODEL||'gpt-5.6-terra',wire.model,'Unexpected model configuration.');
mkdirSync(out); // Exclusive sticky directory blocks any second execution, even after failure.
const historical=read('/tmp/stage6-live-preservation-before.json') as Record<string,string>;
write('preservation-before',historical);
write('attempt',{authorization:'User approved ONE live Stage 6 visual-review request capped at US$0.20; no retries or refinements',started:new Date().toISOString(),wireSHA256:expectedHash,runnerSHA256:sha256(readFileSync('scripts/staged-villa-visual-review-live.ts')),model:wire.model,maxCostUsd:.20,maxOutputTokens:4000,images:4,retries:0,refinementsExecuted:0});
write('preflight',{wireSHA256:expectedHash,allPinnedSourcesMatch:true,allFourOriginalImageBytes:true,strictSchemaMatches:true,budget:bound,providerCapabilitySources:approval.documentation.sources,documentationRecheckedOn:'2026-11-04'});
let sent=0;
try{
 // Sticky marker is written BEFORE the sole fetch. No retry library, follow-up GET or redirects.
 write('network-sent',{at:new Date().toISOString(),endpoint:approval.endpoint,method:'POST',wireSHA256:expectedHash,maxRequests:1});
 assert.equal(sent,0);sent++;
 const response=await fetch(approval.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(wire),redirect:'error',signal:AbortSignal.timeout(170000)});
 const rawText=await response.text();
 writeFileSync(`${out}/raw-response.json`,rawText,{flag:'wx'});
 write('http',{status:response.status,requestId:response.headers.get('x-request-id'),contentType:response.headers.get('content-type')});
 const raw=JSON.parse(rawText),u=raw.usage;
 const validUsage=u&&Number.isInteger(u.input_tokens)&&Number.isInteger(u.output_tokens);
 const cached=validUsage?(u.input_tokens_details?.cached_tokens??0):null;
 const cacheWrite=validUsage?(u.input_tokens_details?.cache_write_tokens??0):null;
 const uncached=validUsage?u.input_tokens-cached-cacheWrite:null;
 const usageCost=validUsage&&uncached>=0?(uncached*2+cached*.2+cacheWrite*2.5+u.output_tokens*12)/1e6:null;
 write('result',{providerRequests:sent,modelRequested:wire.model,modelReturned:raw.model??null,httpStatus:response.status,status:raw.status??null,finishReason:raw.status==='completed'?'stop':raw.incomplete_details?.reason??raw.status??'http-error',finishReasonBasis:'Responses completed status maps to normal stop; raw status and incomplete_details retained',incompleteDetails:raw.incomplete_details??null,usage:u??null,usageBasedActualCostUsd:usageCost,costBreakdown:{uncachedInputTokens:uncached,cachedInputTokens:cached,cacheWriteInputTokens:cacheWrite,inputRatePerMillion:2,cachedRatePerMillion:.2,cacheWriteRatePerMillion:2.5,outputRatePerMillion:12},costBasis:'Actual provider usage including reported cache writes at freshly checked published standard rates; invoice not independently checked',refinementsExecuted:0});
 assert(response.ok,'Provider HTTP failure; stop without retry.');
 assert.equal(raw.model,wire.model,'Returned model mismatch.');
 assert(usageCost!==null&&usageCost<=.20,'Missing usage or budget exceeded; no further requests.');
 const messages=(raw.output??[]).flatMap((o:{content?:{type:string;text?:string;refusal?:string}[]})=>o.content??[]);
 const refusals=messages.filter((p:{type:string})=>p.type==='refusal');
 const text=messages.filter((p:{type:string})=>p.type==='output_text').map((p:{text:string})=>p.text).join('');
 writeFileSync(`${out}/output-text.txt`,text,{flag:'wx'});
 write('completion',{status:raw.status,incompleteDetails:raw.incomplete_details??null,refusals,outputMessageTypes:(raw.output??[]).map((o:{type:string})=>o.type)});
 if(raw.status!=='completed'||refusals.length){write('validation',{schemaAccepted:false,findings:['Incomplete or refused review; stopped without repair.']});throw Error('Incomplete or refused review.');}
 let parsed:unknown;
 try{parsed=JSON.parse(text);}catch{write('validation',{schemaAccepted:false,findings:['Invalid review JSON.']});throw Error('Invalid JSON review.');}
 write('review',parsed);
 const checked=visualReviewSchema(house.spec).safeParse(parsed);
 const gate=checkVisualReviewProposal(house.spec,parsed);
 write('validation',{schemaAccepted:checked.success,schemaFindings:checked.success?[]:checked.error.issues,proposalValidation:gate,refinementsExecuted:0});
 const old=Object.entries(historical);for(const [p,h]of old)assert.equal(sha256(readFileSync(p)),h,`Historical file changed: ${p}`);
 write('preservation-after',{allUnchanged:true,filesChecked:old.length,elements:377,rooms:23,bedrooms:4,bathrooms:5,refinementsExecuted:0});
 console.log(JSON.stringify({providerRequests:sent,status:raw.status,usage:u,usageBasedActualCostUsd:usageCost,schemaAccepted:checked.success,proposalValidation:gate,refinementsExecuted:0,output:out}));
}catch(e){
 write('failure',{providerRequestsAttempted:sent,error:String(e).split(key).join('[REDACTED]'),stopped:true,retries:0,refinementsExecuted:0});
 console.error('Stage 6 stopped; raw evidence retained where available. No retry.');process.exitCode=1;
}
