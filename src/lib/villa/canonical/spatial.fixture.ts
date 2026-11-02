import type {ArchitecturalPlan} from './plan';
import {resolveLayout} from './layout';
import {coverOf} from '../experimental/semantic-building/vertical';
import {placePortals} from './coordination';
/** DEVELOPER-AUTHORED FIXTURES ONLY. None is Terra output and none is evidence that a model composes well or
 * that any of these houses is beautiful. They exercise whole-building coordination on different arrangements.
 * `build` is a test-authoring convenience: it writes ordinary architectural-plan-1 data (wings with placements,
 * rooms, doors, roofs) and adds nothing at compile time. */
type Side='north'|'east'|'south'|'west'|'same';
type Al='start'|'centre'|'end';
export type Rel={to:string;side:Side;al?:Al;gap?:number};
export type RoomSpec={id:string;w:number;d:number;at?:Rel;use?:string;level?:string;outdoor?:boolean;h?:number};
export type WingSpec={id:string;role:string;at?:Rel;rooms:RoomSpec[]};
export type HouseSpec={id:string;thesis:string;site?:[number,number];levels?:{id:string;above:string|null;rise:number}[];wings:WingSpec[];arrival:string;
 doors:[string,string,number?,('door'|'open')?][];stairs?:{id:string;lower:string;upper:string}[];pools?:ArchitecturalPlan['pools'];landscape?:ArchitecturalPlan['landscape'];
 constraints?:ArchitecturalPlan['constraints'];orientation?:number;terraces?:string[];roofRise?:number};
const place=(r:Rel|undefined)=>r?{relativeTo:r.to,side:r.side,alignment:r.al??'start',gap:r.gap??0}:{relativeTo:null,side:'origin' as const,alignment:'centre' as const,gap:0};
/** Rooms and wings only (no doors, roofs or windows): enough to resolve and measure an arrangement. */
export function skeleton(spec:HouseSpec):ArchitecturalPlan{
 const levels=spec.levels??[{id:'ground',above:null,rise:.2},{id:'upper',above:'ground',rise:3.2}];
 const plan:ArchitecturalPlan={version:'architectural-plan-1',id:spec.id,thesis:spec.thesis,orientation:spec.orientation??0,
  site:{width:spec.site?.[0]??120,depth:spec.site?.[1]??120,elevation:0,grade:0,fall:'z'},levels,
  masses:spec.wings.map(w=>({id:w.id,role:w.role,...(w.at?{placement:place(w.at)}:{})})),
  spaces:spec.wings.flatMap(w=>w.rooms.map((r,i)=>({id:r.id,mass:w.id,level:r.level??'ground',use:r.use??r.id,width:r.w,depth:r.d,height:r.h??((r.level??'ground')==='ground'?3.2:2.9),outdoor:r.outdoor??false,
   // the first room of a wing is its local origin; the first room of the unplaced wing is the plan's root
   placement:place(i===0&&!r.at?undefined:r.at)}))),
  portals:[],stairs:[],arrival:spec.arrival,roofs:[],screens:[],terraces:spec.terraces??[],pools:spec.pools??[],landscape:spec.landscape??[],
  materials:{floor:'limestone',wall:'ivory',roof:'timber'},cameraViews:['Aerial','Arrival','Garden','Poolside'],...(spec.constraints?{constraints:spec.constraints}:{})};
 return plan;
}
export function build(spec:HouseSpec):ArchitecturalPlan{
 const plan=skeleton(spec),levels=plan.levels;
 for(const [a,b,width=1.2,mode='door'] of spec.doors)plan.portals.push({id:`${a}-${b}`,host:{space:a,side:'shared'},to:b,alignment:'centre',width,height:2.3,mode});
 for(const st of spec.stairs??[])plan.stairs.push({id:st.id,lower:st.lower,upper:st.upper,width:1.1,run:4.8,landing:1.1,headroom:2.1});
 // Roofs follow the physical rule: every exposed interior top is roofed (flat); a fully covered one is not. Windows go where exactly one exposed run fits.
 const {rects}=resolveLayout(plan);
 const tops=new Map<string,number>();const top=(id:string):number=>{const l=levels.find(x=>x.id===id)!;if(tops.has(id))return tops.get(id)!;const v=(l.above?top(l.above):0)+l.rise;tops.set(id,v);return v;};
 const polys=plan.spaces.map(s=>{const r=rects.get(s.id)!;return {id:s.id,level:s.level,polygon:[[r.x,r.z],[r.x+r.width,r.z],[r.x+r.width,r.z+r.depth],[r.x,r.z+r.depth]] as [number,number][]};});
 for(const s of plan.spaces){
  if(s.outdoor)continue;
  const cover=coverOf(polys.find(p=>p.id===s.id)!,polys,top);
  if(cover.state!=='full')plan.roofs.push({space:s.id,form:'flat',rise:spec.roofRise??.22});
 }
 for(const s of plan.spaces){
  if(s.outdoor)continue;
  const probe={id:`${s.id}-window`,host:{space:s.id,side:'exposed' as const},to:'exterior',alignment:'centre' as const,width:2,height:1.4,mode:'window' as const,sill:.9};
  const placed=placePortals({spaces:plan.spaces,portals:[probe],stairs:plan.stairs},Object.fromEntries(rects)).get(probe.id);
  if(placed&&placed.problem===undefined)plan.portals.push(probe);
 }
 return plan;
}

