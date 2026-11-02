/** Shared construction kernel for canonical Generate and retained offline pilots.
 * Metres, selected convex polygons,
 * segmented collinear adjacency; no packing, aesthetic optimizer or silent repairs. */
import {elementSchema, applySceneOperations, type ArchitecturalScene, type SceneElement, type SceneOperation} from '../../scene/model';
import {straightStairOperations} from '../../scene/assemblies';
import {sceneSpatialGeometry} from '../../scene/spatial';
import {validateProfile} from '../../scene/profileGeometry';
import {coverOf,exposedPieces,minimumWidth,clipConvex,polygonArea} from './vertical';
export type Point = [number,number];
export type Space = {id:string; mass:string; level:string; use:string; polygon:Point[]; height:number; outdoor?:boolean; roof?:boolean; material?:SceneElement['material']};
export type Portal = {id:string; host:{space:string;edge:number}; to:string; offset:number; width:number; height:number; mode:'door'|'open'|'window'; sill?:number};
export type Stair = {id:string; lower:string; upper:string; start:Point; width:number; run:number; risers:number; landing:number; headroom:number; bypass:'right'};
export type BuildingIntent = {version:'semantic-pilot-1'; id:string; thesis:string; frame:{origin:Point;yaw:number}; levels:{id:string;top:number}[]; masses:{id:string;role:string; relatesTo?:string}[]; spaces:Space[]; portals:Portal[]; stairs:Stair[]; arrival:string; requiredAccess:string[]};
export type Boundary = {id:string;a:Point;b:Point;spaces:string[];level:string};
export class DesignConflict extends Error { constructor(public decisions:string[]){super(decisions.join('\n'));} }
const eps=1e-7,wallThickness=.18,wall=wallThickness;
const span=(poly:Point[])=>{const x=poly.map(p=>p[0]),z=poly.map(p=>p[1]),f=(n:number)=>Number(n.toFixed(2));return `x ${f(Math.min(...x))}..${f(Math.max(...x))}, z ${f(Math.min(...z))}..${f(Math.max(...z))} m`;};
const near=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1])<eps;
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export const pointIn=(p:Point,poly:Point[],margin=0)=>poly.every((a,i)=>cross(a,poly[(i+1)%poly.length],p)>=margin*Math.hypot(poly[(i+1)%poly.length][0]-a[0],poly[(i+1)%poly.length][1]-a[1])-eps);
const edges=(s:Space)=>s.polygon.map((a,i)=>({a,b:s.polygon[(i+1)%s.polygon.length],i}));
function overlap(a:Point[],b:Point[]) {return [a,b].every(poly=>poly.every((p,i)=>{const q=poly[(i+1)%poly.length],n=[q[1]-p[1],p[0]-q[0]];const aa=a.map(v=>v[0]*n[0]+v[1]*n[1]),bb=b.map(v=>v[0]*n[0]+v[1]*n[1]);return Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))>eps;}));}
export function compileBuilding(intent:BuildingIntent) {
 const fail=(message:string):never=>{throw new DesignConflict([message]);};
 if(intent.version!=='semantic-pilot-1')fail('Unsupported semantic version; select a migration.');
 const finite=(v:unknown):boolean=>typeof v==='number'?Number.isFinite(v):Array.isArray(v)?v.every(finite):v&&typeof v==='object'?Object.values(v).every(finite):true;
 if(!finite(intent))fail('Nonfinite design value; provide explicit finite dimensions.');
 const identifiers=[...intent.levels,...intent.masses,...intent.spaces,...intent.portals,...intent.stairs].map(x=>x.id);
 if(new Set(identifiers).size!==identifiers.length)fail('Semantic IDs must be unique across entity types.');
 if(identifiers.some(id=>!/^[a-z][a-z0-9-]{0,39}$/.test(id)))fail('Select short stable semantic IDs.');
 const levels=new Map(intent.levels.map(l=>[l.id,l.top])), spaces=new Map(intent.spaces.map(s=>[s.id,s]));
 const level=(s:Space)=>levels.get(s.level)??fail(`${s.id}: select an existing level.`);
 const space=(id:string)=>spaces.get(id)??fail(`${id}: select an existing space.`);
 for(const m of intent.masses){if(m.relatesTo&&!intent.masses.some(n=>n.id===m.relatesTo))fail(`${m.id}: missing related mass.`);}
 for(const s of intent.spaces){
  level(s);if(!intent.masses.some(m=>m.id===s.mass))fail(`${s.id}: missing mass.`);
  if(!((s.outdoor&&!s.roof?s.height>0:s.height>=2.4)&&s.height<=8))fail(`${s.id}: choose a supported height (interior 2.4–8m; outdoor positive and <=8m).`);
  if(s.polygon.length<3||s.polygon.some((p,i)=>cross(p,s.polygon[(i+1)%s.polygon.length],s.polygon[(i+2)%s.polygon.length])<=eps))fail(`${s.id}: pilot requires strictly convex counterclockwise polygons; decompose concave space explicitly.`);
 }
 const conflicts:string[]=[];
 for(let i=0;i<intent.spaces.length;i++)for(let j=i+1;j<intent.spaces.length;j++){
  const a=intent.spaces[i],b=intent.spaces[j];
  const penetration=Math.min(level(a)+a.height,level(b)+b.height)-Math.max(level(a),level(b));
  if(overlap(a.polygon,b.polygon)&&penetration>eps){
   // Report every clash with its cause; nothing is repositioned or tolerated.
   const [lower,upper]=level(a)<=level(b)?[a,b]:[b,a];
   const cause=level(lower)<level(upper)?` ${lower.id} (level ${lower.level}, height ${lower.height}m) rises ${penetration.toFixed(2)}m above the ${upper.level} floor datum under ${upper.id}: omit its height so it is derived from the level datums, remove the stacked space, or make a roofed double-height room with nothing stacked above.`:` same-level footprints intersect: ${a.id} spans ${span(a.polygon)}, ${b.id} spans ${span(b.polygon)}; they share ${span(clipConvex(a.polygon,b.polygon))}. Revise outlines or placement.`;
   conflicts.push(`${a.id}/${b.id}: occupied volumes overlap (${penetration.toFixed(2)}m vertical).${cause}`);
  }
 }
 // A roof is the cover of a space whose top is exposed. A fully covered space has none (the floor
 // above is its cover). Where the space is only partly covered, the roof is the exposed remainder:
 // derived exactly from the footprints above and never from a trimmed or moved room.
 const verticals=intent.spaces.map(s=>({id:s.id,level:s.level,polygon:s.polygon}));
 const roofPieces=new Map<string,Point[][]>(),partialRoofs:Record<string,string[]>={};
 for(const lower of intent.spaces){
  if(!lower.roof)continue;
  const cover=coverOf({id:lower.id,level:lower.level,polygon:lower.polygon},verticals,id=>levels.get(id)!);
  if(cover.state==='none'||cover.datum!>=level(lower)+lower.height+.3)continue;
  if(cover.state==='full'){conflicts.push(`${lower.id}: roof conflicts with upper occupancy: it is fully covered by ${cover.by.join(', ')} (${cover.level} floor), which is its cover. Omit this roof.`);continue;}
  const pieces=exposedPieces({id:lower.id,level:lower.level,polygon:lower.polygon},verticals,cover),thin=pieces.find(piece=>minimumWidth(piece)<wallThickness);
  if(thin)conflicts.push(`${lower.id}: roof conflicts with upper occupancy: the exposed remainder beside ${cover.by.join(', ')} is only ${minimumWidth(thin).toFixed(2)}m wide, too narrow to carry a roof on a ${wallThickness}m wall. Align the upper edge with the wall (full cover, no roof) or give the remainder usable width.`);
  else{roofPieces.set(lower.id,pieces);partialRoofs[lower.id]=cover.by;}
 }
 if(conflicts.length)throw new DesignConflict(conflicts);
 // Split authored edges only at physical junctions and between selected openings.
 // This changes construction topology, never room outlines or design placement.
 const raw=intent.spaces.flatMap(s=>edges(s).map(e=>({...e,space:s.id,level:s.level})));
 const portalPoint=(p:Portal):Point=>{
  const e=edges(space(p.host.space))[p.host.edge];if(!e)fail(`${p.id}: missing host edge.`);
  const len=Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1]);
  if(p.offset-p.width/2<.18||p.offset+p.width/2>len-.18)fail(`${p.id}: opening exceeds original host margins.`);
  return [e.a[0]+(e.b[0]-e.a[0])*p.offset/len,e.a[1]+(e.b[1]-e.a[1])*p.offset/len];
 };
 const centres=new Map(intent.portals.map(p=>[p.id,portalPoint(p)]));
 const boundaries:Boundary[]=[],portalHosts=new Map<string,Boundary>();
 for(const e of raw){
  const dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],len=Math.hypot(dx,dz);
  const t=(p:Point)=>((p[0]-e.a[0])*dx+(p[1]-e.a[1])*dz)/len;
  const collinear=(p:Point)=>Math.abs(cross(e.a,e.b,p))<eps;
  const cuts=[0,len];
  for(const other of raw.filter(r=>r.level===e.level)){
   if(!collinear(other.a)||!collinear(other.b))continue;
   for(const pt of [other.a,other.b])if(t(pt)>eps&&t(pt)<len-eps)cuts.push(t(pt));
  }
  const ps=intent.portals.filter(p=>{
   const pe=raw.find(r=>r.space===p.host.space&&r.i===p.host.edge)!;
   return pe.level===e.level&&collinear(pe.a)&&collinear(pe.b);
  }).sort((a,b)=>t(centres.get(a.id)!)-t(centres.get(b.id)!));
  for(let i=1;i<ps.length;i++){
   const points=[centres.get(ps[i-1].id)!,centres.get(ps[i].id)!];
   if(!raw.some(r=>r.level===e.level&&points.every(p=>Math.abs(cross(r.a,r.b,p))<eps&&(p[0]-r.a[0])*(p[0]-r.b[0])+(p[1]-r.a[1])*(p[1]-r.b[1])<-eps)))continue;
   const left=t(centres.get(ps[i-1].id)!)+ps[i-1].width/2,right=t(centres.get(ps[i].id)!)-ps[i].width/2;
   if(right-left<.36-eps)fail(`${ps[i-1].id}/${ps[i].id}: overlapping openings or insufficient pier.`);
   const cut=(left+right)/2;if(cut>eps&&cut<len-eps)cuts.push(cut);
  }
  const sorted=[...new Set(cuts.map(v=>Math.round(v/eps)*eps))].sort((a,b)=>a-b);
  const at=(v:number):Point=>[e.a[0]+dx*v/len,e.a[1]+dz*v/len];
  for(let i=0;i<sorted.length-1;i++){
   const a=at(sorted[i]),b=at(sorted[i+1]);
   let boundary=boundaries.find(w=>w.level===e.level&&near(w.a,b)&&near(w.b,a));
   if(!boundary){boundary={id:`${e.space}-e${e.i}${sorted.length>2?`-s${i}`:''}`,a,b,spaces:[],level:e.level};boundaries.push(boundary);}
   boundary.spaces.push(e.space);
  }
 }
 for(const p of intent.portals){
  const q=centres.get(p.id)!;
  const matches=boundaries.filter(b=>b.spaces.includes(p.host.space)&&Math.abs(cross(b.a,b.b,q))<eps&&
   (q[0]-b.a[0])*(q[0]-b.b[0])+(q[1]-b.a[1])*(q[1]-b.b[1])<-eps);
  if(matches.length!==1)fail(`${p.id}: opening centre lies on a construction junction.`);
  portalHosts.set(p.id,matches[0]);
 }
 const elements:SceneElement[]=[],provenance:Record<string,{sources:string[];rule:string}>={},portalEvidence:object[]=[],stairEvidence:object[]=[];
 const thickness=.2,roofThickness=.18;
 const world=(p:Point):Point=>[intent.frame.origin[0]+Math.cos(intent.frame.yaw)*p[0]+Math.sin(intent.frame.yaw)*p[1],intent.frame.origin[1]-Math.sin(intent.frame.yaw)*p[0]+Math.cos(intent.frame.yaw)*p[1]];
 const emit=(data:Parameters<typeof elementSchema.parse>[0],sources:string[],rule:string)=>{const e=elementSchema.parse(data);if(provenance[e.id])fail(`Generated ID collision ${e.id}`);elements.push(e);provenance[e.id]={sources,rule};};
 const slab=(id:string,poly:Point[],top:number,kind:'plate'|'roof',holes:Point[][],sources:string[],material:SceneElement['material'])=>{
  const lo=[0,1].map(i=>Math.min(...poly.map(p=>p[i]))),hi=[0,1].map(i=>Math.max(...poly.map(p=>p[i]))),size:SceneElement['size']=[hi[0]-lo[0],kind==='roof'?roofThickness:thickness,hi[1]-lo[1]],c:Point=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2],w=world(c);
  const normalize=(ring:Point[])=>ring.map(p=>[(p[0]-c[0])/size[0],(p[1]-c[1])/size[2]]);
  const geometry={type:'extrusion' as const,axis:'y' as const,outline:normalize(poly),holes:holes.map(normalize)};validateProfile(geometry);
  emit({id,label:id,kind,at:[w[0],top-size[1]/2,w[1]],rotation:intent.frame.yaw,size,material,geometry},sources,'polygon and level → editable profile slab');
 };
 const voids=new Map<string,Point[][]>();
 const graph=new Map(intent.spaces.map(s=>[s.id,[] as string[]]));
 const connect=(a:string,b:string)=>{graph.get(a)!.push(b);graph.get(b)!.push(a);};
 for(const st of intent.stairs){
  const lower=space(st.lower),upper=space(st.upper),rise=level(upper)-level(lower),[x,z]=st.start;
  if(rise<=0||lower.outdoor||upper.outdoor)fail(`${st.id}: select ascending interior levels.`);
  if(Math.abs(lower.height-rise)>eps)fail(`${st.id}: lower envelope height must meet upper floor top; select section explicitly.`);
  if(st.bypass!=='right')fail(`${st.id}: pilot needs an explicit right-side circulation bypass; other configurations unsupported.`);
  if(st.width>4||st.run>20||rise>6||!Number.isInteger(st.risers)||st.risers<1||st.risers>40||rise/st.risers>.2||st.run/st.risers<.25)fail(`${st.id}: select a supported straight flight with riser <=0.2m, going >=0.25m, width <=4m and rise <=6m.`);
  if(st.width<.8||st.landing<1||st.headroom<2)fail(`${st.id}: select width, landing >=1m and headroom >=2m.`);
  const hole:Point[]=[[x-st.width/2-.1,z-.1],[x+st.width/2+.1,z-.1],[x+st.width/2+.1,z+st.run],[x-st.width/2-.1,z+st.run]];
  const footprint:Point[]=[[x-st.width/2-.1,z-st.landing],[x+st.width/2+.1,z-st.landing],[x+st.width/2+.1,z+st.run+st.landing],[x-st.width/2-.1,z+st.run+st.landing]];
  if(!footprint.every(p=>pointIn(p,lower.polygon,wall/2)&&pointIn(p,upper.polygon,wall/2)))fail(`${st.id}: flight, void and landings do not fit both selected spaces; revise stair or boundaries.`);
  if(!upper.roof||(roofPieces.get(lower.id)??(lower.roof?[lower.polygon]:[])).some(piece=>polygonArea(clipConvex(piece,footprint))>eps))fail(`${st.id}: select upper roof as stair cover; lower roof would obstruct flight.`);
  if(upper.height-roofThickness<st.headroom)fail(`${st.id}: insufficient upper roof headroom.`);
  if((voids.get(upper.id)??[]).length)fail(`${st.id}: multiple stair voids in one space unsupported.`);
  voids.set(upper.id,[hole]);connect(lower.id,upper.id);
  const w=world(st.start);
  const ops=straightStairOperations({id:st.id,at:[w[0],level(lower),w[1]],rotation:intent.frame.yaw,material:'limestone',width:st.width,rise,run:st.run,risers:st.risers});
  for(const op of ops)if(op.op==='add')emit(op.element,[st.id,lower.id,upper.id,lower.level,upper.level],'selected flight → existing straight-stair helper');
  stairEvidence.push({id:st.id,rise,riser:rise/st.risers,going:st.run/st.risers,void:hole,lowerLanding:[x,z-st.landing/2],upperLanding:[x,z+st.run+st.landing/2],endpoint:level(upper),minimumHeadroom:upper.height-roofThickness,scope:'entire flight void, flat upper roof, convex landing envelopes; no guards/structure certification'});
 }
 for(const s of intent.spaces){
  slab(`${s.id}-floor`,s.polygon,level(s),'plate',voids.get(s.id)??[],[s.id,s.level,...intent.stairs.filter(st=>st.upper===s.id).map(st=>st.id)],s.outdoor?'limestone':'ivory');
  if(s.roof)(roofPieces.get(s.id)??[s.polygon]).forEach((piece,i)=>slab(i?`${s.id}-roof-${i+1}`:`${s.id}-roof`,piece,level(s)+s.height+roofThickness,'roof',[],[s.id,s.level],s.material??'ivory'));
 }
 for(const b of boundaries){
  const members=b.spaces.map(space),inside=members.filter(s=>!s.outdoor);if(!inside.length)continue;
  if(b.spaces.length>2)fail(`${b.id}: non-manifold boundary.`);
  const h=Math.max(...inside.map(s=>s.height)),top=levels.get(b.level)!;
  // Selected unequal heights produce a shared wall up to the taller cell; roofs remain per cell.
  const dx=b.b[0]-b.a[0],dz=b.b[1]-b.a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(-dz,dx),w=world([(b.a[0]+b.b[0])/2,(b.a[1]+b.b[1])/2]);
  const portals=intent.portals.filter(p=>portalHosts.get(p.id)===b);
  if(portals.length>1)fail(`${b.id}: more than one opening per edge unsupported; choose boundary segmentation.`);
  const p=portals[0];let opening:SceneElement['opening'];
  if(p){
   const from=space(p.host.space),target=p.to==='exterior'?undefined:space(p.to),edge=edges(from)[p.host.edge];
   if(!target&&p.mode!=='window')fail(`${p.id}: unsupported-capability: exterior passage requires an explicit outdoor landing allocation.`);
   if(!edge||(target?(!b.spaces.includes(p.to)||from.id===target.id):b.spaces.length!==1))fail(`${p.id}: selected host is not shared with ${p.to}; choose an intermediary space, do not bridge a gap implicitly.`);
   const q0=centres.get(p.id)!,distance=((q0[0]-b.a[0])*dx+(q0[1]-b.a[1])*dz)/length,sill=p.sill??0;
   if((p.mode!=='window'&&sill!==0)||sill<0||distance-p.width/2<wall-eps||distance+p.width/2>length-wall+eps||sill+p.height>Math.min(...inside.map(s=>s.height))||p.height<(p.mode==='window'?.3:2.1)||p.width<(p.mode==='window'?.3:.8))fail(`${p.id}: opening does not fit with edge margins and walking clearance.`);
   const local=distance-length/2;
   opening={x:local,sill,width:p.width,height:p.height,glazed:p.mode==='window'};
   const x=b.a[0]+dx*(local+length/2)/length,z=b.a[1]+dz*(local+length/2)/length,q=world([x,z]);
   for(const st of intent.stairs)if(p.mode!=='window'&&[st.lower,st.upper].some(id=>id===from.id||id===target?.id)&&x<st.start[0]-st.width/2&&z>st.start[1]-.4&&z<st.start[1]+st.run+.4)fail(`${p.id}: unsupported-capability: left threshold crosses the selected stair flight/void; choose a landing-aligned portal or extend circulation intent.`);
   if(p.mode!=='window'&&target)connect(from.id,target.id);
   if(p.mode==='door')emit({id:p.id,label:p.id,kind:'entrance',at:[q[0],top+p.height/2,q[1]],rotation:yaw+intent.frame.yaw,size:[p.width,p.height,.08],material:'bronze'},[p.id,b.id,from.level],'single host opening → matching door transform');
   portalEvidence.push({id:p.id,host:b.id,from:from.id,to:p.to,local:[x,z],world:[q[0],top,q[1]],width:p.width,height:p.height,passable:p.mode!=='window'&&!!target,sill,floorGap:target?Math.abs(level(from)-level(target)):null,cutPanelError:null});
   // A 0.6m-wide person crosses at the midpoint, with 0.4m landing depth
   // on both sides. Convex rooms provide straight segments to an interior point.
   const nx=-dz/length,nz=dx/length;
   for(const s of p.mode==='window'?[]:[from,...(target?[target]:[])]){
    const side=b.spaces.indexOf(s.id)===0?1:-1;
    for(const t of [-.3,.3]){
     const pt:Point=[x+dx/length*t+nx*side*.4,z+dz/length*t+nz*side*.4];
     if(!pointIn(pt,s.polygon))fail(`${p.id}: threshold lacks supported approach clearance in ${s.id}.`);
     if((voids.get(s.id)??[]).some(hole=>pointIn(pt,hole)))fail(`${p.id}: threshold opens into stair void; revise location.`);
    }
   }
  }
  emit({id:`${b.id}-wall`,label:b.id,kind:'wall',at:[w[0],top+h/2,w[1]],rotation:yaw+intent.frame.yaw,size:[length,h,wall],material:inside[0].material??'ivory',...(opening?{opening}:{})},[b.id,...b.spaces,b.level,...portals.map(p=>p.id)],'one shared boundary → one wall');
 }
 for(const p of intent.portals)if(!portalEvidence.some(e=>(e as {id:string}).id===p.id))fail(`${p.id}: missing or outdoor-only host; select an interior shared boundary.`);
 if(spaces.has('exterior'))fail('exterior is a reserved portal target.');
 space(intent.arrival);const seen=new Set<string>(),visit=(id:string)=>{if(seen.has(id))return;seen.add(id);graph.get(id)!.forEach(visit);};visit(intent.arrival);
 for(const id of intent.requiredAccess){space(id);if(!seen.has(id))fail(`${id}: no passable selected route from ${intent.arrival}; select doors/circulation.`);}
 const operations:SceneOperation[]=elements.map(element=>({op:'add',element}));
 const empty:ArchitecturalScene={version:'architectural-scene-1',name:intent.id,elements:[]};
 const scene=applySceneOperations(empty,operations),g=sceneSpatialGeometry(scene);
 for(const evidence of portalEvidence){
  const e=evidence as {id:string;host:string;cutPanelError:number|null};
  const panel=g.map.get(e.id),wall=g.map.get(`${e.host}-wall`);
  if(panel&&wall?.opening){const p=g.world(panel),w=g.world(wall),o=wall.opening;
   e.cutPanelError=Math.hypot(p[0]-w[0]-Math.cos(w[3])*o.x,p[2]-w[2]+Math.sin(w[3])*o.x,p[1]-panel.size[1]/2-g.bottom(wall));
  }
 }
 const spaceEvidence=intent.spaces.map(s=>{
  const overhead=intent.spaces.filter(other=>level(other)>level(s)&&overlap(s.polygon,other.polygon)).map(other=>level(other)-thickness-level(s));
  const clearHeight=Math.min(s.height,...overhead);
  if(!s.outdoor&&clearHeight<2.4)fail(`${s.id}: overhead slab leaves insufficient clear height; revise level section.`);
  return {id:s.id,floor:`${s.id}-floor`,floorTop:g.top(g.map.get(`${s.id}-floor`)! ),centreY:level(s)+clearHeight/2,envelopeHeight:s.height,clearHeight,boundaries:boundaries.filter(b=>b.spaces.includes(s.id)).map(b=>b.id),note:'derived semantic occupied cell, not a physical solid; overhead floor thickness subtracted'};
 });
 return {compiler:'semantic-pilot-1.1',intent,partialRoofs,roofPieces:Object.fromEntries(roofPieces),scene,operations,provenance,boundaries,portalEvidence,stairEvidence,spaceEvidence,access:{arrival:intent.arrival,reachable:[...seen],scope:'convex cells and proven thresholds; stair cell landing routing additionally reviewed; no general free-space navigation'},completion:{spatial:'bounded proofs only',construction:'editable envelope study; guards, services, engineering and fit-out incomplete',composition:'requires independent visual judgment'}};
}
/** Explicit offline revision transaction: preserve unrelated/manual parts; refuse
 * any procedural overwrite of a changed generated component. No hidden regeneration. */
export function reviseBuilding(previous:ReturnType<typeof compileBuilding>,intent:BuildingIntent,current:ArchitecturalScene){
 const next=compileBuilding(intent),ops:SceneOperation[]=[];
 for(const old of previous.scene.elements){
  const replacement=next.scene.elements.find(e=>e.id===old.id),live=current.elements.find(e=>e.id===old.id);
  if(JSON.stringify(old)===JSON.stringify(replacement))continue;
  if(JSON.stringify(live)!==JSON.stringify(old))throw new DesignConflict([`${old.id}: manual edit conflicts with design revision; choose override/detach or semantic change.`]);
  if(replacement)ops.push({op:'replace',id:old.id,element:replacement});else ops.push({op:'remove',id:old.id});
 }
 for(const e of next.scene.elements)if(!previous.provenance[e.id]){
  if(current.elements.some(p=>p.id===e.id))throw new DesignConflict([`${e.id}: generated ID collides with manual geometry.`]);
  ops.push({op:'add',element:e});
 }
 return {next,operations:ops,scene:applySceneOperations(current,ops)};
}
