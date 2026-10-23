'use client';
import { useState } from 'react';
import type { V3Scene, V3SceneObject } from '@/lib/v3/scene';
import { editArchitecturalBuildingFootprint } from '@/lib/v3/architecturalPlanEdits';

export function ArchitecturalFootprintEditor({scene,object,onSave}:{scene:V3Scene;object:V3SceneObject;onSave:(scene:V3Scene)=>void}) {
  const footprint=object.composition?.footprint,geometry=object.architecture;
  const plan=footprint?.kind==='outline'?{kind:'outline',segments:footprint.segments}:footprint?{kind:'articulated',width:geometry?.width,depth:geometry?.depth,operations:footprint.operations}:{kind:'rectangle',width:geometry?.width,depth:geometry?.depth};
  const [raw,setRaw]=useState(()=>JSON.stringify(plan,null,2)),[error,setError]=useState<string>();
  const apply=()=>{
    try{
      const result=editArchitecturalBuildingFootprint(scene,object.id,JSON.parse(raw));
      if(!result.ok){setError(result.errors[0]);return;}
      setError(undefined);onSave(result.scene);
    }catch{setError('Enter valid footprint JSON.');}
  };
  return <details className="space-y-2 text-xs text-neutral-300">
    <summary className="cursor-pointer">Edit 2D footprint</summary>
    <p className="mt-2">Metres in the building frame. Walls, floors, entrance contacts and the hosted roof follow this outline.</p>
    <textarea aria-label="2D footprint JSON" rows={9} className="mt-2 w-full rounded bg-neutral-800 p-2 font-mono text-[11px]" value={raw} onChange={e=>setRaw(e.target.value)}/>
    <button type="button" onClick={apply} className="rounded bg-neutral-700 px-3 py-2">Apply footprint</button>
    {error&&<p role="alert" className="text-red-300">{error}</p>}
  </details>;
}
