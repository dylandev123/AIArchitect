/** Whole-building spatial coordination for an architectural-plan-1.
 *
 * The author decides what the building IS: wings, how they relate, which rooms belong together, what must stay apart,
 * what must meet, what a court is enclosed by. This module computes the physical consequences of those decisions over
 * the WHOLE arrangement at once and reports what they imply:
 *   - wing envelopes and where each wing's rigid frame landed (layout.ts is the single resolver);
 *   - every pair of occupied volumes across all levels, attributed to the placement decision where the two wings
 *     (or rooms) met, with candidate single-edit options (explainCollisions);
 *   - declared constraints (separate / adjoin / enclose) measured on the resolved arrangement, with candidate options;
 *   - what inflates each wing's extent (porch, terrace or annex spaces that project beyond its enclosed volume);
 *   - landscape and pool allocations that overlap occupied rooms, and the site the arrangement needs;
 *
 * Every option offered here is a CANDIDATE: it was checked against the arrangement (layout, collisions, constraints, site) only. It is
 * not claimed to be safe. corrections.ts re-checks each candidate against the openings, access, roof, screen and compiler stages and
 * classifies it; nothing is applied by software.
 *   - wing-level circulation: which wings touch, how far, and whether a door or stair connects them;
 *   - what is stacked on what (support), the site the arrangement needs, and contradictions between declarations.
 *
 * It never edits a plan and never chooses between valid arrangements. Where several single edits would clear a
 * conflict, that is an unresolved architectural choice and is reported as one; where none does, the decisions
 * that jointly produce the conflict are named. Pure and tolerant: it does not throw on an invalid plan. */
import type {ArchitecturalPlan,ArchitecturalConstraint} from './plan';
import {resolveLayout,resolveSiteRects,placementPath,type Rect,type WingFrame} from './layout';
import {massMembers,primaryMembers,boundsOf} from './massAnchor';
import {volumeCollisions,explainCollisions,describeDecision,levelTops,withEdits,placementRef,movedBetween,overlapOf,type CollisionDecision,type Option,type PlanEdit} from './arrangement';
import {sharedRuns,SIDES} from './coordination';
type Space=ArchitecturalPlan['spaces'][number];
const f2=(n:number)=>Number(n.toFixed(2));
const EPS=1e-6;

export type SpatialError={kind:'layout'|'collision'|'constraint'|'declaration'|'site';ids:string[];message:string};
/** A candidate single correction (possibly several edits that belong together). `checked` names what was actually re-run on the edited plan. */
export type ConstraintOption={node:string;entity:'space'|'wing';field:'alignment'|'gap'|'attached';from:string|number|boolean;to:string|number|boolean;edits:PlanEdit[];measuredAfter:number;displaces:number;newErrors:string[];note:string;
 checked:readonly ['layout','collisions','constraints','site'];status:'candidate'};
const CHECKED=['layout','collisions','constraints','site'] as const;
/** What stretches a wing's extent: the space(s) at one extreme of its (non-attached) members and how far the extent would shrink without them. */
export type ExtentDriver={side:'west'|'east'|'south'|'north';spaces:string[];beyondBy:number;outdoor:boolean};
export type SiteConflict={item:string;with:string;overlap:Rect;decision:string;explanation:string;options:{edits:PlanEdit[];note:string;newErrors:string[];status:'candidate'}[]};
export type ConstraintResult={id:string;kind:ArchitecturalConstraint['kind'];a:string;b?:string;required:number;measured:number|null;ok:boolean;reason:string;problem?:string;
 /** Placement nodes (rooms and wings) whose relationship produced the measurement: the decisions to reconsider. */
 implicated:{node:string;placement:string}[];
 /** Single placement edits that would satisfy it without creating another error. Offers, never applied. */
 options:ConstraintOption[]};
