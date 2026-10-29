import { describe,it,expect } from 'vitest';
import { zodSchema } from 'ai';
import { laderaScene } from './example';
import { applySceneOperations,validateScene } from './model';
import { resolveSceneResult,sceneRequestSchema,sceneResultSchema,SCENE_SYSTEM_PROMPT } from './terra';
const request=sceneRequestSchema.parse({prompt:'Build an original house',mode:'generate'});
describe('Terra independent scene authoring',()=>{
 it('replays the complete Casa Ladera through the provider contract',()=>{
 const result=resolveSceneResult(request,{name:laderaScene.name,summary:'Ladera replay',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))});
 expect(result.scene).toEqual(laderaScene);
 });
 it('exposes a provider-compatible schema without tuples or house families',async()=>{
 const schema=await zodSchema(sceneResultSchema).jsonSchema;
 const wire=JSON.stringify(schema);
 expect(wire).not.toContain('prefixItems');expect(wire).not.toContain('storeys');expect(wire).not.toContain('wingRatio');
 expect(SCENE_SYSTEM_PROMPT).toContain('more than two floors');
 });
 it('constructs five rotated, split levels with a high detached bridge; edits, persists and undoes',()=>{
 const elements=Array.from({length:5},(_,i)=>({id:`level-${i}`,label:`Level ${i}`,kind:'plate',at:[i*2, i*3.4,0],size:[12,.3,9],rotation:.37}));
 elements.push({id:'core',label:'Grounded supporting core',kind:'volume',at:[4,8.9,0],size:[2,17.8,2],rotation:.37});
 elements.push({id:'bridge',label:'Elevated bridge',kind:'roof',at:[0,18,0],size:[90,.3,4],rotation:.62});
 const first=resolveSceneResult(request,{name:'Five-level lantern',summary:'Split-level composition',unsupported:[],operations:elements.map(element=>({op:'add',element}))}).scene;
 const next=resolveSceneResult({prompt:'Attach a screen and rotate bridge',mode:'edit',current:first},{name:first.name,summary:'Targeted edit',unsupported:[],operations:[{op:'add',element:{id:'screen',label:'Screen',kind:'screen',parent:'bridge',at:[0,1,0],size:[8,2,.15]}},{op:'rotate',id:'bridge',rotation:.9}]}).scene;
 expect(next.elements[0]).toBe(first.elements[0]);expect(next.elements.at(-1)?.parent).toBe('bridge');
 expect(validateScene(JSON.parse(JSON.stringify(next)))).toEqual(next);
 const history=[first];expect(history.pop()).toEqual(first);expect(first.elements.at(-1)?.rotation).toBe(.62);
 expect(()=>applySceneOperations(next,[{op:'remove',id:'bridge'}])).toThrow('Missing attachment');
 });
 it('allows complete scenes beyond the old operation and dimension caps',()=>{
 const operations=Array.from({length:120},(_,i)=>({op:'add',element:{id:`part-${i}`,label:'Part',kind:'plate',at:[150+i,.15,0],size:[90,.3,80]}}));
 expect(resolveSceneResult(request,{name:'Large composition',summary:'Complete scene',unsupported:[],operations}).scene.elements).toHaveLength(120);
 expect(()=>resolveSceneResult(request,{name:'Too many',summary:'Budget',unsupported:[],operations:Array.from({length:401},(_,i)=>({...operations[0],element:{...operations[0].element,id:`part-${i}`}}))})).toThrow();
 });
 it('rejects unsupported shapes instead of generic replacement; preserves the saved source',()=>{
 expect(()=>resolveSceneResult(request,{name:'Bad',summary:'Bad',unsupported:[],operations:[{op:'add',element:{id:'dome',kind:'dome',label:'Dome',at:[0,0,0],size:[2,2,2]}}]})).toThrow();
 expect(()=>applySceneOperations(laderaScene,[{op:'replace',id:'salon-back',element:{...laderaScene.elements.find(e=>e.id==='salon-back'),opening:{x:0,sill:0,width:100,height:100,glazed:false}}}])).toThrow();
 });
});

it('ignores generated terrain variation but preserves existing terrain on edit and load',()=>{
 const terrain={width:92,depth:76,elevation:4,grade:.18,fall:'-z' as const};
 const output={name:'Flat house',summary:'Replay',unsupported:[],operations:[{op:'set-terrain',terrain},...laderaScene.elements.map(element=>({op:'add',element}))]};
 const generated=resolveSceneResult(request,output);expect(generated.scene.terrain).toBeUndefined();expect(generated.operations.some(op=>op.op==='set-terrain')).toBe(false);
 const existing={...laderaScene,terrain};const copy=JSON.stringify(existing);
 const edited=resolveSceneResult({mode:'edit',prompt:'Change one finish',current:existing},{name:existing.name,summary:'Finish',unsupported:[],operations:[{op:'finish',id:existing.elements[0].id,material:'timber'}]});
 expect(edited.scene.terrain).toEqual(terrain);expect(JSON.stringify(existing)).toBe(copy);expect(validateScene(JSON.parse(copy))).toEqual(existing);
});

it('rejects elevated-only new foundations without altering retained projects',()=>{
 const output={name:'Floating',summary:'Bad site',unsupported:[],operations:[{op:'add',element:{id:'floor',label:'Floor',kind:'plate',at:[0,8,0],size:[20,.3,12]}}]};
 expect(()=>resolveSceneResult(request,output)).toThrow('needs contact');
});
