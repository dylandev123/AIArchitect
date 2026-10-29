/** Audits the real homepage handler; one durable live attempt, no retries. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {createHash} from 'node:crypto';
import {architecturalRequestContext} from '../src/lib/villa/scene/knowledgeContext';
import {sceneRequestSchema,sceneMessages,sceneResponseFormatSchema} from '../src/lib/villa/scene/terra';
import {Output} from 'ai';
const dir='docs/architecture/intelligence-comparison';
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}`,typeof value==='string'?value:JSON.stringify(value,null,2),{mode:0o600});
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim(),'Existing key missing');
// The application's configured database must already exist; prevent initializer DDL.
const {Pool}=await import('pg');
const query=Pool.prototype.query;
Pool.prototype.query=function(...args:any[]){if(typeof args[0]==='string' && /CREATE TABLE|CREATE INDEX/i.test(args[0]))return Promise.resolve({rows:[],rowCount:0}) as any;return query.apply(this,args as any);};
const live=process.argv.includes('--authorize-one-live-call');
assert(live||process.argv.includes('--preflight'));
mkdirSync(dir,{recursive:true});assert(!existsSync(`${dir}/call-started.json`),'Attempt consumed; retries forbidden');
const source='docs/architecture/distinct-houses/A/request.json';
const sourceText=readFileSync(source,'utf8');const input=sceneRequestSchema.parse(JSON.parse(sourceText));
const context=await architecturalRequestContext(input);
assert(context.trace.selected.some(k=>k.category==='property-value'));
for(const text of ['ARCHITECTURAL DESIGN GUIDE','EXECUTABLE CONSTRUCTION CONTRACT','COORDINATED ASSEMBLIES','programme','CONCEPT'])assert(context.system.includes(text),`Missing ${text}`);
const format=await Output.object({schema:await sceneResponseFormatSchema(input)}).responseFormat;
function audit(node:any){if(node.properties){assert.equal(node.additionalProperties,false);assert.deepEqual(node.required,Object.keys(node.properties));Object.values(node.properties).forEach(audit);}if(node.items)audit(node.items);if(node.anyOf)node.anyOf.forEach(audit);assert(!('default' in node));}
assert(format?.type==='json');audit(format.schema);
const fingerprint=hash(JSON.stringify({input,context,format}));
if(!live){save('preflight.json',{fingerprint,source,sourceSha256:hash(sourceText),providerCalls:0,context,format,messages:sceneMessages(input)});save('request.json',input);console.log(JSON.stringify({preflight:true,approvedActive:context.trace.metrics.approvedActive,selected:context.trace.selected,systemChars:context.system.length}));process.exit(0);}
assert.equal(JSON.parse(readFileSync(`${dir}/preflight.json`,'utf8')).fingerprint,fingerprint,'Preflight changed');
let calls=0;const original=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 const address=String(url instanceof Request?url.url:url);assert.equal(address,'https://api.openai.com/v1/responses');
 assert.equal(++calls,1,'Second request forbidden');const body=String(init?.body);const wire=JSON.parse(body);
 assert.equal(wire.text.format.strict,true);audit(wire.text.format.schema);assert.equal(wire.max_output_tokens,30000);
 save('provider-request.exact.json',body);
 writeFileSync(`${dir}/call-started.json`,JSON.stringify({at:new Date().toISOString(),maxCalls:1,maxRetries:0,fingerprint}),{flag:'wx',mode:0o600});
 const response=await original(url,init);save('provider-response.exact.json',await response.clone().text());save('provider-http.json',{status:response.status,requestId:response.headers.get('x-request-id')});return response;
};
try{
 const {POST}=await import('../src/app/api/ai/scene/route');
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
 const body=await response.json();save('route-response.json',body);
 if(body.responseId)for(const suffix of ['.json','.wire.json','.diagnostics.json','.provider.txt']){const path=`.data/scene-responses/${body.responseId}${suffix}`;if(existsSync(path))save(`retained${suffix}`,readFileSync(path,'utf8'));}
 if(body.scene)save('scene.UNAPPROVED.json',body.scene);
 if(body.recoverableDraft)save('draft.UNAPPROVED.json',body.recoverableDraft);
 save('call-result.json',{status:response.status,providerCalls:calls,responseId:body.responseId,approved:false,sourceUnchanged:hash(readFileSync(source,'utf8'))===hash(sourceText),error:body.error});
 console.log(JSON.stringify({status:response.status,providerCalls:calls,responseId:body.responseId,elements:body.scene?.elements.length,draftElements:body.recoverableDraft?.elements?.length,error:body.error}));
}finally{globalThis.fetch=original;}
