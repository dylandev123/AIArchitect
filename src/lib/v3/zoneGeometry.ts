import { compileV3Scene, type V3Scene } from './scene';
import { materializeV3ArchitecturalScene } from './architecture';
import { spatialPlanPoints } from './routeGeometry';
import type { V3EstatePlan } from './estatePlan';

/** Hierarchy owners use their actual canonical constructed ribbon, including width and bends.
 * This read-only projection reuses construction; it never estimates occupancy from the owner box. */
export function zoneMemberPlanPoints(scene: V3Scene, objectId: string): [number,number][] {
  const object=scene.objects.find(o=>o.id===objectId);
  if(!object)return [];
  const connections=scene.siteHierarchy?.connections.filter(c=>c.surfaceObjectId===objectId)??[];
  if(!connections.length)return spatialPlanPoints(scene,object);
  const ids=new Set(connections.map(c=>`v3-connection-${c.id}`));
  return compileV3Scene(scene).primitives.filter(p=>ids.has(p.id)).flatMap(p=>{
    if(p.kind!=='triMesh')return [];
    return Array.from({length:p.vertices.length/3},(_,i)=>[p.vertices[i*3],p.vertices[i*3+2]] as [number,number]);
  });
}

/** A read-only measurement, never written into estatePlan or blueprint. Membership may overlap. */
export function resolveV3ZoneGeometry(input: V3Scene, zone: V3EstatePlan['zones'][number]) {
  const scene = materializeV3ArchitecturalScene(input);
  const points = zone.objectIds.flatMap(id => {
    return zoneMemberPlanPoints(scene,id);
  });
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const envelope = points.length ? {
    x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2,
    width: Math.max(...xs) - Math.min(...xs), depth: Math.max(...zs) - Math.min(...zs),
  } : undefined;
  return { mode: zone.allocationMode ?? 'reserved', envelope,
    boundary: zone.allocationMode === 'derived' ? envelope : zone.allocation };
}
