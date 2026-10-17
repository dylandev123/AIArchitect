import { buildButterflyRoof } from '@/lib/house/roof/butterflyRoof';
import { ROOF_OVERHANG } from '@/lib/house/constants';
import { facadeBayGrid } from './compositionPolicies';
/** Pure shared V2 construction adapters. No V2 document or lifecycle is involved. */
import { buildGlazedWallEdge, buildMassOpenings } from '@/lib/architecture/geometry/openings';
import { buildPolygonShedRoof, shedSlope } from '@/lib/architecture/geometry/roofPlate';
import { gableRoofGeometry, hipRoofGeometry, outlineEdges } from '@/lib/architecture/geometry/pitchedRoof';
import { makePlane } from '@/lib/architecture/roofSystems/planes';
import { roofSystemForMaterial } from '@/lib/architecture/roofSystems/resolve';
import { getRoofSystem } from '@/lib/architecture/roofSystems/registry';
import type { RoofAssembly, RoofSystem } from '@/lib/architecture/roofSystems/types';
import { buildRoofExpression } from '@/lib/house/roof/expression';
import { shade } from '@/lib/house/architecture/parts';
import type { MaterialType } from '@/types/house';
import { buildParapetPrimitives } from '@/lib/architecture/geometry/parapet';
import { box } from '@/lib/house/architecture/parts';
import type { HousePrimitive } from '@/lib/house/types';
import type { V3Scene, V3SceneObject, V3Material } from './scene';
import { scaledDimensionsOf, getObjectBaseY } from './elevation';
// Shared builders spread Paint onto primitives: never pass semantic material IDs.
const materialPaint=(m:V3Material)=>({color:m.color,roughness:m.roughness??.72,metalness:m.metalness??0,...(m.opacity !== undefined ? {opacity:m.opacity,transparent:m.opacity < 1} : {})});
const paint=(o:V3SceneObject)=>materialPaint(o.material);
const trim={color:'#263036',roughness:.38,metalness:.7};
const glass={color:'#8fbdc9',roughness:.1,metalness:.08,transparent:true,opacity:.42};
/** Transform local builder output once, retaining authored semantic edit ownership. */
function place(o: V3SceneObject, parts: HousePrimitive[], role: (p:HousePrimitive)=>string, base=getObjectBaseY(o), finish:(p:HousePrimitive)=>V3Material['surface']|null=()=>o.material.surface): HousePrimitive[] {
 const c=Math.cos(o.transform.rotation[1]),s=Math.sin(o.transform.rotation[1]);
 const point=(x:number,y:number,z:number):[number,number,number]=>[o.transform.position[0]+x*c+z*s,base+y,o.transform.position[2]-x*s+z*c];
 return parts.map(p=>{
  const common={...p,id:`${o.id}-${p.id}`,sourceObjectId:o.id,semanticRole:o.semanticRole,componentRole:role(p), ...(()=>{const f=finish(p);return !p.surface && p.category !== 'window' && f && !['water','grass','paving'].includes(f) ? {surface:f as 'stone'|'wood'|'metal'|'concrete'|'stucco'|'glass'} : {};})()};
  if(p.kind==='box')return {...common,kind:'box' as const,position:point(...p.position),size:p.size,rotation:[p.rotation[0],p.rotation[1]+o.transform.rotation[1],p.rotation[2]] as [number,number,number]};
  if(p.kind==='triMesh'){const vertices:number[]=[];for(let i=0;i<p.vertices.length;i+=3)vertices.push(...point(p.vertices[i],p.vertices[i+1],p.vertices[i+2]));return {...common,kind:'triMesh' as const,vertices};}
  return common;
 });
}
export function compileArchitecturalGlazing(o:V3SceneObject):HousePrimitive[]{
 const [w,h,d]=scaledDimensionsOf(o),alongX=w>=d,span=Math.max(w,d);
 const materials={exterior:paint(o),trim,glass:o.material.surface==='glass'?{...glass,...paint(o),transparent:true,opacity:o.material.opacity??.42}:glass};
 const parts=o.type==='window-band'?buildMassOpenings([{facade:'south',a:[-span/2,0],b:[span/2,0]}],span,.01,[{type:'opening-rhythm',facade:'south',count:Math.max(1,Math.min(32,Math.floor(span/1.8))),width:Math.min(1.5,span*.8),height:h,sill:0}],0,0,h,'band',materials).primitives:buildGlazedWallEdge({a:[-span/2,0],b:[span/2,0]},0,h,'glazing',materials);
 return place(alongX?o:{...o,transform:{...o.transform,rotation:[0,o.transform.rotation[1]+Math.PI/2,0]}},parts,p=>p.category==='window'?(p.transparent?'facade glazing':'glazing frame'):'facade wall');
}
/** Quarter-turn (radians) putting a veranda's open edge on its local +z: away from the building mass it serves —
 * the explicit host, else a mass whose footprint it abuts. No host keeps the authored +z edge. */
