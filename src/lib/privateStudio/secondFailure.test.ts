import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {advancePromptRun,type PromptRun} from '@/lib/villa/staged/promptGeneration';
import {publicRun} from './service';
import type {State} from './store';
const evidence=JSON.parse(readFileSync('docs/architecture/secure-live-studio/second-failure/evidence.json','utf8'));
it('reports attempted stage 2 separately from the retained stage 1 in the exact saved run',()=>{
 const state={calls:Object.fromEntries(evidence.calls.map((c:{id:string})=>[c.id,c]))} as unknown as State;
 const result=publicRun(evidence.run,state);
 expect(result.stage).toBe(1);expect(result.failedStage).toBe(2);expect(result.status).toBe('failed');
 expect(result.costUsd).toBe(.025752);expect(result.error).toContain('interrupted');
});
it('replays the actual accepted concept, then safely retains it after a synthetic construction exception',async()=>{
 const concept=JSON.parse(evidence.run.source.result.calls[0].raw);
 // Stage 2 raw output was lost in the live run. This is explicitly a developer fixture,
 // exercising a known uncaught path, not a reconstruction of Terra's missing geometry.
 const massing={blocks:[{id:'house',role:'House',cx:0,cz:0,w:12,d:12,level:0},{id:'veranda',role:'Veranda',open:true,cx:22,cz:0,w:4,d:4,level:0}]};
 const design=vi.fn().mockResolvedValueOnce({value:concept,raw:JSON.stringify(concept)}).mockResolvedValueOnce({value:massing,raw:JSON.stringify(massing),finishReason:'stop'});
 const correct=vi.fn();const designer={label:'Recorded direction + SYNTHETIC detached veranda',design,correct};
 const run:PromptRun={input:evidence.run.source.input};
 const first=await advancePromptRun(run,designer,{maxCostUsd:1.4});expect(first.stage).toBe(1);
 const accepted=JSON.stringify(run.result?.lastGood);
 const failed=await advancePromptRun(run,designer,{maxCostUsd:1.4});
 expect(failed.status).toBe('failed');expect(failed.stage).toBe(1);expect(run.result?.failedStage).toBe(2);
 expect(failed.findings).toEqual([expect.objectContaining({code:'construction-error',message:'Open space veranda does not touch any enclosed ground-level block.'})]);
 expect(JSON.stringify(run.result?.lastGood)).toBe(accepted);
 expect(run.result?.calls.at(-1)?.raw).toBe(JSON.stringify(massing));
 await expect(advancePromptRun(run,designer)).rejects.toThrow('run stopped');
 expect(design).toHaveBeenCalledTimes(2);expect(correct).not.toHaveBeenCalled();
});
