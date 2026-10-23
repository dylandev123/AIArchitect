'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { V3Scene } from '@/lib/v3/scene';
import type { V3BlueprintFinding } from '@/lib/v3/blueprint';
import { checkoutPlanEvaluation, preparePlanEvaluation, planExteriorPrompt, DEFAULT_PLAN_EXTERIOR_REQUEST, unresolvedPlanItems } from '@/lib/v3/architecturalPlanEvaluation';
import { planConstructionBlockers } from '@/lib/v3/architecturalPlanFirst';
import { ARCHITECTURAL_REVIEW_QUESTIONS } from '@/lib/v3/architecturalPlanReview';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { requestPlanEvaluation, type PlanEvaluationConfig, type PlanResponseRecovery } from '@/lib/ai/planClient';

const subscribeToCaptures=(changed:()=>void)=>{
  window.addEventListener('storage',changed);
  return ()=>window.removeEventListener('storage',changed);
};

export function PlanEvaluationControls({projectId,scene}:{projectId:string;scene:V3Scene}) {
  const [collapsed,setCollapsed]=useState(false),[editing,setEditing]=useState(false),[text,setText]=useState(''),[building,setBuilding]=useState(false),[decisions,setDecisions]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [config,setConfig]=useState<PlanEvaluationConfig|null>(null),[localFindings,setLocalFindings]=useState<V3BlueprintFinding[]|null>(null),[editorBase,setEditorBase]=useState('');
  const recoveryText=useSyncExternalStore(subscribeToCaptures,()=>{
    try{return localStorage.getItem(`ai-architect-plan-response:${scene.metadata.planResponseSha256}`);}catch{return null;}
  },()=>null);
  const recovery=useMemo<PlanResponseRecovery|null>(()=>{try{return JSON.parse(recoveryText??'null');}catch{return null;}},[recoveryText]);
  useEffect(()=>{fetch('/api/ai/plan',{cache:'no-store'}).then(r=>r.json()).then(setConfig).catch(()=>{});},[]);
  const current=useMemo(()=>checkoutPlanEvaluation(scene),[scene]);
  const findings=editing&&localFindings?localFindings:current.findings;
  const openEditor=()=>{
    const current=checkoutPlanEvaluation(scene);
    if(!current.plan){setError(current.findings.map(f=>`${f.code}: ${f.message}`).join('\n'));return;}
    setText(JSON.stringify(current.plan,null,2));setEditorBase(JSON.stringify(scene));setLocalFindings(null);setEditing(true);setBuilding(false);setError('');
  };
  const save=()=>{
    try{
      const checked=preparePlanEvaluation(JSON.parse(text));setLocalFindings(checked.findings);
      if(!checked.ok||!checked.scene){setError('Resolve blocking diagnostics before saving. The saved plan is preserved.');return;}
      const store=useProjectStore.getState(),project=store.getProject(projectId);
      // The editor is a temporary draft. Reject if another tool changed its saved base.
      if(!project||JSON.stringify(JSON.parse(project.houseConfigJson).v3Scene)!==editorBase)throw Error('The saved plan changed. Reopen the editor to use the current plan.');
      store.appendVersion(projectId,'Edited 2D evaluation plan',JSON.stringify({...JSON.parse(project.houseConfigJson),v3Scene:{...checked.scene,metadata:{...scene.metadata,...checked.scene.metadata,planDiagnostics:checked.findings}}}),'local-plan-edit');
      setEditing(false);setError('');
    }catch(e){setError(String(e));}
  };
  const unresolved=unresolvedPlanItems(scene),blockers=planConstructionBlockers(current);
  const inputEstimate=Math.ceil((planExteriorPrompt().length+JSON.stringify(current.plan??{}).length+(decisions.trim()||DEFAULT_PLAN_EXTERIOR_REQUEST).length+(typeof scene.metadata.brief==='string'?scene.metadata.brief.length:0)+200)/4);
  const estimate=config?.pricing?((inputEstimate*config.pricing.input+config.maxOutputTokens*config.pricing.output)/1000000):null;
  const build=async()=>{
    if(busy||!current.ok||blockers.length)return;
    setBusy(true);setError('');
    try{await requestPlanEvaluation(projectId,'elaborate',decisions.trim());}
    catch(e){setError(String(e));}finally{setBusy(false);}
  };
  if(collapsed)return <button onClick={()=>setCollapsed(false)} className="rounded-lg border border-emerald-300/30 bg-neutral-950/95 px-3 py-2 text-xs text-emerald-200">Show 2D plan panel{unresolved.length>0?` · ${unresolved.length} unresolved`:''}</button>;
  return <div className="max-w-lg rounded-lg border border-emerald-300/30 bg-neutral-950/95 p-3 text-xs text-neutral-200">
    <div className="flex items-start justify-between gap-3"><p className="font-semibold text-emerald-200">2D blueprint saved{current.ok&&blockers.length===0?' · Ready for exterior development':' · Review construction findings'}</p><button onClick={()=>setCollapsed(true)} className="underline">Hide panel</button></div>
    <p className="mt-1">Terra develops your saved blueprint into an exterior, then V3 builds the editable property. Local edits and saving use no AI calls.</p>
    {recovery&&<a className="mt-2 block underline" download={`plan-response-${recovery.sha256}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(recovery.rawResponse)}`}>Download {recovery.redacted?'redacted':'original'} response · SHA-256 {recovery.sha256}</a>}
    <div className="mt-2 flex gap-2"><button disabled={busy} onClick={openEditor} className="rounded border border-white/30 px-2 py-1">Edit and save 2D plan</button><button disabled={busy||!config?.enabled} onClick={()=>{setBuilding(true);setEditing(false);setError('');}} className="rounded bg-emerald-200 px-2 py-1 text-neutral-950">Build in 3D</button></div>
    {unresolved.length>0&&<div role="status" className="mt-2 rounded border border-amber-300/40 p-2 text-amber-100"><p className="font-semibold">{unresolved.length} unresolved plan {unresolved.length===1?'object':'objects'} · not drawn</p><p className="mt-1">Everything else is drawn and editable. Each is kept exactly as Terra authored it; nothing was retargeted or invented.</p>{unresolved.map(i=><p key={`${i.kind}:${i.id}`} className="mt-1 text-amber-200/90"><b>{i.kind} {i.id}</b> — {i.findings[0]?.message}</p>)}<button disabled={busy} onClick={openEditor} className="mt-2 underline">Correct them in the plan editor</button></div>}
    <details className="mt-2 max-h-36 overflow-auto"><summary>2D diagnostics ({findings.length})</summary>{findings.map((f,i)=><p key={i} className="mt-2">{f.severity} · {f.code}: {f.message} {f.targetIds.map(id=><button key={id} onClick={()=>useSceneStore.getState().selectKey(id)} className="mr-1 underline">{id}</button>)}</p>)}</details>
    <details className="mt-2 max-h-48 overflow-auto"><summary>Review the architecture</summary><p className="mt-2">Diagnostics check conceptual geometry and possible access. They do not certify a walkable finished house or exceptional design. Review the drawing against your brief before approving it.</p>{ARCHITECTURAL_REVIEW_QUESTIONS.map(question=><p key={question} className="mt-2">{question}</p>)}</details>
    {editing&&<div className="mt-2"><p>Edit footprints, locations, room zones, entrances, routes or outdoor features in the existing V3 plan contract. Save creates an undoable project version.</p><textarea aria-label="2D evaluation plan JSON" value={text} onChange={e=>setText(e.target.value)} className="mt-2 h-64 w-full rounded bg-neutral-800 p-2 font-mono text-[10px]"/><button onClick={save} className="mt-2 rounded bg-emerald-200 px-3 py-1 text-neutral-950">Save 2D plan</button><button onClick={()=>setEditing(false)} className="ml-3 underline">Cancel</button></div>}
    {building&&<div className="mt-2 space-y-2">{blockers.length>0&&<div role="status"><p className="font-semibold text-amber-200">These saved plan objects need correction before construction. No AI call will run.</p>{blockers.map((f,i)=><p key={i} className="mt-1 text-amber-200">{f.targetIds.join(', ')}: {f.message}</p>)}</div>}<p>Terra uses this exact saved plan and its concept and requirements to choose roofs, materials, glazing, shade and missing outdoor heights. Your approved layout stays fixed. Detailed interior design is deferred.</p><details><summary>Exterior preferences (optional)</summary><textarea aria-label="Exterior preferences (optional)" value={decisions} disabled={busy} onChange={e=>setDecisions(e.target.value)} placeholder="Leave blank for Terra to develop the exterior." className="mt-2 h-20 w-full rounded bg-neutral-800 p-2"/></details><p>Requires one additional AI call, no automatic retry. {estimate===null?'Cost unknown: no configured model price.':`Configured ${config?.model} estimate: about $${estimate.toFixed(3)} USD with the full ${config?.maxOutputTokens.toLocaleString()} output-token budget and ~${inputEstimate.toLocaleString()} estimated input tokens. Actual tokens and billing vary; this is not a guaranteed cap.`} No call runs until you press the button below.</p><button disabled={busy||!config?.enabled||!current.ok||blockers.length>0} onClick={()=>void build()} className="rounded bg-amber-200 px-3 py-2 text-neutral-950 disabled:opacity-50">{busy?'Terra is developing and building your property…':'Confirm Build in 3D · 1 AI call'}</button><button disabled={busy} onClick={()=>setBuilding(false)} className="ml-3 underline">Cancel</button></div>}
    {error&&<p role="alert" className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-red-300">{error}</p>}
  </div>;
}
