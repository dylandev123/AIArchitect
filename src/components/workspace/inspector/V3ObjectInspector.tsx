"use client";

import { editArchitecturalBuildingPlacement } from "@/lib/v3/architecturalPlanEdits";
import { ArchitecturalFootprintEditor } from "./ArchitecturalFootprintEditor";
import { ArchitecturalDatumInspector } from "./ArchitecturalDatumInspector";
import { useActiveV3RenderSource } from "@/store/useActiveV3RenderSource";
import { useState } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { isV3ProjectRoot } from "@/lib/v3/scene";
import { architectureFromRuntimeGeometry } from "@/lib/v3/architecture";
import { executeV3SceneOperations, type V3SceneOperation } from "@/lib/v3/operations";
import { resolveV3SelectionTarget } from "@/lib/v3/interiorWalls";

export function V3ObjectInspector({ projectId, objectId }: { projectId: string; objectId: string }) {
  const json = useProjectStore(s => s.getProject(projectId)?.houseConfigJson);
  const activeSource = useActiveV3RenderSource(projectId, json);
  const appendVersion = useProjectStore(s => s.appendVersion);
  const selectKey = useSceneStore(s => s.selectKey);
  const [error, setError] = useState<string>();
  let root;
  try { root = JSON.parse(json ?? '{}'); } catch { return null; }
  if (!isV3ProjectRoot(root)) return null;
  const object = root.v3Scene.objects.find(o => o.id === objectId);
  if (!object) {
    if(root.v3Scene.interior?.rooms.some(r=>r.id===objectId)||root.v3Scene.interior?.storeys.some(s=>s.id===objectId))return <ArchitecturalDatumInspector key={objectId} projectId={projectId} id={objectId} scene={root.v3Scene} root={root} readOnly={activeSource.source!=='persisted'}/>;
    const host=root.v3Scene.objects.find(o=>o.composition?.openings?.some(op=>op.id===objectId));
    const opening=host?.composition?.openings?.find(op=>op.id===objectId);
    if(host&&opening){
      const fields=opening.type==='opening-rhythm'?['count','width','height','sill']:opening.type==='glazing-zone'?['start','end','heightRatio']:['start','end','height'];
      const update=(field:string,value:string|number)=>{
        if(activeSource.source!=='persisted')return;
        const composition={...host.composition!,openings:host.composition!.openings!.map(op=>op.id===opening.id?{...op,[field]:value}:op)};
        const result=executeV3SceneOperations(root.v3Scene,{intent:`Refine facade opening ${opening.id}`,operations:[{op:'setComposition',target:host.id,composition}]});
        setError(result.errors[0]);
        if(result.ok)appendVersion(projectId,`Refine ${opening.id}`,JSON.stringify({...root,v3Scene:result.scene}),'v3-opening-inspector');
      };
      const diagnostics=(root.v3Scene.metadata.architecturalValidation as {diagnostics?:{targetIds:string[];message:string}[]}|undefined)?.diagnostics?.filter(f=>f.targetIds.includes(opening.id))??[];
      return <div className="space-y-3 p-4 text-xs text-neutral-400">
        <h3 className="text-sm font-semibold text-neutral-100">Facade opening · {opening.id}</h3>
        <p>{host.label} · {opening.facade} · {opening.floors??'all'} · {opening.type}</p>
        {diagnostics.length>0&&<p className="rounded border border-amber-400/40 p-2 text-amber-200">Unresolved intent is retained. Amber wall sections are placeholders; conflicting cuts are withheld until refinement.</p>}
        {fields.map(field=><label key={field} className="block">{field}<input aria-label={`Opening ${field}`} type="number" step={field==='count'?'1':'0.01'} value={(opening as unknown as Record<string,number>)[field]??2.4} disabled={activeSource.source!=='persisted'} onChange={e=>update(field,e.target.valueAsNumber)} className="ml-2 rounded bg-neutral-800 p-1"/></label>)}
        <label className="block">Facade <select aria-label="Opening facade" value={opening.facade} disabled={activeSource.source!=='persisted'} onChange={e=>update('facade',e.target.value)} className="rounded bg-neutral-800 p-1">{['north','east','south','west'].map(f=><option key={f}>{f}</option>)}</select></label>
        <label className="block">Floors <select aria-label="Opening floors" value={opening.floors??'all'} disabled={activeSource.source!=='persisted'} onChange={e=>update('floors',e.target.value)} className="rounded bg-neutral-800 p-1">{['all','ground','upper'].map(f=><option key={f}>{f}</option>)}</select></label>
        {diagnostics.map((f,i)=><p key={i} className="text-amber-200">{f.message}</p>)}
        {error&&<p role="alert" className="text-red-300">{error}</p>}
      </div>;
    }
    // Derived interior walls select their semantic partition/door; those are shown, never edited as geometry here.
    const target = resolveV3SelectionTarget(root.v3Scene, objectId);
    const datum = target?.kind === "partition" ? root.v3Scene.interior?.partitions?.find(p => p.id === target.id) : target?.kind === "door" ? root.v3Scene.interior?.doors?.find(d => d.id === target.id) : undefined;
    if (!target || !datum) return null;
    const editDoor=(field:'offset'|'width',value:number)=>{
      const door=root.v3Scene.interior?.doors?.find(d=>d.id===target.id);
      if(!door||activeSource.source!=='persisted')return;
      const result=executeV3SceneOperations(root.v3Scene,{intent:'Refine door',operations:[{op:'setDoor',door:{...door,[field]:value}}]});
      setError(result.errors[0]);
      if(result.ok)appendVersion(projectId,'Refine door',JSON.stringify({...root,v3Scene:result.scene}),'v3-door-inspector');
    };
    return <div className="space-y-2 p-4 text-xs text-neutral-400">
      <h3 className="text-sm font-semibold text-neutral-100">{datum.semanticRole}</h3>
      <p>{target.kind === "partition" ? `Partition · ${"partitionType" in datum ? datum.partitionType : ""}` : `Door · ${"program" in datum ? datum.program : ""}`} <span className="text-neutral-500">({datum.id})</span></p>
      <p>Wall geometry is derived from this {target.kind}.</p>
      {target.kind==='door'&&'width' in datum&&(['offset','width'] as const).map(field=><label key={field} className="block">{field} (m)<input aria-label={`Door ${field}`} type="number" step="0.05" value={datum[field]} disabled={activeSource.source!=='persisted'} onChange={e=>editDoor(field,e.target.valueAsNumber)} className="ml-2 rounded bg-neutral-800 p-1"/></label>)}
      {error&&<p role="alert" className="text-red-300">{error}</p>}
    </div>;
  }
  if (activeSource.source !== "persisted") return <p className="p-4 text-xs text-neutral-400">Return to the saved scene to edit this object.</p>;
  const geometry = object.architecture ?? architectureFromRuntimeGeometry(object);
  const apply = (operation: V3SceneOperation) => {
    const placement = operation.op==='editArchitecture'&&object.type==='building-mass'&&root.v3Scene.metadata.architecturalValidation&&Object.keys(operation.architecture).every(k=>['x','z','baseElevation','rotationY'].includes(k));
    const result = placement && operation.op==='editArchitecture'
      ? editArchitecturalBuildingPlacement(root.v3Scene,object.id,operation.architecture)
      : executeV3SceneOperations(root.v3Scene, { intent: `Edit ${object.label}`, operations: [operation] });
    setError(result.errors[0]);
    if (result.ok) appendVersion(projectId, `Edit ${object.label}`, JSON.stringify({ ...root, v3Scene: result.scene }), 'v3-semantic-inspector');
  };
  return <div className="space-y-4 p-4">
    <h3 className="text-sm font-semibold text-neutral-100">{object.label}</h3>
    {object.type==='building-mass'&&<div className="flex flex-wrap gap-2">{root.v3Scene.interior?.storeys.filter(s=>s.hostMassId===object.id).map(s=><button key={s.id} className="text-xs text-neutral-300 underline" onClick={()=>selectKey(s.id)}>{s.label} · {s.height}m</button>)}</div>}
    {(['x', 'z', 'baseElevation', 'width', 'depth', 'height', 'rotationY'] as const).map(key => <label key={key} className="block text-xs text-neutral-400">
      {key === 'baseElevation' ? 'Base elevation' : key === 'rotationY' ? 'Rotation (radians)' : key[0].toUpperCase() + key.slice(1)}
      <input type="number" step="0.1" value={geometry[key] ?? 0} onChange={event => apply({ op: 'editArchitecture', target: object.id, architecture: { [key]: event.target.valueAsNumber } })} className="mt-1 w-full rounded-md border border-white/10 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-200" />
    </label>)}
    {object.type==='building-mass'&&root.v3Scene.metadata.architecturalValidation&&<ArchitecturalFootprintEditor key={`${object.id}-${json}`} scene={root.v3Scene} object={object} onSave={scene=>appendVersion(projectId,'Refine 2D footprint',JSON.stringify({...root,v3Scene:scene}),'v3-plan-footprint')}/>}
    <label className="block text-xs text-neutral-400">Color <input type="color" value={object.material.color} onChange={event => apply({ op: 'changeMaterial', target: object.id, material: { ...object.material, color: event.target.value } })} /></label>
    <button className="mr-4 text-xs text-neutral-300" onClick={() => apply({ op: 'duplicate', target: object.id, id: `${object.id}-${crypto.randomUUID()}`, position: [geometry.x + geometry.width + 1, geometry.baseElevation + geometry.height / 2, geometry.z] })}>Duplicate</button>
    <button className="text-xs text-red-400" onClick={() => { apply({ op: 'delete', target: object.id }); selectKey(null); }}>Delete</button>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </div>;
}
