import { z } from 'zod';
import { DesignConflict, type Point } from '../experimental/semantic-building/compiler';
import type { Rect } from './layout';
export const id=z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
export const dimension=z.number().finite().positive().max(100);
export const material=z.enum(['ivory','limestone','timber','bronze','sage']);
type Side='south'|'east'|'north'|'west';
/** Building-scale architectural decisions, stated before and independently of room elaboration.
 * volumes  = the building's major forms: each owns whole wings (masses), a height tier and, optionally, ONE roof.
 * roofSpans = one roof over several rooms (a single ridge/hip/slab, not one slab per room).
 * facades  = a composed opening rhythm (n evenly spaced bays) on one room wall.
 * entrance = the arrival door and the roofed porch that receives it.
 * Software expands these into ordinary roofs/portals, builds the usual editable geometry, then CHECKS the result
 * against the declaration. A declaration the construction cannot honour rejects the plan; nothing is substituted. */
export const compositionSchema=z.object({
 volumes:z.array(z.object({id,masses:z.array(id).min(1).max(12),tier:z.enum(['primary','secondary','subordinate']),roof:id.optional(),material:material.optional()}).strict()).min(1).max(12),
 heightStep:z.number().finite().min(.2).max(6).optional(),
 roofSpans:z.array(z.object({id,spaces:z.array(id).min(2).max(40),form:z.enum(['flat','gable','hip']),rise:z.number().finite().min(.18).max(8).optional(),overhang:z.number().finite().min(0).max(3).optional(),material:material.optional()}).strict()).max(12),
 facades:z.array(z.object({id,space:id,side:z.enum(['south','east','north','west']),kind:z.enum(['windows','doors']),to:id.optional(),bays:z.number().int().min(1).max(12),width:dimension,height:dimension,sill:z.number().finite().min(0).max(8).optional()}).strict()).max(24),
 entrance:z.object({portal:id,porch:id}).strict().optional(),
}).strict();
export type Composition=z.infer<typeof compositionSchema>;
export const DEFAULT_HEIGHT_STEP=.6;
const EDGE:Record<Side,number>={south:0,east:1,north:2,west:3};
const PIER=.36,MARGIN=.18;
export type SpanInfo={id:string;lead:string;members:string[];rect:Rect;polygon:Point[];form:'flat'|'gable'|'hip';rise?:number;overhang?:number;material?:z.infer<typeof material>};
export type FacadePortal={id:string;host:{space:string;edge:number};to:string;offset:number;width:number;height:number;mode:'door'|'window';sill?:number};
type Space={id:string;mass:string;level:string;outdoor:boolean};
type Roof={space:string;form:'flat'|'gable'|'hip';rise?:number;overhang?:number;material?:z.infer<typeof material>};
const rectPolygon=(r:Rect):Point[]=>[[r.x,r.z],[r.x+r.width,r.z],[r.x+r.width,r.z+r.depth],[r.x,r.z+r.depth]];
/** Geometry-only expansion before heights are known. Declared roof spans become one ordinary roof entry on a lead space;
 * facade rhythms become ordinary portals; volume materials become per-mass defaults (an explicit room material still wins). */
