'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/store/useProjectStore';
import { requestPlanEvaluation, PlanEvaluationError, type PlanResponseRecovery, type PlanEvaluationConfig } from '@/lib/ai/planClient';
import { isStorageQuotaError } from '@/lib/storage/projectStorage';

export function Design2DPlan() {
  const router=useRouter();
  const [config,setConfig]=useState<PlanEvaluationConfig|null>(null),[brief,setBrief]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{fetch('/api/ai/plan',{cache:'no-store'}).then(r=>r.json()).then(setConfig).catch(()=>{});},[]);
  const [recovery,setRecovery]=useState<PlanResponseRecovery|null>(null);
  if(!config?.enabled)return null;
  const design=async()=>{
    if(busy||!brief.trim())return;
    setBusy(true);setError('');setRecovery(null);
    // Always a fresh project; never reuse a saved/recovered design.
    const previousProjects=useProjectStore.getState().projects;
    let created=false;
    try{
      const project=useProjectStore.getState().createProject('2D evaluation · '+brief.trim().slice(0,48),'house','v3-scene','flat');
      created=true;
      await requestPlanEvaluation(project.id,'design',brief.trim());router.push(`/workspace/${project.id}`);
    }
    catch(e){
      if(!created&&isStorageQuotaError(e)){
        try{useProjectStore.setState({projects:previousProjects});}catch{/* Restore memory if persistence is still unavailable. */}
        setError('Browser project storage is full (QuotaExceededError). The new project could not be saved, so no AI request was sent.');
      }else setError(String(e));
      if(e instanceof PlanEvaluationError)setRecovery(e.recovery??null);
    }finally{setBusy(false);}
  };
  return <section className="mb-8 w-full max-w-6xl rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
    <p className="font-medium text-emerald-200">Design 2D Plan · evaluation</p>
    <p className="mt-1 text-xs text-neutral-400">One Terra call, no automatic repair. Inspect and save a flat estate plan before deciding on 3D. Exterior design is deferred.</p>
    <textarea aria-label="2D architectural brief" value={brief} disabled={busy} onChange={e=>setBrief(e.target.value)} placeholder="A courtyard estate with a guest pavilion, pool and private garden…" className="mt-3 w-full rounded bg-neutral-900 p-3 text-sm text-white"/>
    <button onClick={()=>void design()} disabled={busy||!brief.trim()} className="mt-2 rounded-lg bg-emerald-200 px-4 py-2 text-sm text-neutral-950 disabled:opacity-50">{busy?'Designing 2D plan…':'Design 2D Plan'}</button>
    {recovery&&<a className="mt-2 block text-xs text-emerald-200 underline" download={`plan-response-${recovery.sha256}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(recovery.rawResponse)}`}>Download {recovery.redacted?'redacted':'original'} response · SHA-256 {recovery.sha256}</a>}
    {error&&<p role="alert" className="mt-2 whitespace-pre-wrap text-xs text-red-300">{error}</p>}
  </section>;
}
