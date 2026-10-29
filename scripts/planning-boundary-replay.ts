import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveSceneResult} from '../src/lib/villa/scene/terra';
import {auditArchitecturalPlan} from '../src/lib/villa/scene/planning';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const path='.data/scene-responses/437d25b1-ff69-462c-ab34-a8deb7861c67.json';
const bytes=readFileSync(path), original=JSON.parse(bytes.toString());
const dir='docs/architecture/planning-boundary';mkdirSync(dir,{recursive:true});
const result=resolveSceneResult(original.input,original.output);
writeFileSync(`${dir}/recovered.scene.json`,JSON.stringify(result.scene,null,2));
writeFileSync(`${dir}/audit.json`,JSON.stringify({providerCalls:0,source:path,sha256:createHash('sha256').update(bytes).digest('hex'),originalError:original.error,originalAudit:auditArchitecturalPlan(result.scene,original.output.architecturalPlan),geometryIssues:sceneRelationshipIssues(result.scene),result},null,2));
console.log(JSON.stringify({elements:result.scene.elements.length,audit:result.architecturalAudit,geometryIssues:sceneRelationshipIssues(result.scene)},null,2));

assert.deepEqual(readFileSync(path),bytes,'Retained original must remain byte-identical');
