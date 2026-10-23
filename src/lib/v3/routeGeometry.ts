import { subtractJunctionVolume, type JunctionPlane } from './junctionGeometry';
import { v3MassLevelCount } from './stacking';
import { resolveFootprint, footprintContains } from './footprint';
import { facadeEdgeSpan, openingEdges } from './footprintConstruction';
import { localPlan } from './reviewGeometry';
import type { V3Scene, V3SceneObject, Vec3 } from './scene';
import type { V3EstatePlan } from './estatePlan';
import { sampleRoutePath, segmentPoint, segmentLength, segmentNormal } from './curvedFootprint';
import { worldPoint } from './junctions';
import { addressedStrips } from './accessPlanning';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { authoredPlan, authoredOverlap } from './authoredPlan';

export type EstateRoute = V3EstatePlan['circulation'][number];
/** Exact authored corridor collisions, independent of saved validation metadata. */
export function estateRouteObstacles(scene:V3Scene,route:EstateRoute):V3SceneObject[] {
  if(!route.spatial)return [];
  const segments=estateRouteSegments(scene,route);
  return scene.objects.filter(object=>!route.via.includes(object.id)
    && (object.type==='pool'||object.collision==='water'||object.type==='building-mass'||object.collision==='solid')
    && spatialParts(scene,object).some(part=>segments.some(segment=>authoredOverlap(segment,part)>.02
      && (object.type==='pool'||object.collision==='water'||getObjectTopY(part)>segment.transform.position[1]&&getObjectBaseY(part)<segment.transform.position[1]+2))));
}
/** Blueprint connections name the decision once. Never fall back to another door, legacy point or
 * mainEntry when a reference is missing, duplicated, on another host or above ground. */
export function estateRouteAccess(scene: V3Scene, route: EstateRoute, side: 'from' | 'to'): {point?: Vec3; openingId?: string; approachDistance?:number} | undefined {
  const access = route.spatial?.[side];
  if (!access?.entranceId) return access;
  if (access.point !== undefined || access.openingId !== undefined) return undefined;
  const entries = scene.estatePlan?.blueprint?.entrances.filter(e => e.id === access.entranceId) ?? [];
  const entry = entries[0];
  return entries.length === 1 && entry.objectId === route[side] && entry.level === 0
    ? {openingId: entry.openingId, approachDistance:access.approachDistance} : undefined;
}
/** Optional architect-chosen straight approach. Distance is intent; its world position follows
 * the very same wall address as the contact. This never searches for clearance or chooses a bend. */
export function estateEntranceApproach(scene: V3Scene, route: EstateRoute, side: 'from' | 'to'): Vec3 | undefined {
  const endpoint = route.spatial?.[side], distance = endpoint?.approachDistance;
  if (distance === undefined || !endpoint?.entranceId || !Number.isFinite(distance) || distance < .02 || distance > 100) return undefined;
  const contact = estateEndpoint(scene,route,side), access = estateRouteAccess(scene,route,side);
  const object = scene.objects.find(o=>o.id===route[side]);
  const opening = object?.composition?.openings?.find(o=>o.id===access?.openingId);
  if (!contact || !object || !opening || !('start' in opening)) return undefined;
  let normal: readonly [number,number];
  if (object.composition?.footprint?.kind === 'outline') {
    const segment = object.composition.footprint.segments?.find(s=>s.id===opening.segmentId);
    if (!segment) return undefined;
    normal = segmentNormal(segment,(opening.start+opening.end)/2);
  } else normal = opening.facade==='north' ? [0,-1] : opening.facade==='south' ? [0,1] : opening.facade==='east' ? [1,0] : [-1,0];
  const angle = object.transform.rotation[1], [x,z] = normal;
  return [contact[0]+distance*(x*Math.cos(angle)+z*Math.sin(angle)),contact[1],contact[2]+distance*(-x*Math.sin(angle)+z*Math.cos(angle))];
}
/** Omitted coordinates are resolved only from a named opening or an explicitly authored site access.
 * A surface centre, nearest door, boundary side or road location is never guessed. */
