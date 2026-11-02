/** Pitched roofs that abut other rooms: fascia boards exist only on edges no other room shares, and the geometry that results is physically
 * valid. Developer-authored architectures built from a generic rule (never a retained design's IDs): a multilevel house with pitched roofs on
 * both storeys, an asymmetric courtyard mixing hip, gable and flat roofs, and the retained rejected revision's own pitched roofs (diagnosis only).
 * Contracts and geometry; not AI quality evidence. */
import {describe,expect,it,vi} from 'vitest';
import {Euler,Vector3} from 'three';
import {compileArchitecturalPlan,type ArchitecturalPlan,type Rect} from './plan';
import {diagnosePlan} from './diagnose';
import {compositionFixture} from './compositions.fixture';
import {rejectedRevision} from './coordination.fixture';
import {exposedFascia,ELEMENT_EDGE,sharedRuns,SIDES,type Side} from './coordination';
import {buildSceneRoof} from '../scene/roofs';
import {pitchedRoofParts} from '../scene/roofIntersection';
import {stageSceneOperations,validateScene,type SceneElement} from '../scene/model';
import {useProjectStore} from '@/store/useProjectStore';

type Compiled=ReturnType<typeof compileArchitecturalPlan>;
const material={color:'#cccbbb',roughness:.7,metalness:0};
const rectOf=(polygon:[number,number][]):Rect=>{const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);return {x:Math.min(...xs),z:Math.min(...zs),width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)};};

/** Multilevel house: a gable salon and hip upper gallery abut taller or equal rooms, with a gable suite beside a hip gallery upstairs. */
function multilevel():ArchitecturalPlan{
 const p=compositionFixture('waterfront');
 p.orientation=.4;
 const roof=(space:string)=>p.roofs.find(r=>r.space===space)!;
 Object.assign(roof('salon'),{form:'gable',rise:1.2});
 Object.assign(roof('upper-gallery'),{form:'hip',rise:.9,overhang:0});
 Object.assign(roof('master-suite'),{form:'gable',rise:1});
 return p;
}
/** Asymmetric courtyard: a hip gallery beside a gable wing and a flat wing, rotated off the site axes. */
function courtyard():ArchitecturalPlan{
 const p=compositionFixture('courtyard');
 p.orientation=-.3;
 p.roofs=[{space:'gallery',form:'hip',rise:1.2,overhang:0},{space:'west-wing',form:'gable',rise:1},{space:'east-wing',form:'flat',rise:.22}];
 return p;
}

