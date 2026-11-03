/** Offline build of the evidence for the consolidated corrections: compiles the developer fixtures with the real compiler, writes their scenes
 * (for browser comparison), the before/after drawings and the retained-failure analyses. No model call, no database, no network. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {terracedPavilion,partialWallHouse,retainedMansion,retainedBrief,retainedLimitations} from '../src/lib/villa/canonical/consolidated.fixture';
import {renderPlanSvg} from '../src/lib/villa/canonical/revision/planView';
import {analysePlan} from '../src/lib/villa/canonical/revision/analysis';
import {rejectedGeneration} from '../src/lib/villa/canonical/rejection';
import {coordinatePlan} from '../src/lib/villa/canonical/spatial';
import {reviewCorrections} from '../src/lib/villa/canonical/corrections';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
const dir='docs/architecture/consolidated-corrections-2026-11-03';
mkdirSync(dir,{recursive:true});
const w=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,typeof v==='string'?v:JSON.stringify(v,null,1));
// Fixtures: before = compile rejected (no building exists), after = the compiled editable house.
const before=terracedPavilion(false),after=terracedPavilion(true);
let beforeError:unknown;try{compileArchitecturalPlan(before);}catch(e){beforeError=e;}
w('terraced-before.rejected.svg',renderPlanSvg(before,analysePlan(before),{title:'BEFORE: terraced-pavilion (developer fixture) — REJECTED',caption:'REJECTED PLAN — NOT A BUILDING. The suite wing is placed against the pavilion extent that includes the wider terrace, so it stands 3 m from the salon.'}));
w('terraced-after.plan.svg',renderPlanSvg(after,analysePlan(after),{title:'AFTER: terraced-pavilion with terrace declared attached (developer fixture)',caption:'DEVELOPER-AUTHORED FIXTURE — plan of the arrangement that compiles. Not Terra output.'}));
w('terraced-attached.scene.json',compileArchitecturalPlan(after).scene);
const partial=partialWallHouse(),compiled=compileArchitecturalPlan(partial);
w('partial-wall.scene.json',compiled.scene);
w('partial-wall.plan.svg',renderPlanSvg(partial,analysePlan(partial),{title:'partial-wall-house (developer fixture)',caption:'DEVELOPER-AUTHORED FIXTURE — explicit-side door fitted into the shared wall. Not Terra output.'}));
w('terraced.rejection-summary.json',{stage:(beforeError as {stage?:string}).stage,decisions:(beforeError as {decisions:string[]}).decisions,corrections:reviewCorrections(before).corrections.map(c=>({edits:c.edits,status:c.status,reason:c.statusReason}))});
// The retained failed mansion, unmodified: rejected-plan result, coordination and correction review.
const mansion=retainedMansion();let mansionError:unknown;try{compileArchitecturalPlan(mansion);}catch(e){mansionError=e;}
const rejected=rejectedGeneration({plan:mansion,error:mansionError,brief:retainedBrief(),limitations:retainedLimitations()});
const {drawing,...rest}=rejected;
w('retained-mansion.rejected-generation.json',rest);
if(drawing)w('retained-mansion.rejected-plan.svg',drawing.svg);
w('retained-mansion.diagnosis.json',{errors:diagnosePlan(mansion).findings.filter(f=>f.severity==='error'),observations:diagnosePlan(mansion).findings.filter(f=>f.severity==='observation'),site:coordinatePlan(mansion).site});
console.log(JSON.stringify({terracedBeforeStage:(beforeError as {stage?:string}).stage,partialRefit:compiled.intent.portals.find(p=>p.id==='hall-wing-door')?.offset,retainedStage:rejected.stage,byStatus:rejected.corrections?.byStatus}));
