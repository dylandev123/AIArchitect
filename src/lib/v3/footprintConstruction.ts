import { bendFacade, segmentLength, segmentPoint, offsetPath, type PathSegment } from './curvedFootprint';
import { compileDetailedRoof } from './construction';
import { ENTRY_DOOR_FINISH } from './compositionPolicies';
/** V3 adapter around shared architectural geometry. No V2 pipeline or document mutation. */
import { buildMassOpenings, buildPlainWallEdge, buildGlazedWallEdge, buildColonnadePosts } from '@/lib/architecture/geometry/openings';
import { buildArchitecturalAssemblies } from '@/lib/architecture/geometry/assemblies';
import { offsetFootprintOutline, type WallEdge } from '@/lib/architecture/geometry/footprint';
import { buildPolygonRoofPlate, buildPolygonShedRoof } from '@/lib/architecture/geometry/roofPlate';
import { box } from '@/lib/house/architecture/parts';
import { extrudeOutline, triMeshOf } from '@/lib/house/geometry/mesh';
import type { HousePrimitive } from '@/lib/house/types';
import type { V3SceneObject, V3Material } from './scene';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { resolveFootprint, edgeFacade, simpleFootprint } from './footprint';
import { builderOpening, glazeDoorLeaves, semanticCompositionChildId, semanticOpeningIds, stackedStoreyOpenings, resolvedFacadeComposition, type V3Composition } from './composition';
import { v3MassLevelCount } from './stacking';
import { resolveV3FootprintRoofPlan } from './roofPlanning';

