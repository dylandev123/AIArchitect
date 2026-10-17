// Offline production-renderer replay of the captured AI mansions (no provider calls; DEV camera hook only).
// usage: PLAYWRIGHT_DIR=… node scripts/presentation-capture.mjs <baseUrl> <outDir> [ids]
// Each fixture is seeded unmodified into an isolated localStorage project, opened at /workspace/<id>, and shot from
// exact world-space cameras via the `v3-replay-camera` event. The persisted houseConfigJson is compared afterwards.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(`${process.env.PLAYWRIGHT_DIR}/node_modules/`);
const { chromium } = require('playwright');
const [,, base = 'http://localhost:3000', out = 'docs/architecture/parity/presentation', only] = process.argv;
mkdirSync(out, { recursive: true });

// Arrival = the drive (−z) side, pool/garden = the +z side; cx/poolZ from each scene's authored layout.
const views = ({ cx, poolZ }) => ({
  arrival: { position: [cx + 16, 8.5, -50], target: [cx, 3.2, -2] },
  pool: { position: [cx - 18, 6.5, poolZ + 19], target: [cx + 2, 2.6, poolZ - 8] },
  aerial: { position: [cx + 48, 58, 52], target: [cx, 0, 2] },
});
const FIXTURES = {
  f2149916: { cx: 0, poolZ: 17.2 },
  '91d583fe': { cx: 0, poolZ: 18 },
  '9646933e': { cx: -3, poolZ: 23, extra: { 'sky-terrace': { position: [40, 15, 20], target: [14, 4.6, 0] } } },
};

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const report = {};
try {
  for (const [fid, layout] of Object.entries(FIXTURES)) {
    if (only && !only.split(',').includes(fid)) continue;
    const cfg = readFileSync(`src/lib/v3/__tests__/fixtures/mansions/mansion-${fid}.json`, 'utf8');
    const id = `replay-${fid}`, errors = [];
    const project = { id, name: `Mansion ${fid} (replay)`, createdAt: 0, updatedAt: 0, projectType: 'house', generationMode: 'v3-scene', v3TerrainMode: 'flat', houseConfigJson: cfg, versions: [{ id: 'v0', createdAt: 0, summary: 'replay', houseConfigJson: cfg }], currentVersionIndex: 0, timeOfDay: 'midday' };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => /\/api\/ai|openai|terra/i.test(r.request().url()) ? (errors.push('blocked ' + r.request().url()), r.abort()) : r.continue());
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([p]) => localStorage.setItem('ai-architect-projects', JSON.stringify({ state: { projects: [p] }, version: 6 })), [project]);
    await page.goto(`${base}/workspace/${id}`, { waitUntil: 'networkidle', timeout: 180000 });
    await page.waitForFunction(() => document.querySelector('canvas')?.width > 0, null, { timeout: 90000 });
    await page.waitForTimeout(12000);
    for (const [name, camera] of Object.entries({ ...views(layout), ...layout.extra })) {
      await page.evaluate(detail => window.dispatchEvent(new CustomEvent('v3-replay-camera', { detail })), camera);
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${out}/${fid}-${name}.jpg`, quality: 85 });
    }
    const persisted = await page.evaluate(([pid]) => JSON.parse(localStorage.getItem('ai-architect-projects') ?? '{}').state?.projects?.find(p => p.id === pid)?.houseConfigJson, [id]);
    report[fid] = { errors, persistedUnchanged: persisted === cfg };
    await page.close();
  }
} finally { console.log(JSON.stringify(report, null, 1)); await browser.close(); }
