/** Same retained house; no network, credential access or model requests. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stageSceneOperations, validateScene } from '../src/lib/villa/scene/model';
import { stageGenerationRefinement } from '../src/lib/villa/scene/generationReview';
import { reviseProgrammeEvidence } from '../src/lib/villa/scene/evidenceRevision';
import { sceneResultSchema } from '../src/lib/villa/scene/terra';
import { compareSceneEvidence } from '../src/lib/villa/scene/visualEvidence';
const root='docs/architecture/',dir=root+'continuous-learning';
const read=(p:string)=>JSON.parse(readFileSync(root+p,'utf8'));
const scene=validateScene(read('retained-visual-review/original.scene.json'));
const review=read('retained-visual-review/refine.input.json').review;
const raw=read('retained-visual-review/raw-candidate.operations.json');
const diagnostic=sceneResultSchema.parse(read('single-house/diagnostic.operations.json'));
const replay=(output:unknown)=>{try{const result=stageGenerationRefinement(scene,review,output);return {accepted:true,diff:result.diff};}catch(error){return {accepted:false,error:String(error)};}};
const plan=scene.architecturalPlan as {programme:{enclosureIds:string[];accessIds:string[]}[]};
// Explicit DEVELOPER mapping proposal only. It is not a recovered model decision.
const revisions=plan.programme.flatMap((space,spaceIndex)=>{
 const proposals=[];
 if(space.accessIds.includes('garden-door')) proposals.push({spaceIndex,role:'accessIds',previousIds:space.accessIds,replacementIds:space.accessIds.map(id=>id==='garden-door'?'rear-loggia-door':id),reason:'DEVELOPER DIAGNOSTIC: proposed physical garden-door replacement, not model output.'});
 if(space.enclosureIds.some(id=>['rear-left-wall','rear-garden-wall','rear-right-wall'].includes(id))) proposals.push({spaceIndex,role:'enclosureIds',previousIds:space.enclosureIds,replacementIds:[...space.enclosureIds.filter(id=>!['rear-left-wall','rear-garden-wall','rear-right-wall'].includes(id)),'rear-loggia-wall-west','rear-loggia-glazing-west','rear-loggia-door','rear-loggia-glazing-east','rear-loggia-wall-east'],reason:'DEVELOPER DIAGNOSTIC: candidate recomposed rear enclosure; full footprint remains unverified.'});
 return proposals;
});
const constructed=stageSceneOperations(scene,diagnostic.operations);
let revisionProbe:unknown;
try {const revised=reviseProgrammeEvidence(scene,constructed,revisions,[...review.refinement.targetIds,...review.refinement.newIds]);revisionProbe={supported:true,diff:compareSceneEvidence(scene,revised)};}catch(error){revisionProbe={supported:false,error:String(error)};}
const paths=['retained-visual-review/original.scene.json','retained-visual-review/raw-candidate.operations.json','retained-visual-review/refine.provider-response.txt','single-house/diagnostic.operations.json','single-house/construction.scene.json'];
mkdirSync(dir,{recursive:true});
writeFileSync(dir+'/replay.json',JSON.stringify({providerCalls:0,original:replay(raw),diagnostic:replay(diagnostic),developerEvidenceProposal:{revisions,result:replay({...diagnostic,evidenceRevisions:revisions}),revisionProbe},unchangedDiagnosticDiff:compareSceneEvidence(scene,constructed),inputs:paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(root+path)).digest('hex')}))},null,2));
console.log('Same-house full replays retained; developer evidence proposal separate; zero provider requests.');