export type WingSummary={id:string;role:string;placed:boolean;rooms:number;indoorRooms:number;levels:string[];/** Every room of the wing, attached or not. */envelope:Rect;/** The extent the wing is placed by and anchors others by (attached spaces excluded). */placementEnvelope:Rect;attached:string[];extentDrivers:ExtentDriver[];indoorAreaM2:number;fill:number;relation:string|null;seed:string|null};
export type WingLink={wing:string;sharedM:number;connected:boolean};
/** fixed = a client-supplied property boundary (never enlarged by software); model-defined = a fictional site the plan itself declared. */
export type SiteBasis='fixed'|'model-defined';
export type Coordination={
 wings:WingSummary[];
 /** Room-level overlaps, each explained at the placement decision where the two chains meet. */
 collisions:CollisionDecision[];
 constraints:ConstraintResult[];
 circulation:{arrival:string;wings:{id:string;interiorRooms:number;reachable:number;adjoins:WingLink[]}[]};
 /** Upper-level interior rooms with the share of their footprint that stands on interior rooms of the level below. */
 vertical:{space:string;level:string;supportedFraction:number;unsupportedM2:number}[];
 site:{required:{width:number;depth:number};available:{width:number;depth:number};fits:boolean;basis:SiteBasis;/** Which room, pool or landscape item sets each required extent. */drivers:{width:string|null;depth:string|null}};
 /** Pools and landscape allocations overlapping occupied rooms or each other, attributed to the placement that creates each overlap. */
 siteConflicts:SiteConflict[];
 errors:SpatialError[];
 /** Conflicts with more than one valid way out: choices the author has not made. */
 openChoices:{about:string;options:string[]}[];
 ok:boolean;
};

const rectGap=(a:Rect,b:Rect)=>{const dx=Math.max(0,a.x-(b.x+b.width),b.x-(a.x+a.width)),dz=Math.max(0,a.z-(b.z+b.depth),b.z-(a.z+a.depth));return Math.hypot(dx,dz);};
type World={plan:ArchitecturalPlan;rects:Map<string,Rect>;frames:Map<string,WingFrame>;siteRects:Map<string,Rect>;problems:{id:string;message:string}[]};
function world(plan:ArchitecturalPlan):World{
 const {rects,frames,problems}=resolveLayout(plan),site=resolveSiteRects(plan,rects);
 return {plan,rects,frames,siteRects:site.rects,problems:[...problems,...site.problems]};
}
/** Rectangles an entity id stands for: a space, every room of a wing, or a pool/landscape item. */
function entityRects(w:World,id:string,interiorOnly=false):{rects:{space:Space|null;rect:Rect}[];kind:'space'|'wing'|'site'}|null{
 const s=w.plan.spaces.find(x=>x.id===id);
 if(s){const r=w.rects.get(id);return r?{rects:[{space:s,rect:r}],kind:'space'}:null;}
 if(w.plan.masses.some(m=>m.id===id)){
  let members=massMembers(w.plan,id).filter(m=>w.rects.has(m.id));
  if(interiorOnly&&members.some(m=>!m.outdoor))members=members.filter(m=>!m.outdoor);
  return members.length?{rects:members.map(m=>({space:m,rect:w.rects.get(m.id)!})),kind:'wing'}:null;
 }
 const r=w.siteRects.get(id);return r?{rects:[{space:null,rect:r}],kind:'site'}:null;
}
/** Shared wall length between two sets of rooms that stand on the same level. */
function sharedLength(a:{space:Space|null;rect:Rect}[],b:{space:Space|null;rect:Rect}[]){
 let total=0;
 for(const x of a)for(const y of b){
  if(x.space&&y.space&&(x.space.id===y.space.id||x.space.level!==y.space.level))continue;
  if(!x.space||!y.space)continue;
  for(const side of SIDES)for(const run of sharedRuns(x.rect,side,[{id:y.space.id,rect:y.rect}]))total+=run.hi-run.lo;
 }
 return total;
}
/** Fraction of an outdoor/any space's perimeter that is bounded by interior rooms of the same level. */
function enclosure(w:World,space:Space,rect:Rect){
 const others=w.plan.spaces.filter(o=>o.id!==space.id&&!o.outdoor&&o.level===space.level&&w.rects.has(o.id)).map(o=>({id:o.id,rect:w.rects.get(o.id)!}));
 const perimeter=2*(rect.width+rect.depth);let bounded=0;
 for(const side of SIDES)for(const run of sharedRuns(rect,side,others))bounded+=run.hi-run.lo;
 return perimeter>0?bounded/perimeter:0;
}
type Measure={value:number|null;problem?:string};
function measure(w:World,c:ArchitecturalConstraint):Measure{
 const a=entityRects(w,c.a,c.kind!=='enclose');
 if(!a)return {value:null,problem:`${c.id}: ${c.a} is not a resolvable space, wing, pool or landscape item.`};
 if(c.kind==='enclose'){
  const s=w.plan.spaces.find(x=>x.id===c.a);
  if(!s)return {value:null,problem:`${c.id}: enclose needs a space (a court or terrace), not ${c.a}.`};
  return {value:enclosure(w,s,w.rects.get(s.id)!)};
 }
 if(!c.b)return {value:null,problem:`${c.id}: ${c.kind} needs a second entity (b).`};
 const b=entityRects(w,c.b,true);
 if(!b)return {value:null,problem:`${c.id}: ${c.b} is not a resolvable space, wing, pool or landscape item.`};
 if(c.a===c.b)return {value:null,problem:`${c.id}: a and b are the same entity.`};
 if(c.kind==='separate')return {value:Math.min(...a.rects.flatMap(x=>b.rects.map(y=>rectGap(x.rect,y.rect))))};
 return {value:sharedLength(a.rects,b.rects)};
}
const satisfied=(c:ArchitecturalConstraint,v:number|null)=>v!==null&&(c.kind==='separate'?v>=c.amount-EPS:v>=c.amount-EPS);
const describePlacement=(plan:ArchitecturalPlan,node:string)=>{const p=placementRef(plan,node);return p?(p.relativeTo===null?`${node}: local origin`:`${node}: ${p.side} of ${p.relativeTo}, ${p.alignment}, gap ${p.gap}`):`${node}: (no placement)`;};

