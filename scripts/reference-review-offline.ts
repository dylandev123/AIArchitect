/** Manual fallback study only: all networking forbidden, no review/learning writes. */
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {validateCompositionPreview,buildComposition} from '../src/lib/villa/composition';
import {changedPaths} from '../src/lib/villa/visual-review';
globalThis.fetch=async()=>{throw Error('Offline only');};
const dir='docs/villa-playground/reference-review',raw=readFileSync(`${dir}/original.config.json`,'utf8'),before=JSON.parse(raw),candidate=structuredClone(before);
// Single-view inference: study an adjacent long-side patio, not measured reconstruction.
Object.assign(candidate.terraces[0],{x:-4.5,z:8,width:12});
// Freeze the retained garden explicitly so automatic derived bounds do not move site edges/planting.
candidate.siteMode='fixed';
const after=validateCompositionPreview(candidate);buildComposition(after);
const changes=changedPaths(before,after);assert.deepEqual(changes.sort(),['terraces.0.x','terraces.0.z','terraces.0.width','siteMode'].sort());
assert.deepEqual(before.wings,after.wings);assert.deepEqual(before.pool,after.pool);assert.deepEqual(before.garden,after.garden);assert.deepEqual(before.appearance,after.appearance);assert.equal(readFileSync(`${dir}/original.config.json`,'utf8'),raw);
const hashes=JSON.parse(readFileSync(`${dir}/preserved-sha256.json`,'utf8'));for(const [p,h] of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),h);
writeFileSync(`${dir}/revised.config.json`,JSON.stringify(after,null,2));
writeFileSync(`${dir}/offline-findings.json`,JSON.stringify({provenance:'Manual offline fallback after DNS failure; no Terra proposal exists',providerCalls:0,approved:false,learning:false,changes:changes.map(path=>{const get=(v:unknown)=>path.split('.').reduce<unknown>((a,k)=>(a as Record<string,unknown>)[k],v);return{path,before:get(before),after:get(after)};}),reason:'Reference shows paving beside the long facade. Existing terrace is beside short end and overlaps house by 1m. Candidate adjoins z=5 long facade, extends to z=11, and remains separate from pool (2.5m gap on x). Dimensions/orientation remain inferred.',policy:'siteMode fixed retains original garden bounds and all site geometry; explicit policy change rather than silently changing planting/boundary envelope',preservation:'All recorded source SHA256 hashes match; original config untouched',limitations:['No provider review or raw response received','No calibrated camera, surveyed dimensions or confirmed terrace orientation','Wing window placement, shutters, trim and roof pitch unchanged','Manual candidate only, never accepted or sent to design learning']},null,2));console.log('Offline candidate valid; source hashes match; no network.');
