'use client';
import { useState } from 'react';
import type { V3Scene } from '@/lib/v3/scene';
import { executeV3SceneOperations } from '@/lib/v3/operations';
import { editArchitecturalStoreyHeight } from '@/lib/v3/architecturalPlanEdits';
import { useProjectStore } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { reviseDraftRoomLayout } from '@/lib/v3/architecturalPlanEvaluation';
import type { RoomLayoutDraft } from '@/lib/v3/roomLayout';

export function ArchitecturalDatumInspector({projectId,id,scene,root,readOnly}:{projectId:string;id:string;scene:V3Scene;root:object;readOnly:boolean}) {
  const [error,setError]=useState('');
  const room=scene.interior?.rooms.find(r=>r.id===id),storey=scene.interior?.storeys.find(s=>s.id===(room?.storeyId??id));
  const draft=Array.isArray(scene.metadata.roomLayoutDrafts)?(scene.metadata.roomLayoutDrafts as RoomLayoutDraft[]).find(d=>d.storeyId===storey?.id):undefined;
  const [layoutText,setLayoutText]=useState(()=>draft?JSON.stringify({spaces:draft.spaces,layout:draft.layout},null,2):'');
  const append=useProjectStore(s=>s.appendVersion),select=useSceneStore(s=>s.selectKey);
  if(!storey)return null;
  const save=(result:{ok:boolean;scene:V3Scene;errors:string[]})=>{
    setError(result.errors[0]??'');
    if(result.ok)try{append(projectId,`Refine ${room?.label??storey.label}`,JSON.stringify({...root,v3Scene:result.scene}),'v3-planning-inspector');}catch(e){setError(String(e));}
  };
  return <div className="space-y-3 p-4 text-xs text-neutral-400">
    <h3 className="text-sm font-semibold text-neutral-100">{room?.label??storey.label}</h3>
    <p>{room?'Functional room extent':'Authored storey'} · {storey.label}</p>
    {draft&&<details open className="space-y-2">
      <summary className="text-amber-200">Draft room organization needs refinement</summary>
      <p>{draft.findings[0]?.message} Adjust the room organization below, then develop its boundaries.</p>
      <textarea aria-label="Draft room organization" value={layoutText} disabled={readOnly} onChange={e=>setLayoutText(e.target.value)} className="h-64 w-full rounded bg-neutral-800 p-2 font-mono text-[10px]"/>
      <button disabled={readOnly} className="underline" onClick={()=>{
        try{
          const result=reviseDraftRoomLayout(scene,storey.id,JSON.parse(layoutText));
          if(result.ok&&result.scene)save({ok:true,scene:result.scene,errors:[]});
          else setError(result.findings[0]?.message??'Room organization could not be developed.');
        }catch(e){setError(String(e));}
      }}>Develop room boundaries</button>
    </details>}
    {room?<>
      <p>Room extents define functional space. Built walls follow explicit partitions. Coordinated edits must keep shared boundaries and openings valid.</p>
      {(['x','z','width','depth'] as const).map(field=><label key={field} className="block">{field} (m)<input aria-label={`Room ${field}`} type="number" step="0.1" value={room.footprint[field]} disabled={readOnly} className="ml-2 w-24 rounded bg-neutral-800 p-1" onChange={e=>save(executeV3SceneOperations(scene,{intent:'Refine functional room extent',operations:[{op:'editRoom',target:id,room:{footprint:{...room.footprint,[field]:e.target.valueAsNumber}}}]}))}/></label>)}
      <button className="underline" onClick={()=>select(storey.id)}>Inspect this storey</button>
    </>:<>
      <label className="block">Floor-to-floor height (m)<input aria-label="Storey height" type="number" step="0.1" value={storey.height} disabled={readOnly} className="ml-2 w-24 rounded bg-neutral-800 p-1" onChange={e=>save(editArchitecturalStoreyHeight(scene,id,e.target.valueAsNumber))}/></label>
      <p>Height edits use supported architectural replanning. Slab datums, mass height and host roof update together. Unsupported round trips are refused with the saved scene retained.</p>
    </>}
    <p>Wall dragging is not available. Use semantic dimensions or the scene JSON for coordinated changes.</p>
    {error&&<p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
