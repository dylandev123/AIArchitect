/** Read-only architectural projections. No provider, persistence, or alternate scene authority. */
import { siteFeaturePlanRegions } from './siteFeatureConstruction';
import { estateRouteSegments } from './routeGeometry';
import { isV3PlanEvaluation } from './architecturalPlanEvaluation';
import { Euler, Vector3 } from 'three';
import type { HouseModel, HousePrimitive } from '@/lib/house/types';
import type { ArchitecturalWorkspaceView } from '@/types/project';
import type { V3Scene } from './scene';
import { authoredPlan, type PlanPoint } from './authoredPlan';
import { materializeV3ArchitecturalObject } from './architecture';
import { hostLocalToWorld, resolveV3Room, resolveV3Storey } from './interior';
import { deriveV3InteriorWalls } from './interiorWalls';

export const DEFAULT_ARCHITECTURAL_VIEW: ArchitecturalWorkspaceView = { mode:'finished', floor:0, buildingId:null, cutaway:true };
export type PlanSegment = [PlanPoint, PlanPoint];
export interface PlanDrawing {
  buildings: {id:string;label:string;polygon:PlanPoint[];floorY?:number}[];
  rooms: {id:string;label:string;polygon:PlanPoint[];centre:PlanPoint;width:number;depth:number;program:string}[];
  openings: {id:string;segment:PlanSegment}[];
  siteFeatures: {id:string;label:string;type:string;depth:number;centre:PlanPoint}[];
  parts: {id:string;owner:string;category:HousePrimitive['category'];paths:PlanPoint[][];section:boolean}[];
}

/** Box faces and triangle soups use their exact production transforms, including all three Euler axes. */
export function primitiveTriangles(p:HousePrimitive):number[][] {
  if(p.kind==='triMesh') return Array.from({length:p.vertices.length/9},(_,i)=>p.vertices.slice(i*9,i*9+9));
  const rotation=new Euler(...p.rotation), [w,h,d]=p.size.map(v=>v/2);
  const points=[[-w,-h,-d],[w,-h,-d],[w,-h,d],[-w,-h,d],[-w,h,-d],[w,h,-d],[w,h,d],[-w,h,d]]
    .map(v=>new Vector3(...v as [number,number,number]).applyEuler(rotation).add(new Vector3(...p.position)).toArray());
  return [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]].map(t=>t.flatMap(i=>points[i]));
}

/** Horizontal section through the constructed solid: headers above the plane cannot fill door apertures. */
export function sectionTriangle(t:number[],y:number):PlanSegment|undefined {
  const hits:PlanPoint[]=[];
  for(let i=0;i<3;i++) {
    const a=t.slice(i*3,i*3+3),b=t.slice(((i+1)%3)*3,((i+1)%3)*3+3);
    if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)) {
      const f=(y-a[1])/(b[1]-a[1]);
      hits.push([a[0]+f*(b[0]-a[0]),a[2]+f*(b[2]-a[2])]);
    }
  }
  return hits.length===2&&Math.hypot(hits[0][0]-hits[1][0],hits[0][1]-hits[1][1])>1e-7?[hits[0],hits[1]]:undefined;
}

export function planningHostId(scene:V3Scene,p:HousePrimitive):string|undefined {
  const id=p.sourceObjectId;
  const interior=scene.interior;
  const room=interior?.rooms.find(r=>r.id===id),storey=interior?.storeys.find(s=>s.id===id);
  const partition=interior?.partitions?.find(r=>r.id===id||r.id===interior.doors?.find(d=>d.id===id)?.partitionId);
  return room?.hostMassId??storey?.hostMassId??interior?.storeys.find(s=>s.id===partition?.storeyId)?.hostMassId
    ??interior?.circulation?.find(c=>c.id===id)?.hostMassId
    ??scene.objects.find(o=>o.id===id&&o.type==='building-mass')?.id;
}

export function planningSectionY(scene:V3Scene,hostId:string,floor:number):number|undefined {
  const storey=scene.interior?.storeys.find(s=>s.hostMassId===hostId&&s.index===floor);
  const resolved=storey&&resolveV3Storey(scene,storey.id);
  return resolved?resolved.floorY+Math.min(1.2,(resolved.ceilingY-resolved.floorY)*.55):undefined;
}

