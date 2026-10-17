import type { V3SceneObject } from './scene';
import { scaledDimensionsOf } from './elevation';

type Point = [number, number];
export function footprint(o: V3SceneObject): Point[] {
  const [w, , d] = scaledDimensionsOf(o), [x, , z] = o.transform.position, yaw = o.transform.rotation[1];
  return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v]) => [x+u*Math.cos(yaw)+v*Math.sin(yaw), z-u*Math.sin(yaw)+v*Math.cos(yaw)]);
}
export function localPlan(o: V3SceneObject, [x,z]: Point): Point {
  const dx=x-o.transform.position[0], dz=z-o.transform.position[2], r=o.transform.rotation[1];
  return [dx*Math.cos(r)-dz*Math.sin(r), dx*Math.sin(r)+dz*Math.cos(r)];
}
/** Convex clipping in the host's local frame; AABBs are never collision evidence. */
export function footprintOverlap(a: V3SceneObject, b: V3SceneObject): number {
  // Tilted volumes require a 3D solid test; a plan box alone cannot prove a conflict.
  if ([a,b].some(o=>Math.abs(o.transform.rotation[0])+Math.abs(o.transform.rotation[2])>1e-6)) return 0;
  let points=footprint(a).map(p=>localPlan(b,p));
  const [w,,d]=scaledDimensionsOf(b);
  for (const [axis, sign, half] of [[0,1,w/2],[0,-1,w/2],[1,1,d/2],[1,-1,d/2]]) {
    const output: Point[]=[];
    for(let i=0;i<points.length;i++) {
      const p=points[i], q=points[(i+1)%points.length], dp=sign*p[axis]-half, dq=sign*q[axis]-half;
      if(dp<=0) output.push(p);
      if((dp<0&&dq>0)||(dp>0&&dq<0)) { const t=dp/(dp-dq); output.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]); }
    }
    points=output;
  }
  return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;
}
export function footprintOverrun(child: V3SceneObject, parent: V3SceneObject): number {
  const [w,,d]=scaledDimensionsOf(parent);
  return Math.max(0,...footprint(child).map(p=>localPlan(parent,p)).flatMap(([x,z])=>[Math.abs(x)-w/2,Math.abs(z)-d/2]));
}
