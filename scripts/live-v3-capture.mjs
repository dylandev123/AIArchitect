/** Renders a live v3 scene (automatic-house/live-v3) through the normal ArchitecturalScene viewer. Local only: every non-localhost request and /api/ call is blocked. Fails on any console error. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH ?? '/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const base = process.argv[2], outDir = process.argv[3] ?? "docs/architecture/automatic-house/live-v3";
assert(/^[a-z0-9._-]+$/.test(base ?? ''), 'usage: live-v3-capture.mjs <scene-basename in automatic-house/live-v3> [outDir] [Views]');
const views = (process.argv[4] ?? 'Arrival,Aerial,Garden,Poolside').split(',');
const browser = await chromium.launch({headless: false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--headless=new', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']});
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}, deviceScaleFactor: 2});
  page.on('pageerror', e => errors.push('pageerror: ' + e));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname.startsWith('/api/')) return r.abort(); return r.continue(); });
  await page.goto(`http://localhost:3015/dev/staged-villa?file=automatic-${process.env.CAPTURE_FOLDER ?? 'live-v3'}_${base}.scene.json`, {waitUntil: 'networkidle', timeout: 240000});
  await page.locator('canvas').waitFor({timeout: 120000});
  for (const view of views) {
    await page.getByRole('button', {name: view, exact: true}).click(); await page.waitForTimeout(4000);
    await page.screenshot({path: `${outDir}/${base}-${view.toLowerCase()}.png`, clip: {x: 150, y: 330, width: 1200, height: 520}});
  }
  console.log('captured', views.join(','), '| browser errors:', errors.length, errors.slice(0, 5));
  assert.deepEqual(errors.filter(e => !/favicon|Failed to load resource.*(aborted|ERR_FAILED)/.test(e)), []);
} finally { await browser.close(); }