export function expandComposition(plan:{spaces:Space[];roofs:Roof[];portals:{id:string}[]},composition:Composition|undefined,rects:Map<string,Rect>){
 const problems:string[]=[],spans:SpanInfo[]=[],facades:FacadePortal[]=[],massMaterial=new Map<string,z.infer<typeof material>>();
 let roofs=plan.roofs;
 if(!composition)return {spans,facades,roofs,massMaterial};
 const space=new Map(plan.spaces.map(s=>[s.id,s]));
 const owner=new Map<string,string>();
 for(const span of composition.roofSpans){
  const rs=span.spaces.map(sid=>({sid,s:space.get(sid),r:rects.get(sid)}));
  const missing=rs.filter(m=>!m.s||!m.r).map(m=>m.sid);
  if(missing.length){problems.push(`${span.id}: roof span names unknown space ${missing.join(', ')}.`);continue;}
  if(new Set(span.spaces).size!==span.spaces.length){problems.push(`${span.id}: roof span lists a space twice.`);continue;}
  const clash=span.spaces.filter(sid=>owner.has(sid)||plan.roofs.some(r=>r.space===sid));
  if(clash.length){problems.push(`${span.id}: ${clash.join(', ')} already ${clash.some(sid=>owner.has(sid))?`belongs to roof span ${owner.get(clash[0])}`:'has its own roof entry'}; a space has exactly one roof.`);continue;}
  const levels=new Set(rs.map(m=>m.s!.level));
  if(levels.size!==1){problems.push(`${span.id}: a roof span covers one level; ${span.spaces.join(', ')} sit on ${[...levels].join(', ')}.`);continue;}
  const x0=Math.min(...rs.map(m=>m.r!.x)),z0=Math.min(...rs.map(m=>m.r!.z)),x1=Math.max(...rs.map(m=>m.r!.x+m.r!.width)),z1=Math.max(...rs.map(m=>m.r!.z+m.r!.depth));
  const area=rs.reduce((a,m)=>a+m.r!.width*m.r!.depth,0),box=(x1-x0)*(z1-z0);
  if(Math.abs(area-box)>1e-6){problems.push(`${span.id}: its rooms do not tile one rectangle (${area.toFixed(2)} m² of rooms in a ${box.toFixed(2)} m² envelope). A single roof needs contiguous rooms filling a rectangle: split the span, or give the rest their own roofs.`);continue;}
  for(const sid of span.spaces)owner.set(sid,span.id);
  const rect:Rect={x:x0,z:z0,width:x1-x0,depth:z1-z0};
  spans.push({id:span.id,lead:span.spaces[0],members:span.spaces,rect,polygon:rectPolygon(rect),form:span.form,rise:span.rise,overhang:span.overhang,material:span.material});
 }
 roofs=[...plan.roofs,...spans.map(s=>({space:s.lead,form:s.form,...(s.rise!==undefined?{rise:s.rise}:{}),...(s.overhang!==undefined?{overhang:s.overhang}:{}),...(s.material?{material:s.material}:{})}))];
 const taken=new Set([...plan.portals.map(p=>p.id)]);
 for(const f of composition.facades){
  const sp=space.get(f.space),r=rects.get(f.space);
  if(!sp||!r){problems.push(`${f.id}: facade names unknown space ${f.space}.`);continue;}
  if(sp.outdoor){problems.push(`${f.id}: a facade rhythm needs an interior host room.`);continue;}
  if(f.kind==='doors'&&(!f.to||!space.get(f.to)?.outdoor)){problems.push(`${f.id}: a door rhythm needs "to" naming the outdoor space it opens onto.`);continue;}
  if(f.kind==='windows'&&f.to){problems.push(`${f.id}: window bays open to the exterior; omit "to".`);continue;}
  if(f.kind==='doors'&&f.sill){problems.push(`${f.id}: doors have no sill.`);continue;}
  const length=f.side==='south'||f.side==='north'?r.width:r.depth,pitch=length/f.bays;
  if(f.width+PIER>pitch+1e-9||f.width/2+MARGIN>pitch/2+1e-9){problems.push(`${f.id}: ${f.bays} bays of ${f.width} m do not fit the ${length} m ${f.side} wall of ${f.space} (bay pitch ${pitch.toFixed(2)} m needs ${(f.width+PIER).toFixed(2)} m with piers). Fewer or narrower bays.`);continue;}
  for(let i=0;i<f.bays;i++){
   const pid=`${f.id}-${i+1}`;
   if(taken.has(pid)){problems.push(`${pid}: generated opening id collides with an existing portal.`);continue;}
   taken.add(pid);
   facades.push({id:pid,host:{space:f.space,edge:EDGE[f.side]},to:f.kind==='doors'?f.to!:'exterior',offset:pitch*(i+.5),width:f.width,height:f.height,mode:f.kind==='doors'?'door':'window',...(f.kind==='windows'?{sill:f.sill??.8}:{})});
  }
 }
 for(const v of composition.volumes)if(v.material)for(const m of v.masses)massMaterial.set(m,v.material);
 if(problems.length)throw new DesignConflict(problems);
 return {spans,facades,roofs,massMaterial};
}
/** The roofs and facade openings of a plan after composition is expanded: what the compiler derives, read by diagnosis and analysis so that none of
 * them interprets the authored plan differently from the compiler. Tolerant: an invalid composition yields the authored roofs and its problems. */