/** Minimum penetration depth of two convex parts (zero-thickness surfaces count when they cross a solid); <=0 means apart or merely touching. */
function penetration(a:ReturnType<typeof pitchedRoofParts>[number],b:ReturnType<typeof pitchedRoofParts>[number]){
 const own=(q:typeof a)=>q.edges;
 const axes=[...a.normals,...b.normals,...own(a).flatMap(x=>own(b).map(y=>x.clone().cross(y)))];let min=Infinity;
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
const worldOf=(e:SceneElement)=>[e.at[0],e.at[1],e.at[2],e.rotation];

/** Boards the compiled scene must carry, derived independently from the compiler's own wall boundaries. */
function expectedBoards(c:Compiled,space:string):Side[]{
 const spaces=c.intent.spaces,own=spaces.find(s=>s.id===space)!;
 const rect=rectOf(own.polygon as [number,number][]);
 const shared=new Set<Side>();
 for(const side of SIDES){
  const others=spaces.filter(s=>s.id!==space&&s.level===own.level).map(s=>({id:s.id,rect:rectOf(s.polygon as [number,number][])}));
  if(sharedRuns(rect,side,others).length)shared.add(side);
 }
 // cross-check against the wall boundaries the compiler actually emitted
 const boundaryShared=SIDES.filter(side=>c.boundaries.some(b=>b.spaces.includes(space)&&b.spaces.length>1&&onSide(rect,side,b.a as [number,number],b.b as [number,number])));
 expect([...shared].sort()).toEqual([...boundaryShared].sort());
 return SIDES.filter(s=>!shared.has(s));
}
const onSide=(r:Rect,side:Side,a:[number,number],b:[number,number])=>{
 const line=side==='south'?r.z:side==='north'?r.z+r.depth:side==='west'?r.x:r.x+r.width,k=side==='south'||side==='north'?1:0;
 return Math.abs(a[k]-line)<1e-6&&Math.abs(b[k]-line)<1e-6;
};

describe.each([['multilevel house with pitched roofs on two storeys',multilevel],['asymmetric rotated courtyard: hip, gable and flat',courtyard]])('%s',(_name,make)=>{
 const plan=make(),compiled=compileArchitecturalPlan(plan);
 const roofs=compiled.scene.elements.filter(e=>e.kind==='roof'&&e.roofForm&&e.roofForm!=='flat');
 it('compiles with no roof finding in the diagnosis, and has pitched roofs that abut other rooms',()=>{
  expect(diagnosePlan(plan).findings.filter(f=>f.severity==='error'&&f.stage==='roofs')).toEqual([]);
  expect(roofs.length).toBeGreaterThanOrEqual(2);
  expect(roofs.some(r=>r.fascia!==undefined)).toBe(true);
 });
 it('withholds a fascia board exactly on the edges other rooms share, and keeps the rest',()=>{
  for(const r of roofs){
   const space=compiled.provenance[r.id].sources[0],spaceRect=rectOf(compiled.intent.spaces.find(s=>s.id===space)!.polygon as [number,number][]);
   const boards=exposedFascia(r.roofForm as 'gable'|'hip',spaceRect,[]);
   const wanted=boards.filter(side=>expectedBoards(compiled,space).includes(side)).map(s=>ELEMENT_EDGE[s]).sort();
   expect([...(r.fascia??boards.map(s=>ELEMENT_EDGE[s]))].sort(),r.id).toEqual(wanted);
  }
 });
 it('renders boards on exposed edges only, outside the room, with every slope and gable end intact',()=>{
  for(const r of roofs){
   const space=compiled.provenance[r.id].sources[0],rect=rectOf(compiled.intent.spaces.find(s=>s.id===space)!.polygon as [number,number][]);
   const built=buildSceneRoof(r,material),yaw=r.rotation,origin=new Vector3(...r.at);
   const slopes=built.filter(p=>p.kind==='triMesh');
   expect(slopes.length,r.id).toBe(r.roofForm==='hip'?4:4); // hip: 4 slopes; gable: 2 slopes + 2 gable ends
   const full=buildSceneRoof({...r,fascia:undefined},material);
   expect(slopes.map(p=>p.id)).toEqual(full.filter(p=>p.kind==='triMesh').map(p=>p.id));
   const exposed=expectedBoards(compiled,space);
   const boards=built.filter(p=>p.kind==='box');
   for(const board of boards){
    if(board.kind!=='box')continue;
    // builder-local → world → plan-local (undo the building orientation) and test the board lies just outside an exposed edge of the room
    const world=new Vector3(...board.position).applyEuler(new Euler(0,yaw,0)).add(origin);
    const f=compiled.intent.frame,c=Math.cos(f.yaw),s=Math.sin(f.yaw),dx=world.x-f.origin[0],dz=world.z-f.origin[1],x=c*dx-s*dz,z=s*dx+c*dz;
    const outside=(side:Side)=>side==='south'?Math.abs(z-(rect.z-.05))<.2&&x>rect.x&&x<rect.x+rect.width:side==='north'?Math.abs(z-(rect.z+rect.depth+.05))<.2&&x>rect.x&&x<rect.x+rect.width:side==='west'?Math.abs(x-(rect.x-.05))<.2&&z>rect.z&&z<rect.z+rect.depth:Math.abs(x-(rect.x+rect.width+.05))<.2&&z>rect.z&&z<rect.z+rect.depth;
    expect(exposed.filter(outside).length,`${board.id} must stand outside exactly one exposed edge`).toBe(1);
   }
   if(r.fascia===undefined)expect(boards.length,r.id).toBe(built.length-slopes.length);
  }
 });
 it('has no physical penetration between the surfaces and boards of different roofs, or into floors',()=>{
  const parts=roofs.map(r=>({id:r.id,parts:pitchedRoofParts(r,worldOf(r))}));
  for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)
   for(const a of parts[i].parts)for(const b of parts[j].parts)expect(penetration(a,b),`${parts[i].id} / ${parts[j].id}`).toBeLessThanOrEqual(1e-4);
  const flat=compiled.scene.elements.filter(e=>e.kind==='roof'&&!roofs.includes(e));
  for(const f of flat)for(const r of parts){
   const half=new Vector3(f.size[0]/2,f.size[1]/2,f.size[2]/2),box=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>new Vector3(x*half.x,y*half.y,z*half.z).applyEuler(new Euler(0,f.rotation,0)).add(new Vector3(...f.at)))));
   const axes=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)].map(v=>v.applyEuler(new Euler(0,f.rotation,0)));
   // flat slabs are profile extrusions: use their bounding box, which contains the true slab
   for(const a of r.parts)expect(penetration(a,{vertices:box,edges:axes,normals:axes}),`${r.id} / ${f.id}`).toBeLessThanOrEqual(1e-4);
  }
 });
 it('round-trips, edits one roof without touching the rest, and survives project Undo/Redo',()=>{
  const scene=validateScene(JSON.parse(JSON.stringify(compiled.scene)));expect(scene.elements.filter(e=>e.kind==='roof').map(e=>e.fascia)).toEqual(compiled.scene.elements.filter(e=>e.kind==='roof').map(e=>e.fascia));
  const target=roofs.find(r=>r.fascia!==undefined)!;
  const edited=stageSceneOperations(scene,[{op:'finish',id:target.id,material:'bronze'}]);
  expect(edited.elements.find(e=>e.id===target.id)!.fascia).toEqual(target.fascia);
  expect(edited.elements.filter(e=>e.id!==target.id)).toEqual(scene.elements.filter(e=>e.id!==target.id));
  const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
  try{
   const store=useProjectStore.getState(),project=store.createProject('Roof abutment','house','direct-scene');
   store.appendVersion(project.id,'Generated',JSON.stringify(scene));store.appendVersion(project.id,'Edited',JSON.stringify(edited));
   store.undo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(scene);
   store.redo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(edited);
  }finally{vi.unstubAllGlobals();}
 });
 it('recompiling the saved plan reproduces identical elements',()=>{
  expect(compileArchitecturalPlan(compiled.scene.architecturalPlan).scene.elements).toEqual(compiled.scene.elements);
 });
});

