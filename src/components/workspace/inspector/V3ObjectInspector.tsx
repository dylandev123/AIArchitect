"use client";

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
    // Derived interior walls select their semantic partition/door; those are shown, never edited as geometry here.
    const target = resolveV3SelectionTarget(root.v3Scene, objectId);
    const datum = target?.kind === "partition" ? root.v3Scene.interior?.partitions?.find(p => p.id === target.id) : target?.kind === "door" ? root.v3Scene.interior?.doors?.find(d => d.id === target.id) : undefined;
    if (!target || !datum) return null;
    return <div className="space-y-2 p-4 text-xs text-neutral-400">
      <h3 className="text-sm font-semibold text-neutral-100">{datum.semanticRole}</h3>
      <p>{target.kind === "partition" ? `Partition · ${"partitionType" in datum ? datum.partitionType : ""}` : `Door · ${"program" in datum ? datum.program : ""}`} <span className="text-neutral-500">({datum.id})</span></p>
      <p>Wall geometry is derived from this {target.kind}; edit the {target.kind}, not the rendered wall.</p>
    </div>;
  }
  if (activeSource.source !== "persisted") return <p className="p-4 text-xs text-neutral-400">Return to the saved scene to edit this object.</p>;
  const geometry = object.architecture ?? architectureFromRuntimeGeometry(object);
  const apply = (operation: V3SceneOperation) => {
    const result = executeV3SceneOperations(root.v3Scene, { intent: `Edit ${object.label}`, operations: [operation] });
    setError(result.errors[0]);
    if (result.ok) appendVersion(projectId, `Edit ${object.label}`, JSON.stringify({ ...root, v3Scene: result.scene }), 'v3-semantic-inspector');
  };
  return <div className="space-y-4 p-4">
    <h3 className="text-sm font-semibold text-neutral-100">{object.label}</h3>
    {(['x', 'z', 'baseElevation', 'width', 'depth', 'height', 'rotationY'] as const).map(key => <label key={key} className="block text-xs text-neutral-400">
      {key === 'baseElevation' ? 'Base elevation' : key === 'rotationY' ? 'Rotation (radians)' : key[0].toUpperCase() + key.slice(1)}
      <input type="number" step="0.1" value={geometry[key] ?? 0} onChange={event => apply({ op: 'editArchitecture', target: object.id, architecture: { [key]: event.target.valueAsNumber } })} className="mt-1 w-full rounded-md border border-white/10 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-200" />
    </label>)}
    <label className="block text-xs text-neutral-400">Color <input type="color" value={object.material.color} onChange={event => apply({ op: 'changeMaterial', target: object.id, material: { ...object.material, color: event.target.value } })} /></label>
    <button className="mr-4 text-xs text-neutral-300" onClick={() => apply({ op: 'duplicate', target: object.id, id: `${object.id}-${crypto.randomUUID()}`, position: [geometry.x + geometry.width + 1, geometry.baseElevation + geometry.height / 2, geometry.z] })}>Duplicate</button>
    <button className="text-xs text-red-400" onClick={() => { apply({ op: 'delete', target: object.id }); selectKey(null); }}>Delete</button>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </div>;
}
