/** A rejected generation is evidence, not an empty error.
 *
 * When compilation refuses a model-authored plan, the plan is still the most valuable thing the request produced: a thesis, a composition, a
 * programme and a set of physical relationships that failed for stated reasons. This module turns the unmodified plan and the compiler's
 * rejection into one structured, size-bounded result for the requesting user:
 *   - the normalized plan exactly as authored (never repaired, never "fixed up" for display);
 *   - the design decisions it declares, the structured composition and the model's own limitations;
 *   - the compiler's rejection (every message it gave) and the phase where it stopped, and the phases that were therefore NOT reached;
 *   - independent diagnostic findings, the measured arrangement, whole-building coordination and verified-or-not correction offers;
 *   - a plan-level concept review (brief programme, daylight, repetition) and a labelled diagnostic drawing.
 * It is never a scene: `scene` is null and `completedHouse` is false. Nothing is persisted, no accepted construction is created and no existing
 * project is touched; storing or exporting it is the client's choice. Pure apart from rendering the drawing. */
import {architecturalPlanSchema,PlanRejection,COMPILE_PHASES,type ArchitecturalPlan,type CompilePhase} from './plan';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {diagnosePlan,type Finding} from './diagnose';
import {rootCauses,type RootCause} from './rootCauses';
import {coordinatePlan,type Coordination} from './spatial';
import {reviewCorrections,type CorrectionReview} from './corrections';
import {planConceptReview,type PlanConceptReview} from './concept';
import {renderPlanSvg} from './revision/planView';
import {analysePlan} from './revision/analysis';
import type {Rect} from './layout';

