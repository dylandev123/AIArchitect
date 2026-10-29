import { z } from 'zod';
export const rooftopSchema=z.enum(['none','railed','lounge','shaded']);
export const stackedVolumeSchema=z.object({
 id:z.string().regex(/^[a-z][a-z0-9-]{0,35}$/),
 parentId:z.string().regex(/^[a-z][a-z0-9-]{0,35}$/), x:z.number().min(-40).max(40),z:z.number().min(-40).max(40),
 width:z.number().min(5).max(40),depth:z.number().min(5).max(40),height:z.number().min(3).max(6),
 rooftop:rooftopSchema,
}).strict();
export type StackVolume=z.infer<typeof stackedVolumeSchema>;
export type Rect={x:number;z:number;width:number;depth:number};
export type ResolvedVolume=StackVolume & {bottom:number;level:number};
export const rectanglePoints=(r:Rect)=>[{x:r.x-r.width/2,z:r.z-r.depth/2},{x:r.x+r.width/2,z:r.z-r.depth/2},{x:r.x+r.width/2,z:r.z+r.depth/2},{x:r.x-r.width/2,z:r.z+r.depth/2}];
export function rectangleFromPoints(points:{x:number;z:number;curve?:unknown}[]):Rect {
 const xs=points.map(p=>p.x),zs=points.map(p=>p.z),l=Math.min(...xs),r=Math.max(...xs),b=Math.min(...zs),t=Math.max(...zs);
 if(points.length!==4||points.some((p,i)=>p.curve||!([l,r].includes(p.x)&&[b,t].includes(p.z))||(p.x!==points[(i+1)%4].x&&p.z!==points[(i+1)%4].z))||new Set(points.map(p=>`${p.x},${p.z}`)).size!==4)throw Error('Stacked volumes require a rectangular base, without curves.');
 return {x:(l+r)/2,z:(b+t)/2,width:r-l,depth:t-b};
}
export function resolveStack(base:Rect,height:number,volumes:StackVolume[]):ResolvedVolume[]{
 const result:ResolvedVolume[]=[],pending=[...volumes];
 if(new Set(volumes.map(v=>v.id)).size!==volumes.length||volumes.some(v=>v.id==='base'))throw Error('Stack IDs must be unique; base is reserved.');
 while(pending.length){
  const index=pending.findIndex(v=>v.parentId==='base'||result.some(p=>p.id===v.parentId));
  if(index<0)throw Error('Stack parent is missing or cyclic.');
  const v=pending.splice(index,1)[0],parent=v.parentId==='base'?{...base,bottom:0,height,level:0}:result.find(p=>p.id===v.parentId)!;
  const level=parent.level+1,bottom=parent.bottom+parent.height+.26;
  if(level>3)throw Error('Stack supports one to four storeys.');
  const dx=Math.abs(v.x-parent.x),dz=Math.abs(v.z-parent.z);
  if(dx+v.width/2-parent.width/2>2.00001||dz+v.depth/2-parent.depth/2>2.00001)throw Error('Projection exceeds 2m beyond parent.');
  const w=Math.max(0,Math.min(v.x+v.width/2,parent.x+parent.width/2)-Math.max(v.x-v.width/2,parent.x-parent.width/2));
  const d=Math.max(0,Math.min(v.z+v.depth/2,parent.z+parent.depth/2)-Math.max(v.z-v.depth/2,parent.z-parent.depth/2));
  if(w*d/(v.width*v.depth)<.6)throw Error('Volume needs at least 60% parent footprint support.');
  const next={...v,bottom,level};
  for(const other of result){
   if(Math.min(bottom+v.height+.26,other.bottom+other.height+.26)-Math.max(bottom,other.bottom)<.001)continue;
   if(Math.abs(v.x-other.x)<(v.width+other.width)/2+.65&&Math.abs(v.z-other.z)<(v.depth+other.depth)/2+.65)throw Error('Intersecting storeys or roof junction: unrelated volumes need .65m clearance.');
  }
  result.push(next);
 }
 return result;
}
/** Exposed roof decomposed into non-overlapping cells; expanded obstructions reserve furniture clearance. */
export function exposedRoof(r:Rect,obstacles:Rect[],clearance=0):Rect[]{
 let cells=[r];
 for(const o of obstacles){const next:Rect[]=[];
  for(const c of cells){const l=c.x-c.width/2,t=c.z-c.depth/2,rr=l+c.width,b=t+c.depth;
   const a=Math.max(l,o.x-o.width/2-clearance),d=Math.min(rr,o.x+o.width/2+clearance),e=Math.max(t,o.z-o.depth/2-clearance),f=Math.min(b,o.z+o.depth/2+clearance);
   if(a>=d||e>=f){next.push(c);continue;}
   for(const [x,z,w,h] of [[l,t,a-l,b-t],[d,t,rr-d,b-t],[a,t,d-a,e-t],[a,f,d-a,b-f]])if(w>.001&&h>.001)next.push({x:x+w/2,z:z+h/2,width:w,depth:h});
  }cells=next;
 }return cells;
}
/** Rail only exposed original perimeter; covered spans disappear at upper facade junctions. */
export function roofRails(r:Rect,obstacles:Rect[]){
 const rails: {x:number;z:number;length:number;side:boolean}[]=[];
 for(const side of [false,true])for(const sign of [-1,1]){
  const fixed=(side?r.x:r.z)+sign*(side?r.width:r.depth)/2;
  let spans:[number,number][]=[[(side?r.z:r.x)-(side?r.depth:r.width)/2,(side?r.z:r.x)+(side?r.depth:r.width)/2]];
  for(const o of obstacles){if(Math.abs(fixed-(side?o.x:o.z))>(side?o.width:o.depth)/2+.16)continue;
   const a=(side?o.z:o.x)-(side?o.depth:o.width)/2-.16,b=(side?o.z:o.x)+(side?o.depth:o.width)/2+.16;
   spans=spans.flatMap(([l,h])=>a>=h||b<=l?[[l,h]]:[[l,Math.max(l,a)],[Math.min(h,b),h]]).filter(([l,h])=>h-l>.05) as [number,number][];
  }
  for(const [l,h] of spans)rails.push({x:side?fixed:(l+h)/2,z:side?(l+h)/2:fixed,length:h-l,side});
 }return rails;
}
