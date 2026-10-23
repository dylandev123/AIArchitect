/** Independent, offline relationship-first examples. No production templates. */
import type { RoomLayout } from '../roomLayout';
import { preparePlanEvaluation } from '../architecturalPlanEvaluation';
import { referenceExterior } from './expressiveEstate';

type Node=RoomLayout['nodes'][number];
const leaf=(id:string):Node=>({id:`${id}-leaf`,kind:'room',roomId:id});
const split=(id:string,zone:string,axis:'x'|'z',parts:[string,number][]):Node=>({id,kind:'split',zone,axis,children:parts.map(([node,weight])=>({node,weight}))});
const space=(id:string,program:string)=>({id,label:id.replaceAll('-',' '),program});
const door=(id:string,serves:string,facade='south',start=.44,end=.56)=>({id,type:'door',facade,start,end,serves});

export function relationshipGardenHome(width=12,depth=10,rotationY=0){
 const rooms=[space('garden-living','open-plan living dining'),space('garden-kitchen','kitchen'),space('garden-gallery','circulation gallery'),space('garden-bedroom','bedroom'),space('garden-entry','entry hall'),space('garden-bath','bathroom'),space('garden-utility','utility')];
 const layout:RoomLayout={regions:[{root:'garden-root'}],nodes:[...rooms.map(r=>leaf(r.id)),
  split('garden-root','Public, circulation, private service','z',[['garden-public',4],['garden-gallery-leaf',2],['garden-private',4]]),
  split('garden-public','Garden-facing public rooms','x',[['garden-living-leaf',2],['garden-kitchen-leaf',1]]),
  split('garden-private','Private, arrival, service','x',[['garden-bedroom-leaf',1],['garden-entry-leaf',1],['garden-service',1]]),
  split('garden-service','Wet and service spaces','z',[['garden-bath-leaf',1],['garden-utility-leaf',1]]),
 ]};
 return {format:'v3-architectural-plan-1',concept:'OFFLINE TEST — A modest home with north garden-facing living and cooking, a deliberate cross-gallery and a sheltered central south entry. Relative subdivision is the architectural decision; no independently guessed room rectangles.',
  site:{width:60,depth:60,access:[]},buildings:[{id:'garden-house',label:'Garden home',location:{x:0,z:0,rotationY},plan:{kind:'rectangle',width,depth},storeys:[{id:'garden-floor',label:'Garden floor',spaces:rooms,layout}],accessOpenings:[door('garden-door','garden-entry')]}],
  roomAdjacencies:[{from:'garden-entry',to:'garden-gallery'},...['garden-living','garden-kitchen','garden-bedroom','garden-bath'].map(to=>({from:'garden-gallery',to})),{from:'garden-entry',to:'garden-utility'}],
 };
}

/** A three-storey articulated U with a different private floor organization,
 * aligned fixed stair AND lift, plus an independent ground-only pavilion. */
export function relationshipCourtEstate(){
 const storeys=[0,1,2].map(level=>{
  const prefix=`court-${level}`,ids=['west-suite','west-bath','east-studio','east-study','gallery','service','entry','stair-hall','west-hall','east-hall'].map(s=>`${prefix}-${s}`);
  const rooms=ids.map((id,i)=>space(id,['bedroom','bathroom','studio','study','circulation gallery','service kitchen','entry hall','stair lift landing hall','private circulation hall','creative circulation hall'][i]));
  const root=(s:string)=>`${prefix}-${s}`;
  const nodes:Node[]=[...rooms.map(r=>leaf(r.id)),
   split(root('west'),level===0?'West guest wing':'West private wing','x',[[root('west-rooms'),6],[`${ids[8]}-leaf`,2]]),
   split(root('west-rooms'),'Sleeping and bathing off a private hall','z',[[`${ids[0]}-leaf`,level===1?3:2],[`${ids[1]}-leaf`,level===1?1:2]]),
   split(root('east'),'East creative wing','x',[[`${ids[9]}-leaf`,2],[root('east-rooms'),6]]),
   split(root('east-rooms'),'Studio and study off a wing hall','z',[[`${ids[2]}-leaf`,3],[`${ids[3]}-leaf`,1]]),
   split(root('bridge'),'Gallery and landward arrival/service','z',[[`${ids[4]}-leaf`,2],[root('south'),8]]),
   split(root('south'),'Service, arrival and vertical core','x',[[`${ids[5]}-leaf`,8],[`${ids[6]}-leaf`,8],[`${ids[7]}-leaf`,8]]),
  ];
  const layout:RoomLayout={regions:[{root:root('west'),bounds:{x:-8,z:-5,width:8,depth:10}},{root:root('east'),bounds:{x:8,z:-5,width:8,depth:10}},{root:root('bridge'),bounds:{x:0,z:5,width:24,depth:10}}],nodes};
  return {id:`court-floor-${level}`,label:`Court level ${level}`,height:3.6,spaces:rooms,layout};
 });
 return {format:'v3-architectural-plan-1',concept:'OFFLINE TEST — Three articulated storeys wrap an open north court. West sleeping and east creative wings meet an east-west bridge gallery. A fixed eastern stair/lift core connects every floor, and a small detached ground-only pavilion offers independent working space. Distinct suite proportions on the middle floor are intentional.',
  site:{width:100,depth:100,access:[]},buildings:[{id:'court-house',label:'Court residence',location:{x:0,z:0,rotationY:.22},plan:{kind:'articulated',width:24,depth:20,operations:[{id:'court-cut',type:'recess',facade:'north',start:1/3,end:2/3,depth:10}]},storeys,accessOpenings:[door('court-door','court-0-entry')]},
  {id:'work-pavilion',label:'Work pavilion',location:{x:-30,z:0},plan:{kind:'rectangle',width:8,depth:6},storeys:[{id:'work-floor',label:'Work floor',spaces:[space('work-studio','studio'),space('work-entry','entry hall')],layout:{regions:[{root:'work-root'}],nodes:[leaf('work-studio'),leaf('work-entry'),split('work-root','Studio and arrival','z',[['work-studio-leaf',2],['work-entry-leaf',1]])]}}],accessOpenings:[door('work-door','work-entry')]}],
  verticalCirculation:[{id:'court-stair',type:'stair',hostMassId:'court-house',fromLevel:0,toLevel:2,footprint:{x:6,z:6,width:3,depth:6}},{id:'court-lift',type:'lift',hostMassId:'court-house',fromLevel:0,toLevel:2,footprint:{x:10,z:4,width:2,depth:2}}],
  roomAdjacencies:[...storeys.flatMap((_,level)=>{const p=`court-${level}`;return ['west-hall','east-hall','service','entry','stair-hall'].map(s=>({from:`${p}-gallery`,to:`${p}-${s}`})).concat(['west-suite','west-bath'].map(s=>({from:`${p}-west-hall`,to:`${p}-${s}`})),['east-studio','east-study'].map(s=>({from:`${p}-east-hall`,to:`${p}-${s}`})));}),{from:'work-studio',to:'work-entry'}],
 };
}

