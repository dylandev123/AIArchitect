import { curvedFixture } from './curved';
import { functionalMansion } from './functionalMansions';
import { estateFixtures } from '../__tests__/estatePlanFixtures';
import { expressiveCottage } from './cottage';
import { materializeV3ArchitecturalObject } from '../architecture';
import { ingestV3GenerationOutput } from '../ingestion';
import type { V3Scene } from '../scene';
export const READINESS_FIXTURES=['monumental-modern','mediterranean','circular-luxury','mixed-irregular','multi-building','conventional'] as const;
export type ReadinessFixture=typeof READINESS_FIXTURES[number];
export function readinessAuthored(name:ReadinessFixture):V3Scene{
 if(name==='monumental-modern')return functionalMansion('91d583fe');
 if(name==='conventional')return expressiveCottage();
 if(name==='circular-luxury'||name==='mixed-irregular'){
  const s=curvedFixture(name==='circular-luxury'?'circular-pavilion':'mixed-mansion');
  s.estatePlan={version:1,concept:name==='circular-luxury'?'A circular residence':'An irregular residence with a sweeping garden facade',character:'Stone and glass',requirements:[],program:[{id:'home-program',kind:'residence',role:'Residence',source:'design',objectIds:['residence']}],zones:[],circulation:[],relationships:[],considerations:[],architecture:[{id:'home-form',objectIds:['residence'],form:name==='circular-luxury'?'circular':'curved',intent:'Authored shell, not a proxy'}]};return s;
 }
 const s=estateFixtures()[1];
 if(name==='mediterranean'){
  s.estatePlan!.character='Mediterranean limestone and tile-roof estate';
  s.objects.filter(o=>o.type==='building-mass').forEach(o=>{o.roofForm='hip';o.pitch=25;o.material.surface='stucco';});
 }else s.estatePlan!.character='Large family compound with guest lodge and atelier';
 s.estatePlan!.circulation=[];
 for(const [id,x,z,originX] of [['main-residence',0,9,0],['guest-lodge',-35,6,-25],['atelier',35,5,25]] as const){
  const path=`walk-${id}`,owner=materializeV3ArchitecturalObject({...s.objects[3],id:path,architecture:{x,z:17,width:2,depth:16,height:.1,baseElevation:0}});
  s.objects.push(owner);
  s.estatePlan!.circulation.push({id:`route-${id}`,purpose:'Pedestrian access',from:'orchard',to:id,via:[path],spatial:{from:{point:[originX,0,24]},to:{point:[x,0,z],openingId:`${id}-door`},width:2,use:'pedestrian',...(x?{waypoints:[[x,0,24]] as [number,number,number][]}:{})}});
 }
 return s;
}
/** Synthetic provider response uses compact named geometry; production ingestion derives runtime arrays. */
export function readinessProvider(name:ReadinessFixture){
 const scene=readinessAuthored(name);
 const circulation=scene.interior?.circulation?.map(c=>{const host=scene.objects.find(o=>o.id===c.hostMassId)!,yaw=host.transform.rotation[1],f=c.footprint;return {id:c.id,type:c.type,hostId:c.hostMassId,fromLevel:c.fromLevel,toLevel:c.toLevel,x:host.transform.position[0]+f.x*Math.cos(yaw)+f.z*Math.sin(yaw),z:host.transform.position[2]-f.x*Math.sin(yaw)+f.z*Math.cos(yaw),width:f.width,depth:f.depth,stairType:c.stairType,direction:c.direction,turn:c.turn};});
 return {version:3,site:{width:scene.site.width,depth:scene.site.depth,baseElevation:scene.site.baseElevation,groundColor:scene.site.groundMaterial?.color},estatePlan:scene.estatePlan,relationships:scene.relationships,...(circulation?{circulation}:{}),
 objects:scene.objects.map(o=>{const {transform,dimensions,metadata,support,source,terrain,...semantic}=o;void metadata;void support;void source;void terrain;return {...semantic,...(!o.architecture?{transform,dimensions}:{})};})};
}
export function readinessFixture(name:ReadinessFixture){
 const result=ingestV3GenerationOutput(readinessProvider(name),'flat');
 if(!result.ok)throw new Error(JSON.stringify(result.validation.errors));
 return JSON.parse(JSON.stringify(result.scene)) as V3Scene;
}
