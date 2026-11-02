/** THE ONE PAID CALL of the second canonical plan-revision experiment. NOT RUN without separate, explicit approval.
 * Requires the approved request hash on the command line, refuses any other bytes, writes an exclusive
 * call-started marker before the single POST, never retries and never falls back.
 *   node scripts/canonical-second-revision-once.mjs --approve-sha <sha256 of the prepared request> */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import nextEnv from '@next/env';
import {semanticTransportPreflight,safeTransportError} from './semantic-transport-preflight.mjs';
const dir='docs/architecture/canonical-redesign-revision-2026-11-02';
const arg=process.argv[process.argv.indexOf('--approve-sha')+1];
const wire=readFileSync(`${dir}/request.prepared.NOT-SUBMITTED.json`);
const sha=createHash('sha256').update(wire).digest('hex');
assert(process.argv.includes('--approve-sha')&&arg===sha,`Refusing: pass --approve-sha ${sha} only after the request has been approved.`);
assert(!existsSync(`${dir}/call-started.json`),'Authorization consumed; no resubmission');
nextEnv.loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim(),'OPENAI_API_KEY is not configured');
const save=(n,v)=>writeFileSync(`${dir}/${n}`,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
save('provider-request.exact.json',wire);
const preflight=await semanticTransportPreflight(JSON.parse(wire),wire.toString());
save('connectivity.json',preflight);assert(preflight.ok,'Connectivity failed; zero paid calls');
save('call-started.json',{at:new Date().toISOString(),sha256:sha,maxCalls:1,retries:0,fallbacks:0,automaticRepairs:0,maxModelRevisions:1});
try{
 const start=Date.now();
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:wire,redirect:'error',signal:AbortSignal.timeout(170000)});
 const raw=await r.text();save('provider-response.exact.json',raw);save('provider-http.json',{status:r.status,requestId:r.headers.get('x-request-id'),latencyMs:Date.now()-start});
 const data=JSON.parse(raw);save('usage.json',data.usage??null);save('call-result.json',{providerCalls:1,status:r.status,responseStatus:data.status,error:data.error??null});
 console.log(JSON.stringify({providerCalls:1,httpStatus:r.status,responseStatus:data.status,usage:data.usage,error:data.error}));
}catch(e){save('transport-error.json',{error:safeTransportError(e),note:'No resubmission: the request may have reached the provider.'});throw e;}
