/** Offline pipeline audit: existing developer-authored studies, never model quality evidence. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ARCHITECTURAL_KNOWLEDGE_SEEDS as entries} from '../src/lib/library/architecture/seeds';
import {retrieveArchitecturalKnowledge as retrieve} from '../src/lib/library/architecture/retrieval';
import {resolveSceneResult, SCENE_SYSTEM_PROMPT} from '../src/lib/villa/scene/terra';
import {validateScene} from '../src/lib/villa/scene/model';
globalThis.fetch=async()=>{throw Error('Offline: network prohibited');};
const dir='docs/architecture/generation-process';mkdirSync(dir,{recursive:true});
const cases=[
 ['compact','$250k compact modern three-bedroom family home','docs/architecture/knowledge-construction/compact.scene.json'],
 ['mediterranean','$1m Mediterranean courtyard villa','docs/architecture/knowledge-construction/mediterranean.scene.json'],
 ['tropical','$5m contemporary tropical residence','docs/architecture/knowledge-construction/caribbean.scene.json'],
 ['mansion','$25m Caribbean waterfront mansion','docs/villa-playground/terra-basic-diagnosis/study.scene.json'],
];
const results=cases.map(([id,brief,source])=>{
 const original=validateScene(JSON.parse(readFileSync(source,'utf8'))),knowledge=retrieve(entries,brief);
 // Intentionally retain the study's real limitations, not invented knowledge applications.
 const result=resolveSceneResult({mode:'generate',prompt:brief},{name:original.name,summary:'Existing developer-authored study replay; not Terra output.',unsupported:['Study replay does not establish autonomous model quality or complete room/circulation design.'],architecturalPlan:original.architecturalPlan,operations:original.elements.map(element=>({op:'add',element}))},knowledge.evidence);
 assert.deepEqual(result.scene.elements,original.elements);
 assert(knowledge.selected.some(e=>e.category==='property-value'));
 assert(knowledge.chars<=knowledge.budget.chars);
 const e=result.scene.elements;
 const signature=e.map(({kind,at,size,rotation,roofForm,opening})=>({kind,at,size,rotation,roofForm,opening}));
 writeFileSync(`${dir}/${id}.scene.json`,JSON.stringify(result.scene,null,2));
 return {id,brief,source,provenance:'Existing developer-authored offline study; no AI generation',knowledge,signature,audit:result.architecturalAudit,roofForms:e.filter(x=>x.kind==='roof').map(x=>x.roofForm??'flat'),height:Math.max(...e.map(x=>x.at[1]+x.size[1]/2)),openings:e.filter(x=>x.opening).length};
});
assert.equal(new Set(results.map(r=>JSON.stringify(r.signature))).size,4);
// Diagnostic retained model response: prove no geometry simplification after generation.
const retained=JSON.parse(readFileSync('.data/scene-responses/0bd8551e-ebcf-4685-8ee0-5aed50e7bea6.json','utf8'));
const replay=resolveSceneResult(retained.input,retained.output);
assert.deepEqual(replay.scene.elements,retained.output.operations.map((op:{element:unknown})=>op.element));
writeFileSync(`${dir}/evidence.json`,JSON.stringify({providerCalls:0,productionTemplatesAdded:0,systemChars:SCENE_SYSTEM_PROMPT.length,retainedDiagnostic:{responseId:retained.responseId,executorExact:true,originalPrompt:retained.input.prompt,planPresent:!!retained.output.architecturalPlan,limitations:'Retained input is redacted and has no request/knowledge trace; cannot reconstruct historical retrieval or certify original brief alignment.'},results},null,2));
console.log(results.map(r=>({id:r.id,selected:r.knowledge.selected.map(k=>k.id),height:r.height,roofForms:[...new Set(r.roofForms)],issues:r.audit.issues.length})));