// ───────── distinct arrangements ─────────
const pool=(id:string,to:string,side:Side,w:number,d:number,gap=1,al:Al='centre'):ArchitecturalPlan['pools'][number]=>({id,placement:{relativeTo:to,side,alignment:al,gap},width:w,depth:d,waterDepth:1.4,level:'ground'});
const lawn=(id:string,to:string,side:Side,w:number,d:number,gap=1,al:Al='centre'):ArchitecturalPlan['landscape'][number]=>({id,kind:'lawn',placement:{relativeTo:to,side,alignment:al,gap},width:w,depth:d});

/** 1. Compact family home: four wings, one level, a covered terrace and a lawn. A wing's envelope includes its outdoor rooms, so approach and terrace are wings of their own. */
export const compactFamilyHome=()=>build({id:'compact-family',thesis:'Developer fixture: a compact single-storey home. Living wing at the street, a bedroom wing set against its rear, a terrace and a porch each a wing of their own.',site:[60,60],levels:[{id:'ground',above:null,rise:.2}],
 wings:[
  {id:'living',role:'entry and living',rooms:[{id:'entry',w:4,d:5},{id:'living-room',w:8,d:7,at:{to:'entry',side:'east',al:'start'}},{id:'kitchen',w:5,d:5,at:{to:'living-room',side:'east',al:'start'}}]},
  {id:'approach',role:'porch',at:{to:'living',side:'south',al:'start'},rooms:[{id:'porch',w:4,d:2,outdoor:true}]},
  {id:'sleeping',role:'bedrooms',at:{to:'living',side:'north',al:'start'},rooms:[{id:'hall',w:11,d:2.4},{id:'bed-one',w:4.4,d:4,at:{to:'hall',side:'north',al:'start'}},{id:'bed-two',w:3.6,d:4,at:{to:'bed-one',side:'east',al:'start'}},{id:'bath',w:3,d:2.8,at:{to:'bed-two',side:'east',al:'start'}}]},
  {id:'terrace',role:'outdoor room',at:{to:'living',side:'south',al:'centre'},rooms:[{id:'deck',w:8,d:4,outdoor:true}]},
 ],arrival:'porch',terraces:['deck'],
 doors:[['entry','porch'],['entry','living-room',1.8,'open'],['living-room','kitchen',1.4,'open'],['living-room','hall'],['hall','bed-one'],['hall','bed-two'],['hall','bath',.9],['living-room','deck',2.4]],
 landscape:[lawn('front-lawn','terrace','south',14,6,1)]});

