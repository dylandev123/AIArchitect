/** Local real HTTP route check, mocked proposal. Endpoint has no AI or DB branch. */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {stagedSaveHash} from '../src/lib/villa/staged/naturalLanguageEdit';
import {loadHouse} from '../src/lib/villa/staged/save';
const save=readFileSync('docs/architecture/staged-villa/stage5-site/terra-stage5.save.json','utf8');
const instruction='Move the swimming pool two metres closer to the veranda without changing the building.';
const proposal={summary:instruction,ops:[{op:'move-pool-relative',pool:'pool',veranda:'veranda:south-veranda',direction:'towards',distance:2}]};
const response=await fetch('http://127.0.0.1:3016/api/ai/scene/edit-staged',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({save,instruction,expectedHash:stagedSaveHash(save),proposal}),redirect:'error'});
const data=await response.json();assert.equal(response.status,200);assert(data.accepted);assert.equal(data.providerCalls,0);
const h=loadHouse(data.save),expected=loadHouse(readFileSync('docs/architecture/staged-villa/natural-language-edit/pool-offline-2/candidate.save.json','utf8'));
assert.deepEqual(h.spec,expected.spec);assert.equal(JSON.stringify(h.scene.elements),JSON.stringify(expected.scene.elements));
writeFileSync('docs/architecture/staged-villa/natural-language-edit/pool-offline-2/http-route-check.json',JSON.stringify({httpStatus:response.status,accepted:data.accepted,providerCalls:data.providerCalls,sourceAndSceneMatchOfflineCandidate:true,reload:true,provenance:data.provenance},null,2),{flag:'wx'});
console.log('Actual HTTP accepted-save route passed; no AI or database calls.');