/** Site the arrangement needs (the site is centred on the room cells, then rotated by the orientation), and which room or item sets each extent. */
function siteNeed(w:World){
 const rs=[...w.rects.values()];
 if(!rs.length)return {width:0,depth:0,drivers:{width:null as string|null,depth:null as string|null}};
 const b=boundsOf(rs),cx=b.x+b.width/2,cz=b.z+b.depth/2,c=Math.cos(w.plan.orientation),s=Math.sin(w.plan.orientation);
 let hx=0,hz=0,dx:string|null=null,dz:string|null=null;
 const take=(id:string,r:Rect,margin=0)=>{
  const x=c*(r.x+r.width/2-cx)+s*(r.z+r.depth/2-cz),z=-s*(r.x+r.width/2-cx)+c*(r.z+r.depth/2-cz);
  const pw=Math.abs(c)*(r.width+margin)+Math.abs(s)*(r.depth+margin),pd=Math.abs(s)*(r.width+margin)+Math.abs(c)*(r.depth+margin);
  if(Math.abs(x)+pw/2>hx+EPS){hx=Math.abs(x)+pw/2;dx=id;}
  if(Math.abs(z)+pd/2>hz+EPS){hz=Math.abs(z)+pd/2;dz=id;}
 };
 for(const [id,r] of w.rects)take(id,r);
 for(const p of w.plan.pools){const r=w.siteRects.get(p.id);if(r)take(p.id,r,.4);}
 for(const l of w.plan.landscape){const r=w.siteRects.get(l.id);if(r)take(l.id,r);}
 return {width:f2(2*hx),depth:f2(2*hz),drivers:{width:dx,depth:dz}};
}
/** Pools (with their 0.4 m basin margin) and landscape that overlap a room or an earlier site item: the same conservative test the diagnosis and the compiler apply. */
function siteOverlaps(w:World){
 const out:{item:string;with:string;overlap:Rect}[]=[];
 const placed=[...w.rects].map(([id,rect])=>({id,rect}));
 for(const item of [...w.plan.pools,...w.plan.landscape]){
  const r=w.siteRects.get(item.id);if(!r)continue;
  const m='waterDepth' in item?.4:0,grown={x:r.x-m/2,z:r.z-m/2,width:r.width+m,depth:r.depth+m};
  for(const o of placed){const ov=overlapOf(grown,o.rect);if(ov)out.push({item:item.id,with:o.id,overlap:ov});}
  placed.push({id:item.id,rect:grown});
 }
 return out;
}
/** For each side of a wing's (non-attached) extent: the spaces that sit at that extreme and how far the extent would shrink without them. */
export function extentDrivers(w:{plan:ArchitecturalPlan;rects:Map<string,Rect>},massId:string):ExtentDriver[]{
 const members=primaryMembers(w.plan,massId).filter(m=>w.rects.has(m.id)).map(m=>({m,r:w.rects.get(m.id)!}));
 if(members.length<2)return [];
 const b=boundsOf(members.map(x=>x.r));
 const sides:{side:ExtentDriver['side'];at:(r:Rect)=>number;edge:number;beyond:(rem:Rect)=>number}[]=[
  {side:'west',at:r=>r.x,edge:b.x,beyond:rem=>rem.x-b.x},
  {side:'east',at:r=>r.x+r.width,edge:b.x+b.width,beyond:rem=>b.x+b.width-(rem.x+rem.width)},
  {side:'south',at:r=>r.z,edge:b.z,beyond:rem=>rem.z-b.z},
  {side:'north',at:r=>r.z+r.depth,edge:b.z+b.depth,beyond:rem=>b.z+b.depth-(rem.z+rem.depth)}];
 return sides.flatMap(sd=>{
  const hit=members.filter(x=>Math.abs(sd.at(x.r)-sd.edge)<EPS),rest=members.filter(x=>!hit.includes(x));
  if(!rest.length)return [];
  const beyondBy=sd.beyond(boundsOf(rest.map(x=>x.r)));
  return beyondBy>EPS?[{side:sd.side,spaces:hit.map(x=>x.m.id),beyondBy:f2(beyondBy),outdoor:hit.every(x=>x.m.outdoor)}]:[];
 });
}