/** 2. Asymmetric multilevel residence: a two-level stair core, a low living wing beside it, an upper bedroom wing stacked over the living wing, and a studio across a garden walk. */
export const asymmetricMultilevel=()=>build({id:'asymmetric-multilevel',thesis:'Developer fixture: a tall entry-and-stair wing, a living wing offset beside it, an upper bedroom wing that rides over the living wing, and a studio reached over an outdoor walk.',site:[90,80],
 levels:[{id:'ground',above:null,rise:.2},{id:'upper',above:'ground',rise:3.2}],
 wings:[
  {id:'core',role:'entry and stair',rooms:[{id:'stair-hall',w:3.2,d:8.4,h:3.2},{id:'gallery',w:3.2,d:8.4,level:'upper',at:{to:'stair-hall',side:'same'}}]},
  {id:'approach',role:'forecourt',at:{to:'core',side:'south',al:'centre'},rooms:[{id:'forecourt',w:5,d:3,outdoor:true}]},
  {id:'living',role:'living and dining',at:{to:'core',side:'east',al:'start'},rooms:[{id:'salon',w:11,d:8.4},{id:'dining',w:6,d:8.4,at:{to:'salon',side:'east',al:'start'}}]},
  {id:'sleeping',role:'bedrooms over the living wing',at:{to:'living',side:'same',al:'start'},rooms:[{id:'suite-a',w:11,d:8.4,level:'upper',h:2.9},{id:'suite-b',w:6,d:8.4,level:'upper',at:{to:'suite-a',side:'east',al:'start'},h:2.9}]},
  {id:'walk',role:'garden walk',at:{to:'living',side:'north',al:'end'},rooms:[{id:'garden-walk',w:2.4,d:3,outdoor:true}]},
  {id:'studio',role:'garden studio',at:{to:'walk',side:'north',al:'end'},rooms:[{id:'studio-room',w:7,d:5},{id:'studio-deck',w:3,d:5,outdoor:true,at:{to:'studio-room',side:'west',al:'start'}}]},
 ],arrival:'forecourt',
 doors:[['stair-hall','forecourt',1.4],['stair-hall','salon',1.6,'open'],['salon','dining',2,'open'],['gallery','suite-a'],['suite-a','suite-b'],['dining','garden-walk',1.2],['garden-walk','studio-room',1.2],['studio-room','studio-deck',2]],
 stairs:[{id:'main-stair',lower:'stair-hall',upper:'gallery'}],
 pools:[pool('lap-pool','forecourt','south',9,3.4,3,'start')]});

