import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const {generateText}=vi.hoisted(()=>({generateText:vi.fn()}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText}));
vi.mock('@/lib/ai/model',()=>({getAiModelId:()=> 'gpt-5.6-terra',getAiModel:()=> 'offline-SDK-double'}));
import {recordWorkerHeartbeat} from './workerHealth';
import {StudioStore} from './store';
import {privateHandlers} from './http';
import {PrivateStudioService} from './service';
import {approvePrivateRun} from './approval';
import {FIRST_BRIEF,LIVE_POLICY,RESERVATION_MICROS,POLICY_HASH,reservationMicros} from './policy';
import {PromptMockDesigner,MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
import {emptyDraft,type StageNo} from '@/lib/villa/staged/pipeline';
import {loadHouse} from '@/lib/villa/staged/save';
import {promptRequirements} from '@/lib/villa/staged/promptGeneration';
let dir:string,store:StudioStore,http:ReturnType<typeof privateHandlers>,cookie='',csrf='';
const url='http://localhost:3015/api/private-studio';
const password='offline-test-password-only';
function request(body:unknown,headers:Record<string,string>={}){return new Request(url,{method:'POST',headers:{origin:'http://localhost:3015','Content-Type':'application/json',cookie,'x-studio-csrf':csrf,...headers},body:JSON.stringify(body)});}
async function login(){
 await http.GET(new Request(url));const setupCode=await readFile(path.join(dir,'setup-code'),'utf8');
 const r=await http.POST(request({action:'login',password,setupCode}));expect(r.status).toBe(200);
 expect(r.headers.get('Set-Cookie')).toContain('HttpOnly; SameSite=Strict');
 cookie=r.headers.get('Set-Cookie')!.split(';')[0];csrf=(await r.json()).csrf;
}
async function project(){const r=await http.POST(request({action:'project',name:'Owned offline test'}));expect(r.status).toBe(200);return (await r.json()).projectId;}
async function start(){const projectId=await project();await approvePrivateRun(store,FIRST_BRIEF);const r=await http.POST(request({action:'start',projectId,brief:FIRST_BRIEF}));expect(r.status).toBe(200);return (await r.json()).runId;}
async function advance(runId:string,stage:number,key=randomUUID()){return http.POST(request({action:'advance',runId,stage,key}));}
function mockStages(){
 const designer=new PromptMockDesigner(MOCK_BRIEFS[0]);let stage=0;
 generateText.mockImplementation(async options=>{
  stage++;
  expect(options.prompt).toContain(FIRST_BRIEF);expect(Object.values(LIVE_POLICY.stageOutputTokens)).toContain(options.maxOutputTokens);expect(options.maxRetries).toBe(0);
  const run=await store.transaction(s=>structuredClone(Object.values(s.runs).find(r=>r.state==='running')!));
  const value=await designer.design(stage as StageNo,{brief:FIRST_BRIEF,site:LIVE_POLICY.site,draft:run.source.result?.spec??emptyDraft(LIVE_POLICY.site),requiredBedrooms:3,requiredBaths:2,checkpoints:run.source.result?.checkpoints??[]});
  return {text:JSON.stringify(value.value),output:value.value,finishReason:'stop',response:{id:`offline-${stage}`},usage:{inputTokens:1000,outputTokens:200,inputTokenDetails:{cacheReadTokens:500}}};
 });
}
beforeEach(async()=>{dir=await mkdtemp(path.join(os.tmpdir(),'studio-security-'));store=new StudioStore(dir);http=privateHandlers(store,new PrivateStudioService(store));cookie='';csrf='';vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','');generateText.mockReset();});
afterEach(async()=>{vi.unstubAllEnvs();await rm(dir,{recursive:true,force:true});});
describe('private live admission and durable execution (all provider calls mocked)',()=>{
 it('recognizes spacious bedrooms and confines a single approval to the selected project',async()=>{
  const brief='A single-storey villa with three spacious bedrooms and two bathrooms on flat land with a pool.';
  expect(promptRequirements(brief)).toEqual({bedrooms:3,bathrooms:2,storeys:1,pool:'required'});
  expect(()=>promptRequirements('three spacious bedrooms or four bedrooms')).toThrow('Conflicting');
  await login();const selected=await project(),other=await project();
  await approvePrivateRun(store,brief,selected);
  expect((await http.POST(request({action:'start',projectId:other,brief}))).status).toBe(403);
  expect((await http.POST(request({action:'start',projectId:selected,brief}))).status).toBe(200);
  expect((await http.POST(request({action:'start',projectId:other,brief}))).status).toBe(403);
  expect(generateText).not.toHaveBeenCalled();
 });
 it('requires a local setup secret, verifies passwords, revokes old sessions and rejects forged headers',async()=>{
  await http.GET(new Request(url));
  expect((await http.POST(request({action:'login',password,setupCode:'wrong'}))).status).toBe(401);
  expect((await http.POST(request({action:'project',name:'spoof'},{'x-admin-email':'dylandevaux3@gmail.com'}))).status).toBe(401);
  await login();const oldCookie=cookie;
  const r=await http.POST(request({action:'login',password}));cookie=r.headers.get('Set-Cookie')!.split(';')[0];csrf=(await r.json()).csrf;
  expect((await http.POST(request({action:'project',name:'old'},{cookie:oldCookie}))).status).toBe(401);
  expect((await http.POST(request({action:'project',name:'csrf'},{'x-studio-csrf':'forged'}))).status).toBe(403);
  expect((await http.POST(request({action:'project',name:'origin'},{origin:'https://evil.example'}))).status).toBe(403);
  await store.transaction(s=>{for(const v of Object.values(s.sessions))v.expires=0;});
  expect((await http.POST(request({action:'project',name:'expired'}))).status).toBe(401);
  expect(generateText).not.toHaveBeenCalled();
 });
 it('locks repeated password failures, hides the backend on production and Vercel',async()=>{
  await login();for(let i=0;i<5;i++)expect((await http.POST(request({action:'login',password:'wrong-password-long-enough'}))).status).toBe(401);
  expect((await http.POST(request({action:'login',password}))).status).toBe(401);
  vi.stubEnv('NODE_ENV','production');expect((await http.GET(new Request(url))).status).toBe(404);
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','1');expect((await http.POST(request({action:'project',name:'blocked'}))).status).toBe(404);
 });
 it('denies wrong owners, missing approval, a different brief, and client-supplied limits',async()=>{
  await login();const id=await project();
  expect((await http.POST(request({action:'start',projectId:id,brief:FIRST_BRIEF}))).status).toBe(403);
  await approvePrivateRun(store,FIRST_BRIEF);
  expect((await http.POST(request({action:'start',projectId:id,brief:FIRST_BRIEF+' Add a study.'}))).status).toBe(403);
  expect((await http.POST(request({action:'start',projectId:id,brief:FIRST_BRIEF,maxCalls:100}))).status).toBe(422);
  await store.transaction(s=>{s.projects[id].owner='someone-else';});
  expect((await http.POST(request({action:'start',projectId:id,brief:FIRST_BRIEF}))).status).toBe(404);
  expect(generateText).not.toHaveBeenCalled();
 });
 it('executes the new non-sample prompt through the actual five LiveDesigner contracts and reopens after store restart',async()=>{
  await login();const runId=await start();mockStages();let last;
  expect(MOCK_BRIEFS).not.toContain(FIRST_BRIEF);
  for(let stage=1;stage<=5;stage++){const r=await advance(runId,stage);expect(r.status).toBe(200);last=await r.json();expect(last.stage).toBe(stage);expect(last.status).toBe(stage===5?'complete':'ready');}
  expect(generateText).toHaveBeenCalledTimes(5);
  expect(loadHouse(last.save).spec.blocks.every(b=>b.level===0)).toBe(true);
  const state=await store.transaction(s=>structuredClone(s));
  expect(Object.values(state.calls).every(c=>c.status==='settled'&&c.requestId&&c.providerUsage)).toBe(true);
  expect(Object.values(state.calls).reduce((sum,c)=>sum+c.costMicros!,0)).toBe(21875);
  expect((await advance(runId,5)).status).toBe(409);
  const restarted=privateHandlers(new StudioStore(dir));const r=await restarted.GET(new Request(`${url}?runId=${runId}`,{headers:{cookie}}));
  expect(r.status).toBe(200);const reopened=await r.json();expect(reopened.save).toBe(last.save);expect(reopened.costUsd).toBe(.021875);
  const other=await project();expect((await http.POST(request({action:'start',projectId:other,brief:FIRST_BRIEF}))).status).toBe(403);
 });
 it('deduplicates request keys, refuses concurrent calls and stale stage revisions',async()=>{
  await login();const runId=await start();let release!:()=>void;const wait=new Promise<void>(r=>release=r);
  generateText.mockImplementation(async()=>{await wait;return {text:'{}',output:{},usage:{inputTokens:1,outputTokens:1}};});
  const key=randomUUID(),first=advance(runId,1,key);
  while(generateText.mock.calls.length===0)await new Promise(r=>setTimeout(r,5));
  const repeat=await advance(runId,1,key);expect(repeat.status).toBe(200);expect((await repeat.json()).status).toBe('running');
  expect((await advance(runId,1)).status).toBe(409);
  expect((await advance(runId,2,key)).status).toBe(409);
  release();expect((await first).status).toBe(200);expect(generateText).toHaveBeenCalledTimes(1);
 });
 it('retains checkpoints and failed-call usage, and never retries a rejected stage',async()=>{
  await login();const runId=await start();mockStages();for(let i=1;i<=3;i++)await advance(runId,i);
  const before=await store.transaction(s=>JSON.stringify(s.runs[runId].source.result?.scene));
  generateText.mockRejectedValue({message:'provider failure',usage:{inputTokens:1000,outputTokens:100},finishReason:'length'});
  const out=await (await advance(runId,4)).json();expect(out.status).toBe('failed');expect(out.stage).toBe(3);expect(JSON.stringify(out.scene)).toBe(before);
  const calls=await store.transaction(s=>Object.values(s.calls));expect(calls[3].usage?.costUsd).toBeGreaterThan(0);expect(calls[3].status).toBe('settled');
  expect((await advance(runId,4)).status).toBe(409);expect(generateText).toHaveBeenCalledTimes(4);
 });
 it('holds unknown usage and blocks subsequent spending',async()=>{
  await login();const runId=await start();generateText.mockRejectedValue(Error('timeout/no usage'));
  const r=await (await advance(runId,1)).json();expect(r.status).toBe('uncertain');expect(r.costUsd).toBe(0);
  // Held at this call's measured upper bound (below the old fixed 65,536-token bound), never released on uncertainty.
  const held=await store.transaction(s=>Object.values(s.calls)[0]);expect(held.status).toBe('unknown');expect(r.heldUsd).toBe(reservationMicros(LIVE_POLICY,held.wireBound!,1)/1e6);expect(held.reservation).toBeLessThan(RESERVATION_MICROS);
  expect((await advance(runId,1)).status).toBe(409);expect(generateText).toHaveBeenCalledTimes(1);
 });
 it('enforces cumulative dollar and call reservations, including after restart',async()=>{
  await login();const runId=await start();
  await store.transaction(s=>{const run=s.runs[runId];for(let i=0;i<4;i++){const id=randomUUID();s.calls[id]={id,runId,stage:1,key:randomUUID(),status:'settled',costMicros:350000,reservation:350000,createdAt:Date.now()};run.callIds.push(id);}});
  // US$1.40 spent: the next call's defensible upper bound cannot fit, so admission refuses before any dispatch.
  const refused=await (await advance(runId,1)).json();expect(refused.status).toBe('failed');expect(refused.error).toContain('upper bound');expect(generateText).not.toHaveBeenCalled();
  await store.transaction(s=>{const run=s.runs[runId];run.state='ready';delete run.source.result;delete run.executionError;run.callIds.push(randomUUID());const id=run.callIds.at(-1)!;s.calls[id]={id,runId,stage:1,key:randomUUID(),status:'settled',costMicros:0,reservation:0,createdAt:Date.now()};for(const c of Object.values(s.calls))c.costMicros=0;});
  // Five recorded design calls exhaust the call allowance even with zero cost; a restarted server enforces it too.
  const restarted=privateHandlers(new StudioStore(dir));const after=await (await restarted.POST(request({action:'advance',runId,stage:1,key:randomUUID()}))).json();
  expect(after.status).toBe('failed');expect(after.error).toContain('call limit');expect(generateText).not.toHaveBeenCalled();
 });
 it('refuses unsupported requests and a mismatched approval policy before calling a model',async()=>{
  await login();const id=await project();expect((await http.POST(request({action:'start',projectId:id,brief:'A three-bedroom hillside house'}))).status).toBe(422);
  const runId=await start();await store.transaction(s=>{s.runs[runId].policyHash='changed';});
  expect((await advance(runId,1)).status).toBe(409);expect(generateText).not.toHaveBeenCalled();
  expect(POLICY_HASH).toHaveLength(64);
 });
});

it('accepts independent model decisions for the identical prompt instead of selecting a house by brief',async()=>{
 await login();let variant=0;
 generateText.mockImplementation(async options=>({text:'{}',output:options.system.includes('STAGE 1 - ARCHITECT')?{name:`Independent model identity ${++variant}`,concept:'Different mass hierarchy chosen by model',hierarchy:['Courtyard','Living wing'],roofLanguage:'Pitched roofs',entrance:'North',outdoorLiving:'Veranda',landscape:'Garden',palette:{walls:'ivory',accent:'timber',roof:'timber',deck:'limestone'}}:{blocks:[{id:'model-house',role:'Model-chosen primary mass',cx:variant,cz:0,w:variant===1?18:20,d:12,level:0}]},finishReason:'stop',usage:{inputTokens:100,outputTokens:100}}));
 const first=await start();const a=await (await advance(first,1)).json();const massA=await (await advance(first,2)).json();
 const second=await start();const b=await (await advance(second,1)).json();const massB=await (await advance(second,2)).json();
 expect(a.direction.name).not.toBe(b.direction.name);
 expect(massA.stage).toBe(2);expect(massB.stage).toBe(2);expect(massA.scene.elements).not.toEqual(massB.scene.elements);
 expect(generateText).toHaveBeenCalledTimes(4);
});

it('keeps an interrupted reservation across store restart and refuses another dispatch',async()=>{
 await login();const runId=await start();
 await store.transaction(s=>{s.runs[runId].state='running';const id=randomUUID();s.runs[runId].callIds.push(id);s.calls[id]={id,runId,stage:1,key:randomUUID(),reservation:RESERVATION_MICROS,status:'reserved',createdAt:Date.now()};});
 const restarted=privateHandlers(new StudioStore(dir));
 const read=await restarted.GET(new Request(`${url}?runId=${runId}`,{headers:{cookie}}));expect((await read.json()).heldUsd).toBe(RESERVATION_MICROS/1e6);
 expect((await restarted.POST(request({action:'advance',runId,stage:1,key:randomUUID()}))).status).toBe(409);expect(generateText).not.toHaveBeenCalled();
});

it('fails closed on corrupted persistence without treating it as an empty allowance',async()=>{
 await login();const {writeFile}=await import('node:fs/promises');await writeFile(path.join(dir,'state.json'),'corrupt');
 expect((await http.POST(request({action:'project',name:'blocked'}))).status).toBe(503);expect(generateText).not.toHaveBeenCalled();
});

it('admits the exact approved Mediterranean prompt without dispatching and rejects positive unsupported requirements before consuming approval',async()=>{
 const {preflightBrief}=await import('./preflight');
 const receipt=JSON.parse(await readFile('docs/architecture/automatic-house/live-readiness/approval-record.json','utf8'));
 expect(preflightBrief(receipt.brief)).toBeUndefined();
 await login();const projectId=await project();await recordWorkerHeartbeat(dir);await approvePrivateRun(store,receipt.brief,projectId);
 const response=await http.POST(request({action:'start',projectId,brief:receipt.brief,automatic:true}));
 expect(response.status).toBe(200);expect((await response.json()).status).toBe('ready');expect(generateText).not.toHaveBeenCalled();
 for(const requirement of ['Add a basement.','Use a hillside site.','Use curved walls.','Make it three-storey.','No swimming pool.','Without a pool.','No basement, but add curved walls.']){
  const brief=`A single-storey house with three bedrooms and a pool. ${requirement}`;
  expect(preflightBrief(brief),requirement).toMatch(/Unsupported|Conflicting/);
  const id=await project();await approvePrivateRun(store,brief,id);
  const before=await store.transaction(s=>JSON.stringify({approvals:s.approvals,runs:s.runs,calls:s.calls}));
  expect((await http.POST(request({action:'start',projectId:id,brief,automatic:true}))).status,requirement).toBe(422);
  expect(await store.transaction(s=>JSON.stringify({approvals:s.approvals,runs:s.runs,calls:s.calls}))).toBe(before);
  // Remove only this isolated test authorization so the next controlled case can be exercised.
  await store.transaction(s=>{s.approvals=s.approvals.filter(a=>a.projectId!==id);});
 }
 expect(generateText).not.toHaveBeenCalled();
});
