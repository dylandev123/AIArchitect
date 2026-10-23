import { defaultVilla, type VillaStyle } from './design';
import { validateComposition, type VillaComposition } from './composition';
const appearance=(style: VillaStyle) => {
  const {roof,exterior,glazing,landscape}=defaultVilla(style);
  return {style,roof,exterior,glazing,landscape};
};
const wing=(id:string,x:number,z:number,width:number,depth:number,extra:Partial<VillaComposition['wings'][number]>={}):VillaComposition['wings'][number]=>({
  id,x,z,width,depth,orientation:0,storeys:1,storeyHeight:3.8,role:'main',parentId:null,detached:false,veranda:2,balcony:0,...extra,
});
/** Offline fixtures, not choices imposed on Terra. Every dimension remains authored. */
export const COMPOSITION_EXAMPLES: VillaComposition[] = [
  {
    version:1,id:'horizon-house',name:'Horizon House',character:'One quiet volume facing a long pool.',appearance:appearance('modern'),
    wings:[wing('main',0,-5,18,8,{storeys:2,balcony:1.6})],connections:[],
    terraces:[{id:'garden-room',kind:'terrace',x:0,z:3,width:20,depth:8,timber:false},{id:'sun-deck',kind:'terrace',x:9,z:12,width:4,depth:8,timber:true}],
    pool:{x:-2,z:12,width:12,depth:5},garden:{x:0,z:4,width:40,depth:40},
  },
  {
    version:1,id:'breeze-pair',name:'Breeze Pair',character:'An island hall and a low garden salon.',appearance:appearance('caribbean'),
    wings:[wing('main',-5,-7,14,8,{storeys:2,balcony:1.5,storeyHeight:4.1}),wing('salon',9,-4,8,6,{role:'living',parentId:'main',veranda:1.8,orientation:180})],
    connections:[{id:'breeze-link',from:'main',to:'salon',width:2.4}],
    terraces:[{id:'garden-room',kind:'terrace',x:-3,z:3,width:20,depth:7,timber:false}],
    pool:{x:-2,z:13,width:12,depth:5.5},garden:{x:0,z:3,width:42,depth:42},
  },
  {
    version:1,id:'olive-court',name:'Olive Court',character:'An asymmetric court with a private garden retreat.',appearance:appearance('tuscan'),
    wings:[wing('main',0,-10,24,8,{storeys:2,balcony:1.5,veranda:1.6,storeyHeight:4.2}),
      wing('west',-10,2,10,6,{role:'living',parentId:'main',orientation:90,veranda:1.6}),
      wing('east',11,1.2,8,6,{role:'living',parentId:'main',orientation:270,veranda:1.6}),
      wing('retreat',-19,12,6,5,{role:'guest',parentId:'main',detached:true,orientation:90,veranda:1.4})],
    connections:[{id:'west-link',from:'main',to:'west',width:2.4},{id:'east-link',from:'main',to:'east',width:2.4}],
    terraces:[{id:'olive-courtyard',kind:'courtyard',x:0,z:1,width:10,depth:11,timber:false},{id:'pool-approach',kind:'terrace',x:0,z:8.5,width:16,depth:3,timber:false}],
    pool:{x:0,z:15,width:12,depth:5},garden:{x:0,z:3,width:52,depth:46},
  },
];
export const validatedCompositionExamples=()=>COMPOSITION_EXAMPLES.map(validateComposition);
