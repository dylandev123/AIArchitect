import { describe,it,expect } from 'vitest';
import { footprintSchema,validateFootprint,preciseWallPanels,resolveArchitecturalLevels } from './footprint';
const opening={id:'entry',edge:0,offset:2,width:1.2,sill:0,height:2.4,kind:'door',frame:'timber'};
const base=()=>footprintSchema.parse({id:'test',builder:'footprint-building@1',x:0,z:0,orientation:0,points:[{x:0,z:0},{x:12,z:0},{x:12,z:10},{x:0,z:10}],height:3.4,material:'ivory',openings:'panoramic',preciseOpenings:[opening]});
describe('precise exterior openings',()=>{
 it('preserves offset/size with real masonry voids',()=>{const p=base();validateFootprint(p);const panels=preciseWallPanels(12,3.4,p.preciseOpenings!);expect(panels.reduce((n,r)=>n+r.width*r.height,0)).toBeCloseTo(12*3.4-1.2*2.4);expect(panels.some(r=>2.6>r.x-r.width/2&&2.6<r.x+r.width/2&&1.2>r.y-r.height/2&&1.2<r.y+r.height/2)).toBe(false);});
 it('rejects collisions, floating doors, missing/curved edges and procedural conflicts',()=>{
  for(const patch of [{offset:11},{height:3.3},{sill:1},{edge:12}])expect(()=>validateFootprint({...base(),preciseOpenings:[{...base().preciseOpenings![0],...patch}]})).toThrow();
  const p=base();expect(()=>validateFootprint({...p,preciseOpenings:[...p.preciseOpenings!,{...p.preciseOpenings![0],id:'collision',offset:2.5}]})).toThrow(/separation/);
  expect(()=>validateFootprint({...p,points:p.points.map((q,i)=>i===0?{...q,curve:{x:6,z:-2}}:q)})).toThrow(/straight/);
  expect(()=>validateFootprint({...p,facades:[{edges:[0],treatment:'glass'}]})).toThrow(/procedural/);
 });
 it('keeps per-level openings independent and validates upper opening geometry',()=>{
  const p=base();p.levels=[{id:'upper',parentId:'base',points:[{x:1,z:1},{x:10,z:1},{x:10,z:8},{x:1,z:8}],height:3.2,material:'sand',openings:'private',rooftop:'none',preciseOpenings:[]}];
  validateFootprint(p);expect(resolveArchitecturalLevels(p)[1].preciseOpenings).toEqual([]);
  p.levels[0].preciseOpenings=[{...p.preciseOpenings![0],offset:8.5}];expect(()=>validateFootprint(p)).toThrow(/clearance/);
 });
});

import { COMPOSITION_EXAMPLES } from './composition-examples';
import { executeCompositionPatch } from './composition';
it('wing controls use atomic existing patches and preserve originals and defaults',()=>{
 const c=structuredClone(COMPOSITION_EXAMPLES[0]),w=c.wings[0],original=JSON.stringify(c);
 const changes={facadeOpenings:[{face:'rear' as const,level:0,openings:[{id:'door',offset:2,width:1.2,sill:0,height:2.4,kind:'door' as const,frame:'timber' as const}]}]};
 // Use an isolated existing wing to avoid authorizing shared-wall changes.
 c.wings=[{...w,parentId:null,detached:false,veranda:0,balcony:0}];c.connections=[];c.terraces=[];c.pool=null;c.siteMode='derived';
 const before=JSON.stringify(c),next=executeCompositionPatch(c,{wings:[{type:'adjust',id:w.id,changes}]});
 expect(next.wings[0].facadeOpenings).toEqual(changes.facadeOpenings);expect(JSON.stringify(c)).toBe(before);expect(original).not.toBe(before);
 expect(()=>executeCompositionPatch(c,{wings:[{type:'adjust',id:w.id,changes:{roofRise:2}}]})).toThrow(/pitched/);
 expect(()=>executeCompositionPatch(c,{wings:[{type:'adjust',id:w.id,changes:{facadeOpenings:[{...changes.facadeOpenings[0],openings:[{...changes.facadeOpenings[0].openings[0],offset:200}]}]}}]})).toThrow();
});