describe('what stays rejected',()=>{
 const base=()=>{const p=multilevel();return p;};
 it('a pitched roof over a space with a room stacked over part of it',()=>{
  const p=compositionFixture('waterfront');
  // guest-wing (7x7, west of the stair hall) carries master-suite (7x7, same extent): shrink the suite so it covers only part of the wing
  p.spaces.find(s=>s.id==='master-suite')!.width=4;
  p.roofs.push({space:'guest-wing',form:'hip',rise:.9});
  const f=diagnosePlan(p).findings.filter(x=>x.stage==='roofs'&&x.severity==='error');
  expect(f.map(x=>x.message).join(' ')).toMatch(/partly covered/);
  expect(()=>compileArchitecturalPlan(p)).toThrow();
 });
 it('an overhang that reaches a neighbour',()=>{
  const p=base();p.roofs.find(r=>r.space==='salon')!.overhang=.6;
  expect(diagnosePlan(p).findings.some(x=>x.stage==='roofs'&&x.severity==='error')).toBe(true);
  expect(()=>compileArchitecturalPlan(p)).toThrow();
 });
 it('overlapping rooms are never repaired by the roof rules',()=>{
  const p=rejectedRevision();
  expect(diagnosePlan(p).findings.some(x=>x.stage==='volumes'&&x.id==='media-lounge/east-suite-1')).toBe(true);
 });
});

describe('the retained rejected revision (diagnosis and geometry only; nothing is repaired or compiled)',()=>{
 const plan=rejectedRevision(),findings=diagnosePlan(plan).findings.filter(f=>f.stage==='roofs'&&f.severity==='error');
 it('52 bounding-box findings reduce to the ones that are real: one stacked-room junction and one room overlap',()=>{
  expect(findings.map(f=>f.id).sort()).toEqual(['east-suite-3','east-suite-3/owner-suite','media-lounge/east-suite-1']);
 });
});

describe('element contract',()=>{
 const roof=(extra:object)=>({version:'architectural-scene-1',name:'r',elements:[{id:'roof',label:'r',kind:'roof',at:[0,5,0],size:[12,1,8],roofForm:'hip',...extra}]});
 it('accepts a subset of edges, including none',()=>{
  for(const fascia of [[],['north'],['north','east','south','west']])expect(validateScene(roof({fascia})).elements[0].fascia).toEqual(fascia);
 });
 it('rejects duplicates, flat roofs and non-roof elements',()=>{
  expect(()=>validateScene(roof({fascia:['north','north']}))).toThrow(/once/);
  expect(()=>validateScene(roof({roofForm:'flat',fascia:['north']}))).toThrow(/gable or hip/);
  const wall={version:'architectural-scene-1',name:'w',elements:[{id:'w',label:'w',kind:'wall',at:[0,1,0],size:[4,2,.2],fascia:['north']}]};
  expect(()=>validateScene(wall)).toThrow(/Roof parameters/);
 });
 it('removing a board removes only that board',()=>{
  const e=validateScene(roof({fascia:['north','south']})).elements[0],all=buildSceneRoof({...e,fascia:undefined},material),some=buildSceneRoof(e,material);
  const ids=(l:typeof all)=>l.map(p=>p.id).sort();
  expect(ids(all).filter(i=>!ids(some).includes(i))).toEqual(['roof-fascia-e','roof-fascia-w']);
  expect(buildSceneRoof({...e,fascia:[]},material).some(p=>p.id.includes('fascia'))).toBe(false);
 });
});
