import type { V3SceneObject } from './scene';
import { resolveFootprint } from './footprint';
import { openingEdges, facadeEdgeSpan } from './footprintConstruction';
import { segmentPoint, segmentNormal, segmentLength } from './curvedFootprint';
import { worldPoint, type JunctionFacade } from './junctions';
import { getObjectBaseY } from './elevation';

/** Shared semantic wall/threshold probes. No construction or mesh inspection. */
interface PlanMass { o: V3SceneObject; w: number; d: number; }

/** A plan box in an object's local frame, as a probe object for the shared convex overlap test. */
export function probe(frame: V3SceneObject, id: string, lx: number, lz: number, width: number, depth: number, y = getObjectBaseY(frame)): V3SceneObject {
  const p = worldPoint(frame, lx, y, lz);
  return { ...frame, id, architecture: undefined, dimensions: [Math.max(.01, width), 1, Math.max(.01, depth)], transform: { position: [p[0], y + .5, p[2]], rotation: [0, frame.transform.rotation[1], 0], scale: [1, 1, 1] } };
}
export const facadeLength = (m: PlanMass, f: JunctionFacade) => f === "north" || f === "south" ? m.w : m.d;
/** Mass-local outward strip in front of a facade span [a,b] (metres from the facade centre). */
function strip(m: PlanMass, id: string, facade: JunctionFacade, a: number, b: number, depth: number, y: number): V3SceneObject {
  const along = (a + b) / 2, length = b - a, out = (facade === "north" || facade === "south" ? m.d : m.w) / 2 + depth / 2;
  if (facade === "north") return probe(m.o, id, along, -out, length, depth, y);
  if (facade === "south") return probe(m.o, id, along, out, length, depth, y);
  if (facade === "east") return probe(m.o, id, out, along, depth, length, y);
  return probe(m.o, id, -out, along, depth, length, y);
}
/** Small tangent probes follow semantic curves for access auditing, never the placement box. */
export function addressedStrips(m:PlanMass,id:string,facade:JunctionFacade,start:number,end:number,depth:number,y:number,segmentId?:string,level=0):V3SceneObject[]{
 if(m.o.composition?.footprint&&m.o.composition.footprint.kind!=='outline'){
  const fp=resolveFootprint(m.o,level);if(!fp)return [];
  const {width:w,depth:d}=fp.frame;
  return openingEdges(fp.edges,facade,start,end,w,d).flatMap(e=>{
   const a=facadeEdgeSpan(e,w,d);
   if(a.start>start+1e-6||a.end<end-1e-6)return [];
   const adjusted={...m,w,d},length=facade==='north'||facade==='south'?w:d;
   const result=strip(adjusted,id,facade,start*length-length/2,end*length-length/2,depth,y);
   const offset=worldPoint(m.o,a.x+fp.frame.x,0,a.z+fp.frame.z);
   result.transform.position[0]+=offset[0]-m.o.transform.position[0];
   result.transform.position[2]+=offset[2]-m.o.transform.position[2];
   return [result];
  });
 }
 if(m.o.composition?.footprint?.kind!=='outline'){const length=facadeLength(m,facade);return [strip(m,id,facade,start*length-length/2,end*length-length/2,depth,y)];}
 const segment=m.o.composition.footprint.segments?.find(s=>s.id===segmentId);
 if(!segment)return [];
 const length=segmentLength(segment)*(end-start),steps=Math.max(1,Math.ceil(length/.35));
 return Array.from({length:steps},(_,i)=>{
  const u=start+(end-start)*(i+.5)/steps,p=segmentPoint(segment,u),n=segmentNormal(segment,u);
  const result=probe(m.o,id,p[0]+n[0]*depth/2,p[1]+n[1]*depth/2,length/steps,depth,y);
  result.transform.rotation=[0,m.o.transform.rotation[1]+Math.atan2(-n[0],-n[1]),0];
  return result;
 });
}
