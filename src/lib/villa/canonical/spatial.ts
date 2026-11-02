/** Whole-building spatial coordination for an architectural-plan-1.
 *
 * The author decides what the building IS: wings, how they relate, which rooms belong together, what must stay apart,
 * what must meet, what a court is enclosed by. This module computes the physical consequences of those decisions over
 * the WHOLE arrangement at once and reports what they imply:
 *   - wing envelopes and where each wing's rigid frame landed (layout.ts is the single resolver);
 *   - every pair of occupied volumes across all levels, attributed to the placement decision where the two wings
 *     (or rooms) met, with verified single-edit options (explainCollisions);
 *   - declared constraints (separate / adjoin / enclose) measured on the resolved arrangement, with verified options;
 *   - wing-level circulation: which wings touch, how far, and whether a door or stair connects them;
 *   - what is stacked on what (support), the site the arrangement needs, and contradictions between declarations.
 *
 * It never edits a plan and never chooses between valid arrangements. Where several single edits would clear a
 * conflict, that is an unresolved architectural choice and is reported as one; where none does, the decisions
 * that jointly produce the conflict are named. Pure and tolerant: it does not throw on an invalid plan. */
import type {ArchitecturalPlan,ArchitecturalConstraint} from './plan';
import {resolveLayout,resolveSiteRects,placementPath,type Rect,type WingFrame} from './layout';
import {massMembers,boundsOf} from './massAnchor';
import {volumeCollisions,explainCollisions,describeDecision,levelTops,withEdit,placementRef,movedBetween,type CollisionDecision,type Option} from './arrangement';
import {sharedRuns,SIDES} from './coordination';
type Space=ArchitecturalPlan['spaces'][number];
const f2=(n:number)=>Number(n.toFixed(2));
const EPS=1e-6;

export type SpatialError={kind:'layout'|'collision'|'constraint'|'declaration'|'site';ids:string[];message:string};
export type ConstraintOption={node:string;entity:'space'|'wing';field:'alignment'|'gap';from:string|number;to:string|number;measuredAfter:number;displaces:number;newErrors:string[];note:string};
export type ConstraintResult={id:string;kind:ArchitecturalConstraint['kind'];a:string;b?:string;required:number;measured:number|null;ok:boolean;reason:string;problem?:string;
 /** Placement nodes (rooms and wings) whose relationship produced the measurement: the decisions to reconsider. */
 implicated:{node:string;placement:string}[];
 /** Single placement edits that would satisfy it without creating another error. Offers, never applied. */
 options:ConstraintOption[]};
export type WingSummary={id:string;role:string;placed:boolean;rooms:number;indoorRooms:number;levels:string[];envelope:Rect;indoorAreaM2:number;fill:number;relation:string|null;seed:string|null};
export type WingLink={wing:string;sharedM:number;connected:boolean};
export type Coordination={
 wings:WingSummary[];
 /** Room-level overlaps, each explained at the placement decision where the two chains meet. */
 collisions:CollisionDecision[];
 constraints:ConstraintResult[];
 circulation:{arrival:string;wings:{id:string;interiorRooms:number;reachable:number;adjoins:WingLink[]}[]};
 /** Upper-level interior rooms with the share of their footprint that stands on interior rooms of the level below. */
 vertical:{space:string;level:string;supportedFraction:number;unsupportedM2:number}[];
 site:{required:{width:number;depth:number};available:{width:number;depth:number};fits:boolean};
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
 const a=entityRects(w,c.a,c.kind==='separate');
 if(!a)return {value:null,problem:`${c.id}: ${c.a} is not a resolvable space, wing, pool or landscape item.`};
 if(c.kind==='enclose'){
  const s=w.plan.spaces.find(x=>x.id===c.a);
  if(!s)return {value:null,problem:`${c.id}: enclose needs a space (a court or terrace), not ${c.a}.`};
  return {value:enclosure(w,s,w.rects.get(s.id)!)};
 }
 if(!c.b)return {value:null,problem:`${c.id}: ${c.kind} needs a second entity (b).`};
 const b=entityRects(w,c.b,c.kind==='separate');
 if(!b)return {value:null,problem:`${c.id}: ${c.b} is not a resolvable space, wing, pool or landscape item.`};
 if(c.a===c.b)return {value:null,problem:`${c.id}: a and b are the same entity.`};
 if(c.kind==='separate')return {value:Math.min(...a.rects.flatMap(x=>b.rects.map(y=>rectGap(x.rect,y.rect))))};
 return {value:sharedLength(a.rects,b.rects)};
}
const satisfied=(c:ArchitecturalConstraint,v:number|null)=>v!==null&&(c.kind==='separate'?v>=c.amount-EPS:v>=c.amount-EPS);
const describePlacement=(plan:ArchitecturalPlan,node:string)=>{const p=placementRef(plan,node);return p?(p.relativeTo===null?`${node}: local origin`:`${node}: ${p.side} of ${p.relativeTo}, ${p.alignment}, gap ${p.gap}`):`${node}: (no placement)`;};

