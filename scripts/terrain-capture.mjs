// Offline DEV terrain-audit capture. Production PrimitiveMesh + lighting. Blocks any provider request.
// PLAYWRIGHT_DIR points to a directory containing node_modules/playwright.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(`${process.env.PLAYWRIGHT_DIR ?? process.cwd()}/node_modules/`);
const { chromium } = require('playwright');
const out = process.argv[2] ?? 'docs/architecture/parity/terrain';
const fixtures = (process.argv[3] ?? 'flat,hillside,cliff').split(',');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/\/api\/ai|openai|terra/i.test(url) && !/terrain-audit/.test(url)) { errors.push(`Blocked provider request: ${url}`); return route.abort(); }
    return route.continue();
  });
  for (const fixture of fixtures) {
    await page.goto(`${process.env.PARITY_URL ?? 'http://localhost:3000'}/dev/terrain-audit?fixture=${fixture}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, null, { timeout: 60000 });
    for (const view of ['aerial', 'downhill', 'side', 'arrival', 'coast']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      await page.waitForFunction(v => document.querySelector('nav strong')?.textContent?.endsWith(v), view, { timeout: 60000 });
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${out}/${fixture}-${view}.jpg`, quality: 85 });
    }
  }
} finally { await browser.close(); console.log(JSON.stringify({ errors })); }
