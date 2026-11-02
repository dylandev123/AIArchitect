import type { ArchitecturalScene, SceneElement } from './model';
import { sceneSpatialGeometry } from './spatial';

/** A deliberately bounded proof: straight, level, 0.6 m wide and 2 m high.
 * This is construction evidence, not code compliance or a navigation solver.
 * Only rectangular, parallel floor surfaces can supply support. Every other
 * solid is conservatively an obstacle, including profiles and fixed glazing. */
export function straightWalkingAccess(scene: ArchitecturalScene, door: SceneElement, floor: SceneElement) {
  if (door.geometry || floor.geometry || floor.kind !== 'plate' || !['entrance','wall'].includes(door.kind)) return;
  const g = sceneSpatialGeometry(scene), p = g.world(door), q = g.world(floor), datum = g.top(floor);
  const opening = door.kind === 'wall' ? door.opening : undefined;
  if (door.kind === 'wall' && (!opening || opening.glazed)) return;
  const width = opening?.width ?? door.size[0];
  const sill = opening ? g.bottom(door) + opening.sill : g.bottom(door);
  const height = opening?.height ?? door.size[1];
  if (width < .6 || Math.abs(sill-datum) > .02 || height < 2 || Math.abs(Math.sin(q[3]-p[3])) > 1e-5) return;
  const offset = opening?.x ?? 0;
  const origin = [p[0]+Math.cos(p[3])*offset, p[2]-Math.sin(p[3])*offset];
  const local = (e: SceneElement) => {
    const r = g.world(e), dx = r[0]-origin[0], dz = r[2]-origin[1];
    return [Math.cos(p[3])*dx-Math.sin(p[3])*dz, Math.sin(p[3])*dx+Math.cos(p[3])*dz];
  };
  const [x,z] = local(floor);
  if (Math.abs(x)+.3 > floor.size[0]/2+1e-6) return;
  // Reach 0.3 m inside the destination rather than merely touching its edge.
  const end = z > 0 ? Math.max(.3,z-floor.size[2]/2+.3) : Math.min(-.3,z+floor.size[2]/2-.3);
  if (Math.abs(end-z)+.3>floor.size[2]/2+1e-6) return;
  const start = end > 0 ? -door.size[2]/2-.3 : door.size[2]/2+.3;
  const lo = Math.min(start,end), hi = Math.max(start,end), mid = (lo+hi)/2;
  let evidenceId='walking-evidence';
  while (g.map.has(evidenceId)) evidenceId+='-';
  const corridor: SceneElement = {...floor,id:evidenceId,parent:undefined,geometry:undefined,
    at:[origin[0]+Math.sin(p[3])*mid,datum+1,origin[1]+Math.cos(p[3])*mid],rotation:p[3],size:[.6,2,hi-lo]};
  const supports = scene.elements.filter(e => e.kind==='plate' && !e.geometry &&
    Math.abs(g.top(e)-datum)<=.02 && Math.abs(Math.sin(g.world(e)[3]-p[3]))<1e-5);
  let remaining = [[-.3,.3,lo,hi]];
  const supportIds: string[] = [];
  for (const support of supports) {
    const [sx,sz] = local(support), w = support.size[0]/2, d = support.size[2]/2;
    const next = remaining.flatMap(([x0,x1,z0,z1]) => {
      const a=Math.max(x0,sx-w),b=Math.min(x1,sx+w),c=Math.max(z0,sz-d),e=Math.min(z1,sz+d);
      if (a>=b || c>=e) return [[x0,x1,z0,z1]];
      if (!supportIds.includes(support.id)) supportIds.push(support.id);
      return [[x0,a,z0,z1],[b,x1,z0,z1],[a,b,z0,c],[a,b,e,z1]].filter(r=>r[1]-r[0]>1e-6 && r[3]-r[2]>1e-6);
    });
    remaining=next;
  }
  if (remaining.length) return;
  for (const e of scene.elements) {
    if (e.id===door.id || g.top(e)<=datum+.02 || g.bottom(e)>=datum+2 || g.separation(e,corridor)>=-1e-6) continue;
    if (e.kind==='wall' && !e.geometry && e.opening && !e.opening.glazed && Math.abs(Math.sin(g.world(e)[3]-p[3]))<1e-5) {
      const [wx] = local(e), bottom=g.bottom(e)+e.opening.sill;
      // Opening x reverses in an antiparallel frame.
      const ox=wx+Math.cos(g.world(e)[3]-p[3])*e.opening.x;
      if (Math.abs(ox)+.3<=e.opening.width/2+1e-6 && bottom<=datum+.02 && bottom+e.opening.height>=datum+2) continue;
    }
    return;
  }
  return {doorId:door.id,floorId:floor.id,supportIds,width:.6,headroom:2,walkingDatum:datum};
}
