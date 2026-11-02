import {Output} from 'ai';
/** Offline only: reads retained evidence and executes deterministic fixtures.
 * No model, retrieval, database, credentials or network imports/calls. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {proposalFixture} from '../src/lib/villa/scene/designProposal.fixture';
import {validateDesignProposal,reviewDesignFidelity,designProposalSchema,DESIGN_FIRST_INSTRUCTIONS} from '../src/lib/villa/scene/designProposal';
import {resolveSceneResult,sceneSystemPrompt,sceneResponseFormatSchema,strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {validateScene,type ArchitecturalScene} from '../src/lib/villa/scene/model';
import {architecturalFreedomStudy} from '../src/lib/villa/scene/architecturalFreedom.fixture';
const out='docs/architecture/design-first';mkdirSync(out,{recursive:true});
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const cases=[
 {name:'compact-family',scene:read('docs/architecture/generation-quality/final-family/scene.json') as ArchitecturalScene,source:'retained family output; deterministic contract fixture'},
 {name:'waterfront-composition',scene:architecturalFreedomStudy().scene,source:'existing developer study; not AI design evidence'},
 {name:'constrained-multilevel',scene:read('docs/architecture/generation-quality/improved-narrow/scene.json') as ArchitecturalScene,source:'retained narrow-lot output; unresolved profile/headroom review'},
];
const results=cases.map(({name,scene,source})=>{
 validateScene(scene);
 const before=JSON.stringify(scene);
 const proposal=validateDesignProposal(proposalFixture(scene));
 const output={name:scene.name,summary:'Offline construction replay; no new design claim.',unsupported:proposal.limitations,architecturalPlan:scene.architecturalPlan,operations:scene.elements.map(element=>({op:'add' as const,element}))};
 const resolved=resolveSceneResult({mode:'generate',prompt:name},output);
 const fidelity=reviewDesignFidelity(resolved.scene,proposal);
 assert.equal(fidelity.status,'matched-anchors');assert.deepEqual(resolved.scene.elements,scene.elements);
 assert.equal(JSON.stringify(scene),before);
 const altered=structuredClone(scene);altered.elements[0].size[0]+=.5;
 assert.equal(reviewDesignFidelity(altered,proposal).status,'diverged');
 const omitted=structuredClone(scene);omitted.elements=omitted.elements.filter(e=>e.kind!=='entrance');
 assert.equal(reviewDesignFidelity(omitted,proposal).status,'diverged');
 writeFileSync(`${out}/${name}.proposal.json`,JSON.stringify(proposal,null,2)+'\n');
 return {name,source,elements:scene.elements.length,fidelity,originalArchitecturalFindings:resolved.architecturalAudit.findings,
     changedGeometryRejected:true,omittedEntrancesRejected:true,completedUsableRoomsCertified:0};
});
const originalRoot='docs/architecture/complete-mansion-2026-10-30/';
const original=read(originalRoot+'scene.json');const output=read(originalRoot+'normalized-output.json');
const replay=resolveSceneResult({mode:'generate',prompt:readFileSync(originalRoot+'brief.txt','utf8')},output);
assert.deepEqual(JSON.parse(JSON.stringify(replay.scene.elements)),original.elements);
const files=['provider-request.exact.json','provider-response.exact.json','normalized-output.json','operations.json','expanded-operations.json','programme.json','scene.json','arrival.png','aerial.png','garden.png','poolside.png'];
const hashes=Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(originalRoot+file)).digest('hex')]));
const retainedHashes=read(originalRoot+'final-verification.json').artifactHashes;
for(const file of files)assert.equal(hashes[file],retainedHashes[file],`Original archival hash changed: ${file}`);
writeFileSync(out+'/offline-evidence.json',JSON.stringify({paidCalls:0,originalMansionExactReplay:true,originalArchiveHashesMatch:true,originalHashes:hashes,cases:results,limitations:['Proposals are derived offline from existing geometry. Fidelity can be demonstrated; better independent model planning cannot. No fixture is transmitted to the model or used as a mansion template.']},null,2)+'\n');
console.log(JSON.stringify({paidCalls:0,originalMansionExactReplay:true,cases:results.map(r=>({name:r.name,elements:r.elements,fidelity:r.fidelity.status,architecturalFindings:r.originalArchitecturalFindings.length}))},null,2));

// Prepare one future experiment, never submit it. The retained retrieval text is
// an offline comparison snapshot; normal retrieval must be retained on live use.
const input={mode:'generate' as const,prompt:readFileSync(originalRoot+'brief.txt','utf8')};
const prior=read(originalRoot+'preflight.json');
const preparation={status:'prepared-not-authorized-or-sent',maximumProviderRequests:2,maxRetriesPerStage:0,
    modelExpected:'gpt-5.6-terra',reasoning:'provider-default',maxOutputTokensPerStage:30000,
    input,planningSystemSnapshot:sceneSystemPrompt(input)+prior.context.trace.text+DESIGN_FIRST_INSTRUCTIONS,
    planningFormat:await Output.object({schema:await strictSceneResponseSchema(designProposalSchema)}).responseFormat,
    constructionFormat:await Output.object({schema:await sceneResponseFormatSchema(input)}).responseFormat,
    constructionSystem:'Normal current context plus the returned, validated proposal; cannot fingerprint before planning returns.',
    retrieval:'Snapshot uses unchanged prior retrieval for offline comparison. Re-run normal retrieval and retain exact text before any authorized live request; no retrieval or DB access performed here.',
    warning:'One Generate experiment now entails two potentially paid provider requests. Stop on either-stage failure; do not retry or simplify. No call is authorized by this artifact.'};
writeFileSync(out+'/experiment.preparation.json',JSON.stringify(preparation,null,2)+'\n');
writeFileSync(out+'/experiment.request.json',JSON.stringify(input,null,2)+'\n');
