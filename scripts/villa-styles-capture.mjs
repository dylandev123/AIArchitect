import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory = process.env.VILLA_STYLE_EVIDENCE_DIR ?? 'docs/villa-playground/styles';
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/api/ai/**',r=>r.abort());
  await page.goto(process.env.VILLA_URL ?? 'http://127.0.0.1:3107/dev/villa-playground', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('canvas').waitFor();
  await page.waitForTimeout(10000);
  // Inspect the actually mounted R3F scene, not an expected config or a synthetic image.
  async function mounted() {
    return page.locator('canvas').evaluate(c => {
      let fiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber$'))];
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook) {
          const state = hook.memoizedState?.current;
          if (state?.scene?.isScene) {
            const meshes = [], groups = [];
            state.scene.traverse(o => { if (o.isMesh && o.visible) meshes.push({ name: o.name, vertices: o.geometry?.attributes.position?.count }); if (o.isGroup && o.name) groups.push(o.name); });
            return { meshes: meshes.length, vertices: meshes.reduce((s, m) => s + (m.vertices ?? 0), 0), groups, camera: state.camera.position.toArray() };
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return null;
    });
  }
  const saved = '{"state":{"projects":[{"id":"villa-styles-sentinel","houseConfigJson":"untouched"}]},"version":6}';
  await page.evaluate(saved => localStorage.setItem('ai-architect-projects', saved), saved);
  await page.screenshot({ path: `${directory}/solana-benchmark.jpg`, type: 'jpeg', quality: 90 });
  for (const [style, label] of [['modern','Modern Contemporary'], ['caribbean','Caribbean Tropical'], ['spanish','Spanish Hacienda'], ['tuscan','Tuscan Estate']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(2800);
    const scene = await mounted(); assert(scene?.meshes > 100, `Missing actual geometry for ${style}`);
    for (const view of ['Poolside', 'Arrival', 'Garden', 'Above']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.waitForTimeout(1600);
      await page.screenshot({ path: `${directory}/${style}-${view.toLowerCase()}.jpg`, type: 'jpeg', quality: 90 });
    }
    await page.getByRole('button', { name: 'Poolside', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Golden hour', exact: true }).click(); await page.waitForTimeout(1500);
    await page.screenshot({ path: `${directory}/${style}-golden.jpg`, type: 'jpeg', quality: 90 });
    await page.getByRole('button', { name: 'Daylight', exact: true }).click();
    checks.push({ style, scene });
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('ai-architect-projects')), saved);
  writeFileSync(`${directory}/browser-checks.json`, JSON.stringify({ provenance: 'Actual local R3F WebGL renders. No intercepted villa responses.', errors, checks, projectStorageUnchanged: true }, null, 2) + '\n');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ errors, checks: checks.map(c => ({ style: c.style, meshes: c.scene.meshes })) }));
} finally { await browser.close(); }
