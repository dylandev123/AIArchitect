'use client';
import {useRef,useState} from 'react';
import {PromptGenerationStudio} from './PromptGenerationStudio';
import type {ArchitecturalScene} from '@/lib/villa/scene/model';
import {validateScene} from '@/lib/villa/scene/model';
import type {Project,StagedStudioRecord} from '@/types/project';
import {useProjectStore} from '@/store/useProjectStore';

type Checkpoint={stage:number;brief:string;scene:ArchitecturalScene;save?:string};
export function StagedStudio({project,display}:{project?:Project;display:(scene:ArchitecturalScene|undefined)=>void}){
 const stored=project?.versions[project.currentVersionIndex]?.stagedStudio;
 const [brief,setBrief]=useState(stored?.brief??'A four-bedroom Caribbean villa on a flat site with a shaded veranda and swimming pool.');
 const [checkpoints,setCheckpoints]=useState<Checkpoint[]>([]),[save,setSave]=useState<string>(),[candidate,setCandidate]=useState<{save:string;scene:ArchitecturalScene;baseline:string}>();
 const [instruction,setInstruction]=useState('Move the pool 2 metres closer to the veranda.');
 const [status,setStatus]=useState('Ready for offline rehearsal.'),[busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null),epoch=useRef(0);
 async function request(body:unknown,signal:AbortSignal){const r=await fetch('/api/ai/staged-rehearsal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
 async function next(){const token=++epoch.current;controller.current=new AbortController();setBusy(true);setCandidate(undefined);const stage=(checkpoints.at(-1)?.stage??1)+1;setStatus(`Constructing stage ${stage} from retained Terra decisions…`);
  try{const data=await request({action:'stage',brief,stage},controller.current.signal);if(token!==epoch.current)return;const cp={stage,brief,scene:validateScene(data.scene),save:data.save};setCheckpoints(c=>[...c,cp]);setSave(data.save);display(cp.scene);setStatus(`Stage ${stage} validated. Inspect the viewer before continuing. $0 spent.`);}catch(e){if(token===epoch.current)setStatus(`Stopped: ${(e as Error).message}. Last valid geometry preserved.`);}finally{if(token===epoch.current)setBusy(false);}}
 function cancel(){epoch.current++;controller.current?.abort();setBusy(false);setStatus('Cancelled. Last valid checkpoint retained; $0 spent.');}
 function persist(nextSave:string,scene:ArchitecturalScene,label:string){if(!project)throw Error('Open a saved project first.');const latest=useProjectStore.getState().getProject(project.id);if(latest?.houseConfigJson!==project.houseConfigJson)throw Error('Project changed. Reopen before saving.');const record:StagedStudioRecord={brief,save:nextSave,checkpoints};useProjectStore.getState().appendVersion(project.id,label,JSON.stringify(scene),'staged-studio',record);display(undefined);setStatus('Saved in browser project history. Reopen this project on this browser.');}
 async function preview(){const baseline=save??stored?.save;if(!baseline)return;const token=++epoch.current;controller.current=new AbortController();setBusy(true);setCandidate(undefined);
  try{if(!project || project.houseConfigJson!==JSON.stringify(validateScene(JSON.parse(baseline).scene)))throw Error('Save or reopen the exact staged house before editing.');const data=await request({action:'edit',save:baseline,instruction},controller.current.signal);if(token!==epoch.current)return;if(!data.accepted)throw Error(data.findings?.map((f:{message:string})=>f.message).join('; ')??'Edit rejected');const scene=validateScene(data.scene);setCandidate({save:data.save,scene,baseline});display(scene);setStatus('Validated mock edit preview. Accept to save a version, or reject to restore.');}catch(e){if(token===epoch.current)setStatus(`Edit rejected: ${(e as Error).message}. Saved house preserved.`);}finally{if(token===epoch.current)setBusy(false);}}
 return <><PromptGenerationStudio project={project} display={display}/><details><summary>Legacy fixed-villa replay rehearsal</summary>
 <p>Flat-site Caribbean villas only. $0 estimate · $0 hard spending limit · no paid calls. Retained Terra geometry is fixed: this mock records your brief at every stage but does not design to it.</p>
 <label>Architectural description<textarea aria-label="Staged architectural description" disabled={busy||checkpoints.length>0} value={brief} onChange={e=>setBrief(e.target.value)}/></label>
 <button disabled={busy||checkpoints.length===4} onClick={next}>{checkpoints.length?'Continue next stage':'Start staged rehearsal'}</button>
 <button disabled={!busy} onClick={cancel}>Cancel stage</button>
 <button disabled={busy} onClick={()=>{setCheckpoints([]);setSave(undefined);setCandidate(undefined);display(undefined);setStatus('Ready for a new rehearsal. Saved project preserved.');}}>Reset rehearsal</button>
 <ol>{checkpoints.map(c=><li key={c.stage}><button disabled={busy} onClick={()=>{setCandidate(undefined);display(c.scene);}}>Inspect stage {c.stage}: {['','','Massing','Rooms','Exterior','Site'][c.stage]}</button></li>)}</ol>
 <button disabled={busy||!save||!project} onClick={()=>{try{persist(save!,validateScene(JSON.parse(save!).scene),'Staged villa rehearsal');}catch(e){setStatus(String(e));}}}>Save staged house</button>
 {stored&&<button disabled={busy} onClick={()=>{try{const scene=validateScene(JSON.parse(stored.save).scene);if(JSON.stringify(scene)!==project?.houseConfigJson)throw Error('Scene changed; staged editing requires its exact saved baseline.');setSave(stored.save);setBrief(stored.brief);setCheckpoints(stored.checkpoints.map(c=>({...c,scene:validateScene(c.scene)})));display(scene);setStatus('Reopened staged source and checkpoints.');}catch(e){setStatus(String(e));}}}>Reopen staged house</button>}
 <label>Pool edit instruction<input aria-label="Staged pool edit" disabled={busy} value={instruction} onChange={e=>setInstruction(e.target.value)}/></label>
 <p>Mock grammar: “Move the pool 2 metres closer to the veranda.” Also supports numeric metres away from it. Other instructions reject.</p>
 <button disabled={busy||!(save??stored?.save)} onClick={preview}>Validate and preview pool edit</button>
 {candidate&&<><button onClick={()=>{try{if((save??stored?.save)!==candidate.baseline || project?.houseConfigJson!==JSON.stringify(validateScene(JSON.parse(candidate.baseline).scene)))throw Error('Stale preview');persist(candidate.save,candidate.scene,'Accepted mock pool edit');setSave(candidate.save);setCandidate(undefined);}catch(e){setStatus(String(e));}}}>Accept pool edit</button><button onClick={()=>{display(validateScene(JSON.parse(candidate.baseline).scene));setCandidate(undefined);setStatus('Preview rejected. Saved version preserved.');}}>Reject pool edit</button></>}
 <p role="status">{status}</p><p>Saving is browser-local. Existing project Undo, Redo and History preserve accepted versions. Manual geometry edits require a new validated staged baseline before semantic editing.</p>
 </details></>;
}
