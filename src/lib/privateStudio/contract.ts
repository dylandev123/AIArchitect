/** Public limits and brief only; no secrets or server imports. */
export const FIRST_BRIEF='Design a beautiful single-storey Caribbean home with three bedrooms, two bathrooms, a pitched terracotta roof, a large covered veranda, a modern kitchen and a small swimming pool. Build it on completely flat land.';
/**
 * ACTIVE live policy (version 3, chosen by the user on 2026-11-06): five stage calls plus at most one targeted
 * correction per stage (five in total), US$1.40 hard ceiling. Every call is reserved individually at
 *   (measured request bytes + inputTokenMargin) x price.input + stageOutputTokens[stage] x price.output
 * micro-USD (prices are USD per million tokens = micro-USD per token; a token always covers >= 1 UTF-8 byte).
 * Prices are the HIGHER of the published figures (US$2.50 / US$15 per million vs US$2 / US$12): an
 * over-estimate only over-reserves and over-records; it can never let real billing exceed the ceiling.
 * Output caps are stage-specific: >= 3x the largest real Terra output observed for that stage (Stage 1: 537,
 * 2: 1,819, 3: 2,532, 4: 1,119, 5: 582 tokens, reasoning included), and small enough that all ten worst-case
 * calls fit the ceiling at measured request sizes (see policy.test.ts).
 */
export const LIVE_POLICY={version:3,model:'gpt-5.6-terra',maxCalls:5,maxCorrectionCalls:5,maxOutputTokens:8000,stageOutputTokens:{1:4000,2:6000,3:8000,4:6000,5:4000},maxInputTokens:65536,maxWireBytes:60000,inputTokenMargin:1024,timeoutMs:170000,maxCostMicros:1400000,site:{width:60,depth:48},price:{input:2.5,cachedInput:.25,output:15}} as const;
export type StudioPolicy={readonly version:number;readonly model:string;readonly maxCalls:number;readonly maxCorrectionCalls:number;readonly maxOutputTokens:number;readonly stageOutputTokens:Readonly<Record<1|2|3|4|5,number>>;readonly maxInputTokens:number;readonly maxWireBytes:number;readonly inputTokenMargin:number;readonly timeoutMs:number;readonly maxCostMicros:number;readonly site:{readonly width:number;readonly depth:number};readonly price:{readonly input:number;readonly cachedInput:number;readonly output:number};/** Set only on continuation policies: the single stage such a run may execute. */readonly continuationStage?:5};
/** Zero-correction variant of the same limits (tests and any future decision to disable corrections). */
export const NO_CORRECTION_POLICY={...LIVE_POLICY,version:4,maxCorrectionCalls:0} as const;
/**
 * Stage 5-only continuation of a stopped run whose Stages 1-4 were accepted (approved separately per run).
 * One design call, no correction, no retry. Hard limit US$0.10 >= the measured worst case of the actual
 * live v3 Stage 5 request: (14,374 request bytes + 1,024 margin) x US$2.50 + 4,000 output tokens x US$15 per
 * million = US$0.098495. maxWireBytes 16,000 refuses any request materially larger than the measured one.
 */
export const STAGE5_CONTINUATION_POLICY={...LIVE_POLICY,version:5,maxCalls:1,maxCorrectionCalls:0,maxWireBytes:16000,maxCostMicros:100000,continuationStage:5} as const;
