/** Vertical relations between stacked spaces: one derivation shared by the kernel (which reports
 * conflicts) and the canonical plan compiler (which derives ordinary envelope heights).
 * Polygons are convex; coverage is exact clipped area. Nothing here moves or resizes a space. */
import type {Point} from './compiler';
const eps=1e-7;
export function polygonArea(poly:Point[]):number{return Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;}
/** Sutherland–Hodgman clip of a convex polygon by a convex counter-clockwise clip polygon. */
export function clipConvex(subject:Point[],clip:Point[]):Point[]{
 let out=subject;
 for(let i=0;i<clip.length&&out.length;i++){
  const a=clip[i],b=clip[(i+1)%clip.length],inside=(p:Point)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-eps;
  const input=out;out=[];
  input.forEach((p,j)=>{
   const q=input[(j+1)%input.length],pi=inside(p),qi=inside(q);
   if(pi!==qi){
    const d1=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),d2=(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]),t=d1/(d1-d2);
    out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);
   }
   if(qi)out.push(q);
  });
 }
 return out;
}
export type VerticalSpace={id:string;level:string;polygon:Point[]};
export type Cover={
 /** none: nothing above; partial: part of the footprint is under higher spaces; full: all of it. */
 state:'none'|'partial'|'full';
 /** Fraction of the footprint (0..1) lying under the lowest higher datum. */
 fraction:number;
 /** Floor datum of the lowest higher level that overlaps, if any. */
 datum?:number;
 level?:string;
 /** Higher spaces at that datum that overlap the footprint. */
 by:string[];
};
/** Cover of `space` by spaces on strictly higher datums. Only the lowest overlapping datum is the
 * cover: spaces above that one rest on it, they do not cover this space directly. */
export function coverOf(space:VerticalSpace,all:VerticalSpace[],top:(levelId:string)=>number):Cover{
 const own=top(space.level),area=polygonArea(space.polygon);
 const above=all.filter(u=>u.id!==space.id&&top(u.level)>own+eps).map(u=>({u,overlap:polygonArea(clipConvex(space.polygon,u.polygon))})).filter(x=>x.overlap>eps);
 if(!above.length)return {state:'none',fraction:0,by:[]};
 const datum=Math.min(...above.map(x=>top(x.u.level)));
 const at=above.filter(x=>Math.abs(top(x.u.level)-datum)<eps);
 const fraction=Math.min(1,at.reduce((s,x)=>s+x.overlap,0)/area);
 return {state:fraction>1-1e-6?'full':'partial',fraction,datum,level:at[0].u.level,by:at.map(x=>x.u.id)};
}
/** Convex `subject` minus convex counter-clockwise `hole`, as disjoint convex pieces (exact; nothing is moved). */
export function subtractConvex(subject:Point[],hole:Point[]):Point[][]{
 if(polygonArea(clipConvex(subject,hole))<=eps)return [subject];
 const pieces:Point[][]=[];let rest=subject;
 for(let i=0;i<hole.length&&rest.length;i++){
  const a=hole[i],b=hole[(i+1)%hole.length];
  pieces.push(clipHalf(rest,a,b,-1));
  rest=clipHalf(rest,a,b,1);
 }
 return pieces.filter(piece=>piece.length>=3&&polygonArea(piece)>1e-6);
}
/** Keep the side of line a→b where sign·cross>=0 (sign 1: left of the edge, -1: right). */
function clipHalf(poly:Point[],a:Point,b:Point,sign:1|-1):Point[]{
 const d=(p:Point)=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])),out:Point[]=[];
 poly.forEach((p,j)=>{
  const q=poly[(j+1)%poly.length],dp=d(p),dq=d(q),pi=dp>=-eps,qi=dq>=-eps;
  if(pi!==qi){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  if(qi)out.push(q);
 });
 return out;
}
/** Smallest width of a convex polygon: the least over edges of the farthest vertex distance. */
export function minimumWidth(poly:Point[]):number{
 return Math.min(...poly.map((a,i)=>{const b=poly[(i+1)%poly.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);return Math.max(...poly.map(p=>Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))/len));}));
}
/** Exposed (uncovered) part of `space` under the spaces named by a partial `cover`, as convex pieces. */
export function exposedPieces(space:VerticalSpace,all:VerticalSpace[],cover:Cover):Point[][]{
 let pieces:Point[][]=[space.polygon];
 for(const id of cover.by){const upper=all.find(u=>u.id===id)!;pieces=pieces.flatMap(piece=>subtractConvex(piece,upper.polygon));}
 return pieces;
}
