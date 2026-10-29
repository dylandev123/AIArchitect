import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {codeArchitectureStudies} from '../src/lib/villa/scene/codeArchitectureProof';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {validateScene,applySceneOperations} from '../src/lib/villa/scene/model';
import {constructionCapabilityReference} from '../src/lib/villa/scene/capabilityReference';
globalThis.fetch=async()=>{throw Error('Offline: network forbidden');};
const dir='docs/architecture/code-driven';mkdirSync(dir,{recursive:true});
const studies=codeArchitectureStudies();
for(const [name,scene] of Object.entries(studies)){
 assert.deepEqual(sceneRelationshipIssues(scene),[]);
 assert.deepEqual(validateScene(JSON.parse(JSON.stringify(scene))),scene);
 writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(scene,null,2));
}
const edited=applySceneOperations(studies.solana,[{op:'move',id:'dining',at:[14,.1,-1]},{op:'rotate',id:'dining',rotation:.18},{op:'finish',id:'dining-bay-0',material:'limestone'}]);
writeFileSync(`${dir}/edited.scene.json`,JSON.stringify(edited,null,2));
writeFileSync(`${dir}/capabilities.txt`,constructionCapabilityReference());
writeFileSync(`${dir}/verification.json`,JSON.stringify({providerCalls:0,developerAuthored:true,approved:false,studies:Object.fromEntries(Object.entries(studies).map(([key,s])=>[key,{name:s.name,elements:s.elements.length,roots:s.elements.filter(e=>!e.parent).map(e=>e.id),relationshipIssues:sceneRelationshipIssues(s)}])),limitations:['Exterior technique studies, not complete homes or exact Solana reconstruction','Stairs, room circulation, balcony, pool and engineering approval not claimed','No autonomous model-generation quality verified']},null,2));
console.log('Two offline editable compositions verified.');
