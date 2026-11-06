/** Deterministic coordination of hosted openings and wall exposure for architectural-plan-1.
 * What the model declares is a relationship (this room connects to that room; this window looks outdoors).
 * Where that relationship fixes the wall and the position, software derives them here. Nothing is invented:
 * when a relationship does not determine one valid placement the result is a precise problem, never a guess.
 * Explicit sides keep their historical meaning exactly. Pure functions over resolved rectangles. */
import type {Rect} from './plan';
export type Side='south'|'east'|'north'|'west';
export type RequestedSide=Side|'shared'|'exposed';
export const SIDES:Side[]=['south','east','north','west'];
/** Wall thickness the opening must clear on each side of its leaf. */
export const WALL=.18;
/** Distance an aligned opening keeps from the end of the run it is placed in. */
export const EDGE_MARGIN=.25;
const f2=(n:number)=>Number(n.toFixed(2));
/** Directed edge frame matching the compiler: south →+x, east →+z, north →−x, west →−z (counter-clockwise). */
export function edgeOf(r:Rect,side:Side){
 if(side==='south')return {len:r.width,line:r.z,axis:'z' as const,range:[r.x,r.x+r.width] as const,outward:-1};
 if(side==='east')return {len:r.depth,line:r.x+r.width,axis:'x' as const,range:[r.z,r.z+r.depth] as const,outward:1};
 if(side==='north')return {len:r.width,line:r.z+r.depth,axis:'z' as const,range:[r.x,r.x+r.width] as const,outward:1};
 return {len:r.depth,line:r.x,axis:'x' as const,range:[r.z,r.z+r.depth] as const,outward:-1};
}
export type Run={id:string;lo:number;hi:number};
/** Intervals (edge parameter) along `r`'s `side` shared with the given rectangles. */
export function sharedRuns(r:Rect,side:Side,others:{id:string;rect:Rect}[]):Run[]{
 const e=edgeOf(r,side),out:Run[]=[];
 for(const o of others){
  const touch=e.axis==='z'?(side==='south'?o.rect.z+o.rect.depth:o.rect.z):(side==='east'?o.rect.x:o.rect.x+o.rect.width);
  if(Math.abs(touch-e.line)>1e-6)continue;
  const [a,b]=e.axis==='z'?[o.rect.x,o.rect.x+o.rect.width]:[o.rect.z,o.rect.z+o.rect.depth];
  const lo=Math.max(a,e.range[0]),hi=Math.min(b,e.range[1]);if(hi-lo<=1e-6)continue;
  const ts=(side==='south'||side==='east')?[lo-e.range[0],hi-e.range[0]]:[e.range[1]-hi,e.range[1]-lo];
  out.push({id:o.id,lo:ts[0],hi:ts[1]});
 }
 return out.sort((p,q)=>p.lo-q.lo);
}
/** Parts of `[0,len]` not covered by any run. */
export function freeRuns(len:number,runs:Run[]):{lo:number;hi:number}[]{
 const out:{lo:number;hi:number}[]=[];let at=0;
 for(const r of [...runs].sort((a,b)=>a.lo-b.lo)){if(r.lo>at+1e-6)out.push({lo:at,hi:r.lo});at=Math.max(at,r.hi);}
 if(len>at+1e-6)out.push({lo:at,hi:len});
 return out;
}
/** Position of an opening of `width` inside a run [lo,hi] of the directed edge. Over the whole edge this is the
 * historical formula (start = 0.25 m from the corner, end = 0.25 m from the far corner). */
export function placeInRun(alignment:'start'|'centre'|'end',width:number,lo:number,hi:number){
 return alignment==='centre'?(lo+hi)/2:alignment==='start'?lo+width/2+EDGE_MARGIN:hi-width/2-EDGE_MARGIN;
}
const fits=(centre:number,width:number,lo:number,hi:number)=>centre-width/2>=lo+WALL-1e-6&&centre+width/2<=hi-WALL+1e-6;
/** The compiler refuses a door or passage whose centre lies left of a stair flight (west of its axis, plan frame) within the flight's length plus 0.4 m
 * at each end (semantic-building compiler: "left threshold crosses the selected stair flight/void"). Windows are exempt. */
