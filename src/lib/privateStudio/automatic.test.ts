/* eslint-disable @typescript-eslint/no-explicit-any -- deliberate malformed provider fixtures */
/** Automatic service + actual SDK + intercepted transport. No network or real approvals. */
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
import {startStudioWorker} from './worker';
import {workerHealth,recordWorkerHeartbeat} from './workerHealth';
import {StudioStore} from './store';
import {PrivateStudioService} from './service';
import {privateHandlers} from './http';
import {approvePrivateRun} from './approval';
import {LIVE_POLICY,RESERVATION_MICROS,reservationMicros} from './policy';
import {PromptMockDesigner,MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
import {emptyDraft,type StageNo} from '@/lib/villa/staged/pipeline';
import {loadHouse} from '@/lib/villa/staged/save';
import {retainedMassingDownstreamV2} from '@/lib/villa/staged/normalization.fixture';
import {allRooms} from '@/lib/villa/staged/layout';
import {strictSchemaIssues} from '@/lib/villa/staged/strictSchema';
const dirs:string[]=[];
afterEach(async()=>{
 if(process.env.OFFLINE_EVIDENCE_DIR){
  await mkdir(process.env.OFFLINE_EVIDENCE_DIR,{recursive:true});
  for(const [index,dir] of dirs.entries()){const s=JSON.parse(await readFile(path.join(dir,'state.json'),'utf8'));
   const name=expect.getState().currentTestName!.replace(/[^a-z0-9]+/gi,'-').slice(0,160);
   await writeFile(path.join(process.env.OFFLINE_EVIDENCE_DIR,`${name}-${index+1}.json`),JSON.stringify({provenance:'OFFLINE synthetic provider responses; real Studio service, SDK wire and compiler; no paid calls',runs:s.runs,calls:s.calls,projects:s.projects}));
  }
 }
 vi.unstubAllGlobals();vi.unstubAllEnvs();await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
async function setup(brief=MOCK_BRIEFS[0] as string){
 vi.stubEnv('NODE_ENV','test');vi.stubEnv('VERCEL','');vi.stubEnv('OPENAI_API_KEY','offline-placeholder');
 const directory=await mkdtemp(path.join(os.tmpdir(),'studio-auto-'));dirs.push(directory);
 const store=new StudioStore(directory),service=new PrivateStudioService(store),http=privateHandlers(store,service);
 const url='http://localhost:3015/api/private-studio';let cookie='',csrf='';
 const post=(body:unknown)=>http.POST(new Request(url,{method:'POST',headers:{origin:'http://localhost:3015',cookie,'x-studio-csrf':csrf},body:JSON.stringify(body)}));
 await http.GET(new Request(url));
 const r=await post({action:'login',password:'offline-automatic-password',setupCode:await readFile(path.join(directory,'setup-code'),'utf8')});
 cookie=r.headers.get('set-cookie')!.split(';')[0];csrf=(await r.json()).csrf;
 const projectId=(await (await post({action:'project',name:'Offline automation'})).json()).projectId;
 await recordWorkerHeartbeat(directory);
 await approvePrivateRun(store,brief,projectId);
 const runId=(await (await post({action:'start',projectId,brief,automatic:true})).json()).runId;
 const read=()=>http.GET(new Request(`${url}?runId=${runId}`,{headers:{cookie}})).then(r=>r.json());
 return {store,service,http,post,read,runId,projectId,directory,brief};
}
function transportFor(env:Awaited<ReturnType<typeof setup>>,sample:string,mutate?:(stage:number,value:unknown)=>unknown){
 const designer=new PromptMockDesigner(sample);let n=0;
 const transport=vi.fn<typeof fetch>(async(url,init)=>{
  expect(String(url)).toBe('https://api.openai.com/v1/responses');
  const wire=JSON.parse(String(init?.body));expect(wire.model).toBe(LIVE_POLICY.model);
  expect(Buffer.byteLength(String(init?.body))).toBeLessThan(LIVE_POLICY.maxWireBytes);
  expect(JSON.stringify(wire.input)).toContain(env.brief);
  const source=await env.store.transaction(s=>{const r=s.runs[env.runId],call=s.calls[r.callIds.at(-1)!];expect(call.status).toBe('reserved');expect(call.request?.prompt).toContain(env.brief);return structuredClone(r.source);});
  // A correction repeats the current stage; only design requests advance the stage counter.
  const stage=(JSON.stringify(wire.input).includes('CORRECTION REQUEST')?n:++n) as StageNo;
  const ctx={brief:env.brief,site:LIVE_POLICY.site,draft:source.result?.spec??emptyDraft(LIVE_POLICY.site),requiredBedrooms:0,requiredBaths:0,checkpoints:source.result?.checkpoints??[]};
  const r=await designer.design(stage,ctx);
  let value=mutate?mutate(stage,r.value):r.value;
  // Stage 4/5 requests carry the measured context, never placeholders or coordinates to author.
  if(stage===4){expect(JSON.stringify(wire.input)).toContain('ROOMS (solved, authoritative)');expect(JSON.stringify(wire.input)).toContain('EXTERIOR WALLS (measured)');}
  if(stage===5)expect(JSON.stringify(wire.input)).toContain('MEASURED POOL FIT');
  expect(wire.text.format.strict).toBe(true);
  value=typeof value==='string'?value:JSON.stringify(value);
  return new Response(JSON.stringify({id:`offline-${n}`,object:'response',created_at:0,model:LIVE_POLICY.model,status:'completed',output:[{type:'message',id:`msg-${n}`,role:'assistant',content:[{type:'output_text',text:value,annotations:[]}]}],usage:{input_tokens:1000,output_tokens:200,total_tokens:1200}}),{headers:{'content-type':'application/json'}});
 });vi.stubGlobal('fetch',transport);return transport;
}
for(const [i,sample] of MOCK_BRIEFS.entries())it(`automatically builds and reopens house ${i+1} through the real SDK contracts`,async()=>{
 const env=await setup(sample),transport=transportFor(env,sample);
 for(let stage=1;stage<=5;stage++){
  // Recreate service/store each stage: durable state alone drives the next dispatch.
  await new PrivateStudioService(new StudioStore(env.directory)).tick();
  const out=await env.read();expect(out.stage,JSON.stringify(out)).toBe(stage);expect(out.status).toBe(stage===5?'complete':'ready');
  const call=await env.store.transaction(s=>s.calls[s.runs[env.runId].callIds.at(-1)!]);
  expect(call.responseBody).toBeTruthy();expect(call.httpStatus).toBe(200);expect(call.raw).toBeTruthy();expect(call.usage).toBeDefined();expect(call.finishReason).toBe('stop');expect(call.checkpoint?.accepted).toBe(true);expect(call.checkpoint?.findings).toEqual([]);
  // The schema actually sent is OpenAI strict-mode compatible (a rejected schema would waste a live call).
  expect(strictSchemaIssues(JSON.parse(call.wireRequestBody!).text.format.schema)).toEqual([]);
  // Each call is reserved at its measured upper bound, and the actual request never exceeds that bound.
  expect(Buffer.byteLength(call.wireRequestBody!)).toBeLessThanOrEqual(call.wireBound!);expect(call.reservation).toBe(reservationMicros(LIVE_POLICY,call.wireBound!,call.stage as StageNo));expect(call.reservation).toBeLessThan(RESERVATION_MICROS);
 }
 const out=await env.read(),saved=loadHouse(out.save);
 expect(allRooms(saved.spec).filter(r=>r.type==='bedroom')).toHaveLength([3,4,6][i]);
 expect(saved.scene.elements.length).toBeGreaterThan(30);
 expect(new Set(saved.scene.elements.map(e=>e.id)).size).toBe(saved.scene.elements.length);
 const checkpoints=await env.store.transaction(s=>s.runs[env.runId].source.result!.checkpoints);
 expect(checkpoints).toHaveLength(5);
 const stage3=checkpoints[2].spec;
 expect(saved.spec.blocks.map(b=>[b.id,b.plan])).toEqual(stage3.blocks.map(b=>[b.id,b.plan]));
 expect(saved.spec.links).toEqual(stage3.links);expect(saved.spec.stairs).toEqual(stage3.stairs);
 expect(await env.store.transaction(s=>s.projects[env.projectId].save)).toBe(out.save);
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(5);
});
for(const badStage of [1,2,3,4,5])it(`retains diagnostics and prior checkpoints after malformed stage ${badStage}`,async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0],(stage,v)=>stage===badStage?'malformed provider JSON':v);
 for(let i=0;i<badStage;i++)await env.service.tick();
 const out=await env.read();expect(out.status).toBe('failed');expect(out.stage).toBe(badStage-1);expect(out.failedStage).toBe(badStage);
 expect(out.checkpoints).toHaveLength(badStage-1);expect(out.failure).toBeDefined();
 const state=await env.store.transaction(s=>structuredClone(s)),call=state.calls[state.runs[env.runId].callIds.at(-1)!];
 expect(call.checkpoint?.accepted).toBe(false);expect(call.checkpoint?.failure).toBeDefined();
 expect(call.raw).toBe('malformed provider JSON');expect(call.request?.prompt).toContain(env.brief);expect(call.status).toBe('settled');
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(badStage);
});
it('rejects omitted roof design rather than retaining the flat massing placeholder',async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0],(stage,v)=>stage===4?{...v as object,roofs:[]}:v);
 for(let i=0;i<4;i++)await env.service.tick();
 const out=await env.read();expect(out.status).toBe('failed');expect(out.stage).toBe(3);
 expect(out.findings).toContainEqual(expect.objectContaining({code:'roof-missing'}));
 // One targeted correction repeats the omission; the stage then stops.
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(5);
});
it('cancels future stages and preserves an active paid result without dispatching the next stage',async()=>{
 const env=await setup();const base=transportFor(env,MOCK_BRIEFS[0]);let release!:()=>void;
 const wait=new Promise<void>(r=>release=r);
 vi.stubGlobal('fetch',async(...args:Parameters<typeof fetch>)=>{await wait;return base(...args);});
 const pending=env.service.tick();
 while(!(await env.read()).calls)await new Promise(r=>setTimeout(r,5));
 await env.post({action:'cancel',runId:env.runId});release();await pending;
 const out=await env.read();expect(out.status).toBe('cancelled');expect(out.stage).toBe(1);
 await env.service.tick();expect(base).toHaveBeenCalledTimes(1);
});
it('does not duplicate concurrent worker dispatch; stops interrupted outcomes without a retry',async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0]);
 let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 vi.stubGlobal('fetch',async(...args:Parameters<typeof fetch>)=>{await wait;return transport(...args);});
 const active=env.service.tick();
 while((await env.read()).status!=='running')await new Promise(r=>setTimeout(r,5));
 await new PrivateStudioService(new StudioStore(env.directory)).tick();release();await active;
 expect(transport).toHaveBeenCalledTimes(1);
 await env.store.transaction(s=>{const r=s.runs[env.runId];r.state='running';s.calls[r.callIds[0]].status='reserved';s.calls[r.callIds[0]].createdAt=0;});
 await env.service.tick();const out=await env.read();expect(out.status).toBe('uncertain');expect(out.heldUsd).toBeGreaterThan(0);
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(1);
});
it('leaves old stopped runs and manual ready runs untouched',async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0]);
 await env.store.transaction(s=>{s.runs[env.runId].automatic=false;});
 const before=await env.store.transaction(s=>JSON.stringify(s.runs));await env.service.tick();
 expect(await env.store.transaction(s=>JSON.stringify(s.runs))).toBe(before);expect(transport).not.toHaveBeenCalled();
});

