import { createRequire } from 'node:module'; import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(`${process.env.PLAYWRIGHT_DIR}/node_modules/`); const { chromium } = require('playwright');
const [,, cfgPath, out, drags] = process.argv; mkdirSync(out, { recursive: true });
const cfg = readFileSync(cfgPath, 'utf8'); const id = 'audit-f2149916';
const project = { id, name: 'Audit mansion (replay)', createdAt: Date.now(), updatedAt: Date.now(), projectType: 'house', generationMode: 'v3-scene', v3TerrainMode: 'flat', houseConfigJson: cfg, versions: [{ id: 'v0', createdAt: Date.now(), summary: 'replay', houseConfigJson: cfg }], currentVersionIndex: 0, timeOfDay: 'midday' };
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', r => /\/api\/ai|openai|terra/i.test(r.request().url()) ? (errors.push('blocked ' + r.request().url()), r.abort()) : r.continue());
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(([p]) => localStorage.setItem('ai-architect-projects', JSON.stringify({ state: { projects: [p] }, version: 6 })), [project]);
  await page.goto(`http://localhost:3000/workspace/${id}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, null, { timeout: 60000 });
  await page.waitForTimeout(10000);
  await page.screenshot({ path: `${out}/00-default.jpg`, quality: 85 });
  const box = await page.locator('canvas').first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.click(box.x+1290-288, box.y+118-48); await page.waitForTimeout(3000); await page.screenshot({ path: `${out}/00-house.jpg`, quality: 85 });
  for (const [name, dx, dy, wheel] of JSON.parse(drags)) {
    await page.mouse.click(1282,118); await page.waitForTimeout(2500); await page.mouse.move(cx, box.y+box.height-60); await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(cx + dx * i / 20, box.y+box.height-60 + dy * i / 20);
    await page.mouse.up();
    if (wheel) { await page.mouse.move(cx, cy); for (let i = 0; i < Math.abs(wheel); i++) { await page.mouse.wheel(0, Math.sign(wheel) * 100); await page.waitForTimeout(50); } }
    await page.keyboard.press('Escape'); await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${name}.jpg`, quality: 85 });
  }
} finally { console.log(JSON.stringify(errors)); await browser.close(); }
