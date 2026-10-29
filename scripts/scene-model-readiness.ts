/** Offline preparation only. Never reads a key, calls a provider or changes a scene. */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Output} from 'ai';
import {SCENE_TEST_MODELS,resolveSceneTestSettings} from '../src/lib/ai/sceneTesting';
import {mansionCoordinationFixture} from '../src/lib/villa/scene/controlledFixture';
import {sceneResponseFormatSchema,sceneMessages,resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import assert from 'node:assert/strict';
Object.assign(process.env,{NODE_ENV:'development'});
globalThis.fetch=async()=>{throw Error('Offline preflight prohibits network');};
const sha=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const dir='docs/architecture/safer-validation-model-tests';mkdirSync(dir,{recursive:true});
const fixture=await mansionCoordinationFixture();
const schema=await sceneResponseFormatSchema(fixture.input),format=await Output.object({schema}).responseFormat;
assert(format?.type==='json');
const fingerprint=sha({system:fixture.context.system,messages:fixture.messages,schema:format});
assert.equal(fixture.context.system,JSON.parse(readFileSync('docs/architecture/terra-coordination-experiment/system.json','utf8')).system);
assert.deepEqual(fixture.messages,JSON.parse(readFileSync('docs/architecture/terra-coordination-experiment/messages.json','utf8')));
assert.deepEqual(format.schema,JSON.parse(readFileSync('docs/architecture/terra-coordination-experiment/preflight.json','utf8')).wire.text.format.schema);
const variants=SCENE_TEST_MODELS.flatMap(model=>['medium','high'].map(effort=>{
 const input={...fixture.input,testing:{model:model.id,reasoningEffort:effort as 'medium'|'high',fixture:'mansion-coordination' as const}};
 const settings=resolveSceneTestSettings(input.testing,'gpt-5.6-terra','development');
 assert.deepEqual(sceneMessages(input),sceneMessages(fixture.input));
 // Use historical measured totals as a scenario, not a token/cost forecast or cap.
 return {...settings,documentedStructuredOutputs:true,accountAccess:'unverified — no API calls permitted',source:`https://developers.openai.com/api/docs/models/${model.id}`,ratesPerMillionUSD:{input:model.input,cacheWrite:model.input*1.25,output:model.output},estimatedUSD:{historical29867Input5785Output:(29867*model.input+5785*model.output)/1e6,historicalWithAllInputCacheWrite:(29867*model.input*1.25+5785*model.output)/1e6,scenario30000Input30000Output:(30000*model.input+30000*model.output)/1e6},requestFingerprint:fingerprint};
}));
const response=JSON.parse(readFileSync('docs/architecture/terra-coordination-experiment/response.json','utf8')).output;
let rejection:string|undefined;
try{resolveSceneResult(fixture.input,response);}catch(error){assert(error instanceof SceneConstructionError);rejection=error.message;}
assert(rejection?.includes('Destructive incomplete replacement'));
const summary={date:'2026-10-29',providerCalls:0,modelDiscoveryCalls:0,productionDefault:'unchanged; gpt-5.6-terra unless AI_HOUSE_MODEL already overrides it',fixtureFingerprint:fixture.fingerprint,requestFingerprint:fingerprint,variants,retainedCandidate:{result:'rejected; original preserved',operations:response.operations,error:rejection},beforeAudit:reviewSceneArchitecture(fixture.input.current!),readiness:'Ready offline for one explicitly authorized comparison; live account access and architectural quality unverified. One existing-route request per selected model, zero retries. A new paired comparison needs two authorized requests; a single new request can compare against the retained Terra result with that limitation.',quality:'Scene-derived findings retained; visual coherence requires matched screenshots and human review, never automatic approval.'};
writeFileSync(`${dir}/offline-readiness.json`,JSON.stringify(summary,null,2));
writeFileSync(`${dir}/ui-fixture.json`,JSON.stringify({input:fixture.input,fingerprint:fixture.fingerprint}));
console.log(JSON.stringify({providerCalls:0,variants:variants.length,requestFingerprint:fingerprint,retainedCandidate:'rejected',readyOffline:true}));
