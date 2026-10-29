/** No providers, no persistence writes; evidence artifacts only. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateScene,applySceneOperations} from '../src/lib/villa/scene/model';
import {compareSceneEvidence,sceneVisualEvidence} from '../src/lib/villa/scene/visualEvidence';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
globalThis.fetch=async()=>{throw Error('Network forbidden');};
const sources=[
 {id:'25m',file:'docs/villa-playground/redesign-strict-live/after.UNAPPROVED.json',ops:read('docs/villa-playground/redesign-technical-review/repair.operations.json'),provenance:'Retained unapproved Terra redesign; diagnostic correction developer-authored, not an autonomous visual success.'},
 {id:'10m',file:'docs/architecture/spatial-root-cause/7702f28d-6098-4bf4-b08a-b12fc68ae93b.scene.json',ops:[{op:'resize',id:'pool-terrace',size:[18,.2,4.5]},{op:'move',id:'pool-terrace',at:[0,.1,-7.25]}],provenance:'Retained Terra Caribbean house; correction developer-authored. Original input redacted; exact brief resemblance cannot be scored.'},
];
const results=sources.map(c=>{
 const before=validateScene(read(c.file)),after=applySceneOperations(before,c.ops);
 writeFileSync(`docs/architecture/visual-learning/${c.id}-after.UNAPPROVED.json`,JSON.stringify(after,null,2));
 writeFileSync(`docs/architecture/visual-learning/${c.id}-operations.json`,JSON.stringify(c.ops,null,2));
 const comparison=compareSceneEvidence(before,after);
 return {id:c.id,source:c.file,sha256:createHash('sha256').update(readFileSync(c.file)).digest('hex'),provenance:c.provenance,comparison,
  assessment:{briefResemblance:'Unscored: exact original brief incompletely retained',composition:'Not established by geometric correction',roofFacade:'No improvement demonstrated; roof composition unchanged',siteCoordination:c.id==='10m'?'Terrace/water obstruction removed; access, pool depth and coping unresolved':'Pool relationships not changed',constructionCoherence:`${comparison.resolved.length} relationship issues resolved; ${comparison.introduced.length} introduced`,futureFirstPass:'Approved principle reaches Generate prompt in isolated integration test; model compliance and reduced repeat rate untested'}};
});
const studies=['compact','mediterranean'].map(id=>{
 const file=`docs/architecture/knowledge-construction/${id}.scene.json`,scene=validateScene(read(file));
 return {id,source:file,provenance:'Developer-authored offline study; construction evidence, not independent Terra success',evidence:sceneVisualEvidence(scene)};
});
writeFileSync('docs/architecture/visual-learning/evidence.json',JSON.stringify({providerCalls:0,feedbackOrigin:'deterministic simulated feedback',approvedLessonsWrittenToRealBrain:0,results,contrastingStudies:studies},null,2));
console.log(JSON.stringify(results.map(r=>({id:r.id,resolved:r.comparison.resolved.length,introduced:r.comparison.introduced.length,changed:r.comparison.changedElementIds})),null,2));
