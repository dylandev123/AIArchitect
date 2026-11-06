/** Stage 5-only continuation of the real live v3 run (OFFLINE: provider SDK mocked; no network). */
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const {generateText}=vi.hoisted(()=>({generateText:vi.fn()}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText}));
vi.mock('@/lib/ai/model',()=>({getAiModelId:()=> 'gpt-5.6-terra',getAiModel:()=> 'offline-SDK-double'}));
import {recordWorkerHeartbeat} from './workerHealth';
import {StudioStore} from './store';
import {privateHandlers} from './http';
import {PrivateStudioService} from './service';
import {approvePrivateRun} from './approval';
import {prepareStage5Continuation} from './continuation';
import {LIVE_POLICY,STAGE5_CONTINUATION_POLICY,reservationMicros} from './policy';
import {loadHouse} from '@/lib/villa/staged/save';
import {featureAudit} from '@/lib/villa/staged/featureAudit';

const e=JSON.parse(readFileSync('docs/architecture/automatic-house/live-v3/evidence.json','utf8'));
const SOURCE=e.run.id as string,brief=e.run.source.input.brief as string,url='http://localhost:3015/api/private-studio',password='offline-test-password-only';
const terra5=JSON.parse(e.calls.find((c:{stage:number})=>c.stage===5).raw);
let dir:string,store:StudioStore,service:PrivateStudioService,http:ReturnType<typeof privateHandlers>,cookie='',csrf='';
const request=(body:unknown)=>new Request(url,{method:'POST',headers:{origin:'http://localhost:3015','Content-Type':'application/json',cookie,'x-studio-csrf':csrf},body:JSON.stringify(body)});
const snapshot=()=>store.transaction(s=>JSON.stringify({run:s.runs[SOURCE],calls:e.calls.map((c:{id:string})=>s.calls[c.id]),approval:s.approvals.find(a=>a.consumedBy===SOURCE),project:s.projects[e.run.projectId]}));
/** Provider double: one answer per call, recorded; usage shaped like the real Responses API. */
const answer=(value:unknown)=>generateText.mockImplementation(async()=>({text:JSON.stringify(value),output:value,finishReason:'stop',response:{id:'offline-stage5'},usage:{inputTokens:2400,outputTokens:450,inputTokenDetails:{noCacheTokens:2400,cacheReadTokens:0,cacheWriteTokens:0}}}));
beforeEach(async()=>{
 dir=await mkdtemp(path.join(os.tmpdir(),'studio-continuation-'));store=new StudioStore(dir);service=new PrivateStudioService(store);http=privateHandlers(store,service);vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','');generateText.mockReset();
 await http.GET(new Request(url));const setupCode=await readFile(path.join(dir,'setup-code'),'utf8');
 const r=await http.POST(request({action:'login',password,setupCode}));cookie=r.headers.get('Set-Cookie')!.split(';')[0];csrf=(await r.json()).csrf;
 // The real live v3 run, its six ledger records and its consumed approval, as persisted.
 await store.transaction(s=>{const owner=s.account!.owner;s.projects[e.run.projectId]={owner,name:'Mediterranean Garden House — Live v3',runId:SOURCE};s.runs[SOURCE]={...e.run,owner};for(const c of e.calls)s.calls[c.id]=c;s.approvals.push({id:randomUUID(),owner,projectId:e.run.projectId,briefHash:'recorded',policyHash:e.run.policyHash,approvedAt:'2026-11-06T17:00:00.000Z',consumedBy:SOURCE});});
 await recordWorkerHeartbeat(dir);
});
afterEach(async()=>{vi.unstubAllEnvs();await rm(dir,{recursive:true,force:true});});
const prepare=async()=>{const projectId=randomUUID();await prepareStage5Continuation(store,SOURCE,'Live v3 · Stage 5 continuation',projectId);return projectId;};

it('completes the house with exactly one new Stage 5 call, reusing Stages 1–4 verbatim and leaving the source run untouched',async()=>{
 const before=await snapshot(),projectId=await prepare();
 await approvePrivateRun(store,brief,projectId,STAGE5_CONTINUATION_POLICY);
 const listed=await (await http.GET(new Request(url,{headers:{cookie}}))).json();
 expect(listed.availableApprovals).toHaveLength(1);expect(listed.projects.find((p:{id:string})=>p.id===projectId).continuesFrom.runId).toBe(SOURCE);
 answer({...terra5,pool:{...terra5.pool,scale:'intimate'}}); // test double for a NEW Terra answer
 const started=await http.POST(request({action:'start',projectId,brief,automatic:true}));expect(started.status).toBe(200);
 const runId=(await started.json()).runId;
 await service.tick();
 expect(generateText).toHaveBeenCalledTimes(1);
 const options=generateText.mock.calls[0][0];
 expect(options.maxOutputTokens).toBe(4000);expect(options.maxRetries).toBe(0);
 expect(options.prompt).toContain('"pool-intention (pool intention pool-garden-reservation, garden side s)":{"plunge":"fits","intimate":"fits","generous":"fits","lap":"fits","resort":"fits"}'); // Phase 2 resort scale
 const s=await store.transaction(x=>structuredClone(x)),run=s.runs[runId];
 expect(run.state).toBe('complete');expect(run.continuesFrom?.runId).toBe(SOURCE);expect(run.callIds).toHaveLength(1);
 const call=s.calls[run.callIds[0]];
 expect(call.stage).toBe(5);expect(call.status).toBe('settled');expect(call.reservation).toBeLessThanOrEqual(STAGE5_CONTINUATION_POLICY.maxCostMicros);
 expect(call.reservation).toBe(reservationMicros(STAGE5_CONTINUATION_POLICY,call.wireBound!,5));
 // Stages 1–4 of the continuation are byte-identical to the source run's accepted checkpoints.
 const src=e.run.source.result.checkpoints.filter((c:{accepted:boolean})=>c.accepted);
 expect(JSON.stringify(run.source.result!.checkpoints.slice(0,4))).toBe(JSON.stringify(src));
 const h=loadHouse(s.projects[projectId].save!);
 expect(h.spec.blocks).toEqual(src[3].spec.blocks);expect(h.spec.exterior).toEqual(src[3].spec.exterior);
 expect(featureAudit(h.spec,h.scene,h.components,5,brief).findings).toEqual([]);
 expect(loadHouse(s.projects[projectId].save!).spec).toEqual(h.spec);
 expect(await snapshot()).toBe(before);
});