export function verandaOpenEdgeYaw(o:V3SceneObject,scene?:V3Scene):number{
 if(!scene)return 0;
 const hostId=o.hostId??o.support?.hostId??o.support?.objectId,[w,,d]=scaledDimensionsOf(o),[x,,z]=o.transform.position;
 const touches=(m:V3SceneObject)=>{const [mw,,md]=scaledDimensionsOf(m),[mx,,mz]=m.transform.position,gap=.5;return Math.abs(mx-x)<=(mw+w)/2+gap&&Math.abs(mz-z)<=(md+d)/2+gap;};
 const host=scene.objects.find(m=>m.id===hostId&&m.type==='building-mass')??scene.objects.filter(m=>m.type==='building-mass'&&touches(m)).sort((a,b)=>{const [aw,,ad]=scaledDimensionsOf(a),[bw,,bd]=scaledDimensionsOf(b);return bw*bd-aw*ad||a.id.localeCompare(b.id);})[0];
 if(!host)return 0;
 // Outward (host → veranda) in the veranda's own frame, snapped to its dominant local axis.
 const yaw=o.transform.rotation[1],c=Math.cos(yaw),s=Math.sin(yaw),dx=x-host.transform.position[0],dz=z-host.transform.position[2];
 const lx=dx*c-dz*s,lz=dx*s+dz*c;
 return Math.abs(lz)>=Math.abs(lx)?(lz>=0?0:Math.PI):(lx>0?Math.PI/2:-Math.PI/2);
}
export function compileVeranda(authored:V3SceneObject,scene?:V3Scene):HousePrimitive[]{
 // Built in a frame whose +z is the open edge; a quarter turn swaps the plan dimensions it spans.
 const turn=verandaOpenEdgeYaw(authored,scene),quarter=Math.abs(Math.sin(turn))>.5,[aw,ah,ad]=scaledDimensionsOf(authored);
 const o:V3SceneObject=turn?{...authored,transform:{...authored.transform,rotation:[authored.transform.rotation[0],authored.transform.rotation[1]+turn,authored.transform.rotation[2]]}}:authored;
 // Light timber frame: the deck carries the authored finish; canopy, header and posts are smooth,
 // slender members (never the host wall's masonry or a heavy textured slab).
 const [w,h,d]=quarter?[ad,ah,aw]:[aw,ah,ad],slab=Math.min(.18,h*.08),roof=Math.min(.12,h*.05),member={...paint(o),roughness:.6};
 const parts:HousePrimitive[]=[box('slab','floor','Veranda Slab',[0,slab/2,0],[w,slab,d],paint(o)),box('canopy','roof','Veranda Canopy',[0,h-roof/2,0],[w,roof,d],member)];
 // Facade-relative assembly dimensions: no wall-thickness inset on a free-standing post line.
 // Members scale with clear height (V2 colonnade proportions: ~16 cm posts at a 3.4 m veranda) so a tall or
 // long veranda never reads as wire-thin; the header is deeper than the post is wide to carry the span visibly.
 const post=Math.max(.14,Math.min(.24,h*.047)),header=post*1.4,postHeight=h-slab-roof,z=d/2-post/2-.02;
 parts.push(box('veranda-header','wall','Colonnade Header',[0,h-roof-header/2,z],[w,header,post],member));
 facadeBayGrid(w).forEach((at,i)=>parts.push(box(`veranda-post-${i}`,'wall','Colonnade Post',[Math.max(-w/2+post/2,Math.min(w/2-post/2,-w/2+at*w)),slab+postHeight/2,z],[post,postHeight,post],member)));
 return place(o,parts,p=>p.label.toLowerCase(),getObjectBaseY(o),p=>p.category==='floor'?o.material.surface:null);
}
/** V3 surface → the V2 roof-zone material whose Roof System covers it. */
const ROOF_MATERIAL: Partial<Record<NonNullable<V3Material['surface']>, MaterialType>> = { metal: 'standing-seam-metal', wood: 'timber', stone: 'stone', concrete: 'concrete', stucco: 'stucco' };
/** The shared V2 Roof System able to cover this pitched roof in its authored finish (standing seam stands in). */
function pitchedRoofSystem(o: V3SceneObject, pitchDeg: number): RoofSystem {
 const system = roofSystemForMaterial(ROOF_MATERIAL[o.material.surface ?? 'metal'] ?? 'standing-seam-metal');
 return system.supports({ form: 'pitched', pitchDeg }) ? system : getRoofSystem('standing-seam')!;
}
/** Finish a pitched assembly with its Roof System: fitted surface pattern, seams/courses, flashing and caps.
 * The authored roof colour is the finish; flashing is the system's darker fold of it. */
