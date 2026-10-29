import {describe,it,expect} from 'vitest';
import {residenceCompositionStudies} from './residence-composition-studies';
import {buildComposition,executeCompositionPatch} from './composition';
import {footprintBounds,validateFootprint,footprintPlate,footprintOutline} from './footprint';
import {resolveVillaResult,villaProviderOutputSchema} from './terra';
describe('independent residence volumes',()=>{
 it('passes all three arrangements through the provider contract and renderer assembly',()=>{
  for(const c of residenceCompositionStudies()){
   const req={mode:'generate' as const,prompt:'offline'},response={changes:c,summary:'Offline residence',unsupported:[]};
   expect(villaProviderOutputSchema(req).safeParse(response).success).toBe(true);
   expect(buildComposition(resolveVillaResult(req,response).config as typeof c).id).toBe(c.id);
   for(const f of c.forms??[]){validateFootprint(f);for(const l of [f,...f.volumes??[]]){const g=footprintPlate(footprintOutline(l),.26);expect([...g.attributes.position.array].every(Number.isFinite)).toBe(true);g.dispose();}}
  }
 });
 it('edits individual upper heights atomically and includes projections in property bounds',()=>{
  const c=residenceCompositionStudies()[0],f=c.forms![0],original=structuredClone(c);
  const volumes=structuredClone(f.volumes!);volumes[0].height=5;
  const edited=executeCompositionPatch(c,{forms:[{type:'put',form:{...f,volumes}}]});
  expect(edited.forms![0].volumes![0].height).toBe(5);expect(c).toEqual(original);
  const rectangle=(x:number,z:number,w:number,d:number)=>[{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}];
  const projected={...f,facades:undefined,points:rectangle(-10,-10,20,20),volumes:[{height:4,points:rectangle(-5,-5,16.5,10)}]};
  validateFootprint(projected);expect(footprintBounds(projected).right).toBeCloseTo(11.66);
  expect(()=>validateFootprint({...projected,volumes:[{height:4,points:rectangle(-5,-5,18,10)}]})).toThrow(/projection/);
  expect(()=>validateFootprint({...projected,volumes:[{height:4,points:rectangle(10.5,-8,1.5,16)}]})).toThrow(/60% supported/);
  expect(()=>validateFootprint({...f,volumes:[f.volumes![0],f.volumes![0]]})).toThrow(/separated/);
  expect(()=>executeCompositionPatch(c,{forms:[{type:'put',form:{...f,upper:{height:4,points:rectangle(-5,-5,10,10)}}}]})).toThrow(/upper or volumes/);
  expect(c).toEqual(original);
 });
});