/** Site the arrangement needs (the site is centred on the room cells, then rotated by the orientation). */
function siteNeed(w:World){
 const rs=[...w.rects.values()];
 if(!rs.length)return {width:0,depth:0};
 const b=boundsOf(rs),cx=b.x+b.width/2,cz=b.z+b.depth/2,c=Math.cos(w.plan.orientation),s=Math.sin(w.plan.orientation);
 let hx=0,hz=0;
 const take=(r:Rect,margin=0)=>{
  const x=c*(r.x+r.width/2-cx)+s*(r.z+r.depth/2-cz),z=-s*(r.x+r.width/2-cx)+c*(r.z+r.depth/2-cz);
  const pw=Math.abs(c)*(r.width+margin)+Math.abs(s)*(r.depth+margin),pd=Math.abs(s)*(r.width+margin)+Math.abs(c)*(r.depth+margin);
  hx=Math.max(hx,Math.abs(x)+pw/2);hz=Math.max(hz,Math.abs(z)+pd/2);
 };
 rs.forEach(r=>take(r));
 for(const p of w.plan.pools){const r=w.siteRects.get(p.id);if(r)take(r,.4);}
 for(const l of w.plan.landscape){const r=w.siteRects.get(l.id);if(r)take(r);}
 return {width:f2(2*hx),depth:f2(2*hz)};
}

/** Everything that makes this arrangement invalid, as stable keys, for verifying that a candidate edit adds nothing new. */
function errorKeys(w:World,tops:Map<string,number>):Set<string>{
 const keys=new Set<string>();
 w.problems.forEach(p=>keys.add(`layout:${p.id}`));
 for(const c of volumeCollisions(w.plan,w.rects,tops))keys.add(`collision:${c.a}/${c.b}`);
 for(const c of w.plan.constraints??[]){const m=measure(w,c);if(m.problem||!satisfied(c,m.value))keys.add(`constraint:${c.id}`);}
 const need=siteNeed(w);if(need.width>w.plan.site.width+EPS||need.depth>w.plan.site.depth+EPS)keys.add('site:fit');
 return keys;
}

