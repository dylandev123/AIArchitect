'use client';
import { isV3PlanEvaluation } from '@/lib/v3/architecturalPlanEvaluation';
import { PlanEvaluationControls } from './PlanEvaluationControls';
import type { V3Scene } from '@/lib/v3/scene';
import { DEFAULT_ARCHITECTURAL_VIEW } from '@/lib/v3/architecturalPlanning';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import type { ArchitecturalWorkspaceView } from '@/types/project';

export function ArchitecturalViewControls({projectId,scene}:{projectId:string;scene:V3Scene}) {
  const evaluation=isV3PlanEvaluation(scene);
  const view=useProjectStore(s=>s.getProject(projectId)?.architecturalView)??DEFAULT_ARCHITECTURAL_VIEW;
  const activeMode=evaluation?'floor-plan':view.mode;
  const update=useProjectStore(s=>s.setArchitecturalView);
  const floors=[...new Set(scene.interior?.storeys.map(s=>s.index)??[])].sort((a,b)=>a-b);
  const switchMode=(mode:ArchitecturalWorkspaceView['mode'])=>{
    useSceneStore.getState().setWalkMode(false);
    useSceneStore.getState().exitRoom({camera:false});
    update(projectId,{mode});
  };
  return <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-4.5rem)] flex-col gap-2" data-testid="architectural-view-controls">
    <div className="flex flex-wrap gap-1 rounded-xl border border-white/15 bg-neutral-900/95 p-1 shadow-lg" role="group" aria-label="Architectural workspace view">
      {([['floor-plan','2D Floor Plan'],['massing','3D Massing'],['blueprint','3D Blueprint'],['finished','Finished House']] as const).map(([mode,label])=><button key={mode} type="button" disabled={evaluation&&mode!=='floor-plan'} aria-pressed={activeMode===mode} onClick={()=>switchMode(mode)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${activeMode===mode?'bg-[#d4e4c5] text-[#213a32]':'text-neutral-300 hover:bg-white/10'}`}>{label}</button>)}
    </div>
    {evaluation&&<PlanEvaluationControls projectId={projectId} scene={scene}/> }
    {activeMode!=='finished'&&<div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-neutral-900/95 px-3 py-2 text-xs text-neutral-300 shadow-lg">
      <label>Drawing <select aria-label="Plan floor" className="ml-2 rounded bg-neutral-800 px-2 py-1" value={view.floor??'site'} onChange={e=>update(projectId,{floor:e.target.value==='site'?null:Number(e.target.value)})}><option value="site">Estate master plan</option>{floors.map(i=><option key={i} value={i}>{i===0?'Ground floor':`Level ${i}`}</option>)}</select></label>
      {activeMode==='floor-plan'&&<label>Scope <select aria-label="Plan building" className="ml-2 rounded bg-neutral-800 px-2 py-1" value={view.buildingId??'site'} onChange={e=>update(projectId,{buildingId:e.target.value==='site'?null:e.target.value})}><option value="site">Full estate</option>{scene.objects.filter(o=>o.type==='building-mass').map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>}
      {activeMode==='blueprint'&&<label className="flex items-center gap-2"><input type="checkbox" checked={view.cutaway} onChange={e=>update(projectId,{cutaway:e.target.checked})}/>Cutaway / hide roofs</label>}
      <span className="text-[10px] text-neutral-500">One design · metres</span>
    </div>}
  </div>;
}
