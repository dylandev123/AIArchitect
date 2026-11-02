// Single frozen-payload request; no application imports, database or retries.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const baseline='docs/architecture/design-first/live-after-rehearsal-2026-10-30';
const prepared='docs/architecture/design-first/planning-failure-audit';
const dest='docs/architecture/design-first/sol-planning-comparison-2026-10-30';
const hash=x=>createHash('sha256').update(x).digest('hex');
const original=fs.readFileSync(`${baseline}/design.provider-request.exact.json`);
const alternative=fs.readFileSync(`${prepared}/alternative.request.NOT-SUBMITTED.json`);
const manifest=JSON.parse(fs.readFileSync(`${prepared}/comparison.json`));
for(const [name,digest] of Object.entries(manifest.baselineFilesSHA256)) assert.equal(hash(fs.readFileSync(`${baseline}/${name}`)),digest);
assert.equal(hash(alternative),manifest.alternativeRequestSHA256);
const wire=JSON.parse(alternative),terra=JSON.parse(original);
assert.equal(wire.model,'gpt-5.6-sol');
assert.deepEqual({...wire,model:terra.model},terra);
assert.deepEqual(Object.keys(wire).sort(),['input','max_output_tokens','model','text']);
assert.equal(wire.max_output_tokens,30000);
assert.equal(wire.text.format.type,'json_schema');assert.equal(wire.text.format.strict,true);
assert(Buffer.byteLength(alternative)<100000);
fs.mkdirSync(dest,{recursive:true});
const save=(name,value)=>fs.writeFileSync(`${dest}/${name}`,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
if(!process.argv.includes('--live')) {
 save('terra.request.exact.json',original);save('sol.request.exact.json',alternative);
 save('terra.response.exact.json',fs.readFileSync(`${baseline}/design.provider-response.exact.json`));
 save('terra.proposal.exact.txt',fs.readFileSync(`${baseline}/proposal.provider-output.exact.txt`));
 save('preflight.json',{at:new Date().toISOString(),availability:{httpStatus:200,model:'gpt-5.6-sol',method:'GET /v1/models/gpt-5.6-sol; no generation'},changedFields:['model'],originalRequestHash:hash(original),solRequestHash:hash(alternative),schemaHash:hash(JSON.stringify(wire.text.format.schema)),requestBytes:alternative.length,compatibility:'Responses and strict structured output supported; identical schema already accepted by Terra; no unsupported sampling, tools, modalities or reasoning overrides.',ratesUsdPerMillion:{input:4,cachedInput:.4,output:20,cacheWriteInput:5},expectedAtBaselineTokensUsd:.20252,conservativeUpperBoundUsd:1,boundBasis:'Text-only request under 100,000 UTF-8 bytes; conservative 80,000 input tokens at $5/M including cache write + 30,000 output tokens at $20/M = $1. No tool charges; below long-context threshold.',pricingSource:'https://developers.openai.com/api/docs/models/gpt-5.6-sol',maxPaidCalls:1,retries:0,constructionCalls:0});
 console.log('Preflight preserved; no planning request submitted.');
} else {
 assert(fs.existsSync(`${dest}/preflight.json`));
 assert.equal(hash(fs.readFileSync(`${dest}/sol.request.exact.json`)),hash(alternative));
 for(const p of ['.env.local','.env'])if(fs.existsSync(p))process.loadEnvFile(p);
 assert(process.env.OPENAI_API_KEY);
 save('call-started.json',{at:new Date().toISOString(),maxPaidCalls:1,retries:0,requestHash:hash(alternative),authorization:'User authorized ONE frozen-payload Sol planning request and reuse of existing key.'});
 try {
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:alternative,redirect:'error',signal:AbortSignal.timeout(900000)});
  const bytes=await response.text(); save('sol.response.exact.json',bytes);
  save('http.json',{status:response.status,requestId:response.headers.get('x-request-id'),endedAt:new Date().toISOString()});
  const result=JSON.parse(bytes);
  const output=(result.output??[]).flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
  save('sol.proposal.exact.txt',output);
  const u=result.usage;
  const cost=u?((u.input_tokens-(u.input_tokens_details?.cached_tokens??0))*4+(u.input_tokens_details?.cached_tokens??0)*.4+(u.input_tokens_details?.cache_write_tokens??0)*1+u.output_tokens*20)/1e6:null;
  save('result.json',{httpStatus:response.status,id:result.id,model:result.model,status:result.status,usage:u,estimatedCostUsd:cost,outputHash:hash(output),paidRequests:1,retries:0,constructionCalls:0});
  console.log(JSON.stringify({httpStatus:response.status,status:result.status,usage:u,estimatedCostUsd:cost}));
 } catch(e) {save('transport-error.json',{type:e.name,message:'Request stopped; provider may have received it. No retry authorized.'});throw e;}
}
