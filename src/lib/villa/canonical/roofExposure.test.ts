/** Roof exposure and facade exposure at construction level. Developer-authored fixtures (compact, multilevel, multi-wing) and the retained production
 * plan; contracts and geometry only, not AI quality evidence. The eave rule: an edge lies wholly against a wall or roof it would reach -> built flush on
 * that edge only (stated); anything else that clashes stays rejected, naming why. */
import {describe,expect,it} from 'vitest';
import {compileArchitecturalPlan,type ArchitecturalPlan} from './plan';
import {diagnosePlan} from './diagnose';
import {compositionFixture} from './compositions.fixture';
import {compositionFirstFixture} from './compositionFirst.fixture';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {buildSceneRoof} from '../scene/roofs';
import {pitchedRoofParts} from '../scene/roofIntersection';
import {validateScene,stageSceneOperations,type SceneElement} from '../scene/model';
import {resolveEaves,roofFootprints,exposedFascia,eavesOf,type EaveSection} from './coordination';

const material={color:'#cccbbb',roughness:.7,metalness:0};
const rejection=(p:ArchitecturalPlan)=>{try{compileArchitecturalPlan(p);return null;}catch(e){if(e instanceof DesignConflict)return e.decisions.join(' | ');throw e;}};
const errors=(p:ArchitecturalPlan,stage='roofs')=>diagnosePlan(p).findings.filter(f=>f.severity==='error'&&f.stage===stage);
const flushNotes=(p:ArchitecturalPlan)=>diagnosePlan(p).findings.filter(f=>f.severity==='observation'&&f.stage==='roofs').map(f=>f.message);
/** Element footprint in the plan frame (undoing the plan orientation), as [x0,x1,z0,z1]. */
const planRect=(c0:ReturnType<typeof compileArchitecturalPlan>,e:SceneElement)=>{const {origin,yaw}=c0.intent.frame,c=Math.cos(yaw),s=Math.sin(yaw),dx=e.at[0]-origin[0],dz=e.at[2]-origin[1],x=c*dx-s*dz,z=s*dx+c*dz;return [x-e.size[0]/2,x+e.size[0]/2,z-e.size[2]/2,z+e.size[2]/2].map(v=>+v.toFixed(6)+0);};
const roofOf=(c:ReturnType<typeof compileArchitecturalPlan>,space:string)=>c.scene.elements.find(e=>e.kind==='roof'&&c.provenance[e.id].sources[0]===space)!;
/** Minimum penetration depth of two convex parts (zero-thickness surfaces count when they cross a solid); <=0 means apart or merely touching. */
type Part=ReturnType<typeof pitchedRoofParts>[number];
function penetration(a:Part,b:Part){
 const axes=[...a.normals,...b.normals,...a.edges.flatMap(x=>b.edges.map(y=>x.clone().cross(y)))];let min=Infinity;
 for(const axis of axes){
  if(axis.lengthSq()<1e-12)continue;
  const u=axis.clone().normalize(),pa=a.vertices.map(v=>v.dot(u)),pb=b.vertices.map(v=>v.dot(u));
  const a0=Math.min(...pa),a1=Math.max(...pa),b0=Math.min(...pb),b1=Math.max(...pb);
  let o=Math.min(a1,b1)-Math.max(a0,b0);
  if(a1-a0<1e-9)o=Math.min(a0-b0,b1-a0);else if(b1-b0<1e-9)o=Math.min(b0-a0,a1-b0);
  min=Math.min(min,o);if(min<=1e-6)return min;
 }
 return min;
}
const penetrates=(a:Part[],b:Part[])=>a.some(p=>b.some(q=>penetration(p,q)>1e-6));
const vertices=(parts:ReturnType<typeof buildSceneRoof>)=>parts.flatMap(q=>q.kind==='triMesh'?q.vertices:[]);

