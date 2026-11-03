/** Read-only probe: what would the ONE verified correction offer actually do? Applied to a clone; the retained plan is untouched (hash checked).
 *  Evidence only: nothing here is rendered, saved as a plan, or presented as Terra's design. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileArchitecturalPlan,type ArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {resolveLayout} from '../src/lib/villa/canonical/layout';
import {SIDES,sharedRuns} from '../src/lib/villa/canonical/coordination';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
const dir=process.argv[2],src=`${dir}/canonical-plan.json`,sha=()=>createHash('sha256').update(readFileSync(src)).digest('hex'),before=sha();
const original=(JSON.parse(readFileSync(src,'utf8')) as {plan:ArchitecturalPlan}).plan;
const contacts=(plan:ArchitecturalPlan,wing:string)=>{
 const {rects}=resolveLayout(plan),mine=plan.spaces.filter(s=>s.mass===wing),others=plan.spaces.filter(s=>s.mass!==wing&&rects.has(s.id));
 return mine.flatMap(m=>SIDES.flatMap(side=>sharedRuns(rects.get(m.id)!,side,others.map(o=>({id:o.id,rect:rects.get(o.id)!}))).map(r=>({from:m.id,side,to:r.id,toIsOutdoor:!!plan.spaces.find(s=>s.id===r.id)?.outdoor,lengthM:Number((r.hi-r.lo).toFixed(2))}))));
};
const run=(label:string,edit:(p:ArchitecturalPlan)=>void)=>{
 const p=structuredClone(original);edit(p);
 let compile='compiles';try{compileArchitecturalPlan(p);}catch(e){compile=String((e as any).decisions?.join(' | ')??(e as Error).message).slice(0,600);}
 return {label,wallContactsOfWestWing:contacts(p,'west-suite-wing'),compile,diagnosticErrors:diagnosePlan(p).findings.filter(f=>f.severity==='error'&&!(f.stage==='roofs'&&/neither a roof nor a space above/.test(f.message))).map(f=>`${f.stage}:${f.id}`)};
};
const result={readOnly:true,providerCalls:0,sourceSha256:before,note:'Probe of the single offer produced by the existing coordinator. Not applied to the retained plan; not an accepted design.',
 baseline:run('as authored',()=>{}),
 offered:run('west-suite-wing.alignment centre→end (the coordinator\'s only offer)',p=>{p.masses.find(m=>m.id==='west-suite-wing')!.placement!.alignment='end';})};
if(sha()!==before)throw Error('source mutated');
writeFileSync(`${dir}/option-probe.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,1).slice(0,3500));
