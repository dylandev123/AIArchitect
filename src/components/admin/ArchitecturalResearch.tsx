'use client';
import { useState } from 'react';
import { researchIntakeFixture } from '@/lib/library/architecture/research.fixture';
import { useAdminStore } from '@/store/useAdminStore';

/** An offline research workbench on the existing Learn surface. Explicit writes
 * create proposals only; the standard knowledge revision route handles approval. */
export function ArchitecturalResearch() {
 const email = useAdminStore(s=>s.adminEmail);
 const [brief,setBrief]=useState(''), [policy,setPolicy]=useState('on-request'), [uncertainty,setUncertainty]=useState('');
 const [findings,setFindings]=useState(''), [result,setResult]=useState(''), [busy,setBusy]=useState(false);
 const [previewed,setPreviewed]=useState('');
 const [sources,setSources]=useState<{url:string;title:string}[]>([]);
 async function submit(action:'prepare'|'preview'|'propose') {
  setBusy(true); setResult('');
  try {
   const body = action==='prepare' ? {action,brief,policy,...(uncertainty.trim()?{uncertainty}: {})} : {action,findings:JSON.parse(findings)};
   const response=await fetch('/api/admin/library/architecture/research',{method:'POST',headers:{'Content-Type':'application/json','x-admin-email':email},body:JSON.stringify(body)});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.error==='string'?data.error:JSON.stringify(data.error));
   setResult(JSON.stringify(data,null,2));
   if(action==='preview') {
    setPreviewed(findings);
    setSources(data.proposals.flatMap((p:{entry:{sources:{reference:string;note:string}[]}})=>p.entry.sources.map(s=>({url:s.reference,title:s.note}))));
   }
   if(action==='propose')setPreviewed('');
  }catch(error){setResult(String(error));}finally{setBusy(false);}
 }
 return <details className="rounded-xl border border-white/10 p-3 text-sm">
  <summary>Architectural research · offline preparation</summary>
  <p className="my-2 text-xs text-neutral-400">Check approved knowledge first, prepare up to two targeted queries, then preview cited findings. No web search or AI call runs here. Saved findings remain proposed until reviewed through architectural knowledge approval.</p>
  <label className="block">Design brief<textarea className="block w-full bg-neutral-900 p-2" value={brief} onChange={e=>setBrief(e.target.value)} /></label>
  <label className="block">Knowledge gap or uncertain regional detail (optional)<input className="block w-full bg-neutral-900 p-2" maxLength={300} value={uncertainty} onChange={e=>setUncertainty(e.target.value)} /></label>
  <label>Research preparation policy <select className="bg-neutral-900" value={policy} onChange={e=>setPolicy(e.target.value)}><option value="off">Off</option><option value="on-request">When explicitly requested</option><option value="when-needed">Suggest when knowledge is missing</option></select></label>
  <button className="m-2 underline" disabled={busy||!brief.trim()} onClick={()=>void submit('prepare')}>Prepare research</button>
  <button className="m-2 underline" disabled={busy} onClick={()=>{setFindings(JSON.stringify([researchIntakeFixture],null,2));setPreviewed('');setSources([]);setResult('Developer-prepared shading example. Review the source and local applicability before proposing; it remains unapproved.');}}>Load cited shading example</button>
  <label className="block">Cited findings JSON<textarea className="block w-full bg-neutral-900 p-2" rows={5} value={findings} onChange={e=>{setFindings(e.target.value);setPreviewed('');setSources([]);}} /></label>
  <button className="m-2 underline" disabled={busy||!findings.trim()} onClick={()=>void submit('preview')}>Preview proposals</button>
  <button className="m-2 underline" disabled={busy||!previewed||previewed!==findings} onClick={()=>void submit('propose')}>Save unapproved proposals</button>
  {sources.map((s,i)=><a key={`${s.url}-${i}`} className="block truncate text-xs underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a>)}
  {result&&<pre role="status" className="max-h-72 overflow-auto whitespace-pre-wrap text-xs">{result}</pre>}
 </details>;
}
