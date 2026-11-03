/** The original user brief is authoritative for the architectural programme. Requirements are read deterministically from
 * the brief's own words; each carries the verbatim phrase it came from, and nothing the brief does not say is required.
 * Spaces that an earlier design introduced beyond these may be merged, reorganised, differentiated or removed. */
import type {ArchitecturalPlan} from '../plan';
import {programmeCounts} from './analysis';
export type BriefRequirement={id:string;category:'bedroom'|'living'|'entry'|'service'|'terrace'|'pool';minimum:number;maximum?:number;approximate?:number;suite?:boolean;briefPhrase:string;rule:string};
const WORDS:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,fourteen:14,sixteen:16,twenty:20};
const LIVING=/living|salon|lounge|family room|entertain|media|cinema|games/i;
const num=(s:string)=>/^\d+$/.test(s)?Number(s):WORDS[s.toLowerCase()];
/** Brief-derived requirements, in a stable order. A plural noun with no stated number means at least two. "Approximately N" targets N and accepts N-1 to N+1 (a bedroom suite is sleeping accommodation with private bathroom facilities); an exact N is a minimum. */
export function deriveBriefProgramme(brief:string):BriefRequirement[]{
 const out:BriefRequirement[]=[],take=(re:RegExp)=>re.exec(brief);
 const bed=take(new RegExp(`\\b(?:(approximately|about|around|roughly|circa)\\s+)?(\\d+|${Object.keys(WORDS).join('|')})\\s+`+"(?:[a-z-]+\\s+){0,3}?(?:bedroom\\s+suites?|bedrooms?|suites?)\\b(?!\\s+(?:wings?|blocks?|pavilions?|houses?|villas?|cottages?|apartments?|towers?|ranges?|buildings?|volumes?|floors?|levels?))",'i'));
 if(bed&&num(bed[2])){const n=num(bed[2]),approx=!!bed[1];const suite=/suites?\b/i.test(bed[0]);out.push({id:'bedrooms',category:'bedroom',...(suite?{suite}:{}),minimum:approx?Math.max(1,n-1):n,...(approx?{maximum:n+1,approximate:n}:{}),briefPhrase:bed[0],rule:approx?`approximately ${n}: target ${n}, accept ${Math.max(1,n-1)} to ${n+1} bedroom suites (sleeping accommodation with private bathroom facilities, as connected spaces or within the room); fewer than ${Math.max(1,n-1)} suites or more than ${n+1} sleeping rooms is rejected`:`at least ${n} bedroom suites (sleeping accommodation with private bathroom facilities)`});}
 const liv=take(/\b(?:[a-z]+\s+)?living(?:\s+and\s+entertainment)?\s+(spaces?|rooms?|areas?)\b/i);
 if(liv){const plural=/s$/i.test(liv[1]),min=plural?2:1;out.push({id:'living-entertainment',category:'living',minimum:min,briefPhrase:liv[0],rule:`${plural?'plural, so at least two':'at least one'} living or entertainment space${plural?'s':''}`});}
 const ent=take(/\b(?:[a-z]+\s+)?entrance\b/i);if(ent)out.push({id:'entrance',category:'entry',minimum:1,briefPhrase:ent[0],rule:'at least one entrance space'});
 const svc=take(/\bservice accommodation\b/i);if(svc)out.push({id:'service',category:'service',minimum:1,briefPhrase:svc[0],rule:'at least one service space'});
 const ter=take(/\b(?:[a-z]+\s+){0,2}?terraces?\b/i);if(ter){const plural=/terraces\b/i.test(ter[0]);out.push({id:'terraces',category:'terrace',minimum:plural?2:1,briefPhrase:ter[0],rule:`${plural?'plural, so at least two':'at least one'} terrace${plural?'s':''}`});}
 const pool=take(/\b(?:[a-z]+\s+)?(?:swimming\s+)?pool\b/i);if(pool)out.push({id:'pool',category:'pool',minimum:1,briefPhrase:pool[0],rule:'at least one pool'});
 return out;
}
export type BriefProgrammeCheck={preserved:boolean;requirements:{id:string;category:string;minimum:number;maximum?:number;found:number;sleepingRooms?:number;ok:boolean}[];missing:{id:string;category:string;minimum:number;maximum?:number;found:number;sleepingRooms?:number;briefPhrase:string;problem:string}[]};
/** A bedroom space is a sleeping room, judged by its id and use. Baths, halls, galleries and landings that merely mention a suite are not bedrooms. */
export const isBedroomSpace=(s:{id:string;use:string;outdoor:boolean})=>!s.outdoor&&!/bath|\bwc\b|powder|hall|gallery|landing|corridor|stair|vestibule|entry|dressing/i.test(s.id)&&/\bbedrooms?\b|\bsleeping\b|\bsuites?\b/i.test(`${s.id} ${s.use}`);
const BATH=/\bbath|ensuite|\bwc\b|powder|shower|washroom/i;
const isBathSpace=(s:{id:string;use:string;outdoor:boolean})=>!s.outdoor&&BATH.test(`${s.id} ${s.use}`);
/** Sleeping rooms that have private bathroom facilities: a bath space joined to the room by a door or passage (each bath serves one room), or facilities the room's own use declares. Room names are not prescribed. */
export function bedroomSuites(plan:ArchitecturalPlan){
 const baths=new Set(plan.spaces.filter(isBathSpace).map(s=>s.id)),claimed=new Set<string>(),suites:string[]=[];
 for(const bed of plan.spaces.filter(isBedroomSpace)){
  const joined=plan.portals.filter(p=>p.mode!=='window'&&(p.host.space===bed.id&&baths.has(p.to)||p.to===bed.id&&baths.has(p.host.space))).map(p=>p.host.space===bed.id?p.to:p.host.space).find(b=>!claimed.has(b));
  if(joined){claimed.add(joined);suites.push(bed.id);}else if(BATH.test(bed.use))suites.push(bed.id);
 }
 return suites.map(id=>plan.spaces.find(s=>s.id===id)!);
}
export function countFor(plan:ArchitecturalPlan,category:BriefRequirement['category'],suite=true):number{
 if(category==='bedroom')return suite?bedroomSuites(plan).length:plan.spaces.filter(isBedroomSpace).length;
 if(category==='living')return plan.spaces.filter(s=>!s.outdoor&&(LIVING.test(s.use)||LIVING.test(s.id))).length;
 return programmeCounts(plan)[category]??0;
}
export function checkBriefProgramme(reqs:BriefRequirement[],plan:ArchitecturalPlan):BriefProgrammeCheck{
 const rows=reqs.map(r=>{
  const found=countFor(plan,r.category,r.suite??false),sleepingRooms=r.category==='bedroom'?plan.spaces.filter(isBedroomSpace).length:undefined;
  const tooFew=found<r.minimum,tooMany=r.maximum!==undefined&&Math.max(found,sleepingRooms??0)>r.maximum;
  return {id:r.id,category:r.category,minimum:r.minimum,...(r.maximum!==undefined?{maximum:r.maximum}:{}),found,...(sleepingRooms!==undefined?{sleepingRooms}:{}),ok:!tooFew&&!tooMany,problem:tooFew?`needs at least ${r.minimum}${r.category==='bedroom'?' suites with private bathroom facilities':''}, found ${found}`:tooMany?`allows at most ${r.maximum}, found ${Math.max(found,sleepingRooms??0)} sleeping rooms`:''};
 });
 return {preserved:rows.every(r=>r.ok),requirements:rows.map(({problem:_p,...r})=>r),missing:rows.filter(r=>!r.ok).map(({ok:_o,problem,...r})=>({...r,problem,briefPhrase:reqs.find(q=>q.id===r.id)!.briefPhrase}))};
}
