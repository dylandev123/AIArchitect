/** Read-only retained-input replay. No DB, credentials, retrieval refresh, or provider. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {stageSceneOperations} from '../src/lib/villa/scene/model';
import {generationDiagnostics} from '../src/lib/villa/scene/generationDiagnostics';
globalThis.fetch=async()=>{throw Error('Offline diagnostics: all network forbidden');};
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const destination='docs/architecture/generation-diagnostics';mkdirSync(destination,{recursive:true});
const sources=[
 {id:'basic-bungalow',artifact:'.data/scene-responses/0bd8551e-ebcf-4685-8ee0-5aed50e7bea6.json',screens:'docs/villa-playground/terra-basic-diagnosis'},
 {id:'coordinated-tropical',artifact:'docs/architecture/coordinated-assembly-live/retained-response.json',screens:'docs/architecture/coordinated-assembly-live'},
 {id:'mediterranean',result:'docs/architecture/distinct-houses/B/result.json',request:'docs/architecture/distinct-houses/B/request.json',screens:'docs/architecture/distinct-houses'},
 {id:'redesign-failed',result:'docs/villa-playground/redesign-live/concept-only.NOT-CONSTRUCTED.json',request:'docs/villa-playground/redesign-live/request.json',screens:'docs/villa-playground/redesign-live'},
 {id:'redesign-success',result:'docs/villa-playground/redesign-strict-live/response.json',request:'docs/villa-playground/redesign-strict-live/request.json',screens:'docs/villa-playground/redesign-strict-live'},
];
const summaries=[];
for(const source of sources){
 const path=source.artifact??source.result!;const original=readFileSync(path);const hash=createHash('sha256').update(original).digest('hex');const retained=read(path);
 const input=source.request?read(source.request):retained.input;
 const report=generationDiagnostics(retained.responseId??source.id,input,(source.id==='redesign-failed'?retained:retained.output));
 console.log(source.id,report.outcome,report.executionError);
 if(source.id==='basic-bungalow')assert.deepEqual(stageSceneOperations({version:'architectural-scene-1',name:retained.output.name,elements:[]},retained.output.operations).elements,retained.output.operations.map((o:{element:unknown})=>o.element));
 assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash);
 const evidence={source:path,sha256:hash,providerCalls:0,originalBriefAvailable:input.prompt!=='[REDACTED]',historicalKnowledge:retained.knowledge??null,historicalSystemAvailable:!!retained.requestSystem,usage:retained.usage??retained.knowledge?.providerUsage??null,renderedScreenshots:readdirSync(source.screens).filter(p=>/\.(png|jpg)$/.test(p)).map(p=>`${source.screens}/${p}`),report};
 writeFileSync(`${destination}/${source.id}.json`,JSON.stringify(evidence,null,2));
 summaries.push({id:source.id,name:retained.output?.name,outcome:report.outcome,operations:report.operations?.length,elements:report.components?.length,errors:report.executionError,originalBriefAvailable:evidence.originalBriefAvailable,screenshots:evidence.renderedScreenshots.length});
}
writeFileSync(`${destination}/index.json`,JSON.stringify({providerCalls:0,summaries},null,2));console.log(JSON.stringify(summaries,null,2));
