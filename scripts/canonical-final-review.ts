/** Offline replay of the one retained acceptance response. No network, credentials, database or provider. Exclusive writes. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {Output} from 'ai';
import {canonicalProposalSchema,compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import {coordinatePlan} from '../src/lib/villa/canonical/spatial';
import {computeCostUsd,getPricingTable} from '../src/lib/ai/pricing';
const dir='docs/architecture/canonical-final-2026-11-02';
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,JSON.stringify(v,null,2),{flag:'wx'});
const response=JSON.parse(readFileSync(`${dir}/provider-response.exact.json`,'utf8'));
const usage=response.usage;
save('estimated-cost.json',{providerUsage:usage,rates:getPricingTable()['gpt-5.6-terra'],estimatedUsd:computeCostUsd('gpt-5.6-terra',{inputTokens:usage.input_tokens,cachedInputTokens:usage.input_tokens_details?.cached_tokens??0,outputTokens:usage.output_tokens}),note:'local estimate, not an invoice'});
const text=readFileSync(`${dir}/proposal.exact.txt`,'utf8');
const output=Output.object({schema:await strictSceneResponseSchema(canonicalProposalSchema)});
const proposal=canonicalProposalSchema.parse(await output.parseCompleteOutput({text},{response:{id:response.id,timestamp:new Date(response.created_at*1000),modelId:response.model},usage:{inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,totalTokens:usage.total_tokens,inputTokenDetails:{noCacheTokens:usage.input_tokens,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:usage.output_tokens,reasoningTokens:usage.output_tokens_details?.reasoning_tokens??0}},finishReason:'stop'} as never));
save('proposal.normalized.json',proposal);
if(proposal.status!=='proposed'&&!('plan' in proposal))throw Error('no plan');
const plan=(proposal as unknown as {plan:never}).plan;
const d=diagnosePlan(plan);
save('diagnosis.json',{findings:d.findings,errors:d.findings.filter(f=>f.severity==='error').length,rects:d.rects,siteRects:d.siteRects});
let coordination:unknown;try{coordination=coordinatePlan(plan);}catch(e){coordination={threw:String(e)};}
save('coordination.json',coordination);
let compile:unknown;try{compileArchitecturalPlan(plan);compile={success:true};}catch(e){compile={success:false,error:String(e),decisions:(e as {decisions?:unknown}).decisions??null};}
save('compile-result.json',compile);
console.log(JSON.stringify({errors:d.findings.filter(f=>f.severity==='error').length,byStage:Object.groupBy?Object.fromEntries(Object.entries(Object.groupBy(d.findings.filter(f=>f.severity==='error'),f=>f.stage)).map(([k,v])=>[k,v!.length])):null,compile}));
