/** Explicit offline functional fixtures; never used in generation or saved project loading. */
import type { V3Scene, V3SceneObject } from '../scene';
import type { V3StairType } from '../interior';
export function stairFixture(type: V3StairType='straight'): V3Scene {
  const host:V3SceneObject={id:'house',type:'building-mass',label:'House',semanticRole:'residence',levels:2,roofForm:'flat',material:{id:'stone',color:'#eeeeee'},dimensions:[20,6.4,20],transform:{position:[0,3.2,0],rotation:[0,0,0],scale:[1,1,1]}};
  const sizes=type==='straight'?[1.2,5]:type==='u-shaped'?[2.6,4.2]:type==='l-shaped'?[4,4]:[3,3];
  return {version:3,site:{width:60,depth:60,baseElevation:0},objects:[host],relationships:[],metadata:{},interior:{storeys:[],rooms:[],circulation:[{id:'access',type:'stair',hostMassId:'house',fromLevel:0,toLevel:1,footprint:{x:0,z:0,width:sizes[0],depth:sizes[1]},direction:'north',stairType:type,turn:'right'}]}};
}