export type StairLike={lower:string;upper:string;width:number;run:number;landing:number};
export type KeepOut={ids:string[];sx:number;halfWidth:number;z0:number;z1:number};
export const stairKeepOuts=(stairs:StairLike[],rects:Record<string,Rect>):KeepOut[]=>stairs.flatMap(st=>{const r=rects[st.lower];if(!r)return [];const sz=r.z+st.landing+.1;return [{ids:[st.lower,st.upper],sx:r.x+r.width/2,halfWidth:st.width/2,z0:sz-.4,z1:sz+st.run+.4}];});
export const crossesFlight=(k:KeepOut,pt:[number,number])=>pt[0]<k.sx-k.halfWidth&&pt[1]>k.z0&&pt[1]<k.z1;
/** Edge-parameter intervals in which an opening centre on `side` of `r` would cross a flight. */
export function forbiddenRuns(r:Rect,side:Side,keep:KeepOut[]):{lo:number;hi:number;stair:KeepOut}[]{
 return keep.flatMap(k=>{
  const e=edgeOf(r,side),left=k.sx-k.halfWidth;
  if(e.axis==='x'){ // east/west: x fixed
   if(!(e.line<left))return [];
   const a=Math.max(k.z0,r.z),b=Math.min(k.z1,r.z+r.depth);if(b<=a)return [];
   return [side==='east'?{lo:a-r.z,hi:b-r.z,stair:k}:{lo:r.z+r.depth-b,hi:r.z+r.depth-a,stair:k}];
  }
  if(!(e.line>k.z0&&e.line<k.z1))return []; // south/north: z fixed
  const b=Math.min(left,r.x+r.width);if(b<=r.x)return [];
  return [side==='south'?{lo:0,hi:b-r.x,stair:k}:{lo:r.x+r.width-b,hi:e.len,stair:k}];
 });
}
export type PortalLike={id:string;host:{space:string;side:RequestedSide};to:string;alignment:'start'|'centre'|'end';width:number;mode:'door'|'open'|'window'};
export type Placed={id:string;requested:RequestedSide;side:Side;centre:number;derived:boolean;/** The run the opening sits in, edge parameter. */run:{lo:number;hi:number};/** Set when the preferred position crossed a stair flight and the opening was moved the least distance that clears it. */movedFrom?:number;/** Explicit side whose whole-edge position missed the shared boundary: the opening was fitted into the run it shares with its target. */refitted?:{from:number};problem?:undefined}
 |{id:string;requested:RequestedSide;side:null;centre:null;derived:boolean;movedFrom?:undefined;refitted?:undefined;problem:string};