const sectionCategories=new Set(['wall','window','door','building','curvedWall','arch','bay']);
const siteCategories=new Set(['patio','pool','driveway','road','parking','landscape','deck','porch','path','waterway','stairs','retainingWall','balcony']);
export function deriveArchitecturalPlan(scene:V3Scene,model:HouseModel|null,floor:number|null):PlanDrawing {
  const buildings=scene.objects.filter(o=>o.type==='building-mass'&&(floor===null||scene.interior?.storeys.some(s=>s.hostMassId===o.id&&s.index===floor))).map(o=>{
    const host=materializeV3ArchitecturalObject(o),storey=scene.interior?.storeys.find(s=>s.hostMassId===o.id&&s.index===(floor??0));
    return {id:o.id,label:o.label,polygon:authoredPlan(host,floor??0),floorY:storey&&resolveV3Storey(scene,storey.id)?.floorY};
  });
  const rooms=(floor===null?[]:scene.interior?.rooms??[]).flatMap(r=>{
    const resolved=resolveV3Room(scene,r.id);
    return resolved?.storey.index===floor?[{id:r.id,label:r.label,polygon:resolved.corners,centre:resolved.centre,width:r.footprint.width,depth:r.footprint.depth,program:r.program}]:[];
  });
  const parts:PlanDrawing['parts']=[];
  for(const p of model?.primitives??[]) {
    if(p.id==='v3-terrain-surface'||p.id==='v3-terrain-rock')continue;
    const hostId=planningHostId(scene,p),isSection=floor!==null&&!!hostId&&sectionCategories.has(p.category);
    if(!isSection&&!siteCategories.has(p.category))continue;
    if(!hostId&&p.category==='stairs'&&floor!==null&&floor>0)continue;
    const y=hostId&&floor!==null?planningSectionY(scene,hostId,floor):undefined;
    if(hostId&&floor!==null&&y===undefined)continue;
    const triangles=primitiveTriangles(p);
    const paths:PlanPoint[][]=isSection?triangles.flatMap(t=>{const segment=sectionTriangle(t,y!);return segment?[segment]:[];}):triangles.flatMap(t=>{
      // Production triangle soups are double-sided and do not promise winding.
      // Project every nondegenerate face; coincident fills visually form their exact footprint.
      const area=(t[3]-t[0])*(t[8]-t[2])-(t[5]-t[2])*(t[6]-t[0]);
      if(Math.abs(area)<=1e-7||y!==undefined&&Math.min(t[1],t[4],t[7])>y)return [];
      const polygon:PlanPoint[]=[[t[0],t[2]],[t[3],t[5]],[t[6],t[8]]];
      return [area<0?polygon.reverse():polygon];
    });
    if(paths.length)parts.push({id:p.id,owner:p.sourceObjectId??p.id,category:p.category,paths,section:isSection});
  }
  if(isV3PlanEvaluation(scene)){
    for(const o of scene.objects.filter(o=>scene.estatePlan?.blueprint?.outdoorObjectIds.includes(o.id)))parts.push({id:o.id,owner:o.id,category:o.type==='pool'||o.type==='fountain'?'pool':o.type==='landscape-zone'?'landscape':o.type==='driveway'?'driveway':'patio',paths:siteFeaturePlanRegions(o,scene),section:false});
    for(const reservation of scene.interior?.circulation??[]){
      const host=scene.objects.find(o=>o.id===reservation.hostMassId);
      if(!host||floor===null||floor<reservation.fromLevel||floor>reservation.toLevel)continue;
      const f=reservation.footprint;
      const corners:PlanPoint[]=[[f.x-f.width/2,f.z-f.depth/2],[f.x+f.width/2,f.z-f.depth/2],[f.x+f.width/2,f.z+f.depth/2],[f.x-f.width/2,f.z+f.depth/2]];
      parts.push({id:reservation.id,owner:reservation.id,category:'stairs',paths:[corners.map(p=>hostLocalToWorld(host,p))],section:false});
    }
    for(const route of scene.estatePlan?.circulation??[])for(const [i,segment] of estateRouteSegments(scene,route).entries())parts.push({id:`${route.id}-${i}`,owner:route.via[0],category:'path',paths:[authoredPlan(segment)],section:false});
  }
  const openings:PlanDrawing['openings']=[];
  if(floor!==null)for(const wall of deriveV3InteriorWalls(scene)) {
    const resolved=resolveV3Storey(scene,wall.boundary.storeyId);
    if(!resolved||resolved.storey.index!==floor||!wall.construction||!wall.segments.length)continue;
    const point=(offset:number)=>hostLocalToWorld(resolved.host,wall.boundary.axis==='x'?[wall.boundary.at,offset]:[offset,wall.boundary.at]);
    for(const opening of wall.openings)openings.push({id:opening.doorId,segment:[point(wall.boundary.from+opening.start),point(wall.boundary.from+opening.end)]});
  }
  const siteFeatures=scene.objects.filter(o=>scene.estatePlan?.blueprint?.outdoorObjectIds.includes(o.id)).map(o=>({id:o.id,label:o.label,type:o.type,depth:o.architecture?.depth??o.dimensions[2],centre:[o.transform.position[0],o.transform.position[2]] as PlanPoint}));
  return {buildings,rooms,parts,openings,siteFeatures};
}