describe('builders: per-edge eaves',()=>{
 const make=(form:'hip'|'gable',size:[number,number,number],extra:Partial<SceneElement>)=>({id:'r',label:'r',kind:'roof' as const,at:[0,0,0] as [number,number,number],rotation:0,size,material:'ivory' as const,panels:4,roofForm:form,overhang:.6,...extra}) as SceneElement;
 it('a roof whose edges are all the uniform overhang is byte-for-byte the historical roof',()=>{
  for(const form of ['hip','gable'] as const)for(const size of [[8,1.2,6],[6,1.2,8],[7,1.5,7]] as [number,number,number][]){
   expect(buildSceneRoof(make(form,size,{eaves:{north:.6,east:.6,south:.6,west:.6}}),material)).toEqual(buildSceneRoof(make(form,size,{}),material));
  }
 });
 it('a hip with one flush edge ends its eave on the wall line; the other three keep the overhang; every face stays planar',()=>{
  const parts=buildSceneRoof(make('hip',[8,1.2,6],{eaves:{west:0}}),material);
  const xs=vertices(parts).filter((_,i)=>i%3===0),zs=vertices(parts).filter((_,i)=>i%3===2);
  expect(Math.min(...xs)).toBeCloseTo(-4);expect(Math.max(...xs)).toBeCloseTo(4.6);expect(Math.min(...zs)).toBeCloseTo(-3.6);expect(Math.max(...zs)).toBeCloseTo(3.6);
  const west=parts.find(q=>q.id==='r-fascia-w')!;expect(west.kind==='box'&&west.position[0]).toBeCloseTo(-4.05);
  const north=parts.find(q=>q.id==='r-fascia-n')!;expect(north.kind==='box'&&north.size[0]).toBeCloseTo(8.6);
  for(const q of parts)if(q.kind==='triMesh'&&q.vertices.length===18){ // a quad: the four corners are coplanar
   const p=(i:number)=>q.vertices.slice(i*3,i*3+3),sub=(a:number[],b:number[])=>a.map((v,k)=>v-b[k]);
   const a=p(0),b=p(1),c=p(2),d=p(5),u=sub(b,a),v=sub(c,a),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],w=sub(d,a);
   expect(Math.abs(n[0]*w[0]+n[1]*w[1]+n[2]*w[2])).toBeLessThan(1e-9);
  }
 });
 it('a gable with a flush eave and a flush rake keeps its ridge over the room and the gable ends closed',()=>{
  const parts=buildSceneRoof(make('gable',[10,1.4,6],{eaves:{north:0,east:0}}),material);
  const xs=vertices(parts).filter((_,i)=>i%3===0),zs=vertices(parts).filter((_,i)=>i%3===2),ys=vertices(parts).filter((_,i)=>i%3===1);
  expect(Math.min(...xs)).toBeCloseTo(-5.6);expect(Math.max(...xs)).toBeCloseTo(5);expect(Math.min(...zs)).toBeCloseTo(-3);expect(Math.max(...zs)).toBeCloseTo(3.6);
  // the ridge stays at z=0 (over the nominal room centreline), at the roof's rise above the eaves
  expect(vertices(parts).filter((_,i)=>i%3===1).filter(y=>Math.abs(y-Math.max(...ys))<1e-9).length).toBeGreaterThan(0);
  expect(parts.filter(q=>q.id.includes('gable-')).length).toBe(2);
 });
 it('the pitched surfaces of a flush roof and its neighbour no longer intersect, where the uniform overhang did',()=>{
  const a=make('hip',[8,1.2,6],{at:[0,0,0]}),b=make('gable',[8,1.2,6],{at:[8,0,0],overhang:.6});
  const world=(e:SceneElement)=>[e.at[0],e.at[1],e.at[2],e.rotation];
  expect(penetrates(pitchedRoofParts(a,world(a)),pitchedRoofParts(b,world(b)))).toBe(true); // 0.6 + 0.6 overlap
  const fa={...a,eaves:{east:0},fascia:['north','south','west'] as ('north'|'south'|'west')[]},fb={...b,eaves:{west:0}}; // the hip's east board is withheld on the shared edge, as the compiler does
  expect(penetrates(pitchedRoofParts(fa,world(fa)),pitchedRoofParts(fb,world(fb)))).toBe(false); // they touch along the shared line and nothing more
 });
 it('the scene contract: eaves need a pitched roof and may not exceed the overhang; scaling keeps them proportional',()=>{
  const wrap=(e:object)=>({version:'architectural-scene-1',name:'r',elements:[{id:'roof',label:'r',kind:'roof',at:[0,5,0],size:[12,1,8],...e}]});
  expect(()=>validateScene(wrap({roofForm:'hip',overhang:.6,eaves:{west:0}}))).not.toThrow();
  expect(()=>validateScene(wrap({roofForm:'flat',overhang:.6,eaves:{west:0}}))).toThrow(/gable or hip/);
  expect(()=>validateScene(wrap({roofForm:'hip',overhang:.6,eaves:{west:.9}}))).toThrow(/exceed/);
  expect(()=>validateScene(wrap({overhang:.6,eaves:{west:0}}))).toThrow(/gable or hip/);
 });
});

