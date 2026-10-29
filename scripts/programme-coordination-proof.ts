/** Offline retained replay and developer capability evidence; never calls a provider. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {stageSceneOperations,validateScene,applySceneOperations,type ArchitecturalScene} from '../src/lib/villa/scene/model';
import {sceneSpatialGeometry,occupiedRoofConflicts} from '../src/lib/villa/scene/spatial';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {resolveSceneResult,SceneConstructionError,sceneProviderOutputSchema} from '../src/lib/villa/scene/terra';
import {assemblyOperations} from '../src/lib/villa/scene/assemblies';
import {laderaScene} from '../src/lib/villa/scene/example';
import {laderaPlan} from '../src/lib/villa/scene/planning.fixture';
import {createHash} from 'node:crypto';
globalThis.fetch=async()=>{throw Error('Offline proof prohibits network');};
const source='.data/scene-responses/66c57386-4c5c-4f50-a97e-8ec0ec80588b.json';
const bytes=readFileSync(source),artifact=JSON.parse(bytes.toString()),output=artifact.output;
const empty:ArchitecturalScene={version:'architectural-scene-1',name:output.name,elements:[]};
const failed=stageSceneOperations(empty,output.operations);failed.architecturalPlan=output.architecturalPlan;
assert.equal(failed.elements.length,88);
const conflicts=occupiedRoofConflicts(failed);
assert(conflicts.some(f=>f.elementIds[0]==='salon-roof'&&f.elementIds[1]==='upper-floor'));
try{resolveSceneResult({mode:'generate',prompt:'Offline exact retained replay'},output);assert.fail('Expected rejection');}catch(e){assert(e instanceof SceneConstructionError);assert(e.message.includes('0:assemble:salon'));assert(e.message.includes('11:add:upper-floor'));assert(e.message.includes('roof')&&e.message.includes('walking Y=3.7'));assert.deepEqual(e.recoverableDraft.elements,failed.elements);}
const g=sceneSpatialGeometry(failed);
const coordinates=['salon','salon-roof','upper-floor','upper-roof','upper-landing','upper-door','stair-01','stair-10'].map(id=>{const e=g.map.get(id)!;return {id,world:g.world(e),size:e.size,bottom:g.bottom(e),top:g.top(e),operationIndexes:output.operations.flatMap((o:any,i:number)=>o.element?.id===id||o.assembly?.parameters.id===id||o.assembly?.parameters.id==='salon'&&id==='salon-roof'?[i]:[])};});
const cases=[['Playground multi-level Ladera',{...laderaScene,architecturalPlan:laderaPlan}],...[
 ['tropical','docs/architecture/knowledge-construction/caribbean.scene.json'],
 ['Mediterranean','docs/architecture/knowledge-construction/mediterranean.scene.json'],
].map(([name,path])=>[name,validateScene(JSON.parse(readFileSync(path,'utf8')))] as const)].map(([name,value])=>{const scene=value as ArchitecturalScene,original=JSON.stringify(scene);const audit=reviewSceneArchitecture(scene);assert.equal(JSON.stringify(scene),original);assert.deepEqual(validateScene(JSON.parse(original)),scene);return {name,elements:scene.elements.length,roofConflicts:occupiedRoofConflicts(scene),findings:audit.findings};});
assert(cases[0].roofConflicts.every(f=>f.category!=='confirmed-technical-defect'));
assert.doesNotThrow(()=>applySceneOperations({...laderaScene,architecturalPlan:laderaPlan},[{op:'finish',id:'bridge-roof',material:'bronze'}]));
// Explicit developer capability proof: same-plan layered roofs with supported
// assembly plus a separate high canopy. This is not a correction or Terra success.
const wing=assemblyOperations({kind:'residential-wing',parameters:{id:'study',at:[0,.1,0],width:8,depth:6,height:3,bays:2,roofForm:'flat',roofRise:.6,overhang:.4,entryBay:0}});
const posts=[-1,1].map(sign=>({op:'add' as const,element:{...failed.elements.find(e=>e.id==='entry-post-west')!,id:sign===1?'high-post-east':'high-post-west',at:[sign*3.5,3.4375,0] as [number,number,number],size:[.3,6.875,.3] as [number,number,number]}}));
const layered=applySceneOperations(empty,[...wing,...posts,{op:'add',element:{...failed.elements.find(e=>e.id==='entry-canopy')!,id:'high-canopy',at:[0,7,0],size:[9,.25,7]}}]);
assert.equal(layered.elements.filter(e=>e.kind==='roof').length,2);
layered.architecturalPlan={scaleRationale:'Developer capability study.',arrivalAndCirculation:'Ground entry at study-glass-0.',volumeHierarchy:'Single occupied study with separated high canopy.',relationshipsAndViews:'Entry faces local +Z.',roofFacadeAndMaterials:'Two vertically separated flat planes.',intendedSpaces:['Study'],programme:[{name:'Study',zone:'public',strategy:'Ground wing at slab-top datum; direct front entrance.',floorIds:['study'],enclosureIds:['study-rear','study-west','study-east','study-bay-0','study-bay-1'],roofIds:['study-roof'],accessIds:['study-glass-0'],limitation:''}],spatialRelationships:[{subject:'high-canopy',target:'study-roof',relation:'above',clearance:0,reason:'Separate high layer avoids the occupied ground enclosure.'}]};
const developerOutput={name:layered.name,summary:'Developer-authored geometry proof only',unsupported:[],architecturalPlan:layered.architecturalPlan,operations:layered.elements.map(element=>({op:'add' as const,element}))};
assert(sceneProviderOutputSchema({mode:'generate',prompt:'Offline capability proof'}).safeParse(developerOutput).success);
const allocation=reviewSceneArchitecture(resolveSceneResult({mode:'generate',prompt:'Offline capability proof'},developerOutput).scene).programme;
assert.equal(allocation.spaces[0].status,'referenced-geometry');

const audited=reviewSceneArchitecture(failed);
assert(audited.findings.some(f=>f.code==='vertical-route-missing'));
assert(audited.findings.some(f=>f.code==='stair-rise-gap'));
const out='docs/architecture/programme-coordination';mkdirSync(out,{recursive:true});
writeFileSync(`${out}/evidence.json`,JSON.stringify({providerCalls:0,source,sha256:createHash('sha256').update(bytes).digest('hex'),name:failed.name,elements:88,operations:output.operations.length,coordinates,conflicts,programme:audited.programme,findings:audited.findings,cases,developerLayeredStudy:{authorship:'developer-authored capability proof, not Terra-generated',scene:layered,programme:allocation}},null,2));
console.log(JSON.stringify({elements:88,conflicts:conflicts.map(f=>f.elementIds.slice(0,2)),cases:cases.map(c=>({name:c.name,elements:c.elements,conflicts:c.roofConflicts.length})),developerLayeredStudy:'accepted',providerCalls:0},null,2));
