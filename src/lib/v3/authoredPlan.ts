import type { V3SceneObject } from './scene';
import { resolveFootprint } from './footprint';
import { footprint } from './reviewGeometry';
import { flatPolygon } from '@/lib/house/geometry/mesh';
export type PlanPoint=[number,number];
export function authoredPlan(o:V3SceneObject,floor=0):PlanPoint[]{
 const fp=o.type==='building-mass'?resolveFootprint(o,floor):undefined;
 if(!fp)return footprint(o);
 const c=Math.cos(o.transform.rotation[1]),s=Math.sin(o.transform.rotation[1]);
 return fp.polygon.map(([x,z])=>[o.transform.position[0]+(x+fp.frame.x)*c+(z+fp.frame.z)*s,o.transform.position[2]-(x+fp.frame.x)*s+(z+fp.frame.z)*c]);
}
export const planArea=(p:PlanPoint[])=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
function triangles(p:PlanPoint[]):PlanPoint[][]{
 const v=flatPolygon(p,0),out:PlanPoint[][]=[];
 for(let i=0;i<v.length;i+=9)out.push([[v[i],v[i+2]],[v[i+3],v[i+5]],[v[i+6],v[i+8]]]);
 return out;
}
/** Triangle clipping supports concave authored boundaries without treating their envelope as occupied. */
export function authoredOverlap(a:V3SceneObject,b:V3SceneObject,floorA=0,floorB=0):number{
 const pa=authoredPlan(a,floorA),pb=authoredPlan(b,floorB);
 if([0,1].some(k=>Math.max(...pa.map(p=>p[k]))<=Math.min(...pb.map(p=>p[k]))||Math.max(...pb.map(p=>p[k]))<=Math.min(...pa.map(p=>p[k]))))return 0;
 const cross=(a:PlanPoint,b:PlanPoint,p:PlanPoint)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 let area=0;
 for(const ta of triangles(pa))for(const tb of triangles(pb)){
  let points=ta;const sign=Math.sign(cross(tb[0],tb[1],tb[2]));
  for(let j=0;j<3;j++){
   const u=tb[j],v=tb[(j+1)%3],next:PlanPoint[]=[];
   for(let k=0;k<points.length;k++){
    const p=points[k],q=points[(k+1)%points.length],dp=sign*cross(u,v,p),dq=sign*cross(u,v,q);
    if(dp>=0)next.push(p);
    if(dp*dq<0){const t=dp/(dp-dq);next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
   }points=next;
  }area+=planArea(points);
 }
 return area;
}
export function realizesForm(o:V3SceneObject,form:string):boolean{
 const fp=resolveFootprint(o,0);if(!fp)return false;
 const segments=o.composition?.footprint?.segments;
 if(form==='circular')return !!segments?.length&&segments.every(s=>s.type==='arc'&&Math.abs(s.radius!-segments[0].radius!)<1e-6&&Math.hypot(s.center![0]-segments[0].center![0],s.center![1]-segments[0].center![1])<1e-6)&&Math.abs(segments.reduce((a,s)=>a+s.sweep!,0)-360)<1e-6;
 if(form==='curved')return !!segments?.some(s=>s.type==='arc');
 return fp.polygon.length>4||o.composition?.footprint?.kind==='outline';
}

/** Minimum footprint separation, using edges rather than rotated bounding boxes. */
export function authoredSeparation(a: V3SceneObject, b: V3SceneObject, floorA=0, floorB=0): number {
  if (authoredOverlap(a,b,floorA,floorB)>0) return 0;
  const pa=authoredPlan(a,floorA), pb=authoredPlan(b,floorB);
  const distance=(p: number[], u: number[], v: number[])=>{
    const dx=v[0]-u[0], dz=v[1]-u[1], t=Math.max(0,Math.min(1,((p[0]-u[0])*dx+(p[1]-u[1])*dz)/(dx*dx+dz*dz)));
    return Math.hypot(p[0]-u[0]-t*dx,p[1]-u[1]-t*dz);
  };
  return Math.min(...pa.flatMap(p=>pb.map((u,i)=>distance(p,u,pb[(i+1)%pb.length]))),...pb.flatMap(p=>pa.map((u,i)=>distance(p,u,pa[(i+1)%pa.length]))));
}