/** Bounds on what a failure response may carry. */
export const REJECTION_LIMITS={findings:300,drawingChars:400_000,totalChars:900_000,rawProviderChars:60_000} as const;
export type RejectionStage=CompilePhase|'provider-output';
export type RejectedGeneration={
 status:'rejected';
 /** A rejected plan is never a completed house. */
 completedHouse:false;
 scene:null;
 stage:RejectionStage;
 /** Compiler phases that never ran for this plan; nothing is claimed about them. */
 notReached:CompilePhase[];
 compilerRejection:{decisions:string[]};
 /** The plan exactly as the model authored it (schema-normalized, nothing repaired). */
 plan:ArchitecturalPlan|null;
 /** Set when the output could not be read as a plan. */
 unparsed?:{reason:string;rawText?:string;truncated:boolean};
 designDecisions:null|{
  thesis:string;orientation:number;arrival:string;levels:{id:string;above:string|null;rise:number}[];
  wings:{id:string;role:string;placement:ArchitecturalPlan['masses'][number]['placement']|null;rooms:number}[];
  composition:ArchitecturalPlan['composition']|null;roofForms:string[];
  site:ArchitecturalPlan['site'];siteBasis:'model-defined';constraints:NonNullable<ArchitecturalPlan['constraints']>;materials:ArchitecturalPlan['materials'];
 };
 limitations:string[];
 diagnostics:{findings:Finding[];errors:number;observations:number;truncated:boolean;metrics:Record<string,unknown>};
 /** The error findings grouped by the authored decision behind them: each cause once, every affected finding listed under it. */
 rootCauses:RootCause[];
 measured:{rects:Record<string,Rect>;siteRects:Record<string,Rect>}|null;
 coordination:Coordination|null;
 corrections:CorrectionReview|null;
 concept:PlanConceptReview|null;
 drawing:{svg:string;caption:string}|null;
 persisted:false;
 notes:string[];
};
const CAPTION='REJECTED PLAN — NOT A BUILDING. The model-authored plan as resolved by the production layout resolver; compilation refused it. Nothing here was repaired, simplified or accepted as construction.';
export function rejectedGeneration(input:{plan:unknown;error:unknown;brief:string;limitations?:string[]}):RejectedGeneration{
 const decisions=input.error instanceof DesignConflict?input.error.decisions:[String((input.error as Error)?.message??input.error)];
 const parsed=architecturalPlanSchema.safeParse(input.plan);
 const stage:CompilePhase=input.error instanceof PlanRejection?input.error.stage:parsed.success?'derive':'contract';
 const notReached=COMPILE_PHASES.slice(COMPILE_PHASES.indexOf(stage)+1) as CompilePhase[];
 const base={status:'rejected' as const,completedHouse:false as const,scene:null,stage,notReached,compilerRejection:{decisions},limitations:input.limitations??[],persisted:false as const};
 if(!parsed.success){
  return {...base,plan:null,unparsed:{reason:parsed.error.issues.slice(0,12).map(i=>`${i.path.join('.')||'plan'}: ${i.message}`).join('; '),truncated:false},designDecisions:null,
   diagnostics:{findings:[],errors:0,observations:0,truncated:false,metrics:{}},rootCauses:[],measured:null,coordination:null,corrections:null,concept:null,drawing:null,
   notes:['The output did not satisfy the architectural-plan-1 contract, so no plan could be measured. Nothing was repaired.']};
 }
 const plan=parsed.data,notes:string[]=[];
 const diag=diagnosePlan(plan),all=diag.findings;
 const findings=all.slice(0,REJECTION_LIMITS.findings);
 let coordination:Coordination|null=null,corrections:CorrectionReview|null=null,concept:PlanConceptReview|null=null,drawing:RejectedGeneration['drawing']=null;
 try{coordination=coordinatePlan(plan,{siteBasis:'model-defined'});}catch(e){notes.push(`Coordination could not be computed: ${String((e as Error).message??e)}`);}
 try{if(coordination)corrections=reviewCorrections(plan,coordination);}catch(e){notes.push(`Correction verification could not run: ${String((e as Error).message??e)}`);}
 try{concept=planConceptReview(input.brief,plan);}catch(e){notes.push(`Concept review could not run: ${String((e as Error).message??e)}`);}
 try{
  const svg=renderPlanSvg(plan,analysePlan(plan),{title:`REJECTED PLAN: ${plan.id}`,caption:CAPTION});
  if(svg.length<=REJECTION_LIMITS.drawingChars)drawing={svg,caption:CAPTION};else notes.push(`The diagnostic drawing (${svg.length} characters) exceeds the response limit and was omitted.`);
 }catch(e){notes.push(`The diagnostic drawing could not be rendered: ${String((e as Error).message??e)}`);}
 const result:RejectedGeneration={...base,plan,designDecisions:{
   thesis:plan.thesis,orientation:plan.orientation,arrival:plan.arrival,levels:plan.levels,
   wings:plan.masses.map(m=>({id:m.id,role:m.role,placement:m.placement??null,rooms:plan.spaces.filter(s=>s.mass===m.id).length})),
   composition:plan.composition??null,roofForms:[...new Set(plan.roofs.map(r=>r.form))],site:plan.site,siteBasis:'model-defined',constraints:plan.constraints??[],materials:plan.materials},
  diagnostics:{findings,errors:all.filter(f=>f.severity==='error').length,observations:all.filter(f=>f.severity==='observation').length,truncated:all.length>findings.length,metrics:diag.metrics as Record<string,unknown>},
  rootCauses:rootCauses(all,plan),
  measured:{rects:diag.rects as Record<string,Rect>,siteRects:diag.siteRects as Record<string,Rect>},coordination,corrections,concept,drawing,
  notes:[...notes,`Compilation stopped in the "${stage}" phase; ${notReached.length?`the later phase${notReached.length>1?'s':''} (${notReached.join(', ')}) never ran, so ${notReached.length>1?'their results are':'its result is'} unknown, not passed.`:'no later phase exists.'}`,'The plan is exactly as authored; correction offers are never applied.']};
 // Response-size bound: shed the largest optional parts first, in a stated order, and say so.
 const size=()=>JSON.stringify(result).length;
 if(size()>REJECTION_LIMITS.totalChars&&result.corrections){result.corrections={...result.corrections,corrections:result.corrections.corrections.slice(0,10)};result.notes.push('Correction offers were limited to the first ten to bound the response size.');}
 if(size()>REJECTION_LIMITS.totalChars&&result.coordination){result.coordination={...result.coordination,vertical:[],collisions:result.coordination.collisions.slice(0,10)};result.notes.push('Coordination detail was shortened to bound the response size.');}
 if(size()>REJECTION_LIMITS.totalChars&&result.drawing){result.drawing=null;result.notes.push('The drawing was omitted to bound the response size.');}
 return result;
}
/** The provider's output could not be read as a proposal at all: keep its text (bounded) so it is not lost. */
export function unparsedGeneration(input:{error:unknown;rawText?:string}):RejectedGeneration{
 const text=input.rawText??'',cut=text.length>REJECTION_LIMITS.rawProviderChars;
 return {status:'rejected',completedHouse:false,scene:null,stage:'provider-output',notReached:[...COMPILE_PHASES],compilerRejection:{decisions:[String((input.error as Error)?.message??input.error)]},plan:null,
  unparsed:{reason:String((input.error as Error)?.message??input.error),rawText:cut?text.slice(0,REJECTION_LIMITS.rawProviderChars):text,truncated:cut},designDecisions:null,limitations:[],
  diagnostics:{findings:[],errors:0,observations:0,truncated:false,metrics:{}},rootCauses:[],measured:null,coordination:null,corrections:null,concept:null,drawing:null,persisted:false,
  notes:['The provider output could not be read as an architectural-plan-1 proposal; its text is retained unchanged (bounded).']};
}
