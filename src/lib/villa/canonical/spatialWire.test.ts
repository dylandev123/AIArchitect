/** Offline end to end for wing placement: a mocked provider returns developer-authored plans through the real strict-schema
 * wire (omitted values arrive as null), the real SDK parser and the canonical compiler. Contracts only: no AI quality claim. */
import {expect,it,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({generate:vi.fn(),raw:undefined as string|undefined}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:mocks.generate}));
vi.mock('@/lib/ai/model',()=>({getAiModel:()=>({})}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_meta:unknown,call:()=>unknown)=>call()}));
vi.mock('../scene/knowledgeContext',()=>({architecturalRequestContext:async()=>({trace:{text:'offline fixture knowledge'},evidence:[]})}));
import {generateCanonical} from './generate';
import {compactFamilyHome,asymmetricMultilevel,courtyardHouse,luxuryEstate} from './spatial.fixture';
import {type ArchitecturalPlan} from './plan';
import {validateScene} from '../scene/model';
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
 mocks.generate.mockReset();mocks.raw=undefined;
 mocks.generate.mockImplementation(async({output}:{output:ObjectOutput})=>{
  const format=await output.responseFormat;if(format?.type!=='json'||!format.schema)throw Error('JSON schema missing');
  const raw=JSON.stringify(encode({result:{status:'proposed',plan,limitations:['Developer fixture; no AI quality claim']}},format.schema as SchemaNode));
  mocks.raw=raw;
  return {finishReason:'stop',output:await output.parseCompleteOutput({text:raw},{response:{id:'offline',timestamp:new Date(0),modelId:'offline'},usage,finishReason:'stop'})};
 });
}
afterEach(()=>vi.unstubAllGlobals());
it.each([
 ['compact family home',compactFamilyHome],['asymmetric multilevel residence',asymmetricMultilevel],['courtyard composition',courtyardHouse],['multi-wing estate',luxuryEstate],
])('%s: wing placements and constraints cross the strict provider wire (omitted values arrive as null), compile, and come back with their coordination report',async(_name,fixture)=>{
 const plan=fixture();
 respondWith(plan);
 const response=await generateCanonical({mode:'generate',prompt:'Offline'},{model:'t'},new AbortController().signal);
 const body=await response.json();expect(response.status,body.error).toBe(200);expect(mocks.generate).toHaveBeenCalledTimes(1);
 // The wire carried explicit nulls for every unused optional field, including wing placements on the root wing and absent constraints.
 expect(JSON.parse(mocks.raw!).result.plan.masses.some((m:{placement:unknown})=>m.placement===null)).toBe(true);
 expect(body.architecturalPlan).toEqual(plan);                                      // nulls were normalised away: the plan is exactly what was authored
 expect(body.coordination.ok).toBe(true);expect(body.coordination.wings.length).toBe(plan.masses.length);
 expect(validateScene(body.scene).architecturalPlan).toEqual(plan);
});
it('an arrangement that violates its own declared constraint is refused at the canonical route with the measurement and the decisions to reconsider',async()=>{
 const plan=luxuryEstate();plan.constraints![0].amount=40;
 respondWith(plan);
 const response=await generateCanonical({mode:'generate',prompt:'Offline'},{model:'t'},new AbortController().signal);
 const body=await response.json();expect(response.status).toBe(422);
 expect(body.decisions.join(' ')).toMatch(/guests-private .* is not met/);expect(body.providerCalls).toBe(1);
});
