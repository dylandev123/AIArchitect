/** Offline replay of the retained acceptance plan through the CURRENT normalization, diagnostics and compiler. No network, credentials, database or provider. Exclusive writes; source plan is read only. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalProposalSchema,compileArchitecturalPlan,deriveBuildingIntent} from '../src/lib/villa/canonical/plan';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import {coordinatePlan} from '../src/lib/villa/canonical/spatial';
const src='docs/architecture/canonical-acceptance-2026-11-02',dir='docs/architecture/canonical-final-compat-2026-11-02';
if(existsSync(dir))throw Error(`${dir} exists; refusing to overwrite`);
const bytes=readFileSync(`${src}/proposal.normalized.json`);
const proposal=canonicalProposalSchema.parse(JSON.parse(bytes.toString()));
if(proposal.status!=='proposed')throw Error('no plan');
const plan=proposal.plan;
const d=diagnosePlan(plan);
let coordination:unknown;try{coordination=coordinatePlan(plan);}catch(e){coordination={threw:String(e)};}
let compile:unknown;try{compileArchitecturalPlan(plan);compile={success:true};}catch(e){compile={success:false,error:String(e),decisions:(e as {decisions?:unknown}).decisions??null};}
let intent:unknown;try{deriveBuildingIntent(plan);intent={ok:true};}catch(e){intent={ok:false,decisions:(e as {decisions?:unknown}).decisions??String(e)};}
const errors=d.findings.filter(f=>f.severity==='error');
mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}/replay.json`,JSON.stringify({readOnly:true,providerCalls:0,sourcePlanSha256:createHash('sha256').update(bytes).digest('hex'),errorCount:errors.length,errors,compile,deriveIntent:intent,coordination},null,2),{flag:'wx'});
console.log(JSON.stringify({errors:errors.map(e=>`${e.stage}:${e.id}: ${e.message??''}`.slice(0,260)),compile,intent},null,1));
