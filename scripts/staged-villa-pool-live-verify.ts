/** Read-only verification of actual live candidate plus one in-memory editability check; no model. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadHouse} from '../src/lib/villa/staged/save';
import {stagedSaveHash,editAcceptedStagedSave} from '../src/lib/villa/staged/naturalLanguageEdit';
const dir='docs/architecture/staged-villa/natural-language-edit/live-edit-1',raw=readFileSync(`${dir}/candidate.save.json`,'utf8'),h=loadHouse(raw);
const result=await editAcceptedStagedSave({save:raw,instruction:'OFFLINE verification only: pool 0.2 m away; do not save this test candidate',expectedHash:stagedSaveHash(raw),proposal:{summary:'Synthetic subsequent editability check, not another AI response',ops:[{op:'move-pool-relative',pool:'pool',veranda:'veranda:south-veranda',direction:'away',distance:.2}]}});
assert(result.accepted);loadHouse(result.save);assert.equal(readFileSync(`${dir}/candidate.save.json`,'utf8'),raw);
const {spec,scene}=loadHouse(raw);assert.equal(JSON.stringify(scene.elements),JSON.stringify(h.scene.elements));
assert.equal(spec.blocks.find(b=>b.id==='upper-bedroom-bar')!.roof.rise,2.45);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
writeFileSync(`${dir}/editability-verification.json`,JSON.stringify({liveCandidateSaveHash:hash(raw),saveReload:true,subsequentOfflineEditAccepted:true,subsequentOfflineReload:true,subsequentTestPersisted:false,liveCandidateFileUnchanged:true,extraModelCalls:0,baselineRoofRise:2.45,editedRoof:false},null,2),{flag:'wx'});
console.log('Actual live saved candidate reloads and supports subsequent deterministic edits; no test candidate persisted.');
