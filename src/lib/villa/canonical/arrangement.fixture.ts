import {canonicalFixture} from './fixture';
import type {ArchitecturalPlan} from './plan';
/** DEVELOPER-AUTHORED FIXTURES ONLY. None is Terra output, and none is evidence that a model composes well:
 * they exercise the arrangement tooling on different parti. Concept fixtures are wing envelopes with no rooms. */
type Side=ArchitecturalPlan['spaces'][number]['placement']['side'];
type Al='start'|'centre'|'end';
export type Wing={id:string;role:string;width:number;depth:number;against:string|null;side?:Side;alignment?:Al;gap?:number;outdoor?:boolean;level?:string};
const blank=(id:string,thesis:string,levels:ArchitecturalPlan['levels']=[{id:'ground',above:null,rise:.2}]):ArchitecturalPlan=>{
 const p=canonicalFixture();
 Object.assign(p,{id,thesis,orientation:0,site:{width:120,depth:120,elevation:0,grade:0,fall:'z'},levels,masses:[],spaces:[],portals:[],stairs:[],roofs:[],screens:[],terraces:[],pools:[],landscape:[]});
 return p;
};
/** A concept: one placeholder envelope per wing, each wing placed against another WING (mass id). */
export function conceptPlan(id:string,thesis:string,wings:Wing[],arrivalWing:string):ArchitecturalPlan{
 const p=blank(id,thesis);
 for(const w of wings){
  p.masses.push({id:w.id,role:w.role});
  p.spaces.push({id:`${w.id}-envelope`,mass:w.id,level:w.level??'ground',use:`wing envelope: ${w.role}`,width:w.width,depth:w.depth,height:3.2,outdoor:w.outdoor??false,
   placement:{relativeTo:w.against,side:w.against===null?'origin':w.side!,alignment:w.alignment??'centre',gap:w.gap??0}});
 }
 p.arrival=`${arrivalWing}-envelope`;
 return p;
}
export const conceptFixtures:Record<string,()=>ArchitecturalPlan>={
 'linear-bar':()=>conceptPlan('concept-linear-bar','One long bar to the south, a smaller offset pavilion and a garden room stepping off its east end.',[
  {id:'bar',role:'living and sleeping bar',width:42,depth:9,against:null},
  {id:'pavilion',role:'detached guest pavilion',width:11,depth:10,against:'bar',side:'north',alignment:'end',gap:6},
  {id:'entry',role:'arrival gate',width:7,depth:5,against:'bar',side:'south',alignment:'start',gap:0},
  {id:'garden-room',role:'open garden room',width:12,depth:8,against:'bar',side:'east',alignment:'start',gap:0,outdoor:true}],'entry'),
 'courtyard-u':()=>conceptPlan('concept-courtyard-u','Three unequal wings embrace a court; the long wing faces the view, the arrival wing closes the fourth side only partly.',[
  {id:'long-wing',role:'living wing',width:30,depth:10,against:null},
  {id:'west-wing',role:'sleeping wing',width:9,depth:22,against:'long-wing',side:'north',alignment:'start',gap:0},
  {id:'east-wing',role:'guest and service wing',width:12,depth:15,against:'long-wing',side:'north',alignment:'end',gap:0},
  {id:'court',role:'open court',width:9,depth:15,against:'west-wing',side:'east',alignment:'start',gap:0,outdoor:true},
  {id:'gate',role:'arrival pavilion',width:6,depth:4,against:'long-wing',side:'south',alignment:'centre',gap:3}],'gate'),
 pinwheel:()=>conceptPlan('concept-pinwheel','Four wings of different lengths turn around a small core; no axis of symmetry.',[
  {id:'core',role:'stair and hall core',width:8,depth:8,against:null},
  {id:'living-arm',role:'living',width:20,depth:9,against:'core',side:'east',alignment:'start'},
  {id:'sleep-arm',role:'sleeping',width:8,depth:18,against:'core',side:'north',alignment:'end'},
  {id:'guest-arm',role:'guest',width:15,depth:7,against:'core',side:'west',alignment:'end'},
  {id:'service-arm',role:'service and arrival',width:7,depth:12,against:'core',side:'south',alignment:'start'}],'service-arm'),
 'spine-and-wings':()=>spineParti({gallery:[8,10],salon:[16,10],hall:[4,20],suite:[10,6]}).wingAnchored,
};
/** The retained parti, parameterised: a spine (entry, gallery, salon) with a private hall on each side. The two forms differ ONLY in what the halls are anchored to. */
export type SpineSizes={gallery:[number,number];salon:[number,number];hall:[number,number];suite:[number,number]};
export function spineParti(s:SpineSizes){
 const make=(wingAnchored:boolean)=>{
  const p=blank(wingAnchored?'spine-wing-anchored':'spine-room-anchored','Developer fixture: spine with a hall of suites on each side.');
  const room=(id:string,mass:string,w:number,d:number,rel:string|null,side:Side,al:Al='centre')=>p.spaces.push({id,mass,level:'ground',use:id,width:w,depth:d,height:3.2,outdoor:false,placement:{relativeTo:rel,side:rel===null?'origin':side,alignment:al,gap:0}});
  p.masses.push({id:'social',role:'entry, gallery and salon'},{id:'east-wing',role:'east suites'},{id:'west-wing',role:'west suites'});
  room('entry','social',10,8,null,'origin');
  room('gallery','social',...s.gallery,'entry','south');
  room('salon','social',...s.salon,'gallery','south');
  const anchor=wingAnchored?'social':'gallery';
  room('east-hall','east-wing',...s.hall,anchor,'east');room('west-hall','west-wing',...s.hall,anchor,'west');
  for(const [side,wing] of [['east','east-wing'],['west','west-wing']] as const)for(const al of ['start','centre','end'] as const)room(`${side}-suite-${al}`,wing,...s.suite,`${side}-hall`,side,al);
  p.arrival='entry';
  return p;
 };
 return {roomAnchored:make(false),wingAnchored:make(true)};
}
/** A small, fully constructible house composed of two wings, the second placed against the first WING. Connected rooms share walls. */
export function twoWingHouse():ArchitecturalPlan{
 const p=blank('two-wing-house','Developer fixture: an entry-and-living wing with a bedroom wing set against it, a lawn against the sleeping wing.');
 const r=(id:string,mass:string,w:number,d:number,rel:string|null,side:Side,al:Al='centre',outdoor=false)=>p.spaces.push({id,mass,level:'ground',use:id,width:w,depth:d,height:3.2,outdoor,placement:{relativeTo:rel,side:rel===null?'origin':side,alignment:al,gap:0}});
 p.masses.push({id:'entry-wing',role:'entry and living'},{id:'sleep-wing',role:'bedrooms'},{id:'forecourt',role:'arrival'});
 r('foyer','entry-wing',5,6,null,'origin');r('living','entry-wing',9,6,'foyer','east','start');
 r('arrival','forecourt',3,2,'foyer','south','centre',true);
 r('corridor','sleep-wing',3,12,'entry-wing','east','start');r('bed-one','sleep-wing',6,5,'corridor','east','start');r('bed-two','sleep-wing',6,5,'corridor','east','end');
 p.arrival='arrival';
 const door=(id:string,host:string,to:string,mode:'door'|'open'='door',w=1.1)=>p.portals.push({id,host:{space:host,side:'shared'},to,alignment:'centre',width:w,height:2.3,mode});
 p.portals.push({id:'front-door',host:{space:'foyer',side:'south'},to:'arrival',alignment:'centre',width:1.2,height:2.3,mode:'door'});
 door('foyer-living','foyer','living','open',1.4);door('living-corridor','living','corridor');door('corridor-bed-one','corridor','bed-one');door('corridor-bed-two','corridor','bed-two');
 p.portals.push({id:'bed-one-window',host:{space:'bed-one',side:'east'},to:'exterior',alignment:'centre',width:2,height:1.4,mode:'window',sill:.9});
 p.roofs=['foyer','living','corridor','bed-one','bed-two','arrival'].map(space=>({space,form:'flat' as const,rise:.2}));
 p.landscape=[{id:'sleep-lawn',kind:'lawn',placement:{relativeTo:'sleep-wing',side:'south',alignment:'centre',gap:2},width:12,depth:6}];
 return p;
}
