import { DesignConflict } from '../experimental/semantic-building/compiler';
import { architecturalRequestContext } from '../scene/knowledgeContext';
import { generateText, Output } from 'ai';
import { randomUUID } from 'node:crypto';
import { getAiModel } from '@/lib/ai/model';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { strictSceneResponseSchema, sceneMessages, type SceneRequest } from '../scene/terra';
import { canonicalProposalSchema, CANONICAL_INSTRUCTIONS, CANONICAL_CONTEXT_PRECEDENCE, compileArchitecturalPlan } from './plan';
import { reviewSceneArchitecture } from '../scene/planning';
import { coordinatePlan } from './spatial';
/** One author, one compiler. No fallback to operations or legacy generation. */
export async function generateCanonical(input:SceneRequest, selection:{model:string;reasoningEffort?:string}, signal:AbortSignal){
 let providerCalls=0;
 try{
  const context=await architecturalRequestContext(input,{canonical:true});
  const schema=await strictSceneResponseSchema(canonicalProposalSchema);
  const result=await withUsageLogging({projectId:null,requestType:'generation',scope:'world',model:selection.model,stage:'canonical-plan',maxOutputTokens:30000},async()=>{
   providerCalls++;
   return generateText({model:getAiModel(undefined,selection.model),system:CANONICAL_INSTRUCTIONS+context.trace.text+CANONICAL_CONTEXT_PRECEDENCE,messages:sceneMessages({...input,current:undefined}),output:Output.object({schema}),maxOutputTokens:30000,maxRetries:0,providerOptions:{openai:{strictJsonSchema:true,...(selection.reasoningEffort?{reasoningEffort:selection.reasoningEffort}:{})}},abortSignal:AbortSignal.any([signal,AbortSignal.timeout(170000)])});
  });
  if(result.finishReason!=='stop')throw Error('Incomplete canonical plan.');
  const proposal=canonicalProposalSchema.parse(result.output);
  if(proposal.status==='decision-required')return Response.json({error:proposal.decisions.join(' '),providerCalls,decisions:proposal.decisions},{status:422});
  const compiled=compileArchitecturalPlan(proposal.plan);
  const scene={...compiled.scene,generationStatus:'pending-visual-review' as const,generationBrief:input.prompt,knowledgeEvidence:context.evidence};
  return Response.json({scene,operations:compiled.operations,architecturalPlan:proposal.plan,coordination:coordinatePlan(proposal.plan),name:scene.name,summary:'Compiled envelope candidate — rendered review required.',unsupported:proposal.limitations,architecturalAudit:reviewSceneArchitecture(scene),responseId:randomUUID(),providerCalls,canonical:true,reviewStatus:'pending',repairBudget:0});
 }catch(error){return Response.json({error:String(error),providerCalls,...(error instanceof DesignConflict?{decisions:error.decisions}: {})},{status:422});}
}
