/* eslint-disable @typescript-eslint/no-explicit-any -- deliberate malformed provider fixtures */
/** Bounded corrections and per-call reservations through the real service, SDK wire, ledger and pipeline.
 * OFFLINE: provider responses are developer-authored doubles; the correction policy exists only in this test. */
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
import {recordWorkerHeartbeat} from './workerHealth';
import {StudioStore} from './store';
import {PrivateStudioService} from './service';
import {privateHandlers} from './http';
import {approvePrivateRun} from './approval';
import {LIVE_POLICY,NO_CORRECTION_POLICY,reservationMicros,type StudioPolicy} from './policy';
import {PromptMockDesigner,MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
import {emptyDraft,type StageNo} from '@/lib/villa/staged/pipeline';
import {loadHouse} from '@/lib/villa/staged/save';
import {featureAudit} from '@/lib/villa/staged/featureAudit';
import {LiveDesigner} from '@/lib/villa/staged/liveDesigner';
const dirs:string[]=[];
afterEach(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});

type Answer=(stage:StageNo,value:unknown,correction:boolean)=>unknown|{raw:string;usage?:false};
async function setup(policy:StudioPolicy,answer:Answer,brief:string=MOCK_BRIEFS[0],sample:string=MOCK_BRIEFS[0]){
 vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','');vi.stubEnv('OPENAI_API_KEY','offline-placeholder');
 const directory=await mkdtemp(path.join(os.tmpdir(),'studio-corrections-'));dirs.push(directory);
 const store=new StudioStore(directory),service=new PrivateStudioService(store,undefined,policy),http=privateHandlers(store,service);
 const url='http://localhost:3015/api/private-studio';let cookie='',csrf='';
 const post=(body:unknown)=>http.POST(new Request(url,{method:'POST',headers:{origin:'http://localhost:3015',cookie,'x-studio-csrf':csrf},body:JSON.stringify(body)}));
 await http.GET(new Request(url));
 const r=await post({action:'login',password:'offline-correction-password',setupCode:await readFile(path.join(directory,'setup-code'),'utf8')});
 cookie=r.headers.get('set-cookie')!.split(';')[0];csrf=(await r.json()).csrf;
 const projectId=(await (await post({action:'project',name:'Offline corrections'})).json()).projectId;
 await recordWorkerHeartbeat(directory);await approvePrivateRun(store,brief,projectId,policy);
 const started=await post({action:'start',projectId,brief,automatic:true});expect(started.status).toBe(200);
 const runId=(await started.json()).runId;
 const designer=new PromptMockDesigner(sample),requests:{stage:StageNo;correction:boolean;input:string;bytes:number}[]=[];
 const transport=vi.fn<typeof fetch>(async(_url,init)=>{
  const wire=JSON.parse(String(init?.body)),input=JSON.stringify(wire.input),correction=input.includes('CORRECTION REQUEST');
  const source=await store.transaction(s=>structuredClone(s.runs[runId].source));
  const stage=((source.result?.lastGood?.stage??0)+1) as StageNo;
  requests.push({stage,correction,input,bytes:Buffer.byteLength(String(init?.body))});
  const value=(await designer.design(stage,{brief,site:policy.site,draft:source.result?.spec??emptyDraft(policy.site),requiredBedrooms:0,requiredBaths:0,checkpoints:source.result?.checkpoints??[]})).value;
  const out=answer(stage,value,correction) as any,text=out&&typeof out==='object'&&'raw' in out?out.raw:JSON.stringify(out);
  const usage=out&&typeof out==='object'&&out.usage===false?{}:{usage:{input_tokens:1000,output_tokens:200,total_tokens:1200}};
  return new Response(JSON.stringify({id:`offline-${requests.length}`,object:'response',created_at:0,model:policy.model,status:'completed',output:[{type:'message',id:`m-${requests.length}`,role:'assistant',content:[{type:'output_text',text,annotations:[]}]}],...usage}),{headers:{'content-type':'application/json'}});
 });
 vi.stubGlobal('fetch',transport);
 const read=()=>http.GET(new Request(`${url}?runId=${runId}`,{headers:{cookie}})).then(r=>r.json());
 const ledger=()=>store.transaction(s=>s.runs[runId].callIds.map(id=>s.calls[id]));
 const runAll=async()=>{for(let i=0;i<6;i++){await service.tick();const o=await read();if(o.status!=='ready')return o;}return read();};
 return {store,service,read,ledger,runAll,requests,transport,runId,brief};
}
/** A genuine but repairable programme contradiction: a second foyer (exactly one main entrance room is required). */
const badProgramme=(v:any)=>({...v,rooms:v.rooms.map((r:any)=>r.id==='wing-hall'?{...r,type:'foyer'}:r)});