export interface FootprintDiagnostic { code:string; targetId:string; message:string }
const paint=(m:V3Material)=>({color:m.color,roughness:m.roughness??.72,metalness:m.metalness??0});
const trim={color:'#263036',roughness:.38,metalness:.7};
const glass={color:'#8fbdc9',roughness:.1,metalness:.08,transparent:true,opacity:.42};
function shift(parts:HousePrimitive[],x:number,z:number):HousePrimitive[]{return parts.map(p=>p.kind==='box'?{...p,position:[p.position[0]+x,p.position[1],p.position[2]+z]}:p.kind==='triMesh'?{...p,vertices:p.vertices.map((v,i)=>v+(i%3===0?x:i%3===2?z:0))}:p);}
function place(o:V3SceneObject,parts:HousePrimitive[],base=getObjectBaseY(o)):HousePrimitive[]{
 const c=Math.cos(o.transform.rotation[1]),s=Math.sin(o.transform.rotation[1]);
 const point=(x:number,y:number,z:number):[number,number,number]=>[o.transform.position[0]+x*c+z*s,base+y,o.transform.position[2]-x*s+z*c];
 return parts.map(p=>{
  const id=semanticCompositionChildId(p.id.startsWith(`${o.id}:`)?p.id:`${o.id}-${p.id}`);
  const surface=p.category==='floor'?'concrete':p.category==='wall'||p.category==='roof'?o.material.surface:undefined;
  const common={...p,...(surface&&!['water','grass','paving'].includes(surface)?{surface:surface as 'concrete'|'stone'|'wood'|'glass'|'metal'|'stucco'}:{}),id,sourceObjectId:o.id,semanticRole:o.semanticRole,componentRole:p.category==='floor'?'floor slab':p.category==='roof'?p.label.toLowerCase():p.category==='window'?(p.transparent?'facade glazing':'glazing frame'):'facade wall'};
  if(p.kind==='box')return {...common,kind:'box' as const,size:p.size,position:point(...p.position),rotation:[p.rotation[0],p.rotation[1]+o.transform.rotation[1],p.rotation[2]] as [number,number,number]};
  if(p.kind==='triMesh'){const vertices:number[]=[];for(let i=0;i<p.vertices.length;i+=3)vertices.push(...point(p.vertices[i],p.vertices[i+1],p.vertices[i+2]));return {...common,kind:'triMesh' as const,vertices};}
  return common;
 });
}
export function facadeEdgeSpan(edge:WallEdge,width:number,depth:number){
 const facade=edgeFacade(edge),alongX=facade==='north'||facade==='south',span=alongX?width:depth;
 const a=(alongX?edge.a[0]:edge.a[1])/span+.5,b=(alongX?edge.b[0]:edge.b[1])/span+.5;
 const offset=facade==='north'?edge.a[1]+depth/2:facade==='south'?edge.a[1]-depth/2:facade==='west'?edge.a[0]+width/2:edge.a[0]-width/2;
 return {facade,start:Math.min(a,b),end:Math.max(a,b),x:alongX?0:offset,z:alongX?offset:0};
}
/** Preserve original-facade semantics when that plane fully contains the authored span. */
export function openingEdges(edges:WallEdge[],facade:WallEdge['facade'],start:number,end:number,w:number,d:number):WallEdge[]{
 const matches=edges.filter(e=>{const a=facadeEdgeSpan(e,w,d);return !e.open&&a.facade===facade&&a.start<end&&a.end>start;});
 const original=matches.filter(e=>e.facade===facade&&facadeEdgeSpan(e,w,d).start<=start+1e-6&&facadeEdgeSpan(e,w,d).end>=end-1e-6);
 return original.length?original:matches;
}
/** Shared plan-only assembly attachment; neither planning nor construction chooses a wall. */
export function assemblyWallOffset(fp:NonNullable<ReturnType<typeof resolveFootprint>>,anchor:Exclude<NonNullable<V3Composition['assemblies']>[number]['parts'][number],{type:'railing'}>,w=fp.frame.width,d=fp.frame.depth):{x:number;z:number}|undefined {
 const start=anchor.type==='post'?anchor.at:anchor.start,end=anchor.type==='post'?anchor.at:anchor.end;
 const matching=fp.edges.filter(e=>{const a=facadeEdgeSpan(e,w,d);return !e.open&&a.facade===anchor.facade&&a.start<=start+1e-6&&a.end>=end-1e-6;});
 const original=matching.filter(e=>e.facade===anchor.facade);
 let candidates=original.length?original:matching;
 // A slab may bridge a recess only when both ends attach to real outer shoulders.
 if(!candidates.length&&anchor.type==='slab'){
  const spans=fp.edges.filter(e=>!e.open).map(edge=>({edge,...facadeEdgeSpan(edge,w,d)})).filter(a=>a.facade===anchor.facade&&a.start<end&&a.end>start);
  const outer=spans.filter(a=>Math.abs(a.x)+Math.abs(a.z)<1e-6);
  const starts=outer.find(a=>a.start<=start+1e-6&&a.end>start+1e-6),ends=outer.find(a=>a.end>=end-1e-6&&a.start<end-1e-6);
  const inward=spans.every(a=>anchor.facade==='north'?a.z>=-1e-6:anchor.facade==='south'?a.z<=1e-6:anchor.facade==='west'?a.x>=-1e-6:a.x<=1e-6);
  if(starts&&ends&&starts!==ends&&inward)candidates=[starts.edge];
 }
 if(candidates.length!==1)return;
 const {x,z}=facadeEdgeSpan(candidates[0],w,d);return {x,z};
}
export function compileFootprintMass(o:V3SceneObject,includeRoof:boolean,overhang:number|undefined,roofMaterial:V3Material,storeyBase=0):{parts:HousePrimitive[];diagnostics:FootprintDiagnostic[]}|undefined {
 if(!o.composition?.footprint)return undefined;
 const levels=v3MassLevelCount(o),h=scaledDimensionsOf(o)[1],lh=h/levels;
 const fps=Array.from({length:levels},(_,i)=>resolveFootprint(o,i));
 if(fps.some(fp=>!fp))return o.composition.footprint.kind==='outline'?{parts:[],diagnostics:[{code:'FOOTPRINT_INVALID',targetId:o.id,message:'Invalid curved/irregular outline; no substitute geometry is built.'}]}:undefined;
 const diagnostics:FootprintDiagnostic[]=[],local:HousePrimitive[]=[];
 const note=(code:string,message:string)=>diagnostics.push({code,targetId:o.id,message});
 const bend=(parts:HousePrimitive[],segment:PathSegment,segments:PathSegment[])=>parts.flatMap(part=>{try{return bendFacade([part],segment,segments);}catch(error){note('FOOTPRINT_COMPONENT_UNSUPPORTED',String(error));return [];}});
 const frame=fps[0]!.frame,{width:w,depth:d}=frame;
 const outline=o.composition.footprint.kind==='outline',segments=o.composition.footprint.segments??[];
 const composition=outline?o.composition:resolvedFacadeComposition(o,w,d,lh),materials={exterior:paint(o.material),trim,glass};
 for(let floor=0;floor<=levels;floor++){
  const fp=fps[Math.min(floor,levels-1)]!,y=floor*lh+(floor===levels?-.26:0);
  if(outline)local.push(triMeshOf(`slab-${floor+1}-outline`,'floor','Floor slab',extrudeOutline(fp.polygon.map(p=>[p[0],p[1]]),y,y+.26,{bottom:true}),{color:'#b8b0a4',roughness:.72,metalness:0}));
  fp.rects.forEach((r,i)=>local.push(box(`slab-${floor+1}-${i}`,'floor','Floor slab',[(r.x0+r.x1)/2,y+.13,(r.z0+r.z1)/2],[r.x1-r.x0,.26,r.z1-r.z0],{color:'#b8b0a4',roughness:.72,metalness:0})));
  fp.wedges.forEach((p,i)=>local.push(triMeshOf(`slab-${floor+1}-wedge-${i}`,'floor','Floor slab',extrudeOutline(p.map(v=>[v[0],v[1]] as [number,number]),y,y+.26,{bottom:true}),{color:'#b8b0a4',roughness:.72,metalness:0})));
  if(floor===levels)continue;
  const wallY=floor*lh+.26,wallH=lh-(floor===levels-1?.52:.26);
  const openings=stackedStoreyOpenings(composition.openings??[],storeyBase,floor).filter(op=>!op.floors||op.floors==='all'||(op.floors==='ground'?storeyBase+floor===0:storeyBase+floor>0));
  if(outline){
   for(const op of openings)if(!segments.some(s=>s.id===op.segmentId))note('FOOTPRINT_SEGMENT_UNRESOLVED',`Opening ${op.id} requires a valid segmentId; no compass fallback is built.`);
   for(const segment of segments){
    const length=segmentLength(segment),eligible=openings.filter(op=>op.segmentId===segment.id);
    const result=buildMassOpenings([{a:[-length/2,-.5],b:[length/2,-.5],facade:'north'}],length,1,eligible.map(op=>({...builderOpening(op),facade:'north' as const})),storeyBase+floor,wallY,wallH,`wall-${segment.id}-${floor}`,materials,semanticOpeningIds(o.id,segment.id,floor));
    local.push(...bend(glazeDoorLeaves(result.primitives,o,eligible,trim).map(p=>({...p,...(p.label==='Door Frame'?{...ENTRY_DOOR_FINISH,...(composition.mainEntry?.color&&p.id.includes(`:${composition.mainEntry.openingId}:`)?{color:composition.mainEntry.color}:{})}:{})})),segment,segments));
    for(const warning of result.warnings)note('FOOTPRINT_OPENING_CLIPPED',`Segment ${segment.id}, level ${floor}: ${warning}`);
   }
   continue;
  }
  for(const [i,edge] of fp.edges.entries()){ 
   const address=facadeEdgeSpan(edge,w,d),{facade,x,z}=address;
   if(edge.open){local.push(...buildColonnadePosts(edge,wallY,wallH,`wall-${floor}-open-${i}`,materials.exterior));continue;}
   if(!facade){local.push(...(edge.chamfer?.glazed?buildGlazedWallEdge(edge,wallY,wallH,`wall-${floor}-angled-${i}`,materials):[buildPlainWallEdge(edge,wallY,wallH,`wall-${floor}-angled-${i}`,materials.exterior)]));continue;}
   const eligible=openings.filter(op=>{
    if(op.facade!==facade)return false;
    if(!('start' in op)){
     const original=fp.edges.filter(e=>e.facade===facade&&!e.open);
     if(original.length)return original.includes(edge);
     note('FOOTPRINT_FACADE_AMBIGUOUS',`Rhythm ${op.id} has no original facade plane on level ${floor}; use explicit spans on resolved segments.`);return false;
    }
    if(op.end<=address.start||op.start>=address.end)return false;
    const matches=openingEdges(fp.edges,facade,op.start,op.end,w,d);
    if(!matches.includes(edge))return false;
    // A glazing zone is a facade treatment, so its projected band can be
    // constructed on each addressed plane. Overlapping projections still need
    // an explicit segment; doors retain their single-plane operation contract.
    if(op.type==='glazing-zone'&&matches.some((a,i)=>matches.slice(i+1).some(b=>{
     const aa=facadeEdgeSpan(a,w,d),bb=facadeEdgeSpan(b,w,d);
     return Math.min(aa.end,bb.end,op.end)-Math.max(aa.start,bb.start,op.start)>1e-6;
    }))){note('FOOTPRINT_FACADE_AMBIGUOUS',`Glazing ${op.id} addresses overlapping facade planes on level ${floor}; use explicit segment addresses.`);return false;}
    // A span may cross disjoint collinear segments; parallel surfaces at different depths are ambiguous.
    if(op.type!=='glazing-zone'&&matches.some(e=>{const a=facadeEdgeSpan(e,w,d);return Math.abs(a.x-x)+Math.abs(a.z-z)>1e-6;})){note('FOOTPRINT_FACADE_AMBIGUOUS',`Opening ${op.id} crosses different ${facade} wall planes on level ${floor}; span=[${op.start},${op.end}], local wall segments=${JSON.stringify(matches.map(e=>({a:e.a,b:e.b,span:facadeEdgeSpan(e,w,d)})))}. Author a single-plane span or explicit separate doors; it is retained but not placed.`);return false;}
    return true;
   });
   const virtual:WallEdge={...edge,facade,a:[edge.a[0]-x,edge.a[1]-z],b:[edge.b[0]-x,edge.b[1]-z]};
   const result=buildMassOpenings([virtual],w,d,eligible.map(builderOpening),storeyBase+floor,wallY,wallH,`wall-${floor}`,materials,semanticOpeningIds(o.id,`${facade}-seg-${i}`,floor));
   const multiple=fp.edges.filter(e=>edgeFacade(e)===facade).length>1;
   const parts=glazeDoorLeaves(result.primitives,o,eligible,trim).map(p=>({...p,...(p.label==='Door Frame'?{...ENTRY_DOOR_FINISH,...(composition.mainEntry?.color&&p.id.includes(`:${composition.mainEntry.openingId}:`)?{color:composition.mainEntry.color}:{})}:{}),id:multiple?`${semanticCompositionChildId(p.id)}-seg-${i}`:p.id}));
   local.push(...shift(parts,x,z));
   for(const warning of result.warnings)note('FOOTPRINT_OPENING_CLIPPED',`Level ${floor}: ${warning}`);
  }
  for(const op of openings.filter(op=>'start' in op)){
   if(!('start' in op))continue;
   const candidates=fp.edges.filter(e=>{const a=facadeEdgeSpan(e,w,d);return !e.open&&a.facade===op.facade&&a.start<op.end&&a.end>op.start;});
   if(!candidates.length)note('FOOTPRINT_FACADE_UNRESOLVED',`Opening ${op.id} has no compass-addressable exterior segment on level ${floor}. Angled walls use chamfer.glazed; arbitrary angled door placement is unsupported.`);
  }
 }
 const assemblies:NonNullable<V3Composition['assemblies']>=[...(composition.assemblies??[])];
 const entry=composition.openings?.find(op=>op.id===composition.mainEntry?.openingId&&op.type==='door');
 if(entry&&entry.type==='door'&&composition.mainEntry){
  let start=Math.max(0,entry.start-.04),end=Math.min(1,entry.end+.04);
  // Padding is derived, not authored. Keep it on the doorway's unique supporting
  // wall instead of asking the provider to shrink a valid door to accommodate it.
  if(!outline){
   const supports=openingEdges(fps[0]!.edges,entry.facade,entry.start,entry.end,w,d).filter(edge=>{
    const span=facadeEdgeSpan(edge,w,d);return span.start<=entry.start+1e-6&&span.end>=entry.end-1e-6;
   });
   if(supports.length===1){const span=facadeEdgeSpan(supports[0],w,d);start=Math.max(start,span.start);end=Math.min(end,span.end);}
  }
  assemblies.push({id:`entry-${entry.id}`,intent:'Main entry canopy',parts:[{id:'canopy',type:'slab',facade:entry.facade,...(entry.segmentId?{segmentId:entry.segmentId}:{}),start,end,depth:composition.mainEntry.canopyDepth,elevation:Math.min(entry.height??2.4,lh-.4)+.41,thickness:.18,level:0}]});
 }
 for(const assembly of assemblies)for(const part of assembly.parts){
  const anchor=part.type==='railing'?assembly.parts.find(p=>p.id===part.slabId&&p.type==='slab'):part;
  if(!anchor||anchor.type==='railing')continue;
  if(outline){
   const segment=segments.find(s=>s.id===anchor.segmentId);
   if(!segment || (anchor.level??0)>=levels){note('FOOTPRINT_ASSEMBLY_UNRESOLVED',`Assembly ${assembly.id}/${part.id} requires a valid segmentId and storey.`);continue;}
   const length=segmentLength(segment);
   const selected=part.type==='railing'?[anchor,part]:[part];
   const built=buildArchitecturalAssemblies({width:length,depth:1,height:h,floors:levels,assemblies:[{...assembly,parts:selected.map(p=>p.type==='railing'?p:{...p,facade:'north' as const})}]},lh,materials.exterior,trim,glass).filter(p=>part.type!=='railing'||p.label==='Assembly Railing');
   local.push(...bend(built,segment,segments));continue;
  }
  const fp=fps[anchor.level??0];
  const a=fp&&assemblyWallOffset(fp,anchor,w,d);
  if(!a){note('FOOTPRINT_ASSEMBLY_UNRESOLVED',`Assembly ${assembly.id}/${part.id} requires a unique wall plane or two outer shoulders bounding an inward recess; retained without arbitrary relocation.`);continue;}
  const parts=buildArchitecturalAssemblies({width:w,depth:d,height:h,floors:levels,assemblies:[{...assembly,parts:part.type==='railing'?[anchor,part]:[part]}]},lh,materials.exterior,trim,glass).filter(p=>part.type!=='railing'||p.label==='Assembly Railing');
  local.push(...shift(parts,a.x,a.z));
 }
 const parts=place(o,shift(local,frame.x,frame.z));
 if(includeRoof){const result=compileFootprintRoof(o,{...o,material:roofMaterial,overhang},getObjectBaseY(o)+h,.25);parts.push(...result.parts);diagnostics.push(...result.diagnostics);}
 return {parts,diagnostics};
}
export function compileFootprintRoof(host:V3SceneObject,roof:V3SceneObject,base=getObjectBaseY(roof),thickness=scaledDimensionsOf(roof)[1]):{parts:HousePrimitive[];diagnostics:FootprintDiagnostic[]}{
 const {fp,rectangular,diagnostics}=resolveV3FootprintRoofPlan(host,roof);
 const fail=(code:string,message:string)=>{diagnostics.push({code,targetId:roof.id,message});return {parts:[],diagnostics};};
 if(!fp||diagnostics.length)return {parts:[],diagnostics};
 const form=roof.roofForm??'flat';
 if(rectangular&&!['flat','floating-flat','terrace','mono-pitch'].includes(form)){
  const adapted={...roof,architecture:undefined,dimensions:[fp.frame.width,thickness,fp.frame.depth] as [number,number,number],transform:{...host.transform,position:[host.transform.position[0],base+thickness/2,host.transform.position[2]] as [number,number,number],scale:[1,1,1] as [number,number,number]}};
  return {parts:compileDetailedRoof(adapted,host.material)??[],diagnostics};
 }
 const grown=host.composition?.footprint?.kind==='outline'?{polygon:offsetPath(fp.polygon,Math.max(0,roof.overhang??.75)),warnings:[]}:offsetFootprintOutline(fp,fp.frame.width,fp.frame.depth,Math.max(0,roof.overhang??.75));
 if(grown.warnings.length||!simpleFootprint(grown.polygon))return fail('ROOF_FOOTPRINT_UNSUPPORTED','Roof overhang creates an invalid outline; reduce its authored overhang. No substitute roof is built.');
 const input={id:'roof',outline:grown.polygon,footprint:fp.polygon,wallPlateY:0,roof:paint(roof.material),exterior:paint(host.material),thickness:Math.max(.02,thickness)};
 const floating=form==='floating-flat',gap=floating?.45:0;
 const bearingBase=roof.id===host.id?0:getObjectTopY(host)-base;
 if(floating&&bearingBase>gap-1e-5)return fail('ROOF_SUPPORT_UNSUPPORTED','Floating roof underside intersects its host top; authored roof datum is retained.');
 const bearingHeight=gap-bearingBase,bearingY=(gap+bearingBase)/2;
 const parts=form==='mono-pitch'?buildPolygonShedRoof({...input,pitchDeg:roof.pitchUnit==='ratio'?Math.atan(roof.pitch??.2)*180/Math.PI:roof.pitch??12}):buildPolygonRoofPlate({...input,gap}).filter(p=>!floating||!p.id.endsWith('shadow-gap'));
 if(floating&&host.composition?.footprint?.kind==='outline')for(const segment of host.composition.footprint.segments??[]){const count=Math.max(1,Math.ceil(segmentLength(segment)/4));for(let k=0;k<count;k++){const p=segmentPoint(segment,(k+.5)/count);parts.push(box(`roof-bearing-${segment.id}-${k}`,'roof','Floating roof bearing',[p[0],bearingY,p[1]],[.12,bearingHeight,.12],trim));}}
 else if(floating)fp.edges.forEach((edge,i)=>{const length=Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]),count=Math.max(1,Math.ceil(length/4));for(let k=0;k<count;k++){const t=(k+.5)/count;parts.push(box(`roof-bearing-${i}-${k}`,'roof','Floating roof bearing',[edge.a[0]+(edge.b[0]-edge.a[0])*t,bearingY,edge.a[1]+(edge.b[1]-edge.a[1])*t],[.12,bearingHeight,.12],trim));}});
 // A hosted roof follows the host's plan frame; the authored roof remains the semantic owner.
 return {parts:place({...roof,transform:{...host.transform}},shift(parts,fp.frame.x,fp.frame.z),base),diagnostics};
}
