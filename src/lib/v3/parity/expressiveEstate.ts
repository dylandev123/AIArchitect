/** Demanding independent capability references. Never imported by generation or used as templates. */
import type { V3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { expandPlanAuthoring } from '../architecturalPlanAuthoring';
import { elaborateV3ArchitecturalPlan, type V3ArchitecturalPlan, type V3ArchitecturalExterior } from '../architecturalPlanFirst';
import { preparePlanEvaluation } from '../architecturalPlanEvaluation';
type Room={id:string;label:string;program:string;footprint:{x:number;z:number;width:number;depth:number}};
const room=(id:string,label:string,program:string,x:number,z:number,width:number,depth:number):Room=>({id,label,program,footprint:{x,z,width,depth}});
const circle=(id:string,r:number)=>({kind:'outline',operations:[],segments:[{id,type:'arc',center:[0,0],radius:r,startAngle:0,sweep:360}]});
const polygon=(p:number[][])=>({kind:'outline',operations:[],segments:p.map((a,i)=>({id:`edge-${i}`,type:'line',start:a,end:p[(i+1)%p.length]}))});
const feature=(id:string,label:string,type:string,x:number,z:number,width:number,depth:number,footprint?:unknown)=>({id,label,type,location:{x,z},width,depth,...(footprint?{footprint}:{})});
const entry=(id:string,facade:string,start:number,end:number,serves:string,type='door')=>({id,facade,type,start,end,serves,...(type==='glazed-door'?{operation:'sliding'}:{})});

export function formalArrivalEstate():V3ArchitecturalPlan {
 const ground=[
  room('arrival-hall','Arrival and stair hall','foyer stair circulation',0,12,8,16),
  room('garden-gallery','Shaded garden gallery','circulation gallery',0,2,60,4),
  room('chef-kitchen','Chef kitchen','kitchen service',-26.5,8,7,8),
  room('scullery','Scullery','service kitchen',-19.5,6,7,4),
  room('food-pantry','Food pantry','pantry',-19.5,10,7,4),
  room('staff-dining','Staff dining','service dining',-26.5,16,7,8),
  room('service-vestibule','Service vestibule','service circulation',-19.5,16,7,8),
  room('dining','Entertaining dining','dining',-10,9,12,10),
  room('wine-room','Wine room','wine storage',-13,17,6,6),
  room('butler-pantry','Butler pantry','pantry',-7,17,6,6),
  room('family-salon','Family salon','living',10,9,12,10),
  room('cinema','Private cinema','media',10,17,12,6),
  room('east-service-hall','East service hall','service circulation',17.5,12,3,16),
  room('laundry','Laundry','service',23,8,8,8),
  room('utility-store','Utility store','storage',23,16,8,8),
  room('service-corridor','Service side passage','service circulation',28.5,12,3,16),
  room('west-living','Sea living room','living entertaining',-21,-14,18,12),
  room('west-library','Library retreat','library',-21,-4,18,8),
  room('primary-bedroom','Primary sleeping room','private bedroom',18,-16,12,8),
  room('primary-sitting','Primary sitting room','private sitting',27,-16,6,8),
  room('primary-private-gallery','Primary suite gallery','private circulation',21,-10,18,4),
  room('primary-dressing','Primary dressing','private dressing',16,-4,8,8),
  room('primary-bath','Primary bath','private bathroom',25,-4,10,8),
 ];
 const upper=[
  room('upper-stair-hall','Upper stair landing','stair landing circulation',0,12,8,16),
  room('upper-gallery','Upper garden gallery','circulation gallery',0,2,60,4),
  room('family-study','Family study','study',-23,8,14,8),
  room('upper-west-gym','Gym','fitness',-23,16,14,8),
  room('family-lounge','Family lounge','living',-10,8,12,8),
  room('upper-playroom','Children playroom','play',-10,16,12,8),
  room('guest-library','Guest library','study',10,8,12,8),
  room('upper-studio','Creative studio','studio',10,16,12,8),
  room('linen-service','Upper service hall','service circulation',18,12,4,16),
  room('upper-laundry','Upper laundry','service',25,8,10,8),
  room('upper-linen','Linen storage','storage',25,16,10,8),
  room('west-suite','West guest bedroom','bedroom',-21,-14,18,12),
  room('west-bath','West guest bath','bathroom',-25,-4,10,8),
  room('west-dressing','West dressing vestibule','dressing',-16,-4,8,8),
  room('east-suite','East family bedroom','bedroom',21,-14,18,12),
  room('east-dressing','East dressing vestibule','dressing',16,-4,8,8),
  room('east-bath','East family bath','bathroom',25,-4,10,8),
 ];
 const raw={format:'v3-architectural-plan-1',concept:'OFFLINE REFERENCE — Sea Court: the sheltered south arrival follows a curved planted approach into a circular fountain court. A two-storey U frames a north-facing garden, with a sea living wing west and a private primary wing east. A continuous gallery mediates courtyard, entertaining and service rooms; the stair hall and upper landing align. A separate low guest pavilion and shaded pool terrace complete the sequence. This is independently constructed technical evidence, not a Terra result or a proposed change to a saved estate.',site:{width:180,depth:160,access:[{id:'south-gate',boundary:'south',point:[40,0,80]}]},
  buildings:[{id:'sea-court-house',label:'Sea Court residence',location:{x:0,z:-18},plan:{kind:'articulated',width:60,depth:40,operations:[{id:'garden-court-cut',type:'recess',facade:'north',start:.3,end:.7,depth:20}]},storeys:[{id:'court-ground',label:'Arrival and garden floor',height:4,spaces:ground},{id:'court-upper',label:'Private upper floor',height:3.6,spaces:upper}],accessOpenings:[entry('formal-entry','south',.47,.53,'arrival-hall'),entry('court-glazing','north',.4,.6,'garden-gallery','glazed-door'),entry('west-sea-door','north',.06,.24,'west-living','glazed-door'),entry('primary-sea-door','north',.75,.85,'primary-bedroom','glazed-door'),entry('kitchen-access','west',.62,.7,'chef-kitchen')]},
   {id:'guest-house',label:'Garden guest pavilion',location:{x:-61,z:-5},plan:{kind:'rectangle',width:24,depth:28},storeys:[{id:'guest-floor',label:'Guest garden floor',height:3.6,spaces:[room('guest-hall','Guest gallery','circulation',0,0,4,28),room('guest-west-bedroom','Guest bedroom west','bedroom',-7,-7,10,14),room('guest-east-bedroom','Guest bedroom east','bedroom',7,-7,10,14),room('guest-west-bath','Guest bath and dressing west','bath dressing',-7,7,10,14),room('guest-living','Guest sitting and pantry','living pantry',7,7,10,14)]}],accessOpenings:[entry('guest-entry','south',.44,.56,'guest-hall')]}],
  features:[feature('motor-court','Circular fountain motor court','driveway',0,43,32,32,circle('court-circle',16)),feature('arrival-fountain','Arrival fountain','fountain',0,43,8,8,circle('fountain-circle',4)),
   feature('west-arrival-garden','Sculpted arrival garden','landscape-zone',-29,43,18,28,polygon([[-9,-14],[9,-14],[9,-4],[2,-4],[2,14],[-9,14]])),
   feature('east-arrival-garden','East arrival grove','landscape-zone',45,24,24,28,circle('garden-circle',12)),
   feature('court-garden','Sheltered court garden','landscape-zone',0,-28,20,16,polygon([[-10,-8],[10,-8],[8,8],[-8,8]])),
   feature('sea-terrace','Sea entertaining terrace','terrace',0,-50,68,20,polygon([[-34,-7],[-29,-10],[29,-10],[34,-7],[34,10],[-34,10]])),
   feature('sea-pool','Curved sea pool','pool',0,-50,30,10,{kind:'outline',operations:[],segments:[{id:'pool-north',type:'line',start:[-10,-5],end:[10,-5]},{id:'pool-east',type:'arc',center:[10,0],radius:5,startAngle:-90,sweep:180},{id:'pool-south',type:'line',start:[10,5],end:[-10,5]},{id:'pool-west',type:'arc',center:[-10,0],radius:5,startAngle:90,sweep:180}]}),
   feature('west-shade','Covered entertaining loggia','canopy',-25,-50,12,10),feature('east-shade','Pool dining shelter','canopy',25,-50,12,10),
   feature('guest-court','Guest garden court','terrace',-61,21,20,16,circle('guest-court-circle',8))],
  connections:[{id:'curved-gate-approach',purpose:'Gated approach with a precise circular bend into the fountain court',from:{kind:'site-access',accessId:'south-gate'},to:{kind:'surface',objectId:'motor-court',local:[12,6]},use:'vehicle',width:5.5,waypoints:[],path:[{id:'gate-straight',type:'line',start:[40,80],end:[40,70]},{id:'arrival-bend',type:'arc',center:[19,70],radius:21,startAngle:0,sweep:-90},{id:'court-contact',type:'line',start:[19,49],end:[12,49]}]},
   {id:'formal-dropoff',purpose:'Fountain court to the recessed arrival hall',from:{kind:'surface',objectId:'motor-court',local:[0,-16]},to:{kind:'entrance',entranceId:'formal-entry',approachDistance:5},use:'vehicle',width:5.5,waypoints:[]},
   {id:'guest-link',purpose:'Independent guest access across the service side garden',from:{kind:'entrance',entranceId:'kitchen-access',approachDistance:4},to:{kind:'entrance',entranceId:'guest-entry',approachDistance:4},use:'pedestrian',width:1.8,waypoints:[[-40,0,13]]},
   {id:'sea-connection',purpose:'Living wing to sea terrace',from:{kind:'entrance',entranceId:'west-sea-door',approachDistance:1},to:{kind:'surface',objectId:'sea-terrace',local:[-21,9]},use:'pedestrian',width:2,waypoints:[]}],
  verticalCirculation:[{id:'grand-stair',type:'stair',hostMassId:'sea-court-house',fromLevel:0,toLevel:1,footprint:{x:-1,z:12,width:4,depth:10}},{id:'court-lift',type:'lift',hostMassId:'sea-court-house',fromLevel:0,toLevel:1,footprint:{x:2.5,z:7,width:2,depth:3}}],
  roomAdjacencies:[{from:'arrival-hall',to:'garden-gallery'},{from:'dining',to:'scullery'},{from:'scullery',to:'chef-kitchen'},{from:'dining',to:'garden-gallery'},{from:'family-salon',to:'garden-gallery'},{from:'west-library',to:'garden-gallery'},{from:'west-library',to:'west-living'},{from:'primary-dressing',to:'garden-gallery'},{from:'primary-dressing',to:'primary-private-gallery'},{from:'primary-private-gallery',to:'primary-bedroom'},{from:'primary-dressing',to:'primary-bath'},{from:'upper-stair-hall',to:'upper-gallery'},{from:'west-dressing',to:'upper-gallery'},{from:'west-dressing',to:'west-suite'},{from:'east-dressing',to:'upper-gallery'},{from:'east-dressing',to:'east-suite'},{from:'guest-hall',to:'guest-west-bedroom'},{from:'guest-hall',to:'guest-east-bedroom'},{from:'guest-hall',to:'guest-living'}],
  relationships:[]};
 Object.assign(raw.features[2].location,{rotationY:.15});
 const parsed=expandPlanAuthoring(raw);if(!parsed.success)throw Error(JSON.stringify(parsed.error.issues));return parsed.data;
}

export function articulatedWingsResidence():V3ArchitecturalPlan {
 const floors=[0,1].map(level=>{
  const prefix=level?'upper':'ground',spaces=[room(`${prefix}-stair-hall`,level?'Upper bridge and landing':'Entrance and stair bridge','stair circulation gallery',0,0,24,8)];
  for(const [side,x] of [['west',-19.5],['east',19.5]] as const){
   spaces.push(room(`${prefix}-${side}-gallery`,`${side} wing gallery`,'circulation gallery',side==='west'?-13.5:13.5,0,3,36));
   for(const [i,z] of [-13.5,-4.5,4.5,13.5].entries())spaces.push(room(`${prefix}-${side}-${i}`,level?`${side} ${['bedroom','dressing and bath','study','bedroom'][i]}`:`${side} ${['salon','dining','kitchen','service'][i]}`,level?['bedroom','bathroom dressing','study','bedroom'][i]:['living','dining','kitchen','service'][i],x,z,9,9));
  }
  return {id:`wings-${prefix}`,label:level?'Private upper wings':'Public garden wings',height:level?3.6:4.2,spaces};
 });
 const raw={format:'v3-architectural-plan-1',concept:'OFFLINE REFERENCE — Two garden courts separate parallel two-storey wings, joined by an inhabited stair bridge. Continuous internal galleries connect the rooms without passing through bedrooms. The aligned upper bridge connects the private wings. A one-storey east library volume touches the ground wing and stays absent on the upper floor. This independently authored H arrangement proves articulated massing and stack fidelity, not generated design quality.',site:{width:140,depth:120,access:[]},
  buildings:[{id:'garden-wings',label:'Garden wings residence',location:{x:0,z:0},plan:{kind:'articulated',width:48,depth:36,operations:[{id:'north-court',type:'recess',facade:'north',start:.25,end:.75,depth:14},{id:'south-court',type:'recess',facade:'south',start:.25,end:.75,depth:14}]},storeys:floors,accessOpenings:[entry('bridge-entry','south',.46,.54,'ground-stair-hall'),entry('north-gallery-entry','north',.46,.54,'ground-stair-hall','glazed-door')]},
   {id:'low-library',label:'Single-storey library wing',location:{x:32,z:0},plan:{kind:'rectangle',width:16,depth:8},storeys:[{id:'library-ground',label:'Library level',height:4.2,spaces:[room('library-reading','Garden reading room','library',0,0,16,8)]}],accessOpenings:[entry('library-door','south',.4,.6,'library-reading')]}],
  features:[feature('north-garden','North planted court','landscape-zone',0,-11,16,8,polygon([[-8,-4],[8,-4],[7,4],[-7,4]])),feature('north-court-rim','North courtyard perimeter','courtyard',0,-11,20,12,polygon([[-10,-6],[10,-6],[8,6],[-8,6]])),feature('south-arrival','Sheltered entry court','terrace',0,12,20,14,circle('entry-court',7)),feature('library-terrace','Library garden terrace','terrace',32,11,20,10)],connections:[],
  verticalCirculation:[{id:'bridge-stair',type:'stair',hostMassId:'garden-wings',fromLevel:0,toLevel:1,footprint:{x:0,z:0,width:10,depth:4},stairType:'straight',direction:'east'},{id:'bridge-lift',type:'lift',hostMassId:'garden-wings',fromLevel:0,toLevel:1,footprint:{x:-8,z:0,width:3,depth:3}}],
  roomAdjacencies:floors.flatMap((s,level)=>['west','east'].flatMap(side=>[{from:`${level?'upper':'ground'}-stair-hall`,to:`${level?'upper':'ground'}-${side}-gallery`},...[0,1,2,3].map(i=>({from:`${level?'upper':'ground'}-${side}-gallery`,to:`${level?'upper':'ground'}-${side}-${i}`}))])),relationships:[{id:'joined-library',from:'garden-wings',to:'low-library',kind:'connects',intent:'Single-storey library meets the east wing at the shared ground datum'}]};
 const parsed=expandPlanAuthoring(raw);if(!parsed.success)throw Error(JSON.stringify(parsed.error.issues));return parsed.data;
}

/** Explicit mock exterior for technical construction proof; never a model output. */
export function referenceExterior(plan:V3ArchitecturalPlan):V3ArchitecturalExterior {
 return {materials:[{id:'stone',color:'#d6d2c8',surface:'stone',roughness:.8},{id:'roof',color:'#a58a64',surface:'metal',roughness:.4},{id:'paving',color:'#b8ad98',surface:'paving',roughness:.74},{id:'grass',color:'#61754b',surface:'grass',roughness:.9},{id:'water',color:'#528e9a',surface:'water',roughness:.2},{id:'timber',color:'#695343',surface:'wood',roughness:.8}],
 buildings:plan.buildings.map(b=>({id:b.id,materialId:'stone',facade:{openings:[]},roof:{form:'flat',materialId:'roof',pitchDegrees:0,overhang:0,thickness:.25}})),
 features:plan.features.map(f=>({id:f.id,materialId:f.type==='pool'||f.type==='fountain'?'water':f.type==='landscape-zone'?'grass':f.type==='canopy'?'timber':'paving',...(f.height===undefined?{height:f.type==='pool'?1:f.type==='fountain'?.6:f.type==='canopy'?3.2:f.type==='landscape-zone'?.12:.14}:{}),...(f.type==='canopy'?{canopyStyle:'slatted' as const}:{}),...(f.type==='terrace'?{railing:'none' as const}:{} )})),
 connections:plan.connections.map(c=>({id:c.id,materialId:'paving'})),verticalCirculation:plan.verticalCirculation.filter(c=>c.type==='stair'&&!c.stairType).map(c=>({id:c.id,stairType:'straight' as const,direction:c.footprint.width>c.footprint.depth?'east' as const:'north' as const})),partitions:[],doors:[]};
}
export function referenceBlueprint(plan:V3ArchitecturalPlan):V3ArchitecturalBlueprint {
 const developed=elaborateV3ArchitecturalPlan(preparePlanEvaluation(plan),referenceExterior(plan));if(!developed.blueprint)throw Error(JSON.stringify(developed.findings));return developed.blueprint;
}
