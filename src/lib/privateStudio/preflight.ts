/** Shared conservative capability preflight. Server admission always repeats this check. */
import {promptRequirements} from '@/lib/villa/staged/requirements';
const feature = String.raw`(?:detached buildings?|terrain changes?|basements?|hillsides?|slopes?|sloping (?:sites?|land)|curved (?:walls?|roofs?|buildings?)|three[ -]storey (?:houses?|buildings?))`;
// Remove only explicit exclusions of known features and their coordinated list.
// Do not ignore an entire sentence: “no basement, but add curved walls” must still fail.
const excluded = new RegExp(String.raw`\b(?:no|without|exclude|avoid)\s+(?:any\s+)?${feature}(?:\s*(?:,\s*(?:(?:or|and)\s+)?|\s+(?:or|and)\s+)${feature})*\b`, 'gi');
/** Honest capability limits: flat land, rectangular blocks, one or two storeys. A pool is optional. */
export function preflightBrief(brief:string):string|undefined {
 const requested=brief.replace(excluded,' ');
 if(/\b(hillsides?|slop(?:e|es|ing)|basements?|curved|three[ -]stor(?:e?y)|(?:3|three|four|five)\s+(?:stor(?:eys|ies)|floors|levels))\b/i.test(requested))
  return 'Unsupported: staged live generation supports flat land, rectangular blocks and one or two storeys.';
 try {
  const requirements=promptRequirements(brief);
  if(!requirements.bedrooms)return 'Specify the number of bedrooms explicitly (for example "three bedrooms").';
 }catch(e){return e instanceof Error?e.message:'Clarify the architectural requirements';}
}
