/** Read-only, collect-everything diagnosis of an architectural-plan-1 proposal.
 * It never edits the plan, never relaxes compilation and does not execute later compiler stages: each check
 * re-derives its own facts from the authored placements, so independent errors are reported together.
 * Findings are evidence for a person or a bounded revision step, not construction. */
import {architecturalPlanSchema,type ArchitecturalPlan} from './plan';
import {expandCompositionLenient,volumeRoofClaimProblems,type SpanInfo} from './composition';
import {resolveLayout,resolveSiteRects,type Rect} from './layout';
import {coverOf,exposedPieces} from '../experimental/semantic-building/vertical';
import {volumeCollisions,explainCollisions,describeDecision} from './arrangement';
import {WALL,SIDES,resolveEaves,sectionSolids,eavesOf,type EaveSection,edgeOf,sharedRuns,edgeExposure,placePortals,pointOnEdge,stairKeepOuts,crossesFlight,type Side,type RequestedSide } from './coordination';
export type Finding={stage:'contract'|'resolution'|'volumes'|'site'|'openings'|'access'|'roofs'|'screens'|'programme';severity:'error'|'observation';id:string;message:string;
 /** Findings that share one root cause carry the same key; set only where several findings are consequences of one authored decision. */
 cause?:string};
const PIER=.36;
const f2=(n:number)=>Number(n.toFixed(2));
const span=(r:Rect)=>`x ${f2(r.x)}..${f2(r.x+r.width)}, z ${f2(r.z)}..${f2(r.z+r.depth)}`;
const overlapRect=(a:Rect,b:Rect):Rect|null=>{const x=Math.max(a.x,b.x),z=Math.max(a.z,b.z),w=Math.min(a.x+a.width,b.x+b.width)-x,d=Math.min(a.z+a.depth,b.z+b.depth)-z;return w>1e-6&&d>1e-6?{x,z,width:w,depth:d}:null;};
/** Intervals (edge parameter) along `r`'s `side` shared with other spaces. */
const shared=sharedRuns;
export function diagnosePlan(raw:unknown){
 const findings:Finding[]=[];
 const add=(stage:Finding['stage'],severity:Finding['severity'],id:string,message:string,cause?:string)=>{findings.push({stage,severity,id,message,...(cause?{cause}:{})});};
 const parsed=architecturalPlanSchema.safeParse(raw);
 if(!parsed.success){parsed.error.issues.forEach(i=>add('contract','error','plan',`${i.path.join('.')||'plan'}: ${i.message}`));return {findings,rects:{} as Record<string,Rect>,siteRects:{} as Record<string,Rect>,metrics:{} as Record<string,unknown>};}
 const plan:ArchitecturalPlan=parsed.data;
 // Resolution (tolerant): levels, space rectangles, site-item rectangles.
 const tops=new Map<string,number>();
 const level=(key:string,active=new Set<string>()):number|undefined=>{
  if(tops.has(key))return tops.get(key);
  const l=plan.levels.find(l=>l.id===key);if(!l||active.has(key)){add('resolution','error',key,'missing or cyclic level reference');return undefined;}
  active.add(key);const base=l.above===null?plan.site.elevation:level(l.above,active);if(base===undefined)return undefined;
  tops.set(key,base+l.rise);return base+l.rise;
 };
 plan.levels.forEach(l=>level(l.id));
 const layout=resolveLayout(plan),rects=layout.rects;
 for(const q of layout.problems)add('resolution','error',q.id,q.message);
 const spaceOf=(id:string)=>plan.spaces.find(s=>s.id===id);
 const heightOf=(id:string)=>{const s=spaceOf(id)!;if(s.height!==undefined)return s.height;const up=plan.levels.find(l=>l.above===s.level);return up?up.rise:3;};
 const live=plan.spaces.filter(s=>rects.has(s.id)).map(s=>({id:s.id,rect:rects.get(s.id)!,s}));
 // Composition: roof spans, facade rhythms and volume materials are expanded by the SAME function the compiler's derive step calls, over the same
 // resolved rectangles, so this diagnosis reads one normalized plan rather than its own interpretation of the authored one.
 // The lenient form reports every composition problem and still yields the spans that are valid, so one defective span neither hides the others nor
 // makes rooms it covers look unroofed. Its problems are exactly the ones the compiler's strict form rejects with.
 const composed=expandCompositionLenient(plan,plan.composition,rects);
 const facadeMessages=new Set(composed.facadeProblems.map(p=>p.message));
 composed.problems.filter(m=>!facadeMessages.has(m)).forEach((m,i)=>add('resolution','error','composition',m,`composition-span:${i}`));
 // A facade rhythm that no run of its wall can hold is reported at the openings, where the wall is, as one decision of the rhythm.
 composed.facadeProblems.forEach(p=>add('openings','error',p.id,p.message,`facade:${p.id}`));
 const allRoofs=composed.roofs,spans:SpanInfo[]=composed.spans;
 // Rooms of a span that failed validation: their roof is a declared, unresolved decision, not an absent roof.
 const spanUnresolved=new Set(composed.invalid.flatMap(i=>i.members));
 // Volumes: same-level footprints (and any overlapping vertical extents) intersecting. Each finding carries its measured cause and the single placement edits that would clear it (offers only; nothing is applied).
 {
  const decisions=new Map(explainCollisions(plan).map(d=>[d.pair.join('/'),d]));
  for(const c of volumeCollisions(plan,rects,tops)){
   const a=live.find(l=>l.id===c.a)!,b=live.find(l=>l.id===c.b)!,d=decisions.get(`${c.a}/${c.b}`);
   add('volumes','error',`${c.a}/${c.b}`,`occupied volumes overlap by ${f2(c.overlap.width)}×${f2(c.overlap.depth)} m (${f2(c.vertical)} m vertical): ${c.a} spans ${span(a.rect)}, ${c.b} spans ${span(b.rect)}.${d?` Cause: ${describeDecision(d)}`:''}`);
  }
 }
 // Site: item rectangles anchored to a space or a site item; bounds and allocation conflicts.
 const siteLayout=resolveSiteRects(plan,rects),siteRects=siteLayout.rects;
 for(const q of siteLayout.problems)add('resolution','error',q.id,q.message);
 const items=[...plan.pools,...plan.landscape];
 if(live.length){
  const xs=live.flatMap(l=>[l.rect.x,l.rect.x+l.rect.width]),zs=live.flatMap(l=>[l.rect.z,l.rect.z+l.rect.depth]);
  const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2,halfW=plan.site.width/2,halfD=plan.site.depth/2;
  const c=Math.cos(plan.orientation),s=Math.sin(plan.orientation);
  const inside=(r:Rect,margin=0)=>{const x=c*(r.x+r.width/2-cx)+s*(r.z+r.depth/2-cz),z=-s*(r.x+r.width/2-cx)+c*(r.z+r.depth/2-cz),w=Math.abs(c)*(r.width+margin)+Math.abs(s)*(r.depth+margin),d=Math.abs(s)*(r.width+margin)+Math.abs(c)*(r.depth+margin);return {ok:Math.abs(x)+w/2<=halfW+1e-6&&Math.abs(z)+d/2<=halfD+1e-6,over:Math.max(Math.abs(x)+w/2-halfW,Math.abs(z)+d/2-halfD)};};
  for(const l of live){const r=inside(l.rect);if(!r.ok)add('site','error',l.id,`room lies ${f2(r.over)} m outside the ${plan.site.width}×${plan.site.depth} m site.`);}
  const placed=live.map(l=>({id:l.id,rect:l.rect}));
  for(const item of items){
   const r=siteRects.get(item.id);if(!r)continue;
   const margin='waterDepth' in item?.4:0,grown={x:r.x-margin/2,z:r.z-margin/2,width:r.width+margin,depth:r.depth+margin};
   const fit=inside(r,margin);
   if(!fit.ok)add('site','error',item.id,`${item.id} (${span(r)}) lies ${f2(fit.over)} m outside the ${plan.site.width}×${plan.site.depth} m site, which is centred on the room cells (building spans ${span({x:Math.min(...xs),z:Math.min(...zs),width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)})}).`);
   const clash=placed.filter(o=>overlapRect(grown,o.rect));
   if(clash.length)add('site','error',item.id,`${item.id} overlaps ${clash.map(o=>o.id).join(', ')}.`);
   placed.push({id:item.id,rect:grown});
  }
 }
 // Openings: sides declared as "shared"/"exposed" are derived from the relationship (coordination.ts);
 // explicit sides are checked as before, then every opening must fit its run, piers and heights.
 const sameLevel=(a:string,b:string)=>spaceOf(a)?.level===spaceOf(b)?.level;
 const centresOnEdge=new Map<string,{id:string;c:number;w:number;mode:string}[]>();
 const placed=placePortals({spaces:plan.spaces,portals:plan.portals,stairs:plan.stairs},Object.fromEntries(rects));
 type OpeningLike={id:string;host:{space:string;side:RequestedSide};to:string;width:number;height:number;mode:'door'|'open'|'window';sill?:number};
 /** Every fit, exposure, pier, stair and height check for one placed opening: authored portals and composition facade bays alike. */
 const checkOpening=(p:OpeningLike,side:Side,centre:number)=>{
  const host=rects.get(p.host.space)!,e=edgeOf(host,side),lo=centre-p.width/2,hi=centre+p.width/2;
  const key=`${p.host.space}:${side}`;centresOnEdge.set(key,[...(centresOnEdge.get(key)??[]),{id:p.id,c:centre,w:p.width,mode:p.mode}]);
  if(lo<WALL||hi>e.len-WALL)add('openings','error',p.id,`opening (${f2(lo)}..${f2(hi)} m) leaves less than a ${WALL} m margin on the ${side} edge of ${p.host.space} (${f2(e.len)} m long).`);
  const others=live.filter(l=>l.id!==p.host.space&&sameLevel(l.id,p.host.space));
  if(p.to==='exterior'){
   if(p.mode!=='window')add('openings','error',p.id,'exterior passage needs an outdoor landing allocation (only fixed windows may face the exterior).');
   const touching=shared(host,side,others);
   const hit=touching.find(t=>Math.min(hi,t.hi)-Math.max(lo,t.lo)>1e-6);
   if(hit){
    const x=SIDES.map(s=>({s,ex:edgeExposure(host,s,others)})),open=x.filter(y=>y.ex.free.some(r=>r.hi-r.lo>=p.width+2*WALL-1e-6));
    add('openings','error',p.id,`window faces ${hit.id}, not the exterior: ${side} edge of ${p.host.space} is shared there. ${open.length?`Exposed wall wide enough for ${p.width} m: ${open.map(y=>`${y.s} ${y.ex.free.filter(r=>r.hi-r.lo>=p.width+2*WALL-1e-6).map(r=>`${f2(r.lo)}..${f2(r.hi)} m`).join(', ')}`).join('; ')}.`:`${p.host.space} has no exposed wall wide enough for it: every edge is shared or too short.`}`);
   }
  }else{
   const target=live.find(l=>l.id===p.to);
   if(!target){add('openings','error',p.id,`target ${p.to} is missing or unresolved`);return;}
   if(!sameLevel(p.to,p.host.space)){add('openings','error',p.id,`${p.to} is on another level; a stair is required.`);return;}
   const seg=shared(host,side,[target]);
   if(!seg.length){add('openings','error',p.id,`${p.host.space} and ${p.to} share no wall on the ${side} edge.${(()=>{const real=SIDES.find(s=>shared(host,s,[target]).length);return real?` They do share the ${real} edge of ${p.host.space}; host side "shared" derives it.`:'';})()}`);return;}
   const fits=seg.some(t=>lo>=t.lo+WALL-1e-6&&hi<=t.hi-WALL+1e-6);
   if(!fits)add('openings','error',p.id,`opening (${f2(lo)}..${f2(hi)} m) does not fit the shared segment with ${p.to} (${seg.map(t=>`${f2(t.lo)}..${f2(t.hi)}`).join(', ')} m) with ${WALL} m margins.`);
  }
  if(p.mode!=='window'&&p.host.side!=='shared'){
   for(const k of stairKeepOuts(plan.stairs,Object.fromEntries(rects)).filter(k=>k.ids.includes(p.host.space)||k.ids.includes(p.to))){
    const pt=pointOnEdge(host,side,centre);
    if(crossesFlight(k,pt))add('openings','error',p.id,`opening centre (${f2(pt[0])}, ${f2(pt[1])}) lies left of the stair flight (axis x ${f2(k.sx)}, flight and 0.4 m clearance z ${f2(k.z0)}..${f2(k.z1)}): a landing-aligned position is required. Host side "shared" moves the opening the least distance that clears it.`);
   }
  }
  const ceiling=Math.min(...[p.host.space,p.to].filter(id=>{const x=spaceOf(id);return x&&!x.outdoor;}).map(heightOf),Infinity);
  if((p.sill??0)+p.height>ceiling+1e-6)add('openings','error',p.id,`opening top ${f2((p.sill??0)+p.height)} m exceeds the ${f2(ceiling)} m room height.`);
  if(p.mode!=='window'&&(p.sill??0)!==0)add('openings','error',p.id,'only windows may have a sill.');
 };
 for(const p of plan.portals){
  if(!rects.has(p.host.space)){add('openings','error',p.id,`host ${p.host.space} is unresolved`);continue;}
  const at=placed.get(p.id)!;
  if(at.problem!==undefined){add('openings','error',p.id,at.problem);continue;}
  checkOpening(p,at.side,at.centre);
 }
 // Facade rhythms declared in composition become ordinary openings (the compiler's expansion) and meet the same checks.
 for(const f of composed.facades){
  const side=SIDES[f.host.edge];
  if(!rects.has(f.host.space)){add('openings','error',f.id,`host ${f.host.space} is unresolved`);continue;}
  checkOpening({id:f.id,host:{space:f.host.space,side},to:f.to,width:f.width,height:f.height,mode:f.mode,sill:f.sill},side,f.offset);
 }
 for(const [key,list] of centresOnEdge)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];if(Math.abs(a.c-b.c)<(a.w+b.w)/2+PIER-1e-6)add('openings','error',`${a.id}/${b.id}`,`openings on ${key} leave under ${PIER} m of pier.`);}
 // Access: reachability from arrival through doors and passages (and stairs).
 const reach=new Set<string>([plan.arrival]),queue=[plan.arrival];
 const link=(a:string,b:string)=>{const out:string[]=[];for(const p of plan.portals)if(p.mode!=='window'&&p.to!=='exterior'){if(p.host.space===a&&p.to===b)out.push(b);if(p.host.space===b&&p.to===a)out.push(a);}for(const st of plan.stairs){if(st.lower===a&&st.upper===b||st.upper===a&&st.lower===b)out.push(b);}return out.length>0;};
 while(queue.length){const a=queue.shift()!;for(const s of plan.spaces)if(!reach.has(s.id)&&link(a,s.id)){reach.add(s.id);queue.push(s.id);}}
 if(!spaceOf(plan.arrival))add('access','error',plan.arrival,'arrival space does not exist.');
 for(const s of plan.spaces)if(!s.outdoor&&!reach.has(s.id)){
  // Candidate connections are facts about the declared arrangement, not a decision: interior neighbours on the same level that share a wall long enough for a door.
  const mine=rects.get(s.id),options=!mine?[]:SIDES.flatMap(side=>shared(mine,side,live.filter(l=>l.id!==s.id&&!l.s.outdoor&&l.s.level===s.level)).filter(r=>r.hi-r.lo>=1+2*WALL).map(r=>({side,id:r.id,len:r.hi-r.lo})));
  const onLevel=plan.spaces.some(o=>o.id!==s.id&&o.level===s.level&&reach.has(o.id));
  add('access','error',s.id,`not reachable from the arrival through doors, passages or stairs.${options.length?` It shares a wall with ${options.map(o=>`${o.id} (${o.side} edge, ${f2(o.len)} m, ${reach.has(o.id)?'reachable':'not reachable'})`).join(', ')}; no door or passage to any of them is declared.`:onLevel?' It shares no wall long enough for a door with another interior space.':' Nothing on its level is reachable and no stair arrives there.'}`);
 }
 // A volume's roof claim names a building-scale roof that exists and covers only its own rooms (the same rule the built-house check applies; here from the declaration).
 for(const v of plan.composition?.volumes??[]){
  const ownIds=plan.spaces.filter(s=>v.masses.includes(s.mass)).map(s=>s.id);
  const declared=[...spans.map(q=>({id:q.id,members:q.members})),...composed.invalid.map(i=>({id:i.id,members:i.members}))];
  volumeRoofClaimProblems(v,ownIds,declared).forEach(m=>add('resolution','error',v.id,m));
 }
 // Roofs: coverage per room using exact rectangles, mirroring the partial-cover rule.
 // A span (valid or not) is one roof over one envelope height. Judged on authored heights only; a derived height is the compiler's to measure.
 for(const g of [...spans.map(sp=>({id:sp.id,members:sp.members})),...composed.invalid.map(i=>({id:i.id,members:i.members}))]){
  const authored=g.members.map(m=>({m,h:spaceOf(m)?.height})).filter((x):x is {m:string;h:number}=>x.h!==undefined&&x.h!==null);
  if(authored.length>1&&authored.some(x=>Math.abs(x.h-authored[0].h)>1e-6))add('roofs','error',g.id,`${g.id}: one roof needs one envelope height; ${authored.map(x=>`${x.m} ${x.h} m`).join(', ')}. Give them the same height or separate roofs.`);
 }
 const polys=live.map(l=>({id:l.id,level:l.s.level,polygon:[[l.rect.x,l.rect.z],[l.rect.x+l.rect.width,l.rect.z],[l.rect.x+l.rect.width,l.rect.z+l.rect.depth],[l.rect.x,l.rect.z+l.rect.depth]] as [number,number][]}));
 const levelTop=(id:string)=>tops.get(id)??0,roofed=new Map<string,{space:string;form:'flat'|'gable'|'hip';rise?:number;overhang?:number}>(allRoofs.map(r=>[r.space,r]));
 // A room under a declared roof span is roofed by the span (one roof over several rooms), not by an entry of its own.
 for(const sp of spans)for(const m of sp.members)if(!roofed.has(m))roofed.set(m,{space:m,form:sp.form,rise:sp.rise,overhang:sp.overhang});
 for(const l of live){
  const cover=coverOf(polys.find(p=>p.id===l.id)!,polys,levelTop),r=roofed.get(l.id);
  if(!l.s.outdoor&&!r&&cover.state!=='full'&&!spanUnresolved.has(l.id))add('roofs','error',l.id,cover.state==='none'?'interior room has neither a roof nor a space above it.':`only ${Math.round(cover.fraction*100)}% covered by spaces above and no roof entry.`);
  if(r&&cover.state==='full')add('roofs','error',l.id,'roof on a fully covered space (the floor above is its cover).');
  if(r&&cover.state==='partial'&&r.form!=='flat')add('roofs','error',l.id,`${r.form} roof over a partly covered space needs a lean-to or valley junction.`);
 }
 for(const r of allRoofs)if(!spaceOf(r.space))add('roofs','error',r.space,'roof names an unknown space.');
 // Roof sections: the slope envelope (eaves) and each fascia board against other roofs and against neighbouring volumes.
 // Eaves are resolved exactly as the compiler resolves them (resolveEaves): the authored overhang on every side, except a side that would reach a wall or
 // roof standing against it, which is flush. Only what still clashes after that is an error. A fascia board only exists on an edge no other room shares
 // (see exposedFascia), so abutting roofs do not collide through it.
 type Section={id:string;key:string;members:ReadonlySet<string>;extra:number;solids:ReturnType<typeof sectionSolids>};
 const eaveSections:EaveSection[]=allRoofs.flatMap(r=>{
  const l=live.find(x=>x.id===r.space);if(!l)return [];
  const sp=spans.find(q=>q.lead===r.space),joined=new Set(sp?.members??[l.id]);
  const pitched=r.form!=='flat',overhang=r.overhang??0,rise=r.rise??.18,base=(tops.get(l.s.level)??0)+heightOf(l.id);
  // A flat roof over a partly covered space is built over the exposed remainder only (the compiler subtracts what is stacked above it).
  const poly=polys.find(p=>p.id===l.id)!,cover=coverOf(poly,polys,levelTop);
  const pieces=sp?[{x:sp.rect.x,z:sp.rect.z,width:sp.rect.width,depth:sp.rect.depth}]:cover.state==='partial'&&!pitched&&overhang===0?exposedPieces(poly,polys,cover).map(pc=>{const xs=pc.map(q=>q[0]),zs=pc.map(q=>q[1]);return {x:Math.min(...xs),z:Math.min(...zs),width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)};}):[{x:l.rect.x,z:l.rect.z,width:l.rect.width,depth:l.rect.depth}];
  const near=live.filter(x=>!joined.has(x.id)&&x.s.level===l.s.level);
  return pieces.map((pc,i)=>({key:`${r.space}#${i}`,id:r.space,level:l.s.level,joined,rect:pc,form:r.form,overhang,bottom:base,rise,neighbours:near.map(x=>x.rect),walls:near.filter(x=>!x.s.outdoor).map(x=>x.rect)}));
 });
 const resolvedEaves=resolveEaves(eaveSections,live.filter(x=>!x.s.outdoor).map(x=>{const bottom=tops.get(x.s.level)??0;return {id:x.id,rect:x.rect,bottom,top:bottom+heightOf(x.id)};}));
 const sections:Section[]=eaveSections.map(q=>({id:q.id,key:q.key,members:q.joined,extra:q.overhang,solids:sectionSolids(q,resolvedEaves.eaves.get(q.key)??eavesOf(0))}));
 // Sides made flush are decisions the compiler also takes; they are stated, never silent.
 for(const t of resolvedEaves.trims)add('roofs','observation',t.roof,`${t.side} eave is flush (authored ${f2(t.authored)} m, built 0): ${t.against} stands against that wall along the whole ${f2(t.edge)} m edge.`);
 // Why the eave could not simply be made flush: the compiler's own reasons (partial abutment, a gap, a corner).
 const why=(x:string,y:string)=>{const all=resolvedEaves.unresolved.filter(u=>u.roof===x&&u.against===y||u.roof===y&&u.against===x),specific=all.filter(u=>u.kind!=='eaves'),m=[...new Set((specific.length?specific:all).map(u=>u.message))];return m.length?` ${m.join(' ')}`:'';};
 const clash=(a:typeof sections[number],b:{rect:Rect;bottom:number;top:number}[])=>{
  let best:{common:Rect;board:boolean}|null=null;
  for(const x of a.solids)for(const y of b){const common=overlapRect(x.rect,y.rect);if(common&&Math.min(x.top,y.top)-Math.max(x.bottom,y.bottom)>1e-6&&(!best||common.width*common.depth>best.common.width*best.common.depth))best={common,board:x.board};}
  return best;
 };
 for(let i=0;i<sections.length;i++)for(let j=i+1;j<sections.length;j++){
  const a=sections[i],b=sections[j],hit=clash(a,b.solids);
  if(hit)add('roofs','error',`${a.id}/${b.id}`,`roof bounds intersect by ${f2(hit.common.width)}×${f2(hit.common.depth)} m at the same height (overhangs ${f2(a.extra)} and ${f2(b.extra)} m)${hit.board?' through a fascia board':''}: select separated roof sections.${why(a.id,b.id)}`,'roof-reach:abutting');
 }
 for(const a of sections)for(const o of live.filter(x=>!x.s.outdoor&&!a.members.has(x.id))){
  const top=tops.get(o.s.level)??0,hit=clash(a,[{rect:o.rect,bottom:top,top:top+heightOf(o.id)}]);
  if(hit)add('roofs','error',`${a.id}/${o.id}`,`roof of ${a.id} (${f2(a.extra)} m overhang${hit.board?', fascia board':''}) projects ${f2(hit.common.width)}×${f2(hit.common.depth)} m into the taller volume of ${o.id}.${why(a.id,o.id)}`,'roof-reach:taller-neighbour');
 }
 // Screens: facade fit, interior boundary, obstructed opening, collision with neighbours.
 for(const sc of plan.screens??[]){
  const host=rects.get(sc.space);if(!host){add('screens','error',sc.id,`host ${sc.space} is unresolved`);continue;}
  const e=edgeOf(host,sc.side),centre=sc.alignment==='centre'?e.len/2:sc.alignment==='start'?sc.width/2+.25:e.len-sc.width/2-.25,lo=centre-sc.width/2,hi=centre+sc.width/2;
  if(lo<0||hi>e.len||sc.sill+sc.height>heightOf(sc.space)+1e-6)add('screens','error',sc.id,'screen exceeds facade dimensions.');
  const others=live.filter(l=>l.id!==sc.space&&sameLevel(l.id,sc.space));
  const interior=shared(host,sc.side,others.filter(o=>!o.s.outdoor)).find(t=>Math.min(hi,t.hi)-Math.max(lo,t.lo)>1e-6);
  if(interior)add('screens','error',sc.id,`screen lies on the interior boundary shared with ${interior.id}.`);
  for(const q of centresOnEdge.get(`${sc.space}:${sc.side}`)??[]){if(q.mode!=='window'&&Math.abs(q.c-centre)<(q.w+sc.width)/2)add('screens','error',sc.id,`screen obstructs the passable opening ${q.id}.`);}
  const depth=sc.standOff+sc.depth/2,band:Rect=e.axis==='x'?{x:e.outward>0?e.line:e.line-depth,z:host.z+Math.min(...[lo,hi].map(t=>(sc.side==='east'?t:e.len-t))),width:depth,depth:sc.width}:{x:host.x+Math.min(...[lo,hi].map(t=>(sc.side==='south'?t:e.len-t))),z:e.outward>0?e.line:e.line-depth,width:sc.width,depth};
  const blocked=[...others,...items.flatMap(i=>siteRects.has(i.id)?[{id:i.id,rect:siteRects.get(i.id)!}]:[])].filter(o=>overlapRect(band,o.rect));
  if(blocked.length)add('screens','error',sc.id,`screen stands in ${blocked.map(b=>b.id).join(', ')}.`);
 }
 // Programme and architectural observations (not compiler errors).
 const interior=live.filter(l=>!l.s.outdoor);
 // Windows authored directly and window bays declared in composition.facades are one population (the compiler's expansion).
 const windowed=new Set([...plan.portals.filter(p=>p.mode==='window').map(p=>p.host.space),...(composed.facades).filter(f=>f.mode==='window').map(f=>f.host.space)]);
 const dark=interior.filter(l=>!windowed.has(l.id)).map(l=>l.id);
 const count=(re:RegExp)=>plan.spaces.filter(s=>re.test(s.use)||re.test(s.id)).length;
 const metrics={levels:plan.levels.length,spaces:plan.spaces.length,interiorSpaces:interior.length,footprintAreaM2:f2(live.reduce((n,l)=>n+l.rect.width*l.rect.depth,0)),interiorAreaM2:f2(interior.reduce((n,l)=>n+l.rect.width*l.rect.depth,0)),roofForms:[...new Set(allRoofs.map(r=>r.form))],roofOverhangs:[...new Set(allRoofs.map(r=>r.overhang??0))],masses:plan.masses.length,screens:plan.screens?.length??0,bedroomSpaces:count(/bedroom|suite/i),bathroomSpaces:count(/\bbath|ensuite|wc\b/i),windowedInteriorRooms:interior.length-dark.length,interiorRoomsWithoutAnyWindow:dark};
 if(metrics.bedroomSpaces>0&&metrics.bathroomSpaces===0)add('programme','observation','bathrooms','bedrooms are allocated but no bathroom or dressing space exists; bathrooms are prose inside the bedroom use.');
 if(plan.levels.length===1)add('programme','observation','levels','single level: no vertical composition, no stair, no upper terrace or roof deck.');
 if(metrics.roofForms.length===1&&metrics.roofForms[0]==='flat'&&metrics.roofOverhangs.every(o=>o===0))add('programme','observation','roofs',`every roof is flat with no overhang (${allRoofs.length} roofs): no roof-led silhouette or deep eaves for shade.`);
 if(dark.length)add('programme','observation','daylight',`${dark.length} of ${interior.length} interior rooms have no window: ${dark.join(', ')}.`);
 // Bays of one facade rhythm are one authored decision: findings on any of its bays (or between a bay and a neighbour) share its cause.
 const bayOf=new Map(composed.facades.map(f=>[f.id,f.id.replace(/-\d+$/,'')]));
 for(const f of findings)if(f.stage==='openings'&&!f.cause){const hit=f.id.split('/').map(i=>bayOf.get(i)).find(Boolean);if(hit)f.cause=`facade:${hit}`;}
 return {findings,rects:Object.fromEntries(rects),siteRects:Object.fromEntries(siteRects),metrics};
}