export function estateEndpoint(scene: V3Scene, route: EstateRoute, side: 'from' | 'to'): Vec3 | undefined {
  const access = estateRouteAccess(scene,route,side);
  if (!access) return undefined;
  if (access.point) return access.point;
  const boundary = scene.estatePlan?.siteAccess?.find(a => a.id === route[side]);
  if (boundary && !route.spatial?.[side].entranceId) return boundary.point;
  const object = scene.objects.find(o => o.id === route[side]);
  const op = object?.composition?.openings?.find(o => o.id === access.openingId);
  const blueprintEntrance = !!route.spatial?.[side].entranceId;
  if (blueprintEntrance) {
    if (!object || scene.objects.filter(o=>o.id===object.id).length!==1 || object.composition?.openings?.filter(o=>o.id===access.openingId).length!==1) return undefined;
    if (object.composition?.footprint && !resolveFootprint(object,0)) return undefined;
  }
  if (!object || object.type !== 'building-mass' || !op || !['door','glazed-door'].includes(op.type) || !('start' in op) || op.floors === 'upper') return undefined;
  if (blueprintEntrance && (!Number.isFinite(op.start) || !Number.isFinite(op.end) || op.start<0 || op.end>1 || op.end<=op.start)) return undefined;
  if (object.composition?.footprint?.kind==='outline') {
    const segment=object.composition.footprint.segments?.find(s=>s.id===op.segmentId);
    if (!segment || op.start<0 || op.end>1 || op.end<=op.start) return undefined;
    const [x,z]=segmentPoint(segment,(op.start+op.end)/2);
    return worldPoint(object,x,getObjectBaseY(object),z);
  }
  const [w,,d] = scaledDimensionsOf(object);
  const strips = addressedStrips({o:object,w,d}, 'endpoint', op.facade, op.start, op.end, .0001, getObjectBaseY(object), op.segmentId);
  // A rectangular or articulated opening must address exactly one wall strip.
  if (strips.length !== 1) return undefined;
  const p = strips[0].transform.position, angle = strips[0].transform.rotation[1];
  const normal = op.facade === 'north' ? [0,-1] : op.facade === 'south' ? [0,1] : op.facade === 'east' ? [1,0] : [-1,0];
  return [p[0] - (normal[0]*Math.cos(angle)+normal[1]*Math.sin(angle))*.00005, getObjectBaseY(object), p[2] - (-normal[0]*Math.sin(angle)+normal[1]*Math.cos(angle))*.00005];
}
export function estateRoutePoints(route: EstateRoute, scene?: V3Scene): Vec3[] {
  if (!route.spatial) return [];
  const a = scene ? estateEndpoint(scene,route,'from') : route.spatial.from.point;
  const b = scene ? estateEndpoint(scene,route,'to') : route.spatial.to.point;
  if (!a || !b) return [];
  if(route.spatial.path){
    if((route.spatial.waypoints?.length??0)>0||route.spatial.from.approachDistance!==undefined||route.spatial.to.approachDistance!==undefined)return [];
    const path=sampleRoutePath(route.spatial.path);
    if(!path||Math.hypot(path[0][0]-a[0],path[0][1]-a[2])>1e-6||Math.hypot(path.at(-1)![0]-b[0],path.at(-1)![1]-b[2])>1e-6)return [];
    return path.map(([x,z])=>[x,a[1],z]);
  }
  const approachFrom = scene ? estateEntranceApproach(scene,route,'from') : undefined;
  const approachTo = scene ? estateEntranceApproach(scene,route,'to') : undefined;
  if ((route.spatial.from.approachDistance !== undefined && !approachFrom) || (route.spatial.to.approachDistance !== undefined && !approachTo)) return [];
  const points = [a,...(approachFrom ? [approachFrom] : []),...(route.spatial.waypoints ?? []),...(approachTo ? [approachTo] : []),b];
  return points.filter((p,i) => i === 0 || p.some((v,k) => Math.abs(v-points[i-1][k])>1e-8));
}
export function estateRouteSupported(scene: V3Scene, route: EstateRoute): boolean {
  if (!route.spatial || !Number.isFinite(route.spatial.width) || route.spatial.width<=0 || route.via.length !== 1 || scene.siteHierarchy || scene.site.naturalGround && ((scene.site.naturalGround.grade??0)!==0 || scene.site.naturalGround.cliff)) return false;
  const owner = scene.objects.find(o => o.id === route.via[0]), points = estateRoutePoints(route,scene);
  return !(route.spatial.path?.some(s=>s.type==='arc'&&s.radius!<=route.spatial!.width/2+.1)) && !!owner && ['path','driveway'].includes(owner.type)
    && scene.estatePlan!.circulation.filter(r=>r.spatial && r.via.includes(owner.id)).length===1
    && points.length>=2 && points.every(p=>p.every(Number.isFinite) && Math.abs(p[1]-(scene.site.baseElevation??0))<.01)
    && points.slice(1).every((p,i)=>Math.hypot(p[0]-points[i][0],p[2]-points[i][2])>.01);
}
/** The sole path-to-corridor interpretation. Both geometric probes and render triangles are derived here.
 * Butt ends preserve existing flat ribbon output; no bounding rectangle fills a bend. */
