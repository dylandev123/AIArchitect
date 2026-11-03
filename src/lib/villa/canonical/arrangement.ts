/** Read-only spatial reasoning over an architectural-plan-1: where placement chains put every space, which volumes
 * collide and why, which single placement edits would clear a collision, and what the plan's wings look like as a
 * composition. Nothing here edits a plan. Options are measured offers for the planner to choose from; software never
 * applies one, because which wing yields (and whether the composition survives the move) is architectural judgement.
 * Pure functions over the authored plan; `locate` is the same function the compiler uses. */
import type {ArchitecturalPlan} from './plan';
import {resolveLayout,resolveSiteRects,placementPath,placementOfMass,isPlacedWing,type Rect,type Placement} from './layout';
import {isMassAnchor,massMembers,boundsOf} from './massAnchor';
type Space=ArchitecturalPlan['spaces'][number];
type Side=Space['placement']['side'];
const f2=(n:number)=>Number(n.toFixed(2));
const EPS=1e-6;
export const overlapOf=(a:Rect,b:Rect):Rect|null=>{const x=Math.max(a.x,b.x),z=Math.max(a.z,b.z),w=Math.min(a.x+a.width,b.x+b.width)-x,d=Math.min(a.z+a.depth,b.z+b.depth)-z;return w>EPS&&d>EPS?{x,z,width:w,depth:d}:null;};

/** Level floor datums, tolerant of missing or cyclic references (those levels are simply absent). */
export function levelTops(plan:ArchitecturalPlan):Map<string,number>{
 const tops=new Map<string,number>(),go=(id:string,seen=new Set<string>()):number|undefined=>{
  if(tops.has(id))return tops.get(id);
  const l=plan.levels.find(l=>l.id===id);if(!l||seen.has(id))return undefined;
  seen.add(id);const base=l.above===null?plan.site.elevation:go(l.above,seen);if(base===undefined)return undefined;
  tops.set(id,base+l.rise);return base+l.rise;
 };
 plan.levels.forEach(l=>go(l.id));return tops;
}
/** Envelope height used for collision purposes: authored, else the rise of the level above, else 3 m (the diagnosis's historical rule). */
export const envelopeHeight=(plan:ArchitecturalPlan,s:Space)=>s.height!==undefined?s.height:(plan.levels.find(l=>l.above===s.level)?.rise??3);

/** Every space rectangle the placements imply (rooms and placed wings), from the one resolver in layout.ts. A placement that cannot be resolved is reported, never guessed. */
export function resolveRects(plan:ArchitecturalPlan){const {rects,problems,frames}=resolveLayout(plan);return {rects,problems,frames};}

export type Collision={a:string;b:string;overlap:Rect;vertical:number};
/** Same-level footprints (and any overlapping vertical extents) that intersect. The single definition used by the diagnosis. */
export function volumeCollisions(plan:ArchitecturalPlan,rects:Map<string,Rect>,tops:Map<string,number>=levelTops(plan)):Collision[]{
 const live=plan.spaces.filter(s=>rects.has(s.id)),out:Collision[]=[];
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
  const a=live[i],b=live[j],common=overlapOf(rects.get(a.id)!,rects.get(b.id)!);if(!common)continue;
  const ta=tops.get(a.level),tb=tops.get(b.level);if(ta===undefined||tb===undefined)continue;
  const pen=Math.min(ta+envelopeHeight(plan,a),tb+envelopeHeight(plan,b))-Math.max(ta,tb);if(pen<=1e-7)continue;
  out.push({a:a.id,b:b.id,overlap:common,vertical:pen});
 }
 return out;
}