/** 3. Courtyard: south range, west and east ranges, a north range closing the court; the court is a wing placed between them. */
export const courtyardHouse=()=>build({id:'courtyard-house',thesis:'Developer fixture: four ranges around a court. The court is a wing of its own; whether it is truly enclosed is declared and measured.',site:[100,100],levels:[{id:'ground',above:null,rise:.2}],
 wings:[
  {id:'south-range',role:'entry range',rooms:[{id:'hall',w:8,d:7},{id:'dining',w:8,d:7,at:{to:'hall',side:'east',al:'start'}},{id:'lounge',w:8,d:7,at:{to:'dining',side:'east',al:'start'}}]},
  {id:'approach',role:'gate',at:{to:'south-range',side:'south',al:'start'},rooms:[{id:'gate',w:4,d:2,outdoor:true,at:undefined}]},
  {id:'west-range',role:'sleeping range',at:{to:'south-range',side:'north',al:'start'},rooms:[{id:'west-hall',w:6,d:2.4},{id:'west-bed-one',w:6,d:5,at:{to:'west-hall',side:'north',al:'start'}},{id:'west-bed-two',w:6,d:5,at:{to:'west-bed-one',side:'north',al:'start'}}]},
  {id:'court',role:'open court',at:{to:'south-range',side:'north',al:'centre'},rooms:[{id:'court-yard',w:12,d:12.4,outdoor:true}]},
  {id:'east-range',role:'guest range',at:{to:'south-range',side:'north',al:'end'},rooms:[{id:'east-hall',w:6,d:2.4},{id:'east-bed-one',w:6,d:5,at:{to:'east-hall',side:'north',al:'end'}},{id:'east-bed-two',w:6,d:5,at:{to:'east-bed-one',side:'north',al:'end'}}]},
  {id:'north-range',role:'library and studio range',at:{to:'court',side:'north',al:'centre'},rooms:[{id:'library',w:12,d:6},{id:'studio',w:6,d:6,at:{to:'library',side:'west',al:'start'}},{id:'study',w:6,d:6,at:{to:'library',side:'east',al:'start'}}]},
 ],arrival:'gate',terraces:['court-yard'],
 doors:[['hall','gate',1.4],['hall','dining',2,'open'],['dining','lounge',2,'open'],['dining','court-yard',3],['hall','west-hall',1.2],['west-hall','west-bed-one'],['west-bed-one','west-bed-two'],['lounge','east-hall',1.2],['east-hall','east-bed-one'],['east-bed-one','east-bed-two'],['library','studio',1.4],['library','study',1.4],['library','court-yard',3],['west-bed-two','studio',1],['east-bed-two','study',1]],
 constraints:[{id:'court-enclosed',kind:'enclose',a:'court-yard',amount:.9,reason:'the court must read as a room of the house, closed on all four sides'}]});

/** 4. Multi-wing luxury estate: great house, owner wing, linked guest pavilion, detached spa pavilion on an outdoor path, with privacy and adjacency declared. */
export const luxuryEstate=()=>build({id:'luxury-estate',thesis:'Developer fixture: a great house with an owner wing at its east, a guest pavilion reached by a link from the kitchen, a detached spa pavilion down a garden path.',site:[170,130],
 levels:[{id:'ground',above:null,rise:.2},{id:'upper',above:'ground',rise:3.4}],
 wings:[
  {id:'great-house',role:'salons, dining and kitchen',rooms:[{id:'grand-hall',w:12,d:10,h:4.2},{id:'salon',w:16,d:10,at:{to:'grand-hall',side:'east',al:'start'},h:4.2},{id:'dining',w:10,d:10,at:{to:'salon',side:'east',al:'start'},h:4.2},{id:'kitchen',w:12,d:7,at:{to:'dining',side:'north',al:'end'},h:4.2}]},
  {id:'forecourt',role:'arrival drive',at:{to:'great-house',side:'south',al:'start'},rooms:[{id:'drive',w:12,d:5,outdoor:true}]},
  {id:'loggia',role:'loggia',at:{to:'salon',side:'south',al:'start'},rooms:[{id:'loggia-room',w:16,d:4,outdoor:true}]},
  {id:'owner-wing',role:'owner suite, two levels',at:{to:'great-house',side:'east',al:'start'},rooms:[{id:'owner-lobby',w:6,d:10,h:3.4},{id:'owner-suite',w:12,d:10,at:{to:'owner-lobby',side:'east',al:'start'},h:3.4},{id:'owner-retreat',w:12,d:10,level:'upper',at:{to:'owner-suite',side:'same'},h:3}]},
  {id:'link',role:'gallery link to the guest pavilion',at:{to:'great-house',side:'north',al:'end'},rooms:[{id:'link-gallery',w:4,d:12,h:3.2}]},
  {id:'guest-pavilion',role:'guest suites',at:{to:'link',side:'north',al:'centre'},rooms:[{id:'guest-lounge',w:10,d:8,h:3.2},{id:'guest-suite-one',w:7,d:8,at:{to:'guest-lounge',side:'west',al:'start'},h:3.2},{id:'guest-suite-two',w:7,d:8,at:{to:'guest-lounge',side:'east',al:'start'},h:3.2}]},
  {id:'spa-path',role:'garden path',at:{to:'owner-wing',side:'south',al:'start'},rooms:[{id:'path',w:4,d:14,outdoor:true}]},
  {id:'spa',role:'detached spa pavilion',at:{to:'spa-path',side:'south',al:'start'},rooms:[{id:'spa-room',w:10,d:7,h:3.2}]},
 ],arrival:'drive',terraces:['loggia-room'],
 doors:[['grand-hall','drive',2.4],['grand-hall','salon',3,'open'],['salon','dining',3,'open'],['dining','kitchen',1.4],['dining','owner-lobby',1.6],['owner-lobby','owner-suite',1.4,'open'],['salon','loggia-room',4],['kitchen','link-gallery',1.2],['link-gallery','guest-lounge',1.6],['guest-lounge','guest-suite-one'],['guest-lounge','guest-suite-two'],['owner-lobby','path',1.2],['path','spa-room',1.2]],
 stairs:[{id:'owner-stair',lower:'owner-suite',upper:'owner-retreat'}],
 constraints:[
  {id:'guests-private',kind:'separate',a:'guest-pavilion',b:'owner-wing',amount:18,reason:'guests and owners should not overlook each other'},
  {id:'link-meets-house',kind:'adjoin',a:'link',b:'great-house',amount:2.4,reason:'the link must be able to open from the house'},
  {id:'link-meets-guests',kind:'adjoin',a:'link',b:'guest-pavilion',amount:2.4,reason:'and into the guest lounge'},
 ],
 pools:[pool('infinity-pool','spa','west',16,6,3,'start')]});