describe('the eave resolver',()=>{
 const section=(key:string,rect:{x:number;z:number;width:number;depth:number},overhang:number,walls:typeof rect[]=[],extra:Partial<EaveSection>={}):EaveSection=>({key,id:key,level:'g',joined:new Set([key]),rect,form:'flat',overhang,bottom:3,rise:.2,neighbours:walls,walls,...extra});
 it('is symmetric and order independent for two abutting roofs',()=>{
  const a=section('a',{x:0,z:0,width:4,depth:4},.6),b=section('b',{x:4,z:0,width:4,depth:4},.5);
  a.walls=[b.rect];b.walls=[a.rect];
  const one=resolveEaves([a,b],[]),two=resolveEaves([b,a],[]);
  expect(one.eaves.get('a')).toEqual({...eavesOf(.6),east:0});expect(one.eaves.get('b')).toEqual({...eavesOf(.5),west:0});
  expect(two.eaves).toEqual(one.eaves);expect(one.unresolved).toEqual([]);
 });
 it('leaves an unobstructed roof exactly as authored, and a roof beside a lower, clear neighbour',()=>{
  const lone=section('a',{x:0,z:0,width:4,depth:4},.6),r=resolveEaves([lone],[{id:'low',rect:{x:4,z:0,width:4,depth:4},bottom:0,top:2.5}]);
  expect(r.eaves.get('a')).toEqual(eavesOf(.6));expect(r.trims).toEqual([]);
 });
 it('does not trim an edge a neighbour only partly faces',()=>{
  const a=section('a',{x:0,z:0,width:4,depth:8},.6),wall={x:4,z:0,width:4,depth:5};a.walls=[wall];
  const r=resolveEaves([a],[{id:'tall',rect:wall,bottom:0,top:6}]);
  expect(r.trims).toEqual([]);expect(r.eaves.get('a')).toEqual(eavesOf(.6));
  expect(r.unresolved[0].message).toMatch(/stands against only part of that 8 m edge; 5\.\.8 m of it is open/);
 });
 it('does not guess for a corner two sides could yield, nor for a neighbour that does not touch the wall',()=>{
  const a=section('a',{x:0,z:0,width:4,depth:4},.6);
  const corner=resolveEaves([a],[{id:'diag',rect:{x:4.2,z:4.2,width:3,depth:3},bottom:0,top:6}]);
  expect(corner.eaves.get('a')).toEqual(eavesOf(.6));expect(corner.unresolved[0].message).toMatch(/north\/east corner/);
  const gap=resolveEaves([a],[{id:'near',rect:{x:4.3,z:0,width:3,depth:4},bottom:0,top:6}]);
  expect(gap.eaves.get('a')).toEqual(eavesOf(.6));expect(gap.unresolved[0].message).toMatch(/does not stand against that wall/);
 });
 it('footprints and fascia use the per-side eave',()=>{
  const r={x:0,z:0,width:4,depth:4},eaves={...eavesOf(.5),west:0};
  expect(roofFootprints(r,eaves,[])[0].rect).toEqual({x:0,z:-.5,width:4.5,depth:5});
  expect(exposedFascia('hip',r,[{x:-4,z:0,width:4,depth:4}],eaves)).toEqual(['south','east','north']); // 0 eave on a shared edge: no board
 });
});

