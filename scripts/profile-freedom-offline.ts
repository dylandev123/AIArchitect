import {mkdir,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {profileFreedomStudy,type FreedomStudy} from '../src/lib/villa/scene/profileFreedom.fixture';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {buildProfileGeometry} from '../src/lib/villa/scene/profileGeometry';
const dir='docs/architecture/profile-freedom';await mkdir(dir,{recursive:true});
for(const name of ['angular','flowing','estate'] as FreedomStudy[]){
 const start=performance.now(),study=profileFreedomStudy(name),constructionMs=performance.now()-start;
 const triangles=study.scene.elements.reduce((n,e)=>{if(!e.geometry)return n;const g=buildProfileGeometry(e.geometry,e.size),count=g.getAttribute('position').count/3;g.dispose();return n+count;},0);
 await writeFile(`${dir}/${name}.DEVELOPER.json`,JSON.stringify(study.scene,null,2));
 await writeFile(`${dir}/${name}.audit.json`,JSON.stringify({providerCalls:0,constructionMs,elements:study.scene.elements.length,profileTriangles:triangles,unsupported:study.unsupported,relationships:sceneRelationshipIssues(study.scene),review:reviewSceneArchitecture(study.scene)},null,2));
 console.log(name,{constructionMs,elements:study.scene.elements.length,triangles});
}
