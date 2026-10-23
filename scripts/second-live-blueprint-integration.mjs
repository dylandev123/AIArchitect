// Run after next build. This launches the ordinary production server with an
// offline provider transport preload, then generates through the real UI/API.
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright node scripts/second-live-blueprint-integration.mjs ORIGINAL OUT UNRELATED_DRAFT
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [originalPath, outputPath, unrelatedPath] = process.argv.slice(2);
if (!originalPath || !outputPath || !unrelatedPath) throw Error('Expected ORIGINAL OUT UNRELATED_DRAFT');
const out = resolve(outputPath), original = readFileSync(originalPath, 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
assert.equal(hash(original), 'b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb');
const blueprint = JSON.parse(original);
mkdirSync(out, { recursive: true });
const providerLog = `${out}/mock-provider.jsonl`;
writeFileSync(providerLog, '');
const serverLog = openSync(`${out}/server.log`, 'w');
const port = process.env.REPLAY_PORT ?? '3127', base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import', resolve('scripts/offline-blueprint-provider.mjs'), 'node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], {
  env: { ...process.env, OFFLINE_BLUEPRINT_INPUTS: JSON.stringify([resolve(originalPath), resolve(unrelatedPath)]), OFFLINE_BLUEPRINT_LOG: providerLog },
  stdio: ['ignore', serverLog, serverLog],
});
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
let browser;
const captures = [], errors = [], unexpectedRequests = [], responses = [];
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error('Production server exited: ' + readFileSync(`${out}/server.log`, 'utf8'));
    try { if ((await fetch(base + '/api/ai/house')).ok) { ready = true; break; } } catch {}
    await delay(500);
  }
  assert(ready, 'Production server did not start');
  const flags = await (await fetch(base + '/api/ai/house')).json();
  assert.equal(flags.architecturalBlueprint.enabledForNewFlatGenerations, true);
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}), args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1120 } });
  // Observe every project-storage write to prove geometry/status/version arrive
  // atomically. Never insert a constructed scene into browser storage.
  await context.addInitScript(() => {
    window.__projectWrites = [];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ai-architect-projects') window.__projectWrites.push(JSON.parse(value));
      return set.call(this, key, value);
    };
    // Read the actual mounted Three scene through Canvas's existing React ref.
    // No test renderer, application hook or seeded geometry is involved.
    window.__offlineMountedScene = () => {
      const canvas=document.querySelector('canvas');
      let fiber=canvas?.[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
      while(fiber){
        let hook=fiber.memoizedState;
        while(hook){
          const state=hook.memoizedState?.current;
          if(state?.scene?.isScene){
            const meshes=[];
            state.scene.traverse(o=>{if(o.isMesh&&o.visible&&o.userData?.id)meshes.push({id:o.userData.id,vertices:o.geometry?.attributes?.position?.count});});
            return {meshes,calls:state.gl.info.render.calls,triangles:state.gl.info.render.triangles};
          }
          hook=hook.next;
        }
        fiber=fiber.return;
      }
      return null;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    // Only the generation API under test reaches the server. Shared asset and
    // library services are empty offline peripherals, never real account data.
    if (u.origin === base && u.pathname.startsWith('/api/') && u.pathname !== '/api/ai/house') {
      if (route.request().method() === 'GET') return route.fulfill({ json: { catalog: [], queue: [], glbIds: [], materials: [], assets: [] } });
      unexpectedRequests.push(`${route.request().method()} ${u.pathname}`); return route.abort();
    }
    if (u.origin !== base && !['data:', 'blob:'].includes(u.protocol)) { unexpectedRequests.push(u.origin + u.pathname); return route.abort(); }
    return route.continue();
  });
  const saved = async id => page.evaluate(id => JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p => p.id === id), id);
  const rootOf = p => JSON.parse(p.houseConfigJson);
  const generate = async brief => {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByLabel('Experimental V3 scene mode', { exact: true }).check();
    await page.getByRole('textbox', { name: 'Describe your dream home', exact: true }).fill(brief);
    const pending = page.waitForResponse(r => r.url() === base + '/api/ai/house' && r.request().method() === 'POST', { timeout: 120000 });
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    const response = await pending, body = await response.json(), request = response.request().postDataJSON();
    assert.equal(response.status(), 200, JSON.stringify(body));
    assert.equal(response.headers()['x-ai-architect-pipeline'], 'v3-architectural-blueprint-1');
    assert.equal(request.mode, 'generate'); assert.equal(request.generationMode, 'v3-scene');
    assert.equal(request.v3TerrainMode, 'flat'); assert.equal(JSON.parse(request.currentHouseJson).v3Scene.objects.length, 0);
    responses.push({ status: response.status(), pipeline: response.headers()['x-ai-architect-pipeline'], outcome: body.outcome, requestMode: request.mode, projectId: request.projectId });
    await page.getByText('Draft — Needs Refinement', { exact: true }).waitFor();
    await page.waitForFunction(id => {
      const p = JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p => p.id === id);
      return p.versions.length === 2 && p.versions.at(-1).houseConfigJson === p.houseConfigJson;
    }, request.projectId);
    return { id: request.projectId, body };
  };
  const capture = async name => {
    await page.waitForFunction(() => document.querySelector('canvas')?.width > 1000);
    await page.waitForTimeout(1800);
    const webgl = await page.locator('canvas').evaluate(c => {
      const gl = c.getContext('webgl2');
      return gl && { width: c.width, height: c.height, version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER) };
    });
    assert(webgl, 'Production WebGL 2 required');
    await page.waitForFunction(()=>window.__offlineMountedScene()?.meshes.length>100);
    const mounted=await page.evaluate(()=>window.__offlineMountedScene());
    if(!name.startsWith('unrelated-')){
      for(const id of ['main-villa','guest-pavilion','main-villa-roof','guest-pavilion-roof','sunset-terrace','infinity-pool'])assert(mounted.meshes.some(m=>m.id.startsWith(id)),`Missing mounted WebGL geometry: ${id}`);
      assert(mounted.meshes.some(m=>m.id.startsWith('main-villa:terrace-door-great:level-0:')));
      if(!['service-windows-refined','edited-draft-reloaded'].includes(name)){
        assert(!mounted.meshes.some(m=>m.id.startsWith('main-villa:main-entry-door:level-0:')));
        assert(mounted.meshes.some(m=>m.id.startsWith('main-villa:east:level-0:wall:cell-')));
      }else assert(mounted.meshes.some(m=>m.id==='main-villa:main-entry-door:level-0:door-frame'));
    }
    const path = `${out}/${name}.jpg`;
    await page.screenshot({ path, quality: 94 }); captures.push({ name, path: `${outputPath}/${name}.jpg`, sha256: hash(readFileSync(path)), webgl, mounted });
  };

  // Seed one valid unrelated blank project as an isolation sentinel. It never
  // receives a prompt. The generated property is created only by the real UI.
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const json = JSON.stringify({ version: 3, generationMode: 'v3-scene', v3Scene: { version: 3, site: { width: 180, depth: 180, baseElevation: 0 }, objects: [], relationships: [], metadata: {} } });
    const p = { id: 'offline-existing-sentinel', name: 'Unrelated isolated project', projectType: 'house', generationMode: 'v3-scene', v3TerrainMode: 'flat', houseConfigJson: json, createdAt: 1, updatedAt: 1, versions: [{ id: 'sentinel-version', createdAt: 1, summary: 'Blank project', houseConfigJson: json }], currentVersionIndex: 0 };
    localStorage.setItem('ai-architect-projects', JSON.stringify({ state: { projects: [p] }, version: 6 }));
  });
  const sentinel = await saved('offline-existing-sentinel');
  const mansion = await generate('A luxury Saint Lucia estate with a main villa, guest pavilion, terrace, infinity pool and gardens.');
  const project = await saved(mansion.id), root = rootOf(project), scene = root.v3Scene;
  assert.equal(scene.metadata.architecturalValidation.status, 'draft');
  assert.equal(scene.objects.length, 11);
  const subset = (actual, expected) => {
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value, key);
  };
  const material = id => blueprint.materials.find(m => m.id === id);
  for (const b of blueprint.buildings) {
    const mass = scene.objects.find(o => o.id === b.id), roof = scene.objects.find(o => o.id === b.roof.id);
    assert.equal(b.plan.kind, 'rectangle');
    assert.deepEqual(mass.architecture, { ...b.location, width: b.plan.width, depth: b.plan.depth, height: b.storeys.reduce((sum, s) => sum + s.height, 0) });
    subset(mass.composition, b.facade); subset(mass.material, material(b.materialId));
    assert.equal(roof.architecture.baseElevation, b.location.baseElevation + mass.architecture.height);
    assert.equal(roof.architecture.height, b.roof.thickness);
    assert.equal(roof.roofForm, b.roof.form); assert.equal(roof.pitch, b.roof.pitchDegrees); assert.equal(roof.overhang, b.roof.overhang);
    subset(roof.material, material(b.roof.materialId));
  }
  for (const f of blueprint.features) {
    const object = scene.objects.find(o => o.id === f.id);
    assert.equal(object.type, f.type);
    assert.deepEqual(object.architecture, { ...f.location, width: f.width, depth: f.depth, height: f.height });
    subset(object.material, material(f.materialId));
  }
  for (const c of blueprint.connections) {
    const route = scene.estatePlan.circulation.find(r => r.id === c.id);
    assert.deepEqual(route.via, [c.surfaceId]);
    subset(route.spatial, { width: c.width, use: c.use, waypoints: c.waypoints });
    subset(scene.objects.find(o => o.id === route.via[0]).material, material(c.materialId));
  }
  assert.deepEqual(scene.estatePlan.blueprint.entrances, blueprint.entrances);
  assert.deepEqual(scene.interior.circulation, blueprint.verticalCirculation);
  assert.deepEqual(scene.interior.storeys.map(s => s.height), [4.2, 3.6, 3.5]);
  assert.deepEqual(scene.interior.partitions, blueprint.partitions); assert.deepEqual(scene.interior.doors, blueprint.doors);
  assert.deepEqual(scene.estatePlan.zones, blueprint.zones);
  assert.deepEqual(scene.interior.rooms.map(r => r.footprint), blueprint.buildings.flatMap(b => b.storeys.flatMap(s => s.spaces.map(r => r.footprint))));
  // Commit deliberately revalidates current semantics. Ingestion-only identity
  // notices may disappear; geometry and all other scene metadata must match.
  const withoutValidation = s => { const copy = structuredClone(s); delete copy.metadata.architecturalValidation; return copy; };
  assert.deepEqual(withoutValidation(scene), withoutValidation(JSON.parse(mansion.body.json).v3Scene));
  assert(scene.metadata.architecturalValidation.diagnostics.some(d => d.classification === 'draft-tolerable'));
  assert(scene.metadata.architecturalValidation.diagnostics.every(d => d.classification !== 'core-blocking' && d.targetIds.length));
  assert(scene.metadata.architecturalValidation.diagnostics.some(d=>d.code==='ARCHITECTURAL_OPENING_OVERLAP'));
  assert.deepEqual(scene.objects.find(o=>o.id==='main-villa').composition.openings,blueprint.buildings[0].facade.openings);
  const writes = await page.evaluate(() => window.__projectWrites);
  const constructedWrites = writes.flatMap(w => w.state.projects.filter(p => p.id === mansion.id)).filter(p => JSON.parse(p.houseConfigJson).v3Scene.objects.length);
  assert(constructedWrites.length);
  for (const p of constructedWrites) {
    assert.equal(rootOf(p).v3Scene.metadata.architecturalValidation.status, 'draft');
    assert.equal(p.versions.at(-1).houseConfigJson, p.houseConfigJson);
    assert.equal(rootOf(p).v3Scene.objects.length, 11);
  }
  writeFileSync(`${out}/api-mansion.json`, mansion.body.json);
  await capture('api-generated-mansion');
  await page.getByTitle('Top-down / plan', { exact: true }).click();
  await page.waitForTimeout(1400);
  let box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .5);
  await page.mouse.wheel(0, 350); await capture('property-plan');
  await page.getByTitle('Full site view', { exact: true }).click();
  await page.waitForTimeout(1400);
  box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width * .55, box.y + box.height * .55);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .9, box.y + box.height * .58, { steps: 40 }); await page.mouse.up();
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(90); }
  await capture('ocean-facades-pool-and-guest');
  await page.getByTitle('Full site view', { exact: true }).click();
  await page.waitForTimeout(1400);
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(90); }
  await capture('entrances-and-roofs');
  assert.equal((await saved(mansion.id)).houseConfigJson, project.houseConfigJson);
  await page.getByTitle('Full site view', { exact: true }).click();
  await page.getByText(/^Object diagnostics \(/).click();
  await page.getByRole('button', { name: 'service-window-rhythm', exact: true }).first().click();
  await page.getByRole('button', { name: /Advanced Properties/ }).click();
  await page.getByLabel('Opening count', {exact:true}).waitFor();
  await capture('unresolved-opening-inspector');
  await page.getByLabel('Opening floors', {exact:true}).selectOption('upper');
  await page.waitForFunction(id=>{
    const scene=JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id).houseConfigJson).v3Scene;
    return scene.objects.find(o=>o.id==='main-villa').composition.openings.find(o=>o.id==='service-window-rhythm').floors==='upper';
  },mansion.id);
  await page.getByRole('button', { name: 'Revalidate construction', exact: true }).click();
  const edited = await saved(mansion.id), refined=rootOf(edited).v3Scene;
  assert.equal(edited.versions.at(-1).houseConfigJson, edited.houseConfigJson);
  assert.equal(refined.metadata.architecturalValidation.status, 'draft');
  assert(!refined.metadata.architecturalValidation.diagnostics.some(d=>d.code==='ARCHITECTURAL_OPENING_OVERLAP'));
  const expected=structuredClone(scene);
  expected.objects.find(o=>o.id==='main-villa').composition.openings.find(o=>o.id==='service-window-rhythm').floors='upper';
  assert.deepEqual(withoutValidation(refined),withoutValidation(expected));
  await capture('service-windows-refined');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('Draft — Needs Refinement', { exact: true }).waitFor();
  assert.equal((await saved(mansion.id)).houseConfigJson, edited.houseConfigJson);
  await capture('edited-draft-reloaded');

  const generalized = await generate('An independent curved residence with an atelier, pool and covered outdoor living.');
  await page.getByText(/^Object diagnostics \(/).click();
  await page.getByRole('button', { name: 'conflicting-window', exact: true }).first().click();
  await page.getByRole('button', { name: /Advanced Properties/ }).click();
  await page.getByLabel('Opening facade', { exact: true }).selectOption('east');
  await page.getByText('Complete', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Revalidate construction', exact: true }).click();
  const complete = await saved(generalized.id);
  assert.equal(rootOf(complete).v3Scene.metadata.architecturalValidation.status, 'complete');
  assert.equal(complete.versions.at(-1).houseConfigJson, complete.houseConfigJson);
  await capture('unrelated-refined-complete');
  await page.reload({ waitUntil: 'networkidle' }); await page.getByText('Complete', { exact: true }).waitFor();
  assert.equal((await saved(generalized.id)).houseConfigJson, complete.houseConfigJson);
  await capture('unrelated-complete-reloaded');
  assert.deepEqual(await saved('offline-existing-sentinel'), sentinel);
  assert.equal((await saved(mansion.id)).houseConfigJson, edited.houseConfigJson);
  assert.equal(readFileSync(originalPath, 'utf8'), original);
  const provider = readFileSync(providerLog, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(provider.length, 2); assert(provider.every(p => 'mockedProviderResponse' in p));
  assert.deepEqual(errors, []); assert.deepEqual(unexpectedRequests, []);
  writeFileSync(`${out}/capture.json`, JSON.stringify({ runtime: 'next start (optimized production build)', flow: 'Landing Generate -> blank V3 project -> workspace pending brief -> requestHouseEdit -> HTTP POST /api/ai/house -> actual OpenAI SDK with offline transport response -> deterministic construction -> client appendVersion -> localStorage -> production WebGL', originalSha256: hash(original), providerCalls: 0, mockedProviderResponses: provider.length, mansionAuthoringResponses: 1, mansionRepairResponses: 0, flags, responses, atomicWritesVerified: true, isolatedBrowserStorage: true, unrelatedProjectUnchanged: true, mansionReloadIdentical: true, semanticInspectorEdit: { openingId: 'service-window-rhythm', floors: 'upper', allOtherSemanticsUnchanged: true, reloadPreserved: true }, mansionRevalidation: 'draft', unrelatedAfterFacadeRefinement: 'complete', completeReloadIdentical: true, objects: scene.objects.map(o => o.id), diagnostics: scene.metadata.architecturalValidation.diagnostics, captures, errors, unexpectedRequests }, null, 2) + '\n');
  console.log(JSON.stringify({ captures: captures.length, objects: scene.objects.length, outcome: 'draft', mockedProviderResponses: provider.length, providerCalls: 0 }));
} finally {
  await browser?.close(); server.kill('SIGTERM'); closeSync(serverLog);
}
