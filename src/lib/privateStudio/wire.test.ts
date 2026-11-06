/** Real SDK + real private handler, with an intercepted HTTP transport only. Never contacts OpenAI. */
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {afterEach,expect,it,vi} from 'vitest';
import {StudioStore} from './store';
import {privateHandlers} from './http';
import {approvePrivateRun} from './approval';
import {FIRST_BRIEF,LIVE_POLICY} from './policy';
import {PromptMockDesigner,MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
import {emptyDraft,type StageNo} from '@/lib/villa/staged/pipeline';
import {runEdit} from '@/lib/villa/staged/edits';
import {loadHouse} from '@/lib/villa/staged/save';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('serializes and executes all five actual provider wire contracts for the new brief, preserves cached/failed usage, and permits semantic editing',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'studio-wire-'));
 try{
  vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','');vi.stubEnv('OPENAI_API_KEY','offline-placeholder');vi.stubEnv('AI_HOUSE_MODEL','not-the-approved-model');
  const store=new StudioStore(directory),http=privateHandlers(store),url='http://localhost:3015/api/private-studio';
  let cookie='',csrf='';
  const post=(body:unknown)=>http.POST(new Request(url,{method:'POST',headers:{origin:'http://localhost:3015',cookie,'x-studio-csrf':csrf},body:JSON.stringify(body)}));
  await http.GET(new Request(url));
  const setupCode=await readFile(path.join(directory,'setup-code'),'utf8');
  const login=await post({action:'login',password:'offline-wire-test-password',setupCode});cookie=login.headers.get('Set-Cookie')!.split(';')[0];csrf=(await login.json()).csrf;
  const projectId=(await (await post({action:'project',name:'Wire contract test'})).json()).projectId;
  await approvePrivateRun(store,FIRST_BRIEF);
  const runId=(await (await post({action:'start',projectId,brief:FIRST_BRIEF})).json()).runId;
  const modelDouble=new PromptMockDesigner(MOCK_BRIEFS[0]);let n=0;
  const wireSizes:number[]=[];
  const transport=vi.fn<typeof fetch>(async(url,init)=>{
   expect(String(url)).toBe('https://api.openai.com/v1/responses');
   const wire=JSON.parse(String(init?.body));wireSizes.push(Buffer.byteLength(String(init?.body)));
   expect(wire.model).toBe(LIVE_POLICY.model);expect(Object.values(LIVE_POLICY.stageOutputTokens)).toContain(wire.max_output_tokens);
   expect(JSON.stringify(wire.input)).toContain(FIRST_BRIEF);expect(wire.text.format.type).toBe('json_schema');
   if(!JSON.stringify(wire.input).includes('CORRECTION REQUEST'))n++;
   const source=await store.transaction(s=>structuredClone(s.runs[runId].source));
   const r=await modelDouble.design(n as StageNo,{brief:FIRST_BRIEF,site:LIVE_POLICY.site,draft:source.result?.spec??emptyDraft(LIVE_POLICY.site),requiredBedrooms:3,requiredBaths:2,checkpoints:source.result?.checkpoints??[]});
   expect(wire.text.format.strict).toBe(true);
   return new Response(JSON.stringify({id:`resp_offline_${n}`,object:'response',created_at:0,model:LIVE_POLICY.model,status:'completed',output:[{type:'message',id:`msg_${n}`,role:'assistant',content:[{type:'output_text',text:JSON.stringify(r.value),annotations:[]}]}],usage:{input_tokens:1000,input_tokens_details:{cached_tokens:500,...(n===3?{cache_write_tokens:300}:{})},output_tokens:200,output_tokens_details:{reasoning_tokens:40},total_tokens:1200}}),{headers:{'content-type':'application/json','x-request-id':`mock-request-${n}`}});
  });
  vi.stubGlobal('fetch',transport);
  let data;
  for(let stage=1;stage<=5;stage++){const response=await post({action:'advance',runId,stage,key:randomUUID()});expect(response.status).toBe(200);data=await response.json();expect(data.stage,JSON.stringify(data)).toBe(stage);}
  expect(data.status).toBe('complete');expect(data.costUsd).toBe(.021875);expect(transport).toHaveBeenCalledTimes(5);
  const ledger=await store.transaction(s=>Object.values(s.calls));
  // Budget charge at conservative per-category rates; billed estimate at published rates (stage 3 reports 300 cache-write tokens).
  expect(ledger.map(c=>c.costMicros)).toEqual([4375,4375,4375,4375,4375]);
  expect(ledger.map(c=>c.billedMicros)).toEqual([3750,3750,500*.2+300*2.5+200*2+200*12,3750,3750]);
  expect(data.billedUsd).toBeCloseTo((3750*4+3650)/1e6,9);
  expect(ledger.every(c=>!!c.raw&&!!c.request?.system&&c.request.prompt.includes(FIRST_BRIEF))).toBe(true);
  expect(Math.max(...wireSizes)).toBeLessThan(LIVE_POLICY.maxWireBytes);
  const saved=loadHouse(data.save),block=saved.spec.blocks[0];
  const edit=await runEdit({...saved,instruction:'Change this block finish',planner:{label:'Offline semantic proposal',plan:async()=>({plan:{summary:'Sage finish',ops:[{op:'set-finish',block:block.id,wall:'sage'}]}})}});
  expect(edit.accepted).toBe(true);expect(edit.spec.blocks[0].wall).toBe('sage');
 }finally{await rm(directory,{recursive:true,force:true});}
});