/** One exposure summary per edge: what it is shared with and what remains free to the outside. */
export function edgeExposure(rect:Rect,side:Side,others:{id:string;rect:Rect}[]){
 const e=edgeOf(rect,side),shared=sharedRuns(rect,side,others);
 return {side,length:e.len,shared,free:freeRuns(e.len,shared)};
}
const describe=(runs:{lo:number;hi:number}[])=>runs.map(r=>`${f2(r.lo)}..${f2(r.hi)} m`).join(', ');
/** Resolve where one portal sits. `others` are the spaces on the host's level (not including the host). */
export function placePortal(p:PortalLike,host:Rect,rects:Record<string,Rect>,others:{id:string;rect:Rect}[],sameLevel:(id:string)=>boolean,keep:KeepOut[]=[]):Placed{
 const side=p.host.side;
 if(side!=='shared'&&side!=='exposed'){
  const e=edgeOf(host,side),whole=placeInRun(p.alignment,p.width,0,e.len),target=p.to==='exterior'?undefined:rects[p.to];
  const plain:Placed={id:p.id,requested:side,side,centre:whole,derived:false,run:{lo:0,hi:e.len}};
  // A connection to a neighbouring room can only open where the two rooms actually share wall. Over the whole edge the historical position is kept whenever it already
  // lies inside that shared boundary (every plan that compiled before is unchanged); when it does not, the opening is fitted into the shared run, or refused if it cannot fit.
  if(!target||!sameLevel(p.to)||p.mode==='window')return plain;
  const runs=sharedRuns(host,side,[{id:p.to,rect:target}]);
  if(!runs.length||runs.some(r=>fits(whole,p.width,r.lo,r.hi)))return plain;
  const need=p.width+2*WALL,usable=runs.filter(r=>r.hi-r.lo>=need-1e-6);
  if(!usable.length)return {id:p.id,requested:side,side:null,centre:null,derived:false,problem:`${p.host.space} touches ${p.to} along only ${runs.map(r=>`${f2(r.lo)}..${f2(r.hi)} m (${f2(r.hi-r.lo)} m)`).join(', ')} of its ${side} edge (${f2(e.len)} m long), but a ${p.width} m opening needs ${f2(need)} m with ${WALL} m wall margins: it cannot fit the shared boundary. Choose a narrower opening or change the relationship of the two rooms.`};
  if(usable.length>1)return {id:p.id,requested:side,side:null,centre:null,derived:false,problem:`${p.host.space} touches ${p.to} along ${usable.length} separate runs of its ${side} edge (${usable.map(r=>`${f2(r.lo)}..${f2(r.hi)} m`).join('; ')}); the opening could stand in any of them. Use host side "shared" with alignment, or name which run by choosing a different alignment.`};
  const run=usable[0];
  return {id:p.id,requested:side,side,centre:placeInRun(p.alignment,p.width,run.lo,run.hi),derived:false,run:{lo:run.lo,hi:run.hi},refitted:{from:whole}};
 }
 const need=p.width+2*WALL;
 if(side==='shared'){
  if(p.to==='exterior')return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:`host side "shared" needs a target room; this opening goes to the exterior (use "exposed" for a window or an explicit side).`};
  const target=rects[p.to];
  if(!target)return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:`host side "shared" cannot be resolved: target ${p.to} is missing or unresolved.`};
  if(!sameLevel(p.to))return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:`${p.to} is on another level; a stair is required.`};
  const found=SIDES.flatMap(s=>sharedRuns(host,s,[{id:p.to,rect:target}]).map(r=>({side:s,...r})));
  if(!found.length)return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:`${p.host.space} and ${p.to} share no wall, so there is no wall to open between them.`};
  const run=found[0],preferred=placeInRun(p.alignment,p.width,run.lo,run.hi);
  const walk=p.mode==='window'?[]:forbiddenRuns(host,run.side,keep.filter(k=>k.ids.includes(p.host.space)||k.ids.includes(p.to)));
  const range=[run.lo+WALL+p.width/2,run.hi-WALL-p.width/2],blocked=(c:number)=>walk.find(w=>c>w.lo+1e-9&&c<w.hi-1e-9);
  let centre=preferred;
  if(range[0]<=range[1]+1e-6&&blocked(preferred)){
   const options=[range[0],range[1],...walk.flatMap(w=>[w.lo,w.hi])].map(c=>Math.min(Math.max(c,range[0]),range[1])).filter(c=>!blocked(c)).sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||a-b);
   if(!options.length){const w=blocked(preferred)!;return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:`the stair flight beside ${p.host.space} leaves no place for a ${p.width} m opening on its ${run.side} wall shared with ${p.to}: the flight (with 0.4 m clearance) occupies ${f2(w.lo)}..${f2(w.hi)} m of that edge and the shared wall runs ${f2(run.lo)}..${f2(run.hi)} m. Connect through a landing-aligned wall or another room.`};}
   centre=options[0];
   return {id:p.id,requested:side,side:run.side,centre,derived:true,run:{lo:run.lo,hi:run.hi},movedFrom:preferred};
  }
  if(!fits(centre,p.width,run.lo,run.hi))return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:`the wall ${p.host.space} shares with ${p.to} (${run.side} edge, ${f2(run.hi-run.lo)} m) is too short for a ${p.width} m opening, which needs ${f2(need)} m with ${WALL} m wall margins.`};
  return {id:p.id,requested:side,side:run.side,centre,derived:true,run:{lo:run.lo,hi:run.hi}};
 }
 // exposed: a window onto the outside, on the one edge run not shared with any space on the level.
 if(p.to!=='exterior'||p.mode!=='window')return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:`host side "exposed" applies to a fixed window to the exterior only.`};
 const cands=SIDES.flatMap(s=>edgeExposure(host,s,others).free.filter(r=>r.hi-r.lo>=need-1e-6).map(r=>({side:s,...r})));
 if(cands.length===1){const c=cands[0],centre=placeInRun(p.alignment,p.width,c.lo,c.hi);return {id:p.id,requested:side,side:c.side,centre,derived:true,run:{lo:c.lo,hi:c.hi}};}
 const all=SIDES.map(s=>{const x=edgeExposure(host,s,others);return `${s}: ${x.free.length?`exposed ${describe(x.free)}`:'no exposed wall'}${x.shared.length?` (shared with ${[...new Set(x.shared.map(r=>r.id))].join(', ')})`:''}`;}).join('; ');
 return {id:p.id,requested:side,side:null,centre:null,derived:true,problem:cands.length?`host side "exposed" is ambiguous: ${cands.length} exposed runs are wide enough for a ${p.width} m window (${cands.map(c=>`${c.side} ${f2(c.lo)}..${f2(c.hi)} m`).join('; ')}). Name the side.`:`${p.host.space} has no exposed wall wide enough for a ${p.width} m window (needs ${f2(need)} m). Edges: ${all}.`};
}
/** Where each portal of a plan lands, in the compiler's directed-edge frame. */
export function placePortals(plan:{spaces:{id:string;level:string}[];portals:PortalLike[];stairs?:StairLike[]},rects:Record<string,Rect>){
 const keep=stairKeepOuts(plan.stairs??[],rects);
 const levelOf=(id:string)=>plan.spaces.find(s=>s.id===id)?.level;
 const out=new Map<string,Placed>();
 for(const p of plan.portals){
  const host=rects[p.host.space];if(!host)continue;
  const hostLevel=levelOf(p.host.space);
  const others=plan.spaces.filter(s=>s.id!==p.host.space&&s.level===hostLevel&&rects[s.id]).map(s=>({id:s.id,rect:rects[s.id]}));
  out.set(p.id,placePortal(p,host,rects,others,id=>levelOf(id)===hostLevel,keep));
 }
 return out;
}
/** Point (plan frame) and offset along the directed edge for a placed opening. */
export function pointOnEdge(r:Rect,side:Side,centre:number):[number,number]{
 return side==='south'?[r.x+centre,r.z]:side==='north'?[r.x+r.width-centre,r.z+r.depth]:side==='east'?[r.x+r.width,r.z+centre]:[r.x,r.z+r.depth-centre];
}