export function resolveEstateRouteGeometry(scene:V3Scene,route:EstateRoute):{points:Vec3[];segments:V3SceneObject[];vertices:number[]}|undefined{
 if(!estateRouteSupported(scene,route))return undefined;
 const owner=scene.objects.find(o=>o.id===route.via[0])!,points=estateRoutePoints(route,scene),segments:V3SceneObject[]=[],vertices:number[]=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),width=route.spatial!.width,nx=-dz/length*width/2,nz=dx/length*width/2,y0=a[1]+.055,y1=b[1]+.055;
  segments.push({...owner,architecture:undefined,composition:undefined,dimensions:[width,.01,length],transform:{position:[(a[0]+b[0])/2,a[1]+.05,(a[2]+b[2])/2],rotation:[0,Math.atan2(dx,dz),0],scale:[1,1,1]}});
  vertices.push(a[0]+nx,y0,a[2]+nz,a[0]-nx,y0,a[2]-nz,b[0]-nx,y1,b[2]-nz,a[0]+nx,y0,a[2]+nz,b[0]-nx,y1,b[2]-nz,b[0]+nx,y1,b[2]+nz);
  if(route.spatial!.path&&i>0){
    const prev=points[i-1],pl=Math.hypot(a[0]-prev[0],a[2]-prev[2]),px=-(a[2]-prev[2])/pl*width/2,pz=(a[0]-prev[0])/pl*width/2;
    vertices.push(a[0],y0,a[2],a[0]+px,y0,a[2]+pz,a[0]+nx,y0,a[2]+nz,a[0],y0,a[2],a[0]-nx,y0,a[2]-nz,a[0]-px,y0,a[2]-pz);
  }
 }
 // A gate's boundary is authoritative. Trim only its terminal ribbon cap to
 // that plane, retaining the gate, centreline, bends and authored route width.
 let clipped=vertices;
 for(const side of ['from','to'] as const){
  const access=scene.estatePlan?.siteAccess?.find(a=>a.id===route[side]);
  if(!access || !siteAccessFits(scene,access.id,access.point))continue;
  const plane:JunctionPlane|undefined=access.boundary==='south'?{normal:[0,0,-1],constant:-scene.site.depth/2}:access.boundary==='north'?{normal:[0,0,1],constant:-scene.site.depth/2}:access.boundary==='east'?{normal:[-1,0,0],constant:-scene.site.width/2}:access.boundary==='west'?{normal:[1,0,0],constant:-scene.site.width/2}:undefined;
  if(!plane)continue;
  // Other route segments must already be inside; no arbitrary out-of-site bend is repaired.
  const rest=side==='from'?points.slice(1):points.slice(0,-1);
  if(rest.some(p=>plane.normal[0]*p[0]+plane.normal[2]*p[2]<=plane.constant+route.spatial!.width/2))continue;
  const mesh=subtractJunctionVolume({kind:'triMesh',id:owner.id,label:owner.label,category:'path',color:owner.material.color,vertices:clipped},[plane]);
  clipped=mesh?.kind==='triMesh'?mesh.vertices:[];
 }
 return {points,segments,vertices:clipped};
}
export const estateRouteSegments=(scene:V3Scene,route:EstateRoute)=>resolveEstateRouteGeometry(scene,route)?.segments??[];
export const estateRouteVertices=(scene:V3Scene,route:EstateRoute)=>resolveEstateRouteGeometry(scene,route)?.vertices??[];
/** All spatial audits use these parts for routed owners; compatibility boxes never supply occupied geometry. */
export function spatialParts(scene: V3Scene, object: V3SceneObject): V3SceneObject[] {
  const routes=scene.estatePlan?.circulation.filter(r=>r.spatial && r.via.includes(object.id)) ?? [];
  return routes.length ? routes.flatMap(r=>estateRouteSegments(scene,r)) : [object];
}
export function spatialPlanPoints(scene: V3Scene, object: V3SceneObject): [number,number][] {
  return spatialParts(scene,object).flatMap(o=>Array.from({length:o.type==='building-mass'?v3MassLevelCount(o):1},(_,floor)=>authoredPlan(o,floor)).flat());
}
export function siteAccessFits(scene: V3Scene, id: string, point: Vec3): boolean {
  const a=scene.estatePlan?.siteAccess?.find(a=>a.id===id);
  if (!a || scene.objects.some(o=>o.id===id) || point.some((v,k)=>Math.abs(v-a.point[k])>.01)) return false;
  const [x,y,z]=a.point, w=scene.site.width/2,d=scene.site.depth/2;
  return Math.abs(y-(scene.site.baseElevation??0))<.01 && Math.abs(x)<=w+.01 && Math.abs(z)<=d+.01 &&
    (a.boundary==='north'?Math.abs(z+d)<.01:a.boundary==='south'?Math.abs(z-d)<.01:a.boundary==='east'?Math.abs(x-w)<.01:a.boundary==='west'?Math.abs(x+w)<.01:Math.abs(Math.abs(x)-w)<.01 || Math.abs(Math.abs(z)-d)<.01);
}