/** A concave line outline, with different local zone proportions and a reserve. */
export function relationshipListeningHome(){
 const p=[[-8,-6],[8,-6],[8,6],[2,6],[2,0],[-8,0]];
 const rooms=[space('listening-studio','living reading studio'),space('listening-gallery','circulation gallery'),space('listening-kitchen','kitchen'),space('listening-entry','entry hall'),space('listening-bedroom','bedroom'),space('listening-bath','bathroom')];
 const layout:RoomLayout={regions:[{root:'listening-north',bounds:{x:0,z:-3,width:16,depth:6}},{root:'listening-south',bounds:{x:5,z:3,width:6,depth:6}}],nodes:[...rooms.map(r=>leaf(r.id)),
  split('listening-north','Reading, circulation and cooking','x',[['listening-studio-leaf',10],['listening-gallery-leaf',2],['listening-kitchen-leaf',4]]),
  split('listening-south','Arrival gallery and private suite','x',[['listening-entry-leaf',2],['listening-suite',4]]),
  split('listening-suite','Bedroom and bathing','z',[['listening-bedroom-leaf',2],['listening-bath-leaf',1]]),
 ]};
 return {format:'v3-architectural-plan-1',concept:'OFFLINE TEST — A quiet L-shaped listening and reading home framing a pocket garden. An inner-edge gallery leads from the south entrance to the north studio. The court remains outside the actual concave shell.',site:{width:60,depth:60,access:[]},
 buildings:[{id:'listening-house',label:'Listening home',location:{x:0,z:0},plan:{kind:'outline',segments:p.map((start,i)=>({id:`listening-edge-${i}`,type:'line',start,end:p[(i+1)%p.length]}))},storeys:[{id:'listening-floor',label:'Listening floor',spaces:rooms,layout}],accessOpenings:[{...door('listening-door','listening-entry','south',2/3,1),segmentId:'listening-edge-2'}]}],
 roomAdjacencies:[{from:'listening-gallery',to:'listening-entry'},{from:'listening-gallery',to:'listening-studio'},{from:'listening-gallery',to:'listening-kitchen'},{from:'listening-entry',to:'listening-bedroom'},{from:'listening-entry',to:'listening-bath'}]};
}
export const roomPlanningExamples=()=>[
 {name:'garden-home',make:()=>relationshipGardenHome()},
 {name:'listening-home',make:relationshipListeningHome},
 {name:'three-storey-estate',make:relationshipCourtEstate},
];
export function roomPlanningExterior(raw:unknown){
 const stage=preparePlanEvaluation(raw);
 if(!stage.plan)throw Error(JSON.stringify(stage.findings));
 const exterior=referenceExterior(stage.plan);
 exterior.verticalCirculation=stage.plan.verticalCirculation.filter(c=>c.type==='stair').map(c=>({id:c.id,stairType:'u-shaped' as const,direction:'south' as const,turn:'left' as const}));
 return exterior;
}
