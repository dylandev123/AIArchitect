/** Offline evidence only. No provider imports/calls, no project writes, no templates. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { stageSceneOperations, validateScene, elementSchema, type ArchitecturalScene } from '../src/lib/villa/scene/model';
import { sceneSpatialGeometry, waterObstructions } from '../src/lib/villa/scene/spatial';
import { sceneRelationshipIssues } from '../src/lib/villa/scene/relationships';
import { reviewSceneArchitecture } from '../src/lib/villa/scene/planning';
import { resolveSceneResult, SCENE_SYSTEM_PROMPT } from '../src/lib/villa/scene/terra';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS } from '../src/lib/library/architecture/seeds';
import { retrieveArchitecturalKnowledge } from '../src/lib/library/architecture/retrieval';
globalThis.fetch=async()=>{throw Error('Offline audit prohibits network');};
const dir='docs/architecture/spatial-root-cause';mkdirSync(dir,{recursive:true});
const retained=['eb6a91b2-dc5d-497b-9296-8fa53f612978','7702f28d-6098-4bf4-b08a-b12fc68ae93b'].map(responseId=>{
 const path=`.data/scene-responses/${responseId}.json`,bytes=readFileSync(path),a=JSON.parse(bytes.toString());
 const scene=stageSceneOperations({version:'architectural-scene-1',name:a.output.name,elements:[]},a.output.operations);
 scene.architecturalPlan=a.output.architecturalPlan;
 const exact=a.output.operations.every((op:any,i:number)=>op.op==='add'&&JSON.stringify(elementSchema.parse(op.element))===JSON.stringify(scene.elements[i]));assert(exact);
 const g=sceneSpatialGeometry(scene);
 const coordinates=scene.elements.map(e=>{const p=g.world(e),c=Math.cos(p[3]),s=Math.sin(p[3]),dx=(Math.abs(c)*e.size[0]+Math.abs(s)*e.size[2])/2,dz=(Math.abs(s)*e.size[0]+Math.abs(c)*e.size[2])/2;return {id:e.id,kind:e.kind,operationIndexes:a.output.operations.flatMap((o:any,i:number)=>(o.element?.id??o.id)===e.id?[i]:[]),parent:e.parent,world:p,size:e.size,nominalBounds:{x:[p[0]-dx,p[0]+dx],y:[p[1]-e.size[1]/2,p[1]+e.size[1]/2],z:[p[2]-dz,p[2]+dz]},boundsLimitations:e.kind==='pavilion'?'Floor-origin elliptical component: floor extends .25 m, roof .65 m beyond shell; Y is floor datum, not box centre.':e.kind==='sofa'?'Renderer uses width with fixed height/depth and floor-origin furniture details; nominal box is not actual mesh bounds.':e.kind==='roof'?'Flat roof includes additional soffit and (ivory) cap; pitched roof uses builder extents.':undefined};});
 writeFileSync(`${dir}/${responseId}.scene.json`,JSON.stringify(scene,null,2));
 return {responseId,path,sha256:createHash('sha256').update(bytes).digest('hex'),name:scene.name,status:a.status,originalBrief:a.input.prompt,historicalSystemRetained:!!a.requestSystem,knowledge:a.knowledge?.selected,knowledgeMetrics:a.knowledge?.metrics,plan:a.output.architecturalPlan,usage:a.knowledge?.providerUsage,executorPreservesEveryElement:exact,coordinates,waterObstructions:waterObstructions(scene).map(({water,solid})=>[water.id,solid.id]),relationshipIssues:sceneRelationshipIssues(scene),audit:reviewSceneArchitecture(scene)};
});
const cases=[
 ['compact','$250k compact modern family home','docs/architecture/knowledge-construction/compact.scene.json'],
 ['mediterranean','$1m Mediterranean courtyard villa','docs/architecture/knowledge-construction/mediterranean.scene.json'],
 ['tropical','$5m contemporary tropical residence','docs/architecture/knowledge-construction/caribbean.scene.json'],
 ['mansion','$25m Caribbean waterfront mansion','docs/villa-playground/terra-basic-diagnosis/study.scene.json'],
];
const fixtures=cases.map(([id,brief,path])=>{
 const s=validateScene(JSON.parse(readFileSync(path,'utf8'))),k=retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,brief);
 const output={name:s.name,summary:'Existing developer-authored offline fixture; not model quality evidence.',unsupported:[],architecturalPlan:s.architecturalPlan,operations:s.elements.map(element=>({op:'add' as const,element}))};
 const result=resolveSceneResult({mode:'generate',prompt:brief},output,k.evidence);assert.deepEqual(result.scene.elements,s.elements);
 return {id,brief,path,authorship:'developer-authored existing study',elements:s.elements.length,knowledgeIds:k.selected.map(e=>e.id),propertyValue:k.project.propertyValue,geometryPreserved:true,signature:JSON.stringify(s.elements.map(e=>[e.kind,e.at,e.size,e.rotation])),findings:result.architecturalAudit.findings};
});
assert.equal(new Set(fixtures.map(f=>f.signature)).size,4);
writeFileSync(`${dir}/evidence.json`,JSON.stringify({providerCalls:0,systemChars:SCENE_SYSTEM_PROMPT.length,retained,fixtures:fixtures.map(({signature,...f})=>f),limitations:['Original briefs are redacted; the $25m artifact does not retain requestSystem. The newer $10m artifact does retain its exact system. The original saved browser project has not been recovered.','Four studies prove transport/geometry differences, not four successful autonomous model generations. API handler tests separately exercise these four briefs with mocked provider transport.']},null,2));
console.log(JSON.stringify({providerCalls:0,retained:retained.map(r=>({id:r.responseId,name:r.name,exact:r.executorPreservesEveryElement,water:r.waterObstructions,findings:r.audit.findings.map(f=>({code:f.code,ids:f.elementIds}))})),fixtures:fixtures.map(f=>({id:f.id,elements:f.elements,knowledge:f.knowledgeIds}))},null,2));
