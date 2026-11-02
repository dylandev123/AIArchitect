/** One authorized request. Durable exclusive marker prevents any resubmission. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { semanticTransportPreflight, safeTransportError } from './semantic-transport-preflight.mjs';
import {createHash} from 'node:crypto';
const originalDir='docs/architecture/semantic-generation/live-2026-10-31';
// Fresh user authorization is scoped to one exclusive new attempt, never the old lock.
const fresh=process.argv.includes('--fresh-authorized-2026-10-31');
const dir=fresh?'docs/architecture/semantic-generation/live-fresh-2026-10-31':originalDir;
fs.mkdirSync(dir,{recursive:true});
const save=(n,v)=>fs.writeFileSync(`${dir}/${n}`,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const original=fs.readFileSync('docs/architecture/semantic-generation/mansion.request.NOT-SUBMITTED.json','utf8');
// Send the exact retained experiment bytes; never rebuild or rewrite the prompt.
const wire=fs.readFileSync(`${originalDir}/request.exact.json`,'utf8');
assert.equal(createHash('sha256').update(wire).digest('hex'),'3c99dee2f4a3becda07e405d27e018d976fbc1d82d52cc8a34ff36d3d6e8b8ed','Retained payload changed');
const request=JSON.parse(wire);
assert.equal(request.model,'gpt-5.6-terra');assert.equal(request.max_output_tokens,30000);
for(const p of ['.env.local','.env'])if(fs.existsSync(p))process.loadEnvFile(p);
assert(process.env.OPENAI_API_KEY,'Configured key missing');
// Always run fresh checks in this exact Node process; never trust a saved green result.
const retained=fs.readFileSync(`${originalDir}/request.exact.json`,'utf8');
assert.equal(wire,retained,'Prepared experiment changed; refusing connectivity/live checks.');
const network=await semanticTransportPreflight(request,wire);
const evidence=`${dir}/transport-preflight-${Date.now()}-${process.pid}.json`;
fs.writeFileSync(evidence,JSON.stringify(network,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({evidence,...network}));
if(!network.ok)process.exit(1);
if(!process.argv.includes('--live'))process.exit(0);
assert(fresh,'Fresh attempt authorization flag required; historical attempt remains locked.');
assert(process.env.SEMANTIC_VERIFIED_KEY_SUFFIX,'Privately matched Platform key identifier required.');
assert(process.env.OPENAI_API_KEY.endsWith(process.env.SEMANTIC_VERIFIED_KEY_SUFFIX),'Configured credential does not match privately verified Platform key.');
// The previous attempt has unknown billing status. No flag permits replaying it.
assert(!fs.existsSync(`${dir}/call-started.json`),'Original attempt locked; a separately authorized new attempt is required.');
save('request.exact.json',wire);
save('preflight.json',{viable:true,authorization:'User explicitly approved one semantic-generation mansion experiment; reuse configured credential; unsupported site/roof features are explicit limitations.',originalRequestSha256:createHash('sha256').update(original).digest('hex'),submittedRequestSha256:createHash('sha256').update(wire).digest('hex'),model:request.model,maxOutputTokens:30000,paidCallLimit:1,retries:0,fallbacks:0,productionChanges:false,pricing:{input:2,cachedInput:.2,output:12,cacheWrite:2.5,unit:'USD per million tokens',source:'https://developers.openai.com/api/docs/pricing',verified:'2026-10-31',invoice:false},scope:'Original mansion brief and schema retained. Only experimental instruction rejecting unsupported ancillary features replaced with explicit limited-study authorization.'});
save('call-started.json',{at:new Date().toISOString(),maxPaidCalls:1,retries:0});
try{
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:wire,redirect:'error',signal:AbortSignal.timeout(900000)});
 save('http.json',{status:response.status,requestId:response.headers.get('x-request-id'),headersReceivedAt:new Date().toISOString()});
 const fd=fs.openSync(`${dir}/response.exact.json`,'wx');
 try {for await(const chunk of response.body??[])fs.writeSync(fd,chunk);}finally{fs.closeSync(fd);}
 const raw=fs.readFileSync(`${dir}/response.exact.json`,'utf8');
 const result=JSON.parse(raw),output=(result.output??[]).flatMap(o=>o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');save('proposal.exact.txt',output);
 const u=result.usage,cached=u?.input_tokens_details?.cached_tokens??0,write=u?.input_tokens_details?.cache_write_tokens??0;
 save('result.json',{httpStatus:response.status,id:result.id,model:result.model,status:result.status,usage:u,estimatedCostUsd:u?((u.input_tokens-cached)*2+cached*.2+write*.5+u.output_tokens*12)/1e6:null,costQualification:'Published-rate estimate, not invoice; reasoning included in output usage.',paidRequests:1,retries:0});
 console.log(JSON.stringify({httpStatus:response.status,status:result.status,usage:u}));
 if(!response.ok){console.error(JSON.stringify({error:result.error}));process.exitCode=1;}
}catch(e){save('transport-error.json',{...safeTransportError(e),at:new Date().toISOString(),pid:process.pid,node:process.version,method:'POST',endpoint:'https://api.openai.com/v1/responses',requestSha256:createHash('sha256').update(wire).digest('hex'),billingStatus:'unknown',retry:false});throw Error('Transport stopped. See preserved evidence; do not retry.');}
