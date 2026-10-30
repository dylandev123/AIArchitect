/** Offline review and camera fixtures. These are NOT fresh model generations. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {exteriorStudy} from '../src/lib/villa/scene/exteriorFirst.fixture';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {generationQualityFindings} from '../src/lib/villa/scene/generationQuality';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {resolveSceneResult} from '../src/lib/villa/scene/terra';
import {validateScene} from '../src/lib/villa/scene/model';
const dir='docs/architecture/generation-quality';
mkdirSync(dir,{recursive:true});
const save=(name:string,data:unknown)=>writeFileSync(`${dir}/${name}`,JSON.stringify(data,null,2));
const retained=[
 ['rejected-estate','docs/architecture/terra-controlled-estate-2026-10-29/draft.REJECTED.json'],
 ['latest-retained','docs/architecture/architectural-bottleneck/latest.RETAINED.json'],
 ['compact-developer','docs/architecture/exterior-first/compact.DEVELOPER.json'],
 ['layered-developer','docs/architecture/exterior-first/layered.DEVELOPER.json'],
];
const reviews=[];
for(const [name,path] of retained){
 const scene=validateScene(JSON.parse(readFileSync(path,'utf8')));
 reviews.push({name,path,elements:scene.elements.length,qualityFindings:generationQualityFindings(scene),relationships:sceneRelationshipIssues(scene),architecture:reviewSceneArchitecture(scene)});
}
save('offline-review.json',{providerCalls:0,reviews});
for(const layered of [false,true]){
 const original=exteriorStudy(layered);
 const {architecturalPlan,name,summary,unsupported}=original;
 // Deliberately move the second scene far from the initial house to expose stale
 // camera framing. No developer geometry is presented as model output.
 const operations=structuredClone(original.operations);
 for(const op of operations){
  const part=op.op==='add'?op.element:op.op==='assemble'?op.assembly.parameters:undefined;
  if(part && !('parent' in part && part.parent))part.at=[part.at[0]+(layered?50:0),part.at[1],part.at[2]-(layered?25:0)];
 }
 const result=resolveSceneResult({mode:'generate',prompt:'Offline developer camera verification'}, {architecturalPlan,name,summary,unsupported,operations});
 save(`${layered?'shifted':'compact'}.mock-response.json`,{...result,responseId:layered?'00000000-0000-4000-8000-000000000002':'00000000-0000-4000-8000-000000000001'});
}
console.log(JSON.stringify(reviews.map(r=>({name:r.name,elements:r.elements,qualityFindings:r.qualityFindings.length,relationshipFindings:r.relationships.length}))));