const physicalFailures=[
 {stage:2,name:'overlapping volumes',change:(v:any)=>({...v,blocks:[...v.blocks,{...v.blocks[0],id:'overlapping'}]}),code:'block-overlap'},
 {stage:2,name:'synthetic detached veranda',change:(v:any)=>({...v,blocks:[...v.blocks,{id:'detached',role:'Veranda',cx:22,cz:0,w:4,d:4,level:0,open:true}]}),code:'construction-error'},
 {stage:3,name:'unknown room host',change:(v:any)=>({...v,rooms:v.rooms.map((r:any,i:number)=>i===0?{...r,block:'unknown'}:r)}),code:'unknown-block'},
 {stage:4,name:'missing entrance',change:(v:any)=>({...v,entrance:{...v.entrance,room:'missing'}}),code:'invalid-main-entrance'},
 {stage:4,name:'veranda intention left uncovered',change:(v:any)=>({...v,verandas:[]}),code:'veranda-missing'},
 {stage:5,name:'retained pool intention dropped',change:(v:any)=>({...v,pool:{...v.pool,scale:'none'}}),code:'pool-intention-dropped'},
];
for(const scenario of physicalFailures)it(`stops on ${scenario.name} with complete evidence after at most one targeted correction`,async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0],(stage,v)=>stage===scenario.stage?scenario.change(v):v);
 for(let i=0;i<scenario.stage;i++)await env.service.tick();
 const out=await env.read();expect(out.status,JSON.stringify(out)).toBe('failed');expect(out.stage).toBe(scenario.stage-1);
 expect(out.findings.some((f:{code:string})=>f.code===scenario.code),JSON.stringify(out.findings)).toBe(true);
 const cp=await env.store.transaction(s=>s.runs[env.runId].source.result!.checkpoints.at(-1)!);
 expect(cp.input?.brief).toBe(env.brief);expect(cp.slice).toBeDefined();expect(cp.failure?.correction).toMatchObject({authorized:false,maxCalls:0});
 if(scenario.code==='construction-error'){expect(cp.failure?.stack).toContain('separateOpenSpaces');const ledger=await env.store.transaction(s=>s.calls[s.runs[env.runId].callIds.at(-1)!]);expect(ledger.checkpoint?.failure?.stack).toContain('separateOpenSpaces');}
 // The double repeats its mistake: one correction for repairable findings, none for software construction faults.
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(scenario.stage+(scenario.code==='construction-error'?0:1));
 const purposes=await env.store.transaction(s=>s.runs[env.runId].callIds.map(id=>s.calls[id].purpose));
 expect(purposes.filter(p=>p==='correction')).toHaveLength(scenario.code==='construction-error'?0:1);
});
it('holds uncertain provider spending after a checkpoint and never redispatches it',async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0]);await env.service.tick();
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('provider timeout with no usage')));
 await env.service.tick();const out=await env.read();expect(out.status).toBe('uncertain');expect(out.stage).toBe(1);expect(out.heldUsd).toBeGreaterThan(0);
 const stopped=await env.store.transaction(s=>JSON.stringify(s.runs[env.runId].source));
 await env.service.tick();expect(await env.store.transaction(s=>JSON.stringify(s.runs[env.runId].source))).toBe(stopped);
 expect(transport).toHaveBeenCalledTimes(1);
});
it('stops automatic admission at the durable spending ceiling',async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0]);await env.service.tick();
 await env.store.transaction(s=>{s.calls[s.runs[env.runId].callIds[0]].costMicros=LIVE_POLICY.maxCostMicros;});
 await env.service.tick();const out=await env.read();expect(out.status).toBe('failed');expect(out.error).toContain('upper bound');expect(out.stage).toBe(1);
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(1);
});
it('uses different provider decisions for the identical brief through all five stages',async()=>{
 const outcomes=[];
 for(const variant of [0,1]){
  const env=await setup('A single-storey Caribbean home with three bedrooms, two bathrooms, pitched roofs, covered outdoor living and a pool.');
  transportFor(env,MOCK_BRIEFS[0],(stage,value)=>{
   const v=value as any;
   if(stage===1)return {...v,name:`Independent model decision ${variant}`,concept:env.brief};
   if(stage===2)return {...v,blocks:v.blocks.map((b:any)=>b.id==='living-pavilion'?{...b,d:10+variant,cz:-2-variant/2}:b)};
   if(stage===4)return {...v,roofFinish:variant?'warm-bronze':'terracotta',roofs:v.roofs.map((r:any)=>({...r,form:variant?'gable':'hip'}))};
   if(stage===5)return {...v,pool:{...v.pool,scale:variant?'intimate':'plunge'},planting:{...v.planting,trees:variant?'canopy':'palm'}};
   return v;
  });
  for(let i=0;i<5;i++)await env.service.tick();
  const out=await env.read();expect(out.status,JSON.stringify(out)).toBe('complete');outcomes.push(loadHouse(out.save));
 }
 expect(outcomes[0].spec.blocks[0].d).toBe(10);expect(outcomes[1].spec.blocks[0].d).toBe(11);
 expect(outcomes[0].spec.siteWork.pool!.w).toBe(6);expect(outcomes[1].spec.siteWork.pool!.w).toBe(10);
 expect(outcomes[0].spec.blocks[0].roof.form).toBe('hip');expect(outcomes[1].spec.blocks[0].roof.form).toBe('gable');
 expect(outcomes[0].scene.elements).not.toEqual(outcomes[1].scene.elements);
});

