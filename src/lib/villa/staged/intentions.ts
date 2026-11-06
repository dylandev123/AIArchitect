/** Cross-stage bindings for existing outdoor components, not a new design/geometry engine. */
import type {HouseSpec,OpenSpace} from './spec';
import type {Finding} from './validate';
import {poolReservation} from './poolGeometry';
export function outdoorKind(o:OpenSpace):'pool'|'veranda'|'terrace'{
 // Use the first architectural noun, not a later relational mention (e.g.
 // “terrace adjoining the veranda” remains a terrace).
 const noun=o.role.match(/\b(pool|veranda|verandah|loggia|porch|pergola|terrace|patio|deck)\b/i)?.[1].toLowerCase();
 if(noun==='pool'&&!/\bpool\s+(?:deck|terrace)\b/i.test(o.role))return 'pool';
 if(noun&&['veranda','verandah','loggia','porch','pergola'].includes(noun))return 'veranda';
 return 'terrace';
}
export function outdoorIntentions(spec:HouseSpec){return spec.openSpaces.map(o=>({...o,kind:outdoorKind(o),constructAt:outdoorKind(o)==='pool'?5:outdoorKind(o)==='veranda'?4:2}));}
export function resolvedPoolIntent(spec:HouseSpec){const id=spec.siteWork.pool?.sourceIntent;return id?spec.openSpaces.find(o=>o.id===id&&outdoorKind(o)==='pool'):undefined;}
export function intentionFindings(spec:HouseSpec,stage:2|3|4|5):Finding[]{
 const out:Finding[]=[],add=(subject:string,message:string)=>out.push({stage,code:'unresolved-architectural-intent',subject,message});
 const pools=spec.openSpaces.filter(o=>outdoorKind(o)==='pool');
 if(stage>=4)for(const o of spec.openSpaces.filter(o=>outdoorKind(o)==='veranda')){
  const v=spec.exterior.verandas.find(v=>v.id===o.id);
  if(!v)add(o.id,`Retained covered outdoor intention ${o.id} has no constructed veranda.`);
  else{
   const host=spec.blocks.find(b=>b.id===v.block),along=o.side==='n'||o.side==='s'?o.cx:o.cz,len=o.side==='n'||o.side==='s'?o.w:o.d,depth=o.side==='n'||o.side==='s'?o.d:o.w;
   if(!host||v.block!==o.host||v.side!==o.side||Math.abs(v.from-(along-len/2))>.02||Math.abs(v.to-(along+len/2))>.02||Math.abs(v.depth-depth)>.02)add(o.id,`Veranda ${o.id} must retain its accepted host, side and footprint; a successful compilation cannot authorize a redesign.`);
  }
 }
 if(stage===5){
  if(pools.length>1)add('pool','This contract constructs one swimming pool, but multiple retained pool intentions require clarification.');
  if(pools.length&&(!resolvedPoolIntent(spec)||pools[0].id!==spec.siteWork.pool?.sourceIntent))add(pools[0].id,'Stage 5 must explicitly bind its actual pool to the retained pool intention using sourceIntent.');
  if(spec.siteWork.pool?.sourceIntent&&!resolvedPoolIntent(spec))add(spec.siteWork.pool.sourceIntent,'Pool sourceIntent does not name a retained pool intention.');
  const o=resolvedPoolIntent(spec);
  if(o&&spec.siteWork.pool){const p=poolReservation(spec.siteWork.pool),same=Math.abs(p.x0-(o.cx-o.w/2))<.02&&Math.abs(p.x1-(o.cx+o.w/2))<.02&&Math.abs(p.z0-(o.cz-o.d/2))<.02&&Math.abs(p.z1-(o.cz+o.d/2))<.02;
   if(!same&&!spec.siteWork.pool.intentResolution?.trim())add(o.id,'The pool/deck differs from its conceptual footprint; record an explicit Stage 5 intentResolution explaining the measured design decision.');
  }
 }
 return out;
}
