/** Verification of correction offers for an architectural-plan-1.
 *
 * spatial.ts and arrangement.ts generate CANDIDATE edits: each clears one measurement on the resolved arrangement. That is not enough to
 * call an edit safe: a lawn can be moved off one room onto another, an `adjoin` can be met through an outdoor terrace, a gap can be closed
 * and a door left with no shared wall. Here every candidate is applied to a CLONE and the whole stack is re-run:
 *   arrangement   layout, collisions, constraints, site extent and site overlaps (spatial.ts);
 *   diagnosis     openings, access, roofs, screens, site containment, composition (diagnose.ts);
 *   compilation   compileArchitecturalPlan, with the phase it reached;
 *   connections   interior rooms that shared a wall wide enough for a door before the edit and no longer do.
 * and the result is classified, never assumed:
 *   verified              every check ran, the target is cleared, nothing new appears and the edited plan compiles;
 *   decision-required     as verified, but the edit gives up an interior adjacency the plan had: an architectural trade-off to choose;
 *   introduces-conflicts  the edit clears its target and creates a finding that did not exist before;
 *   unverified            a check could not run, the target is still reported, or compilation cannot confirm the edit (it stops on problems
 *                         the edit does not address, or at a phase this plan never reached before), so downstream effects are unknown.
 * Nothing here applies an edit to a plan; the author decides. Pure and tolerant: it never throws on an invalid plan. */
import {architecturalPlanSchema,compileArchitecturalPlan,PlanRejection,COMPILE_PHASES,type ArchitecturalPlan,type CompilePhase} from './plan';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {diagnosePlan} from './diagnose';
import {arrangementKeys,coordinatePlan,type Coordination,type SiteBasis} from './spatial';
import {withEdits,type PlanEdit} from './arrangement';
import {resolveLayout} from './layout';
import {sharedRuns,SIDES,WALL} from './coordination';

export type CorrectionStatus='verified'|'decision-required'|'introduces-conflicts'|'unverified';
export type CheckName='arrangement'|'diagnosis'|'compilation'|'interior-connections';
export type CorrectionCheck={name:CheckName;ran:boolean;passed:boolean|null;detail:string};
export type Correction={
 /** The finding(s) this edit is meant to clear (stable keys, see `keyOf`). */
 targets:string[];
 edits:PlanEdit[];
 note:string;
 status:CorrectionStatus;
 statusReason:string;
 checks:CorrectionCheck[];
 /** Targets no longer reported after the edit. */
 resolved:string[];
 /** Other findings of the plan that vanish with this edit (consequences of the same cause), beyond its own targets. */
 alsoResolved:string[];
 /** Findings present after the edit and absent before it (arrangement, diagnosis, or compilation at the phase already reached). */
 newFindings:string[];
 /** What still stops compilation after the edit, when it does. Listed so that nothing is claimed beyond what ran. */
 compilationBlockers:string[];
 /** Interior adjacencies (rooms sharing a wall a door could use) that the edit removes. */
 lostConnections:string[];
 /** Rooms whose position changes. */
 displaced:string[];
 /** Always true: software offers, the author decides. */
 neverApplied:true;
};
const describeEdit=(e:PlanEdit)=>`${e.node}.${e.field} ${e.from}→${e.to}`;

