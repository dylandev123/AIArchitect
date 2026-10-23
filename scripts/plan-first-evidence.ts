/** No provider. Explicit offline plan is saved before exterior data is loaded or massing compiled. */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { prepareV3ArchitecturalPlan, constructV3PlanMassing, elaborateV3ArchitecturalPlan, inspectV3ArchitecturalPlan, sameArchitecturalPlan, type V3PlanFirstDesign } from '../src/lib/v3/architecturalPlanFirst';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprint';
import { generateV3FromArchitecturalBlueprint, v3ArchitecturalBlueprintPrompt } from '../src/lib/v3/architecturalBlueprintGeneration';
import { editArchitecturalBuildingFootprint } from '../src/lib/v3/architecturalPlanEdits';
import { compileV3Scene, type V3Scene } from '../src/lib/v3/scene';
import { auditArchitecturalConstructionFidelity } from '../src/lib/v3/architecturalConstructionFidelity';

globalThis.fetch=async()=>{throw Error('Network forbidden in plan-first proof');};
const out='docs/architecture/architectural-blueprint-pipeline/plan-first';mkdirSync(out,{recursive:true});
const sequence:string[]=[];
const save=(name:string,scene:V3Scene)=>{
  const root={version:3,generationMode:'v3-scene',v3Scene:scene};
  writeFileSync(`${out}/${name}.json`,JSON.stringify(root,null,2)+'\n');sequence.push(name);
};
const planSource='src/lib/v3/__tests__/fixtures/plan-first-estate.plan.json';
const exteriorSource='src/lib/v3/__tests__/fixtures/plan-first-estate.exterior.json';
const stage=prepareV3ArchitecturalPlan(JSON.parse(readFileSync(planSource,'utf8')));
assert(stage.ok,JSON.stringify(stage.findings));save('01-plan',stage.scene!);
const reloaded=JSON.parse(readFileSync(`${out}/01-plan.json`,'utf8')).v3Scene;
assert.deepEqual(inspectV3ArchitecturalPlan(reloaded),inspectV3ArchitecturalPlan(stage.scene!));
const massing=constructV3PlanMassing(stage)!;save('02-massing',massing.scene);
// Exterior intent is not even read until the plan has been saved and massing built.
const exterior=JSON.parse(readFileSync(exteriorSource,'utf8'));
const elaborated=elaborateV3ArchitecturalPlan(stage,exterior);assert(elaborated.blueprint,JSON.stringify(elaborated.findings));
const approved=planV3ArchitecturalBlueprint(elaborated.blueprint,{buildFirst:true});assert(approved.approval,JSON.stringify(approved.findings));
const finished=constructV3ArchitecturalBlueprint(approved.approval);assert(finished.ok,JSON.stringify(finished.findings));
assert(sameArchitecturalPlan(stage.scene!,finished.scene!));
// Also exercise the actual production generation orchestrator with ONE mocked response.
const design:V3PlanFirstDesign={format:'v3-plan-first-1',plan:stage.plan!,exterior};
const emitted:string[]=[];
const generated=await generateV3FromArchitecturalBlueprint('A garden residence',async()=>({output:design,finishReason:'stop'}),{requirePlanFirst:true,onStage:s=>{emitted.push(s.stage);}});
assert(generated.ok,JSON.stringify(generated.findings));assert.deepEqual(emitted,['plan','massing','exterior']);
save('03-finished',generated.scene!);
assert(sameArchitecturalPlan(stage.scene!,generated.scene!));
const changed=editArchitecturalBuildingFootprint(generated.scene!,'orchard-atelier',{kind:'rectangle',width:13,depth:10});
assert(changed.ok,JSON.stringify(changed.errors));save('04-edited',changed.scene);
const loaded=JSON.parse(JSON.stringify(changed.scene));assert.deepEqual(inspectV3ArchitecturalPlan(loaded),inspectV3ArchitecturalPlan(changed.scene));
assert.deepEqual(compileV3Scene(loaded),compileV3Scene(changed.scene));
assert.equal(loaded.objects.find((o:{id:string})=>o.id==='atelier-roof').architecture.width,13);
const finalModel=compileV3Scene(generated.scene!),receipts=auditArchitecturalConstructionFidelity(generated.scene!,finalModel);assert.deepEqual(receipts,[]);
const traces=inspectV3ArchitecturalPlan(stage.scene!).buildings.map(b=>{
 const roof=generated.scene!.objects.find(o=>o.type==='roof-form'&&o.hostId===b.id)!;
 return {planId:b.id,exactFootprint:b.footprint??{kind:'rectangle',width:b.architecture!.width,depth:b.architecture!.depth},polygons:b.polygons,
   massingPartIds:massing.model.primitives.filter(p=>p.sourceObjectId===b.id).map(p=>p.id),
   finishedWallIds:finalModel.primitives.filter(p=>p.sourceObjectId===b.id&&['wall','building','curvedWall'].includes(p.category)).map(p=>p.id),
   roofId:roof.id,roofHostId:roof.hostId,roofParts:finalModel.primitives.filter(p=>p.sourceObjectId===roof.id).map(p=>p.id)};
});
const checks={providerCalls:0,sequence,productionSequence:emitted,source:{plan:planSource,exterior:exteriorSource,provenance:'Explicit offline Lantern Garden capability example, adapted into separate planning and exterior documents. Not a natural Terra output or a production template.'},
 planSavedBeforeMassing:true,exteriorLoadedAfterMassing:true,exactPlanPreserved:true,constructionReceipts:receipts,footprintEditUpdatesHostedRoof:true,saveReloadPreservesAuthority:true,
 massingPrimitives:massing.model.primitives.length,finishedPrimitives:finalModel.primitives.length,promptCharacters:v3ArchitecturalBlueprintPrompt().length,
 outputCharacters:JSON.stringify(design).length,traces,
 originals:['2026-10-20','2026-10-21'].map(date=>({date,sha256:createHash('sha256').update(readFileSync(`src/lib/v3/__tests__/fixtures/architectural-blueprint-live-${date}.json`)).digest('hex')}))};
writeFileSync(`${out}/proof.json`,JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({sequence,productionSequence:emitted,primitives:checks.finishedPrimitives,providerCalls:0}));
