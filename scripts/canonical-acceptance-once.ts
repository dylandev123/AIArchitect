/* eslint-disable @typescript-eslint/no-explicit-any -- pg query overload forwarding follows the existing read-only harness. */
/** Actual Generate route, one guarded paid POST, read-only database. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {Pool,Client} from 'pg';
import {architecturalRequestContext} from '../src/lib/villa/scene/knowledgeContext';
import {sceneRequestSchema,sceneMessages,sceneResponseFormatSchema} from '../src/lib/villa/scene/terra';
import {getAiModelId} from '../src/lib/ai/model';
import {Output} from 'ai';
import {CANONICAL_INSTRUCTIONS,canonicalProposalSchema} from '../src/lib/villa/canonical/plan';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
// @ts-expect-error Existing GET-only transport helper has no declaration.
import {semanticTransportPreflight} from './semantic-transport-preflight.mjs';
const dir='docs/architecture/canonical-acceptance-2026-11-02';
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
const prompt=`Design an extraordinary contemporary Caribbean waterfront estate in Saint Lucia with an estimated property value of US$25 million, approximately six generous bedroom suites, expansive living and entertainment spaces, a memorable entrance, exceptional indoor-outdoor connections, substantial shaded terraces and a rectangular swimming pool.

Aim for sophisticated luxury architecture: a clear architectural idea, hierarchy of primary and subordinate volumes, beautiful proportions, privacy, climatic shading, considered facade depth, coordinated materials and compelling arrival and waterfront elevations. Resolve individual suite allocations, social and service accommodation and actual connected circulation rather than relying on room-capacity labels.

You have creative freedom over composition, spatial organization, number of levels, entrance relationships, roof forms and building arrangement within the canonical compiler's documented capabilities. No three-pavilion arrangement, fixed roof style or predefined mansion template is required. Select your own architectural decisions; the deterministic compiler calculates supported geometry, shared boundaries, openings, floors and stairs.

This experiment requests the supported editable architectural envelope, not complete fit-out, landscaping, terrain or marine engineering. Use the documented flat-site representation; ocean context is conceptual. Lawn/bed surfaces are sufficient landscape reserves; planting and grading are outside this test. A rectangular pool is requested, not an unsupported infinity-edge amenity. Do not claim those unsupported features are constructed.

Use the extended canonical contract faithfully. If your intended architectural decision is unsupported, preserve and disclose that decision or return decision-required; never silently replace it with ordinary rectangles. Do not omit programme or flatten ambitious design merely to claim completion. The resulting architecture will be judged in aerial, arrival, garden and poolside views, separately from schema acceptance and construction fidelity.`;
const input=sceneRequestSchema.parse({mode:'generate',prompt});
if(!live){if(existsSync(`${dir}/brief.NOT-SUBMITTED.json`))assert.deepEqual(JSON.parse(readFileSync(`${dir}/brief.NOT-SUBMITTED.json`,'utf8')),input);else save('brief.NOT-SUBMITTED.json',input);}
let context:Awaited<ReturnType<typeof architecturalRequestContext>>;
try { context=await architecturalRequestContext(input); }
catch(error){
 const failure={stage:'normal-knowledge-retrieval',paidCalls:0,error:error instanceof Error?error.message:'Unknown retrieval error',exactRequestPrepared:false};
 save(live?'live-retrieval-failure.json':'retrieval-failure.json',failure);
 if(!live){const probe={model:'gpt-5.6-terra',max_output_tokens:30000};const connectivity=await semanticTransportPreflight(probe,JSON.stringify(probe));save('connectivity-blocked-request.json',connectivity);console.log(JSON.stringify({failure,connectivity}));}
 process.exit(1);
}

assert(['estate','mansion'].includes(context.trace.project.scale),'Mansion-scale knowledge required');
assert.equal(context.trace.budget.tier,'complex');
assert.equal(getAiModelId(),'gpt-5.6-terra');
const format=await Output.object({schema:await strictSceneResponseSchema(canonicalProposalSchema)}).responseFormat;
const system=CANONICAL_INSTRUCTIONS+context.trace.text;
const messages=sceneMessages(input);
function sourceFiles(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(`${root}/${e.name}`):[`${root}/${e.name}`]);}
const sourceHashes=Object.fromEntries([...sourceFiles('src'), 'package.json','package-lock.json','scripts/canonical-acceptance-once.ts'].sort().map(path=>[path,hash(readFileSync(path,'utf8'))]));
const fingerprint=hash(JSON.stringify({system,messages,format,sourceHashes}));
if(!live){save('request.json',input);save('preflight.json',{fingerprint,sourceHashes,model:getAiModelId(),reasoningEffort:null,reasoningPolicy:'unset, normal production default',maxOutputTokens:30000,maxRetries:0,timeoutMs:170000,context,system,format,messages});}
else assert.equal(JSON.parse(readFileSync(`${dir}/preflight.json`,'utf8')).fingerprint,fingerprint,'Context changed since preflight');
let calls=0;const nativeFetch=globalThis.fetch;
async function probeConnectivity(request:unknown,wire:string){const guarded=globalThis.fetch;globalThis.fetch=nativeFetch;try{return await semanticTransportPreflight(request,wire);}finally{globalThis.fetch=guarded;}}
globalThis.fetch=async(url,init)=>{
 const address=String(url instanceof Request?url.url:url);assert.equal(address,'https://api.openai.com/v1/responses');
 const body=String(init?.body),wire=JSON.parse(body);
 assert.equal(wire.model,'gpt-5.6-terra');assert.equal(wire.max_output_tokens,30000);assert.equal(wire.text.format.strict,true);assert.equal(wire.reasoning?.effort,undefined);
 // Exact provider-facing instructions, input and schema must match the offline SDK dry run.
 if(!live){save('provider-request.exact.json',body);throw Error('OFFLINE_PREFLIGHT_NO_PROVIDER_CALL');}
 assert.deepEqual(wire,JSON.parse(readFileSync(`${dir}/provider-request.exact.json`,'utf8')),'Provider-facing request changed');
 assert.equal(calls,0,'Additional provider request forbidden');
 const transport=await probeConnectivity(wire,body);save('live-connectivity.json',transport);assert(transport.ok,'Same-process connectivity failed; no paid POST permitted');
 calls++;
 save('call-started.json',{startedAt:new Date().toISOString(),fingerprint,maxCalls:1,maxRetries:0});
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
