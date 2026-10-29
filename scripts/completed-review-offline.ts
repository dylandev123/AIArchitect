/** Offline interpretation of retained Terra prose. No provider or learning imports. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {executeCompositionPatch,buildComposition} from '../src/lib/villa/composition';
import {changedPaths,assertReviewScope} from '../src/lib/villa/visual-review';
globalThis.fetch=async()=>{throw Error('Network forbidden');};
const dir='docs/villa-playground/completed-review',source='docs/villa-playground/reference-review/original.config.json';
const raw=readFileSync(source,'utf8'),before=JSON.parse(raw);
const window=(id:string,offset:number,width:number,sill=.85,height=1.8)=>({id,offset,width,sill,height,kind:'window' as const,frame:'timber' as const});
// Dimensions are human-authored estimates interpreting Terra's proposal.
// Retain a legible entrance on the rear elevation; hidden geometry is unverified.
const facadeOpenings=[
 {face:'front' as const,level:0,openings:[window('front-west',2.4,2),window('front-center',10,2.6),window('front-east',18.6,1.8)]},
 {face:'rear' as const,level:0,openings:[window('rear-west',3.1,1.8),{id:'retained-entry-intent',offset:10.8,width:1.4,sill:0,height:2.5,kind:'door' as const,frame:'timber' as const},window('rear-east',18,2.2)]},
 {face:'right' as const,level:0,openings:[window('visible-end',3.8,2.4,.55,2.25)]},
];
const after=executeCompositionPatch(before,{wings:[{type:'adjust',id:before.wings[0].id,changes:{facadeOpenings}}]});
buildComposition(after);
const changes=changedPaths(before,after);assert(changes.every(p=>p.startsWith('wings.0.facadeOpenings.')));
assert.equal(readFileSync(source,'utf8'),raw);
const review=JSON.parse(readFileSync(`${dir}/review-response.json`,'utf8')).review;
let scopeError='';try{assertReviewScope(before,after,review.scope);}catch(e){scopeError=(e as Error).message;}
assertReviewScope(before,after,changes);
const preserved=JSON.parse(readFileSync('docs/villa-playground/reference-review/preserved-sha256.json','utf8'));for(const [p,h] of Object.entries(preserved))assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),h);
for(const [name,value] of [['original.config',before],['revised.config',after]])writeFileSync(`${dir}/${name}.json`,JSON.stringify(value,null,2));
writeFileSync(`${dir}/verification.json`,JSON.stringify({providerCalls:0,approved:false,learning:false,sourceSha256:createHash('sha256').update(raw).digest('hex'),preservedSourceHashes:true,changes,automatedScopeAccepted:!scopeError,scopeError,provenance:'Terra prose interpreted manually offline; exact opening dimensions and hidden elevation arrangement are not model output',unchangedOppositeEnd:'left facade retains procedural glazing'},null,2));
console.log('Offline facade candidate valid; original hashes preserved; automatic scope issue:',scopeError);
