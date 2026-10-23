import { defaultVilla, type VillaStyle } from './design';
import { validateComposition, type VillaComposition } from './composition';

const appearance=(style:VillaStyle) => {
  const {roof,exterior,glazing,landscape}=defaultVilla(style);
  return {style,roof,exterior,glazing,landscape};
};
const wing=(id:string,x:number,z:number,width:number,depth:number,extra:Partial<VillaComposition['wings'][number]>={}):VillaComposition['wings'][number]=>({
  id,x,z,width,depth,orientation:0,storeys:1,storeyHeight:3.8,role:'main',parentId:null,detached:false,veranda:2,balcony:0,...extra,
});
const terrace=(id:string,x:number,z:number,width:number,depth:number,kind:'terrace'|'courtyard'='terrace',timber=false)=>({id,x,z,width,depth,kind,timber});
const site={x:0,z:0,width:12,depth:12}; // Ignored hint: occupied composition determines each fictional site.
/** Hand-authored deterministic provider-shaped examples, never templates imposed on Terra. */
export const CREATIVE_EXAMPLES:VillaComposition[]=[
  {
    version:1,id:'family-breeze',name:'Breeze Family Villa',character:'A veranda, a garden, a place to grow.',
    appearance:appearance('caribbean'),siteMode:'derived',landscapeMargin:3,
    wings:[wing('family-home',0,-4,13,8)],connections:[],
    terraces:[terrace('family-terrace',0,3.5,15,5),terrace('pool-deck',7,10,3,7,'terrace',true)],
    pool:{x:0,z:10,width:8,depth:4},garden:site,
  },
  {
    version:1,id:'caribbean-grande',name:'Caribbean Grande Estate',character:'An island residence unfolding toward the sea.',
    appearance:{...appearance('caribbean'),exterior:'limestone'},siteMode:'derived',landscapeMargin:10,
    wings:[
      wing('great-house',0,-18,28,12,{storeys:2,storeyHeight:4.4,balcony:2,veranda:2.8}),
      wing('sunset-salon',-27,-12,18,10,{role:'living',parentId:'great-house',veranda:2.4,storeyHeight:4.2}),
      wing('east-suites',28,-18,16,10,{role:'guest',parentId:'great-house',storeys:2,orientation:180,balcony:1.6}),
      wing('west-retreat',-32,12,10,8,{role:'guest',parentId:'great-house',detached:true,orientation:90}),
      wing('garden-retreat',34,8,10,8,{role:'guest',parentId:'great-house',detached:true,orientation:270}),
    ],
    connections:[{id:'sunset-gallery',from:'great-house',to:'sunset-salon',width:3},{id:'east-gallery',from:'great-house',to:'east-suites',width:3}],
    terraces:[terrace('grand-veranda-terrace',0,-3,32,10),terrace('sunset-dining',-27,-2,20,7),
      terrace('west-garden-walk',-25,5,2,12),terrace('east-garden-walk',25,1,2,24),
      terrace('pool-promenade',3,11,32,6),terrace('pool-west-deck',-15,19,6,12,'terrace',true),
      terrace('pool-east-deck',21,19,6,12),terrace('pool-view-terrace',3,26,36,4),
      terrace('arrival-court',0,-32,34,9),terrace('retreat-approach',-21,7,10,2)],
    pool:{x:3,z:19,width:28,depth:8},garden:site,
    components:[{id:'elliptical-lounge',builder:'curved-pavilion@1',x:-18,z:3,orientation:25,width:10,depth:7,height:3.8,material:'limestone'}],
  },
  {
    version:1,id:'tuscan-belvedere',name:'Tenuta Belvedere',character:'A stone court framed by layered terracotta roofs.',
    appearance:appearance('tuscan'),siteMode:'derived',landscapeMargin:9,
    wings:[
      wing('casa-grande',0,-20,24,12,{storeys:2,storeyHeight:4.3,balcony:1.5,veranda:1.6}),
      wing('west-loggia',-13.5,0,18,8,{role:'living',parentId:'casa-grande',orientation:90,veranda:1.6}),
      wing('east-loggia',13.5,0,18,8,{role:'living',parentId:'casa-grande',orientation:270,veranda:1.6}),
      wing('arrival-lodge',0,-43,14,8,{role:'guest',parentId:'casa-grande',detached:true,orientation:180,veranda:1.5}),
      wing('olive-casita',32,4,12,8,{role:'guest',parentId:'casa-grande',detached:true,orientation:270,veranda:1.6}),
    ],
    connections:[{id:'west-passage',from:'casa-grande',to:'west-loggia',width:2.4},{id:'east-passage',from:'casa-grande',to:'east-loggia',width:2.4}],
    terraces:[terrace('olive-court',0,0,14,16,'courtyard'),terrace('arrival-piazza',0,-32,24,9),
      terrace('axial-promenade',0,13,24,7),terrace('pool-west',-13,22,6,10),terrace('pool-east',13,22,6,10),
      terrace('belvedere',0,28,32,3),terrace('casita-walk',24,4,8,2)],
    pool:{x:0,z:22,width:18,depth:6},garden:site,
  },
];
export function creativeExamples() { return CREATIVE_EXAMPLES.map(validateComposition); }