describe('compact fixture (one storey): the exposed eaves stay, the shared edge is flush',()=>{
 const plan=()=>{const p=compositionFixture('compact');p.roofs[0].overhang=1;return p;};
 it('the gallery roof reaches 1 m beyond its three free walls and ends on the wall it shares with the sleep room',()=>{
  const p=plan(),c=compileArchitecturalPlan(p);
  expect(errors(p)).toEqual([]);expect(flushNotes(p)).toEqual(['east eave is flush (authored 1 m, built 0): sleep-room stands against that wall along the whole 8 m edge.']);
  const gallery=planRect(c,roofOf(c,'gallery')),sleep=planRect(c,roofOf(c,'sleep-room'));
  expect(gallery).toEqual([-1,3,-1,9]);expect(sleep).toEqual([3,8,0,8]);expect(gallery[1]).toBe(sleep[0]); // no gap, no overlap
  expect(c.provenance[roofOf(c,'gallery').id].rule).toMatch(/east eave flush \(authored 1 m\) against sleep-room along the whole 8\.00 m edge/);
 });
 it('rejects, naming the reason, when the neighbour stands against only part of the edge',()=>{
  const p=plan();p.spaces.find(s=>s.id==='sleep-room')!.depth=6;
  // sleep-room is the upper room over day-room: shrinking it leaves day-room partly covered, which is its own (unrelated) rejection
  expect(rejection(p)).toMatch(/day-room: incomplete overhead enclosure/);
 });
});

describe('courtyard fixture (wings around a court): partial abutment and genuine overlap are not decided by software',()=>{
 const plan=()=>{const p=compositionFixture('courtyard');p.spaces.find(s=>s.id==='east-wing')!.height=4.6;return p;};
 it('a hip gallery whose north eave meets a taller wing along 5 of its 14 m is rejected, with the open length named, by diagnosis and compiler',()=>{
  const p=plan();
  expect(errors(p).map(f=>f.message).join(' ')).toMatch(/gallery: the north eave \(0\.35 m\) cannot reach east-wing but east-wing stands against only part of that 14 m edge; 5\.\.10 m of it is open/);
  expect(rejection(p)).toMatch(/gallery\/east-wing: unsupported-capability: roof\/eaves penetrate occupied volume/);
  // the choice is the author's: no overhang on the gallery, or an edge that is wholly against the wing
  p.roofs[0].overhang=0;expect(errors(p)).toEqual([]);expect(rejection(p)).toBeNull();
 });
 it('rooms that overlap are never repaired by an eave rule',()=>{
  const p=compositionFixture('courtyard');p.spaces.find(s=>s.id==='east-wing')!.placement={...p.spaces.find(s=>s.id==='east-wing')!.placement,alignment:'start'};
  expect(diagnosePlan(p).findings.some(f=>f.stage==='volumes'&&f.severity==='error')).toBe(true);
  expect(rejection(p)).not.toBeNull();
 });
});

describe('multilevel fixture (rotated): a tall volume beside and above lower roofs',()=>{
 const plan=(orientation:number)=>{
  const p=compositionFixture('waterfront');p.orientation=orientation;
  const roof=(s:string)=>p.roofs.find(r=>r.space===s)!;
  Object.assign(roof('salon'),{form:'gable',rise:1.2,overhang:.6});Object.assign(roof('upper-gallery'),{form:'hip',rise:.9,overhang:0});Object.assign(roof('master-suite'),{form:'gable',rise:1});
  return p;
 };
 it('the salon gable keeps its eaves on the lake side and is flush on the edge against the taller stair hall, at any orientation',()=>{
  for(const o of [0,.4,-.9]){
   const p=plan(o),c=compileArchitecturalPlan(p),salon=roofOf(c,'salon');
   expect(errors(p)).toEqual([]);
   expect(salon.overhang).toBe(.6);expect(salon.eaves).toEqual({west:0});
   expect(flushNotes(p).join()).toMatch(/west eave is flush \(authored 0\.6 m, built 0\)/);
   expect(JSON.stringify(validateScene(JSON.parse(JSON.stringify(c.scene))))).toBe(JSON.stringify(c.scene));
  }
 });
 it('no pitched surface of the salon roof meets another roof or the volume beside it',()=>{
  const c=compileArchitecturalPlan(plan(.4)),world=(e:SceneElement)=>[e.at[0],e.at[1],e.at[2],e.rotation],pitched=c.scene.elements.filter(e=>e.kind==='roof'&&e.roofForm&&e.roofForm!=='flat');
  expect(pitched.length).toBeGreaterThanOrEqual(2);
  for(const a of pitched)for(const b of pitched)if(a.id<b.id)expect(penetrates(pitchedRoofParts(a,world(a)),pitchedRoofParts(b,world(b)))).toBe(false);
 });
 it('an eave that would still reach the taller volume beside it across a gap stays rejected',()=>{
  const p=plan(0);p.spaces.find(s=>s.id==='salon')!.placement={...p.spaces.find(s=>s.id==='salon')!.placement,gap:.4};
  expect(rejection(p)).not.toBeNull();
 });
});

