/** Disposable architectural intent -> existing rectangular room datums.
 * Terra chooses topology, compass order and proportions. No packing/search,
 * automatic corridor, shell edits, clipping or alternative layout is invented. */
import { z } from 'zod';
import type { V3ArchitecturalPlan } from './architecturalPlanFirst';
import { lowerV3ArchitecturalPlan } from './architecturalPlanFirst';
import { localRectangleFits } from './blueprint';
import { sharedBoundaryLength, type V3RoomFootprint } from './interior';
import type { V3BlueprintFinding } from './blueprint';

const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{1,63}$/);
const n = z.number().finite();
const rect = z.object({x:n,z:n,width:n.positive(),depth:n.positive()}).strict();
export const roomSizeIntentSchema = z.object({
  minWidth:n.positive().optional(), minDepth:n.positive().optional(),
  maxAspect:n.min(1).optional(),
}).strict();
export const roomLayoutSchema = z.object({
  regions:z.array(z.object({
    root:id,
    bounds:rect.optional().describe('Host-local functional wing/zone envelope. Required for nonrectangular shells. Every region must fit the actual storey and not overlap another region. Omit only for one region occupying a rectangular shell.'),
  }).strict()).min(1).max(100),
  nodes:z.array(z.discriminatedUnion('kind',[
    z.object({id,kind:z.literal('room'),roomId:id}).strict(),
    z.object({id,kind:z.literal('reserve'),purpose:z.string().min(1).max(100)}).strict(),
    z.object({id,kind:z.literal('split'),zone:z.string().min(1).max(100),axis:z.enum(['x','z']),
      children:z.array(z.object({node:id,weight:n.positive()}).strict()).min(2).max(100),
    }).strict(),
  ])).min(1).max(300),
}).strict().describe('Relationship-first subdivision. Order along x is west to east, z is north to south; weights divide the parent span proportionally, with exact common edges. Internal nodes are functional zones. Reserve leaves remain unallocated, never invented rooms or floor-slab voids.');
export type RoomLayout = z.infer<typeof roomLayoutSchema>;
export interface RoomLayoutRequest {
  storeyId:string;
  layout:RoomLayout;
  spaces:{id:string;label:string;role:string;program:string;footprint?:V3RoomFootprint;size?:z.infer<typeof roomSizeIntentSchema>}[];
}
export interface RoomLayoutDraft extends RoomLayoutRequest {findings:V3BlueprintFinding[]}
const overlap = (a:V3RoomFootprint,b:V3RoomFootprint) => Math.min(a.x+a.width/2,b.x+b.width/2)-Math.max(a.x-a.width/2,b.x-b.width/2)>1e-7 && Math.min(a.z+a.depth/2,b.z+b.depth/2)-Math.max(a.z-a.depth/2,b.z-b.depth/2)>1e-7;
const contains = (a:V3RoomFootprint,b:V3RoomFootprint) => Math.abs(a.x-b.x)+b.width/2<=a.width/2+1e-7 && Math.abs(a.z-b.z)+b.depth/2<=a.depth/2+1e-7;
export const roomsShareAccessBoundary = (a:V3RoomFootprint,b:V3RoomFootprint) =>
  (Math.abs(Math.abs(a.x-b.x)-(a.width+b.width)/2)<1e-7||Math.abs(Math.abs(a.z-b.z)-(a.depth+b.depth)/2)<1e-7)&&sharedBoundaryLength(a,b)>=.8-1e-7;

/** Atomic per storey. A contradiction keeps provided previews unchanged, or leaves
 * geometry absent with the complete intent in the draft. Never persist a second live layout. */
