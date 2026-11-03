/** Dependency view of a diagnosed plan: which findings share ONE underlying architectural relationship, and
 * what the software can derive about it. Read-only: it groups evidence that diagnosePlan already produced,
 * it adds no rule, relaxes no check and proposes no layout.
 *
 * A finding is attached to the relationship that causes it:
 *  - a wall (room + side): the openings, piers and screens that sit on it, and the room beyond it;
 *  - a pitched roof: the junctions the builder does not support (a space stacked over part of it, an overhang reaching a neighbour, overlapping rooms);
 *  - a flat roof's eaves meeting neighbours;
 *  - a circulation link between a reachable room and the rooms that should hang from it;
 *  - the existing chain / site groups for volumes and allocations.
 * Findings that touch the same relationship are one decision, however many components report them. */
import type {Finding} from '../diagnose';
import type {ArchitecturalPlan,Rect} from '../plan';
import {SIDES,edgeExposure,placePortals,type Side} from '../coordination';
import {composedView} from '../composition';
const f2=(n:number)=>Number(n.toFixed(2));
export type EdgeExposure={side:Side;lengthM:number;sharedWith:{room:string;from:number;to:number}[];exposed:{from:number;to:number}[]};
export type RoomExposure={room:string;level:string;outdoor:boolean;edges:EdgeExposure[]};
/** For every room: along each directed edge, which parts are shared with a same-level space and which are free to the outside. */
export function roomExposure(plan:ArchitecturalPlan,rects:Record<string,Rect>):RoomExposure[]{
 return plan.spaces.filter(s=>rects[s.id]).map(s=>{
  const others=plan.spaces.filter(o=>o.id!==s.id&&o.level===s.level&&rects[o.id]).map(o=>({id:o.id,rect:rects[o.id]}));
  return {room:s.id,level:s.level,outdoor:s.outdoor,edges:SIDES.map(side=>{const x=edgeExposure(rects[s.id],side,others);return {side,lengthM:f2(x.length),sharedWith:x.shared.map(r=>({room:r.id,from:f2(r.lo),to:f2(r.hi)})),exposed:x.free.map(r=>({from:f2(r.lo),to:f2(r.hi)}))};})};
 });
}
export type DecisionKind='wall'|'pitched-roof'|'eaves'|'roof-cover'|'circulation'|'arrangement'|'site'|'other';
export type Decision={
 id:string;kind:DecisionKind;title:string;
 /** What relationship all these findings are about, in terms of the model's own entities. */
 relationship:string;
 /** Components that report an error because of it, by kind. */
 affects:{portals:string[];screens:string[];roofs:string[];rooms:string[]};
 findings:{stage:string;id:string}[];
 /** Entities named by the relationship that are absent from the baseline plan (when a baseline is given). */
 introduced:string[];
 /** What software derives or constrains once the model has declared its intent, and what it cannot choose. */
 softwareRole:string;
 modelDecides:string;
};
type Keyed={f:Finding;keys:string[]};
export function decisionsOf(plan:ArchitecturalPlan,findings:Finding[],rects:Record<string,Rect>,baseline?:ArchitecturalPlan):Decision[]{
 const errors=findings.filter(f=>f.severity==='error'),spaceOf=(id:string)=>plan.spaces.find(s=>s.id===id);
 // Roofs as the compiler derives them: a room under a declared roof span is roofed by the span.
 const view=composedView(plan,new Map(Object.entries(rects)));
 const placed=placePortals(plan,rects),roofOf=(id:string)=>view.roofs.find(r=>r.space===id)??(()=>{const sp=view.spans.find(q=>q.members.includes(id));return sp?{space:id,form:sp.form,rise:sp.rise,overhang:sp.overhang}:undefined;})();
 const pitched=(id:string)=>{const r=roofOf(id);return !!r&&r.form!=='flat';};
 const sideOfPortal=(id:string)=>{const p=plan.portals.find(q=>q.id===id);if(!p)return undefined;const at=placed.get(id);return `${p.host.space}:${at&&at.problem===undefined?at.side:p.host.side}`;};
 // Reachable rooms and, for each unreachable one, the reachable room it should hang from (largest shared wall).
 const keyed:Keyed[]=errors.map(f=>{
  const keys:string[]=[],ids=f.id.split('/');
  if(f.stage==='openings')for(const i of ids){const k=sideOfPortal(i);if(k)keys.push(`wall:${k}`);else keys.push(`other:${f.stage}:${f.id}`);}
  else if(f.stage==='screens'){const sc=plan.screens?.find(s=>s.id===f.id);keys.push(sc?`wall:${sc.space}:${sc.side}`:`other:screens:${f.id}`);}
  else if(f.stage==='roofs'){
   if(ids.length===2){
    const a=ids[0],b=ids[1],projects=/projects .* into the taller volume/.test(f.message);
    // Roofs of two rooms that themselves overlap collide because the rooms do: that is the arrangement's decision, not a roof's.
    const overlap=errors.find(e=>e.stage==='volumes'&&(e.id===`${a}/${b}`||e.id===`${b}/${a}`));
    if(overlap){keys.push(`volumes:${overlap.id}`);return {f,keys};}
    // A pitched roof meeting a neighbour is that roof's relationship, whichever form the neighbour has.
    const owners=projects?[a]:[a,b],lead=owners.filter(pitched);
    for(const o of lead.length?lead:owners)keys.push(pitched(o)?`pitched:${o}`:(roofOf(o)?.overhang??0)>0?`eaves:${o}`:`roofcover:${o}`);
   }else keys.push(pitched(f.id)?`pitched:${f.id}`:`roofcover:${f.id}`);
  }
  else if(f.stage==='access')keys.push(`access:${f.id}`);
  else if(f.stage==='volumes'||f.stage==='site')keys.push(`${f.stage}:${f.id}`);
  else keys.push(`other:${f.stage}:${f.id}`);
  return {f,keys};
 });
 // Union findings that share any key.
 const parent=new Map<string,string>(),find=(k:string):string=>{if(!parent.has(k))parent.set(k,k);const p=parent.get(k)!;if(p===k)return k;const r=find(p);parent.set(k,r);return r;};
 const union=(a:string,b:string)=>{parent.set(find(a),find(b));};
 for(const {keys} of keyed){keys.forEach(find);for(let i=1;i<keys.length;i++)union(keys[0],keys[i]);}
 // Access findings hang from the reachable room they share a wall with: one circulation decision per such room.
 const accessAnchor=(room:string)=>{const m=errors.find(e=>e.stage==='access'&&e.id===room)?.message.match(/([\w-]+) \(\w+ edge, [\d.]+ m, reachable\)/);return m?.[1];};
 for(const {f,keys} of keyed)if(f.stage==='access'){const anchor=accessAnchor(f.id);if(anchor){keys.push(`anchor:${anchor}`);union(keys[0],`anchor:${anchor}`);}}
 const groups=new Map<string,Keyed[]>();
 for(const k of keyed)(groups.get(find(k.keys[0]))??groups.set(find(k.keys[0]),[]).get(find(k.keys[0]))!).push(k);
 const baseIds=baseline?new Set([...baseline.spaces.map(s=>s.id),...baseline.portals.map(p=>p.id),...(baseline.screens??[]).map(s=>s.id)]):undefined;
 const fresh=(ids:string[])=>baseIds?[...new Set(ids)].filter(i=>!baseIds.has(i)):[];
 const out:Decision[]=[];
 for(const members of groups.values()){
  const allKeys=[...new Set(members.flatMap(m=>m.keys))],kind:DecisionKind=allKeys.some(k=>k.startsWith('wall:'))?'wall':allKeys.some(k=>k.startsWith('pitched:'))?'pitched-roof':allKeys.some(k=>k.startsWith('eaves:'))?'eaves':allKeys.some(k=>k.startsWith('roofcover:'))?'roof-cover':allKeys.some(k=>k.startsWith('access:'))?'circulation':allKeys.some(k=>k.startsWith('volumes:'))?'arrangement':allKeys.some(k=>k.startsWith('site:'))?'site':'other';
  const fs=members.map(m=>m.f),ids=[...new Set(fs.flatMap(f=>f.id.split('/')))];
  const portals=ids.filter(i=>plan.portals.some(p=>p.id===i)),screens=ids.filter(i=>plan.screens?.some(s=>s.id===i)),roofs=[...new Set(allKeys.filter(k=>/^(pitched|eaves|roofcover):/.test(k)).map(k=>k.split(':')[1]))];
  const rooms=ids.filter(i=>spaceOf(i));
  let title='',relationship='',softwareRole='',modelDecides='',introduced:string[]=[];
  if(kind==='wall'){
   const wall=allKeys.filter(k=>k.startsWith('wall:')).map(k=>k.slice(5)),[room,side]=wall[0].split(':');
   const r=rects[room],neighbours=r?[...new Set(edgeExposure(r,side as Side,plan.spaces.filter(o=>o.id!==room&&o.level===spaceOf(room)?.level&&rects[o.id]).map(o=>({id:o.id,rect:rects[o.id]}))).shared.map(x=>x.id))]:[];
   title=`${wall.length>1?`Walls ${wall.join(', ')}`:`${side} wall of ${room}`}${neighbours.length?` (shared with ${neighbours.join(', ')})`:' (exposed)'}`;
   relationship=`${portals.length} opening(s) and ${screens.length} screen(s) are authored on a wall whose neighbour decides what can stand there.`;
   softwareRole='Derives the wall and position of any door or opening declared with host side "shared", and of a window declared "exposed" when exactly one exposed run exists; reports the exposed runs of every edge.';
   modelDecides='What this wall is: an interior connection, an exterior window (needs an exposed run) or nothing. A room wrapped on every edge has no exterior window or screen.';
   introduced=fresh([...neighbours,...portals,...screens]);
  }else if(kind==='pitched-roof'||kind==='eaves'||kind==='roof-cover'){
   const list=roofs,forms=list.map(i=>roofOf(i)?`${roofOf(i)!.form}${(roofOf(i)!.overhang??0)>0?` +${roofOf(i)!.overhang} m eaves`:''}`:'none');
   title=kind==='pitched-roof'?`Pitched roof${list.length>1?'s':''} on ${list.join(', ')}`:kind==='eaves'?`Eaves of ${list.join(', ')}`:`Roof cover of ${list.join(', ')}`;
   relationship=kind==='pitched-roof'?`A pitched roof (${forms.join('; ')}) stays inside its own room and builds fascia only on edges no other room shares, so abutting a neighbour of any height is valid. It is rejected only where a space is stacked over part of it (lean-to or valley), where an overhang reaches a neighbour, or where rooms overlap.`:kind==='eaves'?`Eaves project ${forms.join('; ')} beyond walls that other rooms share.`:`The roof declaration of these spaces conflicts with what is stacked above or beside them.`;
   softwareRole=kind==='pitched-roof'?'Derives, from adjacency alone, which edges of a pitched roof are exposed (fascia only there) and which neighbours it meets; builds the exposed remainder of a partly covered flat roof itself.':'Derives the exposed remainder of a partly covered flat roof; reports every neighbour it meets.';
   modelDecides='Which rooms get a pitched or overhanging roof (a design choice), a flat roof for any space with a room stacked over part of it, and the arrangement when rooms overlap.';
   introduced=baseline?list.filter(i=>{const b=baseline.roofs.find(r=>r.space===i);return !b||b.form!==roofOf(i)?.form||(b.overhang??0)!==(roofOf(i)?.overhang??0);}).map(i=>`${i} roof changed`):[];
  }else if(kind==='circulation'){
   const unreachable=[...new Set(fs.map(f=>f.id))],anchors=[...new Set(allKeys.filter(k=>k.startsWith('anchor:')).map(k=>k.slice(7)))];
   title=`${unreachable.join(', ')} ${unreachable.length>1?'are':'is'} not connected${anchors.length?` to ${anchors.join(', ')}`:''}`;
   relationship=anchors.length?`${anchors.join(', ')} is reachable and shares walls with ${unreachable.join(', ')}, but no door or passage is declared between them.`:`${unreachable.join(', ')} ${unreachable.length>1?'have':'has'} no declared connection to any reachable space.`;
   softwareRole='Lists the neighbours each room shares a wall with. When a door or passage is declared with host side "shared", derives its wall and position from the shared segment. It does not declare connections.';
   modelDecides='Which neighbour each room connects through, and the opening mode and width.';
   introduced=fresh(unreachable);
  }else if(kind==='arrangement'){
   title=`Independently placed rooms meet: ${fs.map(f=>f.id).join(', ')}`;relationship='Relative placement chains were authored without seeing where each ended.';
   softwareRole='Resolves every relative placement to absolute extents and reports each overlap.';modelDecides='Which chain yields or whether the rooms should meet.';introduced=fresh(rooms);
  }else if(kind==='site'){
   title=`Site allocation: ${ids.join(', ')}`;relationship='Outdoor allocations must lie inside the site, which is centred on the room cells.';
   softwareRole='Resolves the site frame and reports the overlap or excess.';modelDecides='Site size or allocation placement.';introduced=fresh(ids);
  }else{title=`Other: ${fs[0].stage} ${fs[0].id}`;relationship=fs[0].message;softwareRole='Reports the finding.';modelDecides='Correct the authored value.';}
  out.push({id:`${kind}:${(allKeys.find(k=>!k.startsWith('anchor:'))??allKeys[0])}`,kind,title,relationship,affects:{portals,screens,roofs,rooms},findings:fs.map(f=>({stage:f.stage,id:f.id})),introduced,softwareRole,modelDecides});
 }
 return out.sort((a,b)=>b.findings.length-a.findings.length||a.id.localeCompare(b.id));
}
