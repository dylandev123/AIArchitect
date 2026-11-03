import type {ArchitecturalPlan} from './plan';
type Side='north'|'east'|'south'|'west'|'same';
export type Al='start'|'centre'|'end';
export const at=(relativeTo:string|null,side:Side|'origin',alignment:Al='start',gap=0)=>({relativeTo,side,alignment,gap}) as ArchitecturalPlan['spaces'][number]['placement'];
type RoomOptions={level?:string;outdoor?:boolean;h?:number;al?:Al};
/** DEVELOPER-AUTHORED SOFTWARE-EXPRESSIVENESS FIXTURES. Not Terra output and no evidence that any model composes well.
 * They state the building-scale composition (volumes, height tiers, roof spans, facade rhythms, entrance) FIRST and
 * then elaborate rooms, so tests can check the composition survives into the constructed geometry. */
export function base(id:string,thesis:string,levels:ArchitecturalPlan['levels']):ArchitecturalPlan{
 return {version:'architectural-plan-1',id,thesis,orientation:0,site:{width:110,depth:110,elevation:0,grade:0,fall:'z'},levels,masses:[],spaces:[],portals:[],stairs:[],arrival:'porch',roofs:[],screens:[],terraces:[],pools:[],landscape:[],
  materials:{floor:'limestone',wall:'ivory',roof:'timber'},cameraViews:['Aerial','Arrival','Garden','Poolside']};
}
export function builder(p:ArchitecturalPlan){
 const room=(idn:string,mass:string,w:number,d:number,rel:ReturnType<typeof at>,o:RoomOptions={})=>{
  p.spaces.push({id:idn,mass,level:o.level??'ground',use:idn,width:w,depth:d,...(o.h!==undefined?{height:o.h}:{}),outdoor:o.outdoor??false,placement:rel});
 };
 const portal=(idn:string,space:string,to:string,width:number,height:number,mode:'door'|'open'='door',alignment:Al='centre',side:ArchitecturalPlan['portals'][number]['host']['side']='shared')=>
  p.portals.push({id:idn,host:{space,side},to,alignment,width,height,mode});
 return {room,portal};
}
export type CompositionFixture='hillcrest'|'pavilion-court';
export function compositionFirstFixture(name:CompositionFixture):ArchitecturalPlan{
 if(name==='hillcrest'){
  const p=base('hillcrest-estate','A two-storey stone hall with a hip-roofed upper crown, a long timber sleeping wing under one gable, and a low garden pavilion stepping down to the pool.',[{id:'ground',above:null,rise:.2},{id:'upper',above:'ground',rise:4.4}]);
  const {room,portal}=builder(p);
  p.masses=[{id:'great-house',role:'primary two-storey stone volume'},{id:'sleeping-wing',role:'low timber bar'},{id:'garden-pavilion',role:'subordinate garden room'}];
  room('hall','great-house',8,12,at(null,'origin','centre'));
  room('salon','great-house',12,12,at('hall','east','start'),{h:4.4});
  room('upper-gallery','great-house',8,12,at('hall','same','start'),{level:'upper',h:3.4});
  room('upper-lounge','great-house',12,12,at('salon','same','start'),{level:'upper',h:3.4});
  room('porch','great-house',8,4,at('hall','south','start'),{outdoor:true,h:3.6});
  room('west-gallery','sleeping-wing',18,3,at('hall','west','start'),{h:3.8});
  room('bed-1','sleeping-wing',6,9,at('west-gallery','north','start'),{h:3.8});
  room('bed-2','sleeping-wing',6,9,at('bed-1','east','start'),{h:3.8});
  room('bed-3','sleeping-wing',6,9,at('bed-2','east','start'),{h:3.8});
  room('garden-room','garden-pavilion',12,5,at('salon','north','start'),{h:2.8});
  room('veranda','garden-pavilion',12,4,at('garden-room','north','start'),{outdoor:true,h:2.8});
  p.arrival='porch';p.terraces=['veranda'];
  portal('estate-door','hall','porch',2.8,3.4,'door','centre','south');
  portal('hall-salon','hall','salon',3,3,'open');
  portal('hall-gallery','hall','west-gallery',1.4,2.4);
  portal('gallery-bed-1','west-gallery','bed-1',1.1,2.2,'door','centre');
  portal('gallery-bed-2','west-gallery','bed-2',1.1,2.2,'door','centre');
  portal('gallery-bed-3','west-gallery','bed-3',1.1,2.2,'door','centre');
  portal('salon-garden-room','salon','garden-room',4,2.5,'open');
  portal('upper-passage','upper-gallery','upper-lounge',2.4,2.4,'open');
  p.stairs=[{id:'main-stair',lower:'hall',upper:'upper-gallery',width:1.6,run:7,landing:1.4,headroom:2.2}];
  p.roofs=[{space:'porch',form:'flat',rise:.22}];
  p.pools=[{id:'lap-pool',placement:at('veranda','north','start',1.5),width:14,depth:5,waterDepth:1.4,level:'ground'}];
  p.landscape=[{id:'pool-lawn',kind:'lawn',placement:at('lap-pool','north','start',1),width:20,depth:8}];
  p.composition={
   volumes:[
    {id:'stone-house',masses:['great-house'],tier:'primary',roof:'crown-roof',material:'limestone'},
    {id:'timber-bar',masses:['sleeping-wing'],tier:'secondary',roof:'sleeping-roof',material:'timber'},
    {id:'garden-room-volume',masses:['garden-pavilion'],tier:'subordinate',roof:'garden-roof',material:'ivory'},
   ],
   heightStep:1,
   roofSpans:[
    {id:'crown-roof',spaces:['upper-gallery','upper-lounge'],form:'hip',rise:2.4,overhang:.6,material:'bronze'},
    {id:'sleeping-roof',spaces:['west-gallery','bed-1','bed-2','bed-3'],form:'gable',rise:3,overhang:0,material:'timber'},
    {id:'garden-roof',spaces:['garden-room','veranda'],form:'flat',rise:.25,overhang:0,material:'bronze'},
   ],
   facades:[
    {id:'salon-south',space:'salon',side:'south',kind:'windows',bays:3,width:2.8,height:3.2,sill:.6},
    {id:'salon-east',space:'salon',side:'east',kind:'windows',bays:2,width:3,height:3.2,sill:.6},
    {id:'lounge-south',space:'upper-lounge',side:'south',kind:'windows',bays:3,width:2.6,height:2.2,sill:.5},
    {id:'lounge-east',space:'upper-lounge',side:'east',kind:'windows',bays:2,width:3,height:2.2,sill:.5},
    {id:'garden-doors',space:'garden-room',side:'north',kind:'doors',to:'veranda',bays:3,width:2.6,height:2.5},
    {id:'bed-north',space:'bed-2',side:'north',kind:'windows',bays:2,width:1.6,height:2,sill:.9},
   ],
   entrance:{portal:'estate-door',porch:'porch'},
  };
  return p;
 }
 const p=base('pavilion-court-villa','A tall hip-roofed living pavilion faces a detached long gable bedroom bar across an open court; a sheltered porch and deck frame the approach.',[{id:'ground',above:null,rise:.2}]);
 const {room,portal}=builder(p);
 p.masses=[{id:'pavilion',role:'primary tall living pavilion'},{id:'bar',role:'long low bedroom bar'},{id:'garden',role:'open court and deck'}];
 room('living','pavilion',10,10,at(null,'origin','centre'),{h:5});
 room('dining','pavilion',8,10,at('living','east','start'),{h:5});
 room('porch','pavilion',10,4,at('living','south','start'),{outdoor:true,h:3.4});
 room('court','garden',18,6,at('living','north','start'),{outdoor:true});
 room('deck','garden',5,10,at('dining','east','start'),{outdoor:true,h:3});
 room('spine','bar',24,2.4,at('court','north','start'),{h:3.2});
 room('bed-a','bar',6,7,at('spine','north','start'),{h:3.2});
 room('bed-b','bar',6,7,at('bed-a','east','start'),{h:3.2});
 room('bed-c','bar',6,7,at('bed-b','east','start'),{h:3.2});
 room('bed-d','bar',6,7,at('bed-c','east','start'),{h:3.2});
 p.arrival='porch';p.terraces=['court','deck'];
 portal('front-door','living','porch',2.6,3.2,'door','centre','south');
 portal('living-dining','living','dining',3,3,'open');
 portal('living-court','living','court',2.4,2.6,'door','centre');
 portal('court-spine','spine','court',2.4,2.6,'door','start');
 for(const b of ['a','b','c','d'])portal(`spine-bed-${b}`,'spine',`bed-${b}`,1.1,2.2,'door','centre');
 p.roofs=[{space:'porch',form:'flat',rise:.22},{space:'deck',form:'flat',rise:.22}];
 p.pools=[{id:'long-pool',placement:at('bed-a','north','start',2),width:18,depth:4.5,waterDepth:1.3,level:'ground'}];
 p.landscape=[{id:'north-lawn',kind:'lawn',placement:at('long-pool','north','start',1),width:24,depth:8}];
 p.composition={
  volumes:[
   {id:'living-pavilion',masses:['pavilion'],tier:'primary',roof:'pavilion-roof',material:'limestone'},
   {id:'sleeping-bar',masses:['bar'],tier:'secondary',roof:'bar-roof',material:'timber'},
   {id:'court-garden',masses:['garden'],tier:'subordinate'},
  ],
  heightStep:1.2,
  roofSpans:[
   {id:'pavilion-roof',spaces:['living','dining'],form:'hip',rise:3.2,overhang:.8,material:'bronze'},
   {id:'bar-roof',spaces:['spine','bed-a','bed-b','bed-c','bed-d'],form:'gable',rise:2.4,overhang:.8,material:'timber'},
  ],
  facades:[
   {id:'living-west',space:'living',side:'west',kind:'windows',bays:3,width:2.2,height:3.6,sill:.4},
   {id:'dining-south',space:'dining',side:'south',kind:'windows',bays:2,width:2.4,height:3.2,sill:.6},
   {id:'dining-deck',space:'dining',side:'east',kind:'doors',to:'deck',bays:2,width:2.4,height:3.2},
   {id:'bed-north',space:'bed-b',side:'north',kind:'windows',bays:2,width:1.6,height:2,sill:.9},
  ],
  entrance:{portal:'front-door',porch:'porch'},
 };
 return p;
}