/** Fascia of the shared pitched-roof builder: 0.1 m thick, 0.28 m deep below the roof underside, just outside the slope envelope. */
export const FASCIA_THICKNESS=.1;
export const FASCIA_DEPTH=.28;
export type RoofForm='flat'|'gable'|'hip';
/** Plan sides on which the builder can put a fascia board: all four for a hip, the two eave edges for a gable (its ridge runs along the longer axis). */
export function fasciaSides(form:RoofForm,r:Rect):Side[]{
 if(form==='flat')return [];
 return form==='hip'?[...SIDES]:r.width>=r.depth?['south','north']:['east','west'];
}
/** Builder-local compass name of a plan side (the builder's north is −z, a plan south edge). */
export const ELEMENT_EDGE:Record<Side,'north'|'east'|'south'|'west'>={south:'north',north:'south',east:'east',west:'west'};
/** Fascia sides that stand clear of every neighbour. A board on an edge another room shares would sit inside the shared wall (the wall is
 * 0.2 m thick, centred on the edge), so that board is not built; this is the one rule shared by the compiler and the diagnosis. An edge shared
 * along any length is shared (a board is one piece). With an overhang of at least the board's thickness the board stands outside the wall, on the
 * eave line, so it is kept and the clash checks judge it against whatever lies beyond. */
export function exposedFascia(form:RoofForm,r:Rect,neighbours:Rect[],overhang:number|Eaves=0):Side[]{
 const eaves=eavesOf(overhang);
 return fasciaSides(form,r).filter(side=>eaves[side]>=FASCIA_THICKNESS-1e-9||sharedRuns(r,side,neighbours.map((rect,i)=>({id:String(i),rect}))).length===0);
}
/** Eave projection beyond the wall, per plan side. One number is the historical uniform overhang. */
export type Eaves=Record<Side,number>;
export const eavesOf=(o:number|Partial<Eaves>):Eaves=>typeof o==='number'?{south:o,east:o,north:o,west:o}:{south:o.south??0,east:o.east??0,north:o.north??0,west:o.west??0};
/** Plan footprints a roof occupies: the slope envelope (rectangle plus the eave on each side) and one thin strip per fascia board outside it. */
export function roofFootprints(r:Rect,overhang:number|Partial<Eaves>,boards:Side[]):{rect:Rect;board:boolean}[]{
 const o=eavesOf(overhang),t=FASCIA_THICKNESS,env:Rect={x:r.x-o.west,z:r.z-o.south,width:r.width+o.west+o.east,depth:r.depth+o.south+o.north};
 const strip:Record<Side,Rect>={
  south:{x:env.x,z:env.z-t,width:env.width,depth:t},north:{x:env.x,z:env.z+env.depth,width:env.width,depth:t},
  west:{x:env.x-t,z:env.z,width:t,depth:env.depth},east:{x:env.x+env.width,z:env.z,width:t,depth:env.depth}};
 return [{rect:env,board:false},...boards.map(side=>({rect:strip[side],board:true}))];
}

