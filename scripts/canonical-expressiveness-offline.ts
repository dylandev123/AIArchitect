import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {compositionFixture} from '../src/lib/villa/canonical/compositions.fixture';
import {physicalEvidence} from '../src/lib/villa/experimental/semantic-building/physical';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const dir='docs/architecture/canonical-expressiveness';mkdirSync(dir,{recursive:true});
for(const name of ['compact','waterfront','courtyard'] as const){
 const plan=compositionFixture(name),r=compileArchitecturalPlan(plan),physical=physicalEvidence(r);
 if(physical.failures.length)throw Error(JSON.stringify(physical.failures));
 writeFileSync(`${dir}/${name}.json`,JSON.stringify({...r,source:'Developer-authored fixture; not AI quality evidence',physical,relationships:sceneRelationshipIssues(r.scene)},null,2));
 writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(r.scene,null,2));
 console.log(name,r.scene.elements.length,createHash('sha256').update(JSON.stringify(r.scene)).digest('hex'));
}
