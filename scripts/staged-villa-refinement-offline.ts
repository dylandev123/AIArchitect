/** Read actual evidence and exercise a developer transaction; NEVER calls a provider. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadHouse, saveHouse} from '../src/lib/villa/staged/save';
import {refinementBaseline, stageRefinement} from '../src/lib/villa/staged/refinement';

const root = 'docs/architecture/staged-villa';
const tag = process.argv[2];
if (!tag || !/^[a-z0-9-]+$/.test(tag)) throw Error('Supply a fresh offline evidence tag.');
const output = `${root}/stage6-refinement/${tag}`;
mkdirSync(output); // Exclusive: historical evidence must never be overwritten.
const write = (name: string, value: unknown) => writeFileSync(`${output}/${name}.json`, JSON.stringify(value, null, 2), {flag: 'wx'});
const files = ['terra-stage5.save.json', 'terra-stage5.checkpoint.json', 'terra-stage5.scene.json', 'terra-stage5-browser.json', ...['arrival','aerial','garden','poolside'].map(v => `terra-stage5-${v}.png`)];
const hashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(`${root}/stage5-site/${f}`)).digest('hex')]));
const saved = loadHouse(readFileSync(`${root}/stage5-site/terra-stage5.save.json`, 'utf8'));
const base = refinementBaseline(saved.spec);
const policy = {baseline: base.hash, finishBlocks: [], siteItems: ['palm-5'], components: ['landscape:palm-5'], maxChanged: 1};
const fixture = {summary: 'DEVELOPER OFFLINE transaction fixture; not an AI review or aesthetic recommendation', observations: [{view: 'arrival', responsibility: 'architecture', component: 'landscape:palm-5', evidence: 'Test-only movement of a known semantic palm. Visual benefit is not claimed.'}], ops: [{op: 'move-site-item', id: 'palm-5', dx: .2, dz: 0}]};
write('input-hashes', hashes); write('policy', policy); write('developer-proposal', fixture);
const result = await stageRefinement(saved.spec, fixture, policy);
write('outcome', result);
if (!result.accepted) throw Error(JSON.stringify(result.reasons));
const reload = loadHouse(saveHouse(result.spec, result.scene, saved.history));
if (JSON.stringify(reload.scene.elements) !== JSON.stringify(result.scene.elements)) throw Error('Reload mismatch');
for (const [file, hash] of Object.entries(hashes)) if (createHash('sha256').update(readFileSync(`${root}/stage5-site/${file}`)).digest('hex') !== hash) throw Error('Historical evidence changed');
write('verification', {provenance: 'OFFLINE developer transaction on actual Terra Stage 5 source', modelCalls: 0, before: base.scene.elements.length, after: result.scene.elements.length, diff: result.diff, reload: true, inputHashesUnchanged: true, renderedCandidate: false, aestheticImprovement: 'not assessed', priorWarnings: JSON.parse(readFileSync(`${root}/stage5-site/terra-stage5.checkpoint.json`, 'utf8')).warnings ?? 'See retained Stage 3 warnings in HANDOFF.md'});
console.log(`Offline transaction verified: ${output}; no model call, no rendered-quality claim.`);
