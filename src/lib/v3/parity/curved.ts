/** Offline authored designs, never generation templates. */
import { materializeV3ArchitecturalObject } from '../architecture';
import { footprintFixture } from './nonrectangular';
import type { PathSegment } from '../curvedFootprint';
import type { V3Composition } from '../composition';
export const CURVED_FIXTURES=['circular-pavilion','sweeping-residence','mixed-mansion'] as const;
export type CurvedFixture=typeof CURVED_FIXTURES[number];
export function curvedFixture(name:CurvedFixture){
 const scene=footprintFixture('chamfered'),mass=scene.objects[0];
 scene.objects=[mass];scene.metadata={fixture:name};
 mass.label=name;mass.roofForm=name==='sweeping-residence'?'terrace':'flat';mass.overhang=.4;
 mass.architecture={x:0,z:0,width:28,depth:22,height:name==='mixed-mansion'?7.6:4.2,baseElevation:.15};
 mass.levels=name==='mixed-mansion'?2:1;
 const circle:PathSegment[]=[{id:'rotunda',type:'arc',center:[0,0],radius:8,startAngle:0,sweep:360}];
 const sweep:PathSegment[]=[{id:'arrival',type:'line',start:[-10,-7],end:[10,-7]},{id:'east',type:'line',start:[10,-7],end:[10,-3]},{id:'sweep',type:'arc',center:[0,-3],radius:10,startAngle:0,sweep:180},{id:'west',type:'line',start:[-10,-3],end:[-10,-7]}];
 const mixed:PathSegment[]=[{id:'arrival',type:'line',start:[-12,-7],end:[6,-7]},{id:'sweep',type:'arc',center:[6,0],radius:7,startAngle:-90,sweep:180},{id:'garden',type:'line',start:[6,7],end:[-4,7]},{id:'return',type:'line',start:[-4,7],end:[-4,3]},{id:'wing',type:'line',start:[-4,3],end:[-12,3]},{id:'west',type:'line',start:[-12,3],end:[-12,-7]}];
 const pavilion=name==='circular-pavilion',segmentId=pavilion?'rotunda':'arrival';
 const openings:NonNullable<V3Composition['openings']>=[
  {id:'entry',type:'door',facade:'north',segmentId,start:pavilion?.72:.43,end:pavilion?.78:.57,height:2.8,floors:'ground'},
  {id:'view',type:'glazing-zone',facade:'south',segmentId:pavilion?'rotunda':'sweep',start:.04,end:pavilion?.38:.96,heightRatio:.82},
  ...(pavilion?[{id:'side-view',type:'glazing-zone' as const,facade:'west' as const,segmentId:'rotunda',start:.42,end:.66,heightRatio:.82},{id:'east-view',type:'glazing-zone' as const,facade:'east' as const,segmentId:'rotunda',start:.82,end:.96,heightRatio:.82}]:[{id:'arrival-west',type:'glazing-zone' as const,facade:'north' as const,segmentId:'arrival',start:.06,end:.34,heightRatio:.7},{id:'arrival-east',type:'glazing-zone' as const,facade:'north' as const,segmentId:'arrival',start:.66,end:.94,heightRatio:.7}]),
  ...(name==='mixed-mansion'?[{id:'garden-door',type:'glazed-door' as const,facade:'south' as const,segmentId:'garden',start:.1,end:.8,height:2.9,floors:'ground' as const,operation:'sliding' as const}]:[]),
 ];
 mass.composition={footprint:{kind:'outline',operations:[],segments:pavilion?circle:name==='sweeping-residence'?sweep:mixed},openings,mainEntry:{openingId:'entry',canopyDepth:1.2},assemblies:pavilion?[]:[{id:'sunshade',intent:'Continuous shade following the garden curve',parts:[{id:'canopy',type:'slab',facade:'south',segmentId:'sweep',start:.03,end:.97,depth:.85,elevation:name==='mixed-mansion'?3.45:3.85,thickness:.12}]}]};
 if(name==='mixed-mansion')scene.interior={storeys:[],rooms:[],circulation:[{id:'west-wing-stair',type:'stair',hostMassId:mass.id,fromLevel:0,toLevel:1,stairType:'straight',direction:'south',footprint:{x:-8,z:-2,width:1.4,depth:6.8}}]};
 scene.objects=scene.objects.map(materializeV3ArchitecturalObject);
 return scene;
}
