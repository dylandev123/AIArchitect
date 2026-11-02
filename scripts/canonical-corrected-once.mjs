import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import nextEnv from '@next/env';
import {semanticTransportPreflight,safeTransportError} from './semantic-transport-preflight.mjs';
const dir='docs/architecture/canonical-corrected-mansion-2026-11-02';
const wire=readFileSync('docs/architecture/canonical-schema-compatibility/provider-request.prepared.NOT-SUBMITTED.json');
const sha=createHash('sha256').update(wire).digest('hex');
assert.equal(sha,'30623b205a0dff0f0aba72b636747ac2f7adbb792fb5c1390eeb2fc41a540ee7');
nextEnv.loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim());
mkdirSync(dir,{recursive:true});
const save=(n,v)=>writeFileSync(`${dir}/${n}`,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
assert(!existsSync(`${dir}/call-started.json`),'Authorization consumed; no resubmission');
save('provider-request.exact.json',wire);
const preflight=await semanticTransportPreflight(JSON.parse(wire),wire.toString());
save('connectivity.json',preflight);console.log(JSON.stringify({preflightOk:preflight.ok,sha256:sha}));
assert(preflight.ok,'Connectivity failed; zero paid calls');
save('call-started.json',{at:new Date().toISOString(),sha256:sha,maxCalls:1,retries:0,fallbacks:0,automaticRepairs:0});
try {
 const start=Date.now();
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:wire,redirect:'error',signal:AbortSignal.timeout(170000)});
 const raw=await r.text();save('provider-response.exact.json',raw);
 save('provider-http.json',{status:r.status,requestId:r.headers.get('x-request-id'),latencyMs:Date.now()-start});
 const data=JSON.parse(raw);save('usage.json',data.usage??null);
 save('call-result.json',{providerCalls:1,status:r.status,responseStatus:data.status,error:data.error??null});
 console.log(JSON.stringify({providerCalls:1,httpStatus:r.status,responseStatus:data.status,usage:data.usage,error:data.error}));
} catch(e){save('transport-error.json',{error:safeTransportError(e),note:'No resubmission: request may have reached provider.'});throw e;}
