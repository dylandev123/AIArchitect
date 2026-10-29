import { z } from 'zod';
import { generateText, Output } from 'ai';
import { getAiModel, getAiModelId, isAiConfigured, AI_PROVIDER_OPTIONS, AI_NOT_CONFIGURED_MESSAGE } from '@/lib/ai/model';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { computeCostUsd } from '@/lib/ai/pricing';
import { compositionSchema, validateCompositionPreview } from '@/lib/villa/composition';
import { creationInstructions, creationResultSchema, validateProposal } from '@/lib/villa/creation/model';
import { listCandidates } from '@/lib/villa/creation/store';
export const maxDuration=180;
const requestSchema=z.object({brief:z.string().trim().min(1).max(4000),element:z.string().trim().min(1).max(2000),current:compositionSchema,authorizePaidCall:z.literal(true),offlineCandidate:z.object({id:z.string().max(48),version:z.number().int().positive()}).strict()}).strict();
export async function POST(request: Request) {
  if(process.env.NODE_ENV!=='development')return Response.json({error:'Development only',providerCalls:0},{status:404});
  let providerCalls=0;
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin) throw new Error('Same-origin manual authorization required.');
    const raw=await request.text();if(raw.length>100000)throw new Error('Request exceeds limit.');
    const input=requestSchema.parse(JSON.parse(raw));validateCompositionPreview(input.current);
    const offline=(await listCandidates()).find(c=>c.id===input.offlineCandidate.id&&c.version===input.offlineCandidate.version);
    if(!offline) throw new Error('Complete and save the two-villa offline validation before a live test.');
    if(!isAiConfigured()) return Response.json({error:AI_NOT_CONFIGURED_MESSAGE,providerCalls},{status:503});
    const model=getAiModelId();providerCalls=1;
    const result=await withUsageLogging({projectId:null,requestType:'scoped_edit',scope:'world',model,stage:'villa-component-creation',maxOutputTokens:3500},()=>generateText({
      model:getAiModel(),providerOptions:AI_PROVIDER_OPTIONS,system:creationInstructions(),maxRetries:0,maxOutputTokens:3500,
      abortSignal:AbortSignal.any([request.signal,AbortSignal.timeout(120000)]),
      prompt:JSON.stringify({brief:input.brief,element:input.element,current:input.current}), output:Output.object({schema:creationResultSchema}),
    }));
    const output=creationResultSchema.parse(result.output);
    if('proposal' in output) {
      try { validateProposal(output.proposal); }
      catch(error) { return Response.json({capabilityGap:error instanceof Error?error.message:'Proposal violates the swept-ribbon@1 grammar.',model,providerCalls,usage:result.totalUsage},{status:422}); }
    }
    return Response.json({...output,model,providerCalls,usage:result.totalUsage,costUsd:computeCostUsd(model,{inputTokens:result.totalUsage.inputTokens??0,outputTokens:result.totalUsage.outputTokens??0,cachedInputTokens:result.totalUsage.inputTokenDetails?.cacheReadTokens??0})});
  }catch(error){return Response.json({error:providerCalls?'Terra creation failed or returned an unsupported proposal. No retry was made.':error instanceof Error?error.message:'Invalid request',providerCalls},{status:400});}
}