function finishPitched(o: V3SceneObject, assembly: Omit<RoofAssembly, 'shape'>, pitchDeg: number): HousePrimitive[] {
 const system = pitchedRoofSystem(o, pitchDeg), material = ROOF_MATERIAL[o.material.surface ?? 'metal'] ?? 'standing-seam-metal';
 const finishPaint = { color: o.material.color, roughness: o.material.roughness ?? .55, metalness: o.material.metalness ?? (o.material.surface === 'metal' ? .65 : 0) };
 const parts = system.finish({ ...assembly, shape: { form: 'pitched', pitchDeg } }, { finish: { material: system.materials.includes(material) ? material : system.defaultFinish.material, paint: finishPaint, flashing: { color: shade(finishPaint.color, .6), roughness: .42, metalness: .7 } }, trim });
 return parts;
}
const PITCHED_ROLE: Record<string, string> = { 'Roof Wall Infill': 'roof wall infill', 'Roof Flashing': 'roof flashing', 'Standing Seams': 'roof seams' };
const pitchedRole = (p: HousePrimitive) => PITCHED_ROLE[p.label] ?? (p.label.startsWith('Roof Wall') ? 'roof wall infill' : 'roof plane');
const toSurface = (s: V3Material['surface']) => s === 'stone' ? 'stone' as const : s === 'wood' ? 'wood' as const : 'stucco' as const;

/** V2's flat roof expression: one datum shared by a thin plane, edge fascia, soffit and, when floating, a
 * recessed shadow reveal. Replaces a single thick lid so a flat roof reads as a crisp, thin plate. */