export function endpointFits(object: V3SceneObject, access: {point: import('./scene').Vec3; openingId?: string; approachDistance?:number}, width: number, use: string, scene?:V3Scene): boolean {
  if(scene?.estatePlan?.circulation.some(r=>r.spatial&&r.via.includes(object.id)))return spatialParts(scene,object).some(part=>endpointFits(part,access,width,use));
  const [x,z] = localPlan(object,[access.point[0],access.point[2]]), [w,,d] = scaledDimensionsOf(object);
  if (Math.abs(access.point[1]-(object.type === 'building-mass' ? getObjectBaseY(object) : getObjectTopY(object))) > .25) return false;
  if (object.type !== 'building-mass') return Math.abs(x)<=w/2+.25 && Math.abs(z)<=d/2+.25 && footprintContains(object,[[x,z]]);
  const op = object.composition?.openings?.find(o => o.id === access.openingId);
  if (!op || !['door','glazed-door'].includes(op.type) || op.floors === 'upper' || !('start' in op)) return false;
  // An explicit approach is a drop-off on every footprint family, not a
  // requirement for a vehicle-width front door. Preserve full garage clearance.
  const clearance = use === 'pedestrian' || access.approachDistance !== undefined ? Math.min(width,.8) : width;
  if(object.composition?.footprint?.kind==='outline'){
    const segment=object.composition.footprint.segments?.find(s=>s.id===op.segmentId);if(!segment||!resolveFootprint(object,0))return false;
    const count=Math.max(2,Math.ceil(segmentLength(segment)*(op.end-op.start)/.1));
    const distance=Math.min(...Array.from({length:count+1},(_,i)=>{const p=segmentPoint(segment,op.start+(op.end-op.start)*i/count);return Math.hypot(p[0]-x,p[1]-z);}));
    return distance<=.25&&(op.end-op.start)*segmentLength(segment)>=clearance;
  }
  if (object.composition?.footprint) {
    const fp=resolveFootprint(object,0); if(!fp)return false;
    const horizontal=op.facade==='north'||op.facade==='south',span=horizontal?fp.frame.width:fp.frame.depth;
    const lx=x-fp.frame.x,lz=z-fp.frame.z,along=(horizontal?lx:lz)/span+.5;
    const edges=openingEdges(fp.edges,op.facade,op.start,op.end,fp.frame.width,fp.frame.depth);
    if(edges.length!==1)return false;
    const edge=edges[0],a=facadeEdgeSpan(edge,fp.frame.width,fp.frame.depth);
    return Math.abs((horizontal?lz:lx)-(horizontal?edge.a[1]:edge.a[0]))<=.25 && along>=Math.max(op.start,a.start) && along<=Math.min(op.end,a.end) && (Math.min(op.end,a.end)-Math.max(op.start,a.start))*span >= clearance;
  }
  const horizontal = op.facade === 'north' || op.facade === 'south', span = horizontal ? w : d;
  // Match compileV3Composition: north/south run +X; east/west run +Z.
  const along = (horizontal ? x : z) / span + .5;
  const edge = op.facade === 'north' ? -d/2 : op.facade === 'south' ? d/2 : op.facade === 'east' ? w/2 : -w/2;
  // A vehicle route with an explicit entrance approach is a drop-off, not a garage door.
  return Math.abs((horizontal ? z : x)-edge) <= .25 && along >= op.start && along <= op.end && (op.end-op.start)*span >= clearance;
}

