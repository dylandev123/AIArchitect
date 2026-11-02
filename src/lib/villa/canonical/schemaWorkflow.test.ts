import {expect,it,vi,afterEach} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
const mocks=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:mocks.generate}));
vi.mock('@/lib/ai/model',()=>({getAiModel:()=>({})}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_meta:unknown,call:()=>unknown)=>call()}));
vi.mock('../scene/knowledgeContext',()=>({architecturalRequestContext:async()=>({trace:{text:'offline fixture knowledge'},evidence:[]})}));
import {generateCanonical} from './generate';
import {compositionFixture} from './compositions.fixture';
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
afterEach(()=>vi.unstubAllGlobals());
it('mocked provider JSON passes the real SDK parser, canonical boundary, persistence, individual edit and history',async()=>{
 const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
 const dir='docs/architecture/canonical-schema-compatibility';mkdirSync(dir,{recursive:true});
 for(const name of ['compact','waterfront'] as const){
  mocks.generate.mockReset();
  const plan=compositionFixture(name);
  mocks.generate.mockImplementation(async({output}:{output:ObjectOutput})=>{
   const format=await output.responseFormat;if(format?.type!=='json'||!format.schema)throw Error('JSON schema missing');
   const raw=JSON.stringify(encode({result:{status:'proposed',plan,limitations:['Mocked developer fixture; no AI quality claim']}},format.schema as SchemaNode));
   const parsed=await output.parseCompleteOutput({text:raw},{response:{id:'offline',timestamp:new Date(0),modelId:'offline'},usage:{inputTokens:0,outputTokens:0,totalTokens:0,inputTokenDetails:{noCacheTokens:0,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:0,reasoningTokens:0}},finishReason:'stop'});
   writeFileSync(`${dir}/${name}.mock-response.json`,raw);
   return {finishReason:'stop',output:parsed};
  });
  const response=await generateCanonical({mode:'generate',prompt:`Offline ${name}`},{model:'gpt-5.6-terra'},new AbortController().signal);
  const body=await response.json();expect(response.status,body.error).toBe(200);expect(mocks.generate).toHaveBeenCalledTimes(1);
  const scene=validateScene(body.scene),reloaded=validateScene(JSON.parse(JSON.stringify(scene)));expect(reloaded).toEqual(scene);
  const target=scene.elements.find(e=>e.kind==='screen')!;
  const edited=stageSceneOperations(reloaded,[{op:'finish',id:target.id,material:'bronze'}]);
  expect(edited.elements.find(e=>e.id===target.id)!.material).toBe('bronze');
  expect(edited.elements.filter(e=>e.id!==target.id)).toEqual(scene.elements.filter(e=>e.id!==target.id));
  const store=useProjectStore.getState(),project=store.createProject('Offline schema workflow','house','direct-scene');
  store.appendVersion(project.id,'Mocked generated scene',JSON.stringify(scene));store.appendVersion(project.id,'Individual screen edit',JSON.stringify(edited));
  store.undo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(scene);
  store.redo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(edited);
  writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(scene,null,2));
 }
});
it('invalid architectural intent still returns 422 without repair or fallback',async()=>{
 mocks.generate.mockReset();const plan=compositionFixture('compact');plan.site.grade=.1;
 mocks.generate.mockImplementation(async({output}:{output:ObjectOutput})=>{const format=await output.responseFormat;if(format?.type!=='json'||!format.schema)throw Error('Schema missing');return {finishReason:'stop',output:await output.parseCompleteOutput({text:JSON.stringify(encode({result:{status:'proposed',plan,limitations:[]}},format.schema as SchemaNode))},{response:{id:'offline',timestamp:new Date(0),modelId:'offline'},usage:{inputTokens:0,outputTokens:0,totalTokens:0,inputTokenDetails:{noCacheTokens:0,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:0,reasoningTokens:0}},finishReason:'stop'})};});
 const response=await generateCanonical({mode:'generate',prompt:'Invalid grading'},{model:'test'},new AbortController().signal);
 expect(response.status).toBe(422);expect((await response.json()).error).toContain('Graded');expect(mocks.generate).toHaveBeenCalledTimes(1);
});
