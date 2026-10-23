import { useProjectStore } from '@/store/useProjectStore';
import { revisionOf } from '@/lib/house/revision';
import { STALE_PROJECT_MESSAGE } from './client';
import { isStorageQuotaError } from '@/lib/storage/projectStorage';

export interface PlanResponseRecovery {rawResponse:string;sha256:string;bytes:number;redacted?:boolean;originalSha256?:string;originalBytes?:number;}
export interface PlanFailureDetails {category:string;code:string;status?:number;providerCode?:string;requestId?:string;}
export class PlanEvaluationError extends Error {
  constructor(message:string,public recovery?:PlanResponseRecovery,public failure?:PlanFailureDetails,public failureId?:string){super(message);this.name='PlanEvaluationError';}
}

export interface PlanEvaluationConfig {enabled:boolean;maxProviderCalls:number;maxOutputTokens:number;model:string;pricing:{input:number;cachedInput:number;output:number}|null;}
export async function requestPlanEvaluation(projectId:string,action:'design'|'elaborate',prompt='') {
  const store=useProjectStore.getState(),project=store.getProject(projectId);
  if(!project)throw Error('Project not found.');
  const baseRevision=revisionOf(project.houseConfigJson);
  const response=await fetch('/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,projectId,prompt,currentHouseJson:project.houseConfigJson,baseRevision})});
  const data=await response.json();
  const recovery=data.recovery as PlanResponseRecovery|undefined;
  if(recovery){try{localStorage.setItem(`ai-architect-plan-response:${recovery.sha256}`,JSON.stringify(recovery));}catch{ /* The response remains available to the caller when storage is full. */ }}
  if(!response.ok||typeof data.json!=='string'){
    throw new PlanEvaluationError([data.error,...(data.findings??[]).map((f:{code:string;targetIds:string[];message:string})=>`${f.code} [${f.targetIds.join(', ')}]: ${f.message}`),...(data.failureId?[`Diagnostic reference: ${data.failureId}`]:[])].join('\n'),recovery,data.failure,data.failureId);
  }
  if(revisionOf(useProjectStore.getState().getProject(projectId)?.houseConfigJson??'')!==baseRevision)throw Error(STALE_PROJECT_MESSAGE);
  const previousProjects=useProjectStore.getState().projects;
  try {
    store.appendVersion(projectId,data.summary,data.json,action==='design'?'ai-plan-evaluation':'ai-plan-elaboration');
    store.setArchitecturalView(projectId,{mode:action==='design'?'floor-plan':'blueprint',floor:null,buildingId:null});
  } catch(error) {
    if(!isStorageQuotaError(error))throw error;
    // Zustand updates memory before persisting. Restore it if the durable save failed.
    try{useProjectStore.setState({projects:previousProjects});}catch{/* Memory is restored even when storage remains unavailable. */}
    throw new PlanEvaluationError('Browser project storage is full (QuotaExceededError). OpenAI completed the plan, but the browser could not save it. Download the retained response before reloading. Do not generate again; this is a browser storage failure.',recovery,{category:'browser-storage',code:'browser_storage_quota'});
  }
  return data;
}
