import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { elementSchema, type ArchitecturalScene } from './model';
import { straightWalkingAccess } from './walkingAccess';
import { reviewProgramme } from './programme';
import { spatialCoordinationFindings } from './spatial';

function fixture(rotation=0) {
  const part=(id:string,kind:string,at:number[],size:number[])=>elementSchema.parse({id,label:id,kind,parent:'frame',at,size});
  const elements=[elementSchema.parse({id:'frame',label:'frame',kind:'plate',at:[17,0,-9],rotation,size:[.1,.1,.1]}),
    part('inside','plate',[0,.075,0],[4,.15,8]),part('terrace','plate',[0,.075,-6],[4,.15,4]),
    part('door','entrance',[0,1.35,-3.1],[1.2,2.4,.12])];
  const scene:ArchitecturalScene={version:'architectural-scene-1',name:'Route',elements};
  return {scene,door:elements[3],floor:elements[2],part};
}
it.each([0,.73,Math.PI/2,Math.PI])('proves a level route across multiple rectangular slabs at yaw %s',rotation=>{
  const {scene,door,floor}=fixture(rotation),bytes=JSON.stringify(scene);
  expect(straightWalkingAccess(scene,door,floor)?.supportIds).toEqual(['inside','terrace']);
  expect(JSON.stringify(scene)).toBe(bytes);
});
it('rejects gaps, steps, fixed glazing, narrow passages, overhead obstructions and solid walls',()=>{
  const {scene,door,floor,part}=fixture();
  const probe=(elements:ArchitecturalScene['elements'],d=door)=>straightWalkingAccess({...scene,elements},d,floor);
  expect(probe(scene.elements.map(e=>e.id==='inside'?{...e,size:[4,.15,7.5]}:e))).toBeUndefined();
  expect(probe(scene.elements.map(e=>e.id==='inside'?{...e,at:[0,.2,0]}:e))).toBeUndefined();
  expect(probe([...scene.elements,part('glass','glazing',[0,1.4,-3.8],[2,2.5,.12])])).toBeUndefined();
  expect(probe([...scene.elements,part('wall','wall',[0,1.4,-3.8],[4,2.5,.2])])).toBeUndefined();
  expect(probe([...scene.elements,part('beam','volume',[0,1.9,-3.8],[4,.4,.2])])).toBeUndefined();
  expect(probe(scene.elements,{...door,size:[.5,2.4,.12]})).toBeUndefined();
  expect(probe(scene.elements,{...door,kind:'glazing'})).toBeUndefined();
});
it('crosses only a fitting unglazed opening with real sill and head clearance',()=>{
  const {scene,door,floor,part}=fixture(.4);
  const wall={...part('wall','wall',[0,1.4,-3.8],[4,2.5,.2]),opening:{x:0,sill:0,width:1,height:2.2,glazed:false}};
  const probe=(w:typeof wall)=>straightWalkingAccess({...scene,elements:[...scene.elements,w]},door,floor);
  expect(probe(wall)).toBeDefined();
  for(const opening of [{...wall.opening,glazed:true},{...wall.opening,sill:.3},{...wall.opening,height:1.5},{...wall.opening,x:1}]) expect(probe({...wall,opening})).toBeUndefined();
});
it('records the actual retained terrace route without replacing any geometry',()=>{
  const scene=JSON.parse(readFileSync('docs/architecture/single-house/construction.scene.json','utf8')) as ArchitecturalScene;
  const door=scene.elements.find(e=>e.id==='rear-loggia-door')!,floor=scene.elements.find(e=>e.id==='dining-terrace')!;
  expect(straightWalkingAccess(scene,door,floor)).toMatchObject({doorId:door.id,floorId:floor.id,supportIds:['main-floor','dining-terrace'],walkingDatum:.15});
  const blocked={...scene,elements:[...scene.elements,elementSchema.parse({id:'barrier',label:'barrier',kind:'wall',at:[0,1.4,-3.7],size:[3,2.5,.2]})]};
  expect(straightWalkingAccess(blocked,door,floor)).toBeUndefined();
  const plan=structuredClone(scene.architecturalPlan) as {programme:{accessIds:string[]}[]};
  plan.programme[6].accessIds=['rear-loggia-door'];
  expect(reviewProgramme({...scene,architecturalPlan:plan}).spaces[6].issues.join(' ')).not.toContain('local access at walking datum unverified');
});

it('uses the same route proof for doorway-floor connection evidence in either direction',()=>{
  const {scene,door,floor,part}=fixture(.73);
  const check=(s:ArchitecturalScene,reverse=false)=>spatialCoordinationFindings({...s,architecturalPlan:{spatialRelationships:[{subject:reverse?floor.id:door.id,target:reverse?door.id:floor.id,relation:'connected-to',clearance:0,reason:'Door reaches terrace across retained slab.'}]}});
  expect(check(scene)).toEqual([]);
  expect(check(scene,true)).toEqual([]);
  expect(check({...scene,elements:[...scene.elements,part('barrier','wall',[0,1.4,-3.8],[4,2.5,.2])]}).some(f=>f.code==='spatial-intent-mismatch')).toBe(true);
});

it('does not use profile bounds, mixed-yaw support or a narrow ribbon as a walking surface',()=>{
  const {scene,door,floor}=fixture();
  const geometry={type:'extrusion' as const,axis:'y' as const,outline:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]] as [number,number][],holes:[]};
  for(const change of [{geometry},{rotation:.4},{size:[.5,.15,8] as [number,number,number]}]){
    const elements=scene.elements.map(e=>e.id==='inside'?{...e,...change}:e);
    expect(straightWalkingAccess({...scene,elements},door,floor)).toBeUndefined();
  }
  const small={...floor,size:[4,.15,.2] as [number,number,number]};
  expect(straightWalkingAccess({...scene,elements:[...scene.elements.filter(e=>e.id!==floor.id),small]},door,small)).toBeUndefined();
});
