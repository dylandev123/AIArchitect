/** Offline studies: four inputs to one builder, never selectable Terra templates. */
import { validateComposition, type VillaComposition } from './composition';
import type { FootprintBuilding } from './footprint';
import { rectanglePoints, type StackVolume } from './stacked-volumes';
const volume=(id:string,parentId:string,x:number,z:number,width:number,depth:number,height:number,rooftop:StackVolume['rooftop']='railed'):StackVolume=>({id,parentId,x,z,width,depth,height,rooftop});
const form=(id:string,width:number,depth:number,height:number,stack:StackVolume[],rooftop:StackVolume['rooftop']='lounge'):FootprintBuilding=>({id,builder:'footprint-building@1',x:0,z:0,orientation:0,points:rectanglePoints({x:0,z:0,width,depth}),height,material:'ivory',openings:'panoramic',rooftop,stack,facades:[{edges:[0],treatment:'screen'},{edges:[1],treatment:'solid'},{edges:[2,3],treatment:'glass'}]});
export function stackedVolumeExamples():VillaComposition[]{
 const forms=[
  form('sky-mansion',30,24,3.8,[volume('second','base',0,-1,27,21,3.6),volume('third','second',0,-2,24,18,3.6),volume('fourth','third',0,-2,22,16,3.5,'shaded')]),
  form('wing-estate',40,28,3,[volume('west-wing','base',-13,0,12,26,4.8,'shaded'),volume('east-wing','base',13,0,12,26,3.4,'lounge'),volume('central-hall','base',0,-7,12,12,5.7,'railed'),volume('west-crown','west-wing',-13,-6,9,12,3.2,'railed')]),
  form('staggered-mansion',25,22,3.8,[volume('shift-east','base',3,-1,23,19,3.6,'lounge'),volume('shift-west','shift-east',0,-3,21,15,3.6,'railed'),volume('cantilever','shift-west',3,-5,19,13,3.3,'shaded')]),
  form('tower-pavilion',26,16,3.2,[volume('tower-one','base',-6,-1,10,12,3.6,'none'),volume('tower-two','tower-one',-6,-1,10,12,3.6,'none'),volume('tower-crown','tower-two',-5,-1,9,10,3.6,'shaded'),volume('pavilion','base',7,1,10,10,3,'shaded')],'lounge'),
 ];
 return forms.map(f=>validateComposition({version:1,siteMode:'fixed',id:f.id,name:f.id.replaceAll('-',' '),character:'Offline independently stacked architectural volume study.',appearance:{style:'modern',roof:'flat',exterior:'ivory',glazing:'panoramic',landscape:'mediterranean'},wings:[],connections:[],terraces:[],pool:null,garden:{x:0,z:0,width:64,depth:52},forms:[f]}));
}
