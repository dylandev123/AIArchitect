import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { structuralRefinementMock } from './structuralRefinement.fixture';
import { demonstratesArchitecturalImprovement, generationReviewProviderSchema, generationReviewSchema, stageGenerationRefinement, validateGenerationReview } from './generationReview';
import { validateScene } from './model';
const dir = 'docs/architecture/full-house-investigation/network-verified-intelligence';
const read = (name: string) => JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
function cases() {
 const reference = {scene:validateScene(read('review.input.json').current),review:read('review.result.json').output,output:read('refine.result.json').output};
 return [reference,structuralRefinementMock()].map(c => {
  const r=generationReviewSchema.parse(c.review), refinement=r.refinement!;
  refinement.bundle={objective:'MOCK: establish coherent hierarchy between selected architecture and retained components',views:['Arrival','Aerial'],successEvidence:'Matching views must demonstrate hierarchy without losing entrance legibility.',objects:[...refinement.targetIds.map(id=>({id,action:(c.output.operations.some((o:{op:string;id?:string})=>o.id===id&&o.op==='remove')?'remove':c.output.operations.some((o:{op:string;id?:string})=>o.id===id&&o.op==='replace')?'replace':'modify') as 'remove'|'replace'|'modify',reason:'Affected component'})),...(refinement.newIds??[]).map(id=>({id,action:'add' as const,reason:'Coordinated component'}))],dependencies:(refinement.newIds??[]).map(id=>({source:id,target:refinement.targetIds[0],relationship:'Construct together to maintain enclosure or supported arrival composition'}))};
  return {...c,review:r};
 });
}
it.each([0,1])('validates a complete bundle and rejects partial execution on composition %s', index=>{
 const c=cases()[index], bytes=JSON.stringify(c.scene);
 const result=stageGenerationRefinement(c.scene,c.review,c.output);
 expect(result.bundleEvidence?.objects.length).toBeGreaterThan(1);
 for(let i=0;i<c.output.operations.length;i++) expect(()=>stageGenerationRefinement(c.scene,c.review,{...c.output,operations:c.output.operations.filter((_:unknown,j:number)=>i!==j)})).toThrow();
 expect(JSON.stringify(c.scene)).toBe(bytes);
});
it('exact legacy Terra replay stays identical and is not proof of significance',()=>{
 const c=cases()[0]; delete c.review.refinement!.bundle;
 expect(stageGenerationRefinement(c.scene,c.review,c.output).scene).toEqual(read('refined.scene.json'));
 expect(demonstratesArchitecturalImprovement(c.review,{verdict:'prefer revised',reason:'Noticeable roof step',regressions:[]})).toBe(false);
});
it.each([0,1])('separates noticeable and meaningful and enforces view/objective evidence on %s',index=>{
 const c=cases()[index], b=c.review.refinement!.bundle!;
 const comparison={verdict:'prefer revised' as const,reason:'MOCK only',regressions:[],significance:{noticeable:true,meaningful:true,objective:b.objective,views:b.views.map(view=>({view,observation:'MOCK matching view assessment'}))}};
 expect(demonstratesArchitecturalImprovement(c.review,comparison)).toBe(true);
 expect(demonstratesArchitecturalImprovement(c.review,{...comparison,significance:{...comparison.significance,meaningful:false}})).toBe(false);
 expect(demonstratesArchitecturalImprovement(c.review,{...comparison,significance:{...comparison.significance,views:comparison.significance.views.slice(1)}})).toBe(false);
 expect(demonstratesArchitecturalImprovement(c.review,{...comparison,significance:{...comparison.significance,objective:'Different objective'}})).toBe(false);
 for(const condition of ['not representable','broader redesign','preservation conflict','insufficient visual evidence'] as const) {
  const stop={condition,limitation:'MOCK explicit limitation',nextAction:'new model decision' as const};
  expect(()=>validateGenerationReview({...c.review,stop},c.scene)).toThrow(/Stopping/);
  expect(validateGenerationReview({...c.review,refinement:null,stop},c.scene).stop).toEqual(stop);
 }
 const bad=structuredClone(c.review);bad.refinement!.bundle!.dependencies[0].target='unknown';
 expect(()=>validateGenerationReview(bad,c.scene)).toThrow(/dependency/);
});
it('allows declared coordination beyond the selected finding rather than silently isolating it',()=>{
 const c=cases()[1]; c.review.findings[0].targetIds=[c.review.refinement!.targetIds[0]];
 expect(()=>stageGenerationRefinement(c.scene,c.review,c.output)).not.toThrow();
 delete c.review.refinement!.bundle;
 expect(()=>validateGenerationReview(c.review,c.scene)).toThrow(/targets/);
});
it.each([0,1])('checks coordinated flat datums from actual final geometry on %s',index=>{
 const c=cases()[index], b=c.review.refinement!.bundle!;
 b.dependencies=index===0 ? [{source:c.review.refinement!.newIds![0],target:c.review.refinement!.newIds![1],relationship:'Enclosure bands share head datum',datum:'same top'}] : [{source:'entry-west-pier',target:'entry-east-pier',relationship:'Paired supports share head datum',datum:'same top'}];
 expect(()=>stageGenerationRefinement(c.scene,c.review,c.output)).not.toThrow();
 b.dependencies[0].datum='source top meets target bottom';
 expect(()=>stageGenerationRefinement(c.scene,c.review,c.output)).toThrow(/datum/);
});

it.each([0,1])('requires strategy tradeoffs in new provider contracts while retaining historical replay on %s',index=>{
 const c=cases()[index], r={...c.review,stop:null,selectionReason:'Choose by architectural effect with all dependencies declared.'};
 expect(generationReviewProviderSchema.safeParse(r).success).toBe(false);
 r.refinement!.bundle!.alternatives=[{strategy:'Coordinate the envelope and threshold hierarchy',tradeoff:'Requires connected enclosure, opening and support decisions'},{strategy:'Isolated silhouette change',tradeoff:'Less disruption; may remain architecturally insufficient'}];
 expect(generationReviewProviderSchema.safeParse(r).success).toBe(true);
});
