/** Deterministic, offline edits to the exact retained live response. Never calls a provider. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolveSceneResult} from '../src/lib/villa/scene/terra';
import {applySceneOperations,validateScene,type SceneElement} from '../src/lib/villa/scene/model';
const dir='docs/villa-playground/flat-main-house';mkdirSync(dir,{recursive:true});
const retained=JSON.parse(readFileSync('.data/scene-responses/0e79fe9c-8e2e-4b6c-a11e-22b1dd146ae2.json','utf8'));
// Apply the source as an edit so the new-generation policy cannot erase its original terrain.
const original=resolveSceneResult({mode:'edit',prompt:'Offline exact replay',current:{version:'architectural-scene-1',name:retained.output.name,elements:[]}},retained.output).scene;
writeFileSync(`${dir}/original.scene.json`,JSON.stringify(original,null,2));
let elements=original.elements.map(e=>({...e,at:[e.at[0],e.at[1]-8,e.at[2]] as [number,number,number]}));
const by=(id:string)=>elements.find(e=>e.id===id)!;
for(const e of elements){
 if(e.kind==='plate') e.at[1]=.1,e.size=[e.size[0],.2,e.size[2]];
 if(e.kind==='wall'||e.kind==='glazing'||e.kind==='entrance'||e.kind==='screen') e.at[1]=.2+e.size[1]/2;
 if(e.kind==='glazing'||e.kind==='screen') if(e.size[2]>e.size[0]){e.size=[e.size[2],e.size[1],e.size[0]];e.rotation=Math.PI/2;}
}
const plinth=by('arrival-plinth');plinth.at=[0,.1,1];plinth.size=[36,.2,14];
by('main-terrace').size=[36,.2,15];
for(const id of ['salon-roof','west-wing-roof','east-wing-roof']){const e=by(id);e.at[1]=(id==='salon-roof'?5:4.7)+e.size[1]/2;}
by('entry-canopy').at[1]=4.55;
by('infinity-water').at[1]=.16;
// Pool surface needs an actual opening in the surrounding deck.
elements=elements.filter(e=>e.id!=='pool-deck');
const add=(id:string,kind:SceneElement['kind'],at:number[],size:number[],material:SceneElement['material']='limestone',extra={})=>elements.push({id,label:id,kind,at:at as [number,number,number],size:size as [number,number,number],rotation:0,material,panels:6,...extra});
add('pool-coping-west','plate',[-12.5,.1,-14],[3,.2,8]);add('pool-coping-east','plate',[12.5,.1,-14],[3,.2,8]);add('pool-coping-rear','plate',[0,.1,-17.65],[22,.2,2]);add('pool-coping-house','plate',[0,.1,-10.6],[22,.2,1.5]);
for(const side of ['west','east']){
 const e=by(`${side}-wing-end-wall`);e.size=[11.5,4.5,.5];e.rotation=Math.PI/2;e.opening={x:0,sill:.7,width:7.8,height:3.2,glazed:true};
 by(`${side}-wing-back-wall`).opening={x:0,sill:.7,width:6.6,height:3.1,glazed:true};
 by(`${side}-balustrade`).at[1]=.8;
 by(`${side==='west'?'west-master':'east-suite'}-terrace`).at[1]=.8;
}
by('salon-rear-wall').opening={x:0,sill:0,width:6,height:4.4,glazed:true};
by('ocean-balustrade').at[1]=.825;
// Connect arrival vestibule to salon, frame entry, deepen the ocean loggia.
add('entry-gallery-roof','roof',[0,4.6,7.2],[8,.25,7],'ivory');
for(const x of [-3.7,3.7])add(`entry-gallery-${x<0?'west':'east'}`,'glazing',[x,2.3,7.1],[5,4.2,.12],'bronze',{rotation:Math.PI/2});
add('ocean-loggia-roof','roof',[0,4.65,-6.8],[35.8,.25,4.8],'ivory');
for(const [i,x] of [-17,-8,8,17].entries())add(`loggia-pier-${i}`,'wall',[x,2.35,-8.4],[.3,4.3,.3]);
// Move the optional lounge to a connected lateral outdoor room; no extra landscaping.
by('ocean-pavilion').at=[24,.2,-5];by('pavilion-platform').at=[24,.1,-5];by('pavilion-platform').size=[14,.2,11];by('pavilion-bridge').at=[18,.1,-5];by('pavilion-bridge').size=[5,.2,3.2];
const corrected=validateScene({version:original.version,name:original.name,elements});
writeFileSync(`${dir}/corrected.scene.json`,JSON.stringify(corrected,null,2));
const edited=applySceneOperations(corrected,[{op:'move',id:'grand-entry',at:[0,2.3,10.15]}]);
if(JSON.stringify(edited.elements.filter(e=>e.id!=='grand-entry'))!==JSON.stringify(corrected.elements.filter(e=>e.id!=='grand-entry')))throw Error('Unrelated edits');
console.log({original:original.elements.length,corrected:corrected.elements.length,providerCalls:0});