it('publishes validating only after durable response evidence and keeps calls reserved against duplicates',async()=>{
 const env=await setup(),designer=new PromptMockDesigner(MOCK_BRIEFS[0]);
 let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 const service=new PrivateStudioService(env.store,observe=>({label:'Offline validation boundary',design:async(stage,ctx)=>{
  const result=await designer.design(stage,ctx);
  await observe({raw:JSON.stringify(result.value),request:{system:'offline',prompt:ctx.brief},usage:result.usage,finishReason:'stop'});
  await wait;return result;
 },correct:async()=>{throw Error('No corrections authorized');}}));
 const active=service.tick();
 while((await env.read()).status!=='validating')await new Promise(r=>setTimeout(r,5));
 const ledger=await env.store.transaction(s=>s.calls[s.runs[env.runId].callIds.at(-1)!]);
 expect(ledger.raw).toBeTruthy();expect(ledger.finishReason).toBe('stop');expect(ledger.usage).toBeDefined();expect(ledger.checkpoint).toBeUndefined();
 await service.tick();expect((await env.read()).calls).toBe(1);
 await env.post({action:'cancel',runId:env.runId});release();await active;
 expect((await env.read()).status).toBe('cancelled');expect((await env.read()).stage).toBe(1);
});

it('retains an invalid provider wire response before SDK parsing can reject it',async()=>{
 const env=await setup(),raw='{"unexpected":"invalid provider envelope","usage":{"input_tokens":1000,"output_tokens":200}}';
 const transport=vi.fn<typeof fetch>(async()=>new Response(raw,{headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',transport);
 await env.service.tick();const out=await env.read();expect(out.status).toBe('uncertain');expect(out.stage).toBe(0);
 const call=await env.store.transaction(s=>s.calls[s.runs[env.runId].callIds[0]]);
 expect(call.responseBody).toBe(raw);expect(call.wireRequestBody).toContain(env.brief);expect(call.httpStatus).toBe(200);expect(call.checkpoint?.accepted).toBe(false);
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(1);
});
it('holds an already queued job without changing its approval, run or call ledger',async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0]);
 const before=await env.store.transaction(s=>JSON.stringify(s));
 await writeFile(path.join(env.directory,'generation-hold.json'),'Investigation hold');
 await env.service.tick();const out=await env.read();expect(out.status).toBe('ready');expect(out.worker.held).toBe(true);expect(out.calls).toBe(0);
 expect(await env.store.transaction(s=>JSON.stringify(s))).toBe(before);expect(transport).not.toHaveBeenCalled();
});
it('rejects automatic start before consuming approval when the worker is missing or held',async()=>{
 const env=await setup();
 await env.store.transaction(s=>{delete s.runs[env.runId];delete s.projects[env.projectId].runId;delete s.approvals[0].consumedBy;});
 await rm(path.join(env.directory,'worker-heartbeat.json'));
 const before=await env.store.transaction(s=>JSON.stringify(s));
 const r=await env.post({action:'start',projectId:env.projectId,brief:env.brief,automatic:true});expect(r.status).toBe(409);expect((await r.json()).error).toContain('worker unavailable');
 await recordWorkerHeartbeat(env.directory);await writeFile(path.join(env.directory,'generation-hold.json'),'hold');
 expect((await env.post({action:'start',projectId:env.projectId,brief:env.brief,automatic:true})).status).toBe(409);
 expect(await env.store.transaction(s=>JSON.stringify(s))).toBe(before);
});

