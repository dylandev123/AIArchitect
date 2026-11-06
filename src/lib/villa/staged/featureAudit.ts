/** Completion audit over the existing semantic spec and constructed scene. Never adds geometry. */
import type {ArchitecturalScene} from '../scene/model';
import type {HouseSpec} from './spec';
import type {Finding} from './validate';
import {allRooms,blockRect,overlapArea} from './layout';
import {outdoorKind,resolvedPoolIntent} from './intentions';
import {poolRequirement} from './requirements';
export function featureAudit(spec:HouseSpec,scene:ArchitecturalScene,components:Record<string,string>,stage:2|3|4|5,brief=''){
 const findings:Finding[]=[],rooms=allRooms(spec),elements=scene.elements;
 const missing=(subject:string,message:string)=>findings.push({stage,code:'missing-architectural-feature',subject,message});
 const inventory={bedrooms:rooms.filter(r=>r.type==='bedroom').length,bathrooms:rooms.filter(r=>r.type==='bath').length,kitchens:rooms.filter(r=>r.type==='kitchen').length,living:rooms.filter(r=>r.type==='living').length,dining:rooms.filter(r=>r.type==='dining').length,circulation:rooms.filter(r=>['foyer','hall','gallery'].includes(r.type)).length,roofElements:elements.filter(e=>e.kind==='roof').length,verandas:spec.exterior.verandas.length,waterSurfaces:elements.filter(e=>e.kind==='water').length,terraces:elements.filter(e=>e.semanticType==='terrace').length,trees:spec.siteWork.trees.length,plantingBeds:spec.siteWork.beds.length,hedges:spec.siteWork.hedges.length,lawns:spec.siteWork.lawns.length};
 if(stage>=3){
  for(const b of spec.blocks.filter(b=>b.level===0))if(!elements.some(e=>e.id===`slab-${b.id}`&&e.kind==='plate'))missing(b.id,'The ground-floor slab is absent from the constructed building.');
  for(const [word,type] of [['kitchen','kitchen'],['dining','dining'],['living','living']] as const)if(new RegExp(`\\b${word}\\b`,'i').test(brief)&&!rooms.some(r=>r.type===type))missing(type,`The brief requires ${word}, but no such room exists in the accepted programme.`);
  if(!rooms.some(r=>r.type==='foyer'))missing('entrance','No foyer anchors circulation.');
  for(const room of rooms)if(!elements.some(e=>components[e.id]===`room:${room.id}`||e.id.startsWith(`w-${room.id}-`)))missing(room.id,'The room exists in the programme but has no constructed boundary geometry.');
 }
 if(stage>=4){
  for(const b of spec.blocks)if(!(b.level===0&&spec.blocks.some(u=>u.level===1&&overlapArea(blockRect(b),blockRect(u))>.01))&&!elements.some(e=>components[e.id]===`roof:${b.id}`&&e.kind==='roof'))missing(b.id,'An exposed building volume has no constructed roof.');
  // Every declared door must be a constructed door, the main entrance above all (an equal-length wall once lost it).
  for(const d of spec.exterior.doors)if(!elements.some(e=>e.kind==='entrance'&&e.parent&&components[e.id]===(d.kind==='main'?'entrance':`room:${d.room}`)&&e.parent.startsWith(`w-${d.room}-${d.side}-`)))missing(d.id,`Door ${d.id} (${d.room}, ${d.side}) was declared but no door was constructed in that wall.`);
  for(const v of spec.exterior.verandas)for(const suffix of ['deck','roof'])if(!elements.some(e=>e.id===`veranda-${v.id}-${suffix}`))missing(v.id,`Veranda ${suffix} is absent from the scene.`);
 }
 for(const o of spec.openSpaces){
  const kind=outdoorKind(o);
  if(kind==='pool'){
   if(stage<5&&inventory.waterSurfaces)missing(o.id,'A pool intention was treated as completed water before Stage 5.');
   if(stage===5&&resolvedPoolIntent(spec)?.id===o.id&&elements.some(e=>e.id===`open-${o.id}`))missing(o.id,'Resolved pool is duplicated by its old outdoor pad.');
  }else if(kind==='terrace'&&!elements.some(e=>e.id===`open-${o.id}`))missing(o.id,'Retained outdoor terrace disappeared from the constructed scene.');
 }
 if(stage===5){
  for(const [collection,prefix] of [[spec.siteWork.lawns,'lawn'],[spec.siteWork.beds,'bed'],[spec.siteWork.hedges,'hedge'],[spec.siteWork.paths,'path'],[spec.siteWork.trees,'tree']] as const)for(const c of collection)if(!elements.some(e=>components[e.id]===`landscape:${c.id}`&&(e.id===`${prefix}-${c.id}`||e.id.startsWith(`${prefix}-${c.id}-`))))missing(c.id,'A declared landscape component has disappeared from the scene.');
  if(spec.siteWork.pool)for(const side of ['z-minus','z-plus','x-minus','x-plus'])if(!elements.some(e=>e.id===`pool-wall-${side}`&&e.kind==='wall'))missing('pool','A basin wall is missing from the constructed pool.');
  const bound=resolvedPoolIntent(spec);if(bound&&!elements.find(e=>e.kind==='water')?.aliases?.includes(bound.id))missing(bound.id,'The constructed water lost its retained intention identity.');
  const wanted=brief?poolRequirement(brief):'optional';
  if(spec.siteWork.pool&&(inventory.waterSurfaces!==1||!elements.some(e=>e.id==='pool-floor')))missing('pool','A house with a pool must have exactly one water surface and its real pool basin assembly.');
  if(!spec.siteWork.pool&&inventory.waterSurfaces)missing('pool','Water exists without a declared pool.');
  if(wanted==='required'&&!spec.siteWork.pool)missing('pool','The brief requires a swimming pool, but none was constructed.');
  if(wanted==='excluded'&&spec.siteWork.pool)missing('pool','The brief excludes a swimming pool, but one was constructed.');
  if(/\b(planting|landscap\w*)\b/i.test(brief)&&!inventory.trees&&!inventory.plantingBeds&&!inventory.hedges)missing('planting','The brief requires planting; lawn alone is not constructed planting.');
 }
 return {inventory,findings};
}