type CompileOutcome={ran:true;ok:true}|{ran:true;ok:false;stage:CompilePhase;keys:string[];messages:string[]}|{ran:false;reason:string};
/** A message is keyed by the entity it names, so a rewording or a changed measurement does not look like a new problem. */
export const messageKey=(m:string)=>(m.match(/^[A-Za-z0-9_./×-]+/)?.[0]??m.slice(0,40)).replace(/:$/,'');
function compileOutcome(plan:ArchitecturalPlan):CompileOutcome{
 try{compileArchitecturalPlan(plan);return {ran:true,ok:true};}
 catch(e){
  if(e instanceof PlanRejection)return {ran:true,ok:false,stage:e.stage,keys:e.decisions.map(m=>`compile:${messageKey(m)}`),messages:e.decisions};
  if(e instanceof DesignConflict)return {ran:true,ok:false,stage:'derive',keys:e.decisions.map(m=>`compile:${messageKey(m)}`),messages:e.decisions};
  return {ran:false,reason:String((e as Error)?.message??e)};
 }
}
/** Interior pairs of the same level whose shared wall can hold a door. */
function interiorLinks(plan:ArchitecturalPlan):Set<string>{
 const {rects}=resolveLayout(plan),out=new Set<string>(),need=1+2*WALL;
 const indoor=plan.spaces.filter(s=>!s.outdoor&&rects.has(s.id));
 for(const a of indoor)for(const b of indoor){
  if(a.id>=b.id||a.level!==b.level)continue;
  const longest=Math.max(0,...SIDES.flatMap(side=>sharedRuns(rects.get(a.id)!,side,[{id:b.id,rect:rects.get(b.id)!}]).map(r=>r.hi-r.lo)));
  if(longest>=need-1e-6)out.add(`${a.id}|${b.id}`);
 }
 return out;
}
const diagKeys=(plan:ArchitecturalPlan)=>new Set(diagnosePlan(plan).findings.filter(f=>f.severity==='error').map(f=>`diag:${f.stage}:${f.id}`));
export type Baseline={arrangement:Set<string>;diagnosis:Set<string>;compile:CompileOutcome;links:Set<string>;rects:Map<string,{x:number;z:number}>};
export function baselineOf(plan:ArchitecturalPlan):Baseline{
 const {rects}=resolveLayout(plan);
 return {arrangement:new Set([...arrangementKeys(plan)].map(k=>`arr:${k}`)),diagnosis:diagKeys(plan),compile:compileOutcome(plan),links:interiorLinks(plan),rects:new Map([...rects].map(([id,r])=>[id,{x:r.x,z:r.z}]))};
}
const phaseIndex=(stage:CompilePhase)=>COMPILE_PHASES.indexOf(stage);

