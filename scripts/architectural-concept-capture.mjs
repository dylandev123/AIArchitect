// Browser evidence with hand-authored responses. No live Terra calls in this script.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const directory = 'docs/architecture/architectural-concept-evaluation';
const fixtures = JSON.parse(readFileSync(`${directory}/fixtures.json`, 'utf8'));
if (existsSync(`${directory}/live-response.json`)) {
  const live = JSON.parse(readFileSync(`${directory}/live-response.json`, 'utf8'));
  if (live.body?.scene) fixtures.push({ name: 'live-result', scene: live.body.scene, provenance: 'replay of the retained live Terra response' });
}
const base = process.env.CONCEPT_URL ?? 'http://127.0.0.1:3107';
const browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1250 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  let fixture = fixtures[0], reject = false, calls = 0;
  await page.route('**/api/ai/concept', route => {
    calls++;
    return route.fulfill({ status: reject ? 422 : 200, contentType: 'application/json', body: JSON.stringify(reject ? { error: 'Concept validation failed. No substitute geometry was accepted.', findings: [{ code: 'ROOF_FOOTPRINT_UNSUPPORTED', targetId: 'home', message: 'Unsupported roof for the authored footprint.' }] } : { scene: { ...fixture.scene, metadata: { ...fixture.scene.metadata, model: fixture.scene.metadata.model ?? 'OFFLINE FIXTURE' } } }) });
  });
  await page.goto(`${base}/dev/architectural-concept`, { waitUntil: 'networkidle', timeout: 90000 });
  const saved = '{"state":{"projects":[{"id":"saved-2d-sentinel","houseConfigJson":"unchanged"}]},"version":6}';
  await page.evaluate(saved => localStorage.setItem('ai-architect-projects', saved), saved);
  const mounted = () => page.locator('canvas').evaluate(c => {
    let fiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber$'))];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const state = hook.memoizedState?.current;
        if (state?.scene?.isScene) {
          const meshes = []; state.scene.traverse(o => { if (o.isMesh && o.visible && o.userData?.id) meshes.push({ id: o.userData.id, vertices: o.geometry.attributes.position.count }); });
          return { meshes, camera: state.camera.position.toArray() };
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    return null;
  });
  for (const next of fixtures) {
    fixture = next;
    await page.getByLabel('Architectural brief').fill(fixture.scene.metadata.brief ?? `OFFLINE ${fixture.name} — static geometry test`);
    await page.getByRole('button', { name: 'Generate 3D Concept', exact: true }).click();
    await page.getByRole('heading', { name: fixture.scene.metadata.title, exact: true }).waitFor();
    await page.waitForTimeout(800);
    const before = await mounted(); assert(before?.meshes.length > 10, `Missing mounted V3 meshes: ${fixture.name}`);
    assert(before.meshes.some(m => /roof/.test(m.id)), 'Roofs must actually mount');
    const canvas = await page.locator('canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .55, canvas.y + canvas.height * .45);
    await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width * .65, canvas.y + canvas.height * .5, { steps: 12 }); await page.mouse.up();
    await page.waitForTimeout(250); const orbited = await mounted(); assert.notDeepEqual(orbited.camera, before.camera);
    await page.mouse.wheel(0, -180); await page.waitForTimeout(250); const zoomed = await mounted(); assert.notDeepEqual(zoomed.camera, orbited.camera);
    await page.mouse.down({ button: 'right' }); await page.mouse.move(canvas.x + canvas.width * .7, canvas.y + canvas.height * .55, { steps: 10 }); await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(250); const panned = await mounted(); assert.notDeepEqual(panned.camera, zoomed.camera);
    assert.equal(await page.evaluate(() => localStorage.getItem('ai-architect-projects')), saved);
    await page.screenshot({ path: `${directory}/${fixture.name}.png`, fullPage: true });
    checks.push({ fixture: fixture.name, provenance: fixture.provenance, meshes: before.meshes.length, roofsMounted: true, orbit: true, pan: true, zoom: true, savedStorageUnchanged: true });
  }
  reject = true;
  await page.getByRole('button', { name: 'Generate 3D Concept', exact: true }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Concept validation failed' });
  await alert.waitFor(); assert((await alert.innerText()).includes('ROOF_FOOTPRINT_UNSUPPORTED'));
  assert.equal(await page.locator('canvas').count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('ai-architect-projects')), saved);
  await page.screenshot({ path: `${directory}/validation-error.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${directory}/browser-checks.json`, JSON.stringify({ provenance: 'offline intercepted responses, actual V3 WebGL geometry', liveTerraCalls: 0, calls, errors, checks, errorClearsPreview: true }, null, 2) + '\n');
  console.log(JSON.stringify({ calls, errors, checks }));
} finally { await browser.close(); }