// ───────── generator for collision-class sweeps ─────────
export const SWEEP_SIDES=['north','east','south','west'] as const;
const lcg=(seed:number)=>()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
/** The SAME architectural decisions (which wing stands on which side of a two-room core, its alignment, its sizes) expressed two ways:
 * `rooms` = each wing's first room is placed against a core room (the historical idiom); `wings` = the wing is placed against the core wing's envelope. */
export function sweepParti(seed:number,form:'rooms'|'wings',allowedSides:readonly (typeof SWEEP_SIDES)[number][]):ArchitecturalPlan{
 const rnd=lcg(seed),pick=(a:number,b:number)=>Math.round((a+rnd()*(b-a))*2)/2,als=['start','centre','end'] as const;
 const core=[{id:'c1',w:pick(8,12),d:pick(6,9)},{id:'c2',w:pick(6,10),d:pick(6,9)}];
 const wings:HouseSpec['wings']=[{id:'core',role:'core',rooms:[{id:'c1',w:core[0].w,d:core[0].d},{id:'c2',w:core[1].w,d:core[1].d,at:{to:'c1',side:'east',al:'start'}}]}];
 for(const side of allowedSides){
  if(rnd()<.2)continue;
  const al=als[Math.floor(rnd()*3)],first=`${side}-a`,w0=pick(4,10),d0=pick(4,10),horizontal=side==='north'||side==='south';
  const second={id:`${side}-b`,w:pick(4,12),d:pick(4,12),at:{to:first,side:(horizontal?'east':'north') as 'east'|'north',al:'start' as const}};
  const rooms=[{id:first,w:w0,d:d0,...(form==='rooms'?{at:{to:side==='east'?'c2':'c1',side,al}}:{})},second];
  wings.push({id:`${side}-wing`,role:side,...(form==='wings'?{at:{to:'core',side,al}}:{}),rooms});
 }
 return skeleton({id:`sweep-${form}`,thesis:'sweep',site:[400,400],levels:[{id:'ground',above:null,rise:.2}],arrival:'c1',doors:[],wings});
}
