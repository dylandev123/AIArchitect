/** Provider-independent Studio connection. No credentials, fixture files or database access. */
import {z} from 'zod';
import {runStagedGeneration, type Designer, type PipelineResult, type StageNo, type Checkpoint} from './pipeline';
import {saveHouse} from './save';
import {SITE_MAX} from './spec';

export const promptInput = z.object({
  brief: z.string().trim().min(10).max(4000),
  site: z.object({width:z.number().min(30).max(SITE_MAX),depth:z.number().min(30).max(SITE_MAX)}).strict().default({width:60,depth:48}),
}).strict();
export type PromptInput = z.infer<typeof promptInput>;
import {promptRequirements} from './requirements';
export {promptRequirements} from './requirements';

export interface PromptRun {input:PromptInput; result?:PipelineResult}
/** The server owns the prior result; browsers send a run ID, never trusted checkpoints. */
export async function advancePromptRun(run:PromptRun,designer:Designer,limits?:{maxCostUsd:number;maxCalls?:number;maxCorrectionsPerStage?:number;onCheckpoint?:(checkpoint:Checkpoint)=>Promise<void>}) {
  const accepted=run.result?.checkpoints.filter(c=>c.accepted)??[];
  if(run.result?.status==='failed')throw Error('This run stopped. Start a new run; its accepted checkpoints remain inspectable.');
  if(accepted.length===5)throw Error('All stages are complete.');
  const req=promptRequirements(run.input.brief);
  const result=await runStagedGeneration({designer,brief:run.input.brief,site:run.input.site,
    requiredBedrooms:req.bedrooms,requiredBaths:req.bathrooms,requiredStoreys:req.storeys,exactBedrooms:true,
    resumeFrom:accepted,stopAfter:(accepted.length+1) as StageNo,
    // Call/correction allowances come from the server policy, which also enforces each call's reservation.
    onCheckpoint:limits?.onCheckpoint,
    maxCalls:limits?.maxCalls??5,maxCorrectionsPerStage:limits?.maxCorrectionsPerStage??0,maxCostUsd:limits?.maxCostUsd??1,
  });
  run.result=result;
  const completed=result.lastGood?.stage===5;
  return {status:completed?'complete':result.status,stage:result.lastGood?.stage??0,
    direction:result.spec?.direction,scene:result.scene,findings:result.findings,
    checkpoints:result.checkpoints.filter(c=>c.accepted).map(c=>({stage:c.stage,brief:run.input.brief,scene:c.scene})),
    save:completed&&result.spec&&result.scene?saveHouse(result.spec,result.scene):undefined,
    calls:result.calls.length,costUsd:result.totalCostUsd};
}
