import {afterEach,expect,it} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {backgroundResponseFetch} from '../../../scripts/lib/background-response';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function destination(){const root=await mkdtemp(join(tmpdir(),'sol-offline-'));roots.push(root);return join(root,'run');}
const url='https://api.openai.com/v1/responses';
const init={method:'POST',headers:{authorization:'Bearer offline-fake-key'},body:JSON.stringify({model:'gpt-6.1-sol',reasoning:{effort:'high'},text:{format:{type:'json_schema',strict:true,schema:{type:'object'}}}})};
const reply=(status:string,extra={})=>Response.json({id:'resp_offline',status,...extra},{headers:{'x-request-id':'req_offline'}});
it('submits once, preserves schema, IDs, raw output and actual usage through polling',async()=>{
 const directory=await destination();const calls:{url:string;init?:RequestInit}[]=[];
 const fake:typeof fetch=async(u,i)=>{calls.push({url:String(u),init:i});return calls.length===1?reply('queued'):reply('completed',{usage:{input_tokens:123,output_tokens:456}});};
 const response=await backgroundResponseFetch(directory,false,{fetch:fake,pause:async()=>{}})(url,init);
 expect((await response.json()).status).toBe('completed');expect(calls.map(x=>x.init?.method)).toEqual(['POST','GET']);
 const body=JSON.parse(String(calls[0].init?.body));expect(body).toEqual({...JSON.parse(init.body),background:true,store:true});
 const state=JSON.parse(await readFile(`${directory}/state.json`,'utf8'));expect(state.responseId).toBe('resp_offline');expect(state.requestId).toBe('req_offline');expect(state.usage.output_tokens).toBe(456);
 expect(await readFile(`${directory}/request.json`,'utf8')).not.toContain('offline-fake-key');
});
it('resumes after polling failure with GET only and refuses duplicate submission',async()=>{
 const directory=await destination();let calls=0;
 await expect(backgroundResponseFetch(directory,false,{fetch:async()=>{if(++calls===1)return reply('in_progress');throw Error('offline transport timeout');},pause:async()=>{}})(url,init)).rejects.toThrow('timeout');
 const methods:string[]=[];
 await backgroundResponseFetch(directory,true,{fetch:async(_,i)=>{methods.push(i!.method!);return reply('completed');}})(url,init);
 expect(methods).toEqual(['GET']);
 await expect(backgroundResponseFetch(directory,false,{fetch:async()=>{throw Error('Must not call');}})(url,init)).rejects.toThrow();
});
it('never resubmits when create acceptance is unknown',async()=>{
 const directory=await destination();let calls=0;const fake:typeof fetch=async()=>{calls++;throw Error('timeout');};
 await expect(backgroundResponseFetch(directory,false,{fetch:fake})(url,init)).rejects.toThrow('timeout');
 await expect(backgroundResponseFetch(directory,true,{fetch:fake})(url,init)).rejects.toThrow('Acceptance unknown');expect(calls).toBe(1);
});
it('retains terminal failures with usage and rejects changed recovery inputs',async()=>{
 const directory=await destination();await expect(backgroundResponseFetch(directory,false,{fetch:async()=>reply('incomplete',{usage:{output_tokens:30000}})})(url,init)).rejects.toThrow('incomplete');
 expect(JSON.parse(await readFile(`${directory}/terminal.json`,'utf8')).usage.output_tokens).toBe(30000);
 await expect(backgroundResponseFetch(directory,true)(url,{...init,body:'{}'})).rejects.toThrow('Frozen request changed');
});
it('passes the final response through the installed SDK with real usage mapping',async()=>{
 const {createOpenAI}=await import('@ai-sdk/openai');const {generateText,Output,jsonSchema}=await import('ai');
 const directory=await destination();let calls=0;
 const transport=backgroundResponseFetch(directory,false,{pause:async()=>{},fetch:async()=>++calls===1?reply('queued'):reply('completed',{
  model:'gpt-6.1-sol',created_at:1,output:[{type:'message',id:'msg_offline',role:'assistant',content:[{type:'output_text',text:'{"ok":true}',annotations:[]}]}],
  usage:{input_tokens:123,output_tokens:45,total_tokens:168,input_tokens_details:{cached_tokens:10},output_tokens_details:{reasoning_tokens:20}}
 })});
 const result=await generateText({model:createOpenAI({apiKey:'offline-fake-key',fetch:transport}).responses('gpt-6.1-sol'),prompt:'offline only',maxRetries:0,
  output:Output.object({schema:jsonSchema({type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false})})});
 expect(result.output).toEqual({ok:true});expect(result.totalUsage.inputTokens).toBe(123);expect(result.totalUsage.outputTokens).toBe(45);
 expect(result.totalUsage.outputTokenDetails.reasoningTokens).toBe(20);expect(result.response.id).toBe('resp_offline');expect(calls).toBe(2);
});
