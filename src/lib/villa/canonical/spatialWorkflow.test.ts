/** Offline end to end with a mocked provider that returns derived-height plans through the real
 * strict-schema wire (omitted values arrive as null), the real SDK parser, the canonical compiler,
 * persistence, an individual edit and project Undo/Redo. Developer fixtures: contracts only. */
import {expect,it,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:mocks.generate}));
vi.mock('@/lib/ai/model',()=>({getAiModel:()=>({})}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_meta:unknown,call:()=>unknown)=>call()}));
vi.mock('../scene/knowledgeContext',()=>({architecturalRequestContext:async()=>({trace:{text:'offline fixture knowledge'},evidence:[]})}));
import {generateCanonical} from './generate';
import {compositionFixture} from './compositions.fixture';
import {compileArchitecturalPlan,type ArchitecturalPlan} from './plan';
import {stageSceneOperations,validateScene} from '../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
import {type SchemaNode} from '../scene/strictSchema';
import {Output} from 'ai';
type ObjectOutput=ReturnType<typeof Output.object>;
function encode(value:unknown,node:SchemaNode):unknown{
 if(node.anyOf){const branches=node.anyOf as SchemaNode[];const branch=branches.find(b=>{const p=b.properties as Record<string,SchemaNode>|undefined;return p?.status?.const===(value as SchemaNode)?.status;})??branches.find(b=>b.type!=='null')!;return encode(value,branch);}
 if(Array.isArray(value)&&node.items)return value.map(v=>encode(v,node.items as SchemaNode));
 if(value&&typeof value==='object'&&node.properties)return Object.fromEntries(Object.entries(node.properties as Record<string,SchemaNode>).map(([k,p])=>[k,(value as SchemaNode)[k]===undefined?null:encode((value as SchemaNode)[k],p)]));
 return value;
}
const usage={inputTokens:0,outputTokens:0,totalTokens:0,inputTokenDetails:{noCacheTokens:0,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:0,reasoningTokens:0}};
function respondWith(plan:ArchitecturalPlan){
 mocks.generate.mockReset();
 mocks.generate.mockImplementation(async({output}:{output:ObjectOutput})=>{
  const format=await output.responseFormat;if(format?.type!=='json'||!format.schema)throw Error('JSON schema missing');
  const raw=JSON.stringify(encode({result:{status:'proposed',plan,limitations:['Developer fixture; no AI quality claim']}},format.schema as SchemaNode));
  expect(raw).toContain('"height":null');
  return {finishReason:'stop',output:await output.parseCompleteOutput({text:raw},{response:{id:'offline',timestamp:new Date(0),modelId:'offline'},usage,finishReason:'stop'})};
 });
}
const omitStacked=(plan:ArchitecturalPlan,ids:string[]):ArchitecturalPlan=>{const next=structuredClone(plan);for(const s of next.spaces)if(ids.includes(s.id))delete s.height;return next;};
afterEach(()=>vi.unstubAllGlobals());
it.each([
 ['compact residence',()=>omitStacked(compositionFixture('compact'),['hall','day-room','arrival','rear-deck'])],
 ['multilevel residence with stacked spaces',()=>omitStacked(compositionFixture('waterfront'),['stair-hall','salon','guest-wing'])],
 ['multi-volume estate',()=>omitStacked(compositionFixture('courtyard'),['west-wing'])],
])('%s: omitted heights cross the wire as null, are derived, and the result persists, edits and undoes',async(_name,fixture)=>{
 const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
 const plan=fixture();
 const compiled=(()=>{try{return compileArchitecturalPlan(plan);}catch(e){return e;}})();
 // Courtyard has one level: a derived height without any level above is refused, never guessed.
 if(compiled instanceof Error||!('scene' in (compiled as object))){
  respondWith(plan);
  const response=await generateCanonical({mode:'generate',prompt:'Offline'},{model:'t'},new AbortController().signal);
  expect(response.status).toBe(422);expect((await response.json()).error).toContain('height is required');
  expect(mocks.generate).toHaveBeenCalledTimes(1);return;
 }
 respondWith(plan);
 const response=await generateCanonical({mode:'generate',prompt:'Offline'},{model:'t'},new AbortController().signal);
 const body=await response.json();expect(response.status,body.error).toBe(200);expect(mocks.generate).toHaveBeenCalledTimes(1);
 expect(body.architecturalPlan.version).toBe('architectural-plan-1');
 expect(body.scene.architecturalPlan.spaces.some((s:{height?:number})=>s.height===undefined)).toBe(true);
 const scene=validateScene(body.scene),reloaded=validateScene(JSON.parse(JSON.stringify(scene)));expect(reloaded).toEqual(scene);
 const target=scene.elements.find(e=>e.kind==='screen'||e.kind==='roof')!;
 const edited=stageSceneOperations(reloaded,[{op:'finish',id:target.id,material:'bronze'}]);
 expect(edited.elements.filter(e=>e.id!==target.id)).toEqual(scene.elements.filter(e=>e.id!==target.id));
 const store=useProjectStore.getState(),project=store.createProject('Spatial workflow','house','direct-scene');
 store.appendVersion(project.id,'Generated',JSON.stringify(scene));store.appendVersion(project.id,'Edited',JSON.stringify(edited));
 store.undo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(scene);
 store.redo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(edited);
});
