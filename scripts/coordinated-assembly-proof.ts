/** Offline developer construction proofs. Retained Terra scenes are read only. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {applySceneOperations,validateScene,type SceneOperation} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
import {focusedConstructionFindings} from '../src/lib/villa/scene/focusedConstruction';
globalThis.fetch=async()=>{throw Error('Offline: network forbidden');};
const dir='docs/architecture/coordinated-assemblies';mkdirSync(dir,{recursive:true});
const paths=['A','B'].flatMap(k=>['provider-response.raw.json','scene.UNAPPROVED.json'].map(f=>`docs/architecture/distinct-houses/${k}/${f}`));
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const retained=paths.map(path=>({path,sha256:hash(path)}));
const wing=(id:string,x:number,z:number,w:number,d:number,rotation:number,roofForm:'flat'|'hip'|'gable',height=3.4):SceneOperation=>({op:'assemble',assembly:{kind:'residential-wing',parameters:{id,at:[x,.1,z],rotation,width:w,depth:d,height,bays:3,material:roofForm==='flat'?'ivory':'limestone',roofForm,roofRise:1.4,overhang:.4,entryBay:1}}});
const studies:Record<string,SceneOperation[]>={
 tropical:[wing('salon',-10,0,16,10,0,'flat',4.2),wing('studio',11,-6,10,8,.2,'flat'),wing('guest',9,9,12,8,-.3,'flat'),{op:'assemble',assembly:{kind:'rectangular-pool',parameters:{id:'pool',at:[-9,.15,11],rotation:0,width:8,depth:4,basinDepth:1.4,material:'limestone'}}}],
 mediterranean:[wing('north',0,-12,22,8,0,'hip'),wing('west',-15,2,14,8,Math.PI/2,'gable'),wing('east',15,2,14,8,-Math.PI/2,'gable')],
};
const result:Record<string,unknown>={};
for(const [name,operations] of Object.entries(studies)){
 const scene=applySceneOperations({version:'architectural-scene-1',name:`OFFLINE DEVELOPER PROOF · ${name}`,elements:[]},operations);
 assert.deepEqual(sceneRelationshipIssues(scene),[]);assert.deepEqual(validateScene(JSON.parse(JSON.stringify(scene))),scene);
 writeFileSync(`${dir}/${name}.operations.json`,JSON.stringify(operations,null,2));writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(scene,null,2));
 result[name]={elements:scene.elements.length,roots:scene.elements.filter(e=>!e.parent).map(e=>e.id),relationshipIssues:[],focusedFindings:focusedConstructionFindings(scene)};
}
for(const p of retained)assert.equal(hash(p.path),p.sha256);
const retainedFindings=Object.fromEntries(['A','B'].map(k=>[k,focusedConstructionFindings(validateScene(JSON.parse(readFileSync(`docs/architecture/distinct-houses/${k}/scene.UNAPPROVED.json`,'utf8'))))]));
const retainedRoofEnvelopeOverlaps=Object.fromEntries(['A','B'].map(k=>{const scene=validateScene(JSON.parse(readFileSync(`docs/architecture/distinct-houses/${k}/scene.UNAPPROVED.json`,'utf8'))),g=sceneSpatialGeometry(scene),roofs=scene.elements.filter(e=>e.kind==='roof');return [k,roofs.flatMap((a,i)=>roofs.slice(i+1).flatMap(b=>g.separation(a,b)<-.001?[{ids:[a.id,b.id],planPenetrationMetres:-g.separation(a,b),note:'Plan envelope overlap; not a mesh intersection/engineering certificate'}]:[]))];}));
writeFileSync(`${dir}/verification.json`,JSON.stringify({providerCalls:0,developerAuthored:true,approved:false,retained,retainedFindings,retainedRoofEnvelopeOverlaps,studies:result,limitations:['Exterior composition proofs, not complete homes','No automatic rooms, stairs, arcades or shared junctions','No Terra quality claim; original scenes remain untouched']},null,2));
console.log('Two distinct assembly transactions verified; retained Terra scenes unchanged.');
