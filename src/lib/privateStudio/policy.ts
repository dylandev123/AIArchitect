import {createHash} from 'node:crypto';
import {LIVE_POLICY,type StudioPolicy} from './contract';
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
export const reservationMicros=(policy:StudioPolicy,wireBytes:number,stage:1|2|3|4|5)=>Math.ceil((wireBytes+policy.inputTokenMargin)*policy.price.input+stageOutputTokens(policy,stage)*policy.price.output);
/** Version-1 fixed bound at version-1 prices, kept for comparison/evidence: 65,536 input + 12,000 output tokens. */
export const RESERVATION_MICROS=Math.ceil(65536*2+12000*12);
export class StudioError extends Error{constructor(readonly status:number,message:string){super(message);}}
