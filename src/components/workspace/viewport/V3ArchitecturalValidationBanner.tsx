"use client";

import { useState } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { useActiveV3RenderSource } from '@/store/useActiveV3RenderSource';
import { useSceneStore } from '@/store/useSceneStore';
import { isV3ProjectRoot } from '@/lib/v3/scene';
import { revalidateArchitecturalScene, type ArchitecturalValidationState } from '@/lib/v3/architecturalAcceptance';

export function V3ArchitecturalValidationBanner({projectId}:{projectId:string}) {
  const json = useProjectStore(s=>s.getProject(projectId)?.houseConfigJson);
  const active = useActiveV3RenderSource(projectId,json);
  const append = useProjectStore(s=>s.appendVersion);
  const select = useSceneStore(s=>s.selectKey);
  const [error,setError] = useState('');
  let root;
  try { root=JSON.parse(json??'{}'); } catch { return null; }
  if (!isV3ProjectRoot(root)) return null;
  if(active.source==='failed-preview')return null;
  const state=active.scene?.metadata.architecturalValidation as ArchitecturalValidationState|undefined;
  if (!state || state.version!==1 || !['draft','complete'].includes(state.status) || !Array.isArray(state.diagnostics)) return null;
  const revalidate = () => {
    const result=revalidateArchitecturalScene(root.v3Scene);
    if (!result.ok) { setError(`Cannot Construct: ${result.findings.find(f=>f.severity==='fatal')?.message}`); return; }
    try { append(projectId,result.outcome==='complete'?'Revalidated — Complete':'Revalidated draft',JSON.stringify({...root,v3Scene:result.scene}),'architectural-revalidation'); setError(''); }
    catch(e) { setError(String(e)); }
  };
  return <div className="pointer-events-auto absolute left-4 top-32 z-10 max-w-md rounded-xl border border-amber-300/40 bg-neutral-950/90 p-3 text-xs text-neutral-100 shadow-xl">
    <p className="font-semibold">{state.status==='draft'?'Draft — Needs Refinement':'Complete'}</p>
    {state.status==='draft' && <p className="mt-1 text-amber-100">Not fully validated. Edit the details below, then revalidate. This is not a certified design.</p>}
    <details className="mt-2 max-h-52 overflow-auto"><summary>Object diagnostics ({state.diagnostics.length})</summary>
      {state.diagnostics.map((f,i)=><div key={i} className="mt-2 border-t border-white/10 pt-2"><p>{f.code}: {f.message}</p><p className="text-neutral-400">{f.classification}</p>{f.targetIds.map(id=><button key={id} type="button" onClick={()=>select(id)} className="mr-2 underline">{id}</button>)}</div>)}
    </details>
    {active.source==='render-history'&&<p className="mt-2 text-neutral-400">Viewing a saved render. Return to the current scene to refine it.</p>}
    {active.source==='persisted'&&<button type="button" onClick={revalidate} className="mt-2 rounded border border-white/30 px-2 py-1">Revalidate construction</button>}
    {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
  </div>;
}
