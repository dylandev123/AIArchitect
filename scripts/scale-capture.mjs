/** Phase 2 scale study: renders saved scenes through the normal ArchitecturalScene viewer (local dev server only; every
 * non-localhost request and every /api/ call is blocked) and measures rendering cost: load time, WebGL draw calls per
 * frame and frame intervals. Fails on any console error.
 * Usage: node scripts/scale-capture.mjs <file-param> <out-basename> <site WxD> [views] */
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH ?? '/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const [file, base, site] = process.argv.slice(2), outDir = 'docs/architecture/automatic-house/scale-2';
assert(/^[a-z0-9._-]+\.scene\.json$/.test(file ?? '') && /^[a-z0-9-]+$/.test(base ?? '') && /^\d+x\d+$/.test(site ?? ''), 'usage: scale-capture.mjs <file> <basename> <WxD> [views]');
const views = (process.argv[5] ?? 'Arrival,Aerial,Garden,Poolside,Same scale').split(',');
const browser = await chromium.launch({headless: false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--headless=new', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']});
const errors = [], perf = {file, site, views: {}};
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}, deviceScaleFactor: 2});
  // Count every WebGL draw call (all meshes, shadow passes included).
  await page.addInitScript(() => {
    window.__draws = 0;
    for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = P[m]; if (!f) continue; P[m] = function (...a) { window.__draws++; return f.apply(this, a); };
    }
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/*', r => { const u = new URL(r.request().url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname.startsWith('/api/')) return r.abort(); return r.continue(); });
  const t0 = Date.now();
  await page.goto(`http://localhost:3015/dev/staged-villa?file=${file}&site=${site}`, {waitUntil: 'networkidle', timeout: 240000});
  await page.locator('canvas').waitFor({timeout: 120000});
  perf.loadMs = Date.now() - t0;
  const sample = () => page.evaluate(() => new Promise(done => {
    const start = window.__draws, times = []; let last = performance.now(), n = 0;
    const tick = now => { times.push(now - last); last = now; if (++n < 90) requestAnimationFrame(tick); else { times.sort((a, b) => a - b); done({frames: n, drawCallsPerFrame: Math.round((window.__draws - start) / n), medianFrameMs: +times[Math.floor(n / 2)].toFixed(1), p95FrameMs: +times[Math.floor(n * .95)].toFixed(1)}); } };
    requestAnimationFrame(tick);
  }));
  for (const view of views) {
    await page.getByRole('button', {name: view, exact: true}).click(); await page.waitForTimeout(4000);
    perf.views[view] = await sample();
    await page.screenshot({path: `${outDir}/${base}-${view.toLowerCase().replace(/ /g, '-')}.png`, clip: {x: 150, y: 360, width: 1200, height: 520}});
  }
  perf.elements = await page.evaluate(() => Number(document.body.innerText.match(/(\d+) editable elements/)?.[1]));
  console.log('captured', base, JSON.stringify(perf), '| browser errors:', errors.length, errors.slice(0, 5));
  writeFileSync(`${outDir}/${base}.render-perf.json`, JSON.stringify(perf, null, 1));
  assert.deepEqual(errors.filter(e => !/favicon|Failed to load resource.*(aborted|ERR_FAILED)/.test(e)), []);
} finally { await browser.close(); }
