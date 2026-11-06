import {createHash} from 'node:crypto';
import {LIVE_POLICY,type StudioPolicy} from './contract';
import {getPricingTable,type ModelPricing} from '@/lib/ai/pricing';
export {FIRST_BRIEF,LIVE_POLICY,NO_CORRECTION_POLICY,type StudioPolicy} from './contract';
export const policyHash=(policy:StudioPolicy)=>createHash('sha256').update(JSON.stringify(policy)).digest('hex');
export const POLICY_HASH=policyHash(LIVE_POLICY);
export const briefHash=(brief:string)=>createHash('sha256').update(brief.trim()).digest('hex');
/**
 * Defensible upper cost bound of one call, in micro-USD. Prices are USD per million tokens, i.e. micro-USD per
 * token. A token always covers at least one UTF-8 byte, so input tokens <= request bytes; the margin covers
 * provider-side message framing. Output (including reasoning) is capped by max_output_tokens. Cached input is
 * cheaper, so pricing all input at the full rate only over-reserves.
 */
export const stageOutputTokens=(policy:StudioPolicy,stage:1|2|3|4|5)=>Math.min(policy.maxOutputTokens,policy.stageOutputTokens[stage]);
/** Published provider rates for the policy model (USD per million tokens). Unpriced models are refused. */
export const officialRates=(policy:StudioPolicy):Required<ModelPricing>=>{
 const p=getPricingTable()[policy.model];if(!p)throw new StudioError(409,`Model ${policy.model} has no configured price; execution refused.`);
 return {...p,cacheWrite:p.cacheWrite??p.input};
};
/** Rates charged against the approved budget: per category, never below the published rate nor the conservative policy rate. */
export const budgetRates=(policy:StudioPolicy):Required<ModelPricing>=>{
 const o=officialRates(policy);
 return {input:Math.max(policy.price.input,o.input),cachedInput:Math.max(policy.price.cachedInput,o.cachedInput),cacheWrite:Math.max(policy.price.input,o.cacheWrite),output:Math.max(policy.price.output,o.output)};
};
/** Highest per-token rate any input token can be billed or charged at; reservations price all input at it. */
export const maxInputRate=(policy:StudioPolicy)=>{const r=budgetRates(policy);return Math.max(r.input,r.cachedInput,r.cacheWrite);};
export const reservationMicros=(policy:StudioPolicy,wireBytes:number,stage:1|2|3|4|5)=>Math.ceil((wireBytes+policy.inputTokenMargin)*maxInputRate(policy)+stageOutputTokens(policy,stage)*budgetRates(policy).output);
/** Provider-reported usage as returned by the AI SDK. */
export interface ReportedUsage{inputTokens?:number;outputTokens?:number;inputTokenDetails?:{noCacheTokens?:number;cacheReadTokens?:number;cacheWriteTokens?:number}}
const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
/**
 * Settles one completed call. `chargeMicros` is debited from the approved budget (per-category budget rates);
 * `billedMicros` estimates the provider bill at published rates. Token categories the provider did not report, or
 * reported inconsistently, are priced at the highest applicable rate in both figures.
 * Returns undefined when input or output totals are absent, which the caller must treat as uncertain.
 */
export function settleUsage(policy:StudioPolicy,u:ReportedUsage|undefined){
 if(!u||!count(u.inputTokens)||!count(u.outputTokens))return undefined;
 const input=u.inputTokens!,output=u.outputTokens!,r=u.inputTokenDetails?.cacheReadTokens,w=u.inputTokenDetails?.cacheWriteTokens;
 // Trust only reported, consistent categories. Unreported read: all input at the highest input rate. Reported read
 // but unreported write: the non-read remainder at the higher of plain and cache-write rates.
 const read=count(r)&&r!<=input?r!:undefined,write=read!==undefined&&count(w)&&read+w!<=input?w!:undefined,unsplit=read===undefined||(count(w)&&write===undefined);
 const price=(k:Required<ModelPricing>)=>(unsplit?input*Math.max(k.input,k.cachedInput,k.cacheWrite)
  :write===undefined?read!*k.cachedInput+(input-read!)*Math.max(k.input,k.cacheWrite)
  :(input-read!-write)*k.input+read!*k.cachedInput+write*k.cacheWrite)+output*k.output;
 return {chargeMicros:Math.ceil(price(budgetRates(policy))),billedMicros:Math.ceil(price(officialRates(policy))),inputTokens:input,outputTokens:output,cacheReadTokens:unsplit?undefined:read,cacheWriteTokens:unsplit?undefined:write};
}
/** Version-1 fixed bound at version-1 prices, kept for comparison/evidence: 65,536 input + 12,000 output tokens. */
export const RESERVATION_MICROS=Math.ceil(65536*2+12000*12);
export class StudioError extends Error{constructor(readonly status:number,message:string){super(message);}}
