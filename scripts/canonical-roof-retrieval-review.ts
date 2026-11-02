/** Offline replay of one retained provider response; no retrieval, credentials or API calls. */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Output} from 'ai';
import {canonicalProposalSchema,compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {validateScene} from '../src/lib/villa/scene/model';
import {computeCostUsd,getPricingTable} from '../src/lib/ai/pricing';
const dir='docs/architecture/canonical-roof-retrieval-2026-11-02';
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,JSON.stringify(v,null,2),{flag:'wx'});
const response=JSON.parse(readFileSync(`${dir}/provider-response.exact.json`,'utf8'));
const usage=response.usage;
save('estimated-cost.json',{providerUsage:usage??null,pricingSource:'repository configured default pricing; estimate, not invoice',rates:getPricingTable()['gpt-5.6-terra'],estimatedUsd:usage?computeCostUsd('gpt-5.6-terra',{inputTokens:usage.input_tokens,cachedInputTokens:usage.input_tokens_details?.cached_tokens??0,outputTokens:usage.output_tokens}):null});
if(response.error){save('validation.json',{stage:'provider',success:false,error:response.error,compilerInvoked:false});process.exit(0);}
const text=response.output.flatMap((o:{content?:{type:string;text?:string}[]})=>(o.content??[]).filter(c=>c.type==='output_text').map(c=>c.text)).join('');
writeFileSync(`${dir}/proposal.exact.txt`,text,{flag:'wx'});
try{
 assert.equal(response.status,'completed');
 const output=Output.object({schema:await strictSceneResponseSchema(canonicalProposalSchema)});
 const proposal=canonicalProposalSchema.parse(await output.parseCompleteOutput({text},{response:{id:response.id,timestamp:new Date(response.created_at*1000),modelId:response.model},usage:{inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,totalTokens:usage.total_tokens,inputTokenDetails:{noCacheTokens:usage.input_tokens-(usage.input_tokens_details?.cached_tokens??0),cacheReadTokens:usage.input_tokens_details?.cached_tokens??0,cacheWriteTokens:0},outputTokenDetails:{textTokens:usage.output_tokens-(usage.output_tokens_details?.reasoning_tokens??0),reasoningTokens:usage.output_tokens_details?.reasoning_tokens??0}},finishReason:'stop'}));
 save('proposal.normalized.json',proposal);
 if(proposal.status==='decision-required'){save('validation.json',{success:false,stage:'model-decision',decisions:proposal.decisions,compilerInvoked:false});process.exit(0);}
 const compiled=compileArchitecturalPlan(proposal.plan);
 save('compiled.json',compiled);save('operations.json',compiled.operations);
 const scene=validateScene(compiled.scene);save('scene.json',scene);save('architectural-audit.json',reviewSceneArchitecture(scene));
 save('validation.json',{success:true,stage:'constructed',compilerInvoked:true,elements:scene.elements.length,manuallyModified:false});
 console.log(JSON.stringify({success:true,elements:scene.elements.length}));
}catch(error){save('validation.json',{success:false,stage:'parse-or-construction',error:String(error),stack:error instanceof Error?error.stack:null,decisions:(error as {decisions?:unknown}).decisions??null,manuallyModified:false});console.log(String(error));}