export const FLAT_ROOF_GAP = .45;
function compileFlatRoof(o: V3SceneObject, exterior: V3Material, w: number, h: number, d: number, e: number): HousePrimitive[] {
 const floating = o.roofForm === 'floating-flat', thickness = Math.max(.18, Math.min(h, .35));
 const roofMaterial = { color: o.material.color, roughness: o.material.roughness ?? .55, metalness: o.material.metalness ?? .65 };
 const parts = buildRoofExpression({ id: 'roof', width: w, depth: d, wallPlateY: 0, roofMaterial, exteriorMaterial: { color: exterior.color, roughness: exterior.roughness ?? .72, metalness: exterior.metalness ?? 0 },
  parameters: { overhang: e, thickness, verticalGap: floating ? FLAT_ROOF_GAP : 0, soffitMaterial: 'exterior' } })
  // The fascia is the roof's drip edge: a darker metal fold gives the plate a crisp shadow line.
  .filter(p => !floating || p.id !== 'roof-shadow-gap')
  .map(p => p.label.startsWith('Roof Fascia') ? { ...p, color: shade(roofMaterial.color, .6), roughness: .42, metalness: .7 } : p)
  .map(p => ({ ...p, id: p.id === 'roof-plane' ? 'roof-plate' : p.id === 'roof-shadow-gap' ? 'roof-shadow' : p.id }));
 if (floating) {
  // Discrete recessed bearings keep daylight visible; the old full-footprint dark box filled the gap.
  const inset=Math.min(.55,w*.15,d*.15),post=.12;
  for(const [axis,span,fixed] of [['x',w,d/2-inset],['z',d,w/2-inset]] as const){
   const count=Math.max(1,Math.ceil((span-2*inset)/4));
   for(const side of [-1,1])for(let i=0;i<=count;i++){
    if(axis==='z'&&(i===0||i===count))continue;
    const at=-span/2+inset+(span-2*inset)*i/count;
    parts.push(box(`roof-bearing-${axis}-${side}-${i}`,'roof','Floating Roof Bearing',[axis==='x'?at:side*fixed,FLAT_ROOF_GAP/2,axis==='x'?side*fixed:at],[post,FLAT_ROOF_GAP,post],trim));
   }
  }
 }
 const role = (p: HousePrimitive) => p.id.startsWith('roof-bearing-') ? 'floating roof bearing' : p.id === 'roof-plate' ? (floating ? 'floating roof plate' : 'flat roof plate') : p.id === 'roof-shadow' ? 'shadow reveal' : p.label.startsWith('Roof Fascia') ? 'roof fascia' : 'roof soffit';
 return place(o, parts, role, getObjectBaseY(o), p => p.label === 'Roof Soffit' ? exterior.surface : p.label === 'Roof Shadow Reveal' ? null : o.material.surface);
}

