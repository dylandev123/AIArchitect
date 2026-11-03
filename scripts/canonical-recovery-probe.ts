/** Offline recovery probe on a COPY of the retained final plan. No network, credentials, database, provider or scene rendering.
 * The source plan is read only (hash verified before and after). Every candidate edit is applied to a fresh clone and
 * judged by the existing diagnostics, whole-building coordinator and real compiler; nothing is chosen on the plan's behalf here. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalProposalSchema,compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import {coordinatePlan} from '../src/lib/villa/canonical/spatial';
const src='docs/architecture/canonical-final-2026-11-02/proposal.normalized.json',dir='docs/architecture/canonical-recovery-2026-11-03';
const sha=()=>createHash('sha256').update(readFileSync(src)).digest('hex');
const before=sha();
const proposal=canonicalProposalSchema.parse(JSON.parse(readFileSync(src,'utf8')));
if(proposal.status!=='proposed')throw Error('no plan');
const original=proposal.plan as any;
type Edit={what:string;apply:(p:any)=>void};
const space=(p:any,id:string)=>p.spaces.find((s:any)=>s.id===id);
const site=(p:any,id:string)=>[...p.pools,...p.landscape].find((s:any)=>s.id===id);
const set=(id:string,k:string,v:unknown):Edit=>({what:`${id}.${k} → ${JSON.stringify(v)}`,apply:p=>{(space(p,id)).placement&&k.startsWith('placement.')?space(p,id).placement[k.slice(10)]=v:space(p,id)[k]=v;}});
const setSite=(id:string,k:string,v:unknown):Edit=>({what:`${id}.${k} → ${JSON.stringify(v)}`,apply:p=>{const s=site(p,id);k.startsWith('placement.')?s.placement[k.slice(10)]=v:s[k]=v;}});
const evaluate=(edits:Edit[])=>{
 const p=structuredClone(original);edits.forEach(e=>e.apply(p));
 const d=diagnosePlan(p),errs=d.findings.filter(f=>f.severity==='error');
 let compile:string='compiles';try{compileArchitecturalPlan(p);}catch(e){compile=String((e as Error).message??e).split('\n').map(s=>s.slice(0,230)).join(' | ');}
 let coord:string[]=[];try{coord=coordinatePlan(p).errors.map(e=>`${e.kind}:${e.ids.join('/')}`);}catch(e){coord=['threw'];}
 return {edits:edits.map(e=>e.what),diagnosticErrors:errs.map(f=>`${f.stage}:${f.id}`),compile,coordinatorErrors:coord};
};
const baseline=evaluate([]);
const candidates:Record<string,Edit[][]>={
 'salon-gallery overlap':[
  [set('powder-room','placement.gap',.5)],[set('powder-room','placement.gap',6)],[set('living-salon','placement.gap',6)],
  [set('living-salon','placement.alignment','start')],[set('living-salon','width',17)],[set('west-gallery','placement.alignment','start')]],
 'dining → deck: no shared wall':[[set('dining-gallery','placement.alignment','start')],[set('dining-gallery','depth',12)]],
 'pantry → east wing: no shared wall':[
  [{what:'pantry-east-cloister host pantry → service-yard',apply:p=>{p.portals.find((x:any)=>x.id==='pantry-east-cloister').host.space='service-yard';}}]],
 'waterfront lawn 0.5 m outside':[[{what:'site.depth 80 → 81',apply:p=>{p.site.depth=81;}}],[setSite('waterfront-lawn','depth',13.5)],[setSite('waterfront-lawn','placement.gap',1.5)]],
 'arrival-bed overlaps wing':[
  [{what:'remove arrival-bed',apply:p=>{p.landscape=p.landscape.filter((x:any)=>x.id!=='arrival-bed');}}],
  [setSite('arrival-bed','placement.side','north')]],
 'east-garden-reserve overlaps wing':[[setSite('east-garden-reserve','width',10)]],
 'arrival screen':[
  [{what:'remove arrival-bronze-screen',apply:p=>{p.screens=p.screens.filter((x:any)=>x.id!=='arrival-bronze-screen');}}],
  [{what:'arrival-bronze-screen side north → east',apply:p=>{p.screens.find((x:any)=>x.id==='arrival-bronze-screen').side='east';}}]],
};
const results:Record<string,unknown>={};
for(const [k,v] of Object.entries(candidates))results[k]=v.map(evaluate);
// Mechanical tier only: enlarge the site by the measured shortfall.
const mechanical=evaluate([{what:'site.depth 80 → 81',apply:p=>{p.site.depth=81;}}]);
if(sha()!==before)throw Error('source mutated');
if(existsSync(`${dir}/probe.json`))throw Error('exists');
mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}/probe.json`,JSON.stringify({readOnly:true,providerCalls:0,sourceSha256:before,baseline,mechanicalOnly:mechanical,candidates:results},null,1),{flag:'wx'});
const brief=(r:any)=>`${r.edits.join(' & ')}\n    diag[${r.diagnosticErrors.length}]: ${r.diagnosticErrors.join(', ')}\n    compile: ${r.compile.slice(0,160)}`;
console.log('BASELINE',brief(baseline));console.log('MECHANICAL',brief(mechanical));
for(const [k,v] of Object.entries(results)){console.log('\n##',k);(v as any[]).forEach(r=>console.log('  -',brief(r)));}
