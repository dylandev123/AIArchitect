'use client';
import {useState} from 'react';
import type {VillaComposition} from '@/lib/villa/composition';
import {architectureCandidateDraft,previewArchitectureCandidate,validateArchitectureCandidate,type ArchitectureCandidate} from '@/lib/villa/creation/architecture-candidate';
import type {SceneCapture} from '@/lib/villa/visual-review';
import styles from './architecture-library.module.css';
import {ReviewPreview} from './review-preview';

/** Private browser library: exported snapshots retain exact builder and version. */
export function ArchitectureLibrary({current,onApply,disabled}:{current:VillaComposition;onApply:(c:VillaComposition)=>void;disabled:boolean}){
 const [draft,setDraft]=useState(''),[message,setMessage]=useState(''),[preview,setPreview]=useState<{config:VillaComposition;baseline:string}>(),[index,setIndex]=useState(0);
 const [view,setView]=useState<SceneCapture['view']>('Arrival'),[captureRevision,setCaptureRevision]=useState(0),[captured,setCaptured]=useState<{shot:SceneCapture;token:string}>();
 const [candidate,setCandidate]=useState<ArchitectureCandidate>();
 const form=current.forms?.[index];
 function snapshot(){try{
  if(!form)throw Error('Choose an enclosed building form first.');
  const next=architectureCandidateDraft(form,current.character,candidate?.id===form.id?candidate:undefined);
  setCandidate(next);setDraft(JSON.stringify(next,null,2));setPreview(undefined);setMessage(`Experimental ${next.id}@${next.version}. Preview and inspect before reuse.`);
 }catch(e){setMessage(String(e));}}
 function stage(){try{
  if(!form)throw Error('Select the destination form to replace.');
  const c=validateArchitectureCandidate(JSON.parse(draft));
  const config=previewArchitectureCandidate(c,current,{id:form.id,x:form.x,z:form.z,orientation:form.orientation});
  setCandidate(c);setPreview({config,baseline:JSON.stringify(current)});setMessage('Validated local preview. All other property elements are preserved.');
 }catch(e){setPreview(undefined);setMessage(String(e));}}
 function save(){try{
  const c=validateArchitectureCandidate(JSON.parse(draft)),key=`villa-architecture:${c.id}@${c.version}`,existing=localStorage.getItem(key),data=JSON.stringify(c);
  if(existing&&existing!==data)throw Error('This version already exists. Create a new snapshot version.');
  localStorage.setItem(key,data);setMessage(`Saved ${c.id}@${c.version} in this browser.`);
 }catch(e){setMessage(String(e));}}
 function download(){try{
  const c=validateArchitectureCandidate(JSON.parse(draft)),url=URL.createObjectURL(new Blob([JSON.stringify(c,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${c.id}@${c.version}.architecture.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setMessage(String(e));}}
 return <details className={styles.library}><summary>Experimental building library · offline</summary>
  <p>Reuse an enclosed building with its outlines, support graph and façades. Private versioned snapshots; no provider calls.</p>
  <label>Building<select value={index} disabled={disabled} onChange={e=>{setIndex(Number(e.target.value));setPreview(undefined);}}>{current.forms?.map((f,i)=><option key={f.id} value={i}>{f.id}</option>)}</select></label>
  <button type="button" disabled={disabled||!form} onClick={snapshot}>Snapshot building</button>
  <label>Candidate JSON<textarea aria-label="Architectural candidate JSON" rows={5} value={draft} disabled={disabled} onChange={e=>{setDraft(e.target.value);setPreview(undefined);}}/></label>
  <button type="button" disabled={disabled||!draft} onClick={save}>Save private version</button>
  <button type="button" disabled={disabled} onClick={()=>{try{const keys=Object.keys(localStorage).filter(k=>k.startsWith('villa-architecture:'));setMessage(keys.length?keys.join(' · '):'No private architecture versions saved.');}catch(e){setMessage(String(e));}}}>List private versions</button>
  <input aria-label="Saved architecture version" placeholder="building-id@1" onChange={e=>{const raw=localStorage.getItem('villa-architecture:'+e.target.value);if(raw){setDraft(raw);setPreview(undefined);}}}/>
  <button type="button" disabled={disabled||!draft} onClick={download}>Export snapshot</button>
  <button type="button" disabled={disabled||!draft||!form} onClick={stage}>Preview on selected building</button>
  {message&&<p role="status">{message}</p>}
  {preview&&<><label>Review view<select aria-label="Review view" value={view} onChange={e=>{setView(e.target.value as SceneCapture['view']);setCaptured(undefined);setCaptureRevision(0);}}>{(['Arrival','Aerial','Poolside'] as const).map(v=><option key={v}>{v}</option>)}</select></label>
   <ReviewPreview responsive config={preview.config} view={view} captureRevision={captureRevision} ready={captureRevision?shot=>setCaptured({shot,token:JSON.stringify({config:preview.config,view})}):undefined} onError={setMessage}/>
   <button type="button" disabled={disabled} onClick={()=>{setCaptured(undefined);setCaptureRevision(v=>v+1);}}>Capture this view · offline</button>
   <button type="button" disabled={disabled||!captured||captured.token!==JSON.stringify({config:preview.config,view})} onClick={()=>{try{
    if(!captured)throw Error('Capture this view first.');
    const c=validateArchitectureCandidate(JSON.parse(draft));
    const evidence=[...c.evidence.filter(e=>e.view!==captured.shot.view),{view:captured.shot.view,image:captured.shot.image}];
    const next=validateArchitectureCandidate({...c,evidence,status:evidence.length===3?'reviewed':'experimental'});
    setCandidate(next);setDraft(JSON.stringify(next,null,2));setCaptured(undefined);setMessage(`Retained ${evidence.length}/3 manually reviewed exterior views. Save or export the version when ready.`);
   }catch(e){setMessage(String(e));}}}>Retain reviewed capture</button><button type="button" disabled={disabled||preview.baseline!==JSON.stringify(current)} onClick={()=>{onApply(preview.config);setPreview(undefined);setMessage('Applied through the existing validated editing executor.');}}>Apply preview</button></>}
 </details>;
}
