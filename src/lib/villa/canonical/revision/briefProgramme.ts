/** The original user brief is authoritative for the architectural programme. Requirements are read deterministically from
 * the brief's own words; each carries the verbatim phrase it came from, and nothing the brief does not say is required.
 * Spaces that an earlier design introduced beyond these may be merged, reorganised, differentiated or removed. */
import type {ArchitecturalPlan} from '../plan';
import {programmeCounts} from './analysis';
export type BriefRequirement={id:string;category:'bedroom'|'living'|'entry'|'service'|'terrace'|'pool';minimum:number;approximate?:number;briefPhrase:string;rule:string};
const WORDS:Record<string,number>={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,fourteen:14,sixteen:16,twenty:20};
const LIVING=/living|salon|lounge|family room|entertain|media|cinema|games/i;
const num=(s:string)=>/^\d+$/.test(s)?Number(s):WORDS[s.toLowerCase()];
/** Brief-derived requirements, in a stable order. A plural noun with no stated number means at least two; "approximately N" allows one fewer (rounded) and is never an upper bound. */
export function deriveBriefProgramme(brief:string):BriefRequirement[]{
 const out:BriefRequirement[]=[],take=(re:RegExp)=>re.exec(brief);
 const bed=take(new RegExp(`\\b(?:(approximately|about|around|roughly|circa)\\s+)?(\\d+|${Object.keys(WORDS).join('|')})\\s+`+"(?:[a-z-]+\\s+){0,3}?(?:bedroom\\s+suites?|bedrooms?|suites?)\\b",'i'));
 if(bed&&num(bed[2])){const n=num(bed[2]),approx=!!bed[1];out.push({id:'bedrooms',category:'bedroom',minimum:approx?Math.max(1,Math.ceil(n*.8)):n,...(approx?{approximate:n}:{}),briefPhrase:bed[0],rule:approx?`approximately ${n}: at least ${Math.max(1,Math.ceil(n*.8))} bedroom spaces; no upper limit is enforced`:`at least ${n} bedroom spaces`});}
 const liv=take(/\b(?:[a-z]+\s+)?living(?:\s+and\s+entertainment)?\s+(spaces?|rooms?|areas?)\b/i);
 if(liv){const plural=/s$/i.test(liv[1]),min=plural?2:1;out.push({id:'living-entertainment',category:'living',minimum:min,briefPhrase:liv[0],rule:`${plural?'plural, so at least two':'at least one'} living or entertainment space${plural?'s':''}`});}
 const ent=take(/\b(?:[a-z]+\s+)?entrance\b/i);if(ent)out.push({id:'entrance',category:'entry',minimum:1,briefPhrase:ent[0],rule:'at least one entrance space'});
 const svc=take(/\bservice accommodation\b/i);if(svc)out.push({id:'service',category:'service',minimum:1,briefPhrase:svc[0],rule:'at least one service space'});
 const ter=take(/\b(?:[a-z]+\s+){0,2}?terraces?\b/i);if(ter){const plural=/terraces\b/i.test(ter[0]);out.push({id:'terraces',category:'terrace',minimum:plural?2:1,briefPhrase:ter[0],rule:`${plural?'plural, so at least two':'at least one'} terrace${plural?'s':''}`});}
 const pool=take(/\b(?:[a-z]+\s+)?(?:swimming\s+)?pool\b/i);if(pool)out.push({id:'pool',category:'pool',minimum:1,briefPhrase:pool[0],rule:'at least one pool'});
 return out;
}
export type BriefProgrammeCheck={preserved:boolean;requirements:{id:string;category:string;minimum:number;found:number;ok:boolean;exceedsApproximate?:boolean}[];missing:{id:string;category:string;minimum:number;found:number;briefPhrase:string}[]};
/** A bedroom space is a sleeping room, judged by its id and use. Baths, halls, galleries and landings that merely mention a suite are not bedrooms. */
export const isBedroomSpace=(s:{id:string;use:string;outdoor:boolean})=>!s.outdoor&&!/bath|\bwc\b|powder|hall|gallery|landing|corridor|stair|vestibule|entry|dressing/i.test(s.id)&&/\bbedrooms?\b|\bsleeping\b|\bsuites?\b/i.test(`${s.id} ${s.use}`);
export function countFor(plan:ArchitecturalPlan,category:BriefRequirement['category']):number{
 if(category==='bedroom')return plan.spaces.filter(isBedroomSpace).length;
 if(category==='living')return plan.spaces.filter(s=>!s.outdoor&&(LIVING.test(s.use)||LIVING.test(s.id))).length;
 return programmeCounts(plan)[category]??0;
}
export function checkBriefProgramme(reqs:BriefRequirement[],plan:ArchitecturalPlan):BriefProgrammeCheck{
 const rows=reqs.map(r=>{const found=countFor(plan,r.category),ok=found>=r.minimum;return {id:r.id,category:r.category,minimum:r.minimum,found,ok,...(r.approximate&&found>Math.ceil(r.approximate*1.34)?{exceedsApproximate:true}:{})};});
 return {preserved:rows.every(r=>r.ok),requirements:rows,missing:rows.filter(r=>!r.ok).map(r=>({id:r.id,category:r.category,minimum:r.minimum,found:r.found,briefPhrase:reqs.find(q=>q.id===r.id)!.briefPhrase}))};
}