export function developRoomLayouts(input:V3ArchitecturalPlan, requests:RoomLayoutRequest[]) {
  const plan=structuredClone(input), drafts:RoomLayoutDraft[]=[], findings:V3BlueprintFinding[]=[];
  const developed:string[]=[];
  if(!requests.length)return {plan,drafts,findings,developed};
  // Malformed shells are diagnosed by the normal plan preflight, before any
  // attempt to invent a usable envelope. Keep their room intentions intact.
  let shell:ReturnType<typeof lowerV3ArchitecturalPlan>;
  try{shell=lowerV3ArchitecturalPlan({...plan,connections:[]});}
  catch{
    for(const request of requests){const f:V3BlueprintFinding={code:'ROOM_LAYOUT_UNRESOLVED',severity:'advisory',targetIds:[request.storeyId],message:'The host shell cannot yet be resolved; room intent is retained.'};drafts.push({...structuredClone(request),findings:[f]});findings.push(f);}
    return {plan,drafts,findings,developed};
  }
  for(const request of requests){
    const building=plan.buildings.find(b=>b.storeys.some(s=>s.id===request.storeyId));
    const storey=building?.storeys.find(s=>s.id===request.storeyId);
    const host=shell.objects.find(o=>o.id===building?.id);
    const failures:V3BlueprintFinding[]=[];
    const fail=(message:string,ids:string[]=[])=>failures.push({code:'ROOM_LAYOUT_UNRESOLVED',severity:'advisory',targetIds:[request.storeyId,...ids],message});
    if(!building||!storey||!host){fail('Layout references an unknown storey.');drafts.push({...structuredClone(request),findings:failures});findings.push(...failures);continue;}
    const level=building.storeys.indexOf(storey), nodes=new Map(request.layout.nodes.map(n=>[n.id,n]));
    if(nodes.size!==request.layout.nodes.length)fail('Layout node IDs must be unique.');
    const proposed=new Map<string,V3RoomFootprint>(),visited=new Set<string>();
    const walk=(nodeId:string,bounds:V3RoomFootprint)=>{
      const node=nodes.get(nodeId);
      if(!node||visited.has(nodeId)){fail('Layout has a missing, repeated or cyclic node.',[nodeId]);return;}
      visited.add(nodeId);
      if(node.kind==='reserve')return;
      if(node.kind==='room'){
        if(proposed.has(node.roomId)||!request.spaces.some(r=>r.id===node.roomId))fail('Each room leaf must name one unique room on this storey.',[node.roomId]);
        else proposed.set(node.roomId,bounds);
        return;
      }
      const total=node.children.reduce((s,c)=>s+c.weight,0),span=node.axis==='x'?bounds.width:bounds.depth;
      if(!Number.isFinite(total)){fail('Split weights exceed the numeric range.',[node.id]);return;}
      let at=(node.axis==='x'?bounds.x:bounds.z)-span/2;
      for(const [i,child] of node.children.entries()){
        const end=i===node.children.length-1?(node.axis==='x'?bounds.x:bounds.z)+span/2:at+span*child.weight/total;
        const next={...bounds,...(node.axis==='x'?{x:(at+end)/2,width:end-at}:{z:(at+end)/2,depth:end-at})};
        if(end-at<.01){fail('Subdivision produces a degenerate span.',[child.node]);continue;}
        walk(child.node,next);at=end;
      }
    };
    const regions:V3RoomFootprint[]=[];
    for(const region of request.layout.regions){
      const bounds=region.bounds??(building.plan.kind==='rectangle'&&request.layout.regions.length===1?{x:0,z:0,width:building.plan.width,depth:building.plan.depth}:undefined);
      if(!bounds){fail('Choose explicit functional region bounds inside this nonrectangular shell.');continue;}
      if(!localRectangleFits(host,bounds,level))fail('Functional region leaves the actual host storey footprint.',[region.root]);
      if(regions.some(r=>overlap(r,bounds)))fail('Functional regions overlap; choose a nonoverlapping decomposition.',[region.root]);
      regions.push(bounds);walk(region.root,bounds);
    }
    if(visited.size!==nodes.size)fail('Layout contains unused nodes; no design intention is silently discarded.');
    for(const room of request.spaces){
      const f=proposed.get(room.id),size=room.size;
      if(!f){fail('Room is not allocated by the layout.',[room.id]);continue;}
      if(!localRectangleFits(host,f,level))fail('Developed room leaves the actual storey footprint.',[room.id]);
      if(size&&(f.width<(size.minWidth??0)-1e-7||f.depth<(size.minDepth??0)-1e-7||Math.max(f.width/f.depth,f.depth/f.width)>(size.maxAspect??Infinity)+1e-7))fail('Chosen zone proportions cannot satisfy this room size intention.',[room.id]);
      if(/\b(hall|foyer|gallery|corridor|circulation|landing|entry|vestibule)\b/i.test(room.program)&&Math.min(f.width,f.depth)<.9-1e-7)fail('Circulation is narrower than the 0.9m schematic minimum.',[room.id]);
      if(room.footprint&&JSON.stringify(room.footprint)!==JSON.stringify(f))fail('Both a layout and a conflicting explicit room footprint were supplied. Choose one geometry authority.',[room.id]);
    }
    for(const pair of plan.roomAdjacencies){
      const a=proposed.get(pair.from),b=proposed.get(pair.to);
      if(a&&b&&!roomsShareAccessBoundary(a,b))fail('Required adjacency has less than 0.8m of shared boundary; revise the architectural subdivision.',[pair.from,pair.to]);
    }
    for(const c of plan.verticalCirculation.filter(c=>c.hostMassId===building.id&&level>=c.fromLevel&&level<=c.toLevel)){
      if(!request.spaces.some(r=>/\b(stair|lift|hall|landing|circulation)\b/i.test(r.program)&&proposed.has(r.id)&&contains(proposed.get(r.id)!,c.footprint)))fail('An aligned stair/lift hall must contain the fixed reservation on every connected storey.',[c.id]);
    }
    if(failures.length){drafts.push({...structuredClone(request),findings:failures});findings.push(...failures);continue;}
    storey.spaces=request.spaces.map(({size,footprint,...room})=>{void size;void footprint;return {...room,footprint:proposed.get(room.id)!};});
    developed.push(storey.id);
  }
  return {plan,drafts,findings,developed};
}