/** One roof section whose eaves are to be resolved: a rectangle of wall tops, its pitched/flat form, the authored (uniform) overhang and its height band. */
/** `neighbours`: every other room of the level (what a fascia board may stand against); `walls`: the interior ones, whose walls an eave cannot cross. */
export type EaveSection={key:string;id:string;level:string;joined:ReadonlySet<string>;rect:Rect;form:RoofForm;overhang:number;bottom:number;rise:number;neighbours:Rect[];walls:Rect[]};
export type EaveVolume={id:string;rect:Rect;bottom:number;top:number};
export type EaveTrim={roof:string;side:Side;authored:number;against:string;edge:number};
/** `eaves`: two eaves overlap in open air outside both walls, so neither roof stands against the other. */
export type EaveUnresolved={roof:string;against:string;sides:Side[];message:string;kind?:'eaves'};
const overlapArea=(a:Rect,b:Rect):Rect|null=>{const x=Math.max(a.x,b.x),z=Math.max(a.z,b.z),w=Math.min(a.x+a.width,b.x+b.width)-x,d=Math.min(a.z+a.depth,b.z+b.depth)-z;return w>1e-6&&d>1e-6?{x,z,width:w,depth:d}:null;};
/** The solids a section occupies given its eaves: the slope envelope and the fascia boards that are actually built. */
export function sectionSolids(s:EaveSection,eaves:Eaves){
 const pitched=s.form!=='flat',boards=pitched?exposedFascia(s.form,s.rect,s.neighbours,eaves):[];
 return roofFootprints(s.rect,eaves,boards).map(f=>({rect:f.rect,board:f.board,bottom:f.board?s.bottom-FASCIA_DEPTH:s.bottom,top:f.board?s.bottom:s.bottom+s.rise}));
}
/** Sides of `r` whose eave band (the strip along that wall, between the wall and the eave line) the region `c` lies in. A region only in a corner has none. */
function bandSides(r:Rect,c:Rect):Side[]{
 const alongX=c.x<r.x+r.width-1e-9&&c.x+c.width>r.x+1e-9,alongZ=c.z<r.z+r.depth-1e-9&&c.z+c.depth>r.z+1e-9,out:Side[]=[];
 if(alongX&&c.z<r.z-1e-9)out.push('south');
 if(alongX&&c.z+c.depth>r.z+r.depth+1e-9)out.push('north');
 if(alongZ&&c.x<r.x-1e-9)out.push('west');
 if(alongZ&&c.x+c.width>r.x+r.width+1e-9)out.push('east');
 return out;
}
const cornerSides=(r:Rect,c:Rect):Side[]=>[...(c.z<r.z-1e-9?['south' as Side]:c.z+c.depth>r.z+r.depth+1e-9?['north' as Side]:[]),...(c.x<r.x-1e-9?['west' as Side]:c.x+c.width>r.x+r.width+1e-9?['east' as Side]:[])];
/** Eaves of every roof section: the authored overhang on each side, except that a side whose eave would reach into another roof at the same height or into a
 * neighbouring occupied volume (the clashes the compiler and the diagnosis both reject) is flush instead: an eave of 0 against that wall.
 * It is not a clip: the roof surfaces are built to the resulting eaves, nothing is trimmed afterwards, and every other side keeps the authored overhang.
 * Both parties of a roof/roof clash give way on the side that meets (neither is preferred); a clash that only touches a corner, where either of two sides
 * could give way, is not decided here and is reported as unresolved (the ordinary clash checks then reject it). Pure and order independent. */
