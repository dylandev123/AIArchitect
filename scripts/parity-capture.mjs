// DEV-only matched WebGL capture of /dev/cottage-parity (start `npm run dev` first). Same camera/lighting per fixture.
// Usage: PLAYWRIGHT_DIR=<dir containing node_modules/playwright> node scripts/parity-capture.mjs <outDir> <cottage|villa|large> [views...]
import { createRequire } from 'node:module';
const require = createRequire(`${process.env.PLAYWRIGHT_DIR ?? process.cwd()}/node_modules/`);
const { chromium } = require('playwright');
const [out, fixture = 'cottage', ...viewsArg] = process.argv.slice(2);
const views = viewsArg.length ? viewsArg : ['front', 'oblique', 'entry'];
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${process.env.PARITY_URL ?? 'http://localhost:3000'}/dev/cottage-parity?fixture=${fixture}`, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(4000);
for (const v of ['v2', 'v3']) {
  await page.getByRole('button', { name: v.toUpperCase(), exact: true }).click();
  for (const view of views) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${fixture}-${v}-${view}.jpg`, quality: 80, clip: { x: 0, y: 48, width: 1400, height: 720 } });
  }
}
console.log(JSON.stringify(errors.slice(0, 8)));
await browser.close();
