import { z } from 'zod';
import { stackedVolumeSchema, rooftopSchema, resolveStack, rectangleFromPoints, rectanglePoints } from './stacked-volumes';
import { Shape, ExtrudeGeometry } from 'three';
const coordinate=z.number().min(-40).max(40);
const point=z.object({x:coordinate,z:coordinate,curve:z.object({x:coordinate,z:coordinate}).strict().optional()}).strict();
const facadeSection=z.object({
  edges:z.array(z.number().int().min(0).max(15)).min(1).max(16),
  treatment:z.enum(['solid','glass','loggia','screen','colonnade','entrance']),
  material:z.enum(['ivory','sand','limestone','warm-stone']).optional(),
  terraceEdge:z.enum(['glass','solid']).optional(),
}).strict();
export const facadeOpeningSchema=z.object({
 id:z.string().regex(/^[a-z][a-z0-9-]{0,35}$/),edge:z.number().int().min(0).max(15),
 offset:z.number().min(.2).max(80),width:z.number().min(.5).max(12),
 sill:z.number().min(0).max(7),height:z.number().min(.6).max(8),
 kind:z.enum(['window','door']),frame:z.enum(['bronze','timber','ivory']),
}).strict();
const facadeFields={facades:z.array(facadeSection).max(16).optional(),preciseOpenings:z.array(facadeOpeningSchema).max(48).optional()};
const architecturalLevelSchema=z.object({
 id:z.string().regex(/^[a-z][a-z0-9-]{0,35}$/),parentId:z.string().regex(/^[a-z][a-z0-9-]{0,35}$/),
 points:z.array(point).min(3).max(16),height:z.number().min(3).max(9),
 material:z.enum(['ivory','sand','limestone','warm-stone']),
 openings:z.enum(['panoramic','rhythm','private']),rooftop:rooftopSchema,
 ...facadeFields,
}).strict();
const levelSchema=z.object({points:z.array(point).min(3).max(16),height:z.number().min(3).max(9),...facadeFields}).strict();
/** Each optional quadratic control bends the outgoing edge to the next point. */
export const footprintSchema=z.object({
  id:z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),builder:z.literal('footprint-building@1'),
  x:z.number().min(-200).max(200),z:z.number().min(-200).max(200),orientation:z.number().min(0).max(359),
  points:z.array(point).min(3).max(16),height:z.number().min(3).max(9),
  levels:z.array(architecturalLevelSchema).min(1).max(10).optional(),
  stack:z.array(stackedVolumeSchema).min(0).max(10).optional(),rooftop:rooftopSchema.optional(),
  upper:levelSchema.optional(),volumes:z.array(levelSchema).min(1).max(4).optional(),...facadeFields,
  material:z.enum(['ivory','sand','limestone','warm-stone']),openings:z.enum(['panoramic','rhythm','private']),
}).strict();
export type FootprintBuilding=z.infer<typeof footprintSchema>;
export type PlanPoint={x:number;z:number};
export function footprintOutline(p:Pick<FootprintBuilding,'points'>):PlanPoint[] {
  const out:PlanPoint[]=[];
  p.points.forEach((a,i)=>{
    const b=p.points[(i+1)%p.points.length],c=a.curve;
    const length=c?Math.hypot(c.x-a.x,c.z-a.z)+Math.hypot(b.x-c.x,b.z-c.z):Math.hypot(b.x-a.x,b.z-a.z);
    const n=Math.max(1,Math.ceil(length/(c?1:2.4)));
    for(let j=0;j<n;j++){const t=j/n,u=1-t;out.push(c?{x:u*u*a.x+2*u*t*c.x+t*t*b.x,z:u*u*a.z+2*u*t*c.z+t*t*b.z}:{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
  });return out;
}
const cross=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function validateFootprint(p:FootprintBuilding):PlanPoint[] {
  if(p.levels){
    if(p.stack||p.upper||p.volumes)throw Error("Use levels, stack, upper or volumes exclusively.");
    resolveArchitecturalLevels(p);
  }
  if(p.stack){
    if(p.preciseOpenings!==undefined)throw Error('Use architectural levels for precise openings; legacy stack edge order is derived.');
    if(p.upper||p.volumes)throw Error('Use stack, upper or volumes exclusively.');
    resolveStack(rectangleFromPoints(p.points),p.height,p.stack);
  }
  validatePreciseOpenings(p);
  const used=new Set<number>();
  for(const section of p.facades??[])for(const edge of section.edges){
    if(edge>=p.points.length||used.has(edge))throw Error('Facade edges must exist and belong to only one section.');
    used.add(edge);
  }
  for(let i=0;i<p.points.length;i++){const a=p.points[i],b=p.points[(i+1)%p.points.length];if(Math.hypot(a.x-b.x,a.z-b.z)<1)throw Error('Footprint controls must be at least 1m apart.');}
  const v=footprintOutline(p);if(v.length>180)throw Error('Footprint exceeds 180 facade bays.');
  let area=0,perimeter=0;
  for(let i=0;i<v.length;i++){
    const a=v[i],b=v[(i+1)%v.length];area+=a.x*b.z-b.x*a.z;perimeter+=Math.hypot(b.x-a.x,b.z-a.z);
    for(let j=i+2;j<v.length;j++){
      if(i===0&&j===v.length-1)continue;
      const c=v[j],d=v[(j+1)%v.length];
      const hit=cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-8&&Math.max(Math.min(a.z,b.z),Math.min(c.z,d.z))<=Math.min(Math.max(a.z,b.z),Math.max(c.z,d.z))+1e-8;
      if(hit)throw Error('Footprint must be simple: crossing or touching edges.');
      // Thick facade shells must not collide across a narrow neck.
      const distance=(q:PlanPoint,r:PlanPoint,s:PlanPoint)=>{const dx=s.x-r.x,dz=s.z-r.z,t=Math.max(0,Math.min(1,((q.x-r.x)*dx+(q.z-r.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(q.x-r.x-t*dx,q.z-r.z-t*dz);};
      if(Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))<.3)throw Error('Footprint has insufficient wall clearance.');
    }
  }
  if(Math.abs(area)/2<24||perimeter>180)throw Error('Footprint needs >=24m² and perimeter <=180m.');
  if(p.upper && p.volumes) throw Error('Use upper or volumes, not both.');
  if(p.volumes) {
    const outlines=p.volumes.map(level=>validateFootprint({...p,...level,facades:level.facades,preciseOpenings:level.preciseOpenings,upper:undefined,volumes:undefined}));
    const inside=(q:PlanPoint)=>{let hit=false;for(let i=0,j=v.length-1;i<v.length;j=i++){const a=v[i],b=v[j];if((a.z>q.z)!==(b.z>q.z)&&q.x<(b.x-a.x)*(q.z-a.z)/(b.z-a.z)+a.x)hit=!hit;}return hit;};
    const distance=(q:PlanPoint,a:PlanPoint,b:PlanPoint)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(q.x-a.x-t*dx,q.z-a.z-t*dz);};
    for(const outline of outlines){
      let supported=0,total=0;
      for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length],n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.2);for(let j=0;j<n;j++){
        const q={x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n};total++;
        if(inside(q))supported++;else if(Math.min(...v.map((a,k)=>distance(q,a,v[(k+1)%v.length])))>2)throw Error('Upper volume projection exceeds 2m.');
      }}
      if(supported/total<.6)throw Error('Upper volume needs at least 60% supported boundary.');
    }
    // Separate envelopes avoid intersecting shells and ambiguous terrace junctions.
    const boxes=outlines.map(o=>({l:Math.min(...o.map(q=>q.x)),r:Math.max(...o.map(q=>q.x)),b:Math.min(...o.map(q=>q.z)),t:Math.max(...o.map(q=>q.z))}));
    boxes.forEach((a,i)=>boxes.slice(i+1).forEach(b=>{if(a.l<b.r+.65&&a.r>b.l-.65&&a.b<b.t+.65&&a.t>b.b-.65)throw Error('Upper volumes need .65m separated envelopes.');}));
  }
  if(p.upper) {
    const upper=validateFootprint({...p,...p.upper,facades:p.upper.facades,preciseOpenings:p.upper.preciseOpenings,upper:undefined,volumes:undefined});
    // Test entire sampled edges, not just controls: a concave lower outline can
    // contain both endpoints while the connecting edge leaves the building.
    const inside=(q:PlanPoint)=>{let hit=false;for(let i=0,j=v.length-1;i<v.length;j=i++){
      const a=v[i],b=v[j];if((a.z>q.z)!==(b.z>q.z)&&q.x<(b.x-a.x)*(q.z-a.z)/(b.z-a.z)+a.x)hit=!hit;
    }return hit;};
    const distance=(q:PlanPoint,a:PlanPoint,b:PlanPoint)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(q.x-a.x-t*dx,q.z-a.z-t*dz);};
    for(let i=0;i<upper.length;i++) {
      const a=upper[i],b=upper[(i+1)%upper.length];
      for(let j=0,n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.2);j<=n;j++) {
        const q={x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n};
        if(!inside(q)||v.some((r,k)=>distance(q,r,v[(k+1)%v.length])<.65))throw Error(`Upper storey at ${q.x},${q.z} must remain inset >=0.65m inside the lower footprint; cantilevers unsupported.`);
      }
    }
  }
  return v;
}
export function footprintFacadeBays(p:FootprintBuilding){return validateFootprint(p).length+(p.levels??[]).reduce((n,l)=>n+footprintOutline(l).length,0)+(p.upper?footprintOutline(p.upper).length:0)+(p.volumes??[]).reduce((n,l)=>n+footprintOutline(l).length,0)+(p.stack??[]).reduce((n,l)=>n+footprintOutline({points:rectanglePoints(l)}).length,0);}
export function footprintBounds(p:FootprintBuilding){const a=p.orientation*Math.PI/180,v=[...(p.levels??[]).flatMap(footprintOutline),...footprintOutline(p),...(p.volumes??[]).flatMap(footprintOutline),...(p.stack??[]).flatMap(rectanglePoints)].map(q=>({x:p.x+q.x*Math.cos(a)+q.z*Math.sin(a),z:p.z-q.x*Math.sin(a)+q.z*Math.cos(a)}));return {left:Math.min(...v.map(q=>q.x))-.16,right:Math.max(...v.map(q=>q.x))+.16,rear:Math.min(...v.map(q=>q.z))-.16,front:Math.max(...v.map(q=>q.z))+.16};}
export function footprintPlate(v:PlanPoint[],thickness:number){const shape=new Shape();v.forEach((q,i)=>i?shape.lineTo(q.x,-q.z):shape.moveTo(q.x,-q.z));shape.closePath();const g=new ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1,curveSegments:1});g.rotateX(-Math.PI/2);return g;}

