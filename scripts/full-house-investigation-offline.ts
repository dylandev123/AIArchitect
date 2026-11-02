/** Same-house continuation. No provider, credential, retrieval or database calls. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateScene,stageSceneOperations} from '../src/lib/villa/scene/model';
import {stageGenerationRefinement} from '../src/lib/villa/scene/generationReview';
import {reviseProgrammeEvidence} from '../src/lib/villa/scene/evidenceRevision';
import {sceneResultSchema} from '../src/lib/villa/scene/terra';
import {compareSceneEvidence,architecturalReferenceDependencies} from '../src/lib/villa/scene/visualEvidence';
import {straightWalkingAccess} from '../src/lib/villa/scene/walkingAccess';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
import {reviewProgramme} from '../src/lib/villa/scene/programme';
import {generationQualityFindings} from '../src/lib/villa/scene/generationQuality';
const root='docs/architecture/',dir=root+'full-house-investigation';
const read=(p:string)=>JSON.parse(readFileSync(root+p,'utf8'));
const scene=validateScene(read('retained-visual-review/original.scene.json'));
const review=read('retained-visual-review/refine.input.json').review;
const raw=read('retained-visual-review/raw-candidate.operations.json');
const diagnostic=sceneResultSchema.parse(read('single-house/diagnostic.operations.json'));
const bytes=JSON.stringify(scene);
const replay=(output:unknown)=>{
 try {const r=stageGenerationRefinement(scene,review,output);return {accepted:true,changedIds:r.diff.changedElementIds};}
 catch(error){return {accepted:false,error:error instanceof Error?error.message.slice(0,400):String(error),schemaIssues:typeof error==='object'&&error&&'issues' in error?(error.issues as {path:unknown;message:string}[]).map(i=>({path:i.path,message:i.message})):undefined};}
};
const plan=scene.architecturalPlan as {programme:{enclosureIds:string[];accessIds:string[]}[]};
const replacementFacade=['rear-loggia-wall-west','rear-loggia-glazing-west','rear-loggia-door','rear-loggia-glazing-east','rear-loggia-wall-east'];
const revisions=plan.programme.flatMap((space,spaceIndex)=>{
 const proposals=[];
 if(space.accessIds.includes('garden-door'))proposals.push({spaceIndex,role:'accessIds',previousIds:space.accessIds,replacementIds:space.accessIds.map(id=>id==='garden-door'?'rear-loggia-door':id),reason:'DEVELOPER DIAGNOSTIC ONLY: explicit replacement operable passage, verified across existing slabs.'});
 if(space.enclosureIds.some(id=>['rear-left-wall','rear-garden-wall','rear-right-wall'].includes(id)))proposals.push({spaceIndex,role:'enclosureIds',previousIds:space.enclosureIds,replacementIds:[...space.enclosureIds.filter(id=>!['rear-left-wall','rear-garden-wall','rear-right-wall'].includes(id)),...replacementFacade],reason:'DEVELOPER DIAGNOSTIC ONLY: explicitly proposed recomposed rear enclosure. No room footprint is inferred.'});
 return proposals;
});
const constructed=stageSceneOperations(scene,diagnostic.operations);
const scope=[...review.refinement.targetIds,...review.refinement.newIds];
const revised=reviseProgrammeEvidence(scene,constructed,revisions,scope);
const diff=compareSceneEvidence(scene,revised);
const g=sceneSpatialGeometry(constructed);
const door=g.map.get('rear-loggia-door')!,terrace=g.map.get('dining-terrace')!;
// These reference-only probes are NOT supported transaction outputs. They cannot
// pass metadata preservation and are never substituted for model-produced intent.
const referenceProbe=structuredClone(revised);
const probePlan=referenceProbe.architecturalPlan as {spatialRelationships:{subject:string}[];designDecisions:{elementIds:string[]}[]};
probePlan.spatialRelationships[1].subject='rear-loggia-door';
const spatialProbeDiff=compareSceneEvidence(scene,referenceProbe);
const spatialOnlyPlan=structuredClone(referenceProbe.architecturalPlan);
probePlan.designDecisions[1].elementIds=['dining-terrace','rear-loggia-door','dining-canopy'];
probePlan.designDecisions[6].elementIds=[...replacementFacade,'west-side-north','west-side-middle','west-side-south','east-side-north','east-side-south'];
const allReferenceProbeDiff=compareSceneEvidence(scene,referenceProbe);
const measure=(id:string)=>{const e=g.map.get(id)!;return {id,world:g.world(e),size:e.size,bottom:g.bottom(e),top:g.top(e),primaryBottom:g.world(e)[1]-e.size[1]/2,primaryTop:g.world(e)[1]+e.size[1]/2};};
const paths=['retained-visual-review/original.scene.json','retained-visual-review/raw-candidate.operations.json','retained-visual-review/refine.provider-response.txt','retained-visual-review/refine.input.json','single-house/diagnostic.operations.json','single-house/construction.scene.json'];
const imagePaths=['single-house/before-aerial.png','single-house/before-arrival.png','single-house/before-garden.png','single-house/before-poolside.png','single-house/after-aerial.png','single-house/after-arrival.png','single-house/after-garden.png','single-house/after-poolside.png'];
const imageEvidence=imagePaths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(root+path)).digest('hex')}));
const inputs=paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(root+path)).digest('hex')}));
const checkpoints=[
 {step:'Original Terra response, unchanged',result:replay(raw)},
 {step:'Prior labelled six physical corrections and assumed fascia mass',result:replay(diagnostic)},
 {step:'After route recognition, explicit prior programme proposal',result:replay({...diagnostic,evidenceRevisions:revisions}),introducedAuditWarnings:diff.introducedAuditWarnings},
 {step:'Diagnostic-only spatial endpoint probe; production metadata gate retained',result:replay({...diagnostic,architecturalPlan:spatialOnlyPlan,evidenceRevisions:revisions}),introducedAuditWarnings:spatialProbeDiff.introducedAuditWarnings},
 {step:'Diagnostic-only spatial + knowledge references; no physical changes',result:replay({...diagnostic,architecturalPlan:referenceProbe.architecturalPlan,evidenceRevisions:revisions}),introducedAuditWarnings:allReferenceProbeDiff.introducedAuditWarnings},
];
if(JSON.stringify(scene)!==bytes)throw Error('Original mutated');
mkdirSync(dir,{recursive:true});
writeFileSync(dir+'/replay.json',JSON.stringify({providerCalls:0,label:'DEVELOPER DIAGNOSTICS ONLY; no accepted refinement',inputs,imageEvidence,unchangedDiagnosticElements:JSON.stringify(referenceProbe.elements)===JSON.stringify(constructed.elements),checkpoints,revisions,route:straightWalkingAccess(constructed,door,terrace),measurements:['main-floor','dining-terrace','rear-loggia-door','main-roof','dining-canopy','rear-loggia-canopy-edge'].map(measure),remainingProtectedReferences:architecturalReferenceDependencies(scene).filter(r=>['garden-door','rear-garden-wall','rear-left-wall','rear-right-wall'].includes(r.elementId)),programme:reviewProgramme(revised),roofFindings:generationQualityFindings(constructed).filter(f=>f.code==='flat-roof-junction-review'),originalPreserved:true},null,2));
writeFileSync(dir+'/reference-probe.scene.json',JSON.stringify(referenceProbe,null,2));
console.log(JSON.stringify({providerCalls:0,route:straightWalkingAccess(constructed,door,terrace),checkpoints:checkpoints.map(c=>({step:c.step,accepted:c.result.accepted,findings:c.introducedAuditWarnings?.length})),terminalFindings:allReferenceProbeDiff.introducedAuditWarnings},null,2));
