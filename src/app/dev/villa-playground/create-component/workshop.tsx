'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { COMPOSITION_EXAMPLES } from '@/lib/villa/composition-examples';
import { CAPABILITIES, defaultPlacement, mockProposal, validatePlacement, validateProposal, type CreationProposal, type Placement } from '@/lib/villa/creation/model';
import { candidateDraft, validateStoredCandidate, validatePinnedStudy, type Candidate } from '@/lib/villa/creation/candidate';
import type { SceneCapture } from '@/lib/villa/visual-review';
import { validateCompositionPreview, type VillaComposition } from '@/lib/villa/composition';
import { ReviewPreview } from '../review-preview';
import { CreatedRibbon } from './ribbon';
import styles from './workshop.module.css';
type Evidence = Candidate['evidence'][number];
const villas=COMPOSITION_EXAMPLES.slice(0,2);
const placements: Placement[]=[defaultPlacement,{x:15,z:8,orientation:25}];
function download(name:string, value:unknown) {const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function CreationWorkshop() {
  const [brief,setBrief]=useState('Create a sculptural wave canopy beside the villa terrace; keep views open.'),[element,setElement]=useState('Freestanding terrace canopy');
  const [proposal,setProposal]=useState<CreationProposal>(),[draft,setDraft]=useState(''),[index,setIndex]=useState(0),[placement,setPlacement]=useState(placements[0]);
  const [framing,setFraming]=useState('composition');
  const [villaOverride,setVillaOverride]=useState<VillaComposition>();
  const villa=villaOverride??villas[index];
  const [evidence,setEvidence]=useState<Evidence[]>([]),[reviewedToken,setReviewedToken]=useState(''),[message,setMessage]=useState('Offline first · no provider calls'),[busy,setBusy]=useState(false),[captureKey,setCaptureKey]=useState(0);
  const [captured,setCaptured]=useState<{token:string;shot:SceneCapture}>(),[records,setRecords]=useState<Candidate[]>([]),[saved,setSaved]=useState<Candidate>(),[authorized,setAuthorized]=useState(false);
  const lock=useRef(false),pending=useRef<{token:string;resolve:(s:SceneCapture)=>void;reject:(e:Error)=>void} | undefined>(undefined);
  const token=JSON.stringify({proposal,placement,villa,framing}); const latest=useRef(token);
  useEffect(()=>{latest.current=token;},[token]);
  const shot=captured?.token===token?captured.shot:undefined;
  const reviewed=reviewedToken===token;
  const cameraPose=useMemo(()=>{
    if(framing!=='detail'||!proposal)return undefined;
    const g=proposal.geometry, roof=g.height+Math.max(...g.stations.map(s=>s.rise))+g.width*.25+g.thickness;
    return {position:[placement.x+g.length*1.1,roof+g.length*.7,placement.z+g.length*1.7] as [number,number,number],target:[placement.x,roof*.5,placement.z] as [number,number,number]};
  },[framing,placement,proposal]);
  const gap=useMemo(()=>{if(!proposal)return '';try{validatePlacement(proposal,placement,villa);return '';}catch(e){return e instanceof Error?e.message:'Invalid placement';}},[proposal,placement,villa]);
  useEffect(()=>{fetch('/api/dev/villa-candidates').then(r=>r.json()).then(r=>{if(r.candidates)setRecords(r.candidates);}).catch(()=>setMessage('Candidate storage unavailable.'));},[]);
  function apply(next:unknown) {const p=validateProposal(next);setProposal(p);setDraft(JSON.stringify(p,null,2));setEvidence([]);setSaved(undefined);setAuthorized(false);}
  async function propose(live=false, variant:'wave'|'fan'='wave') {
    if(lock.current)return;lock.current=true;setBusy(true);
    try {
      if(!live) {apply(mockProposal(variant));setMessage('Deterministic Terra-style proposal · 0 provider calls · $0');return;}
      const response=await fetch('/api/ai/villa/create-component',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief,element,current:villa,authorizePaidCall:authorized,offlineCandidate:saved?{id:saved.id,version:saved.version}:undefined}),signal:AbortSignal.timeout(175000)});
      const result=await response.json(); if(!response.ok)throw new Error(result.capabilityGap??result.error);
      if(result.capabilityGap)throw new Error(`Capability gap: ${result.capabilityGap}`);
      apply(result.proposal);setMessage(`Live Terra proposal received · ${result.providerCalls} provider call · model ${result.model}`);
    } catch(e){setMessage(String(e));}finally{setAuthorized(false);lock.current=false;setBusy(false);}
  }
  async function capture() {
    if(!proposal||gap||lock.current)return;lock.current=true;setBusy(true);const start=token;
    try {
      const s=await new Promise<SceneCapture>((resolve,reject)=>{const timer=setTimeout(()=>{pending.current=undefined;reject(new Error('Capture timed out'));},30000);pending.current={token:start,resolve:s=>{clearTimeout(timer);resolve(s);},reject:e=>{clearTimeout(timer);reject(e);}};setCaptureKey(k=>k+1);});
      if(latest.current!==start)throw new Error('Preview changed during capture; capture again.');setCaptured({token:start,shot:s});setReviewedToken('');setMessage('Verified 640 × 360 PNG captured. Review proportions, supports, clearance and finish before retaining evidence.');
    }catch(e){setMessage(String(e));}finally{pending.current=undefined;lock.current=false;setBusy(false);}
  }
  async function persist(approve=false) {
    if(lock.current||!proposal)return;lock.current=true;setBusy(true);
    try {
      const candidate=approve?saved:candidateDraft(proposal,brief,evidence);
      if(!candidate)throw new Error('Save an experimental candidate first.');
      const r=await fetch('/api/dev/villa-candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidate,approve})});const b=await r.json();if(!r.ok)throw new Error(b.error);
      setSaved(b.candidate);setRecords(rs=>[...rs,b.candidate]);setMessage(`${b.candidate.id}@${b.candidate.version} saved · ${b.candidate.status} · development only`);
    }catch(e){setMessage(String(e));}finally{lock.current=false;setBusy(false);}
  }
  function reuse(c:Candidate) {try{validateStoredCandidate(c);validatePlacement(c.proposal,placement,villa);apply(c.proposal);setSaved(c);setMessage(`Reused pinned ${c.id}@${c.version} locally; no creation call.`);}catch(e){setMessage(String(e));}}
  const twoVillas=evidence.length===2;
  return <main className={styles.workshop}>
    <header><div><small>AI ARCHITECT / DEVELOPMENT EXPERIMENT</small><h1>Create Architectural Component</h1><p>Invent a bounded new form, review it in two villas, then grow an experimental library.</p></div><Link href="/dev/villa-playground">← Villa Playground</Link></header>
    <div className={styles.grid}><aside className={styles.panel}>
      <h2>01 · Architectural intent</h2><button disabled={busy} onClick={()=>{try{const raw=sessionStorage.getItem("villa-creation-context");if(!raw)throw new Error("Open Create Architectural Component from an authored Playground composition to bring it here.");const context=JSON.parse(raw);setVillaOverride(validateCompositionPreview(context.current));if(context.brief)setBrief(context.brief);setMessage("Loaded current Playground composition. Adjust placement if clearance checks require it.");}catch(e){setMessage(String(e));}}}>Load current Playground composition</button><label>Architectural brief<textarea value={brief} disabled={busy} onChange={e=>{setBrief(e.target.value);setSaved(undefined);}} maxLength={4000}/></label>
      <label>Requested element<textarea value={element} disabled={busy} onChange={e=>setElement(e.target.value)} maxLength={2000}/></label>
      <button className={styles.primary} disabled={busy} onClick={()=>propose()}>Propose deterministic wave</button><button disabled={busy} onClick={()=>propose(false,'fan')}>Propose deterministic fan</button>
      <details><summary>Creation capabilities and gaps</summary><pre>{JSON.stringify(CAPABILITIES,null,2)}</pre></details>
      <h2>03 · Versioned library</h2><p>{evidence.length}/2 reviewed villa previews retained</p>
      {evidence.map(e=><Image unoptimized key={e.villa.id} src={e.image} alt={`Reviewed ${e.villa.name}`} width={160} height={90}/>)}
      <button disabled={busy||!twoVillas||!proposal} onClick={()=>persist()}>Save experimental candidate</button>
      <button disabled={busy||(saved?.status!=='experimental'||saved.evidence.length!==2)} onClick={()=>persist(true)}>Approve saved candidate for local reuse</button>
      <p>Approval creates a new immutable version. Candidates stay private and development only. Reviewed approved versions are available to normal Terra generation.</p>
      {saved&&<p>Selected: {saved.id}@{saved.version} · {saved.status}</p>}
      {records.map(c=><p key={`${c.id}@${c.version}`}>{c.proposal.name} · v{c.version} · {c.status} <button disabled={busy} onClick={()=>{reuse(c);setBrief(c.originalIntent);}}> {c.status==='approved'?'Reuse version':'Review candidate'} {c.version}</button></p>)}
      <button disabled={busy||saved?.status!=='approved'||!!gap} onClick={()=>download('pinned-villa-study.json',validatePinnedStudy({schemaVersion:1,candidate:saved,villa,placement}))}>Export version-pinned villa study</button>
      <label>Reload pinned villa study<input type="file" accept="application/json" disabled={busy} onChange={async e=>{try{const f=e.target.files?.[0];if(!f)return;if(f.size>13000000)throw new Error('Study too large');const s=validatePinnedStudy(JSON.parse(await f.text()));apply(s.candidate.proposal);setSaved(s.candidate);setVillaOverride(s.villa);setPlacement(s.placement);setMessage(`Loaded ${s.candidate.id}@${s.candidate.version}; no provider call.`);}catch(e){setMessage(String(e));}}}/></label>
      <details><summary>Manual live Terra test</summary><p>Complete offline review first. This action makes one paid call using Terra’s existing model and configuration, with no automatic retry.</p>
        <label><input type="checkbox" checked={authorized} disabled={!twoVillas||!saved||busy} onChange={e=>setAuthorized(e.target.checked)}/> Authorize one paid component-creation call</label>
        <button disabled={!twoVillas||!saved||!authorized||busy} onClick={()=>propose(true)}>Create with live Terra once</button>
      </details>
    </aside><section className={styles.panel}><h2>02 · Construct, edit and review</h2>
      <div className={styles.controls}><label>Preview framing<select aria-label="Preview framing" disabled={busy} value={framing} onChange={e=>setFraming(e.target.value)}><option value="composition">Villa composition</option><option value="detail">Component detail</option></select></label><label>Villa composition<select disabled={busy} value={index} onChange={e=>{const n=Number(e.target.value);setIndex(n);setVillaOverride(undefined);setPlacement(placements[n]);}}>{villas.map((v,i)=><option key={v.id} value={i}>{v.name}</option>)}</select></label>
      {(['x','z','orientation'] as const).map(k=><label key={k}>{k}<input aria-label={k} type="number" value={placement[k]} disabled={busy} onChange={e=>setPlacement(p=>({...p,[k]:Number(e.target.value)}))}/></label>)}</div>
      {proposal&&!gap?<ReviewPreview captureRevision={captureKey} cameraPose={cameraPose} config={villa} view="Poolside" responsive ready={s=>{if(pending.current?.token===token)pending.current.resolve(s);}} onError={m=>{pending.current?.reject(new Error(m));setMessage(m);}}><CreatedRibbon proposal={proposal} placement={placement}/></ReviewPreview>:<p role="status">{gap||'Propose a form to construct its preview.'}</p>}
      {proposal&&<><h2>{proposal.name}</h2><p>{proposal.character}</p><p>{proposal.details}</p>
        <div className={styles.controls}>{(['length','width','height','thickness'] as const).map(k=><label key={k}>{k} (m)<input aria-label={k} type="number" step="0.1" key={`${proposal.id}-${proposal.geometry[k]}`} defaultValue={proposal.geometry[k]} disabled={busy} onBlur={e=>{try{apply({...proposal,geometry:{...proposal.geometry,[k]:Number(e.target.value)}});}catch(e){setMessage(String(e));}}}/></label>)}</div>
        <label>Editable proposal JSON<textarea aria-label="Editable proposal JSON" value={draft} disabled={busy} style={{minHeight:160,fontFamily:'monospace'}} onChange={e=>setDraft(e.target.value)}/></label>
        <button disabled={busy} onClick={()=>{try{apply(JSON.parse(draft));setMessage('Validated proposal applied. Evidence reset; review both villas again.');}catch(e){setMessage(`Capability gap / invalid proposal: ${String(e)}`);}}}>Validate and apply geometry</button>
        {framing==='detail'&&<p>Use Villa composition framing to capture review evidence.</p>}<button disabled={busy||!!gap||framing==='detail'} onClick={capture}>Capture current villa preview</button>
        {shot&&<><Image unoptimized src={shot.image} width={160} height={90} alt="Current captured preview"/><label><input type="checkbox" disabled={busy} checked={reviewed} onChange={e=>setReviewedToken(e.target.checked?token:'')}/> I reviewed proportions, orientation, supports, clearance and material appearance</label><button disabled={!reviewed||busy} onClick={()=>{setEvidence(es=>[...es.filter(e=>e.villa.id!==villa.id),{villa:structuredClone(villa),placement:{...placement},image:shot.image,view:shot.view as Evidence['view'],reviewed:true as const}].slice(-2));setMessage(`Retained reviewed evidence for ${villa.name}.`);}}>Retain reviewed evidence</button></>}
      </>}
      <p className={styles.message} role="status">{busy?'Working…':message}</p>
    </section></div>
  </main>;
}