/** Compatibility/selectable envelope only. Occupancy always uses the individual strips above. */
export function estateRouteBounds(scene:V3Scene,object:V3SceneObject):Pick<V3SceneObject,'transform'|'dimensions'>|undefined{
 const routes=scene.estatePlan?.circulation.filter(r=>r.spatial&&r.via.includes(object.id))??[];
 if(routes.length!==1 || !estateRouteSupported(scene,routes[0]))return undefined;
 const vertices=estateRouteVertices(scene,routes[0]),xs:number[]=[],zs:number[]=[];
 for(let i=0;i<vertices.length;i+=3){xs.push(vertices[i]);zs.push(vertices[i+2]);}
 const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 return {dimensions:[maxX-minX,.01,maxZ-minZ],transform:{position:[(minX+maxX)/2,(scene.site.baseElevation??0)+.05,(minZ+maxZ)/2],rotation:[0,0,0],scale:[1,1,1]}};
}

/** A ribbon edge may clip its own entrance host even with an exterior centreline.
 * Retain that localized approach defect for editing; a route through a building
 * or another obstacle remains blocking. No path is moved by this predicate. */
export function estateRouteClipsEntrance(scene:V3Scene, ids:readonly string[]):boolean {
 const routes=scene.estatePlan?.circulation.filter(r=>r.spatial&&r.via.some(id=>ids.includes(id)))??[];
 return routes.length>0&&routes.every(route=>{
  const host=scene.objects.find(o=>o.type==='building-mass'&&(ids.includes(o.id)||ids.every(id=>route.via.includes(id))&&[route.from,route.to].includes(o.id)));
  if(!host || !(['from','to'] as const).some(side=>route[side]===host.id&&route.spatial?.[side].entranceId))return false;
  return estateRouteSegments(scene,route).every(segment=>authoredOverlap({...segment,dimensions:[.00001,segment.dimensions[1],segment.dimensions[2]]},host)<.0001);
 });
}
