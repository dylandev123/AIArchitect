import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {creativeExamples} from '../src/lib/villa/creative-examples';
import {estateExamples} from '../src/lib/villa/estate-examples';
import {buildComposition,validateComposition,compositionFindings, type VillaComposition} from '../src/lib/villa/composition';
import {resolveVillaResult,villaProviderOutputSchema} from '../src/lib/villa/terra';
import {z} from 'zod';
const dir='docs/villa-playground/expanded-limits';
const request={mode:'generate' as const,prompt:'Offline estate validation'};
const response=(changes:VillaComposition)=>({changes,summary:'Offline large estate',unsupported:[]});
const examples=estateExamples();
const enlarged=examples.map(source=>{
 const c=structuredClone(source);c.id+='-large';c.name+=' Large';
 const scale=(o:object,keys:string[])=>{for(const key of keys)if(typeof (o as Record<string,unknown>)[key]==='number')(o as Record<string,number>)[key]*=2;};
 for(const w of c.wings)scale(w,['x','z','width','depth','veranda']);
 for(const g of c.connections)scale(g,['width']);
 for(const t of c.terraces)scale(t,['x','z','width','depth']);
 if(c.pool)scale(c.pool,['x','z','width','depth']);
 for(const r of c.estateLandscape!.routes){scale(r,['width']);for(const p of r.points)scale(p,['x','z']);}
 if(c.estateLandscape?.court)scale(c.estateLandscape.court,['x','z','width','depth','islandWidth','islandDepth']);
 for(const b of c.estateLandscape!.beds)scale(b,['x','z','width','depth']);
 c.landscapeMargin=30;
 return validateComposition(c);
});
const extremes=['modern','caribbean','spanish','tuscan'].map((style,index)=>{
 const c=structuredClone(examples[1]);c.id=`large-${style}`;c.name=`Large ${style} estate`;
 c.appearance.style=style as VillaComposition['appearance']['style'];c.appearance.roof=index===0?'flat':index===1?'hip':'gable';
 c.wings=Array.from({length:index===0?16:3},(_,i)=>({...c.wings[0],id:`wing-${i}`,role:i===0?'main':'guest',parentId:i===0?null:'wing-0',detached:i!==0,x:(i%4)*85-128,z:Math.floor(i/4)*85-128,width:index===0?32:64,depth:index===0?16:64,storeys:index===0?1:2,storeyHeight:4.5,veranda:6,balcony:index===0?0:2.4,orientation:0} as VillaComposition['wings'][number]));
 c.connections=[];c.terraces=[{id:'large-deck',kind:'terrace',x:0,z:270,width:512,depth:40,timber:true}];
 c.pool={x:0,z:220,width:64,depth:24};
 c.components=Array.from({length:8},(_,i)=>({id:`pavilion-${i}`,builder:'curved-pavilion@1',x:-140+i*40,z:180,orientation:0,width:20,depth:16,height:6,material:'ivory'}));
 c.estateLandscape={builder:'estate-landscape@1',routes:[{id:'wide-walk',kind:'walk',width:6,points:[{x:-250,z:100},{x:-250,z:200}],planting:'border'},{id:'wide-drive',kind:'drive',width:12,points:[{x:-250,z:-250},{x:250,z:-250}],planting:'avenue'}],beds:[{id:'large-parterre',x:0,z:330,width:64,depth:64}]};
 c.landscapeMargin=60;return validateComposition(c);
});
const gallery=structuredClone(extremes[1]);gallery.id='large-gallery';
gallery.wings=gallery.wings.slice(0,2).map((w,i)=>({...w,id:i?'guest':'main',role:i?'guest':'main',parentId:i?'main':null,detached:false,x:0,z:i?-20:-100,depth:16,veranda:0}));
gallery.connections=[{id:'long-gallery',from:'main',to:'guest',width:10}];
validateComposition(gallery);
const grounds=structuredClone(extremes[1]);grounds.id='large-fixed-grounds';grounds.siteMode='fixed';grounds.garden={x:0,z:0,width:2048,depth:2048};
grounds.estateLandscape={builder:'estate-landscape@1',court:{id:'grand-court',x:0,z:-340,width:56,depth:56,island:'fountain',islandWidth:24,islandDepth:24},routes:[{id:'grand-drive',kind:'drive',width:12,points:[{x:0,z:-500},{x:0,z:-368}],planting:'avenue'}],beds:[-400,-240,240,400].flatMap((x,i)=>[-400,-240,-80,80,240,400].map((z,j)=>({id:`bed-${i}-${j}`,x,z,width:64,depth:64})))};
validateComposition(grounds);
const configurations=[...enlarged,...extremes,gallery,grounds,examples[1],creativeExamples()[0]];
for(const c of configurations){assert(villaProviderOutputSchema(request).safeParse(response(c)).success);assert.deepEqual(resolveVillaResult(request,response(c)).config,c);buildComposition(c);}
assert.doesNotThrow(()=>z.toJSONSchema(villaProviderOutputSchema(request)));
const rejected=[];
for(const mutate of [(c:VillaComposition)=>{c.siteMode='fixed';c.garden={x:0,z:0,width:12,depth:12};},(c:VillaComposition)=>{c.appearance.roof='hip';c.appearance.style='modern';},(c:VillaComposition)=>{c.wings[0].width=65;},(c:VillaComposition)=>{c.estateLandscape!.beds[0].x=-250;c.estateLandscape!.beds[0].z=120;}]){
 const c=structuredClone(extremes[0]);mutate(c);let findings:ReturnType<typeof compositionFindings>=[];try{validateComposition(c);}catch(e){findings=compositionFindings(e);}assert(findings?.length);rejected.push(findings);
}
const rawPath='.data/villa-responses/b5d43a156cd743f02daa2a4b837a06a44172b56d502b296f50523eb16f02c7e9.response.json';
const raw=readFileSync(rawPath,'utf8');writeFileSync(`${dir}/original.response.json`,raw);let recovery;
try{resolveVillaResult(request,JSON.parse(raw));recovery={accepted:true};}catch(e){recovery={accepted:false,findings:compositionFindings(e)};}
writeFileSync(`${dir}/examples.json`,JSON.stringify(configurations,null,2)+'\n');
writeFileSync(`${dir}/geometry-checks.json`,JSON.stringify({providerCalls:0,configurations:configurations.map(c=>({id:c.id,wings:c.wings.length,garden:c.garden})),rejected,recovery},null,2)+'\n');
console.log({providerCalls:0,configurations:configurations.length,recovery});
