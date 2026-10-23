/** V3-only semantic paths. Metres in host-local x/z; positive sweeps run clockwise in plan. */
import type { Point, FloorFootprint } from '@/lib/architecture/geometry/footprint';
import type { V3Footprint } from './footprintSchema';
import { v3FootprintSchema } from './footprintSchema';
import type { HousePrimitive } from '@/lib/house/types';
export type PathSegment = NonNullable<V3Footprint['segments']>[number];
export const CURVE_STEP = Math.PI / 90;
export function segmentLength(s:PathSegment):number {
 return s.type==='line'?Math.hypot(s.end![0]-s.start![0],s.end![1]-s.start![1]):s.radius!*Math.abs(s.sweep!)*Math.PI/180;
}
export function segmentPoint(s:PathSegment,u:number):Point {
 if(s.type==='line')return [s.start![0]+(s.end![0]-s.start![0])*u,s.start![1]+(s.end![1]-s.start![1])*u];
 const a=(s.startAngle!+s.sweep!*u)*Math.PI/180;
 return [s.center![0]+s.radius!*Math.cos(a),s.center![1]+s.radius!*Math.sin(a)];
}
export function segmentNormal(s:PathSegment,u:number):Point {
 if(s.type==='line'){const l=segmentLength(s);return [(s.end![1]-s.start![1])/l,-(s.end![0]-s.start![0])/l];}
 const a=(s.startAngle!+s.sweep!*u)*Math.PI/180,sign=Math.sign(s.sweep!);
 return [sign*Math.cos(a),sign*Math.sin(a)];
}
export function segmentSteps(s:PathSegment){return s.type==='line'?1:Math.max(4,Math.ceil(Math.abs(s.sweep!)*Math.PI/180/CURVE_STEP),Math.ceil(segmentLength(s)/.35));}
/** Open world-space route centreline; exact authored segments survive checkout.
 * Sampling is shared by drawing, collision probes and production construction. */
export function sampleRoutePath(segments:PathSegment[]):Point[]|undefined {
 if(!v3FootprintSchema.safeParse({kind:'outline',operations:[],segments}).success||new Set(segments.map(s=>s.id)).size!==segments.length)return;
 if(segments.some(s=>Math.abs(s.startAngle??0)>720||!Number.isFinite(segmentLength(s))||segmentLength(s)<.1)||segments.reduce((n,s)=>n+segmentSteps(s),0)>4096)return;
 const points:Point[]=[];
 for(const [i,s] of segments.entries()){
  if(i){const p=segmentPoint(segments[i-1],1),q=segmentPoint(s,0);if(Math.hypot(p[0]-q[0],p[1]-q[1])>1e-6)return;}
  const steps=segmentSteps(s);
  for(let j=0;j<steps;j++)points.push(segmentPoint(s,j/steps));
 }
 points.push(segmentPoint(segments.at(-1)!,1));
 return points;
}
export function resolvePath(segments:PathSegment[]):FloorFootprint|undefined {
 if(!segments.length||new Set(segments.map(s=>s.id)).size!==segments.length)return;
 if(segments.some(s=>!Number.isFinite(segmentLength(s)))||segments.reduce((n,s)=>n+segmentSteps(s),0)>4096)return;
 const polygon:Point[]=[];
 for(let i=0;i<segments.length;i++){
  const s=segments[i],end=segmentPoint(s,1),next=segmentPoint(segments[(i+1)%segments.length],0);
  if(segmentLength(s)<.1||Math.hypot(end[0]-next[0],end[1]-next[1])>1e-6)return;
  const steps=segmentSteps(s);
  for(let k=0;k<steps;k++)polygon.push(segmentPoint(s,k/steps));
 }
 const area=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
 if(area<.1)return;
 return {polygon,hullPolygon:polygon,chamfers:[],edges:polygon.map((a,i)=>({a,b:polygon[(i+1)%polygon.length]})),rects:[],wedges:[],warnings:[]};
}
/** General miter offset, unlike the legacy rectilinear offset. Reject invalid results upstream. */
export function offsetPath(p:readonly Point[],distance:number):Point[]{
 return p.map((v,i)=>{
  const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length];
  const l=Math.hypot(v[0]-a[0],v[1]-a[1]),r=Math.hypot(b[0]-v[0],b[1]-v[1]);
  const n1:Point=[(v[1]-a[1])/l,-(v[0]-a[0])/l],n2:Point=[(b[1]-v[1])/r,-(b[0]-v[0])/r];
  const den=1+n1[0]*n2[0]+n1[1]*n2[1];
  return [v[0]+distance*(n1[0]+n2[0])/den,v[1]+distance*(n1[1]+n2[1])/den];
 });
}
/** Bend the shared north-facade builders onto a semantic segment. One mesh/id per component;
 * sampling never enters persistent identity. Common samples keep wall, glass and slab seams aligned. */
export function bendFacade(parts:HousePrimitive[],s:PathSegment,segments:PathSegment[]):HousePrimitive[]{
 const length=segmentLength(s),steps=segmentSteps(s),index=segments.indexOf(s);
 const map=(x:number,y:number,z:number):number[]=>{
  const u=(x+length/2)/length,p=segmentPoint(s,u);let n=segmentNormal(s,u);
  if(Math.abs(u)<1e-8||Math.abs(u-1)<1e-8){
   const other=Math.abs(u)<1e-8?segmentNormal(segments[(index+segments.length-1)%segments.length],1):segmentNormal(segments[(index+1)%segments.length],0);
   const den=1+n[0]*other[0]+n[1]*other[1];
   if(den>1e-5)n=[(n[0]+other[0])/den,(n[1]+other[1])/den];
  }
  return [p[0]-z*n[0],y,p[1]-z*n[1]];
 };
 return parts.map(p=>{
  if(p.kind!=='box')throw new Error('Curved facade builder requires box construction parts');
  const [cx,cy,cz]=p.position,[w,h,d]=p.size;
  const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2,z0=cz-d/2+.5,z1=cz+d/2+.5;
  if(s.type==='arc'&&Math.min(s.radius!-Math.sign(s.sweep!)*z0,s.radius!-Math.sign(s.sweep!)*z1)<.05)throw new Error(`Component ${p.id} folds through the arc centre; reduce its depth or increase the radius.`);
  if(x0 < -length/2-1e-5 || x1 > length/2+1e-5)throw new Error(`Component ${p.id} extends beyond its host segment; inset its span.`);
  const xs=[x0,...Array.from({length:steps+1},(_,i)=>-length/2+length*i/steps).filter(x=>x>x0+1e-8&&x<x1-1e-8),x1],vertices:number[]=[];
  const quad=(a:number[],b:number[],c:number[],d:number[])=>vertices.push(...a,...b,...c,...a,...c,...d);
  for(let i=1;i<xs.length;i++){
   const a=xs[i-1],b=xs[i];
   quad(map(a,y0,z0),map(b,y0,z0),map(b,y1,z0),map(a,y1,z0));
   quad(map(b,y0,z1),map(a,y0,z1),map(a,y1,z1),map(b,y1,z1));
   quad(map(a,y1,z0),map(b,y1,z0),map(b,y1,z1),map(a,y1,z1));
   quad(map(a,y0,z1),map(b,y0,z1),map(b,y0,z0),map(a,y0,z0));
  }
  quad(map(x0,y0,z1),map(x0,y0,z0),map(x0,y1,z0),map(x0,y1,z1));
  quad(map(x1,y0,z0),map(x1,y0,z1),map(x1,y1,z1),map(x1,y1,z0));
  return {...p,kind:'triMesh' as const,vertices};
 });
}
