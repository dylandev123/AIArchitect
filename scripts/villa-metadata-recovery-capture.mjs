/** Offline verification of the retained design in the actual playground, with AI/network blocked. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const responseId = '351c9784227a3700c660e6935d67c07ca07785b1978995c962386fa17b7b5625';
const base = process.env.VILLA_URL ?? 'http://localhost:3000';
const url = `${base}/dev/villa-playground?response=${responseId}`;
const directory = 'docs/villa-playground/metadata-recovery';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], blocked = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(90000);
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.startsWith('/api/ai/') || requestUrl.origin !== new URL(base).origin) {
      blocked.push(requestUrl.href); return route.abort();
    }
    return route.continue();
  });
  console.log('Opening retained villa recovery page');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  assert.equal(response.status(), 200);
  console.log(`Recovery page HTTP ${response.status()}`);
  await page.getByRole('heading', { name: 'Caribbean Crown Estate', exact: false }).waitFor();
  await page.locator('canvas').waitFor();
  const scene = () => page.locator('canvas').evaluate(canvas => {
    let fiber = canvas[Object.keys(canvas).find(key => key.startsWith('__reactFiber$'))];
    while (fiber) {
      let hook = fiber.memoizedState;
      while (hook) {
        const ref = hook.memoizedState?.current;
        const state = ref?.get ? ref.get() : ref;
        if (state?.scene?.isScene) {
          const groups = [], invalid = []; let meshes = 0, triangles = 0;
          state.scene.updateMatrixWorld(true);
          state.scene.traverse(object => {
            if (object.isGroup && object.name) groups.push(object.name);
            if (object.isMesh) {
              meshes++;
              const position = object.geometry.attributes.position;
              triangles += (object.geometry.index?.count ?? position?.count ?? 0) / 3;
              if ((position && !Array.from(position.array).every(Number.isFinite)) || !object.matrixWorld.elements.every(Number.isFinite)) invalid.push(object.name);
            }
          });
          return { meshes, triangles, groups, invalid, drawCalls: state.gl.info.render.calls, frame: state.gl.info.render.frame };
        }
        hook = hook.next;
      }
      fiber = fiber.return;
    }
    return null;
  });
  let data;
  for (let i = 0; i < 180; i++) {
    data = await scene();
    if (data?.meshes > 100 && data.drawCalls > 0 && data.groups.includes('Local composition · saint-lucia-caribbean-crown')) break;
    await page.waitForTimeout(500);
  }
  console.log('Recovered scene inspected', JSON.stringify(data));
  assert(data?.drawCalls > 0, 'WebGL must actually draw the recovered geometry');
  assert(data.groups.includes('Local composition · saint-lucia-caribbean-crown'));
  assert.equal(data.groups.filter(group => group.startsWith('Wing ')).length, 9);
  assert.equal(data.groups.filter(group => group.includes('curved-pavilion@1')).length, 1);
  assert.deepEqual(data.invalid, []);
  await page.getByRole('button', { name: 'Dismiss Terra response' }).click();
  for (const view of ['Poolside', 'Arrival', 'Garden', 'Above']) {
    await page.getByRole('button', { name: view, exact: true }).click({ force: true });
    await page.waitForTimeout(2600);
    data = await scene(); assert.deepEqual(data.invalid, []); assert(data.drawCalls > 0);
    await page.screenshot({ path: `${directory}/${view.toLowerCase()}.png` });
    checks.push({ view, ...data });
  }
  assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
  const proof = { url, responseId, providerCalls: 0, method: 'Server-side retained response replay; all AI and nonlocal HTTP requests blocked; actual Chromium WebGL.', errors, blocked, checks };
  writeFileSync(`${directory}/browser-checks.json`, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ ...proof, checks: checks.map(({ groups: _groups, ...check }) => check) }, null, 2));
} finally { await browser.close(); }
