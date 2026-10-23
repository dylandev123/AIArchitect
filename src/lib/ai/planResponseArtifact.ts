/** Immutable local evidence for one plan-only response, before parsing or validation. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { redactV3FailureText } from './v3FailureArtifact';

export interface PlanResponseEvidence { rawResponse:string; sha256:string; bytes:number; redacted:boolean; originalSha256:string; originalBytes:number; }
const hash = (text:string) => createHash('sha256').update(text,'utf8').digest('hex');
export const planResponseEvidence = (original:string):PlanResponseEvidence => {
  const rawResponse=redactV3FailureText(original);
  return {rawResponse,sha256:hash(rawResponse),bytes:Buffer.byteLength(rawResponse,'utf8'),redacted:rawResponse!==original,originalSha256:hash(original),originalBytes:Buffer.byteLength(original,'utf8')};
};
export async function retainPlanResponse(rawResponse:string):Promise<PlanResponseEvidence> {
  const evidence=planResponseEvidence(rawResponse);
  // Never replace an earlier response or the general generation failure slots.
  try {
    const directory=path.join(process.cwd(),'.v3-debug','plan-evaluations');
    await mkdir(directory,{recursive:true,mode:0o700});
    await writeFile(path.join(directory,`${evidence.sha256}.response.json`),evidence.rawResponse,{encoding:'utf8',mode:0o600,flag:'wx'});
    await writeFile(path.join(directory,`${evidence.sha256}.capture.json`),JSON.stringify(evidence),{encoding:'utf8',mode:0o600,flag:'wx'});
  } catch { /* A read-only host must still return the safe capture to its requesting client. */ }
  return evidence;
}
