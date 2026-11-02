/** The real POST /api/ai/scene route, the real generateCanonical, strict wire and compiler; only the provider is mocked (no paid call).
 * Developer-authored wing fixtures: contracts only, no AI quality claim. */
import {expect,it,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:mocks.generate}));
vi.mock('@/lib/ai/model',()=>({getAiModelId:()=>'gpt-5.6-terra',isAiConfigured:()=>true,getAiModel:()=>({}),AI_NOT_CONFIGURED_MESSAGE:'Unavailable'}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_m:unknown,call:()=>unknown)=>call()}));
vi.mock('../scene/knowledgeContext',()=>({architecturalRequestContext:async()=>({trace:{text:'offline fixture knowledge'},evidence:[]})}));
import {POST} from '@/app/api/ai/scene/route';
import {luxuryEstate,courtyardHouse} from './spatial.fixture';
import {stageSceneOperations,validateScene} from '../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
import type {ArchitecturalPlan} from './plan';
import type {SchemaNode} from '../scene/strictSchema';
const usage={inputTokens:0,outputTokens:0,totalTokens:0,inputTokenDetails:{noCacheTokens:0,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:0,reasoningTokens:0}};
/** What the strict provider wire carries: every optional field is an explicit null. */
function encode(value:unknown,node:SchemaNode):unknown{
 if(node.anyOf){const branches=node.anyOf as SchemaNode[];const branch=branches.find(b=>{const p=b.properties as Record<string,SchemaNode>|undefined;return p?.status?.const===(value as SchemaNode)?.status;})??branches.find(b=>b.type!=='null')!;return encode(value,branch);}
 if(Array.isArray(value)&&node.items)return value.map(v=>encode(v,node.items as SchemaNode));
 if(value&&typeof value==='object'&&node.properties)return Object.fromEntries(Object.entries(node.properties as Record<string,SchemaNode>).map(([k,p])=>[k,(value as SchemaNode)[k]===undefined?null:encode((value as SchemaNode)[k],p)]));
 return value;
}
function respondWith(plan:ArchitecturalPlan){
 mocks.generate.mockReset();
 mocks.generate.mockImplementation(async({output}:{output:{responseFormat:Promise<{schema?:unknown}>;parseCompleteOutput:(...a:unknown[])=>Promise<unknown>}})=>{
  const format=await output.responseFormat;
  const text=JSON.stringify(encode({result:{status:'proposed',plan,limitations:['Developer fixture']}},format.schema as SchemaNode));
  return {finishReason:'stop',output:await output.parseCompleteOutput({text},{response:{id:'o',timestamp:new Date(0),modelId:'o'},usage,finishReason:'stop'})};
 });
}
const post=()=>POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify({mode:'generate',prompt:'Offline'})}));
afterEach(()=>vi.unstubAllGlobals());
it('estate with wing placements and constraints: route → provider schema → compiler → save/reload → edit → Undo/Redo',async()=>{
 const plan=luxuryEstate();respondWith(plan);
 const response=await post(),body=await response.json();
 expect(response.status,body.error).toBe(200);expect(mocks.generate).toHaveBeenCalledTimes(1);expect(body.providerCalls).toBe(1);
 expect(body.architecturalPlan.masses.filter((m:{placement?:unknown})=>m.placement).length).toBe(plan.masses.filter(m=>m.placement).length);
 expect(body.architecturalPlan.constraints).toEqual(plan.constraints);expect(body.coordination.ok).toBe(true);
 const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
 const scene=validateScene(body.scene),reloaded=validateScene(JSON.parse(JSON.stringify(scene)));expect(reloaded).toEqual(scene);
 const target=scene.elements.find(e=>e.kind==='roof')!,edited=stageSceneOperations(reloaded,[{op:'finish',id:target.id,material:'bronze'}]);
 const store=useProjectStore.getState(),project=store.createProject('Route','house','direct-scene');
 store.appendVersion(project.id,'Generated',JSON.stringify(scene));store.appendVersion(project.id,'Edited',JSON.stringify(edited));
 store.undo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(scene);
 store.redo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(edited);
});
it('a wing overlap is reported before its secondary door failures',async()=>{
 const plan=courtyardHouse();plan.masses.find(m=>m.id==='east-range')!.placement={relativeTo:'south-range',side:'north',alignment:'start',gap:0};   // east range now lands on the west range
 respondWith(plan);const response=await post(),body=await response.json();
 expect(response.status).toBe(422);
 expect(body.decisions[0]).toMatch(/wing west-range and wing east-range/);
 expect(body.decisions.some((d:string)=>/share no wall/.test(d))).toBe(true);
 const door=body.decisions.findIndex((d:string)=>/share no wall|too short/.test(d)),overlap=body.decisions.findIndex((d:string)=>/wings west-range × east-range|spans cross/.test(d));
 expect(overlap).toBeGreaterThanOrEqual(0);expect(overlap).toBeLessThan(door);
});
