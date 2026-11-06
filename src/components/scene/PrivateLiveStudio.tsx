'use client';
import {useEffect,useState,useRef,useCallback} from 'react';
import {matchesApproval,readDraft,writeDraft,type AvailableApproval} from '@/lib/privateStudio/client';
import {preflightBrief} from '@/lib/privateStudio/preflight';
import {FIRST_BRIEF} from '@/lib/privateStudio/contract';
import {validateScene,type ArchitecturalScene} from '@/lib/villa/scene/model';
import type {Project,StagedStudioRecord} from '@/types/project';
import {useProjectStore} from '@/store/useProjectStore';
type Policy={maxCalls:number;maxCorrectionCalls:number;maxOutputTokens:number;stageOutputTokens?:Record<string,number>;maxCostMicros:number;site:{width:number;depth:number}};
type Result={correcting?:boolean;corrections?:number;worker?:{available:boolean;held:boolean};warnings?:{message:string}[];failure?:{category:string};automatic?:boolean;cancelRequested?:boolean;failedStage?:number;error?:string;brief?:string;runId:string;status:string;stage:number;scene?:ArchitecturalScene;direction?:{concept:string};save?:string;checkpoints:{stage:number;brief:string;scene?:ArchitecturalScene}[];findings:{message:string}[];costUsd:number;heldUsd?:number};
type ServerProject={id:string;name:string;runId?:string};
export function PrivateLiveStudio({project,display}:{project?:Project;display:(scene:ArchitecturalScene|undefined)=>void}){
 const [worker,setWorker]=useState<{available:boolean;held:boolean}>();
 const [authenticated,setAuthenticated]=useState(false),[setup,setSetup]=useState(false),[csrf,setCsrf]=useState('');
 const [password,setPassword]=useState(''),[code,setCode]=useState(''),[brief,setBrief]=useState(FIRST_BRIEF);
 const [projects,setProjects]=useState<ServerProject[]>([]),[selected,setSelected]=useState(''),[result,setResult]=useState<Result>();
 const [policy,setPolicy]=useState<Policy>();
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('Checking private Studio access…'),[approved,setApproved]=useState(false);
 const baseline=useRef(project?.houseConfigJson),selectedRef=useRef('');
 const imported=useRef('');
 const [approvals,setApprovals]=useState<AvailableApproval[]>([]),[exactApproval,setExactApproval]=useState(false);
 useEffect(()=>{let active=true;matchesApproval(approvals,selected,brief).then(match=>{if(active)setExactApproval(match);}).catch(()=>{if(active)setExactApproval(false);});return()=>{active=false;};},[approvals,selected,brief]);
 async function post(body:unknown,token=csrf){const r=await fetch('/api/private-studio',{method:'POST',headers:{'Content-Type':'application/json','x-studio-csrf':token},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
 const access=useCallback((data:{authenticated:boolean;setupRequired?:boolean;worker?:{available:boolean;held:boolean};csrf?:string;projects?:ServerProject[];approved?:boolean;availableApprovals?:AvailableApproval[];policy?:Policy})=>{if(data.policy)setPolicy(data.policy);setWorker(data.worker);setAuthenticated(!!data.authenticated);setSetup(!!data.setupRequired);if(data.authenticated){setCsrf(data.csrf??'');setProjects(data.projects??[]);setSelected(s=>s||data.projects?.[0]?.id||'');setApproved(!!data.approved);setApprovals(data.availableApprovals??[]);const id=selectedRef.current||data.projects?.[0]?.id||'';selectedRef.current=id;if(id)setBrief(readDraft(sessionStorage,id,FIRST_BRIEF));}setStatus(data.authenticated?(data.approved?'Signed in. An exact-brief approval is available.':'Signed in. Paid execution awaits explicit approval.'):'Private sign-in required.');},[]);
 async function refresh(){const r=await fetch('/api/private-studio',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);access(data);}
 useEffect(()=>{fetch('/api/private-studio',{cache:'no-store'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);return data;}).then(data=>access(data)).catch(e=>setStatus(String(e)));},[access]);
 async function action(fn:()=>Promise<void>){setBusy(true);try{await fn();}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}
 function show(data:Result){setResult(data);if(data.brief)setBrief(data.brief);if(data.scene)display(validateScene(data.scene));setStatus(`Stage ${data.stage} · ${data.status}${data.failedStage?` · failed stage ${data.failedStage}; last accepted ${data.stage}`:''} · recorded $${data.costUsd.toFixed(4)}${data.heldUsd?` · held $${data.heldUsd.toFixed(4)}`:''}${data.error?` · ${data.error}`:''}${data.findings.length?` · ${data.findings.map(f=>f.message).join('; ')}`:''}`);}
 const preflightError=preflightBrief(brief);
 const chosen=projects.find(p=>p.id===selected);
 const runId=result?.runId??chosen?.runId;
 useEffect(()=>{
  if(!authenticated)return;
  let stopped=false,inFlight=false;
  async function poll(){
   if(inFlight)return;inFlight=true;
   try{const response=await fetch(runId?`/api/private-studio?runId=${encodeURIComponent(runId)}`:'/api/private-studio',{cache:'no-store'});const data=await response.json();
    if(!response.ok)throw Error(data.error);
    if(!stopped&&!runId){setWorker(data.worker);return;}
    if(!stopped){setResult(prior=>JSON.stringify(prior)===JSON.stringify(data)?prior:data);setStatus(`Stage ${data.stage} · ${data.status} · recorded $${data.costUsd.toFixed(4)}${data.error?` · ${data.error}`:''}`);}
   }catch(e){if(!stopped)setStatus(`Progress unavailable: ${(e as Error).message}. The server retains the run; no new generation request was sent.`);}
   finally{inFlight=false;}
  }
  void poll();const timer=setInterval(()=>void poll(),1500);
  return()=>{stopped=true;clearInterval(timer);};
 },[authenticated,runId]);
 useEffect(()=>{
  if(!result?.scene)return;
  display(validateScene(result.scene));
  // Completed geometry opens immediately; preserve authoritative editable source in project history.
  if(result.status==='complete'&&result.save&&project&&imported.current!==result.runId){
   const current=useProjectStore.getState().getProject(project.id);
   if(current?.versions[current.currentVersionIndex]?.stagedStudio?.save===result.save){imported.current=result.runId;return;}
   if(current?.houseConfigJson!==baseline.current)return;
   const record:StagedStudioRecord={brief:result.brief??brief,save:result.save,checkpoints:result.checkpoints.filter(c=>c.scene).map(c=>({...c,scene:c.scene!}))};
   useProjectStore.getState().appendVersion(project.id,'Live prompt-driven staged house',JSON.stringify(result.scene),'staged-studio',record);
   baseline.current=JSON.stringify(result.scene);imported.current=result.runId;
  }
 // A new result drives the preview; viewport callbacks may change on each parent render.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[result]);

 async function readRun(){const id=result?.runId??chosen?.runId;if(!id)throw Error('No saved run in this project');const r=await fetch(`/api/private-studio?runId=${encodeURIComponent(id)}`,{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);show(data);}
 return <details open><summary>Generate an editable house · private Studio</summary>
  <p>Real staged model decisions. {policy?`Maximum ${policy.maxCalls} design calls${policy.maxCorrectionCalls?` plus up to ${policy.maxCorrectionCalls} targeted corrections (one per stage)`:', no corrections'}, ${policy.stageOutputTokens?`${Math.min(...Object.values(policy.stageOutputTokens)).toLocaleString()}–${Math.max(...Object.values(policy.stageOutputTokens)).toLocaleString()} output tokens per call by stage`:`${policy.maxOutputTokens.toLocaleString()} output tokens each`}, $${(policy.maxCostMicros/1e6).toFixed(2)} per approved run, each call reserved at its measured upper cost. Flat ${policy.site.width} × ${policy.site.depth} m site.`:'Loading the server spending policy…'} Uncertain calls are never retried. Legacy paid routes stay blocked.</p>
  {!authenticated?<form onSubmit={e=>{e.preventDefault();void action(async()=>{await post({action:'login',password,...(setup?{setupCode:code}:{})});setPassword('');setCode('');await refresh();});}}>
   {setup&&<><p>First setup: open the private local file .data/private-studio/setup-code and enter its one-time code. Choose a new Studio password; this is separate from email-only login.</p><label>One-time setup code<input aria-label="Private Studio setup code" type="password" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/></label></>}
   <label>Studio password<input aria-label="Private Studio password" type="password" minLength={14} maxLength={200} autoComplete={setup?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} type="submit">{setup?'Set up private Studio':'Sign in to private Studio'}</button>
  </form>:<>
   <button disabled={busy} onClick={()=>void action(async()=>{await post({action:'logout'});setAuthenticated(false);setCsrf('');setResult(undefined);await refresh();})}>Sign out of private Studio</button>
   <label>Server project<select aria-label="Private server project" value={selected} disabled={busy||['running','validating'].includes(result?.status??'')} onChange={e=>{selectedRef.current=e.target.value;setSelected(e.target.value);setBrief(readDraft(sessionStorage,e.target.value,FIRST_BRIEF));setResult(undefined);}}><option value="">Choose a server project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <button disabled={busy} onClick={()=>void action(async()=>{const data=await post({action:'project',name:project?.name??'First live house'});selectedRef.current=data.projectId;setSelected(data.projectId);setResult(undefined);baseline.current=project?.houseConfigJson;await refresh();})}>Create owned server project</button>
   <label>Live architectural description<textarea aria-label="Private live architectural description" disabled={busy||!!result} value={brief} onChange={e=>{const value=e.target.value;setBrief(value);try{writeDraft(sessionStorage,selected,value);}catch{setStatus('Browser draft storage unavailable; keep a private copy before refreshing.');}}}/></label>
   <p>{result?'This run uses its recorded one-run approval. The server checks every stage.':exactApproval?'This exact description and project match the unused approval.':approved?'The description or project does not match the approval. Restore the approved description before starting.':'No live approval has been granted. Starting is blocked before any model call.'}</p>
   <button disabled={busy||!worker?.available||worker.held||!selected||!exactApproval||!!preflightError||!!chosen?.runId||!!result} onClick={()=>void action(async()=>{if(preflightError)throw Error(preflightError);if(!worker?.available||worker.held)throw Error('Generation worker unavailable or on hold; no request sent.');if(!await matchesApproval(approvals,selected,brief))throw Error('Description or project does not match the unused approval. No request sent.');baseline.current=project?.houseConfigJson;show(await post({action:'start',projectId:selected,brief,automatic:true}));})}>Generate House</button>
   {!result&&(!worker?.available||worker.held)&&<p role="alert">{worker?.held?'Generation is on hold. No paid calls will start.':'Generation worker unavailable. Approval remains unused; the server must be restarted before generation can begin.'}</p>}
   {!result&&preflightError&&<p role="alert">{preflightError}</p>}
   {result&&['ready','running','validating'].includes(result.status)&&<button disabled={busy||result.cancelRequested} onClick={()=>void action(async()=>show(await post({action:'cancel',runId:result.runId})))}>Cancel future stages</button>}
   {result&&<section className="house-progress" aria-label="House generation progress" aria-live="polite">
    <div className="house-progress-heading"><strong>{result.status==='ready'?(result.worker?.held?'Generation on hold':result.worker?.available?'Queued for generation':'Generation worker unavailable'):result.status==='complete'?'Your house is ready':result.status==='failed'?'Generation stopped':result.status==='uncertain'?'Provider outcome needs review':result.status==='cancelled'?'Generation cancelled':'Creating your house'}</strong><span>{result.stage} of 5 stages completed</span></div>
    {result.status==='ready'&&<p>{result.worker?.held?'No future paid calls will start while this investigation hold is in place.':result.worker?.available?'Waiting for the server worker to start the next stage.':'The server has saved this job, but its generation worker is not reporting healthy. No stage is running; do not start another run.'}</p>}
    <ol>{['Architectural concept','Building massing','Rooms and circulation','Exterior architecture','Pool and landscaping'].map((name,i)=>{
     const stage=i+1,done=result.checkpoints.some(c=>c.stage===stage),failed=result.failedStage===stage||!done&&stage===result.stage+1&&['failed','uncertain'].includes(result.status),running=!done&&stage===result.stage+1&&result.status==='running',validating=!done&&stage===result.stage+1&&result.status==='validating';
     return <li key={name} data-state={done?'completed':failed?result.status==='uncertain'?'uncertain':'failed':validating?'validating':running?'running':'pending'}><span className={running||validating?'house-stage-spinner':'house-stage-number'} aria-hidden="true">{running||validating?'':done?'✓':stage}</span><div><strong>{name}</strong><small>{done?'Completed':failed?result.status==='uncertain'?'Outcome uncertain':'Failed':validating?'Validating architecture and saving checkpoint':running&&result.correcting?'Applying one targeted correction from the measured problems':running?['Establishing your design direction','Constructing and checking building volumes','Designing your rooms and circulation','Constructing roofs, doors and glazing','Arranging the pool and garden'][i]:'Pending'}</small></div></li>;
    })}</ol>
    <p>Recorded AI spending: ${result.costUsd.toFixed(4)}{result.heldUsd?` · Reserved pending accounting: $${result.heldUsd.toFixed(4)}`:''}</p>
    {result.cancelRequested&&<p>Future stages cancelled. An active request may finish and save its checkpoint.</p>}
    {result.failure&&<p>{['schema-validation','model-formatting','provider-execution'].includes(result.failure.category)?`The design response could not be safely interpreted. Accepted stages are saved; ${result.corrections?'the one targeted correction did not resolve it.':'no retry was made.'}`:`The design needs review against the supported building rules. Accepted stages are saved; ${result.corrections?'the one targeted correction did not resolve it.':'no retry was made.'}`}</p>}
    {!!result.warnings?.length&&<details><summary>Design observations ({result.warnings.length})</summary>{result.warnings.map((w,i)=><p key={i}>{w.message}</p>)}</details>}
    {(result.error||!!result.findings.length)&&<details><summary>Generation diagnostics</summary>{result.error&&<p>{result.error}</p>}{result.findings.map((f,i)=><p key={i}>{f.message}</p>)}</details>}
   </section>}

   <button disabled={busy||!(result?.runId??chosen?.runId)} onClick={()=>void action(readRun)}>Read saved live run</button>
   {result?.direction&&<p>{result.direction.concept}</p>}
   <ol>{result?.checkpoints.map(c=><li key={c.stage}><button disabled={busy} onClick={()=>{if(c.scene)display(validateScene(c.scene));}}>Inspect live stage {c.stage}</button></li>)}</ol>
   <button disabled={busy||!project||!result?.save} onClick={()=>{try{if(useProjectStore.getState().getProject(project!.id)?.houseConfigJson!==baseline.current)throw Error('Local project changed; reopen before importing');const scene=validateScene(JSON.parse(result!.save!).scene);const record:StagedStudioRecord={brief,save:result!.save!,checkpoints:result!.checkpoints.filter(c=>c.scene).map(c=>({...c,scene:c.scene!}))};useProjectStore.getState().appendVersion(project!.id,'Live prompt-driven staged house',JSON.stringify(scene),'staged-studio',record);baseline.current=JSON.stringify(scene);display(undefined);setStatus('Live staged source saved on the server and imported into browser project history.');}catch(e){setStatus(String(e));}}}>Open completed house in Studio</button>
  </>}
  <p role="status">{!result&&status.startsWith('Unsupported:')?(preflightError??'Description passes capability preflight. No generation has started.'):status}</p><p>Stop on any failed or uncertain stage. Read the saved run after a disconnect; never resubmit an uncertain paid call. Local HTTP sign-in is restricted to this development origin and disabled in production.</p>
 </details>;
}
