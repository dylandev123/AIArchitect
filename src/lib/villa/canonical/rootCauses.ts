/** Independent findings are measurements; several can be consequences of one authored decision. This groups them by that decision so a rejected plan
 * reports each cause once, with every affected finding listed under it. Pure, reads only the findings (and the plan for the roofs involved); it never
 * decides, repairs or claims a downstream phase passed. */
import type {Finding} from './diagnose';
import type {ArchitecturalPlan} from './plan';
export type RootCause={
 key:string;title:string;count:number;stages:string[];findingIds:string[];
 /** Who must act: the model's architectural decision, or a software defect (none are classified as such by grouping alone). */
 owner:'architectural-decision';
 explanation:string;options:string[];
};
const unique=<T,>(a:T[])=>[...new Set(a)];
export function rootCauses(findings:Finding[],plan?:ArchitecturalPlan):RootCause[]{
 const groups=new Map<string,Finding[]>();
 for(const f of findings){if(f.severity!=='error')continue;const key=f.cause??`${f.stage}:${f.id}`;groups.set(key,[...(groups.get(key)??[]),f]);}
 const overhang=(id:string)=>plan?.roofs.find(r=>r.space===id)?.overhang;
 return [...groups].map(([key,list])=>{
  const base={key,count:list.length,stages:unique(list.map(f=>f.stage)),findingIds:list.map(f=>f.id),owner:'architectural-decision' as const};
  if(key.startsWith('roof-reach:')){
   const taller=key.endsWith('taller-neighbour');
   const roofs=unique(list.flatMap(f=>f.id.split('/'))).filter(id=>taller?list.some(x=>x.id.startsWith(`${id}/`)):true);
   const described=roofs.map(id=>{const o=overhang(id);return o===undefined?id:`${id} (${o} m)`;}).join(', ');
   return {...base,title:taller?'A roof overhang reaches into a taller neighbouring volume':'Overhangs of abutting roofs overlap at the same height',
    explanation:`${list.length} findings, one decision: an overhang is valid only where nothing stands within its reach at the roof's height, but ${taller?'these roofs project into the wall volume of a taller neighbour':'these roofs stand against another roof at the same height and their overhangs overlap'}. Roofs involved: ${described}. An edge that lies wholly against such a wall or roof is already built flush by the compiler (and stated); these are the ones it cannot decide: an edge that a neighbour faces along only part of its length, a corner two sides could yield, or a neighbour that does not touch the wall. Measured with the compiler's roof footprints and eaves, so the compiler rejects the same pairs.`,
    options:['give the roof overhang 0 (an edge cannot be flush along part of its length and project along the rest)','align the rooms so the edge lies wholly against the neighbour, or wholly clear of it','cover abutting same-height rooms with one roofSpan','separate the rooms so the overhang has clear ground']};
  }
  if(key.startsWith('facade:')){
   const id=key.slice(7);
   return {...base,title:`Facade rhythm ${id} conflicts with its wall or with neighbouring openings`,
    explanation:`${list.length} finding${list.length>1?'s':''} on the rhythm ${id}, whose bays are spread evenly over the exposed run of its wall when other rooms share part of it: ${list.map(f=>`${f.id}: ${f.message}`).join(' ')}`,
    options:['declare the rhythm on a wall with an exposed run long enough (the findings name the runs and how many bays each holds)','use fewer or narrower bays','author individual openings on the exposed run instead of a rhythm']};
  }
  return {...base,title:list[0].message.length>140?`${list[0].message.slice(0,137)}...`:list[0].message,explanation:list.map(f=>f.message).join(' '),options:[]};
 });
}