describe('multi-wing fixture: wings, spans and room-owned roofs together',()=>{
 const plan=()=>{const p=structuredClone(compositionFirstFixture('pavilion-court'));for(const r of p.roofs)r.overhang=.6;return p;};
 it('the porch and deck keep their exposed eaves and sit flush against the pavilion; the spans keep theirs',()=>{
  const p=plan(),c=compileArchitecturalPlan(p);
  expect(errors(p)).toEqual([]);
  expect(flushNotes(p).sort()).toEqual(['north eave is flush (authored 0.6 m, built 0): living stands against that wall along the whole 10 m edge.','west eave is flush (authored 0.6 m, built 0): dining stands against that wall along the whole 10 m edge.']);
  expect(planRect(c,roofOf(c,'porch'))).toEqual([-.6,10.6,-4.6,0]);
  expect(planRect(c,roofOf(c,'deck'))).toEqual([18,23.6,-.6,10.6]);
  const hip=roofOf(c,'living'),gable=roofOf(c,'spine');
  expect([hip.roofForm,hip.overhang,hip.eaves,gable.roofForm,gable.overhang,gable.eaves]).toEqual(['hip',.8,undefined,'gable',.8,undefined]);
 });
 it('building-scale roofs and room-owned roofs coexist in one volume; a room is still never under two',()=>{
  const p=plan();
  p.composition!.roofSpans[0].spaces=['living'];p.composition!.roofSpans[0].overhang=0; // the living volume's roof is one room's; dining keeps its own
  p.roofs.push({space:'dining',form:'flat',rise:.3,overhang:0});
  expect(diagnosePlan(p).findings.filter(f=>f.severity==='error'&&f.id==='living-pavilion')).toEqual([]);
  const c=compileArchitecturalPlan(p);
  expect(['living','dining'].map(s=>c.scene.elements.filter(e=>e.kind==='roof'&&c.provenance[e.id].sources[0]===s).length)).toEqual([1,1]);
  p.roofs.push({space:'living',form:'flat',rise:.3});
  expect(rejection(p)).toMatch(/exactly one roof/);
 });
});

describe('save, reload and edit',()=>{
 it('a scene with flush eaves survives JSON, an edit that does not touch the roof, and recompilation from its stored plan',()=>{
  const p=compositionFixture('compact');p.roofs[0].overhang=1;p.roofs[1]=({space:'sleep-room',form:'hip',rise:.9,overhang:.5});
  const c=compileArchitecturalPlan(p),scene=validateScene({...c.scene});
  const reloaded=validateScene(JSON.parse(JSON.stringify(scene)));
  expect(reloaded).toEqual(scene);
  const sleep=reloaded.elements.find(e=>e.id===roofOf(c,'sleep-room').id)!;
  expect(sleep.roofForm).toBe('hip');expect(sleep.eaves).toEqual({west:0});
  const edited=stageSceneOperations(reloaded,[{op:'finish',id:sleep.id,material:'bronze'}]);
  expect(edited.elements.find(e=>e.id===sleep.id)!.eaves).toEqual({west:0});
  expect(edited.elements.filter(e=>e.id!==sleep.id)).toEqual(reloaded.elements.filter(e=>e.id!==sleep.id));
  expect(compileArchitecturalPlan(reloaded.architecturalPlan).scene.elements).toEqual(c.scene.elements);
 });
});