/** Stable source-edge selection survives curve resampling; outward sign supports either winding. */
export function footprintFacadeSegments(p:FootprintBuilding){
 const v=validateFootprint(p),area=v.reduce((n,a,i)=>{const b=v[(i+1)%v.length];return n+a.x*b.z-b.x*a.z;},0);
 let index=0;
 return p.points.flatMap((a,edge)=>{
  const b=p.points[(edge+1)%p.points.length],c=a.curve;
  const length=c?Math.hypot(c.x-a.x,c.z-a.z)+Math.hypot(b.x-c.x,b.z-c.z):Math.hypot(b.x-a.x,b.z-a.z);
  const count=Math.max(1,Math.ceil(length/(c?1:2.4)));
  return Array.from({length:count},(_,bay)=>{const i=index++,start=v[i],end=v[(i+1)%v.length];return {a:start,b:end,index:i,edge,bay,count,outward:area>0?-1:1,section:p.facades?.find(s=>s.edges.includes(edge))};});
 });
}

/** Resolve a declarative support graph. Geometry remains data, never executable code.
 * Support uses the existing sampled outline projection validator, not a shape menu. */
export function resolveArchitecturalLevels(p:FootprintBuilding){
 const base={id:'base',parentId:'',points:p.points,height:p.height,material:p.material,openings:p.openings,facades:p.facades,preciseOpenings:p.preciseOpenings,rooftop:p.rooftop??'none' as const,bottom:0,level:0};
 const resolved=[base],pending=[...(p.levels??[])];
 if(new Set(pending.map(l=>l.id)).size!==pending.length||pending.some(l=>l.id==='base'))throw Error('Level IDs must be unique; base is reserved.');
 while(pending.length){
  const index=pending.findIndex(l=>resolved.some(r=>r.id===l.parentId));
  if(index<0)throw Error('Level parent is missing or cyclic.');
  const l=pending.splice(index,1)[0],parent=resolved.find(r=>r.id===l.parentId)!;
  const level=parent.level+1,bottom=parent.bottom+parent.height+.26;
  if(level>3)throw Error('Architectural levels support at most four storeys.');
  // Reuse all simple-outline, wall clearance, projection and supported-boundary checks.
  validateFootprint({...p,points:parent.points,height:parent.height,facades:parent.facades,preciseOpenings:parent.preciseOpenings,levels:undefined,stack:undefined,upper:undefined,volumes:[{points:l.points,height:l.height,facades:l.facades,preciseOpenings:l.preciseOpenings}]});
  const outline=footprintOutline(l),box=(v:PlanPoint[])=>({l:Math.min(...v.map(q=>q.x)),r:Math.max(...v.map(q=>q.x)),b:Math.min(...v.map(q=>q.z)),t:Math.max(...v.map(q=>q.z))}),a=box(outline);
  for(const other of resolved){
   if(Math.min(bottom+l.height+.26,other.bottom+other.height+.26)-Math.max(bottom,other.bottom)<.001)continue;
   const b=box(footprintOutline(other));
   if(a.l<b.r+.65&&a.r>b.l-.65&&a.b<b.t+.65&&a.t>b.b-.65)throw Error('Unrelated architectural levels need .65m separated envelopes.');
  }
  resolved.push({...l,facades:l.facades,preciseOpenings:l.preciseOpenings,bottom,level});
 }
 return resolved;
}

