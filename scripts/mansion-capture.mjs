// Offline DEV fixture only. Uses production PrimitiveMesh and scene lighting.
// PLAYWRIGHT_DIR points to a directory containing node_modules/playwright.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(`${process.env.PLAYWRIGHT_DIR ?? process.cwd()}/node_modules/`);
const { chromium } = require('playwright');
const out = process.argv[2] ?? 'docs/architecture/parity/mansion';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/\/api\/ai|openai|terra/i.test(url)) { errors.push(`Blocked provider request: ${url}`); return route.abort(); }
    return route.continue();
  });
  await page.goto(`${process.env.PARITY_URL ?? 'http://localhost:3000'}/dev/cottage-parity?fixture=mansion`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, null, { timeout: 60000 });
  for (const view of ['arrival','rear','aerial']) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await page.waitForFunction(v => document.querySelector('nav strong')?.textContent?.endsWith(v), view, { timeout: 60000 });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${out}/${view}.jpg`, quality: 85 });
  }
  console.log(JSON.stringify({ errors, summary: await page.locator('p').last().textContent() }));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
