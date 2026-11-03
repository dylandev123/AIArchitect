import {afterEach,describe,expect,it,vi} from 'vitest';
import {compileArchitecturalPlan,architecturalPlanSchema,type ArchitecturalPlan} from './plan';
import {compositionFirstFixture,type CompositionFixture} from './compositionFirst.fixture';
import {physicalEvidence} from '../experimental/semantic-building/physical';
import {applySceneOperations,validateScene} from '../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
const names:CompositionFixture[]=['hillcrest','pavilion-court'];
const clone=(n:CompositionFixture)=>structuredClone(compositionFirstFixture(n));
const fails=(plan:ArchitecturalPlan,text:string)=>expect(()=>compileArchitecturalPlan(plan)).toThrow(text);
afterEach(()=>vi.unstubAllGlobals());
describe('building-scale composition survives room elaboration (developer fixtures, not AI quality evidence)',()=>{
 it.each(names)('%s: the declared composition parses strictly, compiles deterministically and round-trips',name=>{
  const p=clone(name),r=compileArchitecturalPlan(p);
  expect(architecturalPlanSchema.safeParse(p).success).toBe(true);
  expect(r.scene.architecturalPlan).toEqual(p);
  expect(compileArchitecturalPlan(p).scene).toEqual(r.scene);
  expect(validateScene(JSON.parse(JSON.stringify(r.scene)))).toEqual(r.scene);
  expect(Object.keys(r.provenance).sort()).toEqual(r.scene.elements.map(e=>e.id).sort());
  expect(r.access.reachable).toEqual(expect.arrayContaining(p.spaces.filter(s=>!s.outdoor).map(s=>s.id)));
  expect(physicalEvidence(r).failures).toEqual([]);
 });
 it.each(names)('%s: each declared roof span is ONE editable roof element over all of its rooms',name=>{
  const p=clone(name),r=compileArchitecturalPlan(p);
  for(const span of p.composition!.roofSpans){
   const roofs=r.scene.elements.filter(e=>e.kind==='roof'&&r.provenance[e.id].sources.includes(span.spaces[1]));
   expect(roofs.map(e=>e.id)).toEqual([span.id]);
   const [roof]=roofs;
   expect(roof.roofForm??'flat').toBe(span.form);
   expect(r.provenance[roof.id].sources).toEqual(expect.arrayContaining(span.spaces));
   // the roof covers the combined footprint of its members (plus overhang), not one cell
   const polys=span.spaces.map(sp=>r.intent.spaces.find(q=>q.id===sp)!.polygon);
   const xs=polys.flatMap(q=>q.map(v=>v[0])),zs=polys.flatMap(q=>q.map(v=>v[1])),width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...zs)-Math.min(...zs);
   // the roof covers the combined footprint of ALL members (a flat slab adds its overhang to the size; a pitched roof carries it as a parameter)
   const grow=span.form==='flat'?2*(span.overhang??0):0;
   expect(roof.size[0]).toBeCloseTo(width+grow,5);expect(roof.size[2]).toBeCloseTo(depth+grow,5);
   expect(width*depth).toBeGreaterThan(Math.max(...span.spaces.map(sp=>p.spaces.find(q=>q.id===sp)!.width*p.spaces.find(q=>q.id===sp)!.depth)));
  }
  const rooms=p.spaces.filter(s=>!s.outdoor).length,roofs=r.scene.elements.filter(e=>e.kind==='roof').length;
  expect(roofs).toBeLessThan(rooms);
  expect(r.composition!.roofElements).toBe(roofs);
 });
 it('a room-by-room version of the same house has more, fragmented roofs; the composed one has fewer',()=>{
  const p=clone('pavilion-court'),composed=compileArchitecturalPlan(p).scene.elements.filter(e=>e.kind==='roof').length;
  const loose=clone('pavilion-court');
  for(const s of loose.composition!.roofSpans)for(const sp of s.spaces)loose.roofs.push({space:sp,form:'flat',rise:.2});
  loose.composition!.roofSpans=[];loose.composition!.volumes=loose.composition!.volumes.map(v=>({...v,roof:undefined}));
  const fragmented=compileArchitecturalPlan(loose).scene.elements.filter(e=>e.kind==='roof').length;
  expect(composed).toBe(4);expect(fragmented).toBe(9);
 });
 it.each(names)('%s: height hierarchy is declared, built and measured',name=>{
  const r=compileArchitecturalPlan(clone(name)),v=Object.fromEntries(r.composition!.volumes.map(x=>[x.id,x]));
  const tops=r.composition!.volumes.filter(x=>x.top>0).sort((a,b)=>b.top-a.top).map(x=>x.tier);
  const rank:Record<string,number>={primary:3,secondary:2,subordinate:1};
  expect(tops).toEqual([...tops].sort((a,b)=>rank[b]-rank[a]));
  expect(Object.keys(v).length).toBeGreaterThan(1);
 });
 it('the multilevel luxury composition keeps two storeys, a stair, a crown hip roof and a sheltered entrance',()=>{
  const p=clone('hillcrest'),r=compileArchitecturalPlan(p);
  const hip=r.scene.elements.find(e=>e.id==='crown-roof')!;
  expect(hip.roofForm).toBe('hip');
  expect(hip.at[1]).toBeGreaterThan(8);                      // above the two-storey primary volume
  const top=(id:string)=>r.composition!.volumes.find(v=>v.id===id)!.top;
  expect(top('stone-house')-top('timber-bar')).toBeGreaterThanOrEqual(p.composition!.heightStep!);
  expect(r.scene.elements.some(e=>e.id.startsWith('main-stair'))).toBe(true);
  expect(r.composition!.entrance).toEqual({portal:'estate-door',porch:'porch',roofed:true});
  expect(r.scene.elements.find(e=>e.id==='estate-door')!.size[1]).toBe(3.4);
 });
 it.each(names)('%s: facade rhythms become evenly spaced real openings in the constructed walls',name=>{
  const p=clone(name),r=compileArchitecturalPlan(p);
  for(const f of p.composition!.facades){
   const ev=r.composition!.facades.find(x=>x.id===f.id)!;
   expect(ev.openings).toHaveLength(f.bays);
   const built=r.portalEvidence.filter(e=>(e as {id:string}).id.startsWith(`${f.id}-`)) as {width:number;local:[number,number]}[];
   expect(built).toHaveLength(f.bays);
   built.forEach(b=>expect(b.width).toBe(f.width));
   if(f.bays>1){const xs=built.map(b=>b.local[0]+b.local[1]).sort((a,b)=>a-b),gaps=xs.slice(1).map((x,i)=>x-xs[i]);gaps.forEach(g=>expect(g).toBeCloseTo(gaps[0],5));}
  }
  const windows=r.scene.elements.filter(e=>e.kind==='wall'&&e.opening?.glazed);
  expect(windows.length).toBeGreaterThanOrEqual(p.composition!.facades.filter(f=>f.kind==='windows').reduce((a,f)=>a+f.bays,0));
 });
 it.each(names)('%s: volume material is a default; an explicit room material wins',name=>{
  const p=clone(name);const first=compileArchitecturalPlan(p);
  const volume=p.composition!.volumes[0],room=p.spaces.find(s=>volume.masses.includes(s.mass)&&!s.outdoor)!;
  const wallsOf=(r:ReturnType<typeof compileArchitecturalPlan>,id:string)=>r.scene.elements.filter(e=>e.kind==='wall'&&r.provenance[e.id].sources[1]===id);
  expect(wallsOf(first,room.id).every(w=>w.material===volume.material)).toBe(true);
  room.facadeMaterial='bronze';
  expect(wallsOf(compileArchitecturalPlan(p),room.id).every(w=>w.material==='bronze')).toBe(true);
 });
 it.each(names)('%s: survives rotation with identical structure',name=>{
  const p=clone(name);p.orientation=.37;const r=compileArchitecturalPlan(p);
  expect(r.scene.elements.filter(e=>e.kind==='roof').map(e=>e.id).sort()).toEqual(compileArchitecturalPlan(clone(name)).scene.elements.filter(e=>e.kind==='roof').map(e=>e.id).sort());
  expect(physicalEvidence(r).failures).toEqual([]);
 });
});
describe('a composition the construction cannot honour is rejected, never substituted',()=>{
 it('rooms that do not tile one rectangle cannot share a roof',()=>{const p=clone('hillcrest');p.composition!.roofSpans[1].spaces=['bed-1','bed-3'];fails(p,'do not tile one rectangle');});
 it('rooms of different envelope heights cannot share a roof',()=>{const p=clone('pavilion-court');p.spaces.find(s=>s.id==='dining')!.height=4.4;fails(p,'one envelope height');});
 it('a roof span cannot cover rooms that have a storey stacked above',()=>{const p=clone('hillcrest');p.composition!.roofSpans[0].spaces=['hall','salon'];fails(p,'stacked');});
 it('a room cannot have both its own roof and a span',()=>{const p=clone('pavilion-court');p.roofs.push({space:'living',form:'flat'});fails(p,'exactly one roof');});
 it('a volume cannot claim one roof while a room carries another',()=>{
  const p=clone('pavilion-court');p.composition!.roofSpans[1].spaces=['bed-a','bed-b','bed-c','bed-d'];p.composition!.roofSpans[1].overhang=0;p.roofs.push({space:'spine',form:'flat',rise:.2});
  fails(p,'separate roof');
 });
 it('a primary volume that is not actually taller than a secondary one is rejected',()=>{
  const p=clone('pavilion-court');for(const s of p.spaces.filter(q=>q.mass==='bar'))s.height=4.8;fails(p,'hierarchy needs at least');
 });
 it('a wing outside every volume is rejected',()=>{const p=clone('pavilion-court');p.composition!.volumes=p.composition!.volumes.filter(v=>v.id!=='court-garden');fails(p,'not part of any declared volume');});
 it('an entrance porch must be sheltered and be the arrival space',()=>{
  const p=clone('pavilion-court');p.roofs=p.roofs.filter(r=>r.space!=='porch');fails(p,'no roof');
  const q=clone('pavilion-court');q.composition!.entrance={portal:'living-court',porch:'court'};fails(q,'entrance');
 });
 it('a porch that is lower than its entrance door is rejected',()=>{const p=clone('hillcrest');p.spaces.find(s=>s.id==='porch')!.height=3.2;fails(p,'must clear the door');});
 it('facade bays that do not fit the wall are rejected',()=>{const p=clone('hillcrest');p.composition!.facades[0].bays=6;fails(p,'do not fit');});
 it('a facade door rhythm must name an outdoor space',()=>{const p=clone('hillcrest');delete p.composition!.facades[4].to;fails(p,'outdoor space');});
 it('facade bays on a wall shared with another room are refused by the existing construction rules',()=>{const p=clone('hillcrest');p.composition!.facades.push({id:'hall-west',space:'bed-3',side:'east',kind:'windows',bays:2,width:1.5,height:2,sill:.9});expect(()=>compileArchitecturalPlan(p)).toThrow();});
 it('plans without a composition compile exactly as before',()=>{const p=clone('pavilion-court');delete p.composition;p.roofs.push(...['living','dining','spine','bed-a','bed-b','bed-c','bed-d'].map(space=>({space,form:'flat' as const,rise:.2})));const r=compileArchitecturalPlan(p);expect(r.composition).toBeUndefined();expect(r.scene.elements.filter(e=>e.kind==='roof')).toHaveLength(9);});
});
describe('editability, save/reload, undo and redo',()=>{
 it('the roof span is an ordinary element: it can be resized and the scene stays valid',()=>{
  const r=compileArchitecturalPlan(clone('hillcrest')),roof=r.scene.elements.find(e=>e.id==='crown-roof')!;
  const edited=applySceneOperations(r.scene,[{op:'resize',id:'crown-roof',size:[roof.size[0]+2,roof.size[1],roof.size[2]+2]}]);
  expect(edited.elements.find(e=>e.id==='crown-roof')!.size[0]).toBeCloseTo(roof.size[0]+2);
  expect(validateScene(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
  expect(edited.architecturalPlan).toEqual(r.scene.architecturalPlan);   // the declared composition travels with the scene
 });
 it('saves, reloads, undoes and redoes a composed house without losing the composition',async()=>{
  const data=new Map<string,string>();
  vi.stubGlobal('window',{addEventListener:()=>{},localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});
  useProjectStore.setState({projects:[]});
  const first=compileArchitecturalPlan(clone('hillcrest')).scene,edited=applySceneOperations(first,[{op:'resize',id:'crown-roof',size:[first.elements.find(e=>e.id==='crown-roof')!.size[0]+1,first.elements.find(e=>e.id==='crown-roof')!.size[1],first.elements.find(e=>e.id==='crown-roof')!.size[2]]}]);
  const store=useProjectStore.getState(),project=store.createProject('Composed house','house','direct-scene');
  store.appendVersion(project.id,'Composed',JSON.stringify(first));store.appendVersion(project.id,'Roof widened',JSON.stringify(edited));
  const saved=new Map(data);useProjectStore.setState({projects:[]});for(const [k,v] of saved)data.set(k,v);
  await useProjectStore.persist.rehydrate();
  const current=()=>JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson);
  expect(current()).toEqual(JSON.parse(JSON.stringify(edited)));
  expect(current().architecturalPlan.composition.roofSpans.map((s:{id:string})=>s.id)).toEqual(['crown-roof','sleeping-roof','garden-roof']);
  store.undo(project.id);expect(current()).toEqual(JSON.parse(JSON.stringify(first)));
  expect(compileArchitecturalPlan(current().architecturalPlan).scene).toEqual(first);   // reloaded plan recompiles to the stored geometry
  store.redo(project.id);expect(current()).toEqual(JSON.parse(JSON.stringify(edited)));
 });
});
