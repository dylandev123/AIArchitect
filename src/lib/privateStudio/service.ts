import {resolvedPoolIntent} from '@/lib/villa/staged/intentions';
import {executionHeld,workerHealth} from './workerHealth';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {identity} from './auth';
import {StudioStore,type Run,type State,type Call} from './store';
import {LIVE_POLICY,briefHash,policyHash,reservationMicros,settleUsage,stageOutputTokens,StudioError,type ReportedUsage,type StudioPolicy} from './policy';
import {promptInput,advancePromptRun} from '@/lib/villa/staged/promptGeneration';
import {DispatchRefused,type Designer,type StageNo} from '@/lib/villa/staged/pipeline';
import {LiveDesigner,type ProviderObservation} from '@/lib/villa/staged/liveDesigner';
import {preflightBrief} from './preflight';
import {withReservedCall} from '@/lib/ai/paidExecution';

export const liveInput=z.discriminatedUnion('action',[
 z.object({action:z.literal('project'),name:z.string().min(1).max(120)}).strict(),
 z.object({action:z.literal('start'),projectId:z.string().uuid(),brief:promptInput.shape.brief,automatic:z.boolean().optional()}).strict(),
 z.object({action:z.literal('cancel'),runId:z.string().uuid()}).strict(),
 z.object({action:z.literal('advance'),runId:z.string().uuid(),stage:z.number().int().min(1).max(5),key:z.string().uuid()}).strict(),
]);
function ownedRun(state:State,request:Request,id:string,mutate=true){
 const owner=identity(state,request,mutate).owner,run=state.runs[id];
 if(!run||run.owner!==owner||state.projects[run.projectId]?.owner!==owner)throw new StudioError(404,'Run not found');
 return run;
}
export function publicRun(run:Run,state?:State){
 const result=run.source.result,accepted=result?.checkpoints.filter(c=>c.accepted)??[];
 const latest=state&&run.callIds.length?state.calls[run.callIds[run.callIds.length-1]]:undefined;
 const failedStage=run.state==='failed'||run.state==='uncertain'?(result?.failedStage??latest?.stage):undefined;
 return {warnings:accepted.flatMap(c=>c.warnings??[]).filter(w=>!(w.code==='site-intent-reservation'&&accepted.at(-1)?.stage===5&&result?.spec&&resolvedPoolIntent(result.spec)?.id===w.subject)),failure:result?.checkpoints.find(c=>!c.accepted)?.failure,automatic:!!run.automatic,cancelRequested:!!run.cancelRequested,failedStage,error:run.state==='failed'||run.state==='uncertain'?run.executionError??latest?.error:undefined,brief:run.source.input.brief,runId:run.id,projectId:run.projectId,status:run.state==='running'&&latest?.phase==='validating'?'validating':run.state,stage:accepted.at(-1)?.stage??0,
  direction:result?.spec?.direction,scene:result?.scene,checkpoints:accepted.map(c=>({stage:c.stage,brief:run.source.input.brief,scene:c.scene})),
  findings:result?.findings??[],save:(run.lastResponse as {save?:string})?.save,calls:run.callIds.length,
  correcting:run.state==='running'&&latest?.purpose==='correction',corrections:state?run.callIds.filter(id=>state.calls[id].purpose==='correction').length:0,
  costUsd:state?run.callIds.reduce((sum,id)=>sum+(state.calls[id].costMicros??0),0)/1e6:result?.totalCostUsd??0,billedUsd:state?run.callIds.reduce((sum,id)=>sum+(state.calls[id].billedMicros??state.calls[id].costMicros??0),0)/1e6:undefined,heldUsd:state?run.callIds.reduce((sum,id)=>sum+(state.calls[id].status==='settled'?0:state.calls[id].reservation),0)/1e6:0,provenance:'Live staged provider; no fixture selection'};
}
export type DesignerFactory=(observe:(v:ProviderObservation)=>Promise<void>)=>Designer;
const liveDesigner=(policy:StudioPolicy):DesignerFactory=>observe=>new LiveDesigner(policy.stageOutputTokens,{modelId:policy.model,price:policy.price,observe});
export class PrivateStudioService{
 private factory:DesignerFactory;
 constructor(readonly store:StudioStore,factory?:DesignerFactory,readonly policy:StudioPolicy=LIVE_POLICY){this.factory=factory??liveDesigner(policy);}
 async read(request:Request,id?:string){const worker=await workerHealth(this.store.directory);return this.store.transaction(s=>{
  const session=identity(s,request,false);
  if(id)return {...publicRun(ownedRun(s,request,id,false),s),worker};
  const approvals=s.approvals.filter(a=>a.owner===session.owner&&a.policyHash===policyHash(this.policy)&&!a.consumedBy);
  return {worker,authenticated:true,csrf:session.csrf,projects:Object.entries(s.projects).filter(([,p])=>p.owner===session.owner).map(([id,p])=>({id,name:p.name,runId:p.runId})),policy:this.policy,policyHash:policyHash(this.policy),approved:approvals.length>0,availableApprovals:approvals.map(a=>({projectId:a.projectId,briefHash:a.briefHash}))};
 });}
 async execute(request:Request,raw:unknown){
  const input=liveInput.parse(raw);
  if(input.action==='project')return this.store.transaction(s=>{const owner=identity(s,request).owner,id=randomUUID();s.projects[id]={owner,name:input.name};return {projectId:id};});
  if(input.action==='start'){
   const preflightError=preflightBrief(input.brief);
   if(preflightError)throw new StudioError(422,preflightError);
   const worker=await workerHealth(this.store.directory);
   if(input.automatic&&(!worker.available||worker.held))throw new StudioError(409,worker.held?'Generation is on hold; approval was not consumed.':'Generation worker unavailable; approval was not consumed.');
   return this.store.transaction(s=>{
    const owner=identity(s,request).owner,p=s.projects[input.projectId];
    if(!p||p.owner!==owner)throw new StudioError(404,'Project not found');
    if(p.runId)throw new StudioError(409,'Project already has a run; reopen it instead of restarting');
    const approval=s.approvals.find(a=>a.owner===owner&&(!a.projectId||a.projectId===input.projectId)&&a.policyHash===policyHash(this.policy)&&a.briefHash===briefHash(input.brief)&&!a.consumedBy);
    if(!approval)throw new StudioError(403,'No explicit live approval for this exact description and spending policy. Zero calls made.');
    const id=randomUUID(),run:Run={id,owner,projectId:input.projectId,source:{input:promptInput.parse({brief:input.brief,site:this.policy.site})},state:'ready',automatic:input.automatic??false,policyHash:policyHash(this.policy),callIds:[]};
    approval.consumedBy=id;p.runId=id;s.runs[id]=run;return publicRun(run,s);
   });
  }
  if(input.action==='cancel')return this.store.transaction(s=>{
   const run=ownedRun(s,request,input.runId);run.cancelRequested=true;
   if(run.state==='ready')run.state='cancelled';
   return publicRun(run,s);
  });
  const owner=await this.store.transaction(s=>ownedRun(s,request,input.runId).owner);
  return this.advance(owner,input);
 }
 /** One durable transition per tick. Reservations serialize competing server instances. */
 async tick(now=Date.now()){
  if(await executionHeld(this.store.directory))return;
  const next=await this.store.transaction(s=>{
   for(const r of Object.values(s.runs)){
    if(!r.automatic||r.state!=='running')continue;
    const call=s.calls[r.callIds.at(-1)!],since=Math.max(r.runningSince??0,call?.createdAt??0);
    // A timed-out worker may have sent a paid request. Never redispatch it, even if usage settled.
    // An unknown start time counts as stale: it can only come from an interrupted transition.
    if(now-since>10*60*1000){
     const open=r.callIds.map(id=>s.calls[id]).filter(c=>c.status==='reserved'||c.status==='unknown');
     r.state=open.length?'uncertain':'failed';r.runningSince=undefined;
     for(const c of open){c.status='unknown';c.error='Worker interrupted before checkpoint persistence. Provider outcome requires review; no retry was made.';}
     if(!open.length)r.executionError='Worker interrupted; every recorded call is settled and nothing was retried.';
    }
   }
   const r=Object.values(s.runs).find(r=>r.automatic&&!r.cancelRequested&&r.state==='ready');
   return r?{owner:r.owner,runId:r.id,stage:(r.source.result?.lastGood?.stage??0)+1,key:randomUUID()}:undefined;
  });
  if(!next)return;
  try{return await this.advance(next.owner,next);}
  catch(e){
   // Admission failures stop the job rather than spin on an exhausted or revoked authorization.
   await this.store.transaction(s=>{const r=s.runs[next.runId];if(r?.state==='ready'){r.state='failed';r.executionError=e instanceof Error?e.message:'Worker execution failed';}});
  }
 }
 private async advance(owner:string,input:{runId:string;stage:number;key:string}){
  const policy=this.policy,hash=policyHash(policy);
  const admitted=await this.store.transaction(async s=>{
   if(await executionHeld(this.store.directory))throw new StudioError(409,'Generation is on hold; no provider call was dispatched.');
   const run=s.runs[input.runId];
   if(!run||run.owner!==owner||s.projects[run.projectId]?.owner!==owner)throw new StudioError(404,'Run not found');
   if(!s.approvals.some(a=>a.consumedBy===run.id&&a.owner===owner&&a.policyHash===hash&&a.briefHash===briefHash(run.source.input.brief)&&(!a.projectId||a.projectId===run.projectId)))throw new StudioError(403,'Run authorization missing');
   const repeated=run.callIds.map(id=>s.calls[id]).find(c=>c.key===input.key);
   if(repeated){if(repeated.stage!==input.stage)throw new StudioError(409,'Idempotency key reused for another stage');return {cached:publicRun(run,s)};}
   if(run.cancelRequested||run.state!=='ready'||run.policyHash!==hash)throw new StudioError(409,'Run is stopped or already executing; read its status. No retry call is permitted.');
   if(Object.values(s.runs).some(r=>r.owner===run.owner&&(r.state==='running'||r.state==='uncertain')))throw new StudioError(409,'An active or unaccounted paid call already exists');
   const stage=(run.source.result?.lastGood?.stage??0)+1;
   if(input.stage!==stage)throw new StudioError(409,'Stage revision conflict');
   run.state='running';run.runningSince=Date.now();return {run:structuredClone(run)};
  });
  if('cached'in admitted)return admitted.cached;
  const {run}=admitted;
  const calls:string[]=[];
  let response:Awaited<ReturnType<typeof advancePromptRun>>|undefined;
  let error:string|undefined,executionException:{message:string;stack?:string}|undefined;
  const designer=this.reservedDesigner(owner,run.id,input.key,calls);
  try{response=await advancePromptRun(run.source,designer,{maxCostUsd:policy.maxCostMicros/1e6,maxCalls:policy.maxCalls+policy.maxCorrectionCalls,maxCorrectionsPerStage:policy.maxCorrectionCalls>0?1:0,onCheckpoint:async checkpoint=>{await this.store.transaction(s=>{const last=calls.at(-1);if(last)s.calls[last].checkpoint=checkpoint;});}});}
  catch(e){executionException={message:e instanceof Error?e.message:String(e),stack:e instanceof Error?e.stack:undefined};error=`Stage ${input.stage} execution interrupted: ${e instanceof Error?e.message:'unknown error'}. No retry was made.`;}
  return this.store.transaction(s=>{
   const stored=s.runs[run.id],mine=calls.map(id=>s.calls[id]);
   for(const call of mine)if(call.status==='reserved')call.status='unknown';
   stored.source=run.source;stored.runningSince=undefined;
   if(response)stored.lastResponse=response;
   const unaccounted=mine.some(call=>call.status!=='settled'||call.limitViolation||(call.costMicros??0)>call.reservation);
   stored.state=unaccounted?'uncertain':response?.status==='complete'?'complete':stored.cancelRequested?'cancelled':error||response?.status==='failed'?'failed':'ready';
   const refused=run.source.result?.status==='failed'?run.source.result.findings.filter(f=>f.code==='dispatch-refused'):[];
   if(refused.length)stored.executionError=refused.map(f=>f.message).join(' | ');
   for(const call of mine){call.finishedAt=call.finishedAt??Date.now();call.phase='finished';}
   const last=mine.at(-1);
   if(last&&executionException)last.executionException=executionException;
   if(last&&error)last.error=error;else if(last&&response?.status==='failed'&&!last.error)last.error='Stage output rejected by schema or geometry validation';
   if(!mine.length&&error)stored.executionError=error;
   if(stored.state==='complete'&&response?.save)s.projects[stored.projectId].save=response.save;
   return {...publicRun(stored,s),...(error?{error}:{})};
  });
 }
 /** Every provider call - design or correction - is admitted, reserved and accounted individually. */
 private reservedDesigner(owner:string,runId:string,key:string,calls:string[]):Designer{
  const live=(observe:(v:ProviderObservation)=>Promise<void>)=>this.factory(observe);
  const call=<T>(stage:StageNo,purpose:'design'|'correction',bytes:number|undefined,go:(d:Designer)=>Promise<T>)=>this.reservedCall(owner,runId,calls.length?undefined:key,stage,purpose,bytes,calls,observe=>go(live(observe)));
  const probe=live(async()=>{});
  return {label:`reserved ${probe.label}`,
   design:(stage,ctx)=>call(stage,'design',probe.wireBytes?.(stage,ctx),d=>d.design(stage,ctx)),
   correct:(stage,ctx,previous,findings)=>call(stage,'correction',probe.wireBytes?.(stage,ctx,{previous,findings}),d=>d.correct(stage,ctx,previous,findings)),
  };
 }
 private async reservedCall<T>(owner:string,runId:string,key:string|undefined,stage:StageNo,purpose:'design'|'correction',bytes:number|undefined,calls:string[],run:(observe:(v:ProviderObservation)=>Promise<void>)=>Promise<T>):Promise<T>{
  const policy=this.policy,hash=policyHash(policy);
  if(bytes!==undefined&&bytes>policy.maxWireBytes)throw new DispatchRefused(`Stage ${stage} request would be ${bytes} bytes, above the ${policy.maxWireBytes}-byte ceiling; nothing was sent.`);
  const wire=bytes??policy.maxWireBytes,outputCap=stageOutputTokens(policy,stage),reservation=reservationMicros(policy,wire,stage);
  const callId=await this.store.transaction(async s=>{
   const refuse=(m:string):never=>{throw new DispatchRefused(m);};
   if(await executionHeld(this.store.directory))refuse('Generation is on hold; no provider call was dispatched.');
   const r=s.runs[runId];
   if(!r||r.owner!==owner||r.state!=='running'||r.policyHash!==hash)refuse('Run is not executing under the approved policy.');
   if(r.cancelRequested)refuse('Generation was cancelled before this call; nothing was sent.');
   const all=Object.values(s.calls).filter(c=>s.runs[c.runId]?.owner===owner);
   if(all.some(c=>c.status==='unknown'||c.status==='reserved'))refuse('A previous provider call has an unresolved outcome or usage; further spending is blocked and nothing was retried.');
   const mine=r.callIds.map(id=>s.calls[id]),design=mine.filter(c=>(c.purpose??'design')==='design').length,correction=mine.filter(c=>c.purpose==='correction').length;
   if(purpose==='design'&&design>=policy.maxCalls)refuse('Run model-call limit reached.');
   if(purpose==='correction'&&correction>=policy.maxCorrectionCalls)refuse('No correction calls are authorized under the approved policy.');
   const spent=mine.reduce((sum,c)=>sum+(c.status==='settled'?c.costMicros!:c.reservation),0);
   if(spent+reservation>policy.maxCostMicros)refuse(`Remaining approved budget (US$${((policy.maxCostMicros-spent)/1e6).toFixed(4)}) is below this call's upper bound (US$${(reservation/1e6).toFixed(4)}); nothing was sent.`);
   const c:Call={id:randomUUID(),runId,stage,purpose,key:key??randomUUID(),status:'reserved',reservation,wireBound:wire,createdAt:Date.now()};
   s.calls[c.id]=c;r.callIds.push(c.id);return c.id;
  });
  calls.push(callId);
  const observe=async(value:ProviderObservation)=>{await this.store.transaction(s=>{
   const c=s.calls[callId];
   if(value.phase==='normalization'){c.normalizations=value.normalizations;return;}
   if(c.status!=='reserved')return;
   if(value.phase==='request'){c.request=value.request;return;}
   if(value.phase==='transport'){c.responseBody=value.responseBody;c.httpStatus=value.httpStatus;c.wireRequestBody=value.wireRequestBody;c.phase='validating';return;}
   c.phase='validating';c.raw=value.raw;c.request=value.request;c.providerUsage=value.providerUsage;c.requestId=value.requestId;c.finishReason=value.finishReason;c.error=value.error;
   // Budget charge and billed estimate come from the provider's own token categories (cache read/write split), never from the designer's estimate.
   const settled=value.usage&&Number.isFinite(value.usage.costUsd)&&value.usage.costUsd>=0?settleUsage(policy,value.providerUsage as ReportedUsage|undefined)??settleUsage(policy,value.usage):undefined;
   if(settled){c.usage=value.usage;c.limitViolation=settled.inputTokens>policy.maxInputTokens||settled.outputTokens>outputCap;c.costMicros=settled.chargeMicros;c.billedMicros=settled.billedMicros;c.status='settled';}
   else c.status='unknown';
  });};
  let dispatched=false;
  try{return await withReservedCall({model:policy.model,maxOutputTokens:outputCap,maxWireBytes:wire,onDispatch:()=>{dispatched=true;}},()=>run(observe));}
  finally{
   await this.store.transaction(s=>{const c=s.calls[callId];c.finishedAt=Date.now();
    // Refused at the transport before any bytes left: provably unbilled, so the reservation is released.
    if(c.status==='reserved'&&!dispatched){c.status='settled';c.costMicros=0;c.error=c.error??'Refused before dispatch; no provider request was sent.';}
    else if(c.status==='reserved')c.status='unknown';
   });
  }
 }
}
