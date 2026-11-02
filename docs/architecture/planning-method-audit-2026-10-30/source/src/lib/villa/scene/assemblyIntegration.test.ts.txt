import {expect,it} from 'vitest';
import {applySceneOperations,validateScene,type ArchitecturalScene,type SceneOperation} from './model';
import {sceneRelationshipIssues} from './relationships';
import {focusedConstructionFindings} from './focusedConstruction';
const base:ArchitecturalScene={version:'architectural-scene-1',name:'Offline assembly',elements:[]};
export const wing=(id='studio',x=0,rotation=0):SceneOperation=>({op:'assemble',assembly:{kind:'residential-wing',parameters:{id,at:[x,.1,0],rotation,width:12,depth:8,height:3.4,bays:3,material:'ivory',roofForm:'hip',roofRise:1.2,overhang:.4,entryBay:1}}});
it('keeps independent edits, materials, roof parameters, hierarchy and serialization through whole-wing transforms',()=>{
 const initial=applySceneOperations(base,[wing()]);
 const child=initial.elements.find(e=>e.id==='studio-glass-0')!;
 const modified=applySceneOperations(initial,[{op:'finish',id:child.id,material:'bronze'},{op:'replace',id:'studio-roof',element:{...initial.elements.find(e=>e.id==='studio-roof')!,roofForm:'gable'}}]);
 const scaled=applySceneOperations(modified,[{op:'move',id:'studio',at:[20,.1,0]},{op:'rotate',id:'studio',rotation:.4},{op:'scale-assembly',id:'studio',factors:[1.2,1,1.2]}]);
 expect(scaled.elements.map(e=>e.id)).toEqual(initial.elements.map(e=>e.id));
 expect(scaled.elements.find(e=>e.id===child.id)).toMatchObject({parent:'studio-bay-0',material:'bronze',size:[child.size[0]*1.2,child.size[1],child.size[2]*1.2]});
 expect(scaled.elements.find(e=>e.id==='studio-roof')?.roofForm).toBe('gable');
 expect(sceneRelationshipIssues(scaled)).toEqual([]);
 expect(validateScene(JSON.parse(JSON.stringify(scaled)))).toEqual(scaled);
 expect(()=>applySceneOperations(initial,[{op:'scale-assembly',id:'studio',factors:[2,1,1]}])).toThrow('unsupported');
});
it('rejects roof collisions, shared walls, rotated collisions, duplicate ids and expansion budgets atomically',()=>{
 const scene=applySceneOperations(base,[wing()]);const snapshot=JSON.stringify(scene);
 for(const op of [wing('other',12),wing('other',12.5),wing('other',8,.5),wing()])expect(()=>applySceneOperations(scene,[op])).toThrow();
 expect(JSON.stringify(scene)).toBe(snapshot);
 expect(()=>applySceneOperations(base,Array.from({length:60},(_,i)=>wing(`wing-${i}`,i*20)))).toThrow('budget');
 expect(()=>applySceneOperations(scene,[{op:'move',id:'studio-roof',at:[0,8,0]},wing('other',12.5)])).not.toThrow();
});
it('constructs the proven rectangular pool at consistent water/basin/deck datums',()=>{
 const scene=applySceneOperations(base,[{op:'assemble',assembly:{kind:'rectangular-pool',parameters:{id:'pool',at:[0,.15,0],width:6,depth:4,basinDepth:1.4,rotation:0,material:'limestone'}}}]);
 expect(sceneRelationshipIssues(scene)).toEqual([]);expect(focusedConstructionFindings(scene)).toEqual([]);
 expect(scene.elements.find(e=>e.id==='pool-water')?.at).toEqual([0,.05,3.45]);
 expect(scene.elements.find(e=>e.id==='pool-floor')?.at[1]).toBeCloseTo(-1.45);
});
it('uses normal project history for assembly child edits and whole-wing resizing',async()=>{
 const {vi}=await import('vitest');
 const {useProjectStore}=await import('@/store/useProjectStore');
 const previous=useProjectStore.getState();const saved=new Map<string,string>();
 vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v)}});
 try{
  useProjectStore.setState({projects:[]});const store=useProjectStore.getState();const project=store.createProject('Offline assembly','house','direct-scene');
  const initial=applySceneOperations(base,[wing()]);const edited=applySceneOperations(initial,[{op:'finish',id:'studio-glass-0',material:'bronze'},{op:'scale-assembly',id:'studio',factors:[1.2,1,1.2]}]);
  store.appendVersion(project.id,'Assembly',JSON.stringify(initial));store.appendVersion(project.id,'Edited children',JSON.stringify(edited));
  store.undo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(initial);
  store.redo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(edited);expect(saved.size).toBeGreaterThan(0);
 }finally{useProjectStore.setState(previous);vi.unstubAllGlobals();}
});
it.each([[6,4,1.4],[12,3,.8],[3,10,2]])('proves basin boundaries and a continuous metre-wide dry route for %s × %s', (width,depth,basinDepth)=>{
 const scene=applySceneOperations(base,[{op:'assemble',assembly:{kind:'rectangular-pool',parameters:{id:'pool',at:[0,.15,0],rotation:0,width,depth,basinDepth,material:'limestone'}}}]);
 const center=depth/2+1.45;
 const byId=(id:string)=>scene.elements.find(e=>e.id===id)!;
 const water=byId('pool-water'),floor=byId('pool-floor');
 expect(water.at[1]-(floor.at[1]+floor.size[1]/2)).toBeCloseTo(basinDepth);
 for(const sign of [-1,1]){
  const wall=byId(`pool-wall-x-${sign===1?'plus':'minus'}`);
  expect(Math.abs(wall.at[0])-wall.size[0]/2).toBeCloseTo(width/2);
  expect(wall.at[1]-wall.size[1]/2).toBeCloseTo(floor.at[1]+floor.size[1]/2);
  const end=byId(`pool-wall-z-${sign===1?'plus':'minus'}`);
  expect(Math.abs(end.at[2]-center)-end.size[2]/2).toBeCloseTo(depth/2);
 }
 const route=[[-width/2-1.1,0],[width/2+1.1,0],[width/2+1.1,2*center],[-width/2-1.1,2*center]];
 const decks=scene.elements.filter(e=>e.id==='pool'||e.id.startsWith('pool-deck'));
 for(let j=0;j<4;j++){
  const a=route[j],b=route[(j+1)%4];
  for(let i=0;i<=50;i++)for(const side of [-.5,.5]){
   const x=a[0]+(b[0]-a[0])*i/50+(a[0]===b[0]?side:0),z=a[1]+(b[1]-a[1])*i/50+(a[1]===b[1]?side:0);
   expect(decks.some(e=>Math.abs(x-(e.parent?e.at[0]:0))<=e.size[0]/2+1e-8&&Math.abs(z-(e.parent?e.at[2]:0))<=e.size[2]/2+1e-8)).toBe(true);
  }
 }
});
