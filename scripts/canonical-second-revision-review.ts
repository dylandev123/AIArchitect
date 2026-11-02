/** Offline replay of the second revision response (no retrieval, credentials or network). Base plan = Terra's retained rejected
 * revision. Writes the record; if accepted for construction, compiles unchanged and writes the scene for browser rendering.
 * Architectural quality is NOT assessed here: that needs rendered evidence. Exclusive writes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Output} from 'ai';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {reviseCanonicalPlan,authorizeRevisionExperiment,sceneFromAcceptedRevision,revisionResponseSchema} from '../src/lib/villa/canonical/revision/revise';
import {renderPlanPng} from '../src/lib/villa/canonical/revision/planView';
import {rejectedRevision} from '../src/lib/villa/canonical/coordination.fixture';
import {computeCostUsd} from '../src/lib/ai/pricing';
const dir=process.argv[2]??'docs/architecture/canonical-redesign-revision-2026-11-02';
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2),{flag:'wx'});
const response=JSON.parse(readFileSync(`${dir}/provider-response.exact.json`,'utf8')),usage=response.usage;
const started=JSON.parse(readFileSync(`${dir}/call-started.json`,'utf8')),context=JSON.parse(readFileSync(`${dir}/request.context.json`,'utf8'));
if(usage)save('estimated-cost.json',{providerUsage:usage,estimatedUsd:computeCostUsd('gpt-5.6-terra',{inputTokens:usage.input_tokens,cachedInputTokens:usage.input_tokens_details?.cached_tokens??0,outputTokens:usage.output_tokens}),note:'Repository default rates; estimate, not an invoice.'});
const text=response.output?.flatMap((o:{content?:{type:string;text?:string}[]})=>(o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text)).join('')??'';
save('revision.exact.txt',text);
const output=Output.object({schema:await strictSceneResponseSchema(revisionResponseSchema)});
const grant=authorizeRevisionExperiment({experimentId:`second-revision-${started.at}`,authorizedBy:'user (separately approved request hash)',scope:'redesign-permitted',directive:'redesign'});
const record=await reviseCanonicalPlan({authorization:grant,brief:context.brief,plan:rejectedRevision(),image:true,model:response.model,
 submit:async()=>{
  if(response.status!=='completed')throw Error(`Provider response ${response.status}: ${JSON.stringify(response.error??response.incomplete_details)}`);
  const parsed=await output.parseCompleteOutput({text},{response:{id:response.id,timestamp:new Date(response.created_at*1000),modelId:response.model},usage:{inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,totalTokens:usage.total_tokens,inputTokenDetails:{noCacheTokens:usage.input_tokens-(usage.input_tokens_details?.cached_tokens??0),cacheReadTokens:usage.input_tokens_details?.cached_tokens??0,cacheWriteTokens:usage.input_tokens_details?.cache_write_tokens??0},outputTokenDetails:{textTokens:usage.output_tokens-(usage.output_tokens_details?.reasoning_tokens??0),reasoningTokens:usage.output_tokens_details?.reasoning_tokens??0}},finishReason:'stop'});
  return {output:parsed,raw:text,usage,finishReason:'stop'};
 }});
record.provenance.providerCalls=started.maxCalls===1?1:0;
save('revision-record.json',record);
if(record.revised){const o=await renderPlanPng(record.revised.plan,undefined,{title:'Terra second revision (constructed only if accepted)'});save('plan-view.revised.png',o.png);save('plan-view.revised.svg',o.svg);}
if(record.accepted){const c=sceneFromAcceptedRevision(record);save('scene.accepted-for-review.json',c.scene);console.log('COMPILED: render in a browser next (node scripts/canonical-second-revision-capture.mjs)');}
console.log(JSON.stringify({accepted:record.accepted,status:record.assessment.status,stopReasons:record.assessment.stopReasons,checks:record.assessment.checks.map(c=>`${c.ok?'ok':'FAIL'} ${c.id}`),dimensions:record.assessment.dimensions?.map(d=>`${d.dimension}:${d.verdict}`),revisedErrors:record.assessment.revisedErrorCount},null,1));