export function composedView(plan:{spaces:Space[];roofs:Roof[];portals:{id:string}[];composition?:Composition},rects:Map<string,Rect>){
 try{const c=expandComposition(plan,plan.composition,rects);return {roofs:c.roofs,spans:c.spans,facades:c.facades,problems:[] as string[]};}
 catch(e){if(e instanceof DesignConflict)return {roofs:plan.roofs,spans:[] as SpanInfo[],facades:[] as FacadePortal[],problems:e.decisions};throw e;}
}
/** After heights and cover are derived: a span is one roof over rooms of one envelope height with nothing stacked above. */
export function checkSpans(spans:SpanInfo[],spaces:{id:string;height:number}[],cover:Map<string,string>){
 const problems:string[]=[];
 for(const span of spans){
  const heights=span.members.map(m=>spaces.find(s=>s.id===m)!.height);
  if(heights.some(h=>Math.abs(h-heights[0])>1e-6))problems.push(`${span.id}: one roof needs one envelope height; ${span.members.map((m,i)=>`${m} ${heights[i]}m`).join(', ')}. Give them the same height or separate roofs.`);
  const covered=span.members.filter(m=>cover.get(m)!=='none');
  if(covered.length)problems.push(`${span.id}: ${covered.join(', ')} ha${covered.length>1?'ve':'s'} a space stacked over it; a roof span covers only exposed rooms.`);
 }
 return problems;
}
export type CompositionEvidence={
 volumes:{id:string;tier:string;top:number;spaces:string[];roof:string|null}[];
 roofs:{id:string;form:string;spans:string[];elements:string[]}[];
 facades:{id:string;openings:string[]}[];
 entrance:{portal:string;porch:string;roofed:boolean}|null;
 roofElements:number;interiorRooms:number;
};
/** Verify the declared composition against what was actually built. Reports; never repairs. */
export function compositionFidelity(composition:Composition,spaces:{id:string;mass:string;level:string;height:number;outdoor?:boolean;roof?:boolean}[],levelTop:(id:string)=>number,spans:SpanInfo[],facades:FacadePortal[],elements:{id:string;kind:string;roofForm?:string;size:number[]}[],provenance:Record<string,{sources:string[]}>,arrival:string,portals:{id:string;to:string;mode:string;height:number}[]){
 const problems:string[]=[],evidence:CompositionEvidence={volumes:[],roofs:[],facades:[],entrance:null,roofElements:elements.filter(e=>e.kind==='roof').length,interiorRooms:spaces.filter(s=>!s.outdoor).length};
 const volumeOf=new Map<string,string>();
 for(const v of composition.volumes)for(const m of v.masses){
  if(volumeOf.has(m))problems.push(`${m}: wing belongs to volumes ${volumeOf.get(m)} and ${v.id}.`);else volumeOf.set(m,v.id);
 }
 const massIds=new Set(spaces.map(s=>s.mass));
 for(const v of composition.volumes)for(const m of v.masses)if(!massIds.has(m))problems.push(`${v.id}: volume names wing ${m}, which holds no spaces.`);
 for(const m of massIds)if(!volumeOf.has(m))problems.push(`${m}: wing is not part of any declared volume; every wing belongs to one building volume.`);
 const rank={primary:3,secondary:2,subordinate:1} as const,step=composition.heightStep??DEFAULT_HEIGHT_STEP;
 const built=composition.volumes.map(v=>{
  const own=spaces.filter(s=>v.masses.includes(s.mass)),inside=own.filter(s=>!s.outdoor);
  const top=inside.length?Math.max(...inside.map(s=>levelTop(s.level)+s.height)):-Infinity;
  return {v,own,inside,top};
 });
 for(const a of built)for(const b of built)if(rank[a.v.tier]>rank[b.v.tier]&&a.inside.length&&b.inside.length&&a.top<b.top+step-1e-6)
  problems.push(`${a.v.id}/${b.v.id}: ${a.v.id} is declared ${a.v.tier} and ${b.v.id} ${b.v.tier}, but their tops are ${a.top.toFixed(2)} m and ${b.top.toFixed(2)} m; the hierarchy needs at least ${step} m. Raise ${a.v.id} (envelope height or an added level) or lower ${b.v.id}.`);
 for(const {v,inside,top} of built){
  const own=new Set(v.masses.flatMap(m=>spaces.filter(s=>s.mass===m).map(s=>s.id)));
  let roofId:string|null=null;
  if(v.roof){
   const span=spans.find(s=>s.id===v.roof);
   if(!span)problems.push(`${v.id}: roof ${v.roof} is not a declared roof span.`);
   else{
    roofId=span.id;
    const foreign=span.members.filter(m=>!own.has(m));
    if(foreign.length)problems.push(`${v.id}: its roof ${span.id} also covers ${foreign.join(', ')}, which belong to other volumes; a volume's roof covers that volume.`);
    const bare=inside.filter(s=>s.roof&&!span.members.includes(s.id)).map(s=>s.id);
    if(bare.length)problems.push(`${v.id}: declared under one roof (${span.id}) but ${bare.join(', ')} carr${bare.length>1?'y':'ies'} a separate roof; add them to the span or drop the claim.`);
    const el=elements.find(e=>e.id===span.id);
    if(!el||el.kind!=='roof')problems.push(`${span.id}: the declared roof was not built.`);
    else{
     if(span.form!=='flat'&&el.roofForm!==span.form)problems.push(`${span.id}: built as ${el.roofForm??'flat'}, declared ${span.form}.`);
     if(el.size[0]<span.rect.width-1e-6||el.size[2]<span.rect.depth-1e-6)problems.push(`${span.id}: built roof is smaller than the ${span.members.length} rooms it must cover.`);
    }
   }
  }
  evidence.volumes.push({id:v.id,tier:v.tier,top:Number.isFinite(top)?top:0,spaces:[...own],roof:roofId});
 }
 for(const span of spans)evidence.roofs.push({id:span.id,form:span.form,spans:span.members,elements:elements.filter(e=>e.id===span.id&&provenance[e.id]?.sources[0]===span.lead).map(e=>e.id)});
 for(const f of composition.facades)evidence.facades.push({id:f.id,openings:facades.filter(p=>p.id.startsWith(`${f.id}-`)).map(p=>p.id)});
 if(composition.entrance){
  const {portal,porch}=composition.entrance,p=portals.find(q=>q.id===portal),s=spaces.find(q=>q.id===porch);
  if(!p)problems.push(`entrance: portal ${portal} does not exist.`);
  else if(p.mode!=='door')problems.push(`entrance: ${portal} must be a door.`);
  else if(p.to!==porch)problems.push(`entrance: ${portal} opens to ${p.to}, not the declared porch ${porch}.`);
  if(!s||!s.outdoor)problems.push(`entrance: porch ${porch} must be an outdoor space.`);
  else if(porch!==arrival)problems.push(`entrance: porch ${porch} is not the plan's arrival space (${arrival}).`);
  if(p&&s&&s.outdoor&&s.height<p.height+.1)problems.push(`entrance: porch ${porch} is ${s.height} m high but the ${portal} door is ${p.height} m; the sheltering roof must clear the door by at least 0.1 m.`);
  const roofed=!!s?.roof;
  if(s&&s.outdoor&&!roofed)problems.push(`entrance: porch ${porch} has no roof; an entrance porch is a sheltered, roofed space.`);
  evidence.entrance={portal,porch,roofed};
 }
 return {problems,evidence};
}
