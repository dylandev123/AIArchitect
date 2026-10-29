import {describe,it,expect} from 'vitest';
import {facadeExamples} from './facade-examples';
import {footprintFacadeSegments,validateFootprint,footprintBounds} from './footprint';
import {executeCompositionPatch} from './composition';
import {villaProviderOutputSchema} from './terra';
describe('edge-selected architecture',()=>{
 it('preserves shared footprint, upper floor and estate through provider and edit contracts',()=>{
  const examples=facadeExamples(),first=examples[0];
  for(const c of examples){
   expect(c.forms![0].points).toEqual(first.forms![0].points);
   expect(c.forms![0].upper!.points).toEqual(first.forms![0].upper!.points);
   expect(c.estateLandscape).toEqual(first.estateLandscape);
   expect(footprintBounds(c.forms![0])).toEqual(footprintBounds(first.forms![0]));
   expect(villaProviderOutputSchema({mode:'generate',prompt:'offline'}).safeParse({changes:c,summary:'Study',unsupported:[]}).success).toBe(true);
  }
  const patched=executeCompositionPatch(first,{forms:[{type:'put',form:examples[1].forms![0]}]});
  expect(patched.estateLandscape).toEqual(first.estateLandscape);
  expect(patched.forms![1]).toEqual(first.forms![1]);
 });
 it('assigns all samples of a curved source edge consistently for either winding',()=>{
  const f=facadeExamples()[0].forms![0],segments=footprintFacadeSegments(f);
  expect(segments.length).toBe(validateFootprint(f).length);
  expect(segments.filter(s=>s.edge===5).every(s=>s.section?.treatment==='loggia')).toBe(true);
  expect(footprintFacadeSegments({...f,facades:undefined,upper:undefined,points:[...f.points].reverse().map(({x,z})=>({x,z}))})[0].outward).toBe(-segments[0].outward);
 });
 it('rejects overlapping/missing selectors including upstairs, retaining the original',()=>{
  const c=facadeExamples()[0],f=c.forms![0];
  for(const facades of [[{edges:[15],treatment:'glass'}],[{edges:[1,1],treatment:'solid'}]] as const){
   expect(()=>executeCompositionPatch(c,{forms:[{type:'put',form:{...f,facades}}]})).toThrow(/Facade/);
  }
  expect(()=>validateFootprint({...f,upper:{...f.upper!,facades:[{edges:[14],treatment:'solid'}]}})).toThrow(/Facade/);
 });
});
