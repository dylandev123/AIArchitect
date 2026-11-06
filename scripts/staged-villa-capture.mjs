/** Renders a staged-villa checkpoint through the normal viewer. Local only; all API/non-local requests are blocked. */
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH ?? '/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const base = process.argv[2];
assert(/^[a-z0-9._-]+$/.test(base ?? ''), 'usage: staged-villa-capture.mjs <checkpoint-basename> [View,...]');
const views = (process.argv[3] ?? 'Arrival,Aerial,Garden,Poolside').split(',');
const browser = await chromium.launch({headless: false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--headless=new', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']});
const errors = [];
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}, deviceScaleFactor: 2});
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname.startsWith('/api/')) return r.abort(); return r.continue(); });
  await page.goto(`http://localhost:3015/dev/staged-villa?file=${base}.scene.json`, {waitUntil: 'networkidle', timeout: 180000});
  await page.locator('canvas').waitFor({timeout: 90000});
  for (const view of views) {
    await page.getByRole('button', {name: view, exact: true}).click(); await page.waitForTimeout(3500);
    await page.screenshot({path: `docs/architecture/staged-villa/${base}-${view.toLowerCase()}.png`, clip: {x: 150, y: 330, width: 1200, height: 520}});
  }
  assert.deepEqual(errors, []);
  console.log('captured', views.join(','), 'errors:', errors.length);
} finally { await browser.close(); }
