/* eslint-disable @typescript-eslint/no-explicit-any -- pg query overload forwarding follows the existing read-only harness. */
/** Instrumented wrapper around the REAL Generate route (POST /api/ai/scene -> generateCanonical). No separate engine.
 *  --preflight                 : builds and freezes the exact provider request offline (no provider call), writes Stage A evidence.
 *  --authorize-one-live-call --approved-sha256=<hash> : exactly one paid POST of that frozen request; zero retries/fallbacks/repairs.
 *  Database is read-only (SELECT only, usage INSERT redirected to evidence). Exclusive writes: nothing is ever overwritten. Secrets are never written. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {Pool,Client} from 'pg';
import {sceneRequestSchema} from '../src/lib/villa/scene/terra';
import {canonicalGenerationRequired,legacyHouseAuthoringEnabled} from '../src/lib/villa/canonical/authority';
import {architecturalRequestContext} from '../src/lib/villa/scene/knowledgeContext';
import {getAiModelId} from '../src/lib/ai/model';
import {computeCostUsd,getPricingTable} from '../src/lib/ai/pricing';
import {semanticTransportPreflight} from './semantic-transport-preflight.mjs';
const dir='docs/architecture/e2e-generation-diagnostic-2026-11-03';
const live=process.argv.includes('--authorize-one-live-call');
assert(live!==process.argv.includes('--preflight'),'Choose exactly one of --preflight or --authorize-one-live-call');
loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim());
mkdirSync(dir,{recursive:true});assert(!existsSync(`${dir}/call-started.json`),'Authorization consumed; never resubmit');
const tag=live?'live':'preflight';
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,typeof v==='string'?v:JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const timeline:{stage:string;event:string;startedAt:string;durationMs:number;outcome:string}[]=[];
async function timed<T>(stage:string,event:string,fn:()=>Promise<T>|T,outcome:(v:T)=>string=()=>'ok'):Promise<T>{
 const t=Date.now(),startedAt=new Date(t).toISOString();
 try{const v=await fn();timeline.push({stage,event,startedAt,durationMs:Date.now()-t,outcome:outcome(v)});return v;}
 catch(e){timeline.push({stage,event,startedAt,durationMs:Date.now()-t,outcome:`threw: ${e instanceof Error?e.message.slice(0,200):'unknown'}`});throw e;}
}
const dbEvents:unknown[]=[];
process.env.PGOPTIONS='-c default_transaction_read_only=on';
for(const proto of [Pool.prototype,Client.prototype]){
 const original=proto.query;
 (proto as any).query=function(...args:any[]){
  const sql=typeof args[0]==='string'?args[0]:args[0]?.text;assert.equal(typeof sql,'string');
  if(/^\s*CREATE TABLE/i.test(sql)){dbEvents.push({suppressed:'initializer DDL'});return Promise.resolve({rows:[],rowCount:0});}
  if(/^\s*INSERT INTO ai_usage\b/i.test(sql)){dbEvents.push({redirected:'usage INSERT to isolated evidence'});save(`${tag}-usage-log-values.json`,args[1]);return Promise.resolve({rows:[],rowCount:0});}
  assert(/^\s*SELECT\b/i.test(sql)&&!sql.includes(';'),'Database write or multi-statement blocked');
  dbEvents.push({read:sql.slice(0,160)});return (original as any).apply(this,args);
 };
}
// The original Saint Lucia US$25 million brief, verbatim from the retained acceptance request. No prior plan enters the model's context.
const prompt=(JSON.parse(readFileSync('docs/architecture/canonical-acceptance-2026-11-02/request.json','utf8')) as {prompt:string}).prompt;
const input=sceneRequestSchema.parse({mode:'generate',prompt});
if(!live)save('brief.json',input);else assert.deepEqual(JSON.parse(readFileSync(`${dir}/brief.json`,'utf8')),input,'brief changed since preflight');
const context=await timed('A','knowledge-retrieval',()=>architecturalRequestContext(input,{canonical:true}),c=>`${c.trace.selected.length} records selected, tier ${c.trace.budget.tier}`);
assert.equal(getAiModelId(),'gpt-5.6-terra');assert(canonicalGenerationRequired('generate')&&!legacyHouseAuthoringEnabled());
function sourceFiles(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(`${root}/${e.name}`):[`${root}/${e.name}`]);}
const sourceHashes=Object.fromEntries([...sourceFiles('src'),'package.json','package-lock.json','scripts/e2e-diagnostic-run.ts'].sort().map(p=>[p,hash(readFileSync(p,'utf8'))]));
let calls=0;const nativeFetch=globalThis.fetch;
async function probeConnectivity(request:unknown,wire:string):Promise<any>{const guarded=globalThis.fetch;globalThis.fetch=nativeFetch;try{return await semanticTransportPreflight(request,wire);}finally{globalThis.fetch=guarded;}}
let providerWallMs=0;
globalThis.fetch=async(url,init)=>{
 const address=String(url instanceof Request?url.url:url);assert.equal(address,'https://api.openai.com/v1/responses');
 const body=String(init?.body),wire=JSON.parse(body);
 assert.equal(wire.model,'gpt-5.6-terra');assert.equal(wire.max_output_tokens,30000);assert.equal(wire.text.format.strict,true);assert.equal(wire.reasoning?.effort,undefined);
 if(!live){
  save('provider-request.exact.json',body);save('source-hashes.json',sourceHashes);
  const inputTokensApprox=Math.ceil(Buffer.byteLength(body)/3.6);
  save('request-approval.json',{requestSha256:hash(body),requestBytes:Buffer.byteLength(body),model:wire.model,maxOutputTokens:wire.max_output_tokens,retries:0,fallbackModels:0,tools:wire.tools??[],
   rates:getPricingTable()['gpt-5.6-terra'],inputTokensApprox,estimatedInputUsd:computeCostUsd('gpt-5.6-terra',{inputTokens:inputTokensApprox,cachedInputTokens:0,outputTokens:0}),
   maximumCostUsd:computeCostUsd('gpt-5.6-terra',{inputTokens:inputTokensApprox,cachedInputTokens:0,outputTokens:30000}),
   typicalCostUsdAt8kOutput:computeCostUsd('gpt-5.6-terra',{inputTokens:inputTokensApprox,cachedInputTokens:0,outputTokens:8000}),
   previousComparable:{input:6397,output:7590,reasoning:2733,usd:0.104},note:'Maximum assumes every one of the 30,000 output tokens (including reasoning) is spent. Local estimate, not an invoice.'});
  throw Error('OFFLINE_PREFLIGHT_NO_PROVIDER_CALL');
 }
 assert.equal(body,readFileSync(`${dir}/provider-request.exact.json`,'utf8'),'Provider-facing request changed');
 assert.equal(hash(body),process.argv.find(a=>a.startsWith('--approved-sha256='))?.split('=')[1],'Approved hash required');
 assert.equal(calls,0,'Additional provider request forbidden');
 const transport=await probeConnectivity(wire,body);save('live-connectivity.json',transport);assert(transport.ok,'Same-process connectivity failed; no paid POST permitted');
 calls++;
 save('call-started.json',{startedAt:new Date().toISOString(),maxCalls:1,maxRetries:0});
 const t=Date.now();let response:Response;
 try{response=await nativeFetch(url,{...init,redirect:'error'});}catch(error){save('provider-transport-error.json',{errorType:error instanceof Error?error.name:'unknown',note:'No resubmission allowed; call may have reached provider.'});throw error;}
 const raw=await response.clone().text();providerWallMs=Date.now()-t;
 save('provider-response.raw.json',raw);
 save('provider-http.json',{status:response.status,statusText:response.statusText,requestId:response.headers.get('x-request-id'),openaiProcessingMs:response.headers.get('openai-processing-ms'),providerWallMs});
 timeline.push({stage:'B',event:'provider-request',startedAt:new Date(t).toISOString(),durationMs:providerWallMs,outcome:`HTTP ${response.status}`});
 return response;
};
let exact='';
try{
 const {POST}=await import('../src/app/api/ai/scene/route');
 const t0=Date.now();
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
 const body=await response.json();
 timeline.push({stage:'B-D',event:'route-total (provider + parse + compile)',startedAt:new Date(t0).toISOString(),durationMs:Date.now()-t0,outcome:`route HTTP ${response.status}${body.error?` — ${String(body.error).slice(0,120)}`:''}`});
 if(live){
  save('route-response.json',body);
  if(body.responseId)for(const suffix of ['.json','.wire.json','.diagnostics.json','.provider.txt']){const p=`.data/scene-responses/${body.responseId}${suffix}`;if(existsSync(p))save(`retained${suffix}`,readFileSync(p,'utf8'));}
  save('call-result.json',{status:response.status,providerCalls:calls,responseId:body.responseId,error:body.error,dbEvents});
  save('timeline.live.json',timeline);
  console.log(JSON.stringify({live,providerCalls:calls,status:response.status,elements:body.scene?.elements.length,error:body.error?String(body.error).slice(0,300):undefined}));
 }else{
  assert.equal(calls,0);assert.equal(response.status,422);assert(String(body.error).includes('OFFLINE_PREFLIGHT_NO_PROVIDER_CALL'));
  exact=readFileSync(`${dir}/provider-request.exact.json`,'utf8');
  const connectivity=await timed('A','connectivity-probe (GET only)',()=>probeConnectivity(JSON.parse(exact),exact),c=>c.ok?'ok':`failed at ${c.failureStage}`);save('connectivity.json',connectivity);
  // ---- Stage A evidence, derived only from the frozen request and the normal retrieval trace.
  const wire=JSON.parse(exact),sysMsg=wire.input.find((m:any)=>m.role==='system'||m.role==='developer'),system:string=sysMsg.content;
  const users=wire.input.filter((m:any)=>m.role==='user');
  save('system-prompt.txt',system);save('user-message.json',users);
  const headings:{heading:string;offset:number}[]=[];
  for(const m of system.matchAll(/^([A-Z][A-Z0-9 ,&'()\/-]{8,})$/gm))headings.push({heading:m[1],offset:m.index!});
  const walk=(n:any,path:string,out:Record<string,unknown>)=>{if(!n||typeof n!=='object')return;if(Array.isArray(n.enum))out[path]=n.enum;for(const [k,v] of Object.entries(n))walk(v,`${path}/${k}`,out);};
  const enums:Record<string,unknown>={};walk(wire.text.format.schema,'#',enums);
  const planProps=(()=>{const s=JSON.stringify(wire.text.format.schema);return s.length;})();
  const trace=context.trace as any;
  const clip=(v:any):any=>typeof v==='string'?(v.length>300?`${v.slice(0,300)}… [+${v.length-300} chars; full text is in system-prompt.txt]`:v):Array.isArray(v)?v.map(clip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clip(x)])):v;
  const selected=trace.selected as any[];
  const isStrategy=(r:any)=>/strateg|whole-house|composition/i.test(JSON.stringify([r.kind,r.type,r.category,r.id,r.title,r.name]));
  save('stage-a-input.json',{
   brief:input.prompt,briefChars:input.prompt.length,
   model:{id:wire.model,provider:'openai (Responses API, strict json_schema)',maxOutputTokens:wire.max_output_tokens,reasoning:wire.reasoning??'provider default (no effort sent)',store:wire.store,temperature:wire.temperature??'not sent',tools:wire.tools??[],retries:0,fallbackModels:0,toolChoice:wire.tool_choice??null},
   wireSettingsExcludingInputAndSchema:Object.fromEntries(Object.entries(wire).filter(([k])=>!['input','text'].includes(k))),textFormat:{type:wire.text.format.type,name:wire.text.format.name,strict:wire.text.format.strict,verbosity:wire.text.verbosity},
   schemaVersionLiterals:[...new Set((JSON.stringify(wire.text.format.schema).match(/architectural-plan-\d+(?:\.\d+)?/g))??[])],schemaJsonChars:planProps,
   promptAssembly:{systemChars:system.length,systemSha256:hash(system),userMessages:users.length,userMessageSha256:hash(JSON.stringify(users)),headings,
    knowledgeTextChars:trace.chars,baseSystemChars:trace.baseSystemChars,lessonChars:trace.lessonChars,estimatedKnowledgeTokens:trace.estimatedTokens,
    note:'Mission/priority instructions are the leading CANONICAL_INSTRUCTIONS block of system-prompt.txt; retrieved knowledge follows; CONTRACT PRECEDENCE closes it.'},
   userMessageIsBriefOnly:users.length===1&&JSON.stringify(users).includes(input.prompt.slice(0,80)),
   knowledge:{project:trace.project,budget:trace.budget,metrics:trace.metrics,query:clip(trace.query),researchStatus:clip(trace.research),selectedCount:selected.length,
    selectedRecords:selected.map(clip),
    strategyRecords:selected.filter(isStrategy).map(clip),
    retrievalWhy:'See per-record score/reason fields in selectedRecords where the retriever provides them; the retriever exposes no prose rationale beyond those fields.'},
   canonicalCapabilitiesFromSchema:{enums,note:'Every enum in the exact provider JSON schema; this is the capability vocabulary Terra was offered.'},
   dataFlow:{databaseWrites:0,dbEvents,secretsInEvidence:false}
  });
  save('timeline.preflight.json',timeline);
  console.log(JSON.stringify({requestSha256:hash(exact),requestBytes:Buffer.byteLength(exact),selected:selected.length,strategyRecords:selected.filter(isStrategy).length,connectivityOk:connectivity.ok}));
 }
}finally{globalThis.fetch=nativeFetch;}
process.exit(0);
