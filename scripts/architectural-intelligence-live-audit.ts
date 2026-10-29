/** Audit the single retained response locally; never calls any provider or repairs geometry. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stageSceneOperations} from '../src/lib/villa/scene/model';
import {resolveSceneResult} from '../src/lib/villa/scene/terra';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
import {reviewProgramme} from '../src/lib/villa/scene/programme';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const dir='docs/architecture/intelligence-comparison';
const read=(p:string)=>JSON.parse(readFileSync(`${dir}/${p}`,'utf8'));
const save=(p:string,v:unknown)=>writeFileSync(`${dir}/${p}`,JSON.stringify(v,null,2));
globalThis.fetch=async()=>{throw Error('Offline: no additional provider calls');};
const retained=read('retained.json'),result=read('route-response.json'),wire=read('provider-request.exact.json'),provider=read('provider-response.exact.json'),diagnostic=read('retained.diagnostics.json');
assert.equal(read('call-result.json').providerCalls,1);
assert.equal(wire.text.format.strict,true);
const output=retained.output??provider.output?.find((o:any)=>o.type==='message')?.content?.find((c:any)=>c.type==='output_text')?.text;
const scene=result.scene??result.recoverableDraft;
let replayExact=false;let stagedExact=false;
if(scene){const staged=stageSceneOperations({version:'architectural-scene-1',name:retained.output.name,elements:[]},retained.output.operations.filter((o:any)=>o.op!=='set-terrain'));assert.deepEqual(staged.elements,scene.elements);stagedExact=true;}
if(result.scene){const replay=resolveSceneResult(retained.input,retained.output);assert.deepEqual(replay.scene.elements,result.scene.elements);replayExact=true;}
const programme=scene?reviewProgramme(scene):null;
const g=scene?sceneSpatialGeometry(scene):null;
const operationIndexes=(id:string)=>{const ids=[id];let e=scene?.elements.find((e:any)=>e.id===id);while(e?.parent&&!ids.includes(e.parent)){ids.push(e.parent);e=scene.elements.find((n:any)=>n.id===e.parent);}return diagnostic.diagnostics?.operations?.filter((o:any)=>o.changes?.some((c:any)=>ids.includes(c.id))).map((o:any)=>o.index)??[];};
const mappings=programme?.spaces.map(s=>({...s,elements:[...new Set([...s.floorIds,...s.enclosureIds,...s.roofIds,...s.accessIds])].map(id=>{const e=scene.elements.find((e:any)=>e.id===id);return {id,element:e??null,world:e?g!.world(e):null,operationIndexes:operationIndexes(id)};})}))??[];
const audit={providerCalls:1,routeResponseId:result.responseId,providerResponseId:provider.id,providerStatus:provider.status,http:read('provider-http.json'),model:wire.model,usage:provider.usage,strict:wire.text.format.strict,maxOutputTokens:wire.max_output_tokens,routeStatus:retained.status,sceneDisposition:result.scene?'constructed-unapproved':result.recoverableDraft?'rejected-diagnostic-draft-only':'not-constructed',replayExact,stagedExact,programme,mappings,intent:retained.output?.architecturalPlan??null,knowledge:retained.knowledge,operationCounts:retained.output?.operations?.reduce((a:any,o:any)=>(a[o.op]=(a[o.op]??0)+1,a),{}),elements:scene?.elements.length,kinds:scene?.elements.reduce((a:any,e:any)=>(a[e.kind]=(a[e.kind]??0)+1,a),{}),parents:scene?.elements.filter((e:any)=>e.parent).length,relationshipIssues:scene?sceneRelationshipIssues(scene):null,architecturalAudit:scene?reviewSceneArchitecture(scene):null,components:scene?.elements.map((e:any)=>({element:e,world:g!.world(e),operationIndexes:operationIndexes(e.id)})),evidenceHashes:['request.json','provider-request.exact.json','provider-response.exact.json','retained.json'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(`${dir}/${path}`)).digest('hex')}))};
save('live-audit.json',audit);
const lines=['# Live programme-to-element evidence','',`Route response: ${result.responseId}; provider: ${provider.id}; disposition: ${audit.sceneDisposition}.`,'','References are commitments, not certifications of complete rooms. Dimensions and coordinates are metres.',''];
for(const s of mappings){lines.push(`## ${s.name}`,`Zone: ${s.zone}; strategy: ${s.strategy}`,'',`Status: ${s.status}; floor surface: ${s.floorSurfaceM2} m²; issues: ${s.issues.join('; ')||'No automatic reference warnings; completeness unverified.'}`,'','| Role | ID | Kind | Size X/Y/Z | World X/Y/Z/yaw | Operation indexes |','|---|---|---|---|---|---|');for(const e of s.elements){const roles=[['floor',s.floorIds],['enclosure',s.enclosureIds],['roof',s.roofIds],['access',s.accessIds]].filter(([,ids])=>(ids as string[]).includes(e.id)).map(([role])=>role);lines.push(`| ${roles.join(', ')} | ${e.id} | ${e.element?.kind??'MISSING'} | ${JSON.stringify(e.element?.size??null)} | ${JSON.stringify(e.world)} | ${e.operationIndexes.join(', ')} |`);}lines.push('');}
if(!mappings.length)lines.push('Programme omitted or no constructed scene; narrative is not a room-construction mapping. See exact retained output and diagnostics.');
writeFileSync(`${dir}/LIVE-PROGRAMME-MAPPING.md`,lines.join('\n'));
console.log(JSON.stringify({routeResponseId:result.responseId,providerResponseId:provider.id,disposition:audit.sceneDisposition,elements:audit.elements,programme:programme?.status,programmeSpaces:mappings.length,replayExact,usage:provider.usage}));