export function coordinatePlan(plan:ArchitecturalPlan):Coordination{
 const w=world(plan),tops=levelTops(plan),errors:SpatialError[]=[],openChoices:Coordination['openChoices']=[];
 for(const p of w.problems)errors.push({kind:'layout',ids:[p.id],message:p.message});

 // Wings: envelopes from the resolved rooms (a placed wing's is the envelope it was placed by).
 const wings:WingSummary[]=plan.masses.flatMap(m=>{
  const members=massMembers(plan,m.id).filter(s=>w.rects.has(s.id));if(!members.length)return [];
  const envelope=boundsOf(members.map(s=>w.rects.get(s.id)!)),indoor=members.filter(s=>!s.outdoor),area=indoor.reduce((n,s)=>n+s.width*s.depth,0);
  const p=m.placement;
  return [{id:m.id,role:m.role,placed:!!p,rooms:members.length,indoorRooms:indoor.length,levels:[...new Set(members.map(s=>s.level))],envelope,indoorAreaM2:f2(area),fill:f2(Math.min(1,area/(envelope.width*envelope.depth))),
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
   const attempt=(node:string,field:'alignment'|'gap',value:string|number,note:string)=>{
    const ref=placementRef(plan,node);if(!ref||ref.relativeTo===null||ref.side==='origin')return;
    const from=(ref as unknown as Record<string,string|number>)[field],tag=`${node}.${field}=${value}`;
    if(from===value||tried.has(tag))return;tried.add(tag);
    const edited=withEdit(plan,node,field,value),ew=world(edited),after=measure(ew,c);
    if(after.problem||!satisfied(c,after.value))return;
    const created=[...errorKeys(ew,tops)].filter(k=>!base.has(k));
    const wing=plan.masses.some(x=>x.id===node)&&!plan.spaces.some(s=>s.id===node);
    const own=new Set(wing?massMembers(plan,node).map(x=>x.id):[node]);
    result.options.push({node,entity:wing?'wing':'space',field,from,to:value,measuredAfter:f2(after.value!),displaces:movedBetween(w.rects,ew.rects,own).length,newErrors:created,note});
   };
   for(const {node} of implicated.slice(0,6)){
    const ref=placementRef(plan,node)!;if(ref.side==='origin'||ref.side==='same')continue;
    for(const al of ['start','centre','end'] as const)attempt(node,'alignment',al,`re-align ${node}`);
    if(c.kind==='separate')for(const extra of new Set([short,Math.ceil(short*2)/2]))attempt(node,'gap',f2(ref.gap+extra),`move ${node} ${f2(extra)} m further from its anchor (changes the gap, a design separation)`);
    else if(ref.gap>0)attempt(node,'gap',0,`close the ${f2(ref.gap)} m gap before ${node} so the two can share a wall`);
   }
   result.options.sort((x,y)=>x.newErrors.length-y.newErrors.length||x.displaces-y.displaces||String(x.to).localeCompare(String(y.to)));
   result.options=result.options.slice(0,6);
   if(result.options.length>1)openChoices.push({about:`${c.id} (${c.kind} ${c.a}${c.b?` / ${c.b}`:''}, required ${c.amount}, measured ${f2(m.value??0)})`,options:result.options.map(o=>`${o.entity==='wing'?'wing ':''}${o.node}.${o.field} ${o.from}→${o.to}`)});
  }
  constraints.push(result);
  if(m.problem)errors.push({kind:'declaration',ids:[c.id],message:m.problem});
  else if(!ok)errors.push({kind:'constraint',ids:[c.id,c.a,...(c.b?[c.b]:[])],message:`${c.id} (${c.kind}: ${c.reason}) is not met: ${c.kind==='separate'?`${c.a} and ${c.b} are ${f2(m.value??0)} m apart, ${f2(c.amount)} m required`:c.kind==='adjoin'?`${c.a} and ${c.b} share ${f2(m.value??0)} m of wall, ${f2(c.amount)} m required`:`${c.a} is bounded by interior rooms along ${f2((m.value??0)*100)}% of its perimeter, ${f2(c.amount*100)}% required`}. ${result.options.length?`Single edits that would meet it: ${result.options.slice(0,4).map(o=>`${o.entity==='wing'?'wing ':''}${o.node}.${o.field} ${o.from}→${o.to}${o.newErrors.length?` (creates ${o.newErrors.length} new)`:''}`).join('; ')}.`:`No single placement edit meets it. The relationships that produce this measurement are: ${implicated.map(i=>i.placement).join(' | ')||'(none declared)'}; one of them, or the constraint, must be reconsidered.`} Software has changed nothing.`});
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

 // Site: what the arrangement needs. Determined by the arrangement, so stated rather than guessed.
 const need=siteNeed(w),fits=need.width<=plan.site.width+EPS&&need.depth<=plan.site.depth+EPS;
 if(!fits&&!w.problems.length)errors.push({kind:'site',ids:[],message:`The arrangement needs a site of at least ${need.width}×${need.depth} m (centred on the room cells, orientation applied); the plan declares ${plan.site.width}×${plan.site.depth} m. Enlarging the site is a determined consequence; moving the allocations inward is a design choice.`});

 return {wings,collisions,constraints,circulation,vertical,site:{required:need,available:{width:plan.site.width,depth:plan.site.depth},fits},errors,openChoices,ok:errors.length===0};
}
export type {Option};
