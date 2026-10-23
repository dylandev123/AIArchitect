import { NextRequest, NextResponse } from 'next/server';
import { planResponseEvidence, retainPlanResponse, type PlanResponseEvidence } from '@/lib/ai/planResponseArtifact';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { classifyPlanFailure, retainPlanFailure, type PlanFailure, type PlanFailurePhase } from '@/lib/ai/planFailure';
import { isAiConfigured, AI_NOT_CONFIGURED_MESSAGE, getAiModel, getAiModelId, AI_PROVIDER_OPTIONS } from '@/lib/ai/model';
import { getPricingTable, computeCostUsd } from '@/lib/ai/pricing';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { revisionOf } from '@/lib/house/revision';
import { isBlankSite } from '@/lib/house/blank';
import { isV3ProjectRoot } from '@/lib/v3/scene';
import { preparePlanEvaluation, checkoutPlanEvaluation, isV3PlanEvaluation, planEvaluationEnabled, planEvaluationPrompt, planExteriorPrompt, DEFAULT_PLAN_EXTERIOR_REQUEST, PLAN_EVALUATION_MAX_OUTPUT_TOKENS } from '@/lib/v3/architecturalPlanEvaluation';
import { elaborateV3ArchitecturalPlan, sameArchitecturalPlan, planConstructionBlockers } from '@/lib/v3/architecturalPlanFirst';
import { planV3ArchitecturalBlueprint, constructV3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';

export const maxDuration=300;
const unresolvedSummary=(scene:{metadata:Record<string,unknown>})=>{const n=Array.isArray(scene.metadata.planUnresolved)?scene.metadata.planUnresolved.length:0;return n?` ${n} plan object${n===1?'':'s'} could not be drawn and ${n===1?'is':'are'} kept unresolved for correction.`:'';};
export async function GET() {
  const model=getAiModelId();
  return NextResponse.json({enabled:planEvaluationEnabled(),contract:'v3-plan-first-1',maxProviderCalls:1,maxOutputTokens:PLAN_EVALUATION_MAX_OUTPUT_TOKENS,model,pricing:getPricingTable()[model]??null},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest) {
  if(!planEvaluationEnabled())return NextResponse.json({error:'Design 2D Plan evaluation is disabled.'},{status:403});
  let body;
  try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request body.'},{status:400});}
  if(!body||!['design','elaborate'].includes(body.action)||(body.prompt!==undefined&&(typeof body.prompt!=='string'||body.prompt.length>12000))||(body.action==='design'&&!body.prompt?.trim())||typeof body.currentHouseJson!=='string')return NextResponse.json({error:'A valid action, design brief and current project are required.'},{status:400});
  const baseRevision=revisionOf(body.currentHouseJson);
  if(body.baseRevision!==baseRevision)return NextResponse.json({error:'The project revision changed; use the current saved plan.'},{status:409});
  let root;
  try{root=JSON.parse(body.currentHouseJson);}catch{return NextResponse.json({error:'Invalid project JSON.'},{status:400});}
  if(!isV3ProjectRoot(root)||root.v3Scene.metadata.terrainMode==='advanced'|| (root.v3Scene.site.naturalGround&&((root.v3Scene.site.naturalGround.grade??0)!==0||root.v3Scene.site.naturalGround.cliff)))return NextResponse.json({error:'Evaluation requires a flat V3 project.'},{status:409});
  const design=body.action==='design';
  const request=body.prompt?.trim()||DEFAULT_PLAN_EXTERIOR_REQUEST;
  if(design&&!isBlankSite(body.currentHouseJson))return NextResponse.json({error:'Design 2D Plan requires a new blank project; existing designs are preserved.'},{status:409});
  if(!design&&!isV3PlanEvaluation(root.v3Scene))return NextResponse.json({error:'Build in 3D requires a saved 2D evaluation plan.'},{status:409});
  const stage=design?undefined:checkoutPlanEvaluation(root.v3Scene);
  if(stage&&!stage.ok)return NextResponse.json({error:'Resolve blocking plan diagnostics before building.',findings:stage.findings,providerCalls:0},{status:422});
  const blockers=stage?planConstructionBlockers(stage):[];
  if(blockers.length)return NextResponse.json({error:'The saved plan has construction blockers. Review the listed plan objects; no exterior call was made and the saved 2D plan is preserved.',findings:blockers,providerCalls:0},{status:409});
  if(!isAiConfigured())return NextResponse.json({error:AI_NOT_CONFIGURED_MESSAGE},{status:503});
  let recovery:PlanResponseEvidence|undefined;
  let phase:PlanFailurePhase='provider',finishReason:string|undefined;
  const failed=async(failure:PlanFailure,status:number,findings?:unknown)=>{
    const failureId=await retainPlanFailure(failure,{projectId:typeof body.projectId==='string'?body.projectId:null,action:body.action,responseSha256:recovery?.sha256});
    return NextResponse.json({error:`${failure.message} The saved project is preserved; no automatic retry was made.`,failure,failureId,findings,providerCalls:1,recovery},{status});
  };
  try{
    const system=design?planEvaluationPrompt():planExteriorPrompt();
    const prompt=design?request:`Original architectural brief: ${typeof root.v3Scene.metadata.brief==='string'?root.v3Scene.metadata.brief:'Not retained; use the saved plan concept and requirements.'}\nApproved plan (immutable): ${JSON.stringify(stage!.plan)}\nExterior decisions: ${request}`;
    const result=await withUsageLogging({projectId:typeof body.projectId==='string'?body.projectId:null,requestType:'generation',scope:'world',model:getAiModelId(),generationMode:'v3-scene',stage:design?'v3-plan-evaluation':'v3-plan-elaboration',maxOutputTokens:PLAN_EVALUATION_MAX_OUTPUT_TOKENS},()=>generateText({model:getAiModel(),system,prompt,output:Output.json({name:design?'v3_architectural_plan':'v3_architectural_exterior'}),providerOptions:AI_PROVIDER_OPTIONS,maxOutputTokens:PLAN_EVALUATION_MAX_OUTPUT_TOKENS,maxRetries:0,abortSignal:AbortSignal.timeout(270000),onStepFinish:async(step)=>{finishReason=step.finishReason;recovery=await retainPlanResponse(step.text);phase='parsing';}}),({result,error}: {result?:{text:string};error?:unknown})=>result?{outputFingerprint:recovery?.sha256??planResponseEvidence(result.text).sha256}:{outputFingerprint:recovery?.sha256,diagnostic:classifyPlanFailure(error,phase,finishReason).code});
    recovery??=await retainPlanResponse(result.text);
    finishReason=result.finishReason;
    if(finishReason!=='stop')return failed(classifyPlanFailure(undefined,'provider',finishReason),502);
    phase='parsing';
    const output=result.output;
    phase='normalization';
    let scene,findings,outcome;
    if(design){
      const planned=preparePlanEvaluation(output);
      if(!planned.ok||!planned.scene){
        const schema=planned.findings.some(f=>f.code==='PLAN_INPUT');
        return failed({category:schema?'schema':'geometry',code:schema?'plan_schema':'plan_geometry',message:schema?'Schema failure: response fields do not match the 2D plan contract.':'Geometric planning failure: the 2D plan needs correction.'},422,planned.findings);
      }
      scene=planned.scene;findings=planned.findings;outcome='plan';
    }else{
      const exterior=elaborateV3ArchitecturalPlan(stage!,output);
      if(!exterior.blueprint)return NextResponse.json({error:'Exterior response did not preserve the saved plan.',findings:exterior.findings,providerCalls:1,recovery},{status:422});
      const planned=planV3ArchitecturalBlueprint(exterior.blueprint,{buildFirst:true});
      const built=planned.approval&&constructV3ArchitecturalBlueprint(planned.approval);
      if(!built||!built.ok||!built.scene)return NextResponse.json({error:'Cannot Construct — exterior needs refinement. The saved 2D plan is preserved.',findings:built?built.findings:planned.findings,providerCalls:1,recovery},{status:422});
      if(!sameArchitecturalPlan(root.v3Scene,built.scene))return NextResponse.json({error:'Construction changed approved geometry; saved plan preserved.',providerCalls:1,recovery},{status:422});
      scene=built.scene;findings=built.findings;outcome=built.outcome;
      scene.metadata={...root.v3Scene.metadata,...scene.metadata,planEvaluation:false,designPipeline:{format:'v3-plan-first-1',stage:'exterior',authority:'v3-semantic-plan'}};
      delete scene.metadata.planDiagnostics;
      delete scene.metadata.planDeferredFeatureHeights;
      delete scene.metadata.planUnresolved;
      scene.metadata.planSourceResponseSha256=root.v3Scene.metadata.planResponseSha256;
    }
    phase='validation';
    scene.metadata={...scene.metadata,planResponseSha256:recovery.sha256,brief:design?body.prompt:root.v3Scene.metadata.brief,terrainMode:'flat',usage:{...result.totalUsage,attempts:1,repair:false,estimatedCost:computeCostUsd(getAiModelId(),{inputTokens:result.totalUsage.inputTokens??0,outputTokens:result.totalUsage.outputTokens??0,cachedInputTokens:result.totalUsage.inputTokenDetails?.cacheReadTokens??0})??undefined}};
    const json=JSON.stringify({...root,v3Scene:scene});
    return NextResponse.json({json,summary:design?`2D plan saved — exterior and construction deferred.${unresolvedSummary(scene)}`:`${outcome==='draft'?'Draft — Needs Refinement':'Complete'}: built from the saved 2D plan.`,outcome,findings,baseRevision,providerCalls:1,recovery});
  }catch(error){
    // Some SDK errors expose text even if the completed-step callback did not run.
    if(!recovery&&NoObjectGeneratedError.isInstance(error)&&typeof error.text==='string')recovery=await retainPlanResponse(error.text);
    return failed(classifyPlanFailure(error,phase,finishReason),502);
  }
}
