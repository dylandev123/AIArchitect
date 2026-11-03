/** Plan-level architectural review of the programme, readable before (or without) a compiled house.
 *
 * Three kinds of statement, kept apart:
 *  - BRIEF PROGRAMME: what the client's own words require (a count of bedroom suites, living and entertainment space, an entrance, service
 *    accommodation, terraces, a pool), read by the same deterministic parser the revision workflow uses (revision/briefProgramme.ts) and checked
 *    against the spaces the plan declares. Nothing the brief does not say is required, and no size, storey count or complexity is demanded.
 *  - DAYLIGHT: whether a primary living or dining space has any window (authored or declared through composition facades) and, if not, what its
 *    exterior openings are. A door is a passage; whether it is glazed is not modelled, so such a room is reported as "daylight unestablished",
 *    not as dark.
 *  - OBSERVATION: measurable repetition (identical cells), offered as a design judgement for a person. Never a score and never a gate.
 * Pure; edits nothing. */
import type {CompletionFinding} from '../scene/completion';
import type {ArchitecturalPlan} from './plan';
import {resolveLayout} from './layout';
import {composedView} from './composition';
import {deriveBriefProgramme,checkBriefProgramme,isBedroomSpace,bedroomSuites} from './revision/briefProgramme';

const PRIMARY_LIVING=/\b(living|salon|lounge|great room|family room|dining)\b/i;
const f2=(n:number)=>Number(n.toFixed(2));
export type ProgrammeReview={
 brief:{requirements:ReturnType<typeof checkBriefProgramme>['requirements'];missing:ReturnType<typeof checkBriefProgramme>['missing']};
 daylight:{room:string;windows:number;exteriorDoors:string[];status:'windowed'|'doors-only'|'none'}[];
 repeatedCells:{cell:string;rooms:string[]}[];
 findings:CompletionFinding[];
};
export function programmeReview(prompt:string,plan:ArchitecturalPlan):ProgrammeReview{
 const findings:CompletionFinding[]=[];
 const checked=checkBriefProgramme(deriveBriefProgramme(prompt),plan);
 // The revision gate counts interior entry rooms only. Here the arrival space itself is the entrance, whether a roofed porch or a hall.
 const arrival=plan.spaces.some(s=>s.id===plan.arrival);
 if(arrival){checked.missing=checked.missing.filter(m=>m.category!=='entry');checked.requirements=checked.requirements.map(q=>q.category==='entry'?{...q,found:Math.max(q.found,1),ok:true}:q);}
 for(const m of checked.missing){
  const why=m.category==='bedroom'?` ${plan.spaces.filter(isBedroomSpace).length} sleeping room(s) are declared and ${bedroomSuites(plan).length} of them have a bathroom space joined by a door or state their own facilities; a suite label or "ensuite" in prose is not a bathroom the plan contains.`:'';
  findings.push({category:'likely-architectural-incompleteness',code:'brief-programme',elementIds:[],message:`Brief programme: the brief says "${m.briefPhrase}" but the plan ${m.problem}.${why}`});
 }
 const {rects}=resolveLayout(plan),view=composedView(plan,rects);
 const daylight:ProgrammeReview['daylight']=plan.spaces.filter(s=>!s.outdoor&&PRIMARY_LIVING.test(`${s.id} ${s.use}`)&&rects.has(s.id)).map(s=>{
  const windows=plan.portals.filter(p=>p.host.space===s.id&&p.mode==='window').length+view.facades.filter(f=>f.host.space===s.id&&f.mode==='window').length;
  const outside=[...plan.portals.map(p=>({host:p.host.space,to:p.to,mode:p.mode})),...view.facades.map(f=>({host:f.host.space,to:f.to,mode:f.mode}))].filter(p=>p.mode!=='window'&&((p.host===s.id&&plan.spaces.find(x=>x.id===p.to)?.outdoor)||(p.to===s.id&&plan.spaces.find(x=>x.id===p.host)?.outdoor))).map(p=>p.host===s.id?p.to:p.host);
  return {room:s.id,windows,exteriorDoors:[...new Set(outside)],status:windows>0?'windowed' as const:outside.length?'doors-only' as const:'none' as const};
 });
 for(const d of daylight){
  if(d.status==='doors-only')findings.push({category:'subjective-design-concern',code:'daylight-unestablished',elementIds:[d.room],message:`Daylight: ${d.room} is a primary living or dining space with no window; its exterior openings are doors to ${d.exteriorDoors.join(', ')}. Whether those doors are glazed is not modelled, so usable daylight is unestablished. If glazed doors are the intended light source, state it in the room's use or add windows.`});
  if(d.status==='none')findings.push({category:'likely-architectural-incompleteness',code:'daylight-none',elementIds:[d.room],message:`Daylight: ${d.room} is a primary living or dining space with no window and no door to an outdoor space.`});
 }
 // Identical bedroom cells: measured, offered as a design observation (the mission asks for no repetitive suites), never a rule.
 const cells=new Map<string,string[]>();
 for(const s of plan.spaces.filter(isBedroomSpace))cells.set(`${f2(s.width)}×${f2(s.depth)} m`,[...(cells.get(`${f2(s.width)}×${f2(s.depth)} m`)??[]),s.id]);
 const repeatedCells=[...cells].filter(([,rooms])=>rooms.length>=3).map(([cell,rooms])=>({cell,rooms}));
 for(const r of repeatedCells)findings.push({category:'subjective-design-concern',code:'repeated-cells',elementIds:r.rooms,message:`Repetition: ${r.rooms.length} bedroom spaces are identical ${r.cell} cells (${r.rooms.join(', ')}). Whether identical suites suit the commission is a design judgement; the brief's mission asks for no repetitive suites unless that repetition is deliberate.`});
 return {brief:{requirements:checked.requirements,missing:checked.missing},daylight,repeatedCells,findings};
}
