import { describe,it,expect } from 'vitest';
import { footprintExamples } from './footprint-examples';
import { footprintPlate,validateFootprint } from './footprint';
import { buildComposition,executeCompositionPatch,validateComposition } from './composition';
import { resolveVillaResult,villaProviderOutputSchema } from './terra';
describe('footprint-building@1',()=>{
 it('constructs three different triangulated, finite closed plates through the existing provider contract',()=>{
  for(const c of footprintExamples()){
   const f=c.forms![0],outline=validateFootprint(f),g=footprintPlate(outline,.3);g.computeBoundingBox();
   expect([...g.attributes.position.array].every(Number.isFinite)).toBe(true);
   // Extrusion must cover the concave polygon area, not its convex hull.
   const a=g.attributes.position;let top=0;
   for(let i=0;i<a.count;i+=3)if([i,i+1,i+2].every(j=>Math.abs(a.getY(j)-.3)<1e-5))top+=Math.abs((a.getX(i+1)-a.getX(i))*(a.getZ(i+2)-a.getZ(i))-(a.getZ(i+1)-a.getZ(i))*(a.getX(i+2)-a.getX(i)))/2;
   const area=Math.abs(outline.reduce((n,p,i)=>{const q=outline[(i+1)%outline.length];return n+p.x*q.z-q.x*p.z;},0))/2;
   expect(top).toBeCloseTo(area,3);g.dispose();
   const response={changes:c,summary:'Local test',unsupported:[]};
   expect(villaProviderOutputSchema({mode:'generate',prompt:'test'}).safeParse(response).success).toBe(true);
   expect(buildComposition(resolveVillaResult({mode:'generate',prompt:'test'},response).config as typeof c).forms).toEqual(c.forms);
  }
 });
 it('rejects crossings, tiny edges, fixed site escape and conflicting envelopes atomically',()=>{
  const c=footprintExamples()[0],f=c.forms![0];
  expect(()=>validateFootprint({...f,points:[{x:-5,z:-5},{x:5,z:5},{x:-5,z:5},{x:5,z:-5}]})).toThrow(/crossing/);
  expect(()=>validateFootprint({...f,points:[{x:0,z:0},{x:.1,z:0},{x:5,z:5}]})).toThrow(/1m/);
  expect(()=>validateComposition({...c,siteMode:'fixed',garden:{x:0,z:0,width:12,depth:12}})).toThrow(/site/);
  expect(()=>executeCompositionPatch(c,{forms:[{type:'put',form:{...f,id:'overlap'}}]})).toThrow(/clear/);
  expect(c.forms).toHaveLength(1);
 });
 it('patches forms without touching retained architecture',()=>{
  const c=footprintExamples()[0],f=c.forms![0];const next=executeCompositionPatch(c,{forms:[{type:'put',form:{...f,height:5}}]});
  expect(next.forms![0].height).toBe(5);expect(next.appearance).toEqual(c.appearance);
  expect(()=>executeCompositionPatch(c,{forms:[{type:'remove',id:f.id}]})).toThrow();
 });
});
