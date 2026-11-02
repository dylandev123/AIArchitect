/** Developer-authored architectural studies. Neither is an AI response or a
 * resolved luxury house. Same compiler; no geometry is specialized to these IDs. */
import type {BuildingIntent,Space,Portal,Point} from './compiler';
const rect=(x:number,z:number,w:number,d:number):Point[]=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
export function estateIntent():BuildingIntent {
 const spaces:Space[]=[],portals:Portal[]=[];
 const add=(id:string,polygon:Point[],mass:string,height=3.2,outdoor=false)=>spaces.push({id,polygon,mass,height,level:'garden-datum',outdoor,roof:!outdoor,material:mass==='social'?'limestone':'ivory',use:id});
 add('arrival-court',rect(0,-4,4,4),'procession',3.2,true);
 for(let i=0;i<3;i++){
  const z=i*6,c=`gallery-${i+1}`,west=`suite-west-${i+1}`,east=`suite-east-${i+1}`;
  add(c,rect(0,z,4,6),'procession');add(west,rect(-8,z,8,6),'private-west');
  add(east,i===2?[[4,z],[10,z],[12,z+6],[4,z+6]]:rect(4,z,6,6),'private-east');
  portals.push({id:`west-threshold-${i+1}`,host:{space:c,edge:3},to:west,offset:3,width:1.1,height:2.5,mode:'door'},{id:`east-threshold-${i+1}`,host:{space:c,edge:1},to:east,offset:3,width:1.1,height:2.5,mode:'door'});
  if(i)portals.push({id:`gallery-link-${i}`,host:{space:`gallery-${i}`,edge:2},to:c,offset:2,width:2.4,height:2.8,mode:'open'});
 }
 add('ocean-salon',[[0,18],[4,18],[10,28],[-6,28]],'social',4.8);
 add('waterfront-loggia',rect(-6,28,16,5),'social',4.8,true);
 portals.push({id:'estate-front-door',host:{space:'gallery-1',edge:0},to:'arrival-court',offset:2,width:2,height:2.8,mode:'door'},
 {id:'salon-threshold',host:{space:'gallery-3',edge:2},to:'ocean-salon',offset:2,width:2.4,height:2.8,mode:'open'},
 {id:'ocean-door',host:{space:'ocean-salon',edge:2},to:'waterfront-loggia',offset:8,width:7,height:3.4,mode:'door'});
 return {version:'semantic-pilot-1',id:'estate',thesis:'Six private allocations flank a gallery procession opening into an angled taller waterfront salon. Exterior spatial study; baths/service/landscape unresolved.',frame:{origin:[-8,-10],yaw:.19},levels:[{id:'garden-datum',top:.2}],masses:[{id:'procession',role:'arrival and shared circulation'},{id:'social',role:'dominant tapered social pavilion',relatesTo:'procession'},{id:'private-west',role:'larger private wing',relatesTo:'procession'},{id:'private-east',role:'unequal subordinate wing',relatesTo:'procession'}],spaces,portals,stairs:[],arrival:'arrival-court',requiredAccess:spaces.map(s=>s.id)};
}
export function compactIntent():BuildingIntent {
 const spaces:Space[]=[
 {id:'street-step',mass:'base',level:'street',use:'arrival',polygon:rect(0,-2,3,2),height:3.2,outdoor:true},
 {id:'stair-hall',mass:'base',level:'street',use:'entry and stair',polygon:rect(0,0,3,8),height:3.2},
 {id:'day-room',mass:'base',level:'street',use:'living',polygon:[[3,0],[7,0],[8,8],[3,8]],height:3.2},
 {id:'upper-gallery',mass:'upper',level:'sleep',use:'stair landing gallery',polygon:rect(0,0,3,8),height:2.8,roof:true},
 {id:'sleep-room',mass:'upper',level:'sleep',use:'bedroom study',polygon:[[3,0],[7,0],[8,8],[3,8]],height:2.8,roof:true,material:'timber'},
 {id:'rear-deck',mass:'base',level:'street',use:'outdoor dining',polygon:rect(3,8,5,3),height:3.2,outdoor:true},
 ];
 return {version:'semantic-pilot-1',id:'compact',thesis:'Angled narrow two-level footprint with explicit straight stair, upper void and back terrace. Fit-out and guards deferred.',frame:{origin:[19,7],yaw:-.41},levels:[{id:'street',top:.2},{id:'sleep',top:3.4}],masses:[{id:'base',role:'angled ground living and circulation'},{id:'upper',role:'upper bedroom and gallery',relatesTo:'base'}],spaces,portals:[
 {id:'street-door',host:{space:'stair-hall',edge:0},to:'street-step',offset:1.5,width:1.1,height:2.3,mode:'door'},
 {id:'day-door',host:{space:'stair-hall',edge:1},to:'day-room',offset:.8,width:1,height:2.3,mode:'open'},
 {id:'sleep-door',host:{space:'upper-gallery',edge:1},to:'sleep-room',offset:6.9,width:1,height:2.3,mode:'door'},
 {id:'deck-door',host:{space:'day-room',edge:2},to:'rear-deck',offset:2.5,width:2.8,height:2.5,mode:'door'},
 ],stairs:[{id:'ascent',lower:'stair-hall',upper:'upper-gallery',start:[1.5,1.2],width:1.1,run:4.8,risers:18,landing:1.1,headroom:2.1,bypass:'right'}],arrival:'street-step',requiredAccess:spaces.map(s=>s.id)};
}
