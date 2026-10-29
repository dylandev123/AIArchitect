import { asSchema } from 'ai';
/** Offline only. No provider, database, network or request-handler imports. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validateScene, applySceneOperations } from '../src/lib/villa/scene/model';
import { reviewSceneArchitecture } from '../src/lib/villa/scene/planning';
import { prepareArchitectureCompletion, sceneResponseFormatSchema, sceneMessages } from '../src/lib/villa/scene/terra';
import { circulationFindings } from '../src/lib/villa/scene/completion';
const files=[
 'docs/villa-playground/redesign-strict-live/after.UNAPPROVED.json',
 'docs/villa-playground/redesign-technical-review/repaired.UNAPPROVED.json',
 'docs/architecture/knowledge-construction/compact.scene.json',
 'docs/architecture/knowledge-construction/caribbean.scene.json',
 'docs/architecture/knowledge-construction/mediterranean.scene.json',
 'docs/architecture/composable-knowledge/family-pool.scene.json',
 'docs/architecture/composable-knowledge/spa-pool.scene.json',
];
const originals=files.map(file=>readFileSync(file));
const scenes=originals.map(raw=>validateScene(JSON.parse(raw.toString())));
const reports=scenes.map((scene,i)=>({source:files[i],sha256:createHash('sha256').update(originals[i]).digest('hex'),elements:scene.elements.length,status:reviewSceneArchitecture(scene).status,findings:reviewSceneArchitecture(scene).findings,circulation:circulationFindings(scene)}));
const operations=JSON.parse(readFileSync('docs/villa-playground/redesign-technical-review/repair.operations.json','utf8'));
const candidate=applySceneOperations(scenes[0],operations);
assert.deepEqual(candidate,scenes[1]);
assert.equal(reports[1].findings.filter(f=>f.category==='confirmed-technical-defect').length,0);
for(const code of ['vertical-route-missing','upper-floor-gap','shared-boundary-blocked','pool-evidence-missing']) assert(reports[1].findings.some(f=>f.code===code));
// Single-level stronger examples must not acquire invented missing upper routes.
for(let i=2;i<reports.length;i++) assert(!reports[i].circulation.some(f=>f.code==='vertical-route-missing'),files[i]);
files.forEach((file,i)=>assert.deepEqual(readFileSync(file),originals[i]));
const out='docs/architecture/completion';mkdirSync(out,{recursive:true});
const preparation=[];
for (let i=0;i<2;i++) {
 const request=prepareArchitectureCompletion(scenes[i]);
 assert.deepEqual(request.current,scenes[i]);
 const context=JSON.parse(sceneMessages(request)[0].content[0].text!);
 assert.deepEqual(context.current,scenes[i]);
 for(const finding of reports[i].findings) assert(request.prompt.includes(finding.code));
 const schema=await sceneResponseFormatSchema(request);
 const json=(await asSchema(schema).jsonSchema) as {required:string[];properties:Record<string,{minItems?:number}>};
 assert(json.required.includes('architecturalPlan'));assert.equal(json.properties.operations.minItems,1);
 writeFileSync(`${out}/${i===0?'retained':'repaired'}.completion.request.json`,JSON.stringify(request,null,2));
 preparation.push({source:files[i],editIntent:request.editIntent,fullSceneContext:true,allFindingsIncluded:true,requiresPlanAndConstruction:true,promptChars:request.prompt.length});
}
writeFileSync(`${out}/offline-audit.json`,JSON.stringify({providerCalls:0,preparation,reports},null,2));
writeFileSync(`${out}/door-repair.UNAPPROVED.json`,JSON.stringify(candidate,null,2));
writeFileSync(`${out}/door-repair.operations.json`,JSON.stringify(operations,null,2));
console.log(JSON.stringify(reports.map(r=>({source:r.source,technical:r.findings.filter(f=>f.category==='confirmed-technical-defect').length,circulation:r.circulation.map(f=>({code:f.code,ids:f.elementIds})),pool:r.findings.filter(f=>f.code==='pool-evidence-missing').length})),null,2));
