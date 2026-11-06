/** Offline, read-only measurement of roof and facade exposure coordination. No model calls. Reads the retained production plan (never writes it) and
 * three developer-authored fixtures; writes evidence into docs/architecture/roof-facade-exposure-2026-11-03/. Run:
 *   npx vite-node --config vitest.config.mts scripts/roof-facade-exposure-offline.ts */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {architecturalPlanSchema,compileArchitecturalPlan,PlanRejection,type ArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import {validateScene} from '../src/lib/villa/scene/model';
import {exposureFixture,exposureFixtures} from '../src/lib/villa/canonical/roofExposure.fixture';
const out='docs/architecture/roof-facade-exposure-2026-11-03';
const file='docs/architecture/production-rejected-2026-11-03/caribbean-beach-estate-01.rejected.json';
const raw=readFileSync(file),sha=createHash('sha256').update(raw).digest('hex');
const exported=JSON.parse(raw.toString());
const plan=architecturalPlanSchema.parse(exported.plan);
const stage=(p:ArchitecturalPlan)=>{try{compileArchitecturalPlan(p);return {compiles:true as const};}catch(e){return e instanceof PlanRejection?{compiles:false as const,stage:e.stage,decisions:e.decisions.length}:{compiles:false as const,stage:'?',decisions:0};}};
const classify=(p:ArchitecturalPlan)=>{
 const f=diagnosePlan(p).findings,err=f.filter(x=>x.severity==='error');
 const roofErr=err.filter(x=>x.stage==='roofs'&&/roof bounds intersect|projects/.test(x.message));
 const partial=roofErr.filter(x=>/stands against only part of that/.test(x.message)),touchless=roofErr.filter(x=>/does not stand against that wall/.test(x.message)&&!/stands against only part of that/.test(x.message)),corner=roofErr.filter(x=>/corner/.test(x.message)&&!/stands against only part of that/.test(x.message));
 const facade=err.filter(x=>x.cause?.startsWith('facade:'));
 return {errors:err.length,roofReach:roofErr.length,roofReachPartialEdge:partial.length,roofReachGap:touchless.length,roofReachCorner:corner.length,
  flushEdges:f.filter(x=>x.stage==='roofs'&&x.severity==='observation').length,facadeFindings:facade.length,facadeRhythms:new Set(facade.map(x=>x.cause)).size,other:err.length-roofErr.length-facade.length};
};
// The exact retained production plan, untouched, plus the single in-memory probe that removes only its ownership conflict (the veranda is listed by a span
// that gives it a different roof); that is Terra's decision, so the probe is not a design, only a way to measure what the roof and facade rules do alone.
const probe=structuredClone(plan);probe.composition!.roofSpans[0].spaces=['great-hall'];
const noOverhang=structuredClone(probe);noOverhang.roofs.forEach(r=>{r.overhang=0;});noOverhang.composition!.roofSpans.forEach(s=>{s.overhang=0;});
const production={sha256:sha,
 asAuthored:{...classify(plan),...stage(plan)},
 ownershipConflictRemovedInMemory:{...classify(probe),...stage(probe)},
 ownershipConflictRemovedAndAllOverhangsZero:{...classify(noOverhang),...stage(noOverhang)},
 before:{note:'docs/architecture/production-rejected-2026-11-03/REPORT.md (previous analysis, same plan)',roofFindings:40,facadeFindings:17,errors:69}};
const fixtures=Object.fromEntries(exposureFixtures.map(name=>{
 const p=exposureFixture(name),d=diagnosePlan(p),c=compileArchitecturalPlan(p),scene=validateScene(JSON.parse(JSON.stringify(c.scene)));
 const saved=JSON.stringify(scene)===JSON.stringify(c.scene)&&JSON.stringify(compileArchitecturalPlan(scene.architecturalPlan as ArchitecturalPlan).scene.elements)===JSON.stringify(c.scene.elements);
 writeFileSync(`${out}/${name}.scene.json`,JSON.stringify(c.scene,null,1));
 return [name,{errors:d.findings.filter(f=>f.severity==='error').length,flushEdges:c.roofEaves.trims.map(t=>({roof:t.roof,side:t.side,authored:t.authored,against:t.against,edge:t.edge})),
  roofs:c.scene.elements.filter(e=>e.kind==='roof').map(e=>({id:e.id,form:e.roofForm??'flat',overhang:e.overhang??null,eaves:e.eaves??null,size:e.size.map(v=>+v.toFixed(3))})),
  elements:c.scene.elements.length,saveReloadRecompileIdentical:saved,provenanceComplete:Object.keys(c.provenance).length===c.scene.elements.length}];
}));
writeFileSync(`${out}/measurements.json`,JSON.stringify({label:'OFFLINE MEASUREMENT — no model calls; production plan never modified',production,fixtures},null,1));
console.log(JSON.stringify({production,fixtures:Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,{errors:v.errors,flush:v.flushEdges.length,roofs:v.roofs.length,saved:v.saveReloadRecompileIdentical}]))},null,1));
