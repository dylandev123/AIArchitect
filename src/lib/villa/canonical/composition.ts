import { z } from 'zod';
import { DesignConflict, type Point } from '../experimental/semantic-building/compiler';
import type { Rect } from './layout';
import { sharedRuns, freeRuns } from './coordination';
export const id=z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
export const dimension=z.number().finite().positive().max(100);
export const material=z.enum(['ivory','limestone','timber','bronze','sage']);
type Side='south'|'east'|'north'|'west';
/** Building-scale architectural decisions, stated before and independently of room elaboration.
 * volumes  = the building's major forms: each owns whole wings (masses), a height tier and, optionally, its principal building-scale roof (a roofSpan).
 * roofSpans = BUILDING-SCALE roofs: one roof over one or several rooms (a single ridge/hip/slab, not one slab per room); a one-room span is that room's roof, named so a volume can own it.
 *             Room-owned roofs are the plan's roofs entries, one per room; a room has exactly one roof, from a span or from its own entry, never both.
 * facades  = a composed opening rhythm (n evenly spaced bays) on one room wall.
 * entrance = the arrival door and the roofed porch that receives it.
 * Software expands these into ordinary roofs/portals, builds the usual editable geometry, then CHECKS the result
 * against the declaration. A declaration the construction cannot honour rejects the plan; nothing is substituted. */
export const compositionSchema=z.object({
 volumes:z.array(z.object({id,masses:z.array(id).min(1).max(12),tier:z.enum(['primary','secondary','subordinate']),roof:id.optional(),material:material.optional()}).strict()).min(1).max(12),
 heightStep:z.number().finite().min(.2).max(6).optional(),
 roofSpans:z.array(z.object({id,spaces:z.array(id).min(1).max(40),form:z.enum(['flat','gable','hip']),rise:z.number().finite().min(.18).max(8).optional(),overhang:z.number().finite().min(0).max(3).optional(),material:material.optional()}).strict()).max(12),
 facades:z.array(z.object({id,space:id,side:z.enum(['south','east','north','west']),kind:z.enum(['windows','doors']),to:id.optional(),bays:z.number().int().min(1).max(12),width:dimension,height:dimension,sill:z.number().finite().min(0).max(8).optional()}).strict()).max(24),
 entrance:z.object({portal:id,porch:id}).strict().optional(),
}).strict();
export type Composition=z.infer<typeof compositionSchema>;
export const DEFAULT_HEIGHT_STEP=.6;
const EDGE:Record<Side,number>={south:0,east:1,north:2,west:3};
const PIER=.36,MARGIN=.18;
export type SpanInfo={id:string;lead:string;members:string[];rect:Rect;polygon:Point[];form:'flat'|'gable'|'hip';rise?:number;overhang?:number;material?:z.infer<typeof material>};
export type FacadePortal={id:string;host:{space:string;edge:number};to:string;offset:number;width:number;height:number;mode:'door'|'window';sill?:number};
/** Where a facade rhythm was spread: the whole wall (the historical rule) or the one exposed/bordering run of it, in the directed edge's parameter. */
export type FacadeRun={id:string;space:string;side:Side;run:{lo:number;hi:number};wall:number;whole:boolean};
type Space={id:string;mass:string;level:string;outdoor:boolean};
type Roof={space:string;form:'flat'|'gable'|'hip';rise?:number;overhang?:number;material?:z.infer<typeof material>};
const rectPolygon=(r:Rect):Point[]=>[[r.x,r.z],[r.x+r.width,r.z],[r.x+r.width,r.z+r.depth],[r.x,r.z+r.depth]];
/** Geometry-only expansion before heights are known. Declared roof spans become one ordinary roof entry on a lead space;
 * facade rhythms become ordinary portals; volume materials become per-mass defaults (an explicit room material still wins). */
