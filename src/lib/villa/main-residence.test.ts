import { describe,it,expect } from 'vitest';
import retained from './__tests__/fixtures/main-residence-estate.response.json';
import { mainResidenceExamples } from './main-residence-examples';
import { buildComposition,executeCompositionPatch,validateCompositionPreview } from './composition';
import { footprintOutline,footprintPlate,validateFootprint } from './footprint';
import { resolveVillaResult,villaProviderOutputSchema } from './terra';

describe('inset principal residences',()=>{
 it('constructs three distinct continuous two-level houses through Terra, preserving estate grounds',()=>{
  const examples=mainResidenceExamples();
  expect(new Set(examples.map(c=>JSON.stringify(c.forms![0].points))).size).toBe(3);
  for(const c of examples){
   expect(c.wings).toEqual([]);expect(c.forms).toHaveLength(1);
   for(const key of ['estateLandscape','pool','terraces','components'] as const)expect(c[key]).toEqual(retained.changes[key]);
   const request={mode:'generate' as const,prompt:'offline'},response={changes:c,summary:'Offline design',unsupported:[]};
   expect(villaProviderOutputSchema(request).safeParse(response).success).toBe(true);
   expect(buildComposition(resolveVillaResult(request,response).config as typeof c).forms).toEqual(c.forms);
   const f=c.forms![0];validateFootprint(f);
   for(const v of [footprintOutline(f),footprintOutline(f.upper!)]){
    const g=footprintPlate(v,.26);expect([...g.attributes.position.array].every(Number.isFinite)).toBe(true);g.dispose();
   }
  }
 });
 it('edits heights and outlines through the validated executor, rejecting an unsupported upper floor atomically',()=>{
  for(const c of mainResidenceExamples()){
   const before=structuredClone(c),f=c.forms![0];
   const changes={forms:[{type:'put',form:{...f,upper:{...f.upper!,height:4.1}}}]};
   const result=resolveVillaResult({mode:'edit',prompt:'Raise crown',current:c},{changes,summary:'Raised upper floor',unsupported:[]});
   expect((result.config as typeof c).forms![0].upper!.height).toBe(4.1);
   expect((result.config as typeof c).estateLandscape).toEqual(c.estateLandscape);
   expect(()=>executeCompositionPatch(c,{forms:[{type:'put',form:{...f,upper:{height:4,points:[{x:-39,z:-39},{x:39,z:-39},{x:39,z:39},{x:-39,z:39}]}}}]})).toThrow();
   expect(c).toEqual(before);
  }
 });
 it('rejects upper edges that bridge across a concave lower recess',()=>{
  const f=mainResidenceExamples()[1].forms![0];
  expect(()=>validateFootprint({...f,points:[{x:-12,z:-10},{x:12,z:-10},{x:12,z:10},{x:4,z:10},{x:4,z:-2},{x:-4,z:-2},{x:-4,z:10},{x:-12,z:10}],upper:{height:4,points:[{x:-10,z:1},{x:10,z:1},{x:10,z:7},{x:-10,z:7}]}})).toThrow(/inset/);
 });
 it('preserves the retained attached-wing estate without architectural or landscape mutations',()=>{
  const c=validateCompositionPreview(retained.changes);
  expect(c.wings).toEqual(retained.changes.wings);expect(c.forms).toBeUndefined();
  expect(c.estateLandscape).toEqual(retained.changes.estateLandscape);
 });
});
