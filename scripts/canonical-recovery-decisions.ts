/** Compile-only sensitivity check: applies ONE explicit choice per remaining blocker (labelled as a decision, not a recovery) to copies of the retained plan.
 * Answers only "is anything hiding behind the known errors?". No scene is rendered or kept. Offline, read only. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {canonicalProposalSchema,compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
const dir='docs/architecture/canonical-recovery-2026-11-03';
const original=(canonicalProposalSchema.parse(JSON.parse(readFileSync('docs/architecture/canonical-final-2026-11-02/proposal.normalized.json','utf8'))) as any).plan;
const sp=(p:any,id:string)=>p.spaces.find((s:any)=>s.id===id);
const common=(p:any)=>{
 p.site.depth=81;                                                                             // MECHANICAL
 sp(p,'dining-gallery').placement.alignment='start';                                          // DECISION D
 p.portals.find((x:any)=>x.id==='pantry-east-cloister').host.space='service-yard';          // DECISION P (route east wing through service yard)
 p.landscape=p.landscape.filter((x:any)=>x.id!=='arrival-bed');                              // DECISION B
 p.landscape.find((x:any)=>x.id==='east-garden-reserve').width=10;                           // DECISION R
 p.screens=p.screens.filter((x:any)=>x.id!=='arrival-bronze-screen');                        // DECISION S
};
const variants:Record<string,(p:any)=>void>={
 'G4 living-salon.alignment centre→start':p=>{sp(p,'living-salon').placement.alignment='start';},
 'G5 living-salon.width 18→17':p=>{sp(p,'living-salon').width=17;},
 'G6 west-gallery.alignment centre→start':p=>{sp(p,'west-gallery').placement.alignment='start';},
};
const out:Record<string,unknown>={};
for(const [name,f] of Object.entries(variants)){
 const p=structuredClone(original);common(p);f(p);
 const d=diagnosePlan(p).findings.filter(x=>x.severity==='error').map(x=>`${x.stage}:${x.id}: ${x.message}`);
 let compile='compiles';try{compileArchitecturalPlan(p);}catch(e){compile=String((e as Error).message??e);}
 out[name]={diagnosticErrors:d,compile};console.log('##',name,'\n diag:',d,'\n compile:',compile.slice(0,600));
}
if(!existsSync(`${dir}/decisions-compile-only.json`))writeFileSync(`${dir}/decisions-compile-only.json`,JSON.stringify({note:'compile-only sensitivity; decisions are NOT Terra output and NOT automatic recovery; nothing rendered',variants:out},null,1),{flag:'wx'});
