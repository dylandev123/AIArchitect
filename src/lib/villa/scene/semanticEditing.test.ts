import {describe,expect,it} from 'vitest';
import {OBJECT_REGISTRY,OBJECT_TYPES,resolveSemanticTarget} from '@/lib/semantic/vocabulary';
import {validateScene,stageSceneOperations,type ArchitecturalScene} from './model';
import {resolveSceneResult,sceneSystemPrompt} from './terra';
import {compileConstrainedEdit,sceneSemanticObjects} from './semanticEditing';
const element=(id:string,kind:string,at:number[],size:number[],extra={})=>({id,label:id.replaceAll('-',' '),kind,at,size,...extra});
const base=()=>validateScene({version:'architectural-scene-1',name:'Preserved house',elements:[
 element('house-floor','plate',[0,.1,0],[10,.2,8]),
 element('front-door','entrance',[0,1.3,4],[1,2.2,.15]),
 element('side-door','entrance',[-5,1.3,0],[1,2.2,.15]),
 element('left-window','glazing',[-3,1.8,4],[1,1,.1]),
 element('right-window','glazing',[3,1.8,4],[1,1,.1]),
 element('roof','roof',[0,3,0],[10,.2,8]),
]});
const edit=(current:ArchitecturalScene,prompt:string,operations:unknown[],extra={})=>resolveSceneResult({mode:'edit',current,prompt,...extra},{name:current.name,summary:'Scoped edit',unsupported:[],operations}).scene;
const unchangedExcept=(a:ArchitecturalScene,b:ArchitecturalScene,ids:string[])=>expect(b.elements.filter(e=>!ids.includes(e.id))).toEqual(a.elements.filter(e=>!ids.includes(e.id)));
describe('application-owned semantic editing',()=>{
 it('defines complete policy records for every requested vocabulary type',()=>{
  for(const type of OBJECT_TYPES){const r=OBJECT_REGISTRY[type];expect(r.type).toBe(type);expect(r.aliases.length).toBeGreaterThan(0);expect(r.protected).toContain('id');expect(r.preservation).toBe('target-fields-only');expect(r).toHaveProperty('hosts');expect(r).toHaveProperty('connections');expect(r).toHaveProperty('collision');expect(r).toHaveProperty('placement');}
 });
 it('changes only front door material and supports a blue color override',()=>{
  const before=base(),snapshot=JSON.stringify(before);
  const op=compileConstrainedEdit(before,{op:'changeMaterial',target:'front-door',material:'bronze'});
  const after=edit(before,'Change only the front door material',[op]);
  unchangedExcept(before,after,['front-door']);expect(after.elements.find(e=>e.id==='front-door')!.material).toBe('bronze');
  const door=before.elements.find(e=>e.id==='front-door')!;
  const blue=edit(before,'Change only the front door to blue',[{op:'replace',id:door.id,element:{...door,color:'#0000ff'}}]);
  expect(blue.elements.find(e=>e.id===door.id)!.color).toBe('#0000ff');unchangedExcept(before,blue,[door.id]);expect(JSON.stringify(before)).toBe(snapshot);
 });
 it('edits only the selected window and resolves screen-left with camera evidence',()=>{
  const before=base();const after=edit(before,'Change only the selected window material',[{op:'finish',id:'right-window',material:'bronze'}],{editContext:{selectedId:'right-window'}});
  unchangedExcept(before,after,['right-window']);
  const objects=sceneSemanticObjects(before);
  expect(resolveSemanticTarget(objects,'the door on the left side',{cameraRight:[1,0,0]}).id).toBe('side-door');
  expect(resolveSemanticTarget(objects,'the window on the left side',{cameraRight:[-1,0,0]}).id).toBe('right-window');
  expect(()=>resolveSemanticTarget(objects,'the door on the left side')).toThrow('camera frame');
  expect(()=>resolveSemanticTarget(objects,'Change the selected window material',{selectedId:'roof'})).toThrow('conflicts');
 });
 it('resizes an existing pool assembly without changing the house or duplicating water',()=>{
  const before=stageSceneOperations(base(),[{op:'assemble',assembly:{kind:'rectangular-pool',parameters:{id:'pool',at:[20,.15,0],width:4,depth:6,basinDepth:1.2}}}]);
  const ids=sceneSemanticObjects(before).find(o=>o.id==='pool')!.memberIds;
  const after=edit(before,'Resize the pool',[{op:'scale-assembly',id:'pool',factors:[1.2,1,1.2]}]);
  unchangedExcept(before,after,Array.from(ids));expect(after.elements.filter(e=>e.kind==='water')).toHaveLength(1);
  expect(()=>edit(before,'Resize pool',[{op:'resize',id:'pool',size:[8,.3,2]}])).toThrow('scope');
  expect(()=>edit(before,'Add a pool',[{op:'add',element:element('another-pool','water',[30,0,0],[4,.1,6])}])).toThrow('already exists');
 });
 it('adds a garden without moving the house and a plant without changing the pool',()=>{
  const before=stageSceneOperations(base(),[{op:'add',element:element('pool','water',[20,0,0],[4,.1,6])}]);
  const garden=edit(before,'Add a garden',[{op:'add',element:element('garden','plate',[12,.025,0],[4,.05,6],{semanticType:'garden'})}]);
  unchangedExcept(before,garden,['garden']);
  const plant=edit(garden,'Add a tropical plant',[{op:'add',element:element('plant','volume',[12,.5,0],[.5,1,.5],{semanticType:'plant'})}]);
  unchangedExcept(garden,plant,['plant']);expect(plant.elements.find(e=>e.id==='pool')).toEqual(before.elements.find(e=>e.id==='pool'));
 });
 it('widens staircase treads while preserving every endpoint, rise and run',()=>{
  const before=stageSceneOperations(base(),[{op:'assemble',assembly:{kind:'straight-stair',parameters:{id:'stair',at:[20,0,0],width:1,rise:1,run:2,risers:5}}}]);
  const ids=sceneSemanticObjects(before).find(o=>o.id==='stair')!.memberIds;
  const operations=before.elements.filter(e=>ids.includes(e.id)).map(e=>({op:'resize',id:e.id,size:[1.5,e.size[1],e.size[2]]}));
  const after=edit(before,'Make the staircase wider',operations);
  for(const id of ids){const a=before.elements.find(e=>e.id===id)!,b=after.elements.find(e=>e.id===id)!;expect(b.at).toEqual(a.at);expect(b.size.slice(1)).toEqual(a.size.slice(1));}
  unchangedExcept(before,after,Array.from(ids));
  expect(()=>edit(before,'Make the staircase wider',[{op:'resize',id:'stair',size:[1.5,2,3]}])).toThrow();
  expect(()=>edit(before,'Make the staircase wider',[{op:'resize',id:'stair',size:[1.5,before.elements.find(e=>e.id==='stair')!.size[1],before.elements.find(e=>e.id==='stair')!.size[2]]}])).toThrow('every tread');
 });
 it('rejects ambiguous doors, invented IDs and roof changes during door edits atomically',()=>{
  const before=base(),snapshot=JSON.stringify(before);
  expect(()=>edit(before,'Change the door material',[{op:'finish',id:'front-door',material:'sage'}])).toThrow('Choose a specific');
  expect(()=>edit(before,'Change front door material',[{op:'finish',id:'invented',material:'sage'}])).toThrow('Unknown');
  expect(()=>edit(before,'Change front door material',[{op:'finish',id:'front-door',material:'sage'},{op:'finish',id:'roof',material:'sage'}])).toThrow('unrequested');
  expect(()=>edit(before,'Change front door material',[{op:'replace',id:'front-door',element:{...before.elements[1],size:[2,3,.15],material:'sage'}}])).toThrow('Unrequested');
  expect(JSON.stringify(before)).toBe(snapshot);
 });
 it('rejects malformed/incomplete output, protected-field changes and metadata replacement',()=>{
  const before=base(),snapshot=JSON.stringify(before);
  expect(()=>edit(before,'Change front door material',[{op:'finish',id:'front-door'}])).toThrow();
  expect(()=>resolveSceneResult({mode:'edit',current:before,prompt:'Change front door material'},{operations:[]})).toThrow();
  expect(()=>edit(before,'Change front door material',[{op:'replace',id:'front-door',element:{...before.elements[1],label:'Changed identity'}}])).toThrow('Unrequested');
  expect(()=>resolveSceneResult({mode:'edit',current:before,prompt:'Change front door material'},{name:'Renamed',summary:'Bad',unsupported:[],architecturalPlan:{changed:true},operations:[{op:'finish',id:'front-door',material:'sage'}]})).toThrow('metadata');
  expect(JSON.stringify(before)).toBe(snapshot);
 });
 it('refuses new collisions, incompatible semantic kinds and unsupported connector operations',()=>{
  const before=base();
  expect(()=>edit(before,'Add a plant',[{op:'add',element:element('plant','volume',[0,1,0],[1,2,1],{semanticType:'plant'})}])).toThrow('collision');
  expect(()=>edit(before,'Add a plant',[{op:'add',element:element('floating-plant','volume',[20,20,0],[1,2,1],{semanticType:'plant'})}])).toThrow('ground contact');
  expect(()=>edit(before,'Add a garden',[{op:'add',element:element('fake-garden','roof',[20,.1,0],[3,.2,3],{semanticType:'garden'})}])).toThrow('incompatible');
  expect(()=>compileConstrainedEdit(before,{op:'setConnectorEndpoints',target:'house-floor',from:'a',to:'b'})).toThrow('Direct-scene connectors');
 });
 it('rejects indirect rotation of an unrequested child and invalid new hosts',()=>{
  const before=stageSceneOperations(base(),[{op:'add',element:element('root','volume',[20,1,0],[2,2,2])},{op:'add',element:element('child','volume',[0,0,0],[.2,.2,.2],{parent:'root'})}]);
  expect(()=>edit(before,'Rotate root',[{op:'rotate',id:'root',rotation:1}])).toThrow('Indirect movement');
  expect(()=>edit(before,'Add a plant',[{op:'add',element:element('bad-plant','volume',[0,1,0],[.2,1,.2],{semanticType:'plant',parent:'front-door'})}])).toThrow('invalid semantic host');
 });
 it('preserves a scene on clarification and sends the exact allowlist to the provider',()=>{
  const before=base();
  expect(sceneSystemPrompt({mode:'edit',current:before,prompt:'Change door material'})).toContain('TARGET CLARIFICATION REQUIRED');
  const prompt=sceneSystemPrompt({mode:'edit',current:before,prompt:'Change front door material'});
  expect(prompt).toContain('"targetIds":["front-door"]');expect(prompt).toContain('"fields":["material","color"]');
  const result=resolveSceneResult({mode:'edit',current:before,prompt:'Change door material'},{name:before.name,summary:'Clarify',unsupported:['Which door?'],operations:[]});
  expect(result.scene).toEqual(before);
 });
});
