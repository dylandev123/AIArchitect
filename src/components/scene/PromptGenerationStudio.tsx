'use client';
import {PrivateLiveStudio} from './PrivateLiveStudio';
import {useRef,useState} from 'react';
import {validateScene,type ArchitecturalScene} from '@/lib/villa/scene/model';
import {MOCK_BRIEFS} from '@/lib/villa/staged/promptExamples';
import {useProjectStore} from '@/store/useProjectStore';
import type {Project,StagedStudioRecord} from '@/types/project';
type Checkpoint={stage:number;brief:string;scene?:ArchitecturalScene};
const names=['','Design direction','Massing','Room programme','Exterior','Materials and grounds'];
export function PromptGenerationStudio({project,display}:{project?:Project;display:(scene:ArchitecturalScene|undefined)=>void}){
 const [brief,setBrief]=useState<string>(MOCK_BRIEFS[0]),[runId,setRunId]=useState<string>(),[checkpoints,setCheckpoints]=useState<Checkpoint[]>([]);
 const [save,setSave]=useState<string>(),[busy,setBusy]=useState(false),[stopped,setStopped]=useState(false),[direction,setDirection]=useState('');
 const [status,setStatus]=useState('Choose an offline sample, or enter a description for the blocked live route.');
 const stored=project?.versions[project.currentVersionIndex]?.stagedStudio;
 const epoch=useRef(0),baseline=useRef<string|undefined>(undefined);
 const isMock=MOCK_BRIEFS.some(b=>b===brief);
 function reset(){epoch.current++;setBusy(false);setStopped(false);setRunId(undefined);setCheckpoints([]);setSave(undefined);setDirection('');display(undefined);setStatus('Ready. Saved project preserved.');}
 async function next(){
  if(!runId)baseline.current=project?.houseConfigJson;
  const token=++epoch.current;setBusy(true);setStatus(`Running stage ${checkpoints.length+1}…`);
  try{
   const response=await fetch(isMock?'/api/dev/staged-generation':'/api/ai/staged-generation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(runId?{action:'advance',runId}:{action:'start',brief})});
   const data=await response.json();if(token!==epoch.current)return;
   if(!response.ok)throw Error(data.error??'Stage request failed');
   setRunId(data.runId);setDirection(data.direction?.concept??'');
   const cps:Checkpoint[]=data.checkpoints.map((c:Checkpoint)=>({...c,scene:c.scene?validateScene(c.scene):undefined}));
   setCheckpoints(cps);setSave(data.save);if(data.scene)display(validateScene(data.scene));
   if(data.status==='failed'){setStopped(true);setStatus(`Stopped: ${data.findings.map((f:{message:string})=>f.message).join('; ')}. Accepted stages preserved.`);}
   else setStatus(`${names[data.stage]} accepted. Inspect before continuing. Offline mock · $0 spent.`);
  }catch(e){if(token===epoch.current){setStopped(true);setStatus(`${(e as Error).message}. Existing checkpoints preserved.`);}}
  finally{if(token===epoch.current)setBusy(false);}
 }
 function persist(){
  try{
   if(!project||!save)throw Error('Complete the stages in a saved project first');
   const latest=useProjectStore.getState().getProject(project.id);
   if(latest?.houseConfigJson!==baseline.current)throw Error('Project changed during generation; reopen it before saving');
   const scene=validateScene(JSON.parse(save).scene);
   const record:StagedStudioRecord={brief,save,checkpoints:checkpoints.filter(c=>c.scene).map(c=>({...c,scene:c.scene!}))};
   useProjectStore.getState().appendVersion(project.id,'Offline prompt-generation mock',JSON.stringify(scene),'staged-studio',record);
   baseline.current=JSON.stringify(scene);display(undefined);setStatus('Saved editable scene and staged source in browser project history.');
  }catch(e){setStatus((e as Error).message);}
 }
 return <><PrivateLiveStudio project={project} display={display}/><details open><summary>Prompt-driven staged generation</summary>
  <p>Live generation is blocked pending verified sign-in, project ownership and spending controls. The three samples use authored offline model responses, the real room solver and geometry validation. They are not proof of AI design quality.</p>
  <div>{MOCK_BRIEFS.map((b,i)=><button key={b} disabled={busy||checkpoints.length>0} onClick={()=>setBrief(b)}>Offline sample {i+1}: {['Caribbean · 3 bedrooms','Spanish courtyard · 4 bedrooms','Modern wings · 6 bedrooms'][i]}</button>)}</div>
  <label>Description<textarea aria-label="Prompt-driven architectural description" value={brief} disabled={busy||checkpoints.length>0} onChange={e=>setBrief(e.target.value)}/></label>
  <p>Flat land · default site 60 × 48 m. {isMock?'Offline sample: zero paid calls.':'Custom description: live execution unavailable.'}</p>
  <button disabled={busy||stopped||checkpoints.length===5} onClick={next}>{runId?'Continue next stage':isMock?'Start offline prompt test':'Check live availability'}</button>
  <button onClick={reset}>Reset prompt run</button>
  {direction&&<p>{direction}</p>}
  <ol>{checkpoints.map(c=><li key={c.stage}><button disabled={busy} onClick={()=>{if(c.scene)display(c.scene);else setStatus(`Design direction: ${direction}`);}}>Inspect {names[c.stage]}</button></li>)}</ol>
  <button disabled={busy||!save||!project} onClick={persist}>Save prompt-generated mock house</button>
  {stored&&<button disabled={busy} onClick={()=>{try{const h=JSON.parse(stored.save),scene=validateScene(h.scene);if(JSON.stringify(scene)!==project?.houseConfigJson)throw Error('Saved source no longer matches the current scene');setBrief(stored.brief);setSave(stored.save);setCheckpoints([{stage:1,brief:stored.brief},...stored.checkpoints.map(c=>({...c,scene:validateScene(c.scene)}))]);setDirection(h.spec.direction.concept);setRunId(undefined);setStopped(true);baseline.current=project.houseConfigJson;display(scene);setStatus('Reopened editable staged source and saved checkpoints. Reset to start another design.');}catch(e){setStatus((e as Error).message);}}}>Reopen saved staged source</button>}
  <p role="status">{status}</p>
  <p>Accepted stages stay inspectable after failure. Offline runs expire after one hour or a server restart; save a completed house to retain its editable source and checkpoints. Reset discards the current preview.</p>
 </details></>;
}
