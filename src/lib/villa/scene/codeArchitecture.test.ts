import { expect, it, vi } from 'vitest';
import { constructionCapabilityReference } from './capabilityReference';
import { codeArchitectureStudies } from './codeArchitectureProof';
import { applySceneOperations, elementFieldsSchema, operationSchema, validateScene } from './model';
import { sceneSpatialGeometry } from './spatial';
import { sceneRelationshipIssues } from './relationships';
import { sceneSystemPrompt } from './terra';
import { useProjectStore } from '@/store/useProjectStore';

it('derives all executable fields and tags for all generation/edit modes',()=>{
 const reference=constructionCapabilityReference();
 for(const field of Object.keys(elementFieldsSchema.shape))expect(reference).toContain(`"${field}"`);
 for(const schema of operationSchema.options)expect(reference).toContain(schema.shape.op.value);
 for(const editIntent of ['refine','redesign','complete'] as const)
  expect(sceneSystemPrompt({mode:'edit',editIntent,prompt:'Improve architecture',current:codeArchitectureStudies().solana})).toContain(reference);
 expect(sceneSystemPrompt({mode:'generate',prompt:'A mansion'})).toContain(reference);
 expect(reference.length).toBeLessThan(6000);
});

it('constructs two distinct editable compositions and preserves localized changes through history and reload',()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Offline only'));
 const data=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 const previous=useProjectStore.getState();
 try{
  const {solana,court}=codeArchitectureStudies();
  for(const scene of [solana,court]){
   expect(sceneRelationshipIssues(scene)).toEqual([]);
   expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  }
  expect(solana.elements.filter(e=>!e.parent)).toHaveLength(4);
  expect(court.elements.filter(e=>!e.parent)).toHaveLength(3);
  expect(Math.max(...[...sceneSpatialGeometry(solana).map.values()].map(e=>e.at[1]))).toBeGreaterThan(4);
  expect(court.elements.filter(e=>e.kind==='roof').every(e=>e.roofForm!=='flat')).toBe(true);
  const moved=applySceneOperations(solana,[{op:'move',id:'dining',at:[14,.1,-1]},{op:'rotate',id:'dining',rotation:.18}]);
  const a=sceneSpatialGeometry(solana),b=sceneSpatialGeometry(moved);
  expect(b.world(b.map.get('dining-roof')!)[0]).toBe(14);
  expect(b.world(b.map.get('suite-roof')!)).toEqual(a.world(a.map.get('suite-roof')!));
  const roof=moved.elements.find(e=>e.id==='dining-roof')!;
  const edited=applySceneOperations(moved,[{op:'replace',id:roof.id,element:{...roof,roofForm:'hip',overhang:.8,size:[10,1.6,12],at:[0,4.9,0]}},
   {op:'finish',id:'dining-bay-0',material:'limestone'},
   {op:'resize',id:'dining-reveal-0',size:[3.33,.2,.65]}]);
  expect(edited.elements.find(e=>e.id==='salon')).toBe(solana.elements.find(e=>e.id==='salon'));
  expect(edited.elements.find(e=>e.id==='dining-glass-0')).toEqual(moved.elements.find(e=>e.id==='dining-glass-0'));
  useProjectStore.setState({projects:[]});
  const store=useProjectStore.getState(),project=store.createProject('Code proof','house','direct-scene');
  store.appendVersion(project.id,'Study',JSON.stringify(solana));store.appendVersion(project.id,'Move wing',JSON.stringify(moved));store.appendVersion(project.id,'Roof and facade',JSON.stringify(edited));
  store.undo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(moved);
  store.redo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(edited);
  expect(data.size).toBeGreaterThan(0);expect(network).not.toHaveBeenCalled();
 }finally{network.mockRestore();useProjectStore.setState(previous);vi.unstubAllGlobals();}
});

it('coordinates a resized wing and enlarged individual window without rebuilding the estate',async()=>{
 const {residentialWingOperations}=await import('./assemblies');
 const scene=codeArchitectureStudies().solana;
 const resized=residentialWingOperations({id:'dining',at:[9,.1,-1],width:12,depth:12,height:4,bays:3,
  rotation:0,material:'ivory',roofForm:'flat',roofRise:1.6,overhang:.8});
 const next=applySceneOperations(scene,resized.map(op=>{
  if(op.op!=='add')throw Error('Expected assembly adds');
  return {op:'replace',id:op.element.id,element:op.element};
 }));
 expect(next.elements.map(e=>e.id)).toEqual(scene.elements.map(e=>e.id));
 expect(next.elements.find(e=>e.id==='dining-roof')!.size[0]).toBe(13.6);
 expect(next.elements.find(e=>e.id==='salon')).toBe(scene.elements.find(e=>e.id==='salon'));
 const wall=next.elements.find(e=>e.id==='dining-bay-0')!;
 const glass=next.elements.find(e=>e.id==='dining-glass-0')!;
 const enlarged=applySceneOperations(next,[{op:'replace',id:wall.id,element:{...wall,opening:{...wall.opening!,width:3.8}}},
  {op:'resize',id:glass.id,size:[3.8,glass.size[1],glass.size[2]]}]);
 expect(enlarged.elements.find(e=>e.id===glass.id)!.size[0]).toBe(3.8);
 expect(enlarged.elements.filter(e=>![wall.id,glass.id].includes(e.id))).toEqual(next.elements.filter(e=>![wall.id,glass.id].includes(e.id)));
 expect(sceneRelationshipIssues(enlarged)).toEqual([]);
});
