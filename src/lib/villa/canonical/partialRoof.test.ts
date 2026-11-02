/** Roof over the exposed remainder of a partly covered space. Developer-authored plans exercise the
 * contract only; they are not AI output and make no architectural-quality claim. */
import {describe,expect,it} from 'vitest';
import {compileArchitecturalPlan,type ArchitecturalPlan} from './plan';
import {canonicalFixture} from './fixture';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {exposedPieces,subtractConvex,polygonArea,clipConvex,minimumWidth,coverOf} from '../experimental/semantic-building/vertical';
type Plan=ArchitecturalPlan;
const decisions=(plan:Plan):string[]=>{try{compileArchitecturalPlan(plan);return [];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};
const rect=(x:number,z:number,w:number,d:number)=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]] as [number,number][];
/** Day-room (5×8, ground) under a smaller upper sleep-room, roofed flat. */
const partial=(width:number,depth:number,form:'flat'|'gable'='flat',overhang?:number):Plan=>{
 const plan=canonicalFixture(),sleep=plan.spaces.find(s=>s.id==='sleep-room')!;
 sleep.width=width;sleep.depth=depth;plan.portals.find(p=>p.id==='sleep-door')!.alignment='start';
 plan.roofs.push({space:'day-room',form,...(form==='flat'?{}:{rise:1.2}),...(overhang?{overhang}:{})});
 return plan;
};
const roofsOf=(plan:Plan,space:string)=>compileArchitecturalPlan(plan).scene.elements.filter(e=>e.kind==='roof'&&e.id.startsWith(`${space}-roof`));
const area=(e:{size:readonly number[]})=>e.size[0]*e.size[2];

describe('exposed-area geometry',()=>{
 it('subtracts a convex footprint exactly, leaving disjoint pieces whose area is the remainder',()=>{
  const pieces=subtractConvex(rect(0,0,6,4),rect(0,0,3,2));
  expect(pieces.reduce((n,p)=>n+polygonArea(p),0)).toBeCloseTo(18);
  pieces.forEach((p,i)=>{expect(polygonArea(clipConvex(p,rect(0,0,3,2)))).toBeCloseTo(0);pieces.slice(i+1).forEach(q=>expect(polygonArea(clipConvex(p,q))).toBeCloseTo(0));});
  expect(subtractConvex(rect(0,0,2,2),rect(5,5,1,1))).toEqual([rect(0,0,2,2)]);
  expect(subtractConvex(rect(1,1,2,2),rect(0,0,6,6))).toEqual([]);
 });
 it('removes several covering spaces and measures narrow remainders',()=>{
  const all=[{id:'low',level:'g',polygon:rect(0,0,8,4)},{id:'a',level:'u',polygon:rect(0,0,3,4)},{id:'b',level:'u',polygon:rect(5,0,3,4)}];
  const cover=coverOf(all[0],all,id=>({g:0,u:3}[id as 'g']));
  const pieces=exposedPieces(all[0],all,cover);
  expect(pieces).toHaveLength(1);expect(polygonArea(pieces[0])).toBeCloseTo(8);expect(minimumWidth(pieces[0])).toBeCloseTo(2);
 });
 it('only the lowest higher datum is the cover on three levels',()=>{
  const all=[{id:'g',level:'0',polygon:rect(0,0,8,4)},{id:'m',level:'1',polygon:rect(0,0,4,4)},{id:'t',level:'2',polygon:rect(0,0,2,4)}];
  const top=(id:string)=>({'0':0,'1':3,'2':6}[id as '0']),cover=coverOf(all[0],all,top);
  expect(cover.by).toEqual(['m']);
  expect(exposedPieces(all[0],all,cover).reduce((n,p)=>n+polygonArea(p),0)).toBeCloseTo(16);
  const mid=coverOf(all[1],all,top);expect(exposedPieces(all[1],all,mid).reduce((n,p)=>n+polygonArea(p),0)).toBeCloseTo(8);
 });
});

