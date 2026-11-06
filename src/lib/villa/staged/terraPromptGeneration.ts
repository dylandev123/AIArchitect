/** Internal adapter only. No route calls this until the security plan is implemented.
 * LiveDesigner is the existing five-stage Terra provider, not the one-shot scene author.
 * Importing this file never reads or changes a credential and never makes a model call. */
import {LiveDesigner} from './liveDesigner';
import {advancePromptRun,type PromptRun} from './promptGeneration';
export function advanceTerraPromptRun(run:PromptRun){
 return advancePromptRun(run,new LiveDesigner(12000));
}