export type SpanInvalid={id:string;members:string[];problems:string[]};
const roofWords=(r:{form:string;rise?:number;overhang?:number;material?:string})=>`${r.form}${r.rise!==undefined?`, rise ${r.rise} m`:''}, overhang ${r.overhang??0} m${r.material?`, ${r.material}`:''}`;
/** How a space's own roofs entry relates to a roof span that also lists it: the same roof declared twice (redundant) or two different designs (conflict). */
export function roofDeclarationRelation(own:Roof,span:{form:string;rise?:number;overhang?:number;material?:string}):{redundant:boolean;differs:string[]}{
 const differs=(['form','rise','overhang','material'] as const).filter(k=>(own[k]??(k==='overhang'?0:undefined))!==(span[k]??(k==='overhang'?0:undefined)));
 return {redundant:differs.length===0,differs:[...differs]};
}
/** Geometry-only expansion before heights are known. Declared roof spans become one ordinary roof entry on a lead space;
 * facade rhythms become ordinary portals; volume materials become per-mass defaults (an explicit room material still wins).
 * Roof ownership: a space has exactly one roof, from its own roofs entry or from the one span that lists it. A span covers one or more rooms
 * (a one-room span is that room's roof, named so a volume can own it). Every independent problem of a span is reported together, so a plan is
 * not sent back one defect at a time. */