/** Placement ancestry, self first (rooms and, for placed wings, the wing nodes between them and their anchor). A wing anchor ends the chain. */
export const chainOf=placementPath;
/** Spaces whose position moves when `id` (a space or a placed wing) moves: its placement dependants, members of wings anchored on it, and the members of a wing it belongs to. */
export function displacedBy(plan:ArchitecturalPlan,id:string):string[]{
 const seen=new Set<string>(),visit=(x:string)=>{
  for(const s of plan.spaces){
   if(seen.has(s.id))continue;
   const a=s.placement.relativeTo;
   const inWing=isPlacedWing(plan,s.mass)&&(x===s.mass);               // a room of a wing that moves rigidly with it
   const viaAnchor=a!==null&&(a===x||(isMassAnchor(plan,a)&&massMembers(plan,a).some(m=>m.id===x)));
   const viaWing=a===null&&isPlacedWing(plan,s.mass)&&placementOfMass(plan,s.mass)?.relativeTo===x;
   if(inWing||viaAnchor||viaWing){seen.add(s.id);visit(s.id);}
  }
  for(const m of plan.masses){const to=m.placement?.relativeTo;if(to&&(to===x||massMembers(plan,to).some(q=>q.id===x))&&!massMembers(plan,m.id).every(q=>seen.has(q.id)))massMembers(plan,m.id).forEach(q=>{if(!seen.has(q.id)){seen.add(q.id);visit(q.id);}});}
 };
 visit(id);seen.delete(id);return [...seen];
}

export type Cause='adjacent-overhang'|'same-side-siblings'|'branch-crossing';
/** A single placement edit. `space` names the edited node: a space, or (entity 'wing') a placed wing. */
export type Option={space:string;entity:'space'|'wing';field:'alignment'|'gap'|'relativeTo';from:string|number;to:string|number;displaces:number;clearsThis:true;newCollisions:string[];note:string};
export type CollisionDecision={
 pair:[string,string];overlap:Rect;cause:Cause;host:string|null;diverge:string|null;chains:[string[],string[]];
 /** The two nodes (rooms or placed wings) whose placements meet; the unresolved choice is which of them yields. */
 heads:[string|null,string|null];
 /** Plain statement of the measured geometric cause. */
 explanation:string;
 /** Single placement edits that, applied alone, remove this overlap (checked by re-resolving the whole plan). Offers, never applied. */
 options:Option[];
 /** What software cannot decide. */
 judgement:string;
};
const sideAxis=(s:Side)=>s==='east'||s==='west'?'x':s==='north'||s==='south'?'z':'none';
const overhang=(r:Rect,host:Rect,side:Side)=>{
 // Extent past the host along the axis perpendicular to the placement side: [low end, high end].
 return sideAxis(side)==='x'?[Math.max(0,host.z-r.z),Math.max(0,r.z+r.depth-host.z-host.depth)]:[Math.max(0,host.x-r.x),Math.max(0,r.x+r.width-host.x-host.width)];
};
/** The placement object of a space, placed wing, pool or landscape item inside a (cloned) plan. */
export function placementRef(plan:ArchitecturalPlan,node:string):Placement|undefined{
 return plan.spaces.find(s=>s.id===node)?.placement??plan.masses.find(m=>m.id===node)?.placement??[...plan.pools,...plan.landscape].find(i=>i.id===node)?.placement;
}
/** One edit to the authored plan, as an offer. Placement fields, a declared attachment, a dimension, the declared site, or an opening's host side. */
export type PlanEdit={node:string;field:'alignment'|'gap'|'relativeTo'|'attached'|'width'|'depth'|'site-width'|'site-depth'|'portal-side';from:string|number|boolean;to:string|number|boolean};
/** A clone of the plan with the edits applied. The original is never touched; applying an edit to the real plan is the author's decision. */
export function withEdits(plan:ArchitecturalPlan,edits:PlanEdit[]){
 const copy=structuredClone(plan);
 for(const e of edits){
  if(e.field==='site-width')copy.site.width=e.to as number;
  else if(e.field==='site-depth')copy.site.depth=e.to as number;
  else if(e.field==='portal-side'){const p=copy.portals.find(x=>x.id===e.node);if(p)p.host.side=e.to as typeof p.host.side;}
  else if(e.field==='attached'){const s=copy.spaces.find(x=>x.id===e.node);if(s)s.attached=e.to as boolean;}
  else if(e.field==='width'||e.field==='depth'){const t=copy.spaces.find(x=>x.id===e.node)??[...copy.pools,...copy.landscape].find(x=>x.id===e.node);if(t)(t as Record<string,unknown>)[e.field]=e.to;}
  else{const ref=placementRef(copy,e.node);if(ref)(ref as unknown as Record<string,unknown>)[e.field]=e.to;}
 }
 return copy;
}
export function withEdit(plan:ArchitecturalPlan,node:string,field:Option['field'],value:string|number){
 return withEdits(plan,[{node,field,from:'',to:value}]);
}
const key=(c:{a:string;b:string})=>`${c.a}/${c.b}`;
/** The rectangle a node (space or wing) occupies. */
export const nodeRect=(plan:ArchitecturalPlan,rects:Map<string,Rect>,frames:ReturnType<typeof resolveLayout>['frames'],node:string):Rect|undefined=>
 rects.get(node)??frames.get(node)?.envelope??(plan.masses.some(m=>m.id===node)&&massMembers(plan,node).every(m=>rects.has(m.id))&&massMembers(plan,node).length?boundsOf(massMembers(plan,node).map(m=>rects.get(m.id)!)):undefined);