export function resolveEaves(sections:EaveSection[],volumes:EaveVolume[]){
 const eaves=new Map(sections.map(s=>[s.key,eavesOf(s.overhang)])),trims:EaveTrim[]=[];
 const trim=(s:EaveSection,side:Side,against:string)=>{
  const e=eaves.get(s.key)!;if(e[side]<=0)return false;
  trims.push({roof:s.id,side,authored:e[side],against,edge:edgeOf(s.rect,side).len});
  e[side]=0;return true;
 };
 let unresolved:EaveUnresolved[]=[];
 for(let round=0;round<64;round++){
  let changed=false;unresolved=[];
  const solids=new Map(sections.map(s=>[s.key,sectionSolids(s,eaves.get(s.key)!)]));
  const clashes=(a:ReturnType<typeof sectionSolids>,b:{rect:Rect;bottom:number;top:number}[])=>a.flatMap(x=>b.flatMap(y=>{const c=overlapArea(x.rect,y.rect);return c&&Math.min(x.top,y.top)-Math.max(x.bottom,y.bottom)>1e-6?[c]:[];}));
  const resolve=(s:EaveSection,c:Rect,against:string,body:Rect)=>{
   const bands=bandSides(s.rect,c),e=eaves.get(s.key)!;
   for(const side of bands){
    const len=edgeOf(s.rect,side).len,pad=(r:{lo:number;hi:number}[])=>r.map(x=>`${f2(x.lo)}..${f2(x.hi)} m`).join(', ');
    if(!sharedRuns(s.rect,side,[{id:against,rect:body}]).length){
     unresolved.push({roof:s.id,against,sides:[side],message:`${s.id}: the ${side} eave (${e[side]} m) reaches ${against}, which does not stand against that wall; a smaller eave there would be a design value, not a flush edge. Choose a smaller overhang or more clearance.`});
     continue;
    }
    // Flush is the one physically meaningful eave against a wall, but a roof edge is one straight eave line: it can be flush along its whole length or project along its whole length.
    const blockers=[...s.walls.map((rect,k)=>({id:`wall${k}`,rect})),...sections.filter(o=>o.key!==s.key&&!s.joined.has(o.id)&&o.level===s.level).map(o=>({id:o.id,rect:o.rect})),{id:against,rect:body}];
    const open=freeRuns(len,sharedRuns(s.rect,side,blockers));
    if(open.length){
     unresolved.push({roof:s.id,against,sides:[side],message:`${s.id}: the ${side} eave (${e[side]} m) cannot reach ${against} but ${against} stands against only part of that ${f2(len)} m edge; ${pad(open)} of it is open. One eave line cannot be flush along part of an edge and project along the rest: give ${s.id} no overhang, or make ${side} edge abut walls along its whole length or none of it.`});
     continue;
    }
    changed=trim(s,side,against)||changed;
   }
   if(!bands.length){
    const corner=cornerSides(s.rect,c).filter(side=>e[side]>0);
    if(corner.length)unresolved.push({roof:s.id,against,sides:corner,message:`${s.id}: the eave at the ${corner.join('/')} corner reaches ${against}, and either ${corner.join(' or ')} side could give way; the overhang cannot be made flush on one side without choosing between them.`});
   }
  };
  for(let i=0;i<sections.length;i++)for(let j=i+1;j<sections.length;j++){
   const a=sections[i],b=sections[j];if(a.key===b.key)continue;
   for(const c of clashes(solids.get(a.key)!,solids.get(b.key)!)){
    // A region inside a body is that body's wall against the other roof's eave; a region inside neither is two eaves meeting in the open.
    const inA=!!overlapArea(c,a.rect),inB=!!overlapArea(c,b.rect);
    if(inB)resolve(a,c,b.id,b.rect);
    if(inA)resolve(b,c,a.id,a.rect);
    if(!inA&&!inB)unresolved.push({roof:a.id,against:b.id,sides:[],kind:'eaves',message:`${a.id} and ${b.id}: their eaves overlap over ${f2(c.width)}×${f2(c.depth)} m outside both walls, so neither roof stands against the other. Choose smaller overhangs or more clearance.`});
   }
  }
  for(const s of sections)for(const v of volumes){
   if(s.joined.has(v.id))continue;
   for(const c of clashes(solids.get(s.key)!,[{rect:v.rect,bottom:v.bottom,top:v.top}]))resolve(s,c,v.id,v.rect);
  }
  if(!changed)break;
 }
 return {eaves,trims,unresolved};
}
