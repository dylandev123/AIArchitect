/** Offline audit of the retained saved-project export. No provider or browser writes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { checkoutPlanEvaluation, preparePlanEvaluation } from '../src/lib/v3/architecturalPlanEvaluation';
import { elaborateV3ArchitecturalPlan, planConstructionBlockers, sameArchitecturalPlan, splitV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalPlanFirst';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprint';
import { planningStudioBlueprint } from '../src/lib/v3/parity/planningStudio';
import { compileV3Scene, type V3Scene } from '../src/lib/v3/scene';

const path='.v3-debug/paid-plan-handoff/final.json';
const retained=readFileSync(path,'utf8');
const saved=JSON.parse(retained).working as {id:string;houseConfigJson:string};
assert.equal(saved.id,'66268256-7784-4d7d-8d44-002b6f5303d1');
const scene=JSON.parse(saved.houseConfigJson).v3Scene as V3Scene;
const stage=checkoutPlanEvaluation(scene);
assert(stage.ok&&stage.scene&&stage.plan);
assert(sameArchitecturalPlan(scene,stage.scene));
assert.deepEqual(stage.unresolved,[]);
assert.equal(scene.interior!.rooms.length,19);
assert.equal(stage.plan.buildings.find(b=>b.id==='guest-pavilion')!.plan.kind,'rectangle');
const blockers=planConstructionBlockers(stage);
assert.deepEqual(blockers.map(f=>f.code),['BLUEPRINT_SITE_BOUNDS','BLUEPRINT_ENTRANCE_WALL']);
assert.equal(stage.plan.features.filter(f=>f.height===undefined).length,7);

// An independently authored mock exterior proves machinery, not live Terra quality
// or a successful build of the paid estate with its fixed-plan conflicts.
const bp=planningStudioBlueprint(),mock=splitV3ArchitecturalBlueprint(bp);
for(const f of mock.plan.features)delete f.height;
mock.exterior.features.forEach(f=>{f.height=bp.features.find(p=>p.id===f.id)!.height;});
const mockStage=preparePlanEvaluation(mock.plan);
assert.deepEqual(planConstructionBlockers(mockStage),[]);
const developed=elaborateV3ArchitecturalPlan(mockStage,mock.exterior);
assert(developed.blueprint,JSON.stringify(developed.findings));
const planned=planV3ArchitecturalBlueprint(developed.blueprint,{buildFirst:true});
assert(planned.approval,JSON.stringify(planned.findings));
const built=constructV3ArchitecturalBlueprint(planned.approval);
assert(built.ok&&built.scene,JSON.stringify(built.findings));
assert(sameArchitecturalPlan(mockStage.scene!,built.scene));
assert.equal(readFileSync(path,'utf8'),retained);
const report={
  verification:'offline-only',projectId:saved.id,
  retainedExportSha256:createHash('sha256').update(retained).digest('hex'),
  sourceResponseSha256:scene.metadata.planResponseSha256,
  savedPlan:{buildings:stage.plan.buildings.map(b=>({id:b.id,location:b.location,plan:b.plan})),rooms:scene.interior!.rooms.length,features:stage.plan.features.length,routes:stage.plan.connections.map(c=>c.id),unresolved:stage.unresolved,missingFeatureHeightsDelegatedToTerra:7,blockers,planUnchanged:true},
  mockBuild:{outcome:built.outcome,planPreserved:true,authoredFeatureHeights:mock.exterior.features.map(f=>({id:f.id,height:f.height})),primitives:compileV3Scene(built.scene).primitives.length},
  liveProviderCalls:0,credentialsChanged:false,browserProjectWrites:false,
  limitation:'The saved paid estate is still blocked by its site-boundary overrun and entrance wall address. Mock exterior success establishes construction and plan fidelity, not live design quality or completion of that estate.',
};
const output='docs/architecture/architectural-blueprint-pipeline/SAVED_PLAN_EXTERIOR_HANDOFF_CHECKS.json';
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({projectId:saved.id,blockers:blockers.map(f=>f.code),mockOutcome:built.outcome,liveProviderCalls:0,evidence:output}));
