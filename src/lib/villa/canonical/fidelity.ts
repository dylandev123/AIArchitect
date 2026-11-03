/** Concept-to-construction fidelity: what the BUILT house shows about the architectural concept its plan declares.
 *
 * Three layers, kept apart on purpose:
 *  1. ENFORCED (composition.ts, at compile time): tier order measured in built heights, a volume's roof covers that
 *     volume, the entrance door opens to a roofed porch that is the arrival space. A violation rejects the plan.
 *  2. MEASURED here: facts about the built house (interior area, centre offset, roofs and openings per volume, porch
 *     size, enclosure of a court) and a small set of CLAIMS found in the thesis and wing roles, each paired with the
 *     measurement that bears on it. Reported, never gating, no score: a claim the measurement does not support is an
 *     observation for a person or a bounded revision to weigh, because thresholds here are heuristics, not law.
 *  3. NOT MEASURABLE: proportion, silhouette, material richness, whether an entrance feels dramatic. See NOT_MEASURABLE.
 * Pure: reads a plan and its compiled result; edits nothing. */
import type {ArchitecturalPlan,compileArchitecturalPlan} from './plan';
import {resolveLayout,type Rect} from './layout';
import {sharedRuns,SIDES} from './coordination';
type Built=ReturnType<typeof compileArchitecturalPlan>;
const f2=(n:number)=>Number(n.toFixed(2));
const area=(r:Rect)=>r.width*r.depth;
/** A primary volume centred this close to the building's centre (0 = centre, 1 = corner of the bounding box) supports a "central" claim. */
export const CENTRAL_OFFSET=.35;
/** Share of a court's perimeter bounded by interior rooms that supports an "enclosed court" claim. */
export const ENCLOSED_SHARE=.5;
export const NOT_MEASURABLE=['proportion and silhouette','material richness and colour harmony','whether an entrance reads as dramatic rather than merely roofed and tall','facade depth beyond eaves, porch and placement (recesses and projections are not representable)','whether the hierarchy is beautiful rather than present','landscape character (no planting exists)'] as const;
export type VolumeFacts={id:string;tier:string;interiorRooms:number;interiorAreaM2:number;areaShare:number;top:number;centreOffset:number;roofElements:number;roofForms:string[];maxOverhang:number;exteriorOpenings:{windows:number;doors:number;fromComposedBays:number}};
export type ClaimCheck={claim:'central'|'court'|'shade'|'entrance';quote:string;measured:string;supported:boolean};
export type EntranceFacts={portal:string;porch:string;porchAreaM2:number;porchWidthM:number;porchDepthM:number;porchRoofed:boolean;porchOverhangM:number;doorWidthM:number;doorHeightM:number;hostRoomHeightM:number;volume:string|null;volumeTier:string|null};
export type Fidelity={declared:boolean;volumes:VolumeFacts[];entrance:EntranceFacts|null;claims:ClaimCheck[];observations:string[];notMeasurable:readonly string[]};
const CLAIMS:{claim:ClaimCheck['claim'];re:RegExp}[]=[
 {claim:'central',re:/\b(central|centre|center|heart|core)\b/i},
 {claim:'court',re:/\b(courtyard|court|patio)\b/i},
 {claim:'shade',re:/\b(shaded|shade|shading|deep eaves|deep overhang|veranda|verandah|canopy)\b/i},
 {claim:'entrance',re:/\b(dramatic|memorable|grand|monumental|ceremonial|sheltered)\b[^.;]{0,24}\b(entrance|entry|door|porch|arrival)\b/i},
];
export function conceptFidelity(plan:ArchitecturalPlan,built:Built):Fidelity{
 const rects=resolveLayout(plan).rects,observations:string[]=[];
 const comp=plan.composition,spaceOf=new Map(plan.spaces.map(s=>[s.id,s]));
 const interior=plan.spaces.filter(s=>!s.outdoor&&rects.has(s.id));
 const x0=Math.min(...interior.map(s=>rects.get(s.id)!.x)),x1=Math.max(...interior.map(s=>rects.get(s.id)!.x+rects.get(s.id)!.width));
 const z0=Math.min(...interior.map(s=>rects.get(s.id)!.z)),z1=Math.max(...interior.map(s=>rects.get(s.id)!.z+rects.get(s.id)!.depth));
 const bc=[(x0+x1)/2,(z0+z1)/2],half=Math.hypot(x1-x0,z1-z0)/2,totalArea=interior.reduce((a,s)=>a+area(rects.get(s.id)!),0);
 const outdoorIds=new Set(plan.spaces.filter(s=>s.outdoor).map(s=>s.id));
 const volumes:VolumeFacts[]=[];
 for(const v of comp?.volumes??[]){
  const own=plan.spaces.filter(s=>v.masses.includes(s.mass)&&rects.has(s.id)),inside=own.filter(s=>!s.outdoor),ids=new Set(own.map(s=>s.id));
  const a=inside.reduce((n,s)=>n+area(rects.get(s.id)!),0);
  const cx=a?inside.reduce((n,s)=>n+area(rects.get(s.id)!)*(rects.get(s.id)!.x+rects.get(s.id)!.width/2),0)/a:bc[0],cz=a?inside.reduce((n,s)=>n+area(rects.get(s.id)!)*(rects.get(s.id)!.z+rects.get(s.id)!.depth/2),0)/a:bc[1];
  const roofs=built.scene.elements.filter(e=>e.kind==='roof'&&built.provenance[e.id]?.sources.some(src=>ids.has(src)));
  const overhangs=[...plan.roofs.filter(r=>ids.has(r.space)).map(r=>r.overhang??0),...comp!.roofSpans.filter(r=>r.spaces.some(s=>ids.has(s))).map(r=>r.overhang??0)];
  const openings=built.intent.portals.filter(p=>ids.has(p.host.space)&&!outdoorIds.has(p.host.space)&&(p.to==='exterior'||outdoorIds.has(p.to)));
  const bays=new Set(comp!.facades.map(f=>f.id));
  volumes.push({id:v.id,tier:v.tier,interiorRooms:inside.length,interiorAreaM2:f2(a),areaShare:totalArea?f2(a/totalArea):0,top:f2(built.composition?.volumes.find(x=>x.id===v.id)?.top??0),
   centreOffset:half?f2(Math.hypot(cx-bc[0],cz-bc[1])/half):0,roofElements:roofs.length,roofForms:[...new Set(roofs.map(e=>e.roofForm??'flat'))],maxOverhang:Math.max(0,...overhangs),
   exteriorOpenings:{windows:openings.filter(p=>p.mode==='window').length,doors:openings.filter(p=>p.mode!=='window').length,fromComposedBays:openings.filter(p=>[...bays].some(b=>p.id.startsWith(`${b}-`))).length}});
 }
 let entrance:EntranceFacts|null=null;
 if(comp?.entrance){
  const porch=spaceOf.get(comp.entrance.porch),door=plan.portals.find(p=>p.id===comp.entrance!.portal),r=rects.get(comp.entrance.porch),host=door&&spaceOf.get(door.host.space);
  const vol=comp.volumes.find(v=>porch&&v.masses.includes(porch.mass));
  if(porch&&door&&r)entrance={portal:door.id,porch:porch.id,porchAreaM2:f2(area(r)),porchWidthM:f2(r.width),porchDepthM:f2(r.depth),porchRoofed:!!built.composition?.entrance?.roofed,porchOverhangM:plan.roofs.find(x=>x.space===porch.id)?.overhang??0,doorWidthM:door.width,doorHeightM:door.height,
   hostRoomHeightM:f2(built.intent.spaces.find(s=>s.id===host?.id)?.height??0),volume:vol?.id??null,volumeTier:vol?.tier??null};
 }
 // Observations: facts that bear on the concept, worded as measurements.
 if(!comp)observations.push(`No composition is declared: the thesis and the wing roles (${plan.masses.map(m=>m.role).join('; ')}) are prose, and nothing structured exists to check them against the built house.`);
 if(comp&&comp.volumes.length>1&&new Set(comp.volumes.map(v=>v.tier)).size===1)observations.push(`All ${comp.volumes.length} volumes are declared ${comp.volumes[0].tier}: no hierarchy is declared.`);
 const primary=volumes.filter(v=>v.tier==='primary');
 for(const p of primary)for(const o of volumes.filter(v=>v.tier!=='primary'&&v.interiorAreaM2>p.interiorAreaM2))observations.push(`${p.id} is primary by height (${p.top} m) but ${o.id} has more interior area (${o.interiorAreaM2} m² against ${p.interiorAreaM2} m²): its dominance rests on height alone.`);
 for(const v of volumes){
  if(v.interiorRooms>=3&&v.roofElements>=3&&!comp!.volumes.find(x=>x.id===v.id)?.roof)observations.push(`${v.id}: ${v.interiorRooms} rooms carry ${v.roofElements} separate roofs and no single roof is declared for the volume.`);
  if(v.interiorRooms&&v.exteriorOpenings.windows+v.exteriorOpenings.doors===0)observations.push(`${v.id}: no window or door opens to the outside.`);
 }
 // Claims in the thesis and wing roles, each with the measurement that bears on it.
 const claims:ClaimCheck[]=[],text=[plan.thesis,...plan.masses.map(m=>m.role)].join('. ');
 for(const {claim,re} of CLAIMS){
  const m=text.match(re);if(!m)continue;
  if(claim==='central'){
   if(!primary.length){claims.push({claim,quote:m[0],measured:'no primary volume is declared, so nothing can be centred',supported:false});continue;}
   const best=Math.min(...primary.map(p=>p.centreOffset));
   claims.push({claim,quote:m[0],measured:`primary volume centre lies ${best} of the way from the building centre to its corner (supported at ${CENTRAL_OFFSET} or less)`,supported:best<=CENTRAL_OFFSET});
  }else if(claim==='court'){
   const courts=plan.spaces.filter(s=>s.outdoor&&rects.has(s.id)).map(s=>{
    const r=rects.get(s.id)!,others=interior.filter(o=>o.level===s.level).map(o=>({id:o.id,rect:rects.get(o.id)!}));
    const bounded=SIDES.reduce((n,side)=>n+sharedRuns(r,side,others).reduce((k,run)=>k+run.hi-run.lo,0),0);
    return {id:s.id,share:f2(bounded/(2*(r.width+r.depth)))};
   });
   const best=courts.sort((a,b)=>b.share-a.share)[0];
   claims.push({claim,quote:m[0],measured:best?`most enclosed outdoor space is ${best.id}, ${best.share*100}% of its perimeter bounded by rooms (supported at ${ENCLOSED_SHARE*100}% or more)`:'the plan has no outdoor space',supported:!!best&&best.share>=ENCLOSED_SHARE});
  }else if(claim==='shade'){
   const over=Math.max(0,...plan.roofs.map(r=>r.overhang??0),...(comp?.roofSpans??[]).map(r=>r.overhang??0));
   const covered=plan.spaces.filter(s=>s.outdoor&&plan.roofs.some(r=>r.space===s.id)).map(s=>s.id);
   claims.push({claim,quote:m[0],measured:`greatest roof overhang ${f2(over)} m; roofed outdoor spaces: ${covered.join(', ')||'none'}`,supported:over>=.5||covered.length>0});
  }else{
   claims.push({claim,quote:m[0],measured:entrance?`entrance declared: ${entrance.porchWidthM}×${entrance.porchDepthM} m ${entrance.porchRoofed?'roofed ':'UNROOFED '}porch, door ${entrance.doorWidthM}×${entrance.doorHeightM} m in a ${entrance.hostRoomHeightM} m room, in ${entrance.volume??'no'} volume (${entrance.volumeTier??'no tier'})`:'no composition.entrance is declared: the entrance is described, not developed',supported:!!entrance&&entrance.porchRoofed});
  }
 }
 for(const c of claims)if(!c.supported)observations.push(`Claim "${c.quote}" (${c.claim}) is not supported by the built house: ${c.measured}.`);
 return {declared:!!comp,volumes,entrance,claims,observations,notMeasurable:NOT_MEASURABLE};
}