/** Spaces whose resolved rectangle differs between two layouts, excluding `skip`. */
export function movedBetween(before:Map<string,Rect>,after:Map<string,Rect>,skip:Set<string>=new Set()):string[]{
 return [...after.keys()].filter(id=>!skip.has(id)&&before.has(id)&&(Math.abs(before.get(id)!.x-after.get(id)!.x)>1e-6||Math.abs(before.get(id)!.z-after.get(id)!.z)>1e-6));
}
/** Classify every collision by how the two placement chains meet, and offer the single edits that would clear it.
 * A chain runs through placed wings, so two rooms of different wings are explained at the level at which the wings
 * (not the rooms) were related. */
export function explainCollisions(plan:ArchitecturalPlan,maxOptions=6):CollisionDecision[]{
 const {rects,frames}=resolveRects(plan),tops=levelTops(plan),collisions=volumeCollisions(plan,rects,tops),before=new Set(collisions.map(key));
 const spaceOf=(id:string)=>plan.spaces.find(s=>s.id===id)!;
 const isWing=(n:string|null)=>n!==null&&plan.masses.some(m=>m.id===n)&&!plan.spaces.some(s=>s.id===n);
 const label=(n:string)=>isWing(n)?`wing ${n}`:n;
 return collisions.map(c=>{
  const A=spaceOf(c.a),B=spaceOf(c.b),pa=placementPath(plan,c.a),pb=placementPath(plan,c.b),common=pa.find(x=>pb.includes(x))??null;
  const below=(path:string[])=>common===null?path[path.length-1]:path.indexOf(common)>0?path[path.indexOf(common)-1]:null;
  const headA=below(pa),headB=below(pb);
  // Rooms of different placed wings are compared through the wings; otherwise the historical room-level rule applies unchanged.
  const wingLevel=isWing(headA)||isWing(headB);
  const placeA=wingLevel?(headA?placementRef(plan,headA):undefined):A.placement,placeB=wingLevel?(headB?placementRef(plan,headB):undefined):B.placement;
  const nameA=wingLevel?headA??c.a:c.a,nameB=wingLevel?headB??c.b:c.b;
  const sameHost=!!placeA&&!!placeB&&placeA.relativeTo!==null&&placeA.relativeTo===placeB.relativeTo&&(!wingLevel||common===placeA.relativeTo);
  const cause:Cause=sameHost?(placeA!.side===placeB!.side?'same-side-siblings':'adjacent-overhang'):'branch-crossing';
  const host=sameHost?placeA!.relativeTo:null;
  let explanation:string;
  const ra=rects.get(c.a)!,rb=rects.get(c.b)!,ov=`${f2(c.overlap.width)}×${f2(c.overlap.depth)} m`;
  const dims=(n:string,r:Rect|undefined)=>r?`${f2(r.width)}×${f2(r.depth)}`:'?';
  if(cause==='adjacent-overhang'){
   const H=nodeRect(plan,rects,frames,host!)!,rA=wingLevel?nodeRect(plan,rects,frames,nameA)!:ra,rB=wingLevel?nodeRect(plan,rects,frames,nameB)!:rb;
   const oa=overhang(rA,H,placeA!.side),ob=overhang(rB,H,placeB!.side);
   explanation=`${label(nameA)} (${placeA!.side} of ${label(host!)}, ${dims(nameA,rA)}) and ${label(nameB)} (${placeB!.side} of ${label(host!)}, ${dims(nameB,rB)}) are both anchored to ${label(host!)} on adjacent sides. Each is larger than ${label(host!)} along the other's axis (${label(nameA)} projects ${f2(oa[0])}/${f2(oa[1])} m past ${label(host!)}'s low/high ends, ${label(nameB)} ${f2(ob[0])}/${f2(ob[1])} m), so both claim the corner quadrant: ${ov} overlap (${c.a} × ${c.b}). ${wingLevel?'Wings were related as whole envelopes, but two envelopes on adjacent sides of one host still contend for its corner.':'Placement against one host cannot see the sibling.'}`;
  }else if(cause==='same-side-siblings'){
   explanation=`${label(nameA)} and ${label(nameB)} are both placed ${placeA!.side} of ${label(host!)} and their aligned spans cross: ${ov} overlap (${c.a} × ${c.b}).`;
  }else{
   explanation=`${c.a} and ${c.b} are reached by independent placement chains (${pa.join(' ← ')} | ${pb.join(' ← ')}${common?`, diverging at ${common}`:', no shared ancestor'}); neither chain accounts for the other's extent: ${ov} overlap.`;
  }
  const options:Option[]=[];
  const tried=new Set<string>();
  const consider=(node:string,field:Option['field'],value:string|number,note:string)=>{
   const ref=placementRef(plan,node);if(!ref)return;
   const from=(ref as unknown as Record<string,string|number>)[field];
   const id=`${node}.${field}=${value}`;if(tried.has(id)||from===value)return;tried.add(id);
   const edited=withEdit(plan,node,field,value),r=resolveRects(edited);
   if(r.problems.length)return;
   const after=volumeCollisions(edited,r.rects,tops);
   if(after.some(x=>key(x)===key(c)))return;
   const entity:Option['entity']=isWing(node)?'wing':'space';
   const moved=entity==='wing'?movedBetween(rects,r.rects,new Set(massMembers(plan,node).map(m=>m.id))).length:displacedBy(plan,node).length;
   options.push({space:node,entity,field,from,to:value,displaces:moved,clearsThis:true,newCollisions:after.map(key).filter(k=>!before.has(k)),note});
  };
  for(const head of [headA,headB]){
   if(!head)continue;
   const p=placementRef(plan,head);
   if(p&&p.side!=='origin'&&p.side!=='same'&&p.relativeTo!==null){
    for(const al of ['start','centre','end'] as const)consider(head,'alignment',al,`re-align ${label(head)} along ${label(host??p.relativeTo)} (changes which end it overhangs)`);
    for(const extra of new Set([c.overlap.width,c.overlap.depth].map(v=>Math.ceil(v*100)/100)))consider(head,'gap',f2(p.gap+extra),`separate ${label(head)} from its anchor by ${f2(extra)} m (a design separation, not a connected ${isWing(head)?'wing':'room'})`);
    // Re-anchor to a whole wing: only meaningful when the head sits in a different wing from the room it collides with.
    const other=head===headA?B:A,headMass=isWing(head)?head:spaceOf(head).mass;
    if(other.mass!==headMass&&p.relativeTo!==other.mass)consider(head,'relativeTo',other.mass,`place ${label(head)} against the whole wing ${other.mass} instead of one of its rooms`);
   }
  }
  options.sort((x,y)=>x.newCollisions.length-y.newCollisions.length||x.displaces-y.displaces||String(x.to).localeCompare(String(y.to)));
  return {pair:[c.a,c.b] as [string,string],overlap:c.overlap,cause,host,diverge:common,chains:[pa,pb] as [string[],string[]],heads:[headA,headB] as [string|null,string|null],explanation,options:options.slice(0,maxOptions),
   judgement:`Which of ${label(headA??c.a)} and ${label(headB??c.b)} yields, and whether moving it (together with ${options.length?'its dependants':'what hangs from it'}) keeps the intended composition, is an architectural decision. Software has changed nothing.`};
 });
}
/** One line per decision, for placement into an existing finding message. */
export const describeDecision=(d:CollisionDecision)=>`${d.explanation} ${d.options.length?`Single edits that clear it: ${d.options.slice(0,4).map(o=>`${o.entity==='wing'?'wing ':''}${o.space}.${o.field} ${o.from}→${o.to}${o.newCollisions.length?` (creates ${o.newCollisions.length} new)`:''}`).join('; ')}.`:'No single placement edit clears it: the arrangement needs a wider decision.'}`;

