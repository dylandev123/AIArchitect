import { describe,it,expect } from 'vitest';
import { stackedVolumeExamples } from './stacked-volume-examples';
import { resolveStack,rectangleFromPoints,exposedRoof,roofRails } from './stacked-volumes';
import { executeCompositionPatch } from './composition';
import { footprintBounds,footprintFacadeBays } from './footprint';
import { resolveVillaResult,villaProviderOutputSchema } from './terra';
describe('independent stacked principal volumes',()=>{
 it('validates four distinct reusable compositions through Terra generation',()=>{
  const examples=stackedVolumeExamples();
  expect(new Set(examples.map(c=>JSON.stringify(c.forms![0].stack))).size).toBe(4);
  for(const c of examples){
   const f=c.forms![0],levels=resolveStack(rectangleFromPoints(f.points),f.height,f.stack!);
   expect(Math.max(...levels.map(v=>v.level))).toBeLessThanOrEqual(3);
   expect(footprintFacadeBays(f)).toBeLessThanOrEqual(300);
   expect(villaProviderOutputSchema({mode:'generate',prompt:'offline'}).safeParse({changes:c,summary:'Offline',unsupported:[]}).success).toBe(true);
   for(const v of levels){const parent=levels.find(p=>p.id===v.parentId);expect(v.bottom).toBeCloseTo(parent?parent.bottom+parent.height+.26:f.height+.26);}
  }
 });
 it('supports one, two, three and four storeys without forcing extra levels',()=>{
  const f=stackedVolumeExamples()[0].forms![0];
  for(let count=0;count<=3;count++){
   const c=executeCompositionPatch(stackedVolumeExamples()[0],{forms:[{type:'put',form:{...f,stack:f.stack!.slice(0,count)}}]});
   expect(c.forms![0].stack).toHaveLength(count);
  }
 });
 it('rejects floating, cyclic, excessive cantilevers, collisions and fifth storeys',()=>{
  const f=stackedVolumeExamples()[0].forms![0],base=rectangleFromPoints(f.points),stack=f.stack!;
  expect(()=>resolveStack({x:0,z:0,width:5,depth:5},3,[{...stack[0],x:0,z:0,width:9,depth:9}])).toThrow(/60%/);
  for(const candidate of [ [{...stack[0],parentId:'missing'}],[{...stack[0],parentId:stack[0].id}],[{...stack[0],x:30}], [...stack,{...stack[2],id:'fifth',parentId:'fourth'}],[stack[0],{...stack[0],id:'collision'}] ])expect(()=>resolveStack(base,f.height,candidate)).toThrow();
 });
 it('preserves unrelated estate data during Terra edits and rejects invalid edits atomically',()=>{
  const c=stackedVolumeExamples()[0];
  const source={...c,components:[{id:'retained-pavilion',builder:'curved-pavilion@1' as const,x:25,z:-20,orientation:0,width:6,depth:5,height:3,material:'ivory' as const}],terraces:[{id:'unrelated',x:25,z:20,width:3,depth:3,kind:'terrace' as const,timber:true}]};
  const edited={...c.forms![0],stack:c.forms![0].stack!.map((v,i)=>i? v:{...v,height:4})};
  const result=resolveVillaResult({mode:'edit',prompt:'Raise second floor',current:source},{changes:{forms:[{type:'put',form:edited}]},summary:'Edited',unsupported:[]}).config as typeof source;
  expect(result.terraces).toEqual(source.terraces);expect(result.appearance).toEqual(source.appearance);
  expect(()=>executeCompositionPatch(source,{forms:[{type:'put',form:{...edited,stack:[{...edited.stack![0],x:39}]}}]})).toThrow();
  expect(result.components).toEqual(source.components);expect(source.forms).toEqual(c.forms);
 });
 it('partitions roof slabs around attached floors without duplicate coplanar surfaces',()=>{
  const roof={x:0,z:0,width:20,depth:16},child={x:3,z:0,width:18,depth:12};
  const cells=exposedRoof(roof,[child]);
  expect(cells.reduce((area,c)=>area+c.width*c.depth,0)).toBeCloseTo(320-16*12);
  for(const c of cells)expect(Math.abs(c.x-child.x)>=(c.width+child.width)/2-.001||Math.abs(c.z-child.z)>=(c.depth+child.depth)/2-.001).toBe(true);
 });
 it('counts cantilevers in bounds and removes covered rail and furnishing areas',()=>{
  const f=stackedVolumeExamples()[2].forms![0];expect(footprintBounds(f).right).toBeGreaterThan(12.5);
  const roof={x:0,z:0,width:20,depth:14},cover={x:6,z:0,width:10,depth:12};
  const cells=exposedRoof(roof,[cover],1);
  expect(cells.every(c=>Math.abs(c.x-cover.x)>=(c.width+cover.width)/2+1-.001||Math.abs(c.z-cover.z)>=(c.depth+cover.depth)/2+1-.001)).toBe(true);
  expect(roofRails(roof,[cover]).filter(r=>r.side&&r.x===10).reduce((n,r)=>n+r.length,0)).toBeCloseTo(1.68);
 });
});
