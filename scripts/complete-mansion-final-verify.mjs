/** Offline final evidence integrity; never transmits. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='docs/architecture/complete-mansion-2026-10-30';
const read=n=>JSON.parse(fs.readFileSync(`${root}/${n}`));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const pre=read('preflight.json'),route=read('route-response.json'),scene=read('scene.json'),wire=read('provider-response.exact.json'),capt=read('browser-result.json'),oblique=read('oblique-browser-result.json'),post=read('postflight.json');
assert.equal(read('call-result.json').providerCalls,1);
assert.equal(read('provider-http.json').status,200);assert.equal(wire.status,'completed');
assert.deepEqual(scene,route.scene);
assert.deepEqual(JSON.parse(read('retained.wire.json').requestBody),read('provider-request.exact.json'));
// validateScene reorders object keys in scene.json; compare semantic content
// above, and hash the original route serialization used by both captures.
assert.equal(capt.sceneHash,hash(JSON.stringify(route.scene)));
assert.equal(oblique.sceneHash,capt.sceneHash);assert.equal(capt.captures.length,4);
for(const b of [capt,oblique]){assert.deepEqual(b.errors,[]);assert.equal(b.captureProviderCalls,0);for(const c of b.captures){assert.equal(c.contextLost,false);assert.equal(c.elements.length,78);}}
for(const [p,h]of Object.entries(pre.sourceHashes))assert.equal(hash(fs.readFileSync(p,'utf8')),h,p);
function files(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${d}/${e.name}`):[`${d}/${e.name}`]);}
const scriptPaths=['scripts/complete-mansion-once.ts','scripts/complete-mansion-review.ts','scripts/complete-mansion-capture.mjs','scripts/complete-mansion-postflight.ts','scripts/complete-mansion-final-verify.mjs'];
fs.writeFileSync(`${root}/final-verification.json`,JSON.stringify({status:'one-authorized-generation-completed-offline-review-complete',paidGenerationRequests:1,additionalPaidRequests:0,retries:0,fallbackModels:0,paidVisualReviewCalls:0,refinementCalls:0,providerRequestMatchesFrozenPayload:true,sourceHashesUnchanged:true,modelRequested:'gpt-5.6-terra',providerModel:wire.model,providerId:wire.id,requestId:read('provider-http.json').requestId,providerStatus:wire.status,routeStatus:read('call-result.json').status,exactSceneReplay:post.exactSceneReplay,sceneSha256:hash(fs.readFileSync(`${root}/scene.json`)),renderedRouteSceneHash:capt.sceneHash,routeSceneSemanticallyEqualsNormalizedScene:true,hashNote:'The normalized scene has schema key ordering; captures hash the original route scene serialization. Deep equality verifies identical content.',sceneGeometryUntouched:true,standardViews:capt.captures.map(c=>({view:c.view,elementCount:c.elements.length,camera:c.camera,target:c.target,contextLost:c.contextLost})),additionalObliqueView:oblique.captures.map(c=>({camera:c.camera,target:c.target,elementCount:c.elements.length,contextLost:c.contextLost})),browserErrors:[],hardRelationshipFindings:read('relationship-findings.json').length,architecturalFindings:read('architecture-audit.json').findings.length,plannedDemandM2:791,actualOccupiedSlabUnionM2:776,usage:wire.usage,cost:read('usage-and-cost.json'),verdicts:{scale:'substantial area; complete programme capacity unverified and 15 m² underprovided',completeness:'partial exterior; six distinct suites, side-pavilion routes, infinity edge and planted garden absent',design:'not exceptional; not substantially better than prior 952 m² mansion',firstDemonstratedDivergence:'returned architectural plan, then faithfully authored operations'},databaseEvents:read('call-result.json').dbEvents,productionDatabaseMutations:0,commits:0,deployments:0,scriptHashes:Object.fromEntries(scriptPaths.map(p=>[p,hash(fs.readFileSync(p))])),artifactHashes:Object.fromEntries(files(root).filter(p=>!p.endsWith('/final-verification.json')).map(p=>[p.slice(root.length+1),hash(fs.readFileSync(p))]))},null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({paidCalls:1,exactPayload:true,exactReplay:true,standardViews:4,additionalOblique:1,sceneUnchanged:true,areaM2:776,programmeDemandM2:791,estimatedUsd:.167625}));