// ───── composition: what the parti looks like, measured. Not a beauty score. ─────
export type WingEnvelope={id:string;role:string;rooms:number;levels:string[];bounds:Rect;roomAreaM2:number;fill:number};
export type Composition={
 wings:WingEnvelope[];
 /** The space (or wing) most other spaces are placed against, the compositional spine, and how many are. */
 spine:{id:string;dependants:number}|null;
 /** Hosts that carry rooms on opposite sides (a bilateral arrangement). */
 bilateral:{host:string;sides:Record<string,string[]>}[];
 /** Fraction of indoor floor area that is on, or has a same-size mirror partner across, the plan's or spine's centre line (best axis). */
 mirrorShare:number;mirrorAxis:'x'|'z'|null;
 /** Largest group of indoor rooms with the same footprint (±0.25 m). */
 repeated:{count:number;of:number;width:number;depth:number}|null;
 distinctFootprints:number;indoorRooms:number;
 maxChainDepth:number;levels:number;roofForms:Record<string,number>;
 /** Share of the building's bounding rectangle covered by indoor rooms on any level (1 = a solid block). */
 footprintFill:number;
};
export function compositionOf(plan:ArchitecturalPlan):Composition{
 const {rects}=resolveRects(plan),indoor=plan.spaces.filter(s=>!s.outdoor&&rects.has(s.id));
 const wings=plan.masses.flatMap(m=>{const members=massMembers(plan,m.id).filter(s=>rects.has(s.id));if(!members.length)return [];
  const bounds=boundsOf(members.map(s=>rects.get(s.id)!)),footprint=members.filter(s=>!s.outdoor).reduce((n,s)=>n+s.width*s.depth,0);
  return [{id:m.id,role:m.role,rooms:members.length,levels:[...new Set(members.map(s=>s.level))],bounds,roomAreaM2:f2(footprint),fill:f2(Math.min(1,footprint/(bounds.width*bounds.depth)))}];});
 const counts=new Map<string,number>();
 for(const s of plan.spaces)if(s.placement.relativeTo!==null&&s.placement.side!=='same')counts.set(s.placement.relativeTo,(counts.get(s.placement.relativeTo)??0)+1);
 const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
 const bilateral=[...counts.keys()].flatMap(host=>{
  const sides:Record<string,string[]>={};
  for(const s of plan.spaces)if(s.placement.relativeTo===host&&s.placement.side!=='same')(sides[s.placement.side]??=[]).push(s.id);
  const opp=('east' in sides&&'west' in sides)||('north' in sides&&'south' in sides);return opp?[{host,sides}]:[];
 });
 const all=indoor.map(s=>rects.get(s.id)!),bb=all.length?boundsOf(all):{x:0,z:0,width:1,depth:1};
 // Mirror symmetry about the plan's centre line or the spine's own centre line, whichever matches better, per axis.
 const spineRect=top&&rects.get(top[0])?rects.get(top[0])!:undefined;
 const mirror=(axis:'x'|'z')=>{
  const mid=(r:Rect)=>axis==='x'?r.x+r.width/2:r.z+r.depth/2,across=(r:Rect)=>axis==='x'?r.z+r.depth/2:r.x+r.width/2;
  const centres=[axis==='x'?bb.x+bb.width/2:bb.z+bb.depth/2,...(spineRect?[mid(spineRect)]:[])];
  return Math.max(...centres.map(centre=>{
   let matched=0,total=0;
   for(const s of indoor){
    const r=rects.get(s.id)!,off=mid(r)-centre,area=r.width*r.depth;total+=area;
    if(Math.abs(off)<.5){matched+=area;continue;}
    if(indoor.some(o=>{if(o.id===s.id||o.level!==s.level)return false;const q=rects.get(o.id)!;
     return Math.abs((mid(q)-centre)+off)<.75&&Math.abs(across(q)-across(r))<.75&&Math.abs(q.width-r.width)<.5&&Math.abs(q.depth-r.depth)<.5;}))matched+=area;
   }
   return total?matched/total:0;
  }));
 };
 const mx=mirror('x'),mz=mirror('z'),mirrorAxis=Math.max(mx,mz)<.05?null:mx>=mz?'x' as const:'z' as const;
 const groups=new Map<string,string[]>();
 for(const s of indoor){const r=rects.get(s.id)!,k=`${Math.round(r.width*4)/4}x${Math.round(r.depth*4)/4}`;groups.set(k,[...(groups.get(k)??[]),s.id]);}
 const big=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length)[0];
 const roofForms:Record<string,number>={};for(const r of plan.roofs)roofForms[r.form]=(roofForms[r.form]??0)+1;
 const covered=indoor.length?(()=>{ // area of the union of indoor footprints over any level, by sweep on a 0.5 m grid
  const step=.5,cells=new Set<string>();for(const r of all)for(let x=Math.floor(r.x/step);x<Math.ceil((r.x+r.width)/step);x++)for(let z=Math.floor(r.z/step);z<Math.ceil((r.z+r.depth)/step);z++)cells.add(`${x},${z}`);
  return cells.size*step*step;})():0;
 return {wings,spine:top?{id:top[0],dependants:top[1]}:null,bilateral,mirrorShare:f2(mx>mz?mx:mz),mirrorAxis,
  repeated:big&&big[1].length>1?{count:big[1].length,of:indoor.length,width:Number(big[0].split('x')[0]),depth:Number(big[0].split('x')[1])}:null,
  distinctFootprints:groups.size,indoorRooms:indoor.length,
  maxChainDepth:Math.max(0,...plan.spaces.map(s=>chainOf(plan,s.id).length-1)),levels:plan.levels.length,roofForms,
  footprintFill:f2(covered/(bb.width*bb.depth))};
}

