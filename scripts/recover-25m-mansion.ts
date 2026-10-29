/** Offline only: preserve the retained response; correct just two railing elevations. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {auditArchitecturalPlan} from '../src/lib/villa/scene/planning';
import {applySceneOperations,validateScene} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const source='.data/scene-responses/ed0d5d1e-a7f5-4e39-99b3-d203f5b63393.json';
const dir='docs/villa-playground/25m-mansion-recovery';mkdirSync(dir,{recursive:true});
const bytes=readFileSync(source),retained=JSON.parse(bytes.toString());
const sha256=createHash('sha256').update(bytes).digest('hex');
writeFileSync(`${dir}/original.response.json`,bytes);
const original=validateScene({version:'architectural-scene-1',name:retained.output.name,elements:retained.output.operations.filter((o:any)=>o.op==='add').map((o:any)=>o.element)});
const issues=sceneRelationshipIssues(original);
assert.deepEqual(issues.map(i=>[i.id,i.rule]),[['east-terrace-rail','railing-deck'],['west-terrace-rail','railing-deck']]);
const correctedOutput=structuredClone(retained.output);
const corrections=[];
for(const side of ['east','west']){
 const rail=correctedOutput.operations.find((o:any)=>o.element?.id===`${side}-terrace-rail`).element;
 const deck=original.elements.find(e=>e.id===`${side}-terrace-deck`)!;
 assert.equal(rail.parent,undefined);assert.equal(deck.parent,undefined);
 const before=[...rail.at];rail.at[1]=deck.at[1]+deck.size[1]/2+rail.size[1]/2;
 corrections.push({id:rail.id,before,after:rail.at,deck:deck.id,walkingSurface:deck.at[1]+deck.size[1]/2,rotation:rail.rotation,renderedX:[rail.at[0]-rail.size[0]/2,rail.at[0]+rail.size[0]/2],renderedZ:rail.at[2]});
}
const scene=applySceneOperations({version:'architectural-scene-1',name:retained.output.name,elements:[]},correctedOutput.operations);
// Recover geometry for inspection, retaining the plan audit honestly as incomplete.
const result={scene,architecturalAudit:auditArchitecturalPlan(scene,correctedOutput.architecturalPlan)};
assert.deepEqual(sceneRelationshipIssues(result.scene),[]);
assert.deepEqual(readFileSync(source),bytes);
writeFileSync(`${dir}/original.scene.json`,JSON.stringify(original,null,2));
writeFileSync(`${dir}/corrected.response.json`,JSON.stringify(correctedOutput,null,2));
writeFileSync(`${dir}/corrected.scene.json`,JSON.stringify(result.scene,null,2));
writeFileSync(`${dir}/recovery.json`,JSON.stringify({source,sha256,providerCalls:0,elements:result.scene.elements.length,issues,corrections,architecturalAudit:result.architecturalAudit},null,2));
console.log(JSON.stringify({sha256,elements:result.scene.elements.length,corrections,audit:result.architecturalAudit},null,2));
