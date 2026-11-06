/** Exact failed live response, replayed through the real SDK with an offline transport. */
import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {directionSchema} from '@/lib/villa/staged/spec';
import {LiveDesigner} from '@/lib/villa/staged/liveDesigner';
import {Output} from 'ai';
import {strictSchemaIssues} from '@/lib/villa/scene/strictSchema';
import {emptyDraft} from '@/lib/villa/staged/pipeline';
import {withReservedCall} from '@/lib/ai/paidExecution';
import {LIVE_POLICY} from './contract';
const recorded=JSON.parse(readFileSync('docs/architecture/secure-live-studio/first-failure/recorded-direction.json','utf8'));
const evidence=JSON.parse(readFileSync('docs/architecture/secure-live-studio/first-failure/evidence.json','utf8'));
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('isolates the exact recorded failure without relaxing the schema',()=>{
 const result=directionSchema.safeParse(recorded);expect(result.success).toBe(false);
 if(!result.success)expect(result.error.issues.map(i=>i.path)).toEqual([['palette','roofColor']]);
 const corrected=structuredClone(recorded);corrected.palette.roofColor='#B65A36';
 expect(directionSchema.parse(corrected).concept).toBe(recorded.concept);
});
it('enables strict-compatible Stage 1 and Stage 3 wire schemas',async()=>{
 for(const stage of [1,3] as const){
  const wire=await (Output.object({schema:new LiveDesigner().schema(stage) as never}) as unknown as {responseFormat:Promise<{schema:Record<string,unknown>}>}).responseFormat;
  expect(strictSchemaIssues(wire.schema)).toEqual([]);
 }
});
it.each([false,true,'null'] as const)('replays the real SDK contract with hex corrected=%s; one dispatch and billed usage retained',async corrected=>{
 vi.stubEnv('OPENAI_API_KEY','offline-placeholder');
 const value=structuredClone(recorded);if(corrected)value.palette.roofColor=corrected==='null'?null:'#B65A36';
 const transport=vi.fn<typeof fetch>(async(_url,init)=>{
  const wire=JSON.parse(String(init?.body));
  expect(wire.model).toBe(LIVE_POLICY.model);expect(wire.max_output_tokens).toBe(LIVE_POLICY.stageOutputTokens[1]);
  expect(wire.text.format.strict).toBe(true);
  expect(JSON.stringify(wire.input)).toContain('six-digit hexadecimal');
  expect(JSON.stringify(wire.input)).toContain(evidence.brief.replace(/\n/g,'\\n'));
  expect(JSON.stringify(wire.text.format.schema)).toContain('Six-digit hexadecimal roof color');
  return new Response(JSON.stringify({id:'offline-recorded-direction',object:'response',created_at:0,model:LIVE_POLICY.model,status:'completed',output:[{type:'message',id:'offline-message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}],usage:{input_tokens:563,input_tokens_details:{cached_tokens:0},output_tokens:564,output_tokens_details:{reasoning_tokens:0},total_tokens:1127}}),{headers:{'content-type':'application/json'}});
 });
 vi.stubGlobal('fetch',transport);const observe=vi.fn(async()=>{});
 const designer=new LiveDesigner(LIVE_POLICY.stageOutputTokens,{modelId:LIVE_POLICY.model,price:LIVE_POLICY.price,observe});
 const result=withReservedCall({model:LIVE_POLICY.model,maxOutputTokens:LIVE_POLICY.stageOutputTokens[1],maxWireBytes:60000},()=>designer.design(1,{brief:evidence.brief,site:LIVE_POLICY.site,draft:emptyDraft(LIVE_POLICY.site),requiredBedrooms:3,requiredBaths:2,checkpoints:[]}));
 if(corrected){const expected=structuredClone(value);if(corrected==='null')delete expected.palette.roofColor;expect((await result).value).toEqual(expected);}
 else await expect(result).rejects.toMatchObject({detail:{raw:JSON.stringify(recorded),finishReason:'stop',validationIssues:[expect.objectContaining({path:['palette','roofColor']})],request:expect.objectContaining({prompt:expect.stringContaining(evidence.brief)})}});
 expect(transport).toHaveBeenCalledTimes(1);
 expect(observe).toHaveBeenCalledWith(expect.objectContaining({usage:expect.objectContaining({costUsd:(563*LIVE_POLICY.price.input+564*LIVE_POLICY.price.output)/1e6})}));
});