// ───── concept diagram: wing envelopes, arrival, site; no rooms ─────
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
const PALETTE=['#e8dcc0','#dfe9d8','#d6dfee','#eed9d9','#e5f0f0','#efe3f1','#f3ead2','#dde6e0','#e9dfd3','#d9e4ef'];
/** Preliminary composition drawing: each wing as its bounding envelope (no room subdivision), outdoor allocations,
 * arrival and levels. Derived from the same resolved placements the compiler uses; it asserts nothing about beauty. */
export function renderConceptSvg(plan:ArchitecturalPlan,options:{title?:string;caption?:string;showRooms?:boolean}={}):string{
 const {rects}=resolveRects(plan),comp=compositionOf(plan),S=11,pad=30,head=48,foot=44;
 const items=[...rects.entries()].map(([id,r])=>({id,...r}));
 const siteRects=resolveSiteRects(plan,rects).rects;
 const extent=boundsOf([...items,...siteRects.values(),...comp.wings.map(w=>w.bounds)]);
 const x0=extent.x-3,z0=extent.z-3,w=extent.width+6,d=extent.depth+6,W=Math.round(w*S+2*pad),H=Math.round(d*S+head+foot);
 const X=(x:number)=>f2(pad+(x-x0)*S),Y=(z:number)=>f2(head+(z0+d-z)*S);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica,Arial,sans-serif"><rect width="${W}" height="${H}" fill="#fcfcfa"/>`;
 svg+=`<text x="${pad}" y="20" font-size="14" font-weight="bold">${esc(options.title??plan.id)}</text><text x="${pad}" y="36" font-size="10" fill="#555">${esc(plan.thesis.slice(0,150))}</text>`;
 const box=(r:Rect,attrs:string)=>`<rect x="${X(r.x)}" y="${Y(r.z+r.depth)}" width="${f2(r.width*S)}" height="${f2(r.depth*S)}" ${attrs}/>`;
 for(const [id,r] of siteRects){
  const pool=plan.pools.some(p=>p.id===id);
  svg+=box(r,`fill="${pool?'#bfe0ee':'#e3efd6'}" stroke="#7a9" stroke-dasharray="3 2"`)+`<text x="${X(r.x)+3}" y="${Number(Y(r.z+r.depth))+11}" font-size="9" fill="#365">${esc(id)}</text>`;
 }
 comp.wings.forEach((wg,i)=>{
  const outdoorOnly=massMembers(plan,wg.id).every(s=>s.outdoor);
  svg+=box(wg.bounds,`fill="${outdoorOnly?'#f2f6ee':PALETTE[i%PALETTE.length]}" fill-opacity="${options.showRooms?.45:.9}" stroke="#333" stroke-width="1.6" ${outdoorOnly?'stroke-dasharray="5 3"':''}`);
  svg+=`<text x="${X(wg.bounds.x)+4}" y="${Y(wg.bounds.z+wg.bounds.depth)+13}" font-size="10.5" font-weight="bold">${esc(wg.id)}</text><text x="${X(wg.bounds.x)+4}" y="${Y(wg.bounds.z+wg.bounds.depth)+25}" font-size="9" fill="#444">${f2(wg.bounds.width)}×${f2(wg.bounds.depth)} m · ${wg.levels.length} level${wg.levels.length>1?'s':''}: ${esc(wg.levels.join('/'))}</text>`;
 });
 if(options.showRooms)for(const s of plan.spaces)if(rects.has(s.id))svg+=box(rects.get(s.id)!,'fill="none" stroke="#777" stroke-width=".6"');
 const arrival=rects.get(plan.arrival);
 if(arrival)svg+=`<text x="${X(arrival.x+arrival.width/2)}" y="${f2(Number(Y(arrival.z+arrival.depth/2))+5)}" font-size="16" text-anchor="middle" fill="#a50">★</text>`;
 svg+=`<line x1="${pad}" x2="${pad+10*S}" y1="${H-foot+14}" y2="${H-foot+14}" stroke="#222" stroke-width="2"/><text x="${pad}" y="${H-foot+10}" font-size="9">10 m</text><text x="${W-pad-40}" y="${head+14}" font-size="10">N (+Z) ↑</text>`;
 svg+=`<text x="${pad}" y="${H-12}" font-size="9.5" font-weight="bold" fill="#7a5a00">${esc(options.caption??'CONCEPT DIAGRAM: wing envelopes from authored placements. A measurement of composition, not a quality rating. ★ arrival.')}</text></svg>`;
 return svg;
}