it('repairs one specific Stage 3 failure with exactly one reserved correction carrying the original answer and errors',async()=>{
 const env=await setup(LIVE_POLICY,(stage,v,correction)=>stage===3&&!correction?badProgramme(v):v);
 const out=await env.runAll();expect(out.status,JSON.stringify(out.findings)).toBe('complete');
 const calls=await env.ledger();
 expect(calls.map(c=>`${c.stage}:${c.purpose}`)).toEqual(['1:design','2:design','3:design','3:correction','4:design','5:design']);
 const correction=env.requests.find(r=>r.correction)!;
 expect(correction.stage).toBe(3);
 const rejected=calls[2].raw!;expect(correction.input).toContain(JSON.stringify(JSON.parse(rejected)).replaceAll('"','\\"'));
 expect(correction.input).toMatch(/foyer-count/);
 // Every call was admitted and reserved individually at its own measured bound, then settled.
 for(const [i,c] of calls.entries()){expect(c.status).toBe('settled');expect(c.reservation).toBe(reservationMicros(LIVE_POLICY,c.wireBound!,c.stage as StageNo));expect(env.requests[i].bytes).toBeLessThanOrEqual(c.wireBound!);}
 const cp=(await env.store.transaction(s=>s.runs[env.runId].source.result!.checkpoints)).find(c=>c.stage===3)!;
 expect(cp.accepted).toBe(true);expect(cp.attempt).toBe(1);expect(cp.calls.map(c=>c.purpose)).toEqual(['design','correction']);
 const saved=loadHouse(out.save);expect(featureAudit(saved.spec,saved.scene,saved.components,5,env.brief).findings).toEqual([]);
 await env.service.tick();expect(env.transport).toHaveBeenCalledTimes(6);
});

it('stops after a failed correction, preserving the last accepted checkpoint and making no further call',async()=>{
 const env=await setup(LIVE_POLICY,(stage,v)=>stage===3?badProgramme(v):v);
 const out=await env.runAll();expect(out.status).toBe('failed');expect(out.failedStage).toBe(3);expect(out.stage).toBe(2);
 expect((await env.ledger()).map(c=>`${c.stage}:${c.purpose}`)).toEqual(['1:design','2:design','3:design','3:correction']);
 await env.service.tick();expect(env.transport).toHaveBeenCalledTimes(4);
});

it('makes no correction under a zero-correction policy',async()=>{
 expect(NO_CORRECTION_POLICY.maxCorrectionCalls).toBe(0);
 const env=await setup(NO_CORRECTION_POLICY,(stage,v)=>stage===3?badProgramme(v):v);
 const out=await env.runAll();expect(out.status).toBe('failed');expect(out.stage).toBe(2);
 expect(env.requests.some(r=>r.correction)).toBe(false);expect(env.transport).toHaveBeenCalledTimes(3);
});

it('never corrects a software construction fault',async()=>{
 const env=await setup(LIVE_POLICY,(stage,v:any)=>stage===2?{...v,blocks:[...v.blocks,{id:'detached',role:'Veranda',cx:24,cz:-18,w:4,d:4,level:0,open:true,height:'standard',rank:'secondary'}]}:v);
 const out=await env.runAll();expect(out.status).toBe('failed');expect(out.findings.some((f:any)=>f.code==='construction-error')).toBe(true);
 expect(env.requests.some(r=>r.correction)).toBe(false);expect(env.transport).toHaveBeenCalledTimes(2);
});

