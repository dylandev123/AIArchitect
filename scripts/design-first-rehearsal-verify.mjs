import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='docs/architecture/design-first/rehearsal-2026-10-30';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const results=[];
for(const [name,count,accepted] of [['pass',2,true],['reject',1,false],['provider-failure',1,false],['construction-failure',2,false]]){
 const dir=`${root}/${name}-final-network`, result=read(`${dir}/result.json`), assertions=read(`${dir}/rehearsal-assertions.json`);
 assert.equal(assertions.passed,true);assert.equal(result.paidCalls,0);assert.equal(result.mockProviderRequests,count);assert.equal(assertions.accepted,accepted);
 assert.equal(read(`${dir}/database-read-only.json`).transactionReadOnly,'on');
 assert(Object.values(read(`${dir}/cleanup.json`)).every(Boolean));
 assert.equal(read(`${dir}/preservation.json`).previousEvidenceUnchanged,true);
 assert.deepEqual(read(`${dir}/request.json`),read('docs/architecture/design-first/live-2026-10-30/request.json'));
 assert.equal(read(`${dir}/request.json`).prompt,read('docs/architecture/design-first/experiment.request.json').prompt.trim());
 assert(result.dbEvents.some(e=>e.completed==='callback'&&e.rows===128));
 if(name==='reject')assert.match(result.error,/architectural checkpoint/);
 if(name.includes('failure'))assert.match(result.error,/Deliberate offline provider failure/);
 results.push({name,mockRequests:count,paidCalls:0,status:result.status,accepted,realDatabaseReadOnly:true});
}
const dir=`${root}/pass-final-network`, response=read(`${dir}/route-response.json`), browser=read(`${dir}/browser-result.json`);
assert.equal(response.designFidelity.status,'matched-anchors');assert.equal(response.scene.elements.length,78);assert.equal(response.operations.length,23);
assert.equal(browser.captures.length,4);assert.deepEqual(browser.errors,[]);
for(const capture of browser.captures){assert.equal(capture.contextLost,false);assert.equal(capture.elements.length,78);}
const historicalSource=read('docs/architecture/design-first/live-2026-10-30/source-hashes.json');
const sourceChanges=Object.entries(historicalSource).filter(([p,d])=>p.startsWith('src/')&&hash(p)!==d).map(([p])=>p);
assert.deepEqual(sourceChanges,[]);
const retained=read(`${dir}/retained.json`);
assert(retained.knowledge);assert(retained.proposal);assert(retained.planningEvidence);assert(retained.requestSystem);
const report={results,sceneElements:78,editableOperations:23,designFidelity:'matched-anchors',renderedViews:browser.captures.map(c=>c.view),existingApplicationSourceUnchanged:true,originalBriefUnchanged:true,briefHash:hash('docs/architecture/design-first/experiment.request.json'),preparedPayloadHash:hash('docs/architecture/design-first/experiment.preparation.json'),paidCalls:0,geometryAudit:response.architecturalAudit.geometry,checkpointIsSynthetic:true,originalFailedLiveAttemptPreserved:true};
writeFileSync(`${root}/verification.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verified:true,...report},null,2));
