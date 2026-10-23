import { defaultVilla, type VillaStyle } from './design';
import { validateComposition, type VillaComposition } from './composition';
import type { EstateRoute } from './estate-landscape';
const appearance=(style:VillaStyle)=>{const {roof,exterior,glazing,landscape}=defaultVilla(style);return {style,roof,exterior,glazing,landscape};};
const wing=(id:string,x:number,z:number,width:number,depth:number,extra:Partial<VillaComposition['wings'][number]>={}):VillaComposition['wings'][number]=>({id,x,z,width,depth,orientation:0,storeys:1,storeyHeight:4,role:'main',parentId:null,detached:false,veranda:2,balcony:0,...extra});
const terrace=(id:string,x:number,z:number,width:number,depth:number,timber=false)=>({id,x,z,width,depth,timber,kind:'terrace' as const});
const route=(id:string,kind:EstateRoute['kind'],width:number,points:[number,number][],planting:EstateRoute['planting']='border'):EstateRoute=>({id,kind,width,points:points.map(([x,z])=>({x,z})),planting});
const common={version:1 as const,siteMode:'derived' as const,landscapeMargin:4,garden:{x:0,z:0,width:12,depth:12}};
/** Offline geometry studies. Never automatically selected by Terra or a residential brief. */
export const ESTATE_EXAMPLES:VillaComposition[]=[
  {...common,id:'estate-palmhaven',name:'Palmhaven Estate',character:'A winding palm avenue. A formal island arrival.',appearance:{...appearance('caribbean'),exterior:'limestone'},
    wings:[wing('great-house',0,-5,24,10,{storeys:2,storeyHeight:4.3,balcony:1.7,veranda:2.5}),
      wing('sunset-salon',-21,-2,12,8,{role:'living',parentId:'great-house',veranda:2.2}),
      wing('garden-suites',22,0,12,8,{role:'guest',parentId:'great-house',orientation:270,detached:true,veranda:2.1})],
    connections:[{id:'breeze-link',from:'great-house',to:'sunset-salon',width:2.6}],
    terraces:[terrace('arrival-threshold',0,-10.9,4.5,1.8),terrace('great-terrace',0,5,26,6),terrace('pool-promenade',0,10.3,18,4.6),terrace('suite-garden',17,4,3,8),terrace('salon-deck',-21,5,14,5,true),terrace('pool-west',-12,16,6,10,true),terrace('pool-east',12,16,6,10),terrace('pool-end',0,22,30,2)],
    pool:{x:0,z:16,width:16,depth:6},
    estateLandscape:{builder:'estate-landscape@1',court:{id:'fountain-court',x:0,z:-25,width:22,depth:18,island:'fountain',islandWidth:6,islandDepth:5},beds:[],routes:[
      route('palm-avenue','drive',4.8,[[-35,-53],[-29,-43],[-34,-33],[-23,-23],[-9,-25]],'avenue'),
      route('front-door-walk','walk',2.4,[[0,-17],[0,-14],[0,-11.4]],'none'),
      route('west-garden-walk','walk',1.7,[[-9,-20],[-28,-17],[-31,-7],[-30,6],[-24,8],[-16,9],[-12,10.4]],'border'),
      route('east-garden-walk','walk',1.7,[[9,-20],[20,-15],[31,-10],[32,6],[27,9],[17,8.6],[12,10.4]],'border'),
    ]},
  },
  {...common,id:'estate-splay',name:'Splay House',character:'Three directions. Floating roofs. A garden between.',appearance:appearance('modern'),
    wings:[wing('sky-house',0,-8,14,9,{storeys:2,storeyHeight:4.1,balcony:1.8,veranda:1.6}),
      wing('west-salon',-19,6,16,7,{role:'living',parentId:'sky-house',detached:true,orientation:330,storeyHeight:4.3,veranda:2.2}),
      wing('east-retreat',19,6,12,7,{role:'guest',parentId:'sky-house',detached:true,orientation:30,storeyHeight:3.6,veranda:1.8})],
    connections:[],terraces:[terrace('arrival-threshold',0,-13.1,3.5,1.2),terrace('central-terrace',0,2.2,12,8.2),terrace('salon-garden-deck',-22,12,8,3,true),terrace('retreat-garden-deck',22,12,7,3),terrace('water-promenade',0,15,15,1.4),terrace('water-axis',0,10.3,4,8),terrace('pool-west',-10,19,5,9,true),terrace('pool-east',10,19,5,9),terrace('pool-end',0,24,26,2)],
    pool:{x:0,z:19,width:12,depth:6},
    estateLandscape:{builder:'estate-landscape@1',beds:[],routes:[
      route('sculpture-drive','drive',4.2,[[-26,-32],[-16,-29],[-10,-22],[0,-20]],'avenue'),
      route('entry-walk','walk',1.8,[[0,-20],[0,-17],[0,-13.6]],'none'),
      route('west-link','walk',1.5,[[0,-18],[-12,-15],[-29,-9],[-34,1],[-33,12],[-24,17],[-15,15],[-10,14]],'border'),
      route('east-link','walk',1.5,[[0,-18],[13,-15],[28,-10],[31,3],[30,13],[20,16],[11.5,14.5]],'border'),
      route('salon-approach','walk',1.4,[[-24,17],[-23,14.1]],'none'),
      route('retreat-approach','walk',1.4,[[20,16],[22,13.5]],'none'),
    ]},
  },
  {...common,id:'estate-cortile',name:'Cortile degli Ulivi',character:'An oval forecourt. An olive cloister. A water axis.',appearance:appearance('tuscan'),
    wings:[wing('casa',0,-10,22,9,{storeys:2,storeyHeight:4.2,balcony:1.4,veranda:1.7}),
      wing('west-loggia',-12,6,16,7,{role:'living',parentId:'casa',orientation:90,veranda:1.6}),
      wing('east-loggia',12,6,16,7,{role:'guest',parentId:'casa',orientation:270,veranda:1.6})],
    connections:[{id:'west-passage',from:'casa',to:'west-loggia',width:2.3},{id:'east-passage',from:'casa',to:'east-loggia',width:2.3}],
    terraces:[terrace('arrival-threshold',-.8,-15.2,5,1.4),terrace('court-cross-walk',0,5,13,1.8),terrace('pool-promenade',0,15,23,4),terrace('pool-west',-11,22,5,8),terrace('pool-east',11,22,5,8),terrace('belvedere',0,27,28,2)],
    pool:{x:0,z:22,width:14,depth:6},
    estateLandscape:{builder:'estate-landscape@1',court:{id:'olive-forecourt',x:0,z:-29,width:24,depth:17,island:'planted',islandWidth:8,islandDepth:4},
      beds:[{id:'northwest-parterre',x:-4.1,z:.4,width:4.5,depth:4.5},{id:'northeast-parterre',x:4.1,z:.4,width:4.5,depth:4.5},{id:'southwest-parterre',x:-4.1,z:9.5,width:4.5,depth:4.5},{id:'southeast-parterre',x:4.1,z:9.5,width:4.5,depth:4.5}],
      routes:[route('cypress-approach','drive',4.5,[[31,-46],[23,-43],[19,-35],[10,-29]],'avenue'),
        route('door-axis','walk',2,[[0,-21.5],[0,-18.5],[0,-15.8]],'none'),
        route('cloister-axis','walk',1.8,[[0,-4.4],[0,2],[0,9],[0,15]],'none'),
        route('west-procession','walk',1.6,[[-10,-25],[-21,-20],[-22,-5],[-22,10],[-17,15],[-11,16]],'border'),
        route('east-procession','walk',1.6,[[10,-25],[21,-20],[22,-5],[22,10],[17,15],[11,16]],'border')],
    },
  },
];
export function estateExamples(){return ESTATE_EXAMPLES.map(validateComposition);}