it('corrects a completed answer that failed only its strict schema (invalid enum)',async()=>{
 const env=await setup(LIVE_POLICY,(stage,v:any,correction)=>stage===4&&!correction?{...v,roofFinish:'gold-leaf'}:v);
 const out=await env.runAll();expect(out.status,JSON.stringify(out.findings)).toBe('complete');
 const c=env.requests.find(r=>r.correction)!;expect(c.stage).toBe(4);expect(c.input).toContain('gold-leaf');expect(c.input).toContain('roofFinish');
});

it('never corrects after an answer whose usage is missing; spending stays held',async()=>{
 const env=await setup(LIVE_POLICY,(stage,v)=>stage===3?{raw:JSON.stringify(badProgramme(v)),usage:false}:v);
 const out=await env.runAll();expect(out.status).toBe('uncertain');expect(out.heldUsd).toBeGreaterThan(0);
 expect(env.requests.some(r=>r.correction)).toBe(false);
 await env.service.tick();expect(env.transport).toHaveBeenCalledTimes(3);
});

it('refuses a correction whose upper bound exceeds the remaining approved budget, before dispatch',async()=>{
 const env=await setup(LIVE_POLICY,(stage,v)=>stage===3?badProgramme(v):v);
 await env.service.tick();await env.service.tick();
 // Leave room for exactly the Stage 3 design call's upper bound, so the larger correction cannot be admitted.
 const run=await env.store.transaction(s=>structuredClone(s.runs[env.runId].source));
 const bound=new LiveDesigner().wireBytes(3,{brief:env.brief,site:LIVE_POLICY.site,draft:run.result!.spec!,checkpoints:run.result!.checkpoints,requiredBedrooms:3,requiredBaths:2});
 await env.store.transaction(s=>{const r=s.runs[env.runId],spent=r.callIds.reduce((a,id)=>a+s.calls[id].costMicros!,0);s.calls[r.callIds[0]].costMicros!+=LIVE_POLICY.maxCostMicros-spent-reservationMicros(LIVE_POLICY,bound,3);});
 const out=await env.runAll();expect(out.status).toBe('failed');expect(out.error).toContain('upper bound');
 expect(env.requests.filter(r=>r.stage===3).map(r=>r.correction)).toEqual([false]);
 const calls=await env.ledger();expect(calls.reduce((a,c)=>a+(c.costMicros??0),0)).toBeLessThanOrEqual(LIVE_POLICY.maxCostMicros);
});

it('builds a house without a pool when the brief excludes one, and refuses a pool it excludes',async()=>{
 const brief='Design a compact single-storey Caribbean home with three bedrooms and two bathrooms on completely flat land, with a covered veranda and palms, but no swimming pool.';
 const noPool=(stage:StageNo,v:any)=>stage===2?{...v,blocks:v.blocks.filter((b:any)=>b.id!=='pool-reservation')}:stage===5?{...v,pool:{...v.pool,scale:'none',anchor:'veranda'}}:v;
 const env=await setup(LIVE_POLICY,noPool,brief);
 const out=await env.runAll();expect(out.status,JSON.stringify(out.findings)).toBe('complete');
 const h=loadHouse(out.save);expect(h.spec.siteWork.pool).toBeUndefined();expect(h.scene.elements.some(e=>e.kind==='water')).toBe(false);
 expect(env.requests.find(r=>r.stage===5)!.input).toContain('excluded by the brief');
 const refused=await setup(LIVE_POLICY,(stage,v:any)=>stage===5?{...noPool(stage,v),pool:{...v.pool,anchor:'veranda'}}:noPool(stage,v),brief);
 const r=await refused.runAll();expect(r.status).toBe('failed');expect(r.findings.some((f:any)=>f.code==='pool-excluded')).toBe(true);
});
