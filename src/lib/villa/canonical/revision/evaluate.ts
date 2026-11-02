/** Comparison of a revised plan with the original: an entity diff, measured geometry changes, programme
 * preservation, and three separately reported indicator dimensions. Indicators are measurements, not beauty
 * scores, and floor area or room count is never counted as improvement. */
import type {ArchitecturalPlan} from '../plan';
import {analysePlan,programmeCounts,type PlanAnalysis} from './analysis';
type Json=unknown;
const same=(a:Json,b:Json)=>JSON.stringify(a)===JSON.stringify(b);
const fieldDiff=(a:Record<string,Json>,b:Record<string,Json>,prefix=''):{path:string;from:Json;to:Json}[]=>{
 const out:{path:string;from:Json;to:Json}[]=[];
 for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
  const x=a[k],y=b[k],path=prefix?`${prefix}.${k}`:k;
  if(x&&y&&typeof x==='object'&&typeof y==='object'&&!Array.isArray(x)&&!Array.isArray(y))out.push(...fieldDiff(x as Record<string,Json>,y as Record<string,Json>,path));
  else if(!same(x,y))out.push({path,from:x??null,to:y??null});
 }
 return out;
};
export type EntityDiff={added:string[];removed:string[];changed:{id:string;fields:{path:string;from:Json;to:Json}[]}[]};
function keyed<T>(a:T[],b:T[],key:(t:T)=>string):EntityDiff{
 const am=new Map(a.map(t=>[key(t),t])),bm=new Map(b.map(t=>[key(t),t]));
 return {added:[...bm.keys()].filter(k=>!am.has(k)),removed:[...am.keys()].filter(k=>!bm.has(k)),changed:[...bm].flatMap(([k,t])=>am.has(k)&&!same(am.get(k),t)?[{id:k,fields:fieldDiff(am.get(k) as Record<string,Json>,t as Record<string,Json>)}]:[])};
}
export type PlanDiff={scalars:{path:string;from:Json;to:Json}[];entities:Record<string,EntityDiff>;geometry:{moved:{id:string;from:number[];to:number[]}[];resized:{id:string;from:number[];to:number[]}[];levelChanged:string[]};changeShare:number;unchanged:boolean};
export function diffPlans(before:ArchitecturalPlan,after:ArchitecturalPlan,a0=analysePlan(before),a1=analysePlan(after)):PlanDiff{
 const scalars=fieldDiff({thesis:before.thesis,orientation:before.orientation,site:before.site,arrival:before.arrival,materials:before.materials,terraces:[...before.terraces].sort(),cameraViews:before.cameraViews},{thesis:after.thesis,orientation:after.orientation,site:after.site,arrival:after.arrival,materials:after.materials,terraces:[...after.terraces].sort(),cameraViews:after.cameraViews});
 const entities={levels:keyed(before.levels,after.levels,x=>x.id),masses:keyed(before.masses,after.masses,x=>x.id),spaces:keyed(before.spaces,after.spaces,x=>x.id),portals:keyed(before.portals,after.portals,x=>x.id),stairs:keyed(before.stairs,after.stairs,x=>x.id),roofs:keyed(before.roofs,after.roofs,x=>x.space),screens:keyed(before.screens??[],after.screens??[],x=>x.id),pools:keyed(before.pools,after.pools,x=>x.id),landscape:keyed(before.landscape,after.landscape,x=>x.id)};
 // Measured geometry: positions are compared relative to the root room when both plans share one (the compiler recentres,
 // and a moved wing must not make every other room look moved); otherwise relative to each plan's building bounds.
 const root0=before.spaces.find(s=>s.placement.relativeTo===null)?.id,root1=after.spaces.find(s=>s.placement.relativeTo===null)?.id,shared=root0!==undefined&&root0===root1;
 const rel=(an:PlanAnalysis,id:string)=>{const r=an.rects[id],o=shared?an.rects[root0!]:{x:an.building.x0,z:an.building.z0};return [Number((r.x-o.x).toFixed(2)),Number((r.z-o.z).toFixed(2))];};
 const moved:PlanDiff['geometry']['moved']=[],resized:PlanDiff['geometry']['resized']=[];
 for(const s of after.spaces){const o=before.spaces.find(x=>x.id===s.id);if(!o||!a0.rects[s.id]||!a1.rects[s.id])continue;
  const p0=rel(a0,s.id),p1=rel(a1,s.id);if(!same(p0,p1))moved.push({id:s.id,from:p0,to:p1});
  const d0=[a0.rects[s.id].width,a0.rects[s.id].depth],d1=[a1.rects[s.id].width,a1.rects[s.id].depth];if(!same(d0,d1))resized.push({id:s.id,from:d0,to:d1});}
 const levelChanged=after.spaces.filter(s=>before.spaces.find(x=>x.id===s.id)&&before.spaces.find(x=>x.id===s.id)!.level!==s.level).map(s=>s.id);
 const sp=entities.spaces,total=new Set([...before.spaces.map(s=>s.id),...after.spaces.map(s=>s.id)]).size||1;
 const touched=new Set([...sp.added,...sp.removed,...moved.map(m=>m.id),...resized.map(m=>m.id),...levelChanged]);
 const unchanged=!scalars.length&&Object.values(entities).every(e=>!e.added.length&&!e.removed.length&&!e.changed.length);
 return {scalars,entities,geometry:{moved,resized,levelChanged},changeShare:Number((touched.size/total).toFixed(2)),unchanged};
}
export type ProgrammeCheck={preserved:boolean;lost:{category:string;before:number;after:number}[];gained:{category:string;before:number;after:number}[]};
export function checkProgramme(before:ArchitecturalPlan,after:ArchitecturalPlan):ProgrammeCheck{
 const b=programmeCounts(before),a=programmeCounts(after),lost:ProgrammeCheck['lost']=[],gained:ProgrammeCheck['gained']=[];
 for(const k of Object.keys(b)){if(a[k]<b[k])lost.push({category:k,before:b[k],after:a[k]});else if(a[k]>b[k])gained.push({category:k,before:b[k],after:a[k]});}
 return {preserved:!lost.length,lost,gained};
}
export type Indicators={composition:{repeatedCellShare:number;distinctEnvelopeHeights:number;envelopeTopSpread:number;roofForms:string[];distinctRoofSpecs:number;massCount:number;largestMassAreaShare:number;footprintFill:number;uniformEaves:boolean};coherence:{errors:number;unreachableRooms:number;maxCirculationDepth:number;unlitAreaShare:number;indoorOutdoorLinks:number;sharedWallDoorShare:number};ambition:{levels:number;verticalConnections:number;sectionRange:number;screens:number;outdoorSpaces:number;pools:number}};
export function indicatorsOf(plan:ArchitecturalPlan,an:PlanAnalysis=analysePlan(plan)):Indicators{
 const interior=an.rooms.filter(r=>!r.outdoor),sig=(id:string)=>an.signals.find(s=>s.id===id)!;
 const key=(r:{width:number;depth:number;envelopeHeight:number|null})=>`${r.width}x${r.depth}x${r.envelopeHeight}`;
 const buckets=new Map<string,number>();interior.forEach(r=>buckets.set(key(r),(buckets.get(key(r))??0)+1));
 const rep=[...buckets.values()].filter(n=>n>=3).reduce((a,b)=>a+b,0);
 const tops=interior.flatMap(r=>r.top===null?[]:[r.top]),spread=tops.length?Math.max(...tops)-Math.min(...tops):0;
 const massArea=new Map<string,number>();interior.forEach(r=>massArea.set(r.mass,(massArea.get(r.mass)??0)+r.areaM2));
 const total=[...massArea.values()].reduce((a,b)=>a+b,0)||1;
 const all=Object.values(an.rects),fp=all.reduce((n,r)=>n+r.width*r.depth,0),box=an.building.width*an.building.depth||1;
 const dark=interior.filter(r=>r.windows===0).reduce((n,r)=>n+r.areaM2,0),area=interior.reduce((n,r)=>n+r.areaM2,0)||1;
 const outdoor=new Set(plan.spaces.filter(s=>s.outdoor).map(s=>s.id));
 const links=plan.portals.filter(p=>p.mode!=='window'&&(outdoor.has(p.to)||outdoor.has(p.host.space))).length;
 const doors=plan.portals.filter(p=>p.mode!=='window'&&p.to!=='exterior'),sharedDoors=doors.filter(p=>an.dependencies.some(d=>d.kind==='shared-wall'&&((d.from===p.host.space&&d.to===p.to)||(d.to===p.host.space&&d.from===p.to))&&d.side!==undefined)).length;
 return {
  composition:{repeatedCellShare:Number((rep/(interior.length||1)).toFixed(2)),distinctEnvelopeHeights:new Set(interior.map(r=>r.envelopeHeight)).size,envelopeTopSpread:Number(spread.toFixed(2)),roofForms:[...new Set(plan.roofs.map(r=>r.form))].sort(),distinctRoofSpecs:new Set(plan.roofs.map(r=>`${r.form}|${r.rise??''}`)).size,massCount:massArea.size,largestMassAreaShare:Number((Math.max(0,...massArea.values())/total).toFixed(2)),footprintFill:Number(Math.min(1,fp/box).toFixed(2)),uniformEaves:sig('uniform-eaves').fired},
  coherence:{errors:an.errorCount,unreachableRooms:an.access.unreachable.length,maxCirculationDepth:Math.max(0,...Object.values(an.access.depth)),unlitAreaShare:Number((dark/area).toFixed(2)),indoorOutdoorLinks:links,sharedWallDoorShare:Number((sharedDoors/(doors.length||1)).toFixed(2))},
  ambition:{levels:plan.levels.length,verticalConnections:plan.stairs.length,sectionRange:Number(spread.toFixed(2)),screens:plan.screens?.length??0,outdoorSpaces:outdoor.size,pools:plan.pools.length},
 };
}
export type DimensionVerdict={dimension:'composition'|'spatialCoherence'|'ambition';verdict:'improved'|'unchanged'|'regressed'|'mixed';improvements:string[];regressions:string[]};
const dim=(dimension:DimensionVerdict['dimension'],improvements:string[],regressions:string[]):DimensionVerdict=>({dimension,improvements,regressions,verdict:improvements.length&&regressions.length?'mixed':improvements.length?'improved':regressions.length?'regressed':'unchanged'});
/** Levels, stairs, pools and area are informational only. */
export function compareIndicators(a:Indicators,b:Indicators):DimensionVerdict[]{
 const imp:string[][]=[[],[],[]],reg:string[][]=[[],[],[]];
 const lower=(i:number,label:string,x:number,y:number,tol=0)=>{if(y<x-tol)imp[i].push(`${label}: ${x} → ${y}`);else if(y>x+tol)reg[i].push(`${label}: ${x} → ${y}`);};
 const up=(i:number,label:string,x:number,y:number,tol=0)=>{if(y>x+tol)imp[i].push(`${label}: ${x} → ${y}`);else if(y<x-tol)reg[i].push(`${label}: ${x} → ${y}`);};
 lower(0,'identical-cell share of interior rooms',a.composition.repeatedCellShare,b.composition.repeatedCellShare,.1);
 up(0,'distinct envelope heights',a.composition.distinctEnvelopeHeights,b.composition.distinctEnvelopeHeights);
 up(0,'distinct roof specifications',a.composition.distinctRoofSpecs,b.composition.distinctRoofSpecs);
 if(b.composition.roofForms.length>a.composition.roofForms.length)imp[0].push(`roof forms: ${a.composition.roofForms.join('/')} → ${b.composition.roofForms.join('/')}`);
 // Eave uniformity is reported but never scored: removing overhangs is a physical repair, not a new concept.
 // A clearer hierarchy is a larger gap between the dominant mass and the rest, in either direction of mass count.
 if(Math.abs(b.composition.largestMassAreaShare-a.composition.largestMassAreaShare)>=.1)(b.composition.massCount>=a.composition.massCount?imp[0]:reg[0]).push(`dominant mass share: ${a.composition.largestMassAreaShare} → ${b.composition.largestMassAreaShare} (masses ${a.composition.massCount} → ${b.composition.massCount})`);
 lower(1,'errors',a.coherence.errors,b.coherence.errors);
 lower(1,'unreachable interior rooms',a.coherence.unreachableRooms,b.coherence.unreachableRooms);
 lower(1,'windowless share of interior area',a.coherence.unlitAreaShare,b.coherence.unlitAreaShare,.1);
 up(1,'doors/passages that sit on a shared wall (share)',a.coherence.sharedWallDoorShare,b.coherence.sharedWallDoorShare,.1);
 lower(1,'maximum circulation depth from arrival',a.coherence.maxCirculationDepth,b.coherence.maxCirculationDepth,2);
 up(1,'indoor-outdoor links',a.coherence.indoorOutdoorLinks,b.coherence.indoorOutdoorLinks);
 up(2,'section range (m)',a.ambition.sectionRange,b.ambition.sectionRange,.3);
 up(2,'climatic/privacy screens',a.ambition.screens,b.ambition.screens);
 // Level and stair counts are reported but never scored: more storeys are not better architecture.
 return [dim('composition',imp[0],reg[0]),dim('spatialCoherence',imp[1],reg[1]),dim('ambition',imp[2],reg[2])];
}
