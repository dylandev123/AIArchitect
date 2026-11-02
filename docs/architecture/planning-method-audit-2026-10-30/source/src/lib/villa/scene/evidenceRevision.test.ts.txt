import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { reviseProgrammeEvidence } from './evidenceRevision';
import { structuralRefinementMock } from './structuralRefinement.fixture';
import { stageGenerationRefinement } from './generationReview';
import { stageSceneOperations, type ArchitecturalScene } from './model';
import { sceneResultSchema } from './terra';

function fixture() {
  const f = structuralRefinementMock();
  const plan = structuredClone(f.scene.architecturalPlan) as { programme: Record<string, unknown>[] };
  // Explicit developer commitment to the replaced canopy, retaining all requirements.
  plan.programme.push({name:'Covered entry',zone:'outdoor',strategy:'Cover the arrival',floorIds:['arrival'],enclosureIds:[],roofIds:['entry-canopy'],accessIds:['front-1-panel'],limitation:''});
  const scene = {...f.scene, elements:f.scene.elements.map(e=>e.id==='arrival'?{...e,size:[3,.2,2] as [number,number,number],at:[0,.1,-5.1] as [number,number,number]}:e), architecturalPlan:plan};
  const revision = {spaceIndex:1,role:'roofIds' as const,previousIds:['entry-canopy'],replacementIds:['entry-roof'],reason:'The scoped supported portal replaces the original canopy.'};
  return {...f,scene,revision};
}
it('atomically accepts supported replacement evidence through full refinement and preserves requirements',()=>{
  const f=fixture(), bytes=JSON.stringify(f.scene);
  expect(()=>stageGenerationRefinement(f.scene,f.review,f.output)).toThrow();
  const result=stageGenerationRefinement(f.scene,f.review,{...f.output,evidenceRevisions:[f.revision]});
  const plan=result.scene.architecturalPlan as {programme:Record<string,unknown>[];evidenceRevisions:unknown[]};
  expect(plan.programme[1].roofIds).toEqual(['entry-roof']);
  expect(plan.programme[0]).toEqual((f.scene.architecturalPlan as typeof plan).programme[0]);
  expect(plan.evidenceRevisions).toEqual([{revisions:[f.revision]}]);
  expect(JSON.stringify(f.scene)).toBe(bytes);
});
it('rejects stale, duplicated, empty, remote, wrong-kind and unrelated evidence changes',()=>{
  const f=fixture(),after=stageSceneOperations(f.scene,sceneResultSchema.parse(f.output).operations),bytes=JSON.stringify(f.scene);
  for(const revisions of [
    [{...f.revision,previousIds:['unknown']}],
    [f.revision,f.revision],
    [{...f.revision,replacementIds:[]}],
    [{...f.revision,replacementIds:['entry-west-pier']}],
    [{...f.revision,replacementIds:['gable-roof']}],
    [{...f.revision,spaceIndex:0}],
    [{...f.revision,requirement:{origin:'design-choice'}}],
  ]) expect(()=>reviseProgrammeEvidence(f.scene,after,revisions,[...f.review.refinement.targetIds,...f.review.refinement.newIds])).toThrow();
  expect(JSON.stringify(f.scene)).toBe(bytes);
});
it('does not authorize claiming a new room or revising evidence without geometry change',()=>{
  const f=fixture();
  expect(()=>reviseProgrammeEvidence(f.scene,f.scene,[{...f.revision,replacementIds:['gable-roof']}],['entry-canopy','gable-roof'])).toThrow('changed scoped dependency');
  expect(()=>stageGenerationRefinement(f.scene,f.review,{...f.output,architecturalPlan:{programme:[]},evidenceRevisions:[f.revision]})).toThrow('preserve architectural plan');
});
it('keeps the original response immutable and the fully repaired diagnostic rejected',()=>{
 const root='docs/architecture/', read=(p:string)=>JSON.parse(readFileSync(root+p,'utf8'));
 const scene=read('retained-visual-review/original.scene.json') as ArchitecturalScene;
 const review=read('retained-visual-review/refine.input.json').review;
 const raw=read('retained-visual-review/raw-candidate.operations.json');
 const diagnostic=read('single-house/diagnostic.operations.json');
 expect(()=>stageGenerationRefinement(scene,review,raw)).toThrow();
 expect(()=>stageGenerationRefinement(scene,review,diagnostic)).toThrow('construction findings');
});
it('recognizes retained terrace access only with a constructed clear intervening route',()=>{
 const read=(p:string)=>JSON.parse(readFileSync(`docs/architecture/${p}`,'utf8'));
 const scene=read('retained-visual-review/original.scene.json') as ArchitecturalScene;
 const diagnostic=sceneResultSchema.parse(read('single-house/diagnostic.operations.json'));
 const after=stageSceneOperations(scene,diagnostic.operations);
 const scope=read('retained-visual-review/refine.input.json').review.refinement;
 const revisions=[{spaceIndex:6,role:'accessIds',previousIds:['garden-door'],replacementIds:['rear-loggia-door'],reason:'DEVELOPER DIAGNOSTIC: replacement passage with a verified intervening route.'}];
 expect(()=>reviseProgrammeEvidence(scene,after,revisions,[...scope.targetIds,...scope.newIds])).not.toThrow();
 const blocked={...after,elements:after.elements.filter(e=>e.id!=='main-floor')};
 expect(()=>reviseProgrammeEvidence(scene,blocked,revisions,[...scope.targetIds,...scope.newIds])).toThrow('local access at walking datum unverified');
});
it('accepts a clear slab route through the full normal refinement transaction and rejects its broken counterpart atomically',()=>{
 const f=structuralRefinementMock();
 const plan=structuredClone(f.scene.architecturalPlan) as {programme:Record<string,unknown>[]};
 plan.programme.push({name:'Garden access',zone:'outdoor',strategy:'A real passage reaches the garden floor',floorIds:['garden-terrace'],enclosureIds:[],roofIds:[],accessIds:['front-1-panel'],limitation:''});
 const scene={...f.scene,architecturalPlan:plan},bytes=JSON.stringify(scene);
 const review={...f.review,findings:[{...f.review.findings[0],targetIds:['garden-terrace']}],refinement:{...f.review.refinement,targetIds:['garden-terrace'],newIds:['bridge']}};
 const output={name:scene.name,summary:'DEVELOPER ONLY: test a connected garden floor',unsupported:[],operations:[{op:'move',id:'garden-terrace',at:[0,.1,6.4]},{op:'add',element:{id:'bridge',label:'bridge',kind:'plate',at:[0,.1,4.45],size:[3,.2,.9],material:'limestone'}}]};
 const result=stageGenerationRefinement(scene,review,output);
 expect(result.diff.introducedAuditWarnings).toEqual([]);
 expect(result.diff.changedElementIds.sort()).toEqual(['bridge','garden-terrace']);
 expect(()=>stageGenerationRefinement(scene,review,{...output,operations:output.operations.slice(0,1)})).toThrow('construction findings');
 expect(JSON.stringify(scene)).toBe(bytes);
});