describe('facade rhythms spread over the exposed wall run',()=>{
 type Facade=NonNullable<ArchitecturalPlan['composition']>['facades'][number];
 /** Courtyard study with a one-volume composition: gallery (14 m) with the arrival on its south wall (x 5..9) and, to its north, west wing / court / east wing. */
 const plan=(...facades:Facade[])=>{
  const p=compositionFixture('courtyard');
  p.composition={volumes:[{id:'house',masses:['base-mass'],tier:'primary'}],roofSpans:[],facades};
  return p;
 };
 const facade=(over:Partial<Facade>):Facade=>({id:'rhythm',space:'gallery',side:'south',kind:'windows',bays:2,width:2.4,height:2,sill:.8,...over}) as Facade;
 const offsets=(c:ReturnType<typeof compileArchitecturalPlan>,id:string)=>c.intent.portals.filter(q=>q.id.startsWith(`${id}-`)).map(q=>+q.offset.toFixed(4));
 const rhythm=(p:ArchitecturalPlan,id='rhythm')=>diagnosePlan(p).findings.filter(f=>f.cause===`facade:${id}`).map(f=>f.message);

 it('a rhythm whose evenly spaced bays already stand on the exposed wall keeps its historical positions',()=>{
  const p=plan(facade({}));
  expect(rhythm(p)).toEqual([]);
  expect(offsets(compileArchitecturalPlan(p),'rhythm')).toEqual([3.5,10.5]); // pitch 7 over the whole 14 m wall, as before
 });
 it('doors to the court are spread over the run the court borders when the whole-wall positions miss it',()=>{
  const p=plan(facade({id:'court-doors',side:'north',kind:'doors',to:'court',bays:2,width:1.6,height:2.5,sill:undefined}));
  p.portals=p.portals.filter(q=>q.id!=='gallery-court');
  expect(rhythm(p,'court-doors')).toEqual([]);
  const c=compileArchitecturalPlan(p);
  expect(offsets(c,'court-doors')).toEqual([6.25,8.75]); // court run 5..10 m of the north edge, pitch 2.5
  expect(c.scene.elements.filter(e=>c.provenance[e.id]?.sources.includes('court-doors-1')||c.provenance[e.id]?.sources.includes('court-doors-2')).length).toBeGreaterThan(0);
 });
 it('windows on the remainder of a partly shared wall use that remainder, and an impossible rhythm names it',()=>{
  const one=plan(facade({id:'wing-east',space:'west-wing',side:'east',bays:1,width:1.2,height:1.6}));
  expect(rhythm(one,'wing-east')).toEqual([]);compileArchitecturalPlan(one);
  const two=plan(facade({id:'wing-east',space:'west-wing',side:'east',bays:2,width:1.2,height:1.6}));
  expect(rhythm(two,'wing-east')[0]).toMatch(/2 bays of 1\.2 m \(1\.56 m each with piers\) fit no exposed run of the east wall of west-wing\. Exposed runs: 7\.00\.\.9\.00 m \(2\.00 m, room for 1 bay of 1\.2 m\)/);
  expect(rejection(two)).toContain(rhythm(two,'wing-east')[0]);
 });
 it('a wall shared along its whole length has no exposed run; the rejection says so once, not once per bay',()=>{
  const p=plan(facade({id:'north-windows',side:'north',bays:3,width:1.5}));
  expect(rhythm(p,'north-windows')).toHaveLength(1);expect(rhythm(p,'north-windows')[0]).toMatch(/shared with other rooms along its whole length, so it has no exposed wall for windows/);
 });
 it('two runs that could each hold the rhythm are not chosen between',()=>{
  const p=plan(facade({id:'south-one',bays:1,width:1.6}));
  expect(rhythm(p,'south-one')[0]).toMatch(/has 2 exposed runs that each hold 1 bays of 1\.6 m \(0\.00\.\.5\.00 m; 9\.00\.\.14\.00 m\); the rhythm cannot choose between them/);
  expect(rejection(p)).toContain(rhythm(p,'south-one')[0]);
 });
 it('a rhythm that fits nowhere on a wall that is wholly exposed keeps its historical message',()=>{
  const p=plan(facade({id:'too-many',space:'west-wing',side:'west',bays:6,width:2}));
  expect(rhythm(p,'too-many')[0]).toMatch(/6 bays of 2 m do not fit the 9 m west wall of west-wing \(bay pitch 1\.50 m needs 2\.36 m with piers\)\. Fewer or narrower bays\./);
 });
 it('an individually authored opening on the same wall is kept and still conflicts with a bay that lands on it',()=>{
  const p=plan(facade({id:'south-pair',bays:2,width:2.4}));
  p.portals.push({id:'gallery-view',host:{space:'gallery',side:'south'},to:'exterior',alignment:'start',width:2,height:1.6,sill:.8,mode:'window'});
  const pier=diagnosePlan(p).findings.filter(f=>f.stage==='openings'&&/pier/.test(f.message));
  expect(pier.length).toBeGreaterThan(0);expect(rejection(p)).not.toBeNull();
  expect(p.portals.find(q=>q.id==='gallery-view')).toBeDefined(); // never removed or moved to make room
 });
});
