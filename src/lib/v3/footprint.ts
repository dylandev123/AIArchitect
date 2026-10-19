import { resolvePath, offsetPath } from './curvedFootprint';
import { v3FootprintSchema } from './footprintSchema';
export type { V3Footprint } from './footprintSchema';
import { buildFloorFootprint, pointInPolygon, type Point, type WallEdge } from '@/lib/architecture/geometry/footprint';
import type { V3SceneObject } from './scene';
import { scaledDimensionsOf } from './elevation';

/** Projection allowance is reserved INSIDE the unchanged selection/placement envelope. */
export function footprintFrame(o: V3SceneObject) {
  const [w,,d] = scaledDimensionsOf(o), reserve = { north:0, east:0, south:0, west:0 };
  for (const op of o.composition?.footprint?.operations ?? []) if (op.type === 'projection') reserve[op.facade] = Math.max(reserve[op.facade], op.depth);
  return { width:w-reserve.east-reserve.west, depth:d-reserve.north-reserve.south, x:(reserve.west-reserve.east)/2, z:(reserve.north-reserve.south)/2 };
}
const cross = (a:Point,b:Point,c:Point) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function simpleFootprint(p: readonly Point[]): boolean {
  if(p.length<3)return false;
  for(let i=0;i<p.length;i++) {
    const a=p[i],b=p[(i+1)%p.length];
    if(!a.every(Number.isFinite)||Math.hypot(a[0]-b[0],a[1]-b[1])<1e-5)return false;
    for(let j=i+2;j<p.length;j++) {
      if(i===0&&j===p.length-1)continue;
      const c=p[j],d=p[(j+1)%p.length];
      if(cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0 && Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))+1e-8 && Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]))+1e-8)return false;
    }
  }
  return true;
}
export function resolveFootprint(o: V3SceneObject, floor: number) {
  if(!o.composition?.footprint)return undefined;
  const parsed=v3FootprintSchema.safeParse(o.composition.footprint);
  if(!parsed.success)return undefined;
  const ids=parsed.data.operations.flatMap(op=>op.id?[op.id]:[]);
  if(new Set(ids).size!==ids.length)return undefined;
  const frame=footprintFrame(o);
  if(frame.width<=.1||frame.depth<=.1)return undefined;
  if(parsed.data.operations.some(op=>'start' in op && op.end<=op.start))return undefined;
  const fp=parsed.data.kind==='outline'?resolvePath(parsed.data.segments!):buildFloorFootprint(frame.width,frame.depth,parsed.data.operations,floor),[w,,d]=scaledDimensionsOf(o);
  if(!fp || fp.warnings.length || !simpleFootprint(fp.polygon) || fp.polygon.some(([x,z])=>Math.abs(x+frame.x)>w/2+1e-6||Math.abs(z+frame.z)>d/2+1e-6))return undefined;
  if(parsed.data.kind==='outline'){
   const inner=offsetPath(fp.polygon,-.2);
   if(!simpleFootprint(inner)||inner.some(p=>!pointInPolygon(p,fp.polygon)))return undefined;
  }
  return {...fp,frame};
}
/** Outward compass normal from the clockwise boundary; angled edges deliberately have no facade address. */
export function edgeFacade(edge: WallEdge): WallEdge['facade'] {
  if(edge.facade)return edge.facade;
  const dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1];
  if(Math.abs(dz)<1e-6)return dx>0?'north':'south';
  if(Math.abs(dx)<1e-6)return dz>0?'east':'west';
  return undefined;
}
export function footprintContains(o:V3SceneObject, points:Point[], floor=0):boolean {
  const fp=resolveFootprint(o,floor);
  if(!fp)return !o.composition?.footprint;
  const local=points.map(([x,z]):Point=>[x-fp.frame.x,z-fp.frame.z]);
  // Split each tested boundary at every footprint vertex projection; corners alone miss a courtyard cut.
  return local.every((a,i)=>{
    const b=local[(i+1)%local.length],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
    const crossings=fp.edges.flatMap(e=>{
      const ex=e.b[0]-e.a[0],ez=e.b[1]-e.a[1],det=dx*ez-dz*ex;
      if(Math.abs(det)<1e-9)return [];
      const qx=e.a[0]-a[0],qz=e.a[1]-a[1],t=(qx*ez-qz*ex)/det,u=(qx*dz-qz*dx)/det;
      return t>0&&t<1&&u>=0&&u<=1?[t]:[];
    });
    const ts=[0,1,...crossings,...fp.polygon.map(p=>((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(len||1)).filter(t=>t>0&&t<1)].sort((a,b)=>a-b);
    return ts.flatMap((t,k)=>k?[t,(t+ts[k-1])/2]:[t]).every(t=>{
      const p:Point=[a[0]+t*dx,a[1]+t*dz];
      return pointInPolygon(p,fp.polygon)||fp.edges.some(e=>Math.abs(cross(e.a,e.b,p))<1e-6&&p[0]>=Math.min(e.a[0],e.b[0])-1e-6&&p[0]<=Math.max(e.a[0],e.b[0])+1e-6&&p[1]>=Math.min(e.a[1],e.b[1])-1e-6&&p[1]<=Math.max(e.a[1],e.b[1])+1e-6);
    });
  });
}
