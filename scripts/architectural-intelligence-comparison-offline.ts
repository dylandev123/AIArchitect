/** Retained outputs only: no provider, research, or repair calls. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {generationDiagnostics} from '../src/lib/villa/scene/generationDiagnostics';
import {resolveSceneResult} from '../src/lib/villa/scene/terra';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
import {reviewProgramme} from '../src/lib/villa/scene/programme';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const dir='docs/architecture/intelligence-comparison';
globalThis.fetch=async()=>{throw Error('Offline network prohibited');};
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const input=read('docs/architecture/distinct-houses/A/request.json');
const output=read('docs/architecture/distinct-houses/A/result.json');
const earlier=read('docs/architecture/distinct-houses/A/scene.UNAPPROVED.json');
const resolved=resolveSceneResult(input,output.output);
assert.deepEqual(resolved.scene.elements,earlier.elements);
const diagnostic=generationDiagnostics('historical-distinct-houses-A',input,output.output,'accepted');
writeFileSync(`${dir}/earlier.diagnostics.json`,JSON.stringify(diagnostic,null,2));
function inspect(scene:any){const g=sceneSpatialGeometry(scene);return {elements:scene.elements.length,kinds:scene.elements.reduce((a:any,e:any)=>(a[e.kind]=(a[e.kind]??0)+1,a),{}),parents:scene.elements.filter((e:any)=>e.parent).length,openings:scene.elements.filter((e:any)=>e.opening).length,programme:reviewProgramme(scene),relationships:sceneRelationshipIssues(scene),floorSurfaces:scene.elements.filter((e:any)=>e.kind==='plate').map((e:any)=>({id:e.id,size:e.size,at:e.at,areaM2:e.size[0]*e.size[2],world:g.world(e)})),components:scene.elements.map((e:any)=>({id:e.id,kind:e.kind,size:e.size,at:e.at,world:g.world(e)}))};}
const study=read('docs/villa-playground/terra-basic-diagnosis/study.scene.json');
writeFileSync(`${dir}/offline-comparison.json`,JSON.stringify({providerCalls:0,brief:input.prompt,earlier:{...inspect(earlier),usage:output.usage,finishReason:output.finishReason,executorExact:true,operationCount:output.output.operations.length},study:{...inspect(study),provenance:'Existing developer-authored primitive study. Same executor vocabulary, different authoring process; no controlled model benchmark.'},sourceHashes:['docs/architecture/distinct-houses/A/request.json','docs/architecture/distinct-houses/A/result.json','docs/architecture/distinct-houses/A/scene.UNAPPROVED.json','docs/villa-playground/terra-basic-diagnosis/study.scene.json'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))},null,2));
console.log('Offline source, executor and component comparison retained; zero provider calls.');
