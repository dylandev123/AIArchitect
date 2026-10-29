import { validateCompositionPreview, type VillaComposition } from './composition';
import { COMPOSITION_EXAMPLES } from './composition-examples';
import type { FootprintBuilding } from './footprint';
const rect=(x:number,z:number,w:number,d:number)=>[{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}];
const base={builder:'footprint-building@1',x:0,z:0,orientation:0,height:4.5,material:'ivory',openings:'panoramic'} as const;
const modern:FootprintBuilding={...base,id:'layered-house',points:[{x:-23,z:-11},{x:18,z:-11},{x:18,z:-4},{x:24,z:-4},{x:24,z:9},{x:3,z:9},{x:3,z:4},{x:-23,z:4}],facades:[{edges:[0],treatment:'solid',material:'limestone'},{edges:[1],treatment:'entrance'},{edges:[3,4],treatment:'loggia'},{edges:[6],treatment:'colonnade'}],volumes:[
 {height:5.8,points:rect(-18,-9,16,14),facades:[{edges:[0,3],treatment:'solid',material:'limestone'},{edges:[2],treatment:'screen'}]},
 {height:3.2,points:[{x:5,z:-6},{x:20,z:-2},{x:24,z:7},{x:5,z:7}],facades:[{edges:[0],treatment:'solid'},{edges:[2],treatment:'loggia'}]},
]};
const flowing:FootprintBuilding={...base,id:'flowing-house',height:3.8,points:[{x:-23,z:7,curve:{x:-26,z:-12}},{x:-3,z:-12,curve:{x:20,z:-14}},{x:24,z:3,curve:{x:26,z:13}},{x:9,z:10,curve:{x:-1,z:0}},{x:-12,z:9,curve:{x:-19,z:14}}],facades:[{edges:[0],treatment:'solid',material:'limestone'},{edges:[1],treatment:'screen'},{edges:[2,3,4],treatment:'loggia'}],volumes:[{height:4.6,points:[{x:-19,z:2,curve:{x:-22,z:-10}},{x:-5,z:-10,curve:{x:4,z:-10}},{x:7,z:-6},{x:5,z:-2,curve:{x:-6,z:-6}},{x:-15,z:4}],facades:[{edges:[0],treatment:'solid',material:'limestone'},{edges:[1],treatment:'screen'},{edges:[3,4],treatment:'glass'}]}]};
/** Offline editable studies of the same primitives. No template ID enters Terra's contract. */
export function residenceCompositionStudies():VillaComposition[]{
 const clean={...structuredClone(COMPOSITION_EXAMPLES[0]),siteMode:'derived' as const,landscapeMargin:8,wings:[],connections:[],terraces:[],pool:null};
 const mediterranean=structuredClone(COMPOSITION_EXAMPLES[2]);
 mediterranean.wings=mediterranean.wings.filter(w=>!w.detached);
 mediterranean.wings[0]={...mediterranean.wings[0],width:28,storeyHeight:4.5};
 mediterranean.wings[1]={...mediterranean.wings[1],x:-15,z:6,width:18,depth:9,storeyHeight:4.1};
 mediterranean.wings[2]={...mediterranean.wings[2],x:15,z:5,width:16,depth:9,storeys:2,storeyHeight:3.6};
 mediterranean.appearance={...mediterranean.appearance,style:'spanish',roof:'hip',exterior:'ivory',glazing:'divided'};
 mediterranean.id='grand-multiwing';mediterranean.name='Grand Mediterranean';mediterranean.character='A tall central palazzo and unequal arcaded wings around an open court.';
 mediterranean.terraces=[];mediterranean.pool=null;mediterranean.siteMode='derived';mediterranean.landscapeMargin=8;
 return [validateCompositionPreview({...clean,id:'dramatic-layered',name:'Layered Modern',character:'Stone arrival spine, tall offset crown and a low splayed living volume.',forms:[modern]}),validateCompositionPreview({...clean,id:'flowing-contemporary',name:'Flowing Contemporary',character:'A flowing shaded lower salon and an asymmetric curved sky wing.',forms:[flowing]}),validateCompositionPreview(mediterranean)];
}
