import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory = 'docs/villa-playground/compositions';
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], checks = [], requests = [];
try {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1050 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('request',r=>{if(r.url().includes('/api/ai/')) requests.push(r.url());});
  page.on('pageerror', e => errors.push(String(e)));
  page.setDefaultTimeout(90000);
  // Inspect the actually mounted R3F scene, not an expected config or a synthetic image.
  async function mounted() {
    return page.locator('canvas').evaluate(c => {
      let fiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber$'))];
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook) {
          const state = hook.memoizedState?.current;
          if (state?.scene?.isScene) {
            const meshes = [], groups = [], planters = [];
            state.scene.traverse(o => { if (o.isMesh && o.visible) meshes.push({ name: o.name, vertices: o.geometry?.attributes.position?.count }); if (o.isGroup && o.name) groups.push(o.name); if(o.name === "Raised tropical planting bed") planters.push(o); });
            const plantingReady=planters.length>0 && planters.every(p=>p.children.filter(o=>o.isGroup).every(o=>o.children.length>0));
            return { plantingReady, meshes: meshes.length, vertices: meshes.reduce((s, m) => s + (m.vertices ?? 0), 0), groups, camera: state.camera.position.toArray() };
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return null;
    });
  }
  for (const [id, label] of [['compact-l','Compact L'], ['courtyard-u','Courtyard U'], ['pavilion-estate','Pavilion estate']]) {
    if(process.env.COMPOSITION && process.env.COMPOSITION !== id) continue;
    await page.goto(`${process.env.VILLA_URL ?? 'http://127.0.0.1:3107/dev/villa-playground'}?composition=${id}`, {waitUntil:'domcontentloaded',timeout:120000});
    await page.locator('canvas').waitFor();
    await page.waitForTimeout(3500);
    let scene;
    for(let attempt=0;attempt<180;attempt++) {
      scene=await mounted();
      if(scene?.plantingReady && scene.meshes>100 && scene.groups.includes(`Local composition · ${id}`)) break;
      await page.waitForTimeout(500);
    }
    if(!scene || scene.meshes<100) { await page.screenshot({path:`${directory}/capture-failure.jpg`}); console.log(JSON.stringify({errors,scene})); }
    assert(scene?.meshes>100 && scene.plantingReady, "Building and planting must both finish loading");
    assert(scene.groups.includes(`Local composition · ${id}`));
    for (const view of ['Poolside','Arrival','Garden','Above']) {
      await page.getByRole('button',{name:view,exact:true}).click({force:true});
      await page.waitForTimeout(4000);
      const frame=await mounted();
      assert(frame?.meshes>100,`Blank scene: ${id}/${view}`);
      const factor=id==='compact-l'?.92:1.18;
      const expected={Poolside:[33,15.5,43],Arrival:[-38,14,36],Garden:[30,17,-31],Above:[29,39,33]}[view].map(n=>n*factor);
      assert(frame.camera.every((n,i)=>Math.abs(n-expected[i])<.05),`Camera did not settle: ${id}/${view}`);
      checks.push({id,view,camera:frame.camera,meshes:frame.meshes});
      await page.screenshot({path:`${directory}/${id}-${view.toLowerCase()}.jpg`,type:'jpeg',quality:93});
    }
    checks.push({id,scene});
  }

  if(process.env.COMPOSITION && existsSync(`${directory}/browser-checks.json`)) {
    const prior=JSON.parse(readFileSync(`${directory}/browser-checks.json`,'utf8'));
    checks.unshift(...prior.checks.filter(c=>c.id!==process.env.COMPOSITION));
  }
  writeFileSync(`${directory}/browser-checks.json`, JSON.stringify({ provenance: 'Actual local R3F WebGL renders. No intercepted villa responses.', errors, checks, aiRequests: requests }, null, 2) + '\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log(JSON.stringify({errors,views:checks.filter(c=>c.view),requests}));
} finally { await browser.close(); }
