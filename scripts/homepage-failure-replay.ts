/** Exact retained provider replay: no provider imports, no network. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { generateV3FromArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprintGeneration';
import { resolveSceneResult } from '../src/lib/villa/scene/terra';
globalThis.fetch = async () => { throw Error('Network forbidden in offline replay'); };
const dir = 'docs/consolidation/homepage';
const capture = JSON.parse(readFileSync(`${dir}/original-failure.json`, 'utf8'));
const hash = createHash('sha256').update(capture.rawResponse).digest('hex');
if (hash !== capture.sha256) throw Error('Original response hash mismatch');
const output = JSON.parse(capture.rawResponse);
const replay = await generateV3FromArchitecturalBlueprint('A Caribbean belvedere house', async () => ({output, finishReason:'stop'}), {allowRepair:false, requirePlanFirst:true});
if (!replay.findings.some(f => f.message.includes('arrival-sequence: missing authored connects relationship'))) throw Error('Original failure was not reproduced');
const fixture = JSON.parse(readFileSync('docs/villa-playground/terra-direct-scene/turning-lantern.operations.json','utf8'));
const direct = resolveSceneResult({prompt:'A Caribbean belvedere house',mode:'generate'},fixture);
writeFileSync(`${dir}/failure-replay.json`,JSON.stringify({providerCalls:0,sha256:hash,legacy:{ok:replay.ok,phase:replay.phase,findings:replay.findings},direct:{version:direct.scene.version,elements:direct.scene.elements.length},note:'Direct operations are a separate retained fixture, not a lossless conversion of the failed blueprint.'},null,2));
if(replay.planningScene) writeFileSync(`${dir}/recovered-planning-scene.json`,JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:replay.planningScene},null,2));
console.log(JSON.stringify({providerCalls:0,originalFailureReproduced:true,planningSceneRecovered:!!replay.planningScene,directElements:direct.scene.elements.length}));