/** Offsets follow the original straight source edge in metres, independent of tessellation.
 * Only named edges replace procedural glazing; all other edges retain their treatment. */
export function validatePreciseOpenings(p:Pick<FootprintBuilding,'points'|'height'|'preciseOpenings'|'facades'>){
 const ids=new Set<string>();
 for(const o of p.preciseOpenings??[]){
  if(ids.has(o.id))throw Error('Opening IDs must be unique within a level.');ids.add(o.id);
  const a=p.points[o.edge],b=p.points[(o.edge+1)%p.points.length];
  if(!a||a.curve)throw Error('Precise openings require an existing straight edge; curved openings are unsupported.');
  const length=Math.hypot(b.x-a.x,b.z-a.z);
  if(o.offset+o.width>length-.2||o.sill+o.height>p.height-.2)throw Error('Opening needs 0.2m corner and header clearance.');
  if(o.kind==='door'&&(o.sill!==0||o.height<2))throw Error('Doors require a zero sill and at least 2m height.');
  if(p.facades?.some(s=>s.edges.includes(o.edge)&&s.treatment!=='solid'))throw Error('Precise openings cannot overlap procedural facade treatments.');
  for(const other of p.preciseOpenings??[]){
   if(other===o||other.edge!==o.edge)continue;
   if(o.offset<other.offset+other.width+.15&&o.offset+o.width+.15>other.offset&&o.sill<other.sill+other.height+.15&&o.sill+o.height+.15>other.sill)throw Error('Openings require 0.15m masonry separation.');
  }
 }
}
/** Disjoint masonry rectangles leave real holes; glazing is never pasted over a solid wall. */
export function preciseWallPanels(length:number,height:number,openings:NonNullable<FootprintBuilding['preciseOpenings']>){
 const xs=[...new Set([0,length,...openings.flatMap(o=>[o.offset,o.offset+o.width])])].sort((a,b)=>a-b);
 return xs.slice(0,-1).flatMap((x,i)=>{
  const right=xs[i+1],middle=(x+right)/2;
  const holes=openings.filter(o=>middle>o.offset&&middle<o.offset+o.width).sort((a,b)=>a.sill-b.sill);
  let bottom=0;const panels:{x:number;y:number;width:number;height:number}[]=[];
  for(const hole of [...holes,{sill:height,height:0}]){
   if(hole.sill>bottom)panels.push({x:(x+right)/2,y:(bottom+hole.sill)/2,width:right-x,height:hole.sill-bottom});
   bottom=hole.sill+hole.height;
  }
  return panels;
 });
}
