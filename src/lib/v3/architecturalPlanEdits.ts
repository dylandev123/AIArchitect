import type { V3Scene } from './scene';
import { checkoutV3ArchitecturalBlueprint, reviseV3ArchitecturalBlueprint, v3ArchitecturalBlueprintSchema } from './architecturalBlueprint';

/** Reuses lossless checkout/replan: the storey height is authored once; mass, slabs, roof and routes derive. */
export function editArchitecturalStoreyHeight(scene:V3Scene,storeyId:string,height:number) {
  if(!Number.isFinite(height)||height<2.2||height>20)return {ok:false as const,scene,errors:['Storey height must be between 2.2 and 20 metres.']};
  const base=checkoutV3ArchitecturalBlueprint(scene);
  if(!base.approval||!base.blueprint)return {ok:false as const,scene,errors:base.findings.map(f=>f.message)};
  const blueprint=structuredClone(base.blueprint);
  const storey=blueprint.buildings.flatMap(b=>b.storeys).find(s=>s.id===storeyId);
  if(!storey)return {ok:false as const,scene,errors:['Storey is not part of the current architectural plan.']};
  storey.height=height;
  const result=reviseV3ArchitecturalBlueprint(scene,base.approval,blueprint);
  return result.ok&&result.scene?{ok:true as const,scene:result.scene,errors:[]}: {ok:false as const,scene,errors:result.findings.filter(f=>f.severity==='fatal').map(f=>f.message)};
}

/** An explicit placement edit inherits the current footprint, rooms and facade rather than moving a roof separately. */
export function editArchitecturalBuildingPlacement(scene:V3Scene,id:string,patch:Partial<{x:number;z:number;baseElevation:number;rotationY:number}>) {
  if(Object.values(patch).some(v=>!Number.isFinite(v)))return {ok:false as const,scene,errors:['Placement values must be finite.']};
  const base=checkoutV3ArchitecturalBlueprint(scene);
  if(!base.approval||!base.blueprint)return {ok:false as const,scene,errors:base.findings.map(f=>f.message)};
  const blueprint=structuredClone(base.blueprint),building=blueprint.buildings.find(b=>b.id===id);
  if(!building)return {ok:false as const,scene,errors:['Building is not in the current architectural plan.']};
  Object.assign(building.location,patch);
  const result=reviseV3ArchitecturalBlueprint(scene,base.approval,blueprint);
  return result.ok&&result.scene?{ok:true as const,scene:result.scene,errors:[]}:{ok:false as const,scene,errors:result.findings.filter(f=>f.severity==='fatal').map(f=>f.message)};
}

/** Explicit plan edit. Existing replan rebuilds host walls/roof/contacts and retains unrelated edits. */
export function editArchitecturalBuildingFootprint(scene:V3Scene,id:string,plan:unknown) {
  const base=checkoutV3ArchitecturalBlueprint(scene);
  if(!base.approval||!base.blueprint)return {ok:false as const,scene,errors:base.findings.map(f=>f.message)};
  const parsed=v3ArchitecturalBlueprintSchema.shape.buildings.element.shape.plan.safeParse(plan);
  if(!parsed.success)return {ok:false as const,scene,errors:parsed.error.issues.map(i=>i.message)};
  const blueprint=structuredClone(base.blueprint),building=blueprint.buildings.find(b=>b.id===id);
  if(!building)return {ok:false as const,scene,errors:['Building is not in the current architectural plan.']};
  building.plan=parsed.data;
  const result=reviseV3ArchitecturalBlueprint(scene,base.approval,blueprint);
  return result.ok&&result.scene?{ok:true as const,scene:result.scene,errors:[]}:{ok:false as const,scene,errors:result.findings.filter(f=>f.severity==='fatal').map(f=>f.message)};
}
