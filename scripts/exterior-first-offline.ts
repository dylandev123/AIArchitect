import {mkdirSync,writeFileSync} from 'node:fs';
import {exteriorStudy} from '../src/lib/villa/scene/exteriorFirst.fixture';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const dir='docs/architecture/exterior-first';mkdirSync(dir,{recursive:true});
for(const layered of [false,true]){
 const study=exteriorStudy(layered),name=layered?'layered':'compact';
 writeFileSync(`${dir}/${name}.DEVELOPER.json`,JSON.stringify(study.scene,null,2));
 writeFileSync(`${dir}/${name}.operations.json`,JSON.stringify(study.operations,null,2));
 writeFileSync(`${dir}/${name}.audit.json`,JSON.stringify({providerCalls:0,elements:study.scene.elements.length,authoredOperations:study.operations.length,relationships:sceneRelationshipIssues(study.scene),review:study.architecturalAudit},null,2));
 console.log(name,study.scene.elements.length,study.architecturalAudit.issues);
}
