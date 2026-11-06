/** Stage 5 OFFLINE SOFTWARE landscape rehearsal on the actual Terra house. No paid calls. APIs stubbed/blocked. */
import {createRequire} from 'node:module';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH ?? '/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const tag = process.argv[2] ?? 'offline-preview-1';
assert(/^[a-z0-9-]+$/.test(tag));
const dir = 'docs/architecture/staged-villa/stage5-site';
const originals = process.argv.includes('--baseline');
const detail = process.argv.includes('--entry-detail');
const performanceOnly=process.argv.includes('--performance-only');
const captureTag = process.argv.find(a => a.startsWith('--capture='))?.slice('--capture='.length);
assert(!captureTag || /^[a-z0-9-]+$/.test(captureTag));
const base = captureTag ?? ((originals ? `${tag}-baseline` : tag) + (detail ? '-detail' : performanceOnly?'-performance':''));
const matchTag = process.argv.find(a => a.startsWith('--match='))?.slice('--match='.length);
assert(!matchTag || /^[a-z0-9-]+$/.test(matchTag));
const matched = originals || matchTag ? JSON.parse(readFileSync(`${dir}/${matchTag ?? tag}-browser.json`)).captures : undefined;
const file = originals ? 'stage4-corrections_corrected-v5' : `stage5-site_${tag}`;
const scene = JSON.parse(readFileSync(originals ? 'docs/architecture/staged-villa/stage4-corrections/corrected-v5.scene.json' : `${dir}/${tag}.scene.json`));
const views = detail ? ['Entry'] : performanceOnly?['Poolside']:['Arrival', 'Aerial', 'Garden', 'Poolside'];
for (const v of [...views.map(v => v.toLowerCase()), 'browser']) assert(!existsSync(`${dir}/${base}-${v}.${v === 'browser' ? 'json' : 'png'}`), 'Choose a new capture tag; evidence exists.');
const browser = await chromium.launch({headless: false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--headless=new', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist']});
const errors = [], failures = [], blocked = [], stubs = [], badResponses = [], resources = [], captures = [];
try {
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}, deviceScaleFactor: 2});
  await page.addInitScript(() => {
    window.__stage4ContextLost = false;
    document.addEventListener('webglcontextlost', () => { window.__stage4ContextLost = true; }, true);
  });
  page.on('pageerror', e => errors.push({type: 'pageerror', text: String(e)}));
  page.on('console', m => { if (m.type() === 'error') errors.push({type: 'console', text: m.text(), location: m.location()}); });
  page.on('requestfailed', r => failures.push({url: r.url(), type: r.resourceType(), failure: r.failure(), initiator: r.frame()?.url()}));
  page.on('response', r => { resources.push({url: r.url(), status: r.status()}); if (r.status() >= 400) badResponses.push({url: r.url(), status: r.status()}); });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url());
    // RootLayout's AssetLibrarySync is unrelated to this saved scene. Respond locally; never contact its database.
    if (['127.0.0.1', 'localhost'].includes(u.hostname) && u.pathname === '/api/assets' && r.request().method() === 'GET') {
      stubs.push({url: u.href, response: 'empty offline catalog', reason: 'global asset-library hydration; scene uses bundled local textures only'});
      return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({catalog: [], queue: [], glbIds: []})});
    }
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.pathname.startsWith('/api/')) {
      blocked.push({url: u.href, type: r.request().resourceType()});
      return r.abort();
    }
    return r.continue();
  });
  await page.goto(`http://127.0.0.1:3016/dev/staged-villa?file=${file}.scene.json`, {waitUntil: 'networkidle', timeout: 240000});
  await page.locator('canvas').waitFor({timeout: 120000});
  for (const view of views) {
    await page.getByRole('button', {name: detail ? 'Arrival' : view, exact: true}).click();
    await page.waitForTimeout(3500);
    if (matched) {
      const expected = matched.find(c => c.view === view);
      assert(expected);
      await page.locator('canvas').evaluate((canvas, camera) => {
        let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber$'))];
        while (fiber) {
          let hook = fiber.memoizedState;
          while (hook) {
            const ref = hook.memoizedState?.current, state = ref?.get ? ref.get() : ref;
            if (state?.scene?.isScene) {
              state.controls.target.set(...camera.target); state.camera.position.set(...camera.camera);
              state.controls.update(); state.invalidate(); return;
            }
            hook = hook.next;
          }
          fiber = fiber.return;
        }
        throw Error('R3F state missing');
      }, expected);
      await page.waitForTimeout(300);
    }
    if (detail) {
      await page.locator('canvas').evaluate((canvas, doorId) => {
        let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber$'))];
        while (fiber) {
          let hook = fiber.memoizedState;
          while (hook) {
            const ref = hook.memoizedState?.current, state = ref?.get ? ref.get() : ref;
            if (state?.scene?.isScene) {
              const door = state.scene.getObjectByName(`operation:${doorId}`);
              const p = door.getWorldPosition(door.position.clone());
              state.controls.target.set(p.x, p.y + 0.3, p.z);
              state.camera.position.set(p.x - 5, p.y + 2.5, p.z - 12);
              state.controls.update(); state.invalidate(); return;
            }
            hook = hook.next;
          }
          fiber = fiber.return;
        }
        throw Error('Missing entrance scene');
      }, scene.elements.find(e => e.semanticType === 'front-door').id);
      await page.waitForTimeout(500);
    }
    const rendered = await page.locator('canvas').evaluate(canvas => {
      let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber$'))];
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook) {
          const ref = hook.memoizedState?.current, state = ref?.get ? ref.get() : ref;
          if (state?.scene?.isScene) {
            const elements = [], invalid = [], materials = [];
            const activeGeometry=new Set();let operationMeshes=0,operationTriangleUpperBound=0,instancedBatches=0;
            state.scene.traverse(o => {
              if (o.name.startsWith('operation:')) elements.push({id: o.name.slice(10), at: o.position.toArray(), rotation: o.rotation.y});
              if (o.isMesh) {
                let parent=o.parent;while(parent&&!parent.name.startsWith('operation:'))parent=parent.parent;
                if(parent){operationMeshes++;activeGeometry.add(o.geometry.uuid);operationTriangleUpperBound+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(o.isInstancedMesh)instancedBatches++;}
                if (o.geometry.attributes.position?.array.some(n => !Number.isFinite(n))) invalid.push(o.name);
                if (o.material?.map) materials.push({id: o.name || o.userData.id, parent: o.parent?.name, color: o.material.color.getHexString(), roughness: o.material.roughness, metalness: o.material.metalness, map: true, normal: !!o.material.normalMap, bump: !!o.material.bumpMap});
              }
            });
            return {elements, invalid, materials, activeGeometry:{operationMeshes,uniqueGeometry:activeGeometry.size,triangleUpperBound:operationTriangleUpperBound,instancedBatches},renderInfoLastPostprocessPass:{calls:state.gl.info.render.calls,triangles:state.gl.info.render.triangles,cachedGeometries:state.gl.info.memory.geometries,textures:state.gl.info.memory.textures}, camera: state.camera.position.toArray(), target: state.controls.target.toArray(), contextLost: state.gl.getContext().isContextLost() || window.__stage4ContextLost};
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      throw Error('R3F state missing');
    });
    assert.equal(rendered.contextLost, false);
    if (matched) {
      const expected = matched.find(c => c.view === view);
      for (const key of ['camera', 'target']) for (let i = 0; i < 3; i++) assert(Math.abs(rendered[key][i] - expected[key][i]) < 1e-8, `${view} ${key} changed during capture`);
    }
    assert.deepEqual(rendered.invalid, []);
    assert.deepEqual(rendered.elements.map(e => e.id).sort(), scene.elements.map(e => e.id).sort());
    for (const e of rendered.elements) {
      const original = scene.elements.find(o => o.id === e.id);
      assert.deepEqual(e.at, original.at);
      assert.equal(e.rotation, original.rotation);
    }
    // Preserve the original crop for direct comparison; also save a complete canvas image.
    await page.screenshot({path: `${dir}/${base}-${view.toLowerCase()}.png`, clip: {x: 150, y: 330, width: 1200, height: 520}});
    const fullPath = `${dir}/${base}-${view.toLowerCase()}-full.png`;
    assert(!existsSync(fullPath));
    await page.locator('canvas').screenshot({path: fullPath});
    captures.push({view, ...rendered});
  }
  const frameTimes=await page.evaluate(async()=>{const samples=[];let previous=performance.now();for(let i=0;i<50;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>4)samples.push(now-previous);previous=now;}samples.sort((a,b)=>a-b);return {samples:samples.length,medianMs:samples[Math.floor(samples.length/2)],p95Ms:samples[Math.floor(samples.length*.95)]};});
  const report = {provenance:tag==='terra-stage5'&&!originals?'REAL Terra house and LIVE Terra Stage 5 landscape':originals?'REAL Terra corrected Stage 4 house':'REAL Terra house; SOFTWARE landscape rehearsal',frameTimes,source: file, sceneElements: scene.elements.length, errors, failures, blocked, stubs, badResponses, resources, captures};
  writeFileSync(`${dir}/${base}-browser.json`, JSON.stringify(report, null, 2), {flag: 'wx'});
  console.log(JSON.stringify({elements: scene.elements.length, errors, failures, blocked, stubs, badResponses, frameTimes, views: captures.map(c => ({view: c.view, rendered: c.elements.length, contextLost: c.contextLost}))}, null, 2));
  assert.equal(errors.length, 0, 'Inspect browser evidence for exact failing resource.');
  assert.equal(failures.length, 0);
  assert.equal(badResponses.length, 0);
} finally { await browser.close(); }
