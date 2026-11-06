/** OFFLINE capture of the unified automatic sample houses in the dev-only viewer. All APIs blocked or stubbed. */
import {createRequire} from 'node:module';
import {existsSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH ?? '/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const [tag, capture, origin = 'http://localhost:3015'] = process.argv.slice(2);
assert(/^unified-offline-\d+$/.test(tag) && /^[a-z0-9-]+$/.test(capture));
const dir = `docs/architecture/automatic-house/${tag}`, houses = ['a-caribbean', 'b-courtyard', 'c-estate'], views = ['Arrival', 'Aerial', 'Garden', 'Poolside'];
assert(!existsSync(`${dir}/${capture}-browser.json`), 'Choose a new capture tag; evidence exists.');
const browser = await chromium.launch({headless: false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--headless=new', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']});
const report = [];
try {
  for (const house of houses) {
    const page = await browser.newPage({viewport: {width: 1500, height: 1000}, deviceScaleFactor: 1});
    const errors = [], blocked = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', async r => {
      const u = new URL(r.request().url());
      if (u.pathname === '/api/assets' && r.request().method() === 'GET') return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({catalog: [], queue: [], glbIds: []})});
      if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname.startsWith('/api/')) { blocked.push(u.href); return r.abort(); }
      return r.continue();
    });
    await page.goto(`${origin}/dev/staged-villa?file=automatic-${tag}_${house}.scene.json`, {waitUntil: 'networkidle', timeout: 240000});
    await page.locator('canvas').waitFor({timeout: 120000});
    for (const view of views) {
      await page.getByRole('button', {name: view, exact: true}).click();
      await page.waitForTimeout(3500);
      await page.locator('canvas').screenshot({path: `${dir}/${capture}-${house}-${view.toLowerCase()}.png`});
    }
    report.push({house, errors, blocked: blocked.length});
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(`${dir}/${capture}-browser.json`, JSON.stringify({provenance: 'OFFLINE sample houses; dev-only viewer; APIs blocked', report}, null, 1));
console.log(JSON.stringify(report));
