/** Offline acceptance scenes: authored semantics only, compiled by the production V3 path. */
import type { V3Scene, V3SceneObject } from '../scene';
import { materializeV3ArchitecturalObject } from '../architecture';
import type { V3Footprint } from '../footprint';
export const FOOTPRINT_FIXTURES=['l-residence','u-courtyard','chamfered'] as const;
export type FootprintFixture=typeof FOOTPRINT_FIXTURES[number];
export function footprintFixture(name:FootprintFixture):V3Scene{
 const operations:V3Footprint['operations']=name==='l-residence'?[{id:'garden-cut',type:'notch',corner:'se',width:9,depth:7}]:name==='u-courtyard'?[{id:'court',type:'recess',facade:'south',start:.28,end:.72,depth:10}]:(['nw','ne','se','sw'] as const).map(corner=>({id:`corner-${corner}`,type:'chamfer' as const,corner,size:3,glazed:corner==='se'||corner==='sw'}));
 const mass:V3SceneObject=materializeV3ArchitecturalObject({id:'residence',type:'building-mass',label:name,semanticRole:'residence',architecture:{x:0,z:0,width:24,depth:18,height:name==='u-courtyard'?6.8:3.6,baseElevation:.15},dimensions:[24,3.6,18],transform:{position:[0,1.95,0],rotation:[0,0,0],scale:[1,1,1]},material:{id:'limestone',color:name==='chamfered'?'#c4b49b':'#e7e1d6',surface:'stone',roughness:.75},levels:name==='u-courtyard'?2:1,roofForm:name==='chamfered'?'mono-pitch':name==='u-courtyard'?'floating-flat':'flat',pitch:8,overhang:.5,composition:{footprint:{kind:'articulated',operations},openings:[
  {id:'entry',type:'door',facade:'north',start:.46,end:.54,height:2.5,floors:'ground'},
  {id:'north-west',type:'glazing-zone',facade:'north',start:.18,end:.38,heightRatio:.7},
  {id:'north-east',type:'glazing-zone',facade:'north',start:.62,end:.82,heightRatio:.7},
  {id:'garden-door',type:'glazed-door',facade:'south',start:name==='l-residence'?.1:.34,end:name==='l-residence'?.4:.66,height:2.7,floors:'ground',operation:'sliding'},
  ...(name==='u-courtyard'?[{id:'court-upper',type:'glazing-zone' as const,facade:'south' as const,start:.34,end:.66,heightRatio:.8,floors:'upper' as const}]:[]),
  {id:'west-view',type:'glazing-zone',facade:'west',start:.22,end:.78,heightRatio:.8},
 ],mainEntry:{openingId:'entry',canopyDepth:1.4}}});
 const other=materializeV3ArchitecturalObject({...mass,id:'unrelated-studio',label:'Unrelated studio',semanticRole:'studio',architecture:{x:-21,z:-4,width:6,depth:7,height:3.2,baseElevation:.15},levels:1,roofForm:'flat',composition:{openings:[{id:'studio-glass',type:'glazing-zone',facade:'south',start:.1,end:.9,heightRatio:.8}]}});
 return {version:3,site:{width:70,depth:50,groundMaterial:{id:'grass',color:'#738267',surface:'grass'}},objects:[mass,other],relationships:[],metadata:{fixture:name}};
}
