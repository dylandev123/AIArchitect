/** OFFLINE ONLY. Creates the exact approval payload; cannot send it or apply edits. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadHouse} from '../src/lib/villa/staged/save';
import {measure} from '../src/lib/villa/staged/pipeline';
import {allRooms} from '../src/lib/villa/staged/layout';
import {prepareVisualReview,REVIEW_VIEWS,PROVIDER_SOURCES,sha256} from '../src/lib/villa/staged/visualReviewRequest';

assert(!process.argv.includes('--live'),'No live execution exists in this preparation script.');
const tag=process.argv[2];assert(tag&&/^[a-z0-9-]+$/.test(tag),'Supply a fresh packet tag.');
const root='docs/architecture/staged-villa',input=`${root}/stage5-site`,out=`${root}/stage6-refinement/${tag}`;
const read=(f:string)=>JSON.parse(readFileSync(f,'utf8'));
const saved=loadHouse(readFileSync(`${input}/terra-stage5.save.json`,'utf8')),checkpoint=read(`${input}/terra-stage5.checkpoint.json`),original=read(`${input}/terra-stage5.scene.json`),browser=read(`${input}/terra-stage5-browser.json`);
assert.equal(checkpoint.landscape,'ACTUAL LIVE TERRA STAGE 5; approved single call');
assert.deepEqual(saved.spec,checkpoint.spec);
assert.equal(JSON.stringify(saved.scene.elements),JSON.stringify(original.elements));
assert.equal(original.elements.length,377);
const rooms=allRooms(saved.spec);assert.equal(rooms.length,23);assert.equal(rooms.filter(r=>r.type==='bedroom').length,4);assert.equal(rooms.filter(r=>r.type==='bath').length,5);
assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failures,[]);assert.equal(browser.source,'stage5-site_terra-stage5');
const check=measure(saved.spec,5,4,3);assert.deepEqual(check.findings,[]);assert(check.scene);assert.equal(check.scene.terrain,undefined);assert.equal(JSON.stringify(check.scene.elements),JSON.stringify(original.elements));
const images=REVIEW_VIEWS.map(view=>{const c=browser.captures.find((c:{view:string})=>c.view.toLowerCase()===view);assert(c&&!c.contextLost);assert.equal(c.elements.length,377);return {view,png:readFileSync(`${input}/terra-stage5-${view}.png`),camera:c.camera as number[],target:c.target as number[]};});
const sourceFiles=[...['save','scene','checkpoint'].map(t=>`${input}/terra-stage5.${t}.json`),`${input}/terra-stage5-browser.json`,...REVIEW_VIEWS.map(v=>`${input}/terra-stage5-${v}.png`),`${input}/live/raw-response.json`,...['visualReviewRequest','refinement','edits','compile','spec','pipeline','validate','exterior','exteriorTrim','site','siteContract','save','layout','openSpaces'].map(n=>`src/lib/villa/staged/${n}.ts`),'src/lib/ai/pricing.ts','scripts/staged-villa-visual-review-prepare.ts','package-lock.json','node_modules/@ai-sdk/openai/package.json','node_modules/@ai-sdk/openai/dist/index.js','node_modules/ai/package.json','node_modules/ai/dist/index.js'];
const inputHashes=Object.fromEntries(sourceFiles.map(f=>[f,sha256(readFileSync(f))]));
const before=JSON.stringify(saved),packet=await prepareVisualReview(saved.spec,checkpoint.preservedPlanWarnings,images);
assert.equal(JSON.stringify(saved),before,'Preparation mutated the baseline.');
for(const [f,h]of Object.entries(inputHashes))assert.equal(sha256(readFileSync(f)),h,`Source changed: ${f}`);
mkdirSync(out); // Refuse overwrite before writing any evidence.
const write=(n:string,value:unknown)=>writeFileSync(`${out}/${n}.json`,JSON.stringify(value,null,2),{flag:'wx'});
// Store the exact POST body, including all four base64 PNG inputs. No auth headers.
write('wire-request',packet.wire);write('response-schema',packet.schema);write('context',packet.context);write('images',packet.imageManifest);write('source-hashes',inputHashes);
const wireSHA256=sha256(JSON.stringify(packet.wire));
let imageIndex=0;const preview=structuredClone(packet.wire);for(const m of preview.input)if(Array.isArray(m.content))for(const p of m.content)if(p.type==='input_image')p.image_url=`[PNG bytes embedded in wire-request.json: ${packet.imageManifest[imageIndex++]?.sha256}]`;
write('readable-request',preview);
const approval={status:'READY FOR USER APPROVAL — NOT SENT',provider:'OpenAI',endpoint:packet.endpoint,model:packet.wire.model,wireSHA256,wireBytes:Buffer.byteLength(JSON.stringify(packet.wire)),...packet.controls,cost:packet.cost,transport:packet.transport,documentation:{checkedOn:'2026-11-04',sources:PROVIDER_SOURCES,imageInput:true,structuredOutputs:true,accountAccess:'Not contacted or checked; Stage 5 successful text request is historical evidence, not a live vision test.'},scope:'One image review and concrete proposal response only. No refinement execution or second model call authorized.',preservation:{baselineElements:377,cap:400,remaining:23,rooms:23,bedrooms:4,bathrooms:5,unchangedInputHashes:true,unchangedSource:true,originalValidationFindings:check.findings,retainedWarnings:checkpoint.preservedPlanWarnings},executionRequirements:['Obtain explicit approval for this exact wire hash, model and maximum cost.','Recheck every source/image/schema hash and cost bound before network.','Reserve exclusive sticky attempt and network markers; one POST only, no redirects/retries/fallback model.','Use existing configuration without credential changes; never record authorization headers.','Raw HTTP body, usage, finish reason and refusal recorded before JSON interpretation.','Reject incomplete, refused, invalid or out-of-scope proposals without a repair call.','Do not apply proposals from review approval; execute only after bounded executor and preservation checks are ready.','Preserve original checkpoint and warnings. Candidate diff/save/reload/matched cameras required before visual improvement claims.'],billingCaveat:'Conservative bound uses current published standard rates plus 25% cache-write margin. No provider token-count endpoint or invoice checked. Historical failed Stage 3 cost remains unknown; existing US$5 experiment ceiling is unchanged.'};
write('approval',approval);
write('verification',{allFourOriginalPngContents: true, exactImageHashes: true, installedProviderSdkSerialization: true, strictResponseSchema: true, costBoundChecked: true, baselineConstructionValidated: true, sourceUnchanged: true, realProviderRequests:0, refinementsExecuted:0, sourceHashes:inputHashes, wireSHA256});
console.log(JSON.stringify({output:out,model:approval.model,wireSHA256,maxOutputTokens:approval.maxOutputTokens,maxCostUsd:approval.maxCostUsd,conservativeBoundUsd:packet.cost.conservativeBoundUsd,imageContents:4,providerCalls:0,baselineElements:377}));
