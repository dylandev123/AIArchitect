import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { estateExamples } from '../src/lib/villa/estate-examples';
import { validateComposition,compositionFindings,executeCompositionPatch } from '../src/lib/villa/composition';
import { routeVertices,landscapeBounds } from '../src/lib/villa/estate-landscape';
const directory='docs/villa-playground/estate-creativity';mkdirSync(directory,{recursive:true});
const examples=estateExamples();
const checks=examples.map(c=>{
 const routes=c.estateLandscape!.routes.map(r=>{const v=routeVertices(r);assert(v.every(Number.isFinite));assert.equal(v.length%9,0);return {id:r.id,kind:r.kind,controls:r.points.length,width:r.width,triangles:v.length/9};});
 assert.deepEqual(validateComposition(c),c);
 return {id:c.id,garden:c.garden,wingRotations:c.wings.map(w=>({id:w.id,orientation:w.orientation})),routes,court:c.estateLandscape!.court??null,gardenBedCount:c.estateLandscape!.beds.length,landscapeBounds:landscapeBounds(c.estateLandscape!)};
});
const rejections:{id:string;findings:ReturnType<typeof compositionFindings>}[]=[];
function rejects(id:string,mutate:(c:typeof examples[number])=>void){const c=structuredClone(examples[0]);mutate(c);let failed=false;try{validateComposition(c);}catch(e){failed=true;rejections.push({id,findings:compositionFindings(e)});}assert(failed,id);}
rejects('fixed-boundary-not-enlarged',c=>{c.siteMode='fixed';c.garden={x:0,z:-5,width:70,depth:75};});
rejects('road-through-residence',c=>{c.estateLandscape!.routes[0].points=[{x:0,z:-25},{x:0,z:-5}];});
rejects('island-lane-too-narrow',c=>{c.estateLandscape!.court!.islandWidth=20;});
rejects('route-through-island',c=>{c.estateLandscape!.routes[0].points=[{x:-20,z:-25},{x:0,z:-25}];});
rejects('bed-over-circulation',c=>{c.estateLandscape!.beds=[{id:'bad-bed',x:0,z:-14,width:4,depth:4}];});
const fixed=executeCompositionPatch(examples[0],{garden:{x:-2,z:-15,width:100,depth:110}});assert.equal(fixed.siteMode,'fixed');assert.deepEqual(fixed.garden,{x:-2,z:-15,width:100,depth:110});
writeFileSync(`${directory}/examples.json`,JSON.stringify(examples,null,2)+'\n');
writeFileSync(`${directory}/geometry-checks.json`,JSON.stringify({providerCalls:0,checks,rejections,acceptedFixedSite:fixed.garden},null,2)+'\n');
console.log(JSON.stringify({examples:checks.map(c=>({id:c.id,garden:c.garden})),rejectedCases:rejections.length,providerCalls:0},null,2));
