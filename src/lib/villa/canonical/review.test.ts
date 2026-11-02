import { expect,it,vi } from 'vitest';
import { REVIEW_CATEGORIES,REVIEW_VIEWS,runGenerationReview,stageGenerationRefinement } from '../scene/generationReview';
import { exteriorStudy } from '../scene/exteriorFirst.fixture';
import type { SceneCapture } from '../visual-review';
const candidate={...exteriorStudy(false).scene,architecturalPlan:{version:'architectural-plan-1'},generationStatus:'pending-visual-review' as const};
function captures():SceneCapture[]{
 // Synthetic header-only transport fixture, never represented as actual render evidence.
 const header=Buffer.alloc(36);Buffer.from('\x89PNG\r\n\x1a\n','binary').copy(header);header.write('IHDR',12);header.writeUInt32BE(640,16);header.writeUInt32BE(360,20);
 return REVIEW_VIEWS.map(view=>({view,image:`data:image/png;base64,${header.toString('base64')}`,width:640,height:360,camera:{position:[20,10,20],target:[0,0,0]}}));
}
it.each([true,false])('records rendered review outcome without an operations repair (findings: %s)',async findings=>{
 const request=vi.fn(async()=>({assessments:REVIEW_CATEGORIES.map(category=>({category,observation:'Mock review'})),findings:findings?[{severity:'major',category:'material coordination',targetIds:['gable-roof'],observation:'Mock unresolved finish',suggestedChange:null}]:[],refinement:null}));
 const commit=vi.fn();const result=await runGenerationReview(candidate,{capture:async()=>captures(),request,commit,assertCurrent:()=>{},record:()=>{}});
 expect(request).toHaveBeenCalledTimes(1);expect(commit).toHaveBeenCalledTimes(1);expect(result.generationStatus).toBe(findings?'rejected':'reviewed-envelope');expect(result.elements).toEqual(candidate.elements);
});
it('rejects capture failure and prevents legacy operation repairs',async()=>{
 const result=await runGenerationReview(candidate,{capture:async()=>{throw Error('WebGL lost');},request:vi.fn(),commit:vi.fn(),assertCurrent:()=>{},record:()=>{}});
 expect(result.generationStatus).toBe('rejected');
 expect(()=>stageGenerationRefinement(candidate,{} as never,{})).toThrow('plan revision');
});
