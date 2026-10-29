// Offline evidence only. No model imports, requests, or runtime template registration.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {resolveSceneResult,SCENE_SYSTEM_PROMPT} from '../src/lib/villa/scene/terra';
import {applySceneOperations,type SceneElement} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {laderaScene} from '../src/lib/villa/scene/example';
const dir='docs/villa-playground/terra-basic-diagnosis';
const retained=JSON.parse(readFileSync('.data/scene-responses/0bd8551e-ebcf-4685-8ee0-5aed50e7bea6.json','utf8'));
const failed=resolveSceneResult(retained.input,retained.output).scene;
assert.deepEqual(failed.elements,retained.output.operations.map((o:any)=>o.element));
const elements:any[]=[];
function p(id:string,kind:SceneElement['kind'],at:number[],size:number[],extra:object={}){elements.push({id,label:id,kind,at,size,material:'ivory',...extra});}
// One authored courtyard estate: two staggered residential wings, tall central salon,
// receding upper levels, colonnaded loggias and a roof belvedere. Deliberately no pavilion.
function block(id:string,x:number,z:number,w:number,d:number,levels:number){
 for(let f=0;f<levels;f++){
 const y=.2+f*4.2, inset=f===2?2:0, ww=w-inset*2,dd=d-inset;
 p(`${id}-${f}-floor`,'plate',[x,y-.1,z],[ww,.2,dd],{material:'limestone'});
 // Facade bays produce real solids and openings, with independent reveals and fins.
 for(const side of [-1,1])for(let b=0;b<4;b++){
 const bw=ww/4,bx=x-ww/2+(b+.5)*bw;
 p(`${id}-${f}-${side}-${b}-wall`,'wall',[bx,y+1.9,z+side*(dd/2-.15)],[bw,3.8,.3],{material:b%2?'ivory':'limestone',opening:{x:0,sill:.15,width:bw-.65,height:3.25,glazed:true},panels:3});
 p(`${id}-${f}-${side}-${b}-fin`,'volume',[bx-bw/2+.18,y+1.9,z+side*(dd/2+.25)],[.25,3.8,.8],{material:'limestone'});
 }
 for(const s of [-1,1])p(`${id}-${f}-side-${s}`,'wall',[x+s*(ww/2-.15),y+1.9,z],[dd,3.8,.3],{rotation:Math.PI/2,material:'limestone',opening:{x:0,sill:.3,width:dd-1.4,height:3.1,glazed:true},panels:6});
 p(`${id}-${f}-roof`,'roof',[x,y+3.95,z],[ww+2,.3,dd+2]);
 }
}
block('west-residence',-14,0,14,16,3);
block('east-residence',14,3,14,14,2);
block('grand-salon',0,-3,14,12,2);
// Broad inhabited sea loggia, supported at both ends and at each bay.
p('sea-terrace','plate',[0,.1,-13],[44,.2,8],{material:'limestone'});
for(let i=0;i<9;i++)p(`colonnade-${i}`,'volume',[-21+i*5.25,2.2,-15.5],[.45,4.4,.6],{material:'limestone'});
p('loggia-canopy','roof',[0,4.45,-13],[44,.3,8],{material:'timber'});
for(let i=0;i<6;i++)p(`loggia-seat-${i}`,'sofa',[-18+i*7,.55,-13],[3.5,.7,1]);
// Entry and tall stone arrival portal.
p('entry-deck','plate',[0,.1,7],[10,.2,8],{material:'limestone'});
p('entry-door','entrance',[0,2.1,2.9],[2.8,3.8,.18],{material:'bronze'});
for(const x of [-4.5,4.5])p(`portal-${x<0?'w':'e'}`,'volume',[x,3.3,8],[.7,6.6,1],{material:'limestone'});
p('portal-beam','volume',[0,6.3,8],[9.7,.6,1],{material:'limestone'});
p('entry-canopy','roof',[0,4.45,6.8],[10,.3,8],{material:'timber'});
// Rooftop open belvedere supported by the west block roof.
p('belvedere-floor','plate',[-14,12.7,0],[10,.2,8],{material:'limestone'});
for(const x of [-18,-10])for(const z of [-3,3])p(`belvedere-post-${x+20}-${z+4}`,'volume',[x,14.3,z],[.3,3,.3],{material:'bronze'});
p('belvedere-cap','roof',[-14,15.9,0],[12,.3,10]);
// Pool perimeter is explicit and does not cover water.
p('pool','water',[0,.2,-23],[24,.02,7],{material:'sage'});
for(const z of [-27,-19])p(`coping-${z+30}`,'plate',[0,.1,z],[26,.2,1],{material:'limestone'});
for(const x of [-12.5,12.5])p(`coping-${x<0?'w':'e'}`,'plate',[x,.1,-23],[1,.2,7],{material:'limestone'});
const study=applySceneOperations({version:'architectural-scene-1',name:'Offline courtyard mansion study',elements:[]},elements.map(element=>({op:'add',element})));
function metrics(s:any){const es=s.elements;return {elements:es.length,kinds:es.reduce((a:any,e:any)=>(a[e.kind]=(a[e.kind]||0)+1,a),{}),openings:es.filter((e:any)=>e.opening).length,parents:es.filter((e:any)=>e.parent).length,nonCardinal:es.filter((e:any)=>Math.abs(Math.sin(e.rotation*2))>.001).length,height:Math.max(...es.filter((e:any)=>e.kind!=='pavilion').map((e:any)=>e.at[1]+e.size[1]/2)),compactBytes:JSON.stringify(s).length,relationshipIssues:sceneRelationshipIssues(s)};}
for(const [name,scene] of Object.entries({failed,study,ladera:laderaScene}))writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(scene,null,2));
writeFileSync(`${dir}/metrics.json`,JSON.stringify({failed:metrics(failed),study:metrics(study),ladera:metrics(laderaScene),executorExact:true,providerCalls:0},null,2));
writeFileSync(`${dir}/current-system-prompt.txt`,SCENE_SYSTEM_PROMPT);
console.log(JSON.stringify({failed:metrics(failed),study:metrics(study),ladera:metrics(laderaScene)},null,2));
