/** Offline production geometry evidence. Writes ONLY new Phase 2B artifacts. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ArchitecturalFloorPlan} from '../src/components/workspace/viewport/ArchitecturalFloorPlan';
import {roomPlanningExamples,relationshipGardenHome,roomPlanningExterior} from '../src/lib/v3/parity/roomPlanning';
import {preparePlanEvaluation,checkoutPlanEvaluation,planEvaluationPrompt} from '../src/lib/v3/architecturalPlanEvaluation';
import {planConstructionBlockers,elaborateV3ArchitecturalPlan,sameArchitecturalPlan} from '../src/lib/v3/architecturalPlanFirst';
import {planV3ArchitecturalBlueprint,constructV3ArchitecturalBlueprint} from '../src/lib/v3/architecturalBlueprint';
import {auditArchitecturalConstructionFidelity} from '../src/lib/v3/architecturalConstructionFidelity';
import {auditV3Interior} from '../src/lib/v3/interior';
import {proposeRoomCoordination} from '../src/lib/v3/roomCoordination';
import type {V3Scene} from '../src/lib/v3/scene';
globalThis.fetch=async()=>{throw Error('External transport forbidden in Phase 2B evidence');};
const out='docs/architecture/architectural-blueprint-pipeline/phase-2b';mkdirSync(out,{recursive:true});
const write=(name:string,value:unknown)=>writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2)+'\n');
const warnings=(scene:V3Scene)=>auditV3Interior(scene).filter(f=>['ROOM_OUTSIDE_HOST','ROOM_OVERLAP','ROOM_ADJACENCY_NO_SHARED_BOUNDARY'].includes(f.code));
function draw(scene:V3Scene,name:string,floor:number|null,buildingId:string|null){
 const markup=renderToStaticMarkup(createElement(ArchitecturalFloorPlan,{scene,model:null,floor,buildingId,readOnly:true}));
 const svg=markup.match(/<svg[\s\S]*?<\/svg>/)?.[0];assert(svg);writeFileSync(`${out}/${name}.svg`,svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000" ')+'\n');
}
const rawText=readFileSync('src/lib/v3/__tests__/fixtures/terra-estate-2026-10-22.response.json','utf8');
const original=preparePlanEvaluation(JSON.parse(rawText));assert(original.ok&&original.plan&&original.scene);
const sourceHash=createHash('sha256').update(rawText).digest('hex');assert.equal(sourceHash,'65036c5f32b6c9b8be56fc6c57886715bb9bd469b2480fe938199f4427eb88ad');
const proposal=proposeRoomCoordination(original.plan),coordinated=preparePlanEvaluation(proposal.plan);assert(coordinated.ok&&coordinated.scene);
assert.equal(warnings(original.scene).length,17);assert.equal(warnings(coordinated.scene).length,9);
assert.deepEqual(proposal.plan.buildings.map(b=>b.plan),original.plan.buildings.map(b=>b.plan));
assert.deepEqual(proposal.plan.roomAdjacencies,original.plan.roomAdjacencies);
write('natural-original.saved',{version:3,generationMode:'v3-scene',v3Scene:original.scene});write('natural-proposal.saved',{version:3,generationMode:'v3-scene',v3Scene:coordinated.scene});
write('natural-proposal.plan',proposal.plan);
for(const building of ['main-villa','wellness-pavilion'])for(const [name,scene] of [['before',original.scene],['proposal',coordinated.scene]] as const)for(const floor of building==='main-villa'?[0,1]:[0])draw(scene,`natural-${building}-${floor}-${name}`,floor,building);
write('natural-comparison',{sourceHash,sourcePreserved:true,proposalAppliedToExistingProject:false,requiresReview:true,
 before:warnings(original.scene),after:warnings(coordinated.scene),changes:proposal.changes,unresolved:proposal.diagnostics,
 unchangedBuildingGeometry:true,unchangedAdjacencyIntent:true,unchangedStairReservation:true,
 limitation:'The upper floor is retained unchanged because its diagonal gallery/bedroom contact is ambiguous. This is a separate review candidate, never a load-time repair or a revised paid response.'});
const examples=roomPlanningExamples().map(({name,make})=>{
 const raw=make(),stage=preparePlanEvaluation(raw);assert(stage.ok&&stage.scene&&stage.plan);assert.deepEqual(planConstructionBlockers(stage),[]);assert.deepEqual(warnings(stage.scene),[]);
 assert.deepEqual(stage.plan.buildings.map(b=>({plan:b.plan,x:b.location.x,z:b.location.z,storeys:b.storeys.length})),raw.buildings.map(b=>({plan:b.plan,x:b.location.x,z:b.location.z,storeys:b.storeys.length})));
 assert.deepEqual(stage.plan.roomAdjacencies,raw.roomAdjacencies);
 write(`${name}.authoring`,raw);write(`${name}.saved`,{version:3,generationMode:'v3-scene',v3Scene:stage.scene});
 const loaded=JSON.parse(readFileSync(`${out}/${name}.saved.json`,'utf8')).v3Scene as V3Scene;
 const reloaded=checkoutPlanEvaluation(loaded);assert(reloaded.ok);assert(sameArchitecturalPlan(stage.scene,loaded));
 const exterior=elaborateV3ArchitecturalPlan(reloaded,roomPlanningExterior(raw));assert(exterior.blueprint);
 const planned=planV3ArchitecturalBlueprint(exterior.blueprint,{buildFirst:true});assert(planned.approval);
 const built=constructV3ArchitecturalBlueprint(planned.approval);assert(built.ok&&built.scene&&built.model);assert.equal(built.outcome,'complete');assert(sameArchitecturalPlan(stage.scene,built.scene));assert.deepEqual(auditArchitecturalConstructionFidelity(built.scene,built.model),[]);
 write(`${name}.constructed`,{version:3,generationMode:'v3-scene',v3Scene:built.scene});write(`${name}.resolved`,stage.plan);
 draw(stage.scene,`${name}-master`,null,null);
 for(const s of stage.scene.interior!.storeys)draw(stage.scene,`${name}-${s.id}`,s.index,s.hostMassId);
 return {name,rooms:stage.scene.interior!.rooms.length,buildings:stage.plan.buildings.map(b=>({id:b.id,kind:b.plan.kind,storeys:b.storeys.length})),warnings:[],saveReloadLossless:true,exactPlanPreserved:true,construction:'complete',primitives:built.model.primitives.length,fidelityFindings:[],relationships:stage.plan.roomAdjacencies,stairLiftReservations:stage.plan.verticalCirculation};
});
const bad=relationshipGardenHome();Object.assign(bad.buildings[0].storeys[0].spaces[0],{size:{minWidth:99}});const draft=preparePlanEvaluation(bad);assert(draft.ok&&draft.scene);write('unresolved.saved',{version:3,generationMode:'v3-scene',v3Scene:draft.scene});
writeFileSync(`${out}/active-prompt.txt`,planEvaluationPrompt());
write('checks',{result:'PASS',externalProviderCalls:0,savedUserProjectWrites:0,newAgents:0,naturalFixture:{sourceHash,beforeWarnings:17,proposalWarnings:9,ambiguityPreserved:true},examples,unresolvedDraft:{retained:true,drawnRooms:draft.scene.interior?.rooms.length,constructionBlockers:planConstructionBlockers(draft)}});
console.log(JSON.stringify({result:'PASS',naturalWarnings:[17,9],examples:examples.map(e=>({name:e.name,rooms:e.rooms,construction:e.construction,primitives:e.primitives})),providerCalls:0}));
