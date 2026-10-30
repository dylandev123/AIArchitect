/** Actual Generate route, one guarded paid POST, read-only database. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {Pool,Client} from 'pg';
import {architecturalRequestContext} from '../src/lib/villa/scene/knowledgeContext';
import {sceneRequestSchema,sceneMessages,sceneResponseFormatSchema} from '../src/lib/villa/scene/terra';
import {getAiModelId} from '../src/lib/ai/model';
import {Output} from 'ai';
const dir='docs/architecture/terra-controlled-estate-2026-10-29';
const live=process.argv.includes('--authorize-one-live-call');
assert(live||process.argv.includes('--preflight'));
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
const prompt=`Design and fully construct an extraordinary US$25 million contemporary Caribbean waterfront estate on a spacious, gently sloping oceanfront property.

Create a distinctive, architecturally exceptional luxury residence with approximately six bedroom suites, spectacular indoor-outdoor living spaces, a memorable entrance, coordinated multi-level architecture, terraces, a substantial infinity pool and tropical landscaping.

You have complete creative freedom over the architectural composition, building arrangement, architectural style, materials, roof forms and spatial organization.

Avoid generic rectangular buildings and repetitive disconnected boxes.

Produce a coherent, impressive, properly coordinated and fully editable 3D architectural design, with meaningful room layouts, connected circulation, attractive façades and properly constructed roofs.

Construct the actual house, not just a concept description.`;
const input=sceneRequestSchema.parse({mode:'generate',prompt});
const context=await architecturalRequestContext(input);
assert.equal(context.trace.metrics.approvedActive,334,'Expected approved inventory unavailable');
assert.equal(getAiModelId(),'gpt-5.6-terra','Default model differs from authorized model');
const format=await Output.object({schema:await sceneResponseFormatSchema(input)}).responseFormat;
const messages=sceneMessages(input);
const fingerprint=hash(JSON.stringify({system:context.system,messages,format}));
if(!live){save('request.json',input);save('preflight.json',{fingerprint,model:getAiModelId(),reasoningEffort:null,reasoningPolicy:'unset, normal production default',maxOutputTokens:30000,maxRetries:0,timeoutMs:170000,context,format,messages});}
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
 const response=await nativeFetch(url,init);save('provider-response.exact.json',await response.clone().text());save('provider-http.json',{status:response.status,requestId:response.headers.get('x-request-id')});return response;
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
}finally{globalThis.fetch=nativeFetch;}
