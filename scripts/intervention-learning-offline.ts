/** Retained responses and existing developer fixture only; no provider or DB access. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stageGenerationRefinement, generationReviewSchema, demonstratesArchitecturalImprovement} from '../src/lib/villa/scene/generationReview';
import {structuralRefinementMock} from '../src/lib/villa/scene/structuralRefinement.fixture';
globalThis.fetch=async()=>{throw Error('Offline network prohibited');};
const source='docs/architecture/full-house-investigation/network-verified-intelligence', dest=process.env.INTERVENTION_EVIDENCE_DIR ?? 'docs/architecture/intervention-learning';
const read=(file:string)=>JSON.parse(readFileSync(`${source}/${file}`,'utf8'));
const hashes=()=>Object.fromEntries(readdirSync(source,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const path=`${e.parentPath}/${e.name}`;return [path,createHash('sha256').update(readFileSync(path)).digest('hex')];}));
const originalHashes=hashes();
const before=read('review.input.json').current, review=read('review.result.json').output;
const raw=read('refine.provider-response.txt');
const output=JSON.parse(raw.output.flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]).filter((o:{type:string})=>o.type==='output_text').map((o:{text:string})=>o.text).join(''));
assert.deepEqual(output,read('refine.result.json').output);
const replay=stageGenerationRefinement(before,review,output);assert.deepEqual(replay.scene,read('refined.scene.json'));
const fixtures=[{scene:before,review,output},structuralRefinementMock()];
const results=fixtures.map((c,index)=>{
 const r=generationReviewSchema.parse(c.review), f=r.refinement!;
 f.bundle={objective:'OFFLINE contract fixture: coordinated architectural hierarchy',views:['Arrival','Aerial'],successEvidence:'Require matching rendered evidence of hierarchy and entrance coherence.',objects:[...f.targetIds.map(id=>({id,action:(c.output.operations.some((o:{op:string;id?:string})=>o.id===id&&o.op==='remove')?'remove':c.output.operations.some((o:{op:string;id?:string})=>o.id===id&&o.op==='replace')?'replace':'modify') as 'remove'|'replace'|'modify',reason:'Declared affected identity'})),...(f.newIds??[]).map(id=>({id,action:'add' as const,reason:'Declared connected addition'}))],dependencies:[]};
 const staged=stageGenerationRefinement(c.scene,r,c.output);
 writeFileSync(`${dest}/${index===0?'retained-terra':'developer-gabled-fixture'}.scene.json`,JSON.stringify(staged.scene,null,2),{flag:'wx'});
 return {source:index===0?'Exact recorded Terra geometry; developer contract annotation':'Existing developer gabled/hip entrance fixture; no AI output',elements:staged.scene.elements.length,bundleEvidence:staged.bundleEvidence,technicalValidity:'passed',noticeability:index===0?'Human review: discernible in retained matching renders':'Not evaluated as architectural evidence',architecturalSignificance:'Not demonstrated',legacyPreferenceCannotPromote:!demonstratesArchitecturalImprovement(r,{verdict:'prefer revised',reason:'Technical acceptance alone',regressions:[]}),diff:staged.diff};
});
assert.deepEqual(hashes(),originalHashes);
writeFileSync(`${dest}/replay.json`,JSON.stringify({providerCalls:0,databaseAccess:false,originalHashes,originalEvidenceUnchanged:true,results},null,2),{flag:'wx'});
console.log('Two compositions replayed through normal atomic staging; original evidence unchanged; zero provider calls.');
