/** Offline artifact review. No provider or database imports. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateScene,applySceneOperations,type SceneOperation} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
const source='docs/villa-playground/redesign-strict-live/after.UNAPPROVED.json';
const original='docs/villa-playground/25m-mansion-recovery/original.scene.json';
const dir='docs/villa-playground/redesign-technical-review';mkdirSync(dir,{recursive:true});
const raw=readFileSync(source),before=validateScene(JSON.parse(raw.toString()));
const operations:SceneOperation[]=['gallery-salon-door','salon-guest-door','salon-dining-door'].map(id=>{
 const e=before.elements.find(e=>e.id===id)!,host=before.elements.find(h=>h.id===e.parent)!,o=host.opening!;
 assert.equal(e.rotation,0);assert.equal(e.size[0],o.width);assert.equal(e.size[1],o.height);
 return {op:'move',id,at:[o.x,-host.size[1]/2+o.sill+o.height/2,e.at[2]]};
});
const repaired=applySceneOperations(before,operations);
assert.equal(repaired.elements.length,57);
assert.deepEqual(sceneRelationshipIssues(repaired),[]);
for(const e of before.elements) if(!operations.some(o=>'id' in o&&o.id===e.id))assert.deepEqual(repaired.elements.find(r=>r.id===e.id),e);
assert.deepEqual(readFileSync(source),raw);
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}.json`,JSON.stringify(value,null,2));
save('repair.operations',operations);save('repaired.UNAPPROVED',repaired);
save('audit',{providerCalls:0,source,sourceSha256:createHash('sha256').update(raw).digest('hex'),originalSha256:createHash('sha256').update(readFileSync(original)).digest('hex'),changedIds:operations.map(o=>'id' in o?o.id:''),beforeRelationships:sceneRelationshipIssues(before),afterRelationships:sceneRelationshipIssues(repaired),beforeArchitecture:reviewSceneArchitecture(before),afterArchitecture:reviewSceneArchitecture(repaired)});
const scenes=[validateScene(JSON.parse(readFileSync(original,'utf8'))),before,repaired];
save('preserved-versions.UNAPPROVED',{approval:'UNAPPROVED',project:{id:'terra-technical-review',name:before.name,projectType:'house',generationMode:'direct-scene',createdAt:Date.now(),updatedAt:Date.now(),houseConfigJson:JSON.stringify(repaired),currentVersionIndex:2,versions:scenes.map((s,i)=>({id:['original','terra-100-operations','deterministic-door-repair'][i],createdAt:Date.now(),summary:['Original retained mansion','Terra output — UNAPPROVED','Three door centre corrections — UNAPPROVED'][i],houseConfigJson:JSON.stringify(s)}))}});
console.log('Three door moves; 57 elements preserved; zero relationship defects; architectural review incomplete; zero provider calls.');
