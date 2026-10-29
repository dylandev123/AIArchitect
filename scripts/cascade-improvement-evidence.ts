/** Isolated offline experiment. No provider adapters and no saved-villa writes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import type {FootprintBuilding} from '../src/lib/villa/footprint';
import type {CompositionPatch} from '../src/lib/villa/composition';
import {resolveVillaResult} from '../src/lib/villa/terra';
import {changedPaths,stageReviewEdit,reviewSchema} from '../src/lib/villa/visual-review';
import {resolveStack,rectangleFromPoints,exposedRoof} from '../src/lib/villa/stacked-volumes';
const dir='docs/villa-playground/cascade-improvement';
globalThis.fetch=async()=>{throw Error('Network forbidden');};
const id='322247c40a2c1eb0b3e667280d7f9551759779cb4b753e6c925c386e99664036';
const source=`.data/villa-responses/${id}.response.json`, raw=readFileSync(source,'utf8');
assert.equal(createHash('sha256').update(raw).digest('hex'),id);
const baseline=resolveVillaResult({mode:'generate',prompt:'Offline retained Cascade replay'},JSON.parse(raw)).config;
if(!('version' in baseline))throw Error('Expected composition');
const original=JSON.stringify(baseline), steps:{improvement:string;scope:string[];output:{changes:CompositionPatch;summary:string;unsupported:string[]}}[]=[];
let current=structuredClone(baseline);
function stage(improvement:string, change:(form:FootprintBuilding)=>void){
 const form=structuredClone(current.forms![0]);change(form);
 const expected=structuredClone(current);expected.forms![0]=form;
 const scope=changedPaths(current,expected);
 reviewSchema.parse({weaknesses:['Manual visual diagnosis: repetitive glazed floor bands','Manual visual diagnosis: weak entrance scale','Manual visual diagnosis: narrow terrace strips'],improvement,scope});
 const output:{changes:CompositionPatch;summary:string;unsupported:string[]}={changes:{forms:[{type:'put',form}]},summary:improvement,unsupported:[]};
 const result=stageReviewEdit(current,improvement,output,scope);
 assert.deepEqual(result.config,expected);
 steps.push({improvement,scope,output});current=result.config as typeof current;
}
stage('Reduce floor heights to residential proportions, reduce repeated glazing, and recess the opposite base facade.',f=>{
 f.height=3.6;f.openings='rhythm';f.facades![0].treatment='loggia';
 f.stack![0].height=3.3;f.stack![1].height=3.2;f.stack![2].height=3;
});
stage('Compose a broad inhabited base, a paired middle body, and a smaller offset crown; concentrate setbacks into usable terraces.',f=>{
 Object.assign(f.stack![0],{x:-2,z:-2,width:26,depth:14});
 Object.assign(f.stack![1],{x:-6,z:-2,width:18,depth:14});
 Object.assign(f.stack![2],{x:-1,z:-2,width:12,depth:10});
});
assert.equal(JSON.stringify(baseline),original);assert.equal(readFileSync(source,'utf8'),raw);
for(const [name,config] of [['original',baseline],['revised',current]] as const)writeFileSync(`${dir}/${name}.config.json`,JSON.stringify(config,null,2)+'\n');
writeFileSync(`${dir}/original.response.json`,raw);
const changes=changedPaths(baseline,current).map(path=>{const get=(c:unknown)=>path.split('.').reduce<unknown>((v,k)=>v && typeof v==='object' ? (v as Record<string,unknown>)[k] : undefined,c);return{path,before:get(baseline),after:get(current)};});
const metrics=(c:typeof current)=>{const f=c.forms![0],base={...rectangleFromPoints(f.points),height:f.height,bottom:0,id:'base'};const levels=[base,...resolveStack(base,f.height,f.stack!)];return{height:levels.at(-1)!.bottom+levels.at(-1)!.height+.26,levels:levels.map(l=>({id:l.id,footprint:l.width*l.depth,terraceCells:exposedRoof(l,levels.filter(o=>Math.abs(o.bottom-(l.bottom+l.height+.26))<.001))}))};};
writeFileSync(`${dir}/evidence.json`,JSON.stringify({source,responseId:id,providerCalls:0,provenance:'Human-authored offline revisions; not a live Terra review or generation',baselinePreserved:true,steps,changes,metrics:{original:metrics(baseline),revised:metrics(current)}},null,2)+'\n');
console.log(JSON.stringify({providerCalls:0,steps:steps.map(s=>s.scope.length),changes:changes.length,metrics:{original:metrics(baseline).height,revised:metrics(current).height}}));