it('keeps worker health alive during a blocked provider promise and never starts a held job',async()=>{
 const env=await setup(),transport=transportFor(env,MOCK_BRIEFS[0]);
 let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 vi.stubGlobal('fetch',async(...args:Parameters<typeof fetch>)=>{await wait;return transport(...args);});
 const stop=startStudioWorker(env.service);
 try{
  while((await env.read()).status!=='running')await new Promise(r=>setTimeout(r,10));
  await writeFile(path.join(env.directory,'worker-heartbeat.json'),JSON.stringify({at:0}));
  expect((await workerHealth(env.directory)).available).toBe(false);
  while(!(await workerHealth(env.directory)).available)await new Promise(r=>setTimeout(r,10));
  expect((await env.read()).status).toBe('running');expect((await env.read()).calls).toBe(1);
  await writeFile(path.join(env.directory,'generation-hold.json'),'hold future calls');
  release();while(['running','validating'].includes((await env.read()).status))await new Promise(r=>setTimeout(r,10));
  expect((await env.read()).stage).toBe(1);await env.service.tick();expect(transport).toHaveBeenCalledTimes(1);
 }finally{release();stop();}
});

it('automatically replays real Terra Stages 1–2, then authored mock Stages 3–5 through live SDK contracts',async()=>{
 const evidence=JSON.parse(await readFile('docs/architecture/automatic-house/first-automatic-live/evidence.json','utf8'));
 const env=await setup(evidence.run.source.input.brief);let n=0;
 const transport=vi.fn<typeof fetch>(async(_url,init)=>{
  const wire=JSON.parse(String(init?.body));const stage=++n as StageNo;
  expect(wire.text.format.strict).toBe(true);expect(wire.max_output_tokens).toBe(LIVE_POLICY.stageOutputTokens[stage]);
  expect(JSON.stringify(wire.input)).toContain(env.brief);
  const source=await env.store.transaction(s=>structuredClone(s.runs[env.runId].source));
  const raw=stage<=2?evidence.calls[stage-1].raw:JSON.stringify(retainedMassingDownstreamV2(stage,{brief:env.brief,site:LIVE_POLICY.site,draft:source.result!.spec!,checkpoints:source.result!.checkpoints,requiredBedrooms:3,requiredBaths:2}));
  if(stage>=3){expect(source.result!.spec!.blocks[0].id).toBe('social-main');expect(JSON.stringify(wire.input)).toContain('social-main');}
  return new Response(JSON.stringify({id:`offline-retained-${stage}`,object:'response',created_at:0,model:LIVE_POLICY.model,status:'completed',output:[{type:'message',id:`msg-${stage}`,role:'assistant',content:[{type:'output_text',text:raw,annotations:[]}]}],usage:{input_tokens:1000,output_tokens:200,total_tokens:1200}}),{headers:{'content-type':'application/json'}});
 });vi.stubGlobal('fetch',transport);
 for(let stage=1;stage<=5;stage++){
  await env.service.tick();const out=await env.read();expect(out.stage,JSON.stringify(out)).toBe(stage);expect(out.status).toBe(stage===5?'complete':'ready');
  const call=await env.store.transaction(s=>s.calls[s.runs[env.runId].callIds.at(-1)!]);
  if(stage===2){expect(call.raw).toBe(evidence.calls[1].raw);expect(call.normalizations).toHaveLength(6);}
  if(stage===3||stage===4)expect(call.normalizations!.length).toBeGreaterThan(0);
 }
 const out=await env.read(),saved=loadHouse(out.save);
 expect(allRooms(saved.spec).filter(r=>r.type==='bedroom')).toHaveLength(3);expect(allRooms(saved.spec).filter(r=>r.type==='bath')).toHaveLength(2);
 expect(saved.scene.elements.length).toBeGreaterThan(70);
 const checkpoints=await env.store.transaction(s=>s.runs[env.runId].source.result!.checkpoints);
 expect(saved.spec.blocks.map(b=>[b.id,b.plan])).toEqual(checkpoints[2].spec.blocks.map(b=>[b.id,b.plan]));
 expect(saved.spec.blocks.map(b=>[b.id,b.cx,b.cz,b.w,b.d])).toEqual(checkpoints[1].spec.blocks.map(b=>[b.id,b.cx,b.cz,b.w,b.d]));
 expect(saved.spec.openSpaces).toEqual(checkpoints[1].spec.openSpaces);
 await env.service.tick();expect(transport).toHaveBeenCalledTimes(5);
});
