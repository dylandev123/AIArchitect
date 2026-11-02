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
const dir='docs/architecture/complete-mansion-2026-10-30';
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
const prompt=`Design and construct an extraordinary contemporary Caribbean waterfront estate in Saint Lucia with an estimated property value of US$25 million.

The property occupies a spacious waterfront site with ocean views and a gently sloping landscape.

Create a sophisticated luxury residence with approximately six generous bedroom suites, expansive living and entertainment spaces, a memorable entrance, exceptional indoor-outdoor connections, substantial terraces, a spectacular infinity pool and integrated tropical landscaping.

Develop a coherent architectural concept with impressive massing, coordinated building volumes, beautiful proportions, interesting elevations, sophisticated materials and an unmistakable luxury-estate presence.

You have creative freedom over the building composition, number of levels, architectural style, roof forms and overall arrangement.

Construct the complete, editable 3D exterior architecture rather than a small conceptual representation.`;
const input=sceneRequestSchema.parse({mode:'generate',prompt});
const context=await architecturalRequestContext(input);
assert.equal(context.trace.project.scale,'estate','Exact mansion brief must retrieve estate-scale knowledge');
assert.equal(context.trace.budget.tier,'complex');
for(const id of ['estate-composition','waterfront-estate','tropical-envelope','infinity-pool'])assert(context.trace.selected.some(entry=>entry.id===id),`Missing estate knowledge: ${id}`);
assert(!context.trace.selected.some(entry=>entry.id==='compact-family'),'Compact-family guidance is inappropriate for this brief');
assert(context.system.includes('Always design on one level ground plane at Y=0')&&context.system.includes('Do not emit set-terrain during generation'),'Expected documented flat-site approximation');
assert(context.system.includes('PHYSICAL PROGRAMME BEFORE GEOMETRY'), 'Numeric planning guidance missing');
assert.equal(getAiModelId(),'gpt-5.6-terra','Default model differs from authorized model');
const format=await Output.object({schema:await sceneResponseFormatSchema(input)}).responseFormat;
const messages=sceneMessages(input);
function sourceFiles(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(`${root}/${e.name}`):[`${root}/${e.name}`]);}
const sourceHashes=Object.fromEntries([...sourceFiles('src'), 'package.json','package-lock.json','scripts/complete-mansion-once.ts'].sort().map(path=>[path,hash(readFileSync(path,'utf8'))]));
const fingerprint=hash(JSON.stringify({system:context.system,messages,format,sourceHashes}));
if(!live){save('request.json',input);save('preflight.json',{fingerprint,sourceHashes,model:getAiModelId(),reasoningEffort:null,reasoningPolicy:'unset, normal production default',maxOutputTokens:30000,maxRetries:0,timeoutMs:170000,context,format,messages});}
else assert.equal(JSON.parse(readFileSync(`${dir}/preflight.json`,'utf8')).fingerprint,fingerprint,'Context changed since preflight');
let calls=0;const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 const address=String(url instanceof Request?url.url:url);assert.equal(address,'https://api.openai.com/v1/responses');
 const body=String(init?.body),wire=JSON.parse(body);
 assert.equal(wire.model,'gpt-5.6-terra');assert.equal(wire.max_output_tokens,30000);assert.equal(wire.text.format.strict,true);assert.equal(wire.reasoning?.effort,undefined);
 // Exact provider-facing instructions, input and schema must match the offline SDK dry run.
 if(!live){save('provider-request.exact.json',body);throw Error('OFFLINE_PREFLIGHT_NO_PROVIDER_CALL');}
 assert.deepEqual(wire,JSON.parse(readFileSync(`${dir}/provider-request.exact.json`,'utf8')),'Provider-facing request changed');
 assert.equal(++calls,1,'Additional provider request forbidden');
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
 if(!live){assert.equal(calls,0);assert(existsSync(`${dir}/provider-request.exact.json`),'Dry run did not reach provider boundary');assert.equal(response.status,422);assert(String(body.error).includes('OFFLINE_PREFLIGHT_NO_PROVIDER_CALL'));}
}finally{globalThis.fetch=nativeFetch;}
process.exit(0);