describe('compiled roof over the exposed remainder',()=>{
 it('compact: a half-covered room gets one flat roof exactly over the open half, keeping the model\'s flat form',()=>{
  const roofs=roofsOf(partial(5,4),'day-room');
  expect(roofs).toHaveLength(1);
  expect(roofs[0].id).toBe('day-room-roof');expect(area(roofs[0])).toBeCloseTo(5*4);expect(roofs[0].roofForm).toBeUndefined();
 });
 it('asymmetric: a corner-covered room gets an L-shaped remainder as two slabs, with total area = footprint − covered area',()=>{
  const roofs=roofsOf(partial(2,4),'day-room');
  expect(roofs.map(r=>r.id)).toEqual(['day-room-roof','day-room-roof-2']);
  expect(roofs.reduce((n,r)=>n+area(r),0)).toBeCloseTo(5*8-2*4);
 });
 it('no derived roof lies over the upper room, and the covering room keeps its own roof',()=>{
  const compiled=compileArchitecturalPlan(partial(5,4)),sleep=compiled.scene.elements.find(e=>e.id==='sleep-room-floor')!,roof=compiled.scene.elements.find(e=>e.id==='day-room-roof')!;
  const overlapZ=Math.min(roof.at[2]+roof.size[2]/2,sleep.at[2]+sleep.size[2]/2)-Math.max(roof.at[2]-roof.size[2]/2,sleep.at[2]-sleep.size[2]/2);
  expect(overlapZ).toBeLessThanOrEqual(1e-6);
  expect(compiled.scene.elements.some(e=>e.id==='sleep-room-roof')).toBe(true);
 });
 it('is deterministic and the roofs remain individually editable elements with provenance',()=>{
  const a=compileArchitecturalPlan(partial(2,4)),b=compileArchitecturalPlan(partial(2,4));
  expect(a.scene).toEqual(b.scene);
  for(const id of ['day-room-roof','day-room-roof-2'])expect(a.provenance[id].sources).toEqual(['day-room','ground']);
 });
 it('multilevel: a stepped third storey leaves the middle roof only over what is open to the sky',()=>{
  const plan=canonicalFixture();
  delete plan.spaces.find(s=>s.id==='sleep-room')!.height; // derived from the level above
  plan.levels.push({id:'top',above:'upper',rise:3});
  plan.masses.push({id:'top-mass',role:'study'});
  plan.spaces.push({id:'study',mass:'top-mass',level:'top',use:'study',width:3.5,depth:8,height:2.8,outdoor:false,placement:{relativeTo:'sleep-room',side:'same',alignment:'start',gap:0}});
  plan.stairs.push({id:'ascent-top',lower:'sleep-room',upper:'study',width:1.1,run:4.8,landing:1.1,headroom:2.1});
  plan.roofs.push({space:'study',form:'flat'});
  const middle=roofsOf(plan,'sleep-room'),top=roofsOf(plan,'study');
  expect(middle).toHaveLength(1);expect(area(middle[0])).toBeCloseTo(1.5*8);
  expect(top).toHaveLength(1);expect(area(top[0])).toBeCloseTo(3.5*8);
 });
 it('a roofed stair-lower room is accepted when the exposed roof stays clear of the flight',()=>{
  const plan=canonicalFixture();
  plan.spaces.find(s=>s.id==='gallery')!.depth=7.5;
  plan.roofs.push({space:'hall',form:'flat'});
  const roofs=roofsOf(plan,'hall');
  expect(roofs).toHaveLength(1);expect(area(roofs[0])).toBeCloseTo(3*.5);
 });
});

describe('contradictory or unsupported roofs are still refused',()=>{
 it('a roof on a fully covered space',()=>{
  const plan=canonicalFixture();plan.roofs.push({space:'day-room',form:'flat'});
  expect(decisions(plan).join('\n')).toMatch(/day-room: roof conflicts with upper occupancy: it is fully covered.*Omit this roof/);
 });
 it('a partly covered space with no roof',()=>{
  const plan=partial(5,4);plan.roofs=plan.roofs.filter(r=>r.space!=='day-room');
  expect(decisions(plan).join('\n')).toMatch(/day-room: incomplete overhead enclosure/);
 });
 it('a pitched roof over a partial cover: the junction against the taller wall is not built or guessed',()=>{
  expect(decisions(partial(5,4,'gable')).join('\n')).toMatch(/day-room: unsupported-capability: gable roof over the exposed remainder beside sleep-room.*lean-to or valley junction/);
 });
 it('an overhang that would extend into the storey above',()=>{
  expect(decisions(partial(5,4,'flat',.4)).join('\n')).toMatch(/day-room: unsupported-capability: overhang on the exposed remainder/);
 });
 it('a remainder too narrow to carry a roof',()=>{
  expect(decisions(partial(5,7.9)).join('\n')).toMatch(/day-room: roof conflicts with upper occupancy: the exposed remainder beside sleep-room is only 0\.10m wide/);
 });
});