it('never corrects or retries: a rejected Stage 5 answer stops after its single call, source untouched',async()=>{
 const before=await snapshot(),projectId=await prepare();
 await approvePrivateRun(store,brief,projectId,STAGE5_CONTINUATION_POLICY);answer(terra5); // pool none
 const runId=(await (await http.POST(request({action:'start',projectId,brief,automatic:true}))).json()).runId;
 await service.tick();await service.tick();
 expect(generateText).toHaveBeenCalledTimes(1);
 const s=await store.transaction(x=>structuredClone(x));
 expect(s.runs[runId].state).toBe('failed');expect(s.runs[runId].callIds).toHaveLength(1);
 expect(await snapshot()).toBe(before);
});

it('requires its own project-bound continuation approval and the exact description; zero calls otherwise',async()=>{
 const projectId=await prepare();
 expect((await http.POST(request({action:'start',projectId,brief}))).status).toBe(403); // no approval
 await approvePrivateRun(store,brief,projectId); // an ordinary live-policy approval does not authorize a continuation
 expect((await http.POST(request({action:'start',projectId,brief}))).status).toBe(403);
 await store.transaction(s=>{s.approvals=s.approvals.filter(a=>a.consumedBy);});
 await approvePrivateRun(store,brief+' Slightly different.',projectId,STAGE5_CONTINUATION_POLICY);
 expect((await http.POST(request({action:'start',projectId,brief:brief+' Slightly different.'}))).status).toBe(403);
 expect(generateText).not.toHaveBeenCalled();
});

it('refuses to start when the source checkpoints changed after preparation, or the source is not a stopped Stage 5 run',async()=>{
 const projectId=await prepare();await approvePrivateRun(store,brief,projectId,STAGE5_CONTINUATION_POLICY);
 await store.transaction(s=>{s.runs[SOURCE].source.result!.checkpoints[3].spec.blocks[0].w+=1;});
 expect((await http.POST(request({action:'start',projectId,brief}))).status).toBe(409);
 await store.transaction(s=>{s.runs[SOURCE].state='complete';});
 await expect(prepareStage5Continuation(store,SOURCE,'again',randomUUID())).rejects.toThrow(/stopped/);
 expect(generateText).not.toHaveBeenCalled();
});

it('makes no call while any earlier call has an uncertain outcome',async()=>{
 const projectId=await prepare();await approvePrivateRun(store,brief,projectId,STAGE5_CONTINUATION_POLICY);answer(terra5);
 // Uncertain call in the source run: the continuation cannot even start.
 await store.transaction(s=>{s.calls[e.calls[0].id].status='unknown';});
 expect((await http.POST(request({action:'start',projectId,brief,automatic:true}))).status).toBe(409);
 // Uncertain call in an unrelated run: the continuation starts but the worker refuses to dispatch.
 await store.transaction(s=>{s.calls[e.calls[0].id].status='settled';const owner=s.account!.owner,other=randomUUID();s.projects[randomUUID()]={owner,name:'other',runId:other};s.runs[other]={...structuredClone(e.run),id:other,owner,state:'failed',callIds:['uncertain-call']};s.calls['uncertain-call']={...structuredClone(e.calls[0]),id:'uncertain-call',runId:other,status:'unknown'};});
 const runId=(await (await http.POST(request({action:'start',projectId,brief,automatic:true}))).json()).runId;
 await service.tick();
 expect(generateText).not.toHaveBeenCalled();
 expect(await store.transaction(s=>s.runs[runId].state)).toBe('failed');
});

it('has a hard limit covering the real request and no correction allowance',()=>{
 expect(STAGE5_CONTINUATION_POLICY).toMatchObject({maxCalls:1,maxCorrectionCalls:0,maxCostMicros:100000,maxWireBytes:16000,continuationStage:5,model:LIVE_POLICY.model,timeoutMs:170000});
 expect(reservationMicros(STAGE5_CONTINUATION_POLICY,14374,5)).toBe(98495);
 expect(reservationMicros(STAGE5_CONTINUATION_POLICY,STAGE5_CONTINUATION_POLICY.maxWireBytes,5)).toBeGreaterThan(STAGE5_CONTINUATION_POLICY.maxCostMicros); // above 14.9 KB the call is refused unsent
});