/** Apply `edits` to a clone and classify the result. `targets` are keys (arr:…, diag:…) expected to disappear. */
export function verifyCorrection(plan:ArchitecturalPlan,edits:PlanEdit[],targets:string[],note:string,baseline:Baseline=baselineOf(plan)):Correction{
 const checks:CorrectionCheck[]=[];
 const base:Omit<Correction,'status'|'statusReason'|'checks'>={targets,edits,note,resolved:[],alsoResolved:[],newFindings:[],compilationBlockers:[],lostConnections:[],displaced:[],neverApplied:true};
 let edited:ArchitecturalPlan;
 try{edited=withEdits(plan,edits);if(!architecturalPlanSchema.safeParse(edited).success)throw Error('the edit produces a plan outside the contract');}
 catch(e){return {...base,status:'unverified',statusReason:`The edit could not be applied to a clone: ${String((e as Error).message??e)}.`,checks:[{name:'arrangement',ran:false,passed:null,detail:'not run'},{name:'diagnosis',ran:false,passed:null,detail:'not run'},{name:'compilation',ran:false,passed:null,detail:'not run'},{name:'interior-connections',ran:false,passed:null,detail:'not run'}]};}

 const arr=new Set([...arrangementKeys(edited)].map(k=>`arr:${k}`)),diag=diagKeys(edited),compile=compileOutcome(edited),links=interiorLinks(edited);
 const after=new Set([...arr,...diag]),before=new Set([...baseline.arrangement,...baseline.diagnosis]);
 const resolved=targets.filter(t=>!after.has(t)),unresolved=targets.filter(t=>after.has(t));
 // Findings new to the arrangement and the diagnosis. A removed site extent also removes its own overlaps, so only keys absent before count.
 const newFindings=[...after].filter(k=>!before.has(k));
 // Compilation: a key is new only when compilation reached the same phase as before (or an earlier one); problems that appear because
 // compilation now gets further than it could are "newly reached", not caused by the edit, and are reported as blockers.
 let compileNew:string[]=[],newlyReached=false;
 if(compile.ran&&!compile.ok){
  const baseStage=baseline.compile.ran&&!baseline.compile.ok?baseline.compile.stage:null,baseKeys=new Set(baseline.compile.ran&&!baseline.compile.ok?baseline.compile.keys:[]);
  newlyReached=baseStage!==null&&phaseIndex(compile.stage)>phaseIndex(baseStage)||baseline.compile.ran&&baseline.compile.ok;
  if(!newlyReached)compileNew=compile.keys.filter(k=>!baseKeys.has(k));
 }
 const lost=[...baseline.links].filter(l=>!links.has(l)).map(l=>l.replace('|',' ↔ '));
 const moved=[...resolveLayout(edited).rects].filter(([id,r])=>{const b=baseline.rects.get(id);return b&&(Math.abs(b.x-r.x)>1e-6||Math.abs(b.z-r.z)>1e-6);}).map(([id])=>id);
 const blockers=compile.ran&&!compile.ok?compile.messages:[];
 checks.push({name:'arrangement',ran:true,passed:![...arr].some(k=>!baseline.arrangement.has(k)),detail:`${arr.size} arrangement finding(s) after, ${[...arr].filter(k=>!baseline.arrangement.has(k)).length} new`});
 checks.push({name:'diagnosis',ran:true,passed:![...diag].some(k=>!baseline.diagnosis.has(k)),detail:`${diag.size} diagnostic error(s) after, ${[...diag].filter(k=>!baseline.diagnosis.has(k)).length} new`});
 checks.push(!compile.ran?{name:'compilation',ran:false,passed:null,detail:`could not run: ${compile.reason}`}
  :compile.ok?{name:'compilation',ran:true,passed:true,detail:'the edited plan compiles end to end'}
  :{name:'compilation',ran:true,passed:false,detail:`stops at the ${compile.stage} phase with ${compile.messages.length} problem(s); phases after it (${COMPILE_PHASES.slice(phaseIndex(compile.stage)+1).join(', ')||'none'}) were not reached`});
 checks.push({name:'interior-connections',ran:true,passed:lost.length===0,detail:lost.length?`gives up ${lost.length} interior adjacenc${lost.length>1?'ies':'y'}: ${lost.join(', ')}`:'no interior adjacency is lost'});
 const done={...base,resolved,alsoResolved:[...before].filter(k=>!after.has(k)&&!targets.includes(k)),newFindings:[...newFindings,...compileNew],compilationBlockers:blockers,lostConnections:lost,displaced:moved,checks};
 if(!compile.ran)return {...done,status:'unverified',statusReason:'Compilation could not be run on the edited plan, so downstream effects are unknown.'};
 if(done.newFindings.length)return {...done,status:'introduces-conflicts',statusReason:`The edit introduces ${done.newFindings.length} finding(s) that the plan did not have: ${done.newFindings.slice(0,4).join(', ')}${done.newFindings.length>4?', …':''}.`};
 if(unresolved.length)return {...done,status:'unverified',statusReason:`The edit does not clear ${unresolved.join(', ')}.`};
 if(!compile.ok)return {...done,status:'unverified',statusReason:newlyReached?`Nothing the earlier phases check is made worse and the target is cleared, but compilation now proceeds to the ${compile.stage} phase and stops there; those later checks had never run on this plan, so this edit's downstream effects are unverified.`:`The target is cleared and nothing new appears in the checks that ran, but the edited plan still does not compile for reasons this edit does not address (${compile.messages.length} problem(s)); downstream phases were not reached, so the edit is not verified.`};
 if(lost.length)return {...done,status:'decision-required',statusReason:`Every check passes and the plan compiles, but the edit gives up ${lost.length} interior adjacenc${lost.length>1?'ies':'y'} (${lost.join(', ')}): choosing it is an architectural trade-off.`};
 return {...done,status:'verified',statusReason:'Every check ran: the target is cleared, nothing new appears in arrangement or diagnosis, no interior adjacency is lost and the edited plan compiles end to end. It is still an offer; the author applies it.'};
}