/** Drift between a concept (wing envelopes) and an elaborated plan: how far each wing's measured envelope departs from the concept's. */
export type WingDrift={wing:string;conceptSize:[number,number];builtSize:[number,number];dSize:[number,number];dCentre:[number,number];within:boolean};
export function conceptDrift(concept:ArchitecturalPlan,built:ArchitecturalPlan,tolerance=0):{wings:WingDrift[];missing:string[];extra:string[]}{
 const a=compositionOf(concept).wings,b=compositionOf(built).wings;
 const ca=new Map(a.map(w=>[w.id,w])),cb=new Map(b.map(w=>[w.id,w]));
 // Compare in each plan's own frame relative to the first shared wing, so the roots need not coincide.
 const shared=a.map(w=>w.id).filter(id=>cb.has(id));
 const ref=shared[0];
 const rel=(w:WingEnvelope,r:WingEnvelope)=>[w.bounds.x+w.bounds.width/2-(r.bounds.x+r.bounds.width/2),w.bounds.z+w.bounds.depth/2-(r.bounds.z+r.bounds.depth/2)] as [number,number];
 const wings=shared.map(id=>{
  const w0=ca.get(id)!,w1=cb.get(id)!,c0=ref?rel(w0,ca.get(ref)!):[0,0],c1=ref?rel(w1,cb.get(ref)!):[0,0];
  const dSize:[number,number]=[f2(w1.bounds.width-w0.bounds.width),f2(w1.bounds.depth-w0.bounds.depth)],dCentre:[number,number]=[f2(c1[0]-c0[0]),f2(c1[1]-c0[1])];
  return {wing:id,conceptSize:[f2(w0.bounds.width),f2(w0.bounds.depth)] as [number,number],builtSize:[f2(w1.bounds.width),f2(w1.bounds.depth)] as [number,number],dSize,dCentre,
   within:Math.max(...dSize.map(Math.abs),...dCentre.map(Math.abs))<=tolerance+EPS};
 });
 return {wings,missing:a.filter(w=>!cb.has(w.id)).map(w=>w.id),extra:b.filter(w=>!ca.has(w.id)).map(w=>w.id)};
}
