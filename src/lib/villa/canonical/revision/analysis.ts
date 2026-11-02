/** Read-only reading of an architectural-plan-1 proposal for bounded revision: what was authored in absolute
 * terms, which findings share a cause, and whether the weaknesses are physical or architectural.
 * Everything derives from the authored placements; nothing here edits, repairs or proposes a layout. */
import {diagnosePlan,type Finding} from '../diagnose';
import {compileArchitecturalPlan,type ArchitecturalPlan,type Rect} from '../plan';
import {DesignConflict} from '../../experimental/semantic-building/compiler';
import {coverOf} from '../../experimental/semantic-building/vertical';
import {placePortals} from '../coordination';
import {decisionsOf,roomExposure,type Decision,type RoomExposure} from './decisions';
type Side='south'|'east'|'north'|'west';
const f2=(n:number)=>Number(n.toFixed(2));
const area=(r:Rect)=>r.width*r.depth;
export const overlap=(a:Rect,b:Rect):Rect|null=>{const x=Math.max(a.x,b.x),z=Math.max(a.z,b.z),w=Math.min(a.x+a.width,b.x+b.width)-x,d=Math.min(a.z+a.depth,b.z+b.depth)-z;return w>1e-6&&d>1e-6?{x,z,width:w,depth:d}:null;};
export type MeasuredRoom={id:string;mass:string;level:string;use:string;outdoor:boolean;x0:number;x1:number;z0:number;z1:number;width:number;depth:number;areaM2:number;floorDatum:number;envelopeHeight:number|null;heightSource:'authored'|'derived'|'unresolved';top:number|null;roof:{form:string;overhang:number;rise:number|null}|null;placedBy:{relativeTo:string|null;side:string;alignment:string;gap:number};windows:number;doorsAndPassages:number};
export type Dependency={from:string;to:string;kind:'placement'|'shared-wall'|'door'|'passage'|'stair'|'window-exterior';side?:string;detail?:string};
export type FindingGroup={id:string;cause:'chain-collision'|'site-containment'|'opening-geometry'|'roof-eaves'|'consequence'|'access'|'enclosure'|'contract'|'resolution'|'compiler';title:string;rootCause:string;involves:string[];findings:{stage:string;id:string;message:string}[];consequenceOf?:string;decisionRequired:string};
export type WeaknessSignal={id:'repeated-cells'|'uniform-roofs'|'no-section-variation'|'single-level'|'unlit-interiors'|'unarticulated-footprint'|'programme-gaps'|'uniform-eaves';fired:boolean;evidence:string};
export type Disposition={kind:'repair'|'redesign';firedSignals:number;reasons:string[];note:string};
export type PlanAnalysis={planId:string;errorCount:number;findings:Finding[];groups:FindingGroup[];decisions:Decision[];exposure:RoomExposure[];compilerDecisions:string[];compilerNote:string;rooms:MeasuredRoom[];siteItems:{id:string;kind:'pool'|'lawn'|'bed';x0:number;x1:number;z0:number;z1:number}[];building:{x0:number;x1:number;z0:number;z1:number;width:number;depth:number};site:{width:number;depth:number;x0:number;x1:number;z0:number;z1:number;note:string};levels:{id:string;above:string|null;rise:number;floorDatum:number}[];dependencies:Dependency[];chains:{root:string;branches:{head:string;members:string[]}[]}[];access:{arrival:string;reachable:string[];unreachable:string[];depth:Record<string,number>};metrics:ReturnType<typeof diagnosePlan>['metrics'];signals:WeaknessSignal[];disposition:Disposition;latentLimits:string[];rects:Record<string,Rect>;siteRects:Record<string,Rect>};
/** Programme categories read from the authored uses; used to check a revision keeps what was planned. */
export const PROGRAMME:{key:string;re:RegExp}[]=[{key:'bedroom',re:/bedroom|suite|sleeping/i},{key:'bathroom',re:/\bbath|ensuite|\bwc\b|powder|dressing/i},{key:'kitchen',re:/kitchen/i},{key:'living',re:/living|salon|lounge|family room/i},{key:'dining',re:/dining/i},{key:'service',re:/pantry|laundry|store|utility|service/i},{key:'entry',re:/entry|foyer|arrival|vestibule/i}];
export function programmeCounts(plan:ArchitecturalPlan){
 const counts:Record<string,number>={};
 for(const {key,re} of PROGRAMME)counts[key]=plan.spaces.filter(s=>!s.outdoor&&(re.test(s.use)||re.test(s.id))&&!(key==='bedroom'&&/\bbath|ensuite|dressing/i.test(s.id))).length;
 counts.terrace=plan.spaces.filter(s=>s.outdoor&&plan.terraces.includes(s.id)).length;counts.pool=plan.pools.length;counts.outdoorSpace=plan.spaces.filter(s=>s.outdoor).length;
 return counts;
}
function resolveLevels(plan:ArchitecturalPlan){
 const tops=new Map<string,number>(),go=(id:string,seen=new Set<string>()):number|undefined=>{if(tops.has(id))return tops.get(id);const l=plan.levels.find(l=>l.id===id);if(!l||seen.has(id))return undefined;seen.add(id);const base=l.above===null?plan.site.elevation:go(l.above,seen);if(base===undefined)return undefined;tops.set(id,base+l.rise);return base+l.rise;};
 plan.levels.forEach(l=>go(l.id));return tops;
}
const edgeLen=(r:Rect,side:Side)=>side==='south'||side==='north'?r.width:r.depth;
export function portalPoint(r:Rect,side:Side,alignment:'start'|'centre'|'end',width:number){
 const len=edgeLen(r,side),c=alignment==='centre'?len/2:alignment==='start'?width/2+.25:len-width/2-.25;
 const at:[number,number]=side==='south'?[r.x+c,r.z]:side==='north'?[r.x+r.width-c,r.z+r.depth]:side==='east'?[r.x+r.width,r.z+c]:[r.x,r.z+r.depth-c];
 return {at,offset:c};
}
const sharedWall=(a:Rect,b:Rect):{side:Side;length:number}|null=>{
 const ov=(lo1:number,hi1:number,lo2:number,hi2:number)=>Math.min(hi1,hi2)-Math.max(lo1,lo2);
 if(Math.abs(a.x+a.width-b.x)<1e-6&&ov(a.z,a.z+a.depth,b.z,b.z+b.depth)>1e-6)return {side:'east',length:ov(a.z,a.z+a.depth,b.z,b.z+b.depth)};
 if(Math.abs(b.x+b.width-a.x)<1e-6&&ov(a.z,a.z+a.depth,b.z,b.z+b.depth)>1e-6)return {side:'west',length:ov(a.z,a.z+a.depth,b.z,b.z+b.depth)};
 if(Math.abs(a.z+a.depth-b.z)<1e-6&&ov(a.x,a.x+a.width,b.x,b.x+b.width)>1e-6)return {side:'north',length:ov(a.x,a.x+a.width,b.x,b.x+b.width)};
 if(Math.abs(b.z+b.depth-a.z)<1e-6&&ov(a.x,a.x+a.width,b.x,b.x+b.width)>1e-6)return {side:'south',length:ov(a.x,a.x+a.width,b.x,b.x+b.width)};
 return null;
};
/** Placement ancestry (self first, root last). Tolerates unknown ids and cycles. */
function ancestry(plan:ArchitecturalPlan,id:string){const out:string[]=[],seen=new Set<string>();let cur:string|null=id;while(cur&&!seen.has(cur)){seen.add(cur);out.push(cur);cur=plan.spaces.find(s=>s.id===cur)?.placement.relativeTo??null;}return out;}
function groupFindings(plan:ArchitecturalPlan,findings:Finding[],decisions:string[]){
 const errors=findings.filter(f=>f.severity==='error'),groups:FindingGroup[]=[],take=(f:Finding[])=>f.map(x=>({stage:x.stage,id:x.id,message:x.message}));
 // Volume collisions: rooms reached by independent placement chains, grouped by the pair of chains that meet.
 const chainKey=new Map<string,Finding[]>();
 for(const f of errors.filter(e=>e.stage==='volumes')){
  const [a,b]=f.id.split('/'),pa=ancestry(plan,a),pb=ancestry(plan,b),common=pa.find(x=>pb.includes(x));
  const head=(path:string[])=>common?path[path.indexOf(common)-1]??common:path[path.length-1];
  const key=[head(pa),head(pb)].sort().join(' × ')+(common?` (diverge at ${common})`:' (no shared ancestor)');
  chainKey.set(key,[...(chainKey.get(key)??[]),f]);
 }
 const colliding=new Set<string>();
 for(const [key,fs] of chainKey){
  const rooms=[...new Set(fs.flatMap(f=>f.id.split('/')))];rooms.forEach(r=>colliding.add(r));
  groups.push({id:`chain-collision:${key}`,cause:'chain-collision',title:`Independently placed chains meet in the same volume: ${key}`,rootCause:'Placement is relative, so each chain was authored without seeing where the other ended; the overlaps are one coordination fault, not separate room faults.',involves:rooms,findings:take(fs),decisionRequired:'Decide which chain yields, or whether the two chains should meet at all (different arrangement, level, or gap); do not just nudge individual rooms.'});
 }
 const site=errors.filter(e=>e.stage==='site');
 if(site.length)groups.push({id:'site-containment',cause:'site-containment',title:'Allocations outside, or colliding within, the site',rootCause:'The site is centred on the room cells and is not placed independently; pools, lawns and rooms beyond the cell envelope fall off it.',involves:[...new Set(site.flatMap(f=>f.id.split('/')))],findings:take(site),decisionRequired:'Decide the site size relative to the whole composition including outdoor allocations, or reduce/relocate the outdoor allocations.'});
 const openings=errors.filter(e=>e.stage==='openings');
 const consequential=(f:Finding)=>{const portal=plan.portals.find(p=>f.id===p.id||f.id.split('/').includes(p.id));if(!portal)return undefined;return [portal.host.space,portal.to].find(r=>colliding.has(r));};
 const own:Finding[]=[];const conseq=new Map<string,Finding[]>();
 for(const f of openings){const r=consequential(f);if(r&&/share no wall|does not fit the shared segment/.test(f.message)){conseq.set(r,[...(conseq.get(r)??[]),f]);}else own.push(f);}
 if(own.length)groups.push({id:'opening-geometry',cause:'opening-geometry',title:'Openings that do not fit the walls they were authored on',rootCause:'Portal edges run counter-clockwise (north/west alignment is reversed against room placement) and openings must fit inside the shared segment with margins.',involves:[...new Set(own.flatMap(f=>f.id.split('/')))],findings:take(own),decisionRequired:'Decide each opening on a wall that is actually shared with its target, at an alignment that fits.'});
 for(const [room,fs] of conseq)groups.push({id:`consequence:openings@${room}`,cause:'consequence',title:`Openings that depend on the colliding room ${room}`,rootCause:'The wall these openings assume is shared does not exist where the room currently sits; they will be re-evaluated once the arrangement is decided.',involves:[...new Set(fs.flatMap(f=>f.id.split('/')))],findings:take(fs),consequenceOf:[...chainKey.keys()][0],decisionRequired:'None independently: settle the arrangement first.'});
 const roofs=errors.filter(e=>e.stage==='roofs');
 const eave=roofs.filter(e=>/bounds intersect|projects .* into the taller/.test(e.message)),other=roofs.filter(e=>!eave.includes(e));
 if(eave.length){
  const withEaves=plan.roofs.filter(r=>(r.overhang??0)>0),abutting=new Set(eave.flatMap(f=>f.id.split('/')));
  groups.push({id:'roof-eaves',cause:'roof-eaves',title:'Roof eaves meeting neighbouring roofs and taller volumes',rootCause:`Eaves were applied to rooms regardless of exposure: ${withEaves.length} roofs carry overhangs (${[...new Set(withEaves.map(r=>r.overhang))].sort().join(', ')} m) although ${abutting.size} of the rooms involved abut others. The explicit rule "select separated roof sections" was not applied, and the compiler cannot trim eaves to the exposed perimeter.`,involves:[...abutting],findings:take(eave),decisionRequired:'Decide where shade projection is wanted (exposed edges only), and give abutting rooms separated or overhang-free roof sections, or a different roof strategy.'});
 }
 if(other.length)groups.push({id:'roof-coverage',cause:'enclosure',title:'Roof or overhead-enclosure faults',rootCause:'A room lacks a cover, or a roof was declared where the floor above is the cover.',involves:[...new Set(other.flatMap(f=>f.id.split('/')))],findings:take(other),decisionRequired:'Decide the roof or enclosure strategy per affected room.'});
 const screens=errors.filter(e=>e.stage==='screens');
 const screenRoom=(f:Finding)=>{const m=f.message.match(/stands in ([\w, -]+)\./);return m?m[1].split(', '):[];};
 const screenConsequence=screens.filter(f=>screenRoom(f).some(r=>colliding.has(r)));
 const screenOwn=screens.filter(f=>!screenConsequence.includes(f));
 if(screenConsequence.length)groups.push({id:'consequence:screens',cause:'consequence',title:'Screens standing in rooms that are themselves in conflict',rootCause:'The space beside the facade is occupied only because the neighbouring chain collides with it.',involves:[...new Set(screenConsequence.flatMap(f=>f.id.split('/')))],findings:take(screenConsequence),consequenceOf:[...chainKey.keys()][0],decisionRequired:'None independently: settle the arrangement first.'});
 if(screenOwn.length)groups.push({id:'screen-placement',cause:'opening-geometry',title:'Screens that do not fit their facade',rootCause:'A screen was authored on a boundary shared with another room, over an opening, or beyond the facade.',involves:[...new Set(screenOwn.flatMap(f=>f.id.split('/')))],findings:take(screenOwn),decisionRequired:'Decide each screen on an exposed facade away from passable openings.'});
 const access=errors.filter(e=>e.stage==='access');
 if(access.length)groups.push({id:'access',cause:'access',title:'Rooms not reachable from the arrival',rootCause:'Circulation was not authored through doors, passages or stairs to every interior room.',involves:access.map(f=>f.id),findings:take(access),decisionRequired:'Decide the circulation to each isolated room.'});
 const rest=errors.filter(e=>e.stage==='contract'||e.stage==='resolution');
 for(const f of rest)groups.push({id:`${f.stage}:${f.id}`,cause:f.stage as 'contract'|'resolution',title:`${f.stage} fault: ${f.id}`,rootCause:f.message,involves:[f.id],findings:take([f]),decisionRequired:'Correct the authored reference or value.'});
 if(decisions.length&&!errors.length)groups.push({id:'compiler',cause:'compiler',title:'Compiler rejection with no diagnostic finding',rootCause:decisions.join(' '),involves:[],findings:decisions.map(d=>({stage:'compiler',id:'compile',message:d})),decisionRequired:'Decide against the stated compiler limitation.'});
 return groups;
}
export function analysePlan(plan:ArchitecturalPlan,baseline?:ArchitecturalPlan):PlanAnalysis{
 const d=diagnosePlan(plan);
 let compilerDecisions:string[]=[],compilerNote='Compiler accepted the plan.';
 try{compileArchitecturalPlan(plan);}catch(e){if(!(e instanceof DesignConflict)&&!(e instanceof Error))throw e;compilerDecisions=e instanceof DesignConflict?e.decisions:e.message.split('\n').filter(Boolean);compilerNote=e instanceof DesignConflict?'The compiler is fail-fast: later construction stages (junction splitting, stair fit, staggered walls, scene support checks) only run after earlier stages pass, so a clean diagnosis is not proof of acceptance.':'The compiler produced a scene that failed the scene relationship checks (later stage); diagnosis does not replicate these.';}
 const tops=resolveLevels(plan),rects=d.rects as Record<string,Rect>,siteRects=d.siteRects as Record<string,Rect>;
 const polys=plan.spaces.filter(s=>rects[s.id]).map(s=>{const r=rects[s.id];return {id:s.id,level:s.level,polygon:[[r.x,r.z],[r.x+r.width,r.z],[r.x+r.width,r.z+r.depth],[r.x,r.z+r.depth]] as [number,number][]};});
 const rooms:MeasuredRoom[]=plan.spaces.flatMap(s=>{
  const r=rects[s.id];if(!r)return [];
  const datum=tops.get(s.level)??NaN;let h:number|null=null,src:MeasuredRoom['heightSource']='unresolved';
  if(s.height!==undefined){h=s.height;src='authored';}
  else{const cover=coverOf(polys.find(p=>p.id===s.id)!,polys,id=>tops.get(id)??0),storeys=plan.levels.filter(l=>l.above===s.level);if(cover.datum!==undefined){h=cover.datum-datum;src='derived';}else if(storeys.length===1){h=storeys[0].rise;src='derived';}}
  const roof=plan.roofs.find(x=>x.space===s.id);
  return [{id:s.id,mass:s.mass,level:s.level,use:s.use,outdoor:s.outdoor,x0:f2(r.x),x1:f2(r.x+r.width),z0:f2(r.z),z1:f2(r.z+r.depth),width:f2(r.width),depth:f2(r.depth),areaM2:f2(area(r)),floorDatum:f2(datum),envelopeHeight:h===null?null:f2(h),heightSource:src,top:h===null?null:f2(datum+h),roof:roof?{form:roof.form,overhang:roof.overhang??0,rise:roof.rise??null}:null,placedBy:s.placement,windows:plan.portals.filter(p=>p.host.space===s.id&&p.mode==='window').length,doorsAndPassages:plan.portals.filter(p=>p.mode!=='window'&&(p.host.space===s.id||p.to===s.id)).length}];
 });
 const rs=Object.values(rects),x0=Math.min(...rs.map(r=>r.x)),x1=Math.max(...rs.map(r=>r.x+r.width)),z0=Math.min(...rs.map(r=>r.z)),z1=Math.max(...rs.map(r=>r.z+r.depth)),cx=(x0+x1)/2,cz=(z0+z1)/2;
 const siteItems=Object.entries(siteRects).map(([id,r])=>({id,kind:(plan.pools.some(p=>p.id===id)?'pool':plan.landscape.find(l=>l.id===id)!.kind) as 'pool'|'lawn'|'bed',x0:f2(r.x),x1:f2(r.x+r.width),z0:f2(r.z),z1:f2(r.z+r.depth)}));
 // Dependencies: how each room was placed, which walls are actually shared, and what is connected by what.
 const dependencies:Dependency[]=[];
 for(const s of plan.spaces)if(s.placement.relativeTo)dependencies.push({from:s.id,to:s.placement.relativeTo,kind:'placement',side:s.placement.side,detail:`${s.placement.alignment}, gap ${s.placement.gap}`});
 const live=plan.spaces.filter(s=>rects[s.id]);
 for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){if(live[i].level!==live[j].level)continue;const w=sharedWall(rects[live[i].id],rects[live[j].id]);if(w)dependencies.push({from:live[i].id,to:live[j].id,kind:'shared-wall',side:w.side,detail:`${f2(w.length)} m shared`});}
 const placed=placePortals(plan,rects);
 for(const p of plan.portals){const at=placed.get(p.id);dependencies.push({from:p.host.space,to:p.to,kind:p.to==='exterior'?'window-exterior':p.mode==='window'?'window-exterior':p.mode==='door'?'door':'passage',side:at&&at.problem===undefined?at.side:p.host.side,detail:`${p.id} ${p.width}×${p.height} m ${p.alignment}${p.sill?` sill ${p.sill}`:''}${p.host.side==='shared'||p.host.side==='exposed'?` (host side derived: ${p.host.side})`:''}`});}
 for(const st of plan.stairs)dependencies.push({from:st.lower,to:st.upper,kind:'stair',detail:`${st.id} ${st.width} m wide, run ${st.run} m`});
 // Chains: placement subtrees below the root's direct children, which is where independently authored arrangements meet.
 const root=plan.spaces.find(s=>s.placement.relativeTo===null)?.id??'';
 const branches=new Map<string,Set<string>>();
 for(const s of plan.spaces){const path=ancestry(plan,s.id);if(path.length<2)continue;const head=path[path.length-2];(branches.get(head)??branches.set(head,new Set()).get(head)!).add(s.id);}
 const chains=[{root,branches:[...branches].map(([head,members])=>({head,members:[...members]}))}];
 // Circulation reach and depth from arrival.
 const adj=new Map<string,Set<string>>();
 const link=(a:string,b:string)=>{(adj.get(a)??adj.set(a,new Set()).get(a)!).add(b);(adj.get(b)??adj.set(b,new Set()).get(b)!).add(a);};
 for(const p of plan.portals)if(p.mode!=='window'&&p.to!=='exterior')link(p.host.space,p.to);
 for(const st of plan.stairs)link(st.lower,st.upper);
 const depth:Record<string,number>={[plan.arrival]:0},queue=[plan.arrival];
 while(queue.length){const a=queue.shift()!;for(const b of adj.get(a)??[])if(depth[b]===undefined){depth[b]=depth[a]+1;queue.push(b);}}
 const interior=plan.spaces.filter(s=>!s.outdoor&&rects[s.id]);
 const access={arrival:plan.arrival,reachable:Object.keys(depth),unreachable:interior.filter(s=>depth[s.id]===undefined).map(s=>s.id),depth};
 // Weakness signals: generic, measured, not tied to a style, floor count or size.
 const signals=weaknessSignals(plan,rooms,d.metrics,rects);
 const groups=groupFindings(plan,d.findings,compilerDecisions);
 const fired=signals.filter(s=>s.fired);
 const physicalOnly=fired.length===0;
 const reasons=fired.map(s=>`${s.id}: ${s.evidence}`);
 const disposition:Disposition=fired.length>=3?{kind:'redesign',firedSignals:fired.length,reasons,note:'Several independent weaknesses are architectural. Correcting coordinates would leave the concept unchanged; revise the concept while retaining the brief.'}:{kind:'repair',firedSignals:fired.length,reasons:physicalOnly?['No architectural weakness signal fired; failures are physical coordination.']:reasons,note:fired.length?'Some architectural weakness is present but the concept is not judged fundamentally ordinary; physical relationships should be corrected while preserving coherent decisions, and the weaknesses reconsidered where cheap.':'Physical repair preserves the concept.'};
 // Limits of later compiler stages that diagnosis does not replicate, stated only when the authored values reach them.
 const ground=plan.levels.find(l=>l.above===null),latentLimits:string[]=[];
 if(ground&&ground.rise>.36)latentLimits.push(`Ground level "${ground.id}" rises ${ground.rise} m above the site. A floor raised more than about 0.36 m with no supporting plinth is rejected by a later construction stage ("Elevated floor needs contact with a ground-connected slab"), after the earlier checks pass; probed at 0.36 m (accepted) and 0.4 m (rejected).`);
 return {planId:plan.id,errorCount:d.findings.filter(f=>f.severity==='error').length,findings:d.findings,groups,decisions:decisionsOf(plan,d.findings,rects,baseline),exposure:roomExposure(plan,rects),compilerDecisions,compilerNote,rooms,siteItems,building:{x0:f2(x0),x1:f2(x1),z0:f2(z0),z1:f2(z1),width:f2(x1-x0),depth:f2(z1-z0)},site:{width:plan.site.width,depth:plan.site.depth,x0:f2(cx-plan.site.width/2),x1:f2(cx+plan.site.width/2),z0:f2(cz-plan.site.depth/2),z1:f2(cz+plan.site.depth/2),note:'Site is centred on the room cells (before applying orientation); pools and lawns must fit inside it.'},levels:plan.levels.map(l=>({id:l.id,above:l.above,rise:l.rise,floorDatum:f2(tops.get(l.id)??NaN)})),dependencies,chains,access,metrics:d.metrics,signals,disposition,latentLimits,rects,siteRects};
}
function weaknessSignals(plan:ArchitecturalPlan,rooms:MeasuredRoom[],metrics:{bedroomSpaces?:number;bathroomSpaces?:number},rects:Record<string,Rect>):WeaknessSignal[]{
 const interior=rooms.filter(r=>!r.outdoor),out:WeaknessSignal[]=[];
 const keyOf=(r:MeasuredRoom)=>`${r.width}x${r.depth}x${r.envelopeHeight}`;
 const buckets=new Map<string,MeasuredRoom[]>();for(const r of interior)buckets.set(keyOf(r),[...(buckets.get(keyOf(r))??[]),r]);
 const repeated=[...buckets.values()].filter(b=>b.length>=3),repeatedCount=repeated.reduce((n,b)=>n+b.length,0),share=interior.length?repeatedCount/interior.length:0;
 out.push({id:'repeated-cells',fired:share>=.3,evidence:`${repeatedCount} of ${interior.length} interior rooms are identical cells in groups of three or more${repeated.length?` (${repeated.map(b=>`${b.length}× ${b[0].width}×${b[0].depth} m`).join('; ')})`:''}.`});
 const forms=[...new Set(plan.roofs.map(r=>r.form))],specs=new Set(plan.roofs.map(r=>`${r.form}|${r.rise??''}`));
 out.push({id:'uniform-roofs',fired:plan.roofs.length>=4&&specs.size===1,evidence:`${plan.roofs.length} roofs use ${forms.join('/')||'no'} form${specs.size===1?' with identical rise':''}.`});
 const topVals=interior.flatMap(r=>r.top===null?[]:[r.top]),spread=topVals.length?Math.max(...topVals)-Math.min(...topVals):0,heights=new Set(interior.map(r=>r.envelopeHeight));
 out.push({id:'no-section-variation',fired:interior.length>=6&&plan.levels.length===1&&spread<=1.5,evidence:`${interior.length} interior rooms share one level; envelope tops span only ${f2(spread)} m (${heights.size} distinct heights); roof forms: ${forms.join(', ')||'none'}.`});
 out.push({id:'single-level',fired:plan.levels.length===1&&interior.length>=8,evidence:`${plan.levels.length} level(s) for ${interior.length} interior rooms. A single level is not a defect on its own; this only contributes when combined with other signals.`});
 const dark=interior.filter(r=>r.windows===0),darkArea=dark.reduce((n,r)=>n+r.areaM2,0),totalArea=interior.reduce((n,r)=>n+r.areaM2,0)||1;
 out.push({id:'unlit-interiors',fired:darkArea/totalArea>=.4,evidence:`${dark.length} of ${interior.length} interior rooms (${Math.round(100*darkArea/totalArea)}% of interior area) have no window${dark.length?`: ${dark.map(r=>r.id).join(', ')}`:''}.`});
 const all=Object.values(rects),bx=Math.min(...all.map(r=>r.x)),bX=Math.max(...all.map(r=>r.x+r.width)),bz=Math.min(...all.map(r=>r.z)),bZ=Math.max(...all.map(r=>r.z+r.depth)),box=(bX-bx)*(bZ-bz),fp=all.reduce((n,r)=>n+area(r),0);
 out.push({id:'unarticulated-footprint',fired:fp/box>=.75&&plan.levels.length===1,evidence:`Allocated cells fill ${Math.round(100*Math.min(1,fp/box))}% of their ${f2(bX-bx)}×${f2(bZ-bz)} m bounding rectangle: ${fp/box>=.75?'a compact block with little articulation, courtyard or recess':'an articulated footprint'}.`});
 const gaps:string[]=[];if((metrics.bedroomSpaces??0)>0&&metrics.bathroomSpaces===0)gaps.push('bedrooms without any bathroom or dressing space');
 out.push({id:'programme-gaps',fired:gaps.length>0,evidence:gaps.join('; ')||'No obvious programme gaps among authored uses.'});
 const overhangs=plan.roofs.map(r=>r.overhang??0),varied=new Set(overhangs.filter(o=>o>0)).size;
 out.push({id:'uniform-eaves',fired:overhangs.filter(o=>o>0).length>=Math.max(4,.7*plan.roofs.length)&&plan.roofs.length>=4,evidence:`${overhangs.filter(o=>o>0).length} of ${plan.roofs.length} roofs carry an overhang (${varied} distinct values) irrespective of which edges are exposed.`});
 return out;
}
