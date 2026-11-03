/* eslint-disable @typescript-eslint/no-explicit-any -- pg query overload forwarding follows the existing read-only harness. */
/** Actual Generate route, one guarded paid POST, read-only database. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {Pool,Client} from 'pg';
import {sceneRequestSchema} from '../src/lib/villa/scene/terra';
import {canonicalGenerationRequired,legacyHouseAuthoringEnabled} from '../src/lib/villa/canonical/authority';
import {architecturalRequestContext} from '../src/lib/villa/scene/knowledgeContext';
import {getAiModelId} from '../src/lib/ai/model';
import {semanticTransportPreflight} from './semantic-transport-preflight.mjs';
const dir='docs/architecture/canonical-final-2026-11-02';
const live=process.argv.includes('--authorize-one-live-call');
assert(live !== process.argv.includes('--preflight'), 'Choose exactly one of --preflight or --authorize-one-live-call');
loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim());
mkdirSync(dir,{recursive:true});assert(!existsSync(`${dir}/call-started.json`),'Authorization consumed; never resubmit');
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,typeof v==='string'?v:JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const dbEvents:unknown[]=[];
// No initializer or usage INSERT reaches Postgres. All actual statements are SELECTs;
// server-enforced default_transaction_read_only also protects against hidden writes.
process.env.PGOPTIONS='-c default_transaction_read_only=on';
for(const proto of [Pool.prototype,Client.prototype]){
 const original=proto.query;
 (proto as any).query=function(...args:any[]){
  const sql=typeof args[0]==='string'?args[0]:args[0]?.text;assert.equal(typeof sql,'string');
  if(/^\s*CREATE TABLE/i.test(sql)){dbEvents.push({suppressed:'initializer DDL'});return Promise.resolve({rows:[],rowCount:0});}
  if(/^\s*INSERT INTO ai_usage\b/i.test(sql)){dbEvents.push({redirected:'usage INSERT to isolated evidence'});save(live?'usage-log-values.json':'preflight-usage-log-values.json',args[1]);return Promise.resolve({rows:[],rowCount:0});}
  assert(/^\s*SELECT\b/i.test(sql)&&!sql.includes(';'),'Database write or multi-statement blocked');
  dbEvents.push({read:sql});return (original as any).apply(this,args);
 };
}
const prompt=(JSON.parse(readFileSync('docs/architecture/canonical-acceptance-2026-11-02/request.json','utf8')) as {prompt:string}).prompt;
const input=sceneRequestSchema.parse({mode:'generate',prompt});
if(!live){if(existsSync(`${dir}/brief.NOT-SUBMITTED.json`))assert.deepEqual(JSON.parse(readFileSync(`${dir}/brief.NOT-SUBMITTED.json`,'utf8')),input);else save('brief.NOT-SUBMITTED.json',input);}
let context:Awaited<ReturnType<typeof architecturalRequestContext>>;
try { context=await architecturalRequestContext(input,{canonical:true}); }
catch(error){
 save(live?'live-retrieval-failure.json':'retrieval-failure.json',{stage:'normal-knowledge-retrieval',paidCalls:0,error:error instanceof Error?error.message:'Unknown retrieval error'});
 process.exit(1);
}
assert(['estate','mansion'].includes(context.trace.project.scale),'Mansion-scale knowledge required');
assert.equal(context.trace.budget.tier,'complex');
assert.equal(getAiModelId(),'gpt-5.6-terra');
assert(canonicalGenerationRequired('generate')&&!legacyHouseAuthoringEnabled());
function sourceFiles(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(`${root}/${e.name}`):[`${root}/${e.name}`]);}
const sourceHashes=Object.fromEntries([...sourceFiles('src'), 'package.json','package-lock.json','scripts/canonical-final-once.ts'].sort().map(path=>[path,hash(readFileSync(path,'utf8'))]));
let calls=0;const nativeFetch=globalThis.fetch;
type Transport={ok?:boolean;failureStage?:string;[k:string]:unknown};
async function probeConnectivity(request:unknown,wire:string):Promise<Transport>{const guarded=globalThis.fetch;globalThis.fetch=nativeFetch;try{return await semanticTransportPreflight(request,wire) as Transport;}finally{globalThis.fetch=guarded;}}
globalThis.fetch=async(url,init)=>{
 const address=String(url instanceof Request?url.url:url);assert.equal(address,'https://api.openai.com/v1/responses');
 const body=String(init?.body),wire=JSON.parse(body);
 assert.equal(wire.model,'gpt-5.6-terra');assert.equal(wire.max_output_tokens,30000);assert.equal(wire.text.format.strict,true);assert.equal(wire.reasoning?.effort,undefined);
 // Exact provider-facing instructions, input and schema must match the offline SDK dry run.
 if(!live){save('provider-request.exact.json',body);save('source-hashes.json',sourceHashes);throw Error('OFFLINE_PREFLIGHT_NO_PROVIDER_CALL');}
 assert.equal(body,readFileSync(`${dir}/provider-request.exact.json`,'utf8'),'Provider-facing request changed');assert.equal(hash(body),process.argv.find(a=>a.startsWith('--approved-sha256='))?.split('=')[1],'Approved hash required');
 assert.equal(calls,0,'Additional provider request forbidden');
 const transport=await probeConnectivity(wire,body);save('live-connectivity.json',transport);assert(transport.ok,'Same-process connectivity failed; no paid POST permitted');
 calls++;
 save('call-started.json',{startedAt:new Date().toISOString(),maxCalls:1,maxRetries:0});
 let response:Response;try{response=await nativeFetch(url,{...init,redirect:'error'});}catch(error){save('provider-transport-error.json',{errorType:error instanceof Error?error.name:'unknown',note:'No resubmission allowed; call may have reached provider.'});throw error;}save('provider-response.exact.json',await response.clone().text());save('provider-http.json',{status:response.status,requestId:response.headers.get('x-request-id')});return response;
};
try{
 const {POST}=await import('../src/app/api/ai/scene/route');
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
 const body=await response.json();
 save(live?'route-response.json':'preflight-route-response.json',body);
 if(body.responseId)for(const suffix of ['.json','.wire.json','.diagnostics.json','.provider.txt']){const path=`.data/scene-responses/${body.responseId}${suffix}`;if(existsSync(path))save(`${live?'retained':'preflight-retained'}${suffix}`,readFileSync(path,'utf8'));}
 if(body.scene)save('scene.UNAPPROVED.json',body.scene);
 if(body.recoverableDraft)save('draft.REJECTED.json',body.recoverableDraft);
 save(live?'call-result.json':'preflight-result.json',{status:response.status,providerCalls:calls,responseId:body.responseId,error:body.error,dbEvents});
 console.log(JSON.stringify({live,providerCalls:calls,status:response.status,approvedActive:context.trace.metrics.approvedActive,selected:context.trace.selected.length,elements:body.scene?.elements.length,draftElements:body.recoverableDraft?.elements.length,error:body.error}));
 if(!live){assert.equal(calls,0);assert(existsSync(`${dir}/provider-request.exact.json`),'Dry run did not reach provider boundary');assert.equal(response.status,422);assert(String(body.error).includes('OFFLINE_PREFLIGHT_NO_PROVIDER_CALL'));
 const exact=readFileSync(`${dir}/provider-request.exact.json`,'utf8');
 const connectivity=await probeConnectivity(JSON.parse(exact),exact);save('connectivity.json',connectivity);
 console.log(JSON.stringify({connectivityOk:connectivity.ok,failureStage:connectivity.failureStage,requestBytes:Buffer.byteLength(exact),requestSha256:hash(exact)}));}
}finally{globalThis.fetch=nativeFetch;}
process.exit(0);
