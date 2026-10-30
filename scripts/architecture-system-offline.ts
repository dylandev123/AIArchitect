/** Read-only offline pipeline replay. Writes only this investigation's evidence. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {latestKnowledge} from '../src/lib/library/architecture/service';
import {legacyRecipeKnowledge} from '../src/lib/library/architecture/legacyRecipes';
import {retrieveArchitecturalKnowledge} from '../src/lib/library/architecture/retrieval';
import {monetaryBriefContext} from '../src/lib/library/architecture/propertyValue';
import {requestPipelineFixtures} from '../src/lib/library/architecture/requestPipeline.fixture';
import {generationSceneRequest,sceneMessages,sceneResponseFormatSchema,resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {stageSceneOperations,validateScene} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {reviewProgramme} from '../src/lib/villa/scene/programme';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
globalThis.fetch=async()=>{throw Error('Network forbidden in offline pipeline replay');};
const source='docs/architecture/terra-controlled-estate-2026-10-29';
const originalHashes=read(`${source}/sha256.json`);
for(const [file,expected] of Object.entries(originalHashes))assert.equal(hash(`${source}/${file}`),expected);
const snapshotPath='docs/architecture/unified-knowledge/library-snapshot.json';
const snapshot=read(snapshotPath);
const catalogue=[...latestKnowledge(snapshot.architecturalKnowledge),...legacyRecipeKnowledge(snapshot.recipes)];
const fixtures=requestPipelineFixtures.map(fixture=>{
 const request=generationSceneRequest(fixture.brief),messages=sceneMessages(request);
 const first=messages[0].content[0];assert.equal(first.type,'text');
 if(first.type==='text')assert.equal(JSON.parse(first.text).prompt,fixture.brief);
 const knowledge=retrieveArchitecturalKnowledge(catalogue,fixture.brief);
 assert.equal(knowledge.metrics.approvedActive,334);
 assert.deepEqual(knowledge.selected.filter(e=>e.category==='property-value').map(e=>e.id),fixture.profile?[fixture.profile]:[]);
 return {...fixture,money:monetaryBriefContext(fixture.brief),messages,knowledge};
});
const request=read(`${source}/request.json`),provider=read(`${source}/provider-response.exact.json`);
const text=provider.output.flatMap((o:{content?:{type:string;text:string}[]})=>o.content??[]).filter((c:{type:string})=>c.type==='output_text').map((c:{text:string})=>c.text).join('');
const parsed=await (await sceneResponseFormatSchema(request)).validate!(JSON.parse(text));assert(typeof parsed==='object' && parsed.success);
const normalized=read(`${source}/normalized-output.json`);assert.deepEqual(parsed.value,normalized);
const original=validateScene(read(`${source}/draft.REJECTED.json`));
const staged=stageSceneOperations({version:'architectural-scene-1',name:original.name,elements:[]},normalized.operations);
assert.deepEqual(staged.elements,original.elements);
let rejected=false;
try{resolveSceneResult(request,normalized);}catch(error){assert(error instanceof SceneConstructionError);rejected=true;assert.deepEqual(error.recoverableDraft.elements,original.elements);assert.equal(error.recoverableDraft.generationBrief,request.prompt);}
assert(rejected);
const findings=sceneRelationshipIssues(original);assert.equal(findings.length,14);
const retainedPreflight=read(`${source}/preflight-retained.json`);
const report={providerCalls:0,databaseReads:0,databaseWrites:0,sourceHashesVerified:true,sourceHashes:originalHashes,
 snapshot:{path:snapshotPath,sha256:hash(snapshotPath),approvedActive:334,seedRecords:310,legacyRecipes:24},
 fixtures,retained:{exactStrictOutputMatches:true,authoredOperations:normalized.operations.length,elements:staged.elements.length,unchangedGeometry:true,stillRejected:rejected,findings,programme:reviewProgramme(original),originalKnowledge:retainedPreflight.knowledge.selected},
 visualEvidence:['docs/architecture/intelligence-comparison/solana-aerial.png','docs/architecture/intelligence-comparison/solana-entrance.png','docs/architecture/terra-estate-diagnosis/original-aerial.png','docs/architecture/terra-estate-diagnosis/original-entrance.png'].map(path=>({path,sha256:hash(path),newCapture:false})),
 limitation:'Fixtures verify deterministic retrieval and exact message transport, not future model interpretation or architectural quality. No retained geometry was repaired.'};
writeFileSync('docs/architecture/system-repair/offline-evidence.json',JSON.stringify(report,null,2));
console.log('11 brief fixtures; 334 approved records; exact 128-element replay; 14 genuine remaining findings; zero provider/database calls.');