export type CorrectionReview={
 /** Counts of what the plan has now. */
 baseline:{arrangementFindings:number;diagnosticErrors:number;compiles:boolean;compilationStage:CompilePhase|null};
 corrections:Correction[];
 byStatus:Record<CorrectionStatus,number>;
 /** Findings no single edit clears: genuine architectural decisions. */
 noOffer:string[];
};
const STATUS_ORDER:CorrectionStatus[]=['verified','decision-required','unverified','introduces-conflicts'];
/** Verify every candidate the coordinator offers, plus the determined site extent and the shared-wall form of misdirected openings. */
export function reviewCorrections(plan:ArchitecturalPlan,coordination:Coordination=coordinatePlan(plan),options:{siteBasis?:SiteBasis}={}):CorrectionReview{
 const baseline=baselineOf(plan),seen=new Set<string>(),out:Correction[]=[],asked:{targets:string[];edits:PlanEdit[];note:string}[]=[];
 const offer=(targets:string[],edits:PlanEdit[],note:string)=>{const tag=edits.map(e=>`${e.node}.${e.field}=${e.to}`).join('+');if(seen.has(tag))return;seen.add(tag);asked.push({targets,edits,note});};
 for(const c of coordination.constraints)for(const o of c.options)offer([`arr:constraint:${c.id}`],o.edits,o.note);
 for(const d of coordination.collisions)for(const o of d.options)offer([`arr:collision:${d.pair.join('/')}`],[{node:o.space,field:o.field,from:o.from,to:o.to}],o.note);
 for(const s of coordination.siteConflicts)for(const o of s.options)offer([`arr:site:overlap:${s.item}/${s.with}`],o.edits,o.note);
 const basis=options.siteBasis??coordination.site.basis;
 if(!coordination.site.fits&&basis==='model-defined'){
  const {required,available}=coordination.site;
  offer(['arr:site:fit'],[...(required.width>available.width?[{node:'site',field:'site-width' as const,from:available.width,to:Math.ceil(required.width)}]:[]),...(required.depth>available.depth?[{node:'site',field:'site-depth' as const,from:available.depth,to:Math.ceil(required.depth)}]:[])],`enlarge the model-defined site to its stated minimum (${required.width}×${required.depth} m, rounded up): a determined consequence of the arrangement`);
 }
 // An explicit-side opening whose rooms share no wall on that edge: the relationship may be declared as "shared", which finds the wall they do share.
 for(const f of diagnosePlan(plan).findings)if(f.stage==='openings'&&f.severity==='error'&&/share no wall on the \w+ edge/.test(f.message)){
  const p=plan.portals.find(x=>x.id===f.id);if(p&&p.host.side!=='shared'&&p.host.side!=='exposed'&&p.to!=='exterior')offer([`diag:openings:${f.id}`],[{node:f.id,field:'portal-side',from:p.host.side,to:'shared'}],`declare ${f.id} as a connection between ${p.host.space} and ${p.to} ("shared") so software finds the wall they share`);
 }
 for(const a of asked)out.push(verifyCorrection(plan,a.edits,a.targets,a.note,baseline));
 out.sort((x,y)=>STATUS_ORDER.indexOf(x.status)-STATUS_ORDER.indexOf(y.status)||x.displaced.length-y.displaced.length);
 const open=[...baseline.arrangement,...baseline.diagnosis].filter(k=>!out.some(c=>c.status!=='introduces-conflicts'&&(c.resolved.includes(k)||c.alsoResolved.includes(k))));
 const byStatus={verified:0,'decision-required':0,'introduces-conflicts':0,unverified:0} as Record<CorrectionStatus,number>;
 out.forEach(c=>byStatus[c.status]++);
 return {baseline:{arrangementFindings:baseline.arrangement.size,diagnosticErrors:baseline.diagnosis.size,compiles:baseline.compile.ran&&baseline.compile.ok,compilationStage:baseline.compile.ran&&!baseline.compile.ok?baseline.compile.stage:null},corrections:out,byStatus,noOffer:open};
}
export const describeCorrection=(c:Correction)=>`${c.edits.map(describeEdit).join(' + ')} → ${c.status}: ${c.statusReason}`;
