/** One normal Generate request, immutable evidence, no retries or database writes.
 * Credentials are loaded by Next and never recorded. Run each phase/brief once. */
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync, existsSync, readFileSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {Pool, Client} from 'pg';

const briefs: Record<string,string> = {
 tropical: 'Design a beautiful modern tropical villa with three bedrooms, a pool, shaded terrace and welcoming entrance.',
 hillside: 'Design a luxury Caribbean hillside home with four bedrooms, ocean views, a pool and generous outdoor living.',
 family: 'Design a contemporary family house with four bedrooms, a pool, private garden and covered outdoor dining.',
 romantic: 'Design a romantic dream home with three bedrooms, a beautiful garden and terrace.',
 narrow: 'Design a compact modern house with three bedrooms on a narrow 8 metre wide lot, with a private garden and welcoming entrance.',
};
const [phase,brief] = process.argv.slice(2);
assert(['baseline','improved','final'].includes(phase) && brief in briefs, 'Use baseline|improved|final tropical|hillside|family|romantic|narrow');
assert(process.argv.includes('--live'), 'Explicit --live required');
loadEnvConfig(process.cwd());
assert(process.env.OPENAI_API_KEY?.trim(), 'Existing API configuration required');
const dir=`docs/architecture/generation-quality/${phase}-${brief}${process.argv.includes('--network-attempt')?'-network':''}`;
mkdirSync(dir,{recursive:true});
assert(!existsSync(`${dir}/started.json`), 'This attempt has already been consumed; no automatic resubmission');
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}`,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
// Retain normal retrieval; redirect usage bookkeeping into this local evidence.
process.env.PGOPTIONS='-c default_transaction_read_only=on';
for(const proto of [Pool.prototype,Client.prototype]) {
 const original=proto.query;
 // pg supports several overloaded callback signatures; forward SELECTs unchanged.
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 (proto as any).query=function(...args:any[]) {
  const sql=typeof args[0]==='string'?args[0]:args[0]?.text;
  assert.equal(typeof sql,'string');
  if(/^\s*CREATE TABLE/i.test(sql))return Promise.resolve({rows:[],rowCount:0});
  if(/^\s*INSERT INTO ai_usage\b/i.test(sql)){save('usage.json',args[1]);return Promise.resolve({rows:[],rowCount:0});}
  assert(/^\s*SELECT\b/i.test(sql)&&!sql.includes(';'),'Database mutation blocked');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (original as any).apply(this,args);
 };
}
let calls=0;
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
 const address=String(url instanceof Request?url.url:url);
 assert.equal(address,'https://api.openai.com/v1/responses');
 assert.equal(++calls,1,'Only one provider request allowed');
 save('provider-request.json',JSON.parse(String(init?.body)));
 const response=await nativeFetch(url,init);
 save('provider-response.json',JSON.parse(await response.clone().text()));
 return response;
};
save('started.json',{phase,brief,prompt:briefs[brief],startedAt:new Date().toISOString(),maxProviderCalls:1});
try {
 const {POST}=await import('../src/app/api/ai/scene/route');
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify({mode:'generate',prompt:briefs[brief]})}));
 const body=await response.json();
 save('result.json',body);
 const scene=body.scene??body.recoverableDraft;
 if(scene)save('scene.json',scene);
 if(body.responseId){const path=`.data/scene-responses/${body.responseId}.json`;if(existsSync(path))save('retained.json',JSON.parse(readFileSync(path,'utf8')));}
 save('summary.json',{httpStatus:response.status,providerCalls:calls,elements:scene?.elements.length,accepted:!!body.scene,error:body.error,experiment:body.experiment});
 console.log(JSON.stringify({phase,brief,httpStatus:response.status,providerCalls:calls,elements:scene?.elements.length,accepted:!!body.scene,error:body.error}));
} finally {globalThis.fetch=nativeFetch;}
process.exit(0);
