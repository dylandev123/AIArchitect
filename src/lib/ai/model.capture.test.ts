import {afterEach,expect,it,vi} from 'vitest';
import {generateText} from 'ai';
import {getAiModel} from './model';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('captures exact response/request text through the real SDK without network or headers',async()=>{
 vi.stubEnv('OPENAI_API_KEY','offline-placeholder');
 const body='  '+JSON.stringify({id:'resp_offline',object:'response',created_at:0,model:'gpt-5.6-terra',status:'completed',output:[{type:'message',id:'msg',role:'assistant',content:[{type:'output_text',text:'Observed output',annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}})+'\n';
 const transport=vi.fn<typeof fetch>(async()=>new Response(body,{status:200,headers:{'content-type':'application/json'}}));
 vi.stubGlobal('fetch',transport);
 const records:unknown[]=[];
 const result=await generateText({model:getAiModel(r=>records.push(r)),prompt:'Original brief',maxRetries:0});
 expect(result.text).toBe('Observed output');
 expect(transport).toHaveBeenCalledTimes(1);
 expect(records).toEqual([{status:200,requestBody:transport.mock.calls[0]?.[1]?.body,responseBody:body}]);
 expect(records[0]).not.toHaveProperty('headers');
});

it.each(['gpt-5.6-terra','gpt-5.6-sol','gpt-6.1-sol','gpt-6-astra'])('serializes structured output and reasoning on Responses for %s without network',async model=>{
 vi.stubEnv('OPENAI_API_KEY','offline-placeholder');
 const {Output}=await import('ai');
 const {sceneResponseFormatSchema}=await import('@/lib/villa/scene/terra');const {laderaPlan}=await import('@/lib/villa/scene/planning.fixture');
 const {laderaScene}=await import('@/lib/villa/scene/example');
 const schema=await sceneResponseFormatSchema({mode:'edit',editIntent:'complete',prompt:'Same architecture contract',current:laderaScene});
 const output=JSON.stringify({name:'Offline',summary:'Test',unsupported:[],architecturalPlan:laderaPlan,operations:[{op:'remove',id:'bridge-roof'}]});
 for(const reasoningEffort of ['medium','high'] as const){
  const transport=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({id:'resp_offline',object:'response',created_at:0,model,status:'completed',output:[{type:'message',id:'msg',role:'assistant',content:[{type:'output_text',text:output,annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}),{headers:{'content-type':'application/json'}}));
  vi.stubGlobal('fetch',transport);
  await generateText({model:getAiModel(()=>{},model),prompt:'Same architecture contract',output:Output.object({schema}),providerOptions:{openai:{strictJsonSchema:true,reasoningEffort}},maxRetries:0});
  expect(transport).toHaveBeenCalledOnce();const [url,options]=transport.mock.calls[0];expect(String(url)).toBe('https://api.openai.com/v1/responses');
  const wire=JSON.parse(String(options?.body));expect(wire.model).toBe(model);expect(wire.reasoning.effort).toBe(reasoningEffort);expect(wire.text.format.type).toBe('json_schema');expect(wire.text.format.strict).toBe(true);
 }
});