/** Everything that makes this arrangement invalid, as stable keys, for verifying that a candidate edit adds nothing new. */
function errorKeys(w:World,tops:Map<string,number>):Set<string>{
 const keys=new Set<string>();
 w.problems.forEach(p=>keys.add(`layout:${p.id}`));
 for(const c of volumeCollisions(w.plan,w.rects,tops))keys.add(`collision:${c.a}/${c.b}`);
 for(const c of w.plan.constraints??[]){const m=measure(w,c);if(m.problem||!satisfied(c,m.value))keys.add(`constraint:${c.id}`);}
 const need=siteNeed(w);if(need.width>w.plan.site.width+EPS||need.depth>w.plan.site.depth+EPS)keys.add('site:fit');
 for(const o of siteOverlaps(w))keys.add(`site:overlap:${o.item}/${o.with}`);
 return keys;
}

/** Stable keys for everything that makes the arrangement invalid; used to verify that a candidate edit adds nothing new. */
export const arrangementKeys=(plan:ArchitecturalPlan)=>errorKeys(world(plan),levelTops(plan));
export function coordinatePlan(plan:ArchitecturalPlan,options:{siteBasis?:SiteBasis}={}):Coordination{
 const w=world(plan),tops=levelTops(plan),errors:SpatialError[]=[],openChoices:Coordination['openChoices']=[];
 for(const p of w.problems)errors.push({kind:'layout',ids:[p.id],message:p.message});

 // Wings: envelopes from the resolved rooms (a placed wing's is the envelope it was placed by).
 const wings:WingSummary[]=plan.masses.flatMap(m=>{
  const members=massMembers(plan,m.id).filter(s=>w.rects.has(s.id));if(!members.length)return [];
  const envelope=boundsOf(members.map(s=>w.rects.get(s.id)!)),indoor=members.filter(s=>!s.outdoor),area=indoor.reduce((n,s)=>n+s.width*s.depth,0);
  const p=m.placement,own=primaryMembers(plan,m.id).filter(s=>w.rects.has(s.id));
  return [{id:m.id,role:m.role,placed:!!p,rooms:members.length,indoorRooms:indoor.length,levels:[...new Set(members.map(s=>s.level))],envelope,placementEnvelope:boundsOf(own.map(s=>w.rects.get(s.id)!)),attached:members.filter(s=>s.attached).map(s=>s.id),extentDrivers:extentDrivers(w,m.id),indoorAreaM2:f2(area),fill:f2(Math.min(1,area/(envelope.width*envelope.depth))),
   relation:p?`${p.side} of ${p.relativeTo}, ${p.alignment}, gap ${p.gap}`:null,seed:w.frames.get(m.id)?.seed??null}];
 });

 // Collisions across all levels, explained where the placement chains meet.
 const collisions=explainCollisions(plan);
 for(const d of collisions){
  const ma=plan.spaces.find(s=>s.id===d.pair[0])!.mass,mb=plan.spaces.find(s=>s.id===d.pair[1])!.mass;
  errors.push({kind:'collision',ids:[...d.pair],message:`${d.pair.join(' × ')}${ma!==mb?` (wings ${ma} × ${mb})`:` (inside wing ${ma})`}: ${describeDecision(d)}`});
  if(d.options.length>1)openChoices.push({about:`${d.pair.join(' × ')}: ${d.heads.filter(Boolean).join(' or ')} must yield`,options:d.options.map(o=>`${o.entity==='wing'?'wing ':''}${o.space}.${o.field} ${o.from}→${o.to}`)});
 }

 // Declared constraints, measured; contradictions between declarations.
 const base=errorKeys(w,tops),constraints:ConstraintResult[]=[];
 const list=plan.constraints??[];
 const ids=list.map(c=>c.id);
 if(new Set(ids).size!==ids.length)errors.push({kind:'declaration',ids:ids.filter((x,i)=>ids.indexOf(x)!==i),message:'Constraint ids must be unique.'});
 for(const c of list){
  const m=measure(w,c),ok=satisfied(c,m.value),implicated=[...new Set([c.a,...(c.b?[c.b]:[])].flatMap(e=>{
   const ent=plan.spaces.find(s=>s.id===e);const start=ent?e:plan.masses.some(x=>x.id===e)?e:null;return start?placementPath(plan,start).slice(0,4):[];
  }))].filter(n=>placementRef(plan,n)&&placementRef(plan,n)!.relativeTo!==null).map(n=>({node:n,placement:describePlacement(plan,n)}));
  const result:ConstraintResult={id:c.id,kind:c.kind,a:c.a,b:c.b,required:c.amount,measured:m.value===null?null:f2(m.value),ok,reason:c.reason,problem:m.problem,implicated,options:[]};
  if(!ok&&!m.problem){
   const short=Math.max(0,c.amount-(m.value??0)),tried=new Set<string>();
   const consider=(edits:PlanEdit[],note:string)=>{
    const tag=edits.map(e=>`${e.node}.${e.field}=${e.to}`).join('+');
    if(tried.has(tag))return;tried.add(tag);
    const ew=world(withEdits(plan,edits)),after=measure(ew,c);
    if(after.problem||!satisfied(c,after.value))return;
    const created=[...errorKeys(ew,tops)].filter(k=>!base.has(k));
    const first=edits[0],wing=plan.masses.some(x=>x.id===first.node)&&!plan.spaces.some(s=>s.id===first.node);
    const own=new Set(edits.flatMap(e=>plan.masses.some(x=>x.id===e.node)&&!plan.spaces.some(s=>s.id===e.node)?massMembers(plan,e.node).map(x=>x.id):[e.node]));
    result.options.push({node:first.node,entity:wing?'wing':'space',field:first.field as ConstraintOption['field'],from:first.from,to:first.to,edits,measuredAfter:f2(after.value!),displaces:movedBetween(w.rects,ew.rects,own).length,newErrors:created,note,checked:CHECKED,status:'candidate'});
   };
   const attempt=(node:string,field:'alignment'|'gap',value:string|number,note:string)=>{
    const ref=placementRef(plan,node);if(!ref||ref.relativeTo===null||ref.side==='origin')return;
    const from=(ref as unknown as Record<string,string|number>)[field];
    if(from===value)return;
    consider([{node,field,from,to:value}],note);
   };
   for(const {node} of implicated.slice(0,6)){
    const ref=placementRef(plan,node)!;if(ref.side==='origin'||ref.side==='same')continue;
    for(const al of ['start','centre','end'] as const)attempt(node,'alignment',al,`re-align ${node}`);
    if(c.kind==='separate')for(const extra of new Set([short,Math.ceil(short*2)/2]))attempt(node,'gap',f2(ref.gap+extra),`move ${node} ${f2(extra)} m further from its anchor (changes the gap, a design separation)`);
    else if(ref.gap>0)attempt(node,'gap',0,`close the ${f2(ref.gap)} m gap before ${node} so the two can share a wall`);
   }
   // A wing's extent can be inflated by a porch, terrace or annex that belongs to it but is not its enclosed volume. Declaring such a space
   // `attached` (the author's call; offered, never applied) lets the neighbouring wing meet the enclosed rooms. Every driver set on every side is tried.
   if(c.kind==='adjoin')for(const e of [c.a,c.b!]){
    const mass=plan.masses.some(x=>x.id===e)?e:plan.spaces.find(x=>x.id===e)?.mass;if(!mass)continue;
    const drivers=extentDrivers(w,mass).filter(d=>!d.spaces.every(id=>plan.spaces.find(q=>q.id===id)?.attached));
    // The room a declared door or stair joins to the other entity is the connection the constraint exists for; it is never offered as "attached".
    const otherId=e===c.a?c.b:c.a,partner=new Set(otherId?(entityRects(w,otherId,false)?.rects.flatMap(r=>r.space?[r.space.id]:[])??[]):[]);
    const joins=(id:string)=>plan.portals.some(p=>p.mode!=='window'&&((p.host.space===id&&partner.has(p.to))||(p.to===id&&partner.has(p.host.space))))||plan.stairs.some(st=>(st.lower===id&&partner.has(st.upper))||(st.upper===id&&partner.has(st.lower)));
    const sets=[...drivers.map(d=>d.spaces),...(drivers.length>1?[[...new Set(drivers.flatMap(d=>d.spaces))]]:[])].filter(ids=>!ids.some(joins));
    for(const ids of sets)consider(ids.map(id=>({node:id,field:'attached' as const,from:false,to:true})),`declare ${ids.join(', ')} attached to wing ${mass}: ${ids.length>1?'they belong':'it belongs'} to the wing but ${ids.length>1?'are':'is'} not its enclosed volume, so the wing is placed and anchored by its remaining rooms`);
   }
   result.options.sort((x,y)=>x.newErrors.length-y.newErrors.length||x.displaces-y.displaces||String(x.to).localeCompare(String(y.to)));
   result.options=result.options.slice(0,6);
   if(result.options.length>1)openChoices.push({about:`${c.id} (${c.kind} ${c.a}${c.b?` / ${c.b}`:''}, required ${c.amount}, measured ${f2(m.value??0)})`,options:result.options.map(o=>o.edits.map(e=>`${o.entity==='wing'&&e===o.edits[0]?'wing ':''}${e.node}.${e.field} ${e.from}→${e.to}`).join(' + '))});
  }
  constraints.push(result);
  if(m.problem)errors.push({kind:'declaration',ids:[c.id],message:m.problem});
  else if(!ok)errors.push({kind:'constraint',ids:[c.id,c.a,...(c.b?[c.b]:[])],message:`${c.id} (${c.kind}: ${c.reason}) is not met: ${c.kind==='separate'?`${c.a} and ${c.b} are ${f2(m.value??0)} m apart, ${f2(c.amount)} m required`:c.kind==='adjoin'?`${c.a} and ${c.b} share ${f2(m.value??0)} m of wall, ${f2(c.amount)} m required`:`${c.a} is bounded by interior rooms along ${f2((m.value??0)*100)}% of its perimeter, ${f2(c.amount*100)}% required`}. ${result.options.length?`Candidate edits that meet the measurement (checked against layout, collisions, constraints and site only; not verified against openings, access, roofs or compilation, see corrections): ${result.options.slice(0,4).map(o=>`${o.edits.map(e=>`${o.entity==='wing'&&e===o.edits[0]?'wing ':''}${e.node}.${e.field} ${e.from}→${e.to}`).join(' + ')}${o.newErrors.length?` (creates ${o.newErrors.length} new)`:''}`).join('; ')}.`:`No single placement edit meets it. The relationships that produce this measurement are: ${implicated.map(i=>i.placement).join(' | ')||'(none declared)'}; one of them, or the constraint, must be reconsidered.`} Software has changed nothing.`});
 }
 // Declarations that cannot both hold.
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const p=list[i],q=list[j],pair=(x:ArchitecturalConstraint,y:ArchitecturalConstraint)=>x.b!==undefined&&y.b!==undefined&&((x.a===y.a&&x.b===y.b)||(x.a===y.b&&x.b===y.a));
  if(!pair(p,q))continue;
  const sep=p.kind==='separate'?p:q.kind==='separate'?q:null,adj=p.kind==='adjoin'?p:q.kind==='adjoin'?q:null;
  if(sep&&adj&&sep.amount>0&&adj.amount>0)errors.push({kind:'declaration',ids:[sep.id,adj.id],message:`${sep.id} (separate ${sep.a}/${sep.b} by ${sep.amount} m) and ${adj.id} (adjoin by ${adj.amount} m) cannot both hold: wings that share a wall are 0 m apart. Decide which relationship the concept needs.`});
 }

 // Wing-level circulation: who touches whom, and whether a door or stair already connects them.
 const indoor=plan.spaces.filter(s=>!s.outdoor&&w.rects.has(s.id));
 const reach=new Set<string>([plan.arrival]),queue=[plan.arrival];
 const linked=(a:string,b:string)=>plan.portals.some(p=>p.mode!=='window'&&p.to!=='exterior'&&((p.host.space===a&&p.to===b)||(p.host.space===b&&p.to===a)))||plan.stairs.some(st=>(st.lower===a&&st.upper===b)||(st.upper===a&&st.lower===b));
 while(queue.length){const a=queue.shift()!;for(const s of plan.spaces)if(!reach.has(s.id)&&linked(a,s.id)){reach.add(s.id);queue.push(s.id);}}
 const circulation:Coordination['circulation']={arrival:plan.arrival,wings:plan.masses.flatMap(m=>{
  const mine=indoor.filter(s=>s.mass===m.id);if(!mine.length)return [];
  const adjoins:WingLink[]=[];
  for(const o of plan.masses){
   if(o.id===m.id)continue;const theirs=indoor.filter(s=>s.mass===o.id);if(!theirs.length)continue;
   const len=sharedLength(mine.map(s=>({space:s,rect:w.rects.get(s.id)!})),theirs.map(s=>({space:s,rect:w.rects.get(s.id)!})));
   if(len>EPS)adjoins.push({wing:o.id,sharedM:f2(len),connected:mine.some(a=>theirs.some(b=>linked(a.id,b.id)))});
  }
  return [{id:m.id,interiorRooms:mine.length,reachable:mine.filter(s=>reach.has(s.id)).length,adjoins}];
 })};

 // Stacking: how much of each upper room stands on interior rooms below it (a cantilever is a design choice, not an error).
 const vertical:Coordination['vertical']=[];
 for(const s of indoor){
  const lvl=plan.levels.find(l=>l.id===s.level);if(!lvl||lvl.above===null)continue;
  const r=w.rects.get(s.id)!,below=indoor.filter(o=>o.level===lvl.above&&w.rects.has(o.id));
  let covered=0;for(const o of below){const q=w.rects.get(o.id)!,x=Math.min(r.x+r.width,q.x+q.width)-Math.max(r.x,q.x),z=Math.min(r.z+r.depth,q.z+q.depth)-Math.max(r.z,q.z);if(x>EPS&&z>EPS)covered+=x*z;}
  const area=r.width*r.depth;vertical.push({space:s.id,level:s.level,supportedFraction:f2(Math.min(1,covered/area)),unsupportedM2:f2(Math.max(0,area-covered))});
 }

 // Site: what the arrangement needs. Determined by the arrangement, so stated rather than guessed. A fixed (client) boundary is never
 // enlarged by software; a model-defined site could be, and the exact minimum is offered for that case (corrections.ts verifies it).
 const need=siteNeed(w),fits=need.width<=plan.site.width+EPS&&need.depth<=plan.site.depth+EPS,basis=options.siteBasis??'model-defined';
 const driverText=(id:string|null)=>{if(!id)return 'the arrangement';const p=placementRef(plan,id);return p?`${describePlacement(plan,id)}`:id;};
 if(!fits&&!w.problems.length)errors.push({kind:'site',ids:[need.drivers.width,need.drivers.depth].filter((x):x is string=>!!x),message:`The arrangement needs a site of at least ${need.width}×${need.depth} m (centred on the room cells, orientation applied); the plan declares ${plan.site.width}×${plan.site.depth} m. ${need.width>plan.site.width+EPS?`Width is set by ${need.drivers.width} (${driverText(need.drivers.width)}). `:''}${need.depth>plan.site.depth+EPS?`Depth is set by ${need.drivers.depth} (${driverText(need.drivers.depth)}). `:''}${basis==='fixed'?'The property boundary is fixed: software does not enlarge it, so moving or reducing the allocations that set the extent is the only way to fit, and that is a design choice.':'The site is model-defined: enlarging it to the stated minimum is a determined consequence; moving the allocations inward is a design choice.'}`});

 // Landscape and pools against occupied rooms: each overlap is attributed to the site item's own placement, with candidate edits (never applied).
 const siteConflicts:SiteConflict[]=[];
 if(!w.problems.length)for(const o of siteOverlaps(w)){
  const item=[...plan.pools,...plan.landscape].find(i=>i.id===o.item);if(!item)continue;
  const other=plan.spaces.find(x=>x.id===o.with),anchorRect=item.placement.relativeTo?(w.rects.get(item.placement.relativeTo)??w.siteRects.get(item.placement.relativeTo)):undefined,mine=w.siteRects.get(item.id)!;
  const explanation=`${item.id} (${describePlacement(plan,item.id)}; ${f2(item.width)}×${f2(item.depth)} m, x ${f2(mine.x)}..${f2(mine.x+mine.width)}, z ${f2(mine.z)}..${f2(mine.z+mine.depth)}) overlaps ${o.with}${other?` (${describePlacement(plan,o.with)})`:''} by ${f2(o.overlap.width)}×${f2(o.overlap.depth)} m.${anchorRect&&item.placement.relativeTo?` It is ${f2(item.width)} m wide against its anchor ${item.placement.relativeTo}, which is ${f2(anchorRect.width)} m wide, so it extends ${f2(Math.max(0,(item.width-anchorRect.width)/2))} m past each side of that anchor when centred; the overlap is created by this item's own size and placement, not by ${o.with}.`:''}`;
  const sc:SiteConflict={item:item.id,with:o.with,overlap:o.overlap,decision:`${item.id}: ${describePlacement(plan,item.id)}`,explanation,options:[]};
  const key=`site:overlap:${o.item}/${o.with}`,tried=new Set<string>(),axisX=item.placement.side==='east'||item.placement.side==='west';
  const gap=item.placement.gap;
  const consider=(edits:PlanEdit[],note:string)=>{
   const tag=edits.map(e=>`${e.node}.${e.field}=${e.to}`).join('+');if(tried.has(tag))return;tried.add(tag);
   const ew=world(withEdits(plan,edits)),after=errorKeys(ew,tops);
   if(after.has(key))return;
   sc.options.push({edits,note,newErrors:[...after].filter(k=>!base.has(k)),status:'candidate'});
  };
  for(const al of ['start','centre','end'] as const)if(al!==item.placement.alignment&&item.placement.side!=='same'&&item.placement.side!=='origin')consider([{node:item.id,field:'alignment',from:item.placement.alignment,to:al}],`re-align ${item.id}`);
  for(const extra of new Set([f2(axisX?o.overlap.width:o.overlap.depth),Math.ceil((axisX?o.overlap.width:o.overlap.depth)*2)/2]))consider([{node:item.id,field:'gap',from:gap,to:f2(gap+extra)}],`move ${item.id} ${f2(extra)} m further from ${item.placement.relativeTo} (the gap is a design separation)`);
  const over=item.placement.alignment==='centre'?2:1;
  for(const [field,amount] of [['width',o.overlap.width],['depth',o.overlap.depth]] as const){
   const next=f2(item[field]-Math.ceil(amount*over*2)/2);if(next>0)consider([{node:item.id,field,from:item[field],to:next}],`reduce ${item.id} ${field} to ${next} m`);
  }
  sc.options=sc.options.sort((x,y)=>x.newErrors.length-y.newErrors.length).slice(0,6);
  siteConflicts.push(sc);
  errors.push({kind:'site',ids:[o.item,o.with],message:`${explanation} ${sc.options.length?`Candidate edits (not verified beyond the arrangement): ${sc.options.slice(0,3).map(q=>q.edits.map(e=>`${e.node}.${e.field} ${e.from}→${e.to}`).join(' + ')).join('; ')}.`:'No single edit to this item clears it.'} Software has moved nothing.`});
 }

 return {wings,collisions,constraints,circulation,vertical,site:{required:{width:need.width,depth:need.depth},available:{width:plan.site.width,depth:plan.site.depth},fits,basis,drivers:need.drivers},siteConflicts,errors,openChoices,ok:errors.length===0};
}
export type {Option};
