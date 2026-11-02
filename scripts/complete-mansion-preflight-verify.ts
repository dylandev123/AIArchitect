/** Read-only verification: exact frozen payload plus optional GET-only connectivity.
 * Never calls Responses POST or any other generation endpoint. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {connectivityPreflight} from './reference-connectivity';
const dir='docs/architecture/complete-mansion-2026-10-30';
const read=(n:string)=>JSON.parse(readFileSync(`${dir}/${n}`,'utf8'));
const pre=read('preflight.json'),wire=read('provider-request.exact.json'),result=read('preflight-result.json');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
assert(!existsSync(`${dir}/call-started.json`));
for(const [path,digest]of Object.entries(pre.sourceHashes))assert.equal(hash(readFileSync(path,'utf8')),digest,path);
const brief=readFileSync(`${dir}/brief.txt`,'utf8').trimEnd();
assert.equal(read('request.json').prompt,brief);
assert.equal(pre.context.trace.project.scale,'estate');
assert.equal(pre.context.trace.project.propertyValue.amount,25000000);
assert.equal(pre.context.trace.budget.tier,'complex');
const selected=pre.context.trace.selected as {id:string;category:string}[];
for(const id of ['estate-composition','waterfront-estate','tropical-envelope','infinity-pool','property-value-25m-50m'])assert(selected.some(e=>e.id===id),id);
assert(!selected.some(e=>e.id==='compact-family'));
const developer=wire.input.find((m:{role:string})=>m.role==='developer');
assert.equal(developer.content,pre.context.system);
assert(developer.content.includes('PHYSICAL PROGRAMME BEFORE GEOMETRY'));
assert(developer.content.includes('six times the chosen suite area'));
for(const id of selected.map(e=>e.id))assert(developer.content.includes(`"id":"${id}"`),id);
assert(!pre.context.trace.text.includes('"id":"compact-family"'));
const user=wire.input.find((m:{role:string})=>m.role==='user');
assert.equal(JSON.parse(user.content.find((c:{type:string})=>c.type==='input_text').text).prompt,brief);
assert.equal(wire.model,'gpt-5.6-terra');assert.equal(wire.max_output_tokens,30000);
assert.equal(wire.reasoning?.effort,undefined);assert.equal(wire.text.format.strict,true);
assert(wire.text.format.schema.properties.architecturalPlan.required.includes('physicalProgramme'));
assert.equal(wire.text.format.schema.properties.operations.maxItems,800);
assert.equal(pre.maxRetries,0);assert.equal(pre.timeoutMs,170000);assert.equal(result.providerCalls,0);
const terrainPolicy=(developer.content as string).match(/NEW GENERATION SITE POLICY: ([^\n]+)/)?.[0];
assert(terrainPolicy?.includes('Always design on one level ground plane at Y=0'));
assert(terrainPolicy?.includes('Do not emit set-terrain during generation'));
assert(terrainPolicy?.includes('disclose the temporary flat-site constraint'));
let connectivity:Awaited<ReturnType<typeof connectivityPreflight>>|undefined;
const httpRequests:{url:string;method:string}[]=[];
if(process.argv.includes('--connectivity')){
 loadEnvConfig(process.cwd());
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{
  const address=String(url instanceof Request?url.url:url);
  assert(['https://api.openai.com/v1/models','https://api.openai.com/v1/responses'].includes(address));
  assert.equal(init?.method,'GET');assert.equal(init?.body,undefined);
  httpRequests.push({url:address,method:'GET'});return nativeFetch(url,init);
 };
 try{connectivity=await connectivityPreflight();}finally{globalThis.fetch=nativeFetch;}
}
const wireChars=JSON.stringify(wire).length,estimatedInputTokens=Math.ceil(wireChars/4);
const report={at:new Date().toISOString(),status:connectivity&&!connectivity.ok?'connectivity-blocked':'offline-payload-verified',paidGenerationRequests:0,originalBriefPreserved:true,sourceFingerprint:pre.fingerprint,sourceHashesMatch:true,providerRequestSha256:hash(readFileSync(`${dir}/provider-request.exact.json`,'utf8')),project:pre.context.trace.project,budget:pre.context.trace.budget,selected,compactGuidanceSelected:false,terrain:{approximation:'Single flat ground plane Y=0; ground slabs rest on it. Gentle slope is not constructed.',policy:terrainPolicy,limitations:['No accurate site grading, terrain-following foundations, retaining structures, drainage or shoreline/bathymetric model is established.','Waterfront orientation, views and architecture may be designed, but a marketing description or scenic name is not terrain evidence.','The unchanged original brief still requests a gentle slope; the existing higher-priority generation policy explicitly requires disclosing the approximation.']},construction:{workflow:'normal Generate route, SDK, retrieval, construction and validation',model:wire.model,reasoning:'provider-default; unset',maxOutputTokens:wire.max_output_tokens,maxOperations:800,strictSchema:true,requiredPhysicalProgramme:true,maxRetries:pre.maxRetries,timeoutMs:pre.timeoutMs},estimate:{wireChars,estimatedInputTokens,method:'wire characters / 4; not tokenizer measurement',usdAt30000Output:estimatedInputTokens*2/1e6+.36,hardDollarCap:false},connectivity,httpRequests};
writeFileSync(`${dir}/corrected-preflight-verification.json`,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:report.status,scale:report.project.scale,selected:selected.map(e=>e.id),paidGenerationRequests:0,connectivity:connectivity?{ok:connectivity.ok,http:connectivity.http,providerEndpoint:connectivity.providerEndpoint}:undefined}));
if(connectivity)assert.equal(connectivity.ok,true,'Read-only connectivity check failed; see retained report');
