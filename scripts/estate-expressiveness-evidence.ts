/** Offline capability proof. Uses production authoring, renderer and construction.
 * Writes evidence only; no provider, fetch, browser storage or saved-project writes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchitecturalFloorPlan } from '../src/components/workspace/viewport/ArchitecturalFloorPlan';
import { formalArrivalEstate, articulatedWingsResidence, referenceExterior } from '../src/lib/v3/parity/expressiveEstate';
import { preparePlanEvaluation, checkoutPlanEvaluation } from '../src/lib/v3/architecturalPlanEvaluation';
import { elaborateV3ArchitecturalPlan, planConstructionBlockers, sameArchitecturalPlan } from '../src/lib/v3/architecturalPlanFirst';
import { planV3ArchitecturalBlueprint, constructV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprint';
import { auditArchitecturalConstructionFidelity } from '../src/lib/v3/architecturalConstructionFidelity';
import { deriveArchitecturalPlan } from '../src/lib/v3/architecturalPlanning';
import type { V3Scene } from '../src/lib/v3/scene';

const out='docs/architecture/architectural-blueprint-pipeline/estate-expressiveness';mkdirSync(out,{recursive:true});
const paidPath='src/lib/v3/__tests__/fixtures/paid-plan-548137db.json',paidBytes=readFileSync(paidPath),hash=(s:Uint8Array|string)=>createHash('sha256').update(s).digest('hex');
const paid=JSON.parse(paidBytes.toString());paid.connections[2].to={kind:'surface',objectId:'sea-terrace',local:[0,0]};Object.assign(paid.buildings[0].accessOpenings[0],{start:.432,end:.568});Object.assign(paid.buildings[0].accessOpenings[3],{start:.94,end:1});paid.features[5].location.z=-50;
const svg=(scene:V3Scene,name:string,floor:number|null,buildingId:string|null=null)=>{
 const markup=renderToStaticMarkup(createElement(ArchitecturalFloorPlan,{scene,model:null,floor,buildingId,readOnly:true}));
 const drawing=markup.match(/<svg[\s\S]*?<\/svg>/)?.[0];assert(drawing);
 const artifact=drawing.replace('<svg ',`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" style="background:#f6f3eb;font-family:Arial,sans-serif" `);
 const box=drawing.match(/viewBox="([^"]+)"/)![1].split(' ');
 const opaque=artifact.replace(/(<svg[^>]*>)/,`$1<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#f6f3eb"/>`);
 writeFileSync(`${out}/${name}.svg`,opaque+'\n');return `${name}.svg`;
};
const baseline=preparePlanEvaluation(paid);assert(baseline.ok&&baseline.scene);assert.deepEqual(planConstructionBlockers(baseline),[]);
const before={label:'Retained paid composition with previously documented local preflight corrections, offline only',paidResponseFixtureSha256:hash(paidBytes),plan:paid,drawings:[svg(baseline.scene,'before-paid-estate',null),svg(baseline.scene,'before-paid-ground',0,'main-house')]};
const demonstrations=[];
for(const [name,make] of [['formal-arrival',formalArrivalEstate],['articulated-wings',articulatedWingsResidence]] as const){
 const plan=make(),source=JSON.stringify(plan),stage=preparePlanEvaluation(plan);assert(stage.ok&&stage.scene&&stage.plan);assert.deepEqual(stage.unresolved,[]);assert.deepEqual(planConstructionBlockers(stage),[]);
 assert.deepEqual(stage.findings.filter(f=>['BLUEPRINT_SPACE_OUTSIDE_HOST','BLUEPRINT_SPACE_OVERLAP','ROOM_ADJACENCY_NO_SHARED_BOUNDARY'].includes(f.code)),[]);
 const reopened=checkoutPlanEvaluation(JSON.parse(JSON.stringify(stage.scene)));assert(reopened.ok);assert(sameArchitecturalPlan(stage.scene,reopened.scene!));
 const exterior=referenceExterior(plan),developed=elaborateV3ArchitecturalPlan(reopened,exterior);assert(developed.blueprint,JSON.stringify(developed.findings));
 const approved=planV3ArchitecturalBlueprint(developed.blueprint,{buildFirst:true});assert(approved.approval,JSON.stringify(approved.findings));
 const built=constructV3ArchitecturalBlueprint(approved.approval);assert(built.ok&&built.scene&&built.model,JSON.stringify(built.findings));assert.equal(built.outcome,'complete');assert(sameArchitecturalPlan(stage.scene,built.scene));assert.deepEqual(auditArchitecturalConstructionFidelity(built.scene,built.model),[]);assert.equal(JSON.stringify(plan),source);
 const drawings=[svg(stage.scene,`${name}-master`,null),svg(stage.scene,`${name}-ground`,0,plan.buildings[0].id),svg(stage.scene,`${name}-upper`,1,plan.buildings[0].id)];
 writeFileSync(`${out}/${name}.plan.json`,JSON.stringify(stage.plan,null,2)+'\n');writeFileSync(`${out}/${name}.constructed.json`,JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:built.scene},null,2)+'\n');
 demonstrations.push({name,synthetic:true,providerOutput:false,buildings:plan.buildings.length,rooms:stage.scene.interior!.rooms.length,roomAdjacencies:plan.roomAdjacencies.length,features:plan.features.map(f=>({id:f.id,type:f.type,shaped:!!f.footprint})),exactCurvedPaths:plan.connections.filter(c=>c.path).length,unresolved:stage.unresolved,preflightBlockers:planConstructionBlockers(stage),construction:built.outcome,planGeometryPreserved:true,reloadedLosslessly:true,constructionFidelityFindings:[],drawingFloors:[0,1].map(floor=>({floor,visibleBuildingIds:deriveArchitecturalPlan(stage.scene!,null,floor).buildings.map(b=>b.id)})),primitives:built.model.primitives.length,drawings});
}
assert.equal(hash(readFileSync(paidPath)),before.paidResponseFixtureSha256);
const report={result:'PASS',liveProviderCalls:0,savedProjectWrites:0,syntheticExamplesAreNotModelQualityEvidence:true,before,demonstrations,baselineCodeLimitations:{nonrectangularFeatureConstruction:'Every features[].footprint was rejected by ARCHITECTURAL_FEATURE_CONSTRUCTION_DEFERRED and EXTERIOR_PLAN_DEFERRED; 2D itself already supported line/arc boundaries.',curvedConnectionAuthoring:'Only waypoints; no exact semantic arc centreline.',fountain:'Unknown feature type; no basin/jet capability.',compactRoomAdjacencies:'Accepted as compatible legacy input, absent from the advertised compact authoring schema.',upperFloorView:'All buildings drawn, including ground-only pavilions.'},remainingLimits:['Room regions and partition derivation remain rectangular; polygonal/curved room partitions are not supported.','No outline holes, splines or overlapping curved-mass Boolean unions. Use supported connected rectilinear wings for enclosed courts.','Nonrectangular canopies and site perimeter railings remain explicitly unsupported; test gates retain them as blockers.','Basin/perimeter offsets reject narrow or folded outlines; curves tessellate at the shared V3 sampling tolerance.','Rooms and adjacencies are conceptual allocations; door scheduling, floor voids, automatic functional access certification and construction documents remain out of scope.','A mock complete build proves representability and geometric fidelity; no claim is made about future Terra design quality, measured site conditions, engineering or budget accuracy.']};
writeFileSync(`${out}/checks.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:report.result,paidFixtureUnchanged:true,demonstrations:demonstrations.map(d=>({name:d.name,rooms:d.rooms,construction:d.construction,blockers:d.preflightBlockers,planPreserved:d.planGeometryPreserved,primitives:d.primitives})),drawings:8,providerCalls:0}));
