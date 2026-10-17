/** V3-only bounded convex clipping. Keeps semantic primitive ids and interpolates fitted UVs. */
import { Euler, Vector3 } from 'three';
import type { HousePrimitive, TriMeshPrimitive } from '@/lib/house/types';
import type { Vec3 } from './scene';
export interface JunctionPlane { normal: Vec3; constant: number; } // inside: n.p <= constant
export const dot3 = (a: Vec3,b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const EPS = 1e-7;
interface Vertex { p: Vec3; uv?: [number,number]; }
const distance = (v:Vertex,h:JunctionPlane)=>dot3(v.p,h.normal)-h.constant;
function split(poly:Vertex[], h:JunctionPlane):[Vertex[],Vertex[]] {
  const inside:Vertex[]=[], outside:Vertex[]=[];
  for(let i=0;i<poly.length;i++) {
    const a=poly[i], b=poly[(i+1)%poly.length], da=distance(a,h), db=distance(b,h);
    if(da<=EPS) inside.push(a);
    if(da>=-EPS) outside.push(a);
    if(da>EPS&&db< -EPS || da< -EPS&&db>EPS) {
      const t=da/(da-db), v:Vertex={p:a.p.map((x,j)=>x+(b.p[j]-x)*t) as Vec3};
      if(a.uv&&b.uv) v.uv=[a.uv[0]+(b.uv[0]-a.uv[0])*t,a.uv[1]+(b.uv[1]-a.uv[1])*t];
      inside.push(v);outside.push(v);
    }
  }
  return [inside,outside];
}
function boxCorners(p:Extract<HousePrimitive,{kind:'box'}>):Vec3[] {
  const euler=new Euler(...p.rotation),corners:Vec3[]=[];
  for(const z of [-1,1]) for(const y of [-1,1]) for(const x of [-1,1]) {
    const v=new Vector3(x*p.size[0]/2,y*p.size[1]/2,z*p.size[2]/2).applyEuler(euler);
    corners.push([v.x+p.position[0],v.y+p.position[1],v.z+p.position[2]]);
  }
  return corners;
}
/** Close only cuts through a solid box's interior. A roof surface mesh is not presumed to be a solid. */
function boxCutCaps(p:Extract<HousePrimitive,{kind:'box'}>,planes:JunctionPlane[]):Vertex[][] {
  const corners=boxCorners(p),caps:Vertex[][]=[];
  for(const plane of planes) {
    const distances=corners.map(c=>dot3(c,plane.normal)-plane.constant);
    if(Math.min(...distances)>=-EPS||Math.max(...distances)<=EPS)continue;
    const points:Vec3[]=[];
    const add=(v:Vec3)=>{if(!points.some(p=>Math.hypot(...p.map((x,i)=>x-v[i]))<EPS))points.push(v);};
    for(let i=0;i<8;i++)for(const bit of [1,2,4]) {
      const j=i^bit;if(j<i)continue;
      const a=distances[i],b=distances[j];
      if(Math.abs(a)<EPS)add(corners[i]);if(Math.abs(b)<EPS)add(corners[j]);
      if(a*b<0){const t=a/(a-b);add(corners[i].map((v,k)=>v+(corners[j][k]-v)*t) as Vec3);}
    }
    if(points.length<3)continue;
    const centre=points.reduce((a,p)=>a.map((v,i)=>v+p[i]/points.length) as Vec3,[0,0,0] as Vec3);
    const n=new Vector3(...plane.normal).normalize().negate(),u=new Vector3(...points[0]).sub(new Vector3(...centre)).normalize(),v=new Vector3().crossVectors(n,u);
    points.sort((a,b)=>Math.atan2(new Vector3(...a).sub(new Vector3(...centre)).dot(v),new Vector3(...a).sub(new Vector3(...centre)).dot(u))-Math.atan2(new Vector3(...b).sub(new Vector3(...centre)).dot(v),new Vector3(...b).sub(new Vector3(...centre)).dot(u)));
    let polygon:Vertex[]=points.map(p=>({p}));
    for(const other of planes)if(other!==plane)polygon=split(polygon,other)[0];
    if(area(polygon)>EPS)caps.push(polygon);
  }
  return caps;
}

export function primitiveTriangles(p:HousePrimitive):{vertices:number[];uvs?:number[]} {
  if(p.kind==='triMesh') return p;
  const vertices:number[]=[], corners=boxCorners(p);
  // Outward winding on all six faces.
  for(const [a,b,c,d] of [[0,2,3,1],[4,5,7,6],[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3]]) vertices.push(...corners[a],...corners[b],...corners[c],...corners[a],...corners[c],...corners[d]);
  return {vertices};
}
function area(poly:Vertex[]) {
  let sum=0;
  for(let i=1;i<poly.length-1;i++) {
    const a=poly[0].p,b=poly[i].p,c=poly[i+1].p;
    const u=b.map((v,j)=>v-a[j]),v=c.map((v,j)=>v-a[j]);
    sum+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
  }
  return sum;
}
/** Subtract an enclosed volume from a surface mesh. No arbitrary solids, polygon topology or CAD repair. */
export function subtractJunctionVolume(p:HousePrimitive, planes:JunctionPlane[]):HousePrimitive|undefined {
  const mesh=primitiveTriangles(p), output:Vertex[][]=[];
  let changed=false;
  for(let i=0;i<mesh.vertices.length;i+=9) {
    const triangle:Vertex[]=Array.from({length:3},(_,j)=>({p:mesh.vertices.slice(i+j*3,i+j*3+3) as Vec3,...(mesh.uvs?{uv:mesh.uvs.slice((i/3+j)*2,(i/3+j)*2+2) as [number,number]}:{})}));
    let remaining=triangle;
    const outside:Vertex[][]=[];
    for(const plane of planes) {
      if(!remaining.length) break;
      // A coplanar surface belongs to the volume, avoiding duplicate internal faces.
      if(remaining.every(v=>Math.abs(distance(v,plane))<=EPS)) continue;
      const [inner,outer]=split(remaining,plane);
      if(area(outer)>EPS) outside.push(outer);
      remaining=inner;
    }
    if(area(remaining)>EPS) {changed=true;output.push(...outside);} else output.push(triangle);
  }
  if(!changed) return p;
  if(p.kind==='box'&&output.length)output.push(...boxCutCaps(p,planes));
  const vertices:number[]=[],uvs:number[]=[];
  for(const poly of output) for(let i=1;i<poly.length-1;i++) {
    if(area([poly[0],poly[i],poly[i+1]])<=EPS) continue;
    for(const v of [poly[0],poly[i],poly[i+1]]) {vertices.push(...v.p);if(v.uv) uvs.push(...v.uv);}
  }
  if(!vertices.length) return undefined;
  // Explicitly drop box attributes and stale fitted UVs; preserve material and semantic ownership.
  const result:TriMeshPrimitive={kind:'triMesh',id:p.id,label:p.label,category:p.category,vertices,color:p.color,
    roughness:p.roughness,metalness:p.metalness,transparent:p.transparent,opacity:p.opacity,surface:p.surface,
    sourceObjectId:p.sourceObjectId,sourceObjectIds:p.sourceObjectIds,semanticRole:p.semanticRole,componentRole:p.componentRole,
    assetId:p.assetId,uvScale:p.uvScale};
  if(uvs.length===vertices.length/3*2) {result.uvs=uvs;if(p.kind==='triMesh')result.uvModule=p.uvModule;}
  return result;
}
export function clipJunctionSegment(a:Vec3,b:Vec3,planes:JunctionPlane[]):[Vec3,Vec3]|undefined {
  let lo=0,hi=1;
  for(const p of planes) {
    const da=dot3(a,p.normal)-p.constant,db=dot3(b,p.normal)-p.constant,delta=db-da;
    if(Math.abs(delta)<EPS) {if(da>EPS)return;continue;}
    const t=-da/delta;if(delta>0)hi=Math.min(hi,t);else lo=Math.max(lo,t);
    if(hi-lo<EPS)return;
  }
  return [lo,hi].map(t=>a.map((v,i)=>v+(b[i]-v)*t) as Vec3) as [Vec3,Vec3];
}
