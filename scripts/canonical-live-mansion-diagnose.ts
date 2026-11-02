/** Offline only: no credential loading, retrieval or provider calls. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Output} from 'ai';
import {canonicalProposalSchema} from '../src/lib/villa/canonical/plan';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
const dir='docs/architecture/canonical-live-mansion-2026-11-02';
const read=(n:string)=>JSON.parse(readFileSync(`${dir}/${n}`,'utf8'));
const wire=read('provider-request.exact.json');
const http=read('provider-http.json'),response=read('provider-response.exact.json');
assert.equal(http.status,400);assert.equal(response.error.code,'invalid_json_schema');
const format=await Output.object({schema:await strictSceneResponseSchema(canonicalProposalSchema)}).responseFormat;
// SDK Output.responseFormat uses schema directly; provider adds name/strict.
assert.deepEqual(format.schema,wire.text.format.schema);
const findings:{path:string;issue:string;fields?:string[]}[]=[];
function walk(node:unknown,path='$'){
 if(!node||typeof node!=='object')return;
 const n=node as Record<string,unknown>;
 if(n.oneOf)findings.push({path,issue:'oneOf survives strict adapter'});
 if(n.properties){const required=new Set(n.required as string[]??[]);const missing=Object.keys(n.properties as object).filter(k=>!required.has(k));if(missing.length)findings.push({path,issue:'optional fields not converted to required nullable properties inside untouched union',fields:missing});}
 for(const [k,v] of Object.entries(n))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach((a,i)=>walk(a,`${path}.${k}[${i}]`));else walk(v,`${path}.${k}`);}
}
walk(format.schema);assert(findings.some(f=>f.path==='$'&&f.issue.startsWith('oneOf')));
const result={offline:true,providerCalls:0,exactFrozenSha256:createHash('sha256').update(readFileSync(`${dir}/provider-request.exact.json`)).digest('hex'),currentSchemaReproducesRejectedSchema:true,providerFailure:response.error,findings,compilerInvoked:false,canonicalPlan:null,geometry:null,usage:{providerReported:null,localLogger:read('usage-record.json'),interpretation:'HTTP 400 contains no token usage. Local logger defaults missing usage to zero; its $0 is not an invoiced-cost verification.'},outcomes:{ambition:'Unassessed: no model design',fidelity:'Unassessed: compiler not reached',visualQuality:'Unassessed: no construction or renders'},nextStep:'Offline provider-wire contract correction and tests before a separately authorized request. No correction or resubmission performed.'};
writeFileSync(`${dir}/offline-diagnosis.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({schemaReproduced:true,findings,providerCalls:0}));