export function compileDetailedRoof(o:V3SceneObject, exterior:V3Material=o.material):HousePrimitive[]|undefined{
 const [w,h,d]=scaledDimensionsOf(o),e=Math.max(0,o.overhang??.75),pitch=Math.max(1,Math.min(60,o.pitch??12));
 const outline:[number,number][]=[[-w/2-e,-d/2-e],[w/2+e,-d/2-e],[w/2+e,d/2+e],[-w/2-e,d/2+e]];
 const footprint:[number,number][]=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
 const mesh=(id:string,vertices:number[],color=o.material.color):HousePrimitive=>({kind:'triMesh',id,label:id,category:'roof',vertices,color,roughness:o.material.roughness,metalness:o.material.metalness});
 if(o.roofForm==='flat'||o.roofForm==='floating-flat')return compileFlatRoof(o,exterior,w,h,d,e);
 if(o.roofForm==='butterfly'){
  // Reuse the existing builder without changing V2: adapt its fixed overhang/rise to authored V3 dimensions.
  const sourceRise=Math.max(.8,d*.30),rise=o.pitch===undefined?h:Math.tan(pitch*Math.PI/180)*(d/2+e);
  const sx=(w+2*e)/(w+2*ROOF_OVERHANG),sz=(d+2*e)/(d+2*ROOF_OVERHANG),sy=rise/sourceRise;
  const parts=buildButterflyRoof(w,d,0,'roof',paint(o),materialPaint(exterior)).map(p=>{
   if(p.kind==='triMesh')return {...p,vertices:p.vertices.map((v,i)=>v*[sx,sy,sz][i%3])};
   return {...p,position:[p.position[0]*sx,p.position[1]*sy,p.position[2]*sz] as [number,number,number],size:[p.size[0]*sx,p.size[1]*sy,p.size[2]*sz] as [number,number,number]};
  });
  // The legacy builder's single gable triangle spans ABOVE the valley. V3 closes each half BELOW its slope,
  // at the bearing footprint, preserving the inverted silhouette and leaving the eaves free.
  for(const part of parts) if(part.kind==='triMesh' && part.id.includes('gable')) {
   const x=(part.id.endsWith('-w')?-1:1)*w/2,edgeRise=rise*(d/2)/(d/2+e);
   part.vertices=[x,0,-d/2,x,edgeRise,-d/2,x,0,0,x,0,0,x,edgeRise,d/2,x,0,d/2];
   if(x>0) for(let i=0;i<part.vertices.length;i+=9){const b=part.vertices.slice(i+3,i+6);part.vertices.splice(i+3,3,...part.vertices.slice(i+6,i+9));part.vertices.splice(i+6,3,...b);}
  }
  return place(o,parts,p=>p.id.includes('gutter')?'roof valley gutter':p.id.includes('gable')?'roof wall infill':p.id.includes('fascia')?'roof fascia':'butterfly roof plane',getObjectBaseY(o),p=>p.id.includes('gable')?exterior.surface:o.material.surface);
 }
 if(o.roofForm==='mono-pitch'){
  const input={id:'shed',outline,footprint,wallPlateY:0,pitchDeg:pitch,thickness:Math.min(.24,h),roof:paint(o),exterior:materialPaint(exterior)};
  const built=buildPolygonShedRoof(input), slab=built.find(p=>p.kind==='triMesh'&&p.id==='shed-slope');
  // As V2: the slab becomes the system's surface face, low along the south edge, rising north.
  const {zMax,top}=shedSlope(input), x0=-w/2-e, x1=w/2+e;
  const plane=makePlane('slope',outline.map(([x,z])=>[x,top(x,z),z]),[x0,top(x0,zMax),zMax],[x1,top(x1,zMax),zMax],slab?.kind==='triMesh'?slab.vertices:[]);
  const edges=outlineEdges(outline,top,(a,b,out)=>Math.abs(a[1]-b[1])>1e-6?'rake':out[1]>0?'eave':'high-eave');
  const parts=finishPitched(o,{id:'roof',planes:[plane],edges,structure:built.filter(p=>p!==slab),slab:true},pitch);
  return place(o,parts,pitchedRole,getObjectBaseY(o),p=>p.label==='Roof Wall Infill'?exterior.surface:o.material.surface);
 }
 if(o.roofForm==='gable'||o.roofForm==='hip'){
  const g=(o.roofForm==='gable'?gableRoofGeometry:hipRoofGeometry)({rect:{x0:-w/2,x1:w/2,z0:-d/2,z1:d/2},wallPlateY:0,pitchDeg:pitch,overhang:e});
  const infill:HousePrimitive[]=g.infill.length?[{...mesh('roof-wall-infill',g.infill,exterior.color),label:'Roof Wall Infill',roughness:exterior.roughness??.72,metalness:exterior.metalness??0,surface:toSurface(exterior.surface)}]:[];
  return place(o,finishPitched(o,{id:'roof',planes:g.planes,edges:g.edges,structure:infill},pitch),pitchedRole,getObjectBaseY(o));
 }
 if(o.roofForm==='terrace')return place(o,[box('plate','roof','Roof Terrace',[0,h/2,0],[w+e*2,h,d+e*2],paint(o)),...buildParapetPrimitives(outline,h,h+.6,.16,paint(o),'parapet')],p=>p.label==='Parapet'?'roof parapet':'roof terrace');
 return undefined;
}
