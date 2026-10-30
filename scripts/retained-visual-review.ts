/** Default: capture only, zero provider calls. --live requires separate user authorization. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { loadEnvConfig } from '@next/env';
import { runGenerationReview, REVIEW_VIEWS, matchingReviewCamera } from '../src/lib/villa/scene/generationReview';
import { validateScene, stageSceneOperations, type ArchitecturalScene } from '../src/lib/villa/scene/model';
import { sceneResultSchema } from '../src/lib/villa/scene/terra';
import type { SceneCapture } from '../src/lib/villa/visual-review';

const live = process.argv.includes('--live');
const preflight = process.argv.includes('--browser-preflight');
assert(!(live && preflight), 'Browser preflight must never use live mode');
const dir = `docs/architecture/retained-visual-review${preflight ? '/browser-preflight' : ''}`;
const source = 'docs/architecture/generation-quality/final-family/scene.json';
const bytes = readFileSync(source);
const hash = () => createHash('sha256').update(readFileSync(source)).digest('hex');
const originalHash = hash();
const original = validateScene(JSON.parse(bytes.toString()));
mkdirSync(dir, { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(`${dir}/${name}`, JSON.stringify(value, null, 2), { flag: 'wx' });
if (!existsSync(`${dir}/original.scene.json`)) writeFileSync(`${dir}/original.scene.json`, bytes, { flag: 'wx' });
assert.deepEqual(JSON.parse(readFileSync(`${dir}/original.scene.json`, 'utf8')), JSON.parse(bytes.toString()));
if (live) {
 assert(!existsSync(`${dir}/started.json`), 'Experiment already consumed; no resubmission');
 loadEnvConfig(process.cwd());
 assert(process.env.OPENAI_API_KEY?.trim(), 'Existing credential required');
 // Local route invocation uses file usage bookkeeping, never a database connection.
 delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
 process.env.AI_USAGE_LOG_PATH = `${process.cwd()}/${dir}/usage.jsonl`;
 assert(!process.env.VERCEL, 'Local development only');
}
const nativeFetch = globalThis.fetch;
let calls = 0;
const phases = new Set<string>();
let phase = '';
// Installed before importing the real route. Retain exact wire bodies, never auth headers.
globalThis.fetch = async (url, init) => {
 const address = String(url instanceof Request ? url.url : url);
 assert(live, 'Provider network disabled during preparation');
 assert.equal(address, 'https://api.openai.com/v1/responses');
 assert(++calls <= 3 && !phases.has(phase), 'No retry or extra call permitted');
 phases.add(phase);
 save(`${phase}.provider-request.json`, JSON.parse(String(init?.body)));
 const response = await nativeFetch(url, init);
 writeFileSync(`${dir}/${phase}.provider-response.txt`, await response.clone().text(), { flag: 'wx' });
 return response;
};
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH ?? '/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
// macOS Chrome must run outside the execution filesystem sandbox. Keep the
// proven launch flags; sandbox launch failure is not a reason to retry live work.
const browser = await chromium.launch({ headless: false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist'] });
const errors: string[] = [];
const consoleErrors: string[] = [];
const blocked: string[] = [];
const browserVersion = browser.version();
try {
 const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
 page.on('pageerror', (error: Error) => errors.push(String(error)));
 page.on('console', (message: { type: () => string; text: () => string; location: () => { url?: string } }) => { if (message.type() === 'error') consoleErrors.push(`${message.location().url ?? ''}: ${message.text()}`); });
 await page.route('**/*', (route: { request: () => { url: () => string; method: () => string }; fulfill: (options: { status: number; contentType: string; body: string }) => unknown; abort: () => unknown; continue: () => unknown }) => {
  const u = new URL(route.request().url());
  // The root layout syncs the asset catalog on every page. This primitive-only
  // offline preflight needs no catalog; fulfill locally without reaching a server.
  if (preflight && ['localhost','127.0.0.1'].includes(u.hostname) && u.pathname === '/api/assets' && route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ catalog: [], queue: [], glbIds: [] }) });
  if (!['localhost','127.0.0.1'].includes(u.hostname) || u.pathname.startsWith('/api/')) { blocked.push(u.href); return route.abort(); }
  return route.continue();
 });
 await page.goto('http://127.0.0.1:3015/dev/retained-visual-review', { waitUntil: 'networkidle', timeout: 120000 });
 await page.waitForFunction(() => !!window.retainedReviewCapture);
 const capture = async (scene: ArchitecturalScene, previous?: SceneCapture[]) => {
  const shots: SceneCapture[] = [];
  for (const view of REVIEW_VIEWS) {
   const shot = await page.evaluate(async ({ scene, view, pose }: { scene: ArchitecturalScene; view: SceneCapture['view']; pose?: SceneCapture['camera'] }) => {
    return Promise.race([window.retainedReviewCapture!(scene, view, pose), new Promise<never>((_, reject) => setTimeout(() => reject(Error('Capture timed out')), 30000))]);
   }, { scene, view, pose: previous?.find(s => s.view === view)?.camera });
   if (previous) assert(matchingReviewCamera(shot.camera, previous[shots.length].camera));
   shots.push(shot);
   writeFileSync(`${dir}/${previous ? 'proposed' : live ? 'before' : 'prepared'}-${view.toLowerCase()}.png`, Buffer.from(shot.image.split(',')[1], 'base64'), { flag: 'wx' });
  }
  return shots;
 };
 if (!live) {
  const shots = await capture(original);
  save('prepared-captures.json', shots);
  save('preflight.json', { originalHash, elements: original.elements.length, providerCalls: calls, browserVersion, errors, consoleErrors, blocked, checks: ['exact rendered element IDs, positions and yaw', 'nonempty architecture bounds inside camera', 'WebGL context not lost', 'nonblank pixel diversity'], views: shots.map(s => ({ view: s.view, width: s.width, height: s.height, camera: s.camera })) });
  assert.deepEqual(consoleErrors, []);
 } else {
  const { getAiModelId } = await import('../src/lib/ai/model');
  assert.equal(getAiModelId(), 'gpt-5.6-terra', 'Configured model changed; require a new experiment proposal');
  save('started.json', { originalHash, model: getAiModelId(), maxPasses: 1, maxProviderCalls: 3, startedAt: new Date().toISOString() });
  const { POST } = await import('../src/app/api/ai/scene/visual-review/route');
  let current = original;
  await runGenerationReview(original, {
   capture,
   assertCurrent: () => { assert.equal(hash(), originalHash); assert.deepEqual(errors, []); },
   request: async input => {
    phase = input.phase;
    const brief = `${input.brief}\nCritically assess architectural beauty, originality, overall composition, proportions, vertical hierarchy, roof sophistication, facade depth/glazing, coordinated material/colour contrast, entrance quality and outdoor living. Seek the largest meaningful exterior improvement supported by this existing scoped workflow; no interiors or unrelated features. Villa Solana is the aspirational benchmark, but no Solana images are supplied: do not claim image-based reference fidelity.`;
    save(`${phase}.input.json`, { ...input, brief });
    const response = await POST(new Request('http://localhost/api/ai/scene/visual-review', { method: 'POST', body: JSON.stringify({ ...input, brief }) }));
    const body = await response.json(); save(`${phase}.result.json`, body);
    if (phase === 'refine') {
     // Diagnostic staging is never acceptance: retain even a preservation/audit-rejected candidate.
     try {
      const raw = JSON.parse(readFileSync(`${dir}/refine.provider-response.txt`, 'utf8'));
      const text = raw.output.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).filter((item: { type: string }) => item.type === 'output_text').map((item: { text: string }) => item.text).join('');
      const candidate = sceneResultSchema.parse(JSON.parse(text));
      save('raw-candidate.operations.json', candidate);
      save('raw-candidate.scene.json', stageSceneOperations(input.current, candidate.operations));
     } catch (error) { save('raw-candidate-diagnostic.json', { error: String(error), status: 'Could not construct a valid editable candidate; provider bytes retained.' }); }
    }
    assert(response.ok, body.error || 'Route rejected response; raw provider evidence retained');
    // Persist parsed candidate operations before deterministic staging can reject them.
    if (phase === 'refine') save('proposed.operations.json', body.output);
    return body.output;
   },
   commit: next => { current = next; },
   record: record => {
    save('record.json', record);
    if (record.after) save('proposed.scene.json', record.after);
   },
  }, { maxPasses: 1 });
  save('retained.scene.json', current);
  save('summary.json', { providerCalls: calls, phases: [...phases], originalHash, originalUnchanged: hash() === originalHash, errors });
 }
 assert.equal(hash(), originalHash);
 assert.deepEqual(errors, []);
 console.log(JSON.stringify({ live, providerCalls: calls, originalHash, errors, evidence: dir }));
} finally {
 await browser.close(); globalThis.fetch = nativeFetch;
 if (preflight) save('browser-exit.json', { connected: browser.isConnected(), originalUnchanged: hash() === originalHash, providerCalls: calls });
}