export function expandCompositionLenient(plan:{spaces:Space[];roofs:Roof[];portals:{id:string}[]},composition:Composition|undefined,rects:Map<string,Rect>){
 const problems:string[]=[],spans:SpanInfo[]=[],invalid:SpanInvalid[]=[],facades:FacadePortal[]=[],runs:FacadeRun[]=[],facadeProblems:{id:string;message:string}[]=[],massMaterial=new Map<string,z.infer<typeof material>>();
 let roofs=plan.roofs;
 if(!composition)return {spans,invalid,facades,facadeRuns:runs,facadeProblems,roofs,massMaterial,problems};
 const space=new Map(plan.spaces.map(s=>[s.id,s]));
 const owner=new Map<string,string>();
 for(const span of composition.roofSpans){
  const mine:string[]=[];
  const rs=span.spaces.map(sid=>({sid,s:space.get(sid),r:rects.get(sid)}));
  const missing=rs.filter(m=>!m.s||!m.r).map(m=>m.sid);
  if(missing.length)mine.push(`${span.id}: roof span names unknown space ${missing.join(', ')}.`);
  if(new Set(span.spaces).size!==span.spaces.length)mine.push(`${span.id}: roof span lists a space twice.`);
  // Ownership: a listed space may not already be roofed by another span or by an entry of its own.
  for(const sid of span.spaces){
   if(owner.has(sid)){mine.push(`${span.id}: ${sid} already belongs to roof span ${owner.get(sid)}; a space has exactly one roof. Remove it from one of the spans.`);continue;}
   const own=plan.roofs.find(r=>r.space===sid);
   if(!own)continue;
   const rel=roofDeclarationRelation(own,span);
   mine.push(rel.redundant
    ?`${span.id}: ${sid} is listed in this span and also has a roofs entry that declares the same roof (${roofWords(own)}): a redundant duplicate. Delete the roofs entry for ${sid}; the span already roofs it.`
    :`${span.id}: ${sid} is listed in this span (${roofWords(span)}) and also has its own different roof (${roofWords(own)}; differs in ${rel.differs.join(', ')}); a space has exactly one roof. Decide which design stands: keep ${sid} in the span and delete its roofs entry, or remove ${sid} from the span so it keeps its own roof.`);
  }
  if(!missing.length){
   const levels=new Set(rs.map(m=>m.s!.level));
   if(levels.size!==1)mine.push(`${span.id}: a roof span covers one level; ${span.spaces.join(', ')} sit on ${[...levels].join(', ')}.`);
   const x0=Math.min(...rs.map(m=>m.r!.x)),z0=Math.min(...rs.map(m=>m.r!.z)),x1=Math.max(...rs.map(m=>m.r!.x+m.r!.width)),z1=Math.max(...rs.map(m=>m.r!.z+m.r!.depth));
   const area=rs.reduce((a,m)=>a+m.r!.width*m.r!.depth,0),box=(x1-x0)*(z1-z0);
   if(Math.abs(area-box)>1e-6)mine.push(`${span.id}: its rooms do not tile one rectangle (${area.toFixed(2)} m² of rooms in a ${box.toFixed(2)} m² envelope). A single roof needs contiguous rooms filling a rectangle: split the span, or give the rest their own roofs.`);
   if(!mine.length){
    for(const sid of span.spaces)owner.set(sid,span.id);
    const rect:Rect={x:x0,z:z0,width:x1-x0,depth:z1-z0};
    spans.push({id:span.id,lead:span.spaces[0],members:span.spaces,rect,polygon:rectPolygon(rect),form:span.form,rise:span.rise,overhang:span.overhang,material:span.material});
    continue;
   }
  }
  problems.push(...mine);invalid.push({id:span.id,members:span.spaces.filter(sid=>space.has(sid)),problems:mine});
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
  const reject=(message:string)=>{problems.push(message);facadeProblems.push({id:f.id,message});};
  const length=f.side==='south'||f.side==='north'?r.width:r.depth;
  const others=plan.spaces.filter(o=>o.id!==f.id&&o.id!==f.space&&o.level===sp.level&&rects.has(o.id)).map(o=>({id:o.id,rect:rects.get(o.id)!}));
  const fit=(lo:number,hi:number)=>{const pitch=(hi-lo)/f.bays;return f.width+PIER<=pitch+1e-9&&f.width/2+MARGIN<=pitch/2+1e-9;};
  // Where bays may stand: windows on the wall no other room shares; doors on the wall the named outdoor space borders.
  const usable=f.kind==='windows'?freeRuns(length,sharedRuns(r,f.side,others)):sharedRuns(r,f.side,others.filter(o=>o.id===f.to)).map(x=>({lo:x.lo,hi:x.hi}));
  const whole={lo:0,hi:length};
  const standsIn=(lo:number,hi:number)=>usable.some(u=>lo>=u.lo+MARGIN-1e-9&&hi<=u.hi-MARGIN+1e-9);
  const evenly=(run:{lo:number;hi:number})=>Array.from({length:f.bays},(_,i)=>run.lo+(run.hi-run.lo)/f.bays*(i+.5));
  let run=whole;
  const entireWall=usable.length===1&&usable[0].lo<1e-9&&usable[0].hi>length-1e-9;
  if(fit(whole.lo,whole.hi)&&(entireWall||evenly(whole).every(c=>standsIn(c-f.width/2,c+f.width/2)))){run=whole;}
  else{
   // The rhythm does not stand on the whole wall. Spread it over the one run that can hold it; software never chooses between several, and never moves a bay off its run.
   const holds=usable.filter(u=>fit(u.lo,u.hi));
   const runWords=usable.map(u=>`${(u.lo).toFixed(2)}..${u.hi.toFixed(2)} m (${(u.hi-u.lo).toFixed(2)} m, room for ${Math.max(0,Math.floor((u.hi-u.lo)/(f.width+PIER)+1e-9))} bay${Math.floor((u.hi-u.lo)/(f.width+PIER)+1e-9)===1?'':'s'} of ${f.width} m)`).join('; ');
   if(entireWall){reject(`${f.id}: ${f.bays} bays of ${f.width} m do not fit the ${length} m ${f.side} wall of ${f.space} (bay pitch ${(length/f.bays).toFixed(2)} m needs ${(f.width+PIER).toFixed(2)} m with piers). Fewer or narrower bays.`);continue;}
   if(!usable.length){reject(`${f.id}: the ${f.side} wall of ${f.space} (${length} m) ${f.kind==='windows'?'is shared with other rooms along its whole length, so it has no exposed wall for windows':`does not border ${f.to}`}. Choose another wall of ${f.space}${f.kind==='windows'?'':` or the wall ${f.to} borders`}.`);continue;}
   if(!holds.length){reject(`${f.id}: ${f.bays} bays of ${f.width} m (${(f.width+PIER).toFixed(2)} m each with piers) fit no ${f.kind==='windows'?'exposed':`${f.to}-facing`} run of the ${f.side} wall of ${f.space}. ${f.kind==='windows'?'Exposed':'Bordering'} runs: ${runWords}. Fewer or narrower bays, or another wall.`);continue;}
   if(holds.length>1){reject(`${f.id}: the ${f.side} wall of ${f.space} has ${holds.length} ${f.kind==='windows'?'exposed':`${f.to}-facing`} runs that each hold ${f.bays} bays of ${f.width} m (${holds.map(u=>`${u.lo.toFixed(2)}..${u.hi.toFixed(2)} m`).join('; ')}); the rhythm cannot choose between them. Author the openings individually or use another wall.`);continue;}
   run=holds[0];
  }
  runs.push({id:f.id,space:f.space,side:f.side,run,wall:length,whole:run===whole});
  for(let i=0;i<f.bays;i++){
   const pid=`${f.id}-${i+1}`;
   if(taken.has(pid)){reject(`${pid}: generated opening id collides with an existing portal.`);continue;}
   taken.add(pid);
   facades.push({id:pid,host:{space:f.space,edge:EDGE[f.side]},to:f.kind==='doors'?f.to!:'exterior',offset:(run.hi-run.lo)/f.bays*(i+.5)+run.lo,width:f.width,height:f.height,mode:f.kind==='doors'?'door':'window',...(f.kind==='windows'?{sill:f.sill??.8}:{})});
  }
 }
 for(const v of composition.volumes)if(v.material)for(const m of v.masses)massMaterial.set(m,v.material);
 return {spans,invalid,facades,facadeRuns:runs,facadeProblems,roofs,massMaterial,problems};
}
/** The compiler's strict form: any problem rejects the plan, nothing is substituted. */
export function expandComposition(plan:{spaces:Space[];roofs:Roof[];portals:{id:string}[]},composition:Composition|undefined,rects:Map<string,Rect>){
 const expanded=expandCompositionLenient(plan,composition,rects),{problems,spans,facades,roofs,massMaterial}=expanded;
 if(problems.length)throw new DesignConflict(problems);
 return {spans,facades,facadeRuns:expanded.facadeRuns,roofs,massMaterial};
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
/** What a volume's roof claim means, stated once for the built-house check and for the plan diagnosis: volumes[].roof names the volume's principal
 * BUILDING-SCALE roof (a roofSpan, which may be one room's), and that span exists and covers only this volume's rooms. It is not a claim that the
 * whole volume sits under it: the volume's other rooms keep their own ROOM-OWNED roofs (a lower kitchen, a veranda), and a volume may have further spans.
 * What is never allowed is one room under two roofs (see expandCompositionLenient). */
export function volumeRoofClaimProblems(v:{id:string;roof?:string},ownIds:string[],spans:{id:string;members:string[]}[]){
 if(!v.roof)return [];
 const span=spans.find(s=>s.id===v.roof);
 if(!span)return [`${v.id}: roof ${v.roof} is not a declared roof span.`];
 const own=new Set(ownIds),problems:string[]=[];
 const foreign=span.members.filter(m=>!own.has(m));
 if(foreign.length)problems.push(`${v.id}: its roof ${span.id} also covers ${foreign.join(', ')}, which belong to other volumes; a volume's roof covers that volume.`);
 return problems;
}
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
 for(const {v,top} of built){
  const own=new Set(v.masses.flatMap(m=>spaces.filter(s=>s.mass===m).map(s=>s.id)));
  let roofId:string|null=null;
  if(v.roof){
   const span=spans.find(s=>s.id===v.roof);
   problems.push(...volumeRoofClaimProblems(v,[...own],spans.map(q=>({id:q.id,members:q.members}))));
   if(span){
    roofId=span.id;
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
