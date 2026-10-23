/** Separate provider/SDK failures from application ingestion and geometry failures. */
import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from 'ai';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { redactV3FailureText } from './v3FailureArtifact';

export type PlanFailurePhase = 'provider'|'parsing'|'normalization'|'validation';
export interface PlanFailure {
  category: PlanFailurePhase|'schema'|'geometry'|'application';
  code: string;
  message: string;
  status?: number;
  providerCode?: string;
  requestId?: string;
  finishReason?: string;
}
export function classifyPlanFailure(error:unknown,phase:PlanFailurePhase,finishReason?:string):PlanFailure {
  if(APICallError.isInstance(error)) {
    // Persist only allowlisted metadata, never request bodies, headers or raw errors.
    let providerCode: string|undefined;
    try {
      const body=JSON.parse(error.responseBody??'');
      const code=body?.error?.code;
      if(typeof code==='string'&&/^[a-z_]{1,80}$/.test(code))providerCode=code;
    }catch{/* Some HTTP errors have no JSON body. */}
    const status=error.statusCode;
    const requestId=error.responseHeaders?.['x-request-id'];
    return {category:'provider',code:`provider_${status??'transport'}`,status,providerCode,
      ...(requestId&&/^[\w-]{1,160}$/.test(requestId)?{requestId}:{}),
      message:status===429
        ?`Provider failure (HTTP 429${providerCode?`, ${providerCode}`:''}). No plan response was completed. Quota exhaustion and rate limiting are distinguished only when a provider code is available.`
        :`Provider failure${status?` (HTTP ${status})`:''}. The provider request did not complete.`};
  }
  if(finishReason==='length'||(NoObjectGeneratedError.isInstance(error)&&error.finishReason==='length'))return {category:'provider',code:'output_truncated',finishReason:'length',message:'Provider output was truncated. Captured text is retained; no replacement plan was created.'};
  if(finishReason==='content-filter')return {category:'provider',code:'provider_refusal',finishReason,message:'The provider refused or filtered the response. No plan was created.'};
  if(NoObjectGeneratedError.isInstance(error))return {category:'parsing',code:'invalid_json',message:'Parsing failure: the captured response is not valid JSON.'};
  if(NoOutputGeneratedError.isInstance(error))return {category:'provider',code:'no_output',message:'Provider failure: no output text was returned.'};
  if(error instanceof Error&&['AbortError','TimeoutError'].includes(error.name))return {category:'provider',code:'provider_timeout',message:'Provider request timed out. Any completed captured text is retained.'};
  if(phase==='provider')return {category:'provider',code:'sdk_transport_error',message:'Provider SDK or transport failure. No completed plan response is available.'};
  return {category:phase,code:`${phase}_error`,message:`Application ${phase} failure. The captured response and saved project are preserved.`};
}

/** Immutable, correlated failure evidence; response text lives in the separate hash capture. */
export async function retainPlanFailure(failure:PlanFailure,context:{projectId:string|null;action:string;responseSha256?:string}) {
  const evidence={id:randomUUID(),capturedAt:new Date().toISOString(),...context,failure};
  try{
    const directory=path.join(process.cwd(),'.v3-debug','plan-evaluations');
    await mkdir(directory,{recursive:true,mode:0o700});
    // The shared redactor removes arbitrary provider "message" fields. This
    // summary is fixed application text; no provider error message enters it.
    const {message,...details}=failure;
    await writeFile(path.join(directory,`${evidence.id}.failure.json`),redactV3FailureText(JSON.stringify({...evidence,failure:{...details,summary:message}})),{encoding:'utf8',mode:0o600,flag:'wx'});
  }catch{/* Client still receives classified evidence on read-only hosts. */}
  return evidence.id;
}
