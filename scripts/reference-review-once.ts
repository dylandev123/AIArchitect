/** Explicitly authorized one-call experiment. Exclusive marker prevents replaying live. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {generateText,Output} from 'ai';
import {getAiModel,getAiModelId,AI_PROVIDER_OPTIONS} from '../src/lib/ai/model';
import {reviewInstructions,reviewSchema,visualReviewRequestSchema} from '../src/lib/villa/visual-review';
import {validateCompositionPreview} from '../src/lib/villa/composition';
import {computeCostUsd} from '../src/lib/ai/pricing';
const dir='docs/villa-playground/reference-review';
async function main(){
if(process.argv[2]!=='--authorize-one-live-call')throw Error('Explicit authorization argument required');
if(existsSync(`${dir}/live-attempt.json`))throw Error('Live attempt already recorded. No retries permitted.');
loadEnvConfig(process.cwd());
if(!process.env.OPENAI_API_KEY?.trim())throw Error('Existing key unavailable');
const input=visualReviewRequestSchema.parse(JSON.parse(readFileSync(`${dir}/review-input.json`,'utf8')));
if('version' in input.current)validateCompositionPreview(input.current);
const system=reviewInstructions(input.current),model=getAiModelId();
const preserved=['public/inspiration/villa.jpg',...['response.json','concept.jpg','proof.json','interpretation.json','request.json','candidate-architecture.UNVALIDATED.json','validation-report.json'].map(f=>`.data/image-vision/7f6322d4-8b39-43fe-a10e-52a5e7b13686/${f}`),'docs/villa-playground/image-fidelity/audited-replay.json'];
writeFileSync(`${dir}/preserved-sha256.json`,JSON.stringify(Object.fromEntries(preserved.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),null,2));
writeFileSync(`${dir}/request-settings.json`,JSON.stringify({model,system,providerOptions:AI_PROVIDER_OPTIONS,maxRetries:0,maxOutputTokens:1800,baseline:'audited offline correction',approval:'one review only; zero retries; no edit provider call; no acceptance or learning'},null,2));
writeFileSync(`${dir}/live-attempt.json`,JSON.stringify({startedAt:new Date().toISOString(),model,maxCalls:1,maxRetries:0}),{flag:'wx'});
let calls=0;const originalFetch=globalThis.fetch;
globalThis.fetch=async(request,options)=>{
if(++calls>1)throw Error('Second network request prohibited');
const url=String(request instanceof Request?request.url:request);if(!url.startsWith('https://api.openai.com/'))throw Error('Unexpected provider destination');
writeFileSync(`${dir}/transport.json`,JSON.stringify({calls,url,method:options?.method??'POST',at:new Date().toISOString()},null,2));
const response=await originalFetch(request,options);
writeFileSync(`${dir}/provider-response.raw.json`,await response.clone().text());
writeFileSync(`${dir}/provider-http.json`,JSON.stringify({status:response.status,requestId:response.headers.get('x-request-id')},null,2));
return response;
};
try{
const result=await generateText({model:getAiModel(),providerOptions:AI_PROVIDER_OPTIONS,system,maxRetries:0,maxOutputTokens:1800,abortSignal:AbortSignal.timeout(120000),messages:[{role:'user',content:[{type:'text',text:JSON.stringify({brief:input.brief,current:input.current,unresolved:input.unresolved})},...input.images.map(image=>({type:'image' as const,image})),{type:'text',text:`Approved concept: ${input.reference!.source}`},{type:'image',image:input.reference!.image}]}],output:Output.object({schema:reviewSchema})});
writeFileSync(`${dir}/review-response.json`,JSON.stringify({review:result.output,text:result.text,usage:result.totalUsage,model,providerCalls:calls,finishReason:result.finishReason,costUsd:computeCostUsd(model,{inputTokens:result.totalUsage.inputTokens??0,outputTokens:result.totalUsage.outputTokens??0,cachedInputTokens:result.totalUsage.inputTokenDetails?.cacheReadTokens??0})},null,2));
console.log(JSON.stringify({providerCalls:calls,model,review:result.output,usage:result.totalUsage}));
} catch(error){writeFileSync(`${dir}/failure.json`,JSON.stringify({providerCalls:calls,error:error instanceof Error?error.message:'Review failed',retry:false},null,2));console.log('Review failed; retained response if received; no retry.');process.exitCode=1;}
finally{globalThis.fetch=originalFetch;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
