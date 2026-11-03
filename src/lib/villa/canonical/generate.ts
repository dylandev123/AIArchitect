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
import { conceptReview } from './concept';
import { rejectedGeneration, unparsedGeneration } from './rejection';
/** One author, one compiler. No fallback to operations or legacy generation. */
export async function generateCanonical(input:SceneRequest, selection:{model:string;reasoningEffort?:string}, signal:AbortSignal){
 let providerCalls=0;
 // The proposed plan, once the provider's output parsed: a compile rejection must not discard it.
 let proposed:{plan:unknown;limitations:string[]}|undefined,providerOutput:unknown;
 try{
  const context=await architecturalRequestContext(input,{canonical:true});
  const schema=await strictSceneResponseSchema(canonicalProposalSchema);
  const result=await withUsageLogging({projectId:null,requestType:'generation',scope:'world',model:selection.model,stage:'canonical-plan',maxOutputTokens:30000},async()=>{
   providerCalls++;
   return generateText({model:getAiModel(undefined,selection.model),system:CANONICAL_INSTRUCTIONS+context.trace.text+CANONICAL_CONTEXT_PRECEDENCE,messages:sceneMessages({...input,current:undefined}),output:Output.object({schema}),maxOutputTokens:30000,maxRetries:0,providerOptions:{openai:{strictJsonSchema:true,...(selection.reasoningEffort?{reasoningEffort:selection.reasoningEffort}:{})}},abortSignal:AbortSignal.any([signal,AbortSignal.timeout(170000)])});
  });
  if(result.finishReason!=='stop')throw Error('Incomplete canonical plan.');
  providerOutput=result.output;
  const proposal=canonicalProposalSchema.parse(result.output);
  if(proposal.status==='decision-required')return Response.json({error:proposal.decisions.join(' '),providerCalls,decisions:proposal.decisions},{status:422});
  proposed={plan:proposal.plan,limitations:proposal.limitations};
  const compiled=compileArchitecturalPlan(proposal.plan);
  const scene={...compiled.scene,generationStatus:'pending-visual-review' as const,generationBrief:input.prompt,knowledgeEvidence:context.evidence};
  // Concept review: reported beside the construction audit, never gating. It reads the compiled result and edits nothing.
  const concept=conceptReview(input.prompt,proposal.plan,compiled),audit=reviewSceneArchitecture(scene);
  const architecturalAudit=concept.findings.length?{...audit,status:'incomplete' as const,issues:[...audit.issues,...concept.findings.map(f=>f.message)],findings:[...audit.findings,...concept.findings]}:audit;
  const note=concept.findings.length?` Concept review: ${concept.findings.length} finding${concept.findings.length>1?'s':''} (see architectural audit).`:'';
  return Response.json({scene,operations:compiled.operations,architecturalPlan:proposal.plan,coordination:coordinatePlan(proposal.plan),conceptReview:concept,name:scene.name,summary:`Compiled envelope candidate — rendered review required.${note}`,unsupported:proposal.limitations,architecturalAudit,responseId:randomUUID(),providerCalls,canonical:true,reviewStatus:'pending',repairBudget:0});
 }catch(error){
  // A rejection is a result: the unmodified plan, the compiler's reasons, independent findings and a labelled drawing go back to the requester.
  // It is never a scene, is not persisted, and leaves every existing project untouched.
  if(proposed&&error instanceof DesignConflict)return Response.json({error:String(error),providerCalls,decisions:error.decisions,rejected:rejectedGeneration({plan:proposed.plan,error,brief:input.prompt,limitations:proposed.limitations})},{status:422});
  // Output that did not satisfy the contract is kept as the provider returned it (bounded), not reduced to an error string.
  const text=(error as {text?:unknown}|null)?.text??(providerOutput!==undefined?JSON.stringify(providerOutput):undefined);
  if(typeof text==='string'&&text.length&&!proposed)return Response.json({error:String(error),providerCalls,rejected:unparsedGeneration({error,rawText:text})},{status:422});
  return Response.json({error:String(error),providerCalls,...(error instanceof DesignConflict?{decisions:error.decisions}: {})},{status:422});
 }
}
