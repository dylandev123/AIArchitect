import { z } from 'zod';
import { CatmullRomCurve3, Vector3 } from 'three';
import { ribbon, type P2 } from '@/lib/house/geometry/mesh';

const id=z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
const point=z.object({x:z.number().min(-200).max(200),z:z.number().min(-200).max(200)}).strict();
export const estateRouteSchema=z.object({
  id,kind:z.enum(['drive','walk']),width:z.number().min(.9).max(6),
  points:z.array(point).min(2).max(8),planting:z.enum(['avenue','border','none']),
}).strict().superRefine((r,ctx)=>{
  if(r.kind==='drive' && r.width<3.5) ctx.addIssue({code:'custom',message:'Driveways need at least 3.5 m clear width.'});
  if(r.kind==='walk' && r.width>3) ctx.addIssue({code:'custom',message:'Pedestrian paths are bounded to 3 m.'});
  for(let i=1;i<r.points.length;i++) if(Math.hypot(r.points[i].x-r.points[i-1].x,r.points[i].z-r.points[i-1].z)<2)
    ctx.addIssue({code:'custom',message:'Successive path controls need at least 2 m separation.'});
});
export const estateLandscapeSchema=z.object({
  builder:z.literal('estate-landscape@1'),routes:z.array(estateRouteSchema).min(1).max(10),
  court:z.object({id,x:point.shape.x,z:point.shape.z,width:z.number().min(12).max(28),depth:z.number().min(12).max(28),
    island:z.enum(['none','planted','fountain']),islandWidth:z.number().min(2).max(12),islandDepth:z.number().min(2).max(12),
  }).strict().refine(c=>c.island==='none' || Math.min((c.width-c.islandWidth)/2,(c.depth-c.islandDepth)/2)>=3.5,
    'Motor courts need a clear lane of at least 3.5 m around the island.').optional(),
  beds:z.array(z.object({id,x:point.shape.x,z:point.shape.z,width:z.number().min(1.5).max(12),depth:z.number().min(1.5).max(12)}).strict()).max(12),
}).strict();
export type EstateLandscape=z.infer<typeof estateLandscapeSchema>;
export type EstateRoute=z.infer<typeof estateRouteSchema>;
export type Point={x:number;z:number};
export type Bounds={left:number;right:number;rear:number;front:number};
/** Centripetal interpolation passes through authored controls without uniform-spline loops. */
export function routeSamples(route:EstateRoute, spacing=.65):Point[] {
  const curve=new CatmullRomCurve3(route.points.map(p=>new Vector3(p.x,0,p.z)),false,'centripetal');
  const count=Math.min(1200,Math.max(12,Math.ceil(curve.getLength()/spacing)));
  return curve.getSpacedPoints(count).map(p=>({x:p.x,z:p.z}));
}
export function pointSegmentDistance(p:Point,a:Point,b:Point) {
  const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz || 1)));
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
}
export function routeDistance(p:Point,samples:Point[]) {
  return Math.min(...samples.slice(1).map((b,i)=>pointSegmentDistance(p,samples[i],b)));
}
/** A thin ribbon feeds the existing PBR PrimitiveMesh, never a new construction engine. */
export function routeVertices(route:EstateRoute,width=route.width,y=0) {
  return ribbon(routeSamples(route).map(p=>[p.x,p.z] as P2),width,y);
}
const box=(points:Point[],margin:number):Bounds=>({left:Math.min(...points.map(p=>p.x))-margin,right:Math.max(...points.map(p=>p.x))+margin,rear:Math.min(...points.map(p=>p.z))-margin,front:Math.max(...points.map(p=>p.z))+margin});
export function landscapeBounds(l:EstateLandscape):Bounds[] {
  return [...l.routes.map(r=>box(routeSamples(r),r.width/2+(r.planting==='avenue'?6.5:r.planting==='border'?1.5:.6))),
    ...(l.court?[{left:l.court.x-l.court.width/2-.4,right:l.court.x+l.court.width/2+.4,rear:l.court.z-l.court.depth/2-.4,front:l.court.z+l.court.depth/2+.4}]:[]),
    ...l.beds.map(b=>({left:b.x-b.width/2,right:b.x+b.width/2,rear:b.z-b.depth/2,front:b.z+b.depth/2}))];
}
export function insideCourt(p:Point,c:NonNullable<EstateLandscape['court']>,padding=0) {
  return ((p.x-c.x)/(c.width/2+padding))**2+((p.z-c.z)/(c.depth/2+padding))**2<=1;
}
export function distanceToBounds(p:Point,b:Bounds) {
  return Math.hypot(Math.max(b.left-p.x,0,p.x-b.right),Math.max(b.rear-p.z,0,p.z-b.front));
}
/** Deterministic circulation planting. All exclusion zones are applied before rendering. */
export function circulationPlanting(l:EstateLandscape,obstacles:Bounds[]) {
  const routes=l.routes.map(r=>({r,samples:routeSamples(r)}));
  const plants:{x:number;z:number;tree:boolean}[]=[];
  for(const {r} of routes) {
    if(r.planting==='none') continue;
    const samples=routeSamples(r,r.planting==='avenue'?6:2);
    for(let i=1;i<samples.length-1;i++) for(const side of [-1,1]) {
      const a=samples[i-1],b=samples[i+1],len=Math.hypot(b.x-a.x,b.z-a.z)||1;
      const tree=r.planting==='avenue',offset=r.width/2+(tree?3:.85);
      const p={x:samples[i].x-side*(b.z-a.z)/len*offset,z:samples[i].z+side*(b.x-a.x)/len*offset,tree};
      const radius=tree?1.5:.55;
      if(routes.some(({r,samples})=>routeDistance(p,samples)<r.width/2+radius) ||
        (l.court && insideCourt(p,l.court,radius)) || obstacles.some(b=>distanceToBounds(p,b)<radius) ||
        plants.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<(tree?4:1.25))) continue;
      plants.push(p);
    }
  }
  return plants;
}
/** Conservative circle sampling reserves the full paved widths; joins between routes are allowed. */
export function landscapeFindings(l:EstateLandscape,buildings:Bounds[],pool?:Bounds) {
  const findings:{path:string;message:string}[]=[];
  const ids=[...l.routes,...l.beds,...(l.court?[l.court]:[])].map(p=>p.id);
  if(new Set(ids).size!==ids.length) findings.push({path:'estateLandscape',message:'Landscape feature IDs must be unique.'});
  for(const r of l.routes) {
    const samples=routeSamples(r),radius=r.width/2+.12;
    if(samples.some(p=>buildings.some(b=>distanceToBounds(p,b)<radius) || (pool && distanceToBounds(p,pool)<radius)))
      findings.push({path:`estateLandscape.routes.${r.id}`,message:'Paved width intersects a building or pool clearance. Move the controls; paths must approach entrances from outside the footprint.'});
    // Reject pinched hairpins and self crossings, while excluding neighbours along the ribbon.
    const run=[0];for(let i=1;i<samples.length;i++)run.push(run[i-1]+Math.hypot(samples[i].x-samples[i-1].x,samples[i].z-samples[i-1].z));
    if(samples.some((p,i)=>samples.some((q,j)=>run[j]-run[i]>r.width*2+.5 && Math.hypot(p.x-q.x,p.z-q.z)<r.width+.2)))
      findings.push({path:`estateLandscape.routes.${r.id}`,message:'Path folds across itself or leaves insufficient width at a hairpin.'});
    if(l.court?.island!=='none' && l.court) {
      const c=l.court;
      if(samples.some(p=>((p.x-c.x)/(c.islandWidth/2+radius))**2+((p.z-c.z)/(c.islandDepth/2+radius))**2<1))
        findings.push({path:`estateLandscape.routes.${r.id}`,message:'Route encroaches on the central island; join the outside of the court.'});
    }
    if(r.kind==='drive' && l.court && ![samples[0],samples.at(-1)!].some(p=>insideCourt(p,l.court!,r.width/2)))
      findings.push({path:`estateLandscape.routes.${r.id}`,message:'Driveway must meet the motor court.'});
  }
  const features=[...l.beds.map(b=>({id:b.id,b:box([{x:b.x-b.width/2,z:b.z-b.depth/2},{x:b.x+b.width/2,z:b.z+b.depth/2}],0)})),
    ...(l.court?[{id:l.court.id,b:{left:l.court.x-l.court.width/2,right:l.court.x+l.court.width/2,rear:l.court.z-l.court.depth/2,front:l.court.z+l.court.depth/2}}]:[])];
  for(const {id,b} of features) if([...buildings,...(pool?[pool]:[])].some(o=>Math.min(b.right,o.right)>Math.max(b.left,o.left) && Math.min(b.front,o.front)>Math.max(b.rear,o.rear)))
    findings.push({path:`estateLandscape.${id}`,message:'Court or garden bed intersects a building or pool clearance.'});
  for(const b of l.beds) if(l.routes.some(r=>routeSamples(r).some(p=>distanceToBounds(p,{left:b.x-b.width/2,right:b.x+b.width/2,rear:b.z-b.depth/2,front:b.z+b.depth/2})<r.width/2+.3)))
    findings.push({path:`estateLandscape.beds.${b.id}`,message:'Planting beds must leave circulation clear.'});
  return findings;
}
