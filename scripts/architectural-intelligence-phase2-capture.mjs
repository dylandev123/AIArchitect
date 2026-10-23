// Isolated browser storage and generated fixtures only. All provider/project API writes forbidden.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const base = process.env.PHASE2_STUDIO_URL ?? 'http://127.0.0.1:3176';
const root = 'docs/architecture/architectural-blueprint-pipeline/phase-2', out = `${root}/ui`;
mkdirSync(out, {recursive: true});
const checks = JSON.parse(readFileSync(`${root}/checks.json`, 'utf8'));
const projects = checks.examples.flatMap((example, i) => ['saved', 'constructed'].map((stage, j) => {
  const houseConfigJson = readFileSync(`${root}/${example.name}.${stage}.json`, 'utf8');
  return {id: `phase2-${example.name}-${stage}`, name: `Offline ${example.name} ${stage}`, projectType: 'villa', generationMode: 'v3-scene', v3TerrainMode: 'flat',
    createdAt: 1 + 2 * i + j, updatedAt: 1 + 2 * i + j, houseConfigJson,
    versions: [{id: `initial-${i}-${j}`, createdAt: 1, summary: 'Independent offline fixture', houseConfigJson}], currentVersionIndex: 0};
}));
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const errors = [], forbidden = [], captures = [], verified = [];
try {
  const context = await browser.newContext({viewport: {width: 1800, height: 1120}}), page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || request.method() !== 'GET') {forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();}
    if (url.pathname === '/api/ai/plan') return route.fulfill({json: {enabled: false, model: 'offline-only', maxOutputTokens: 10000, pricing: null}});
    if (url.pathname.startsWith('/api/')) return route.fulfill({json: {assets: [], catalog: [], queue: [], glbIds: [], admin: false}});
    return route.continue();
  });
  await page.goto(base, {waitUntil: 'networkidle'});
  await page.evaluate(projects => localStorage.setItem('ai-architect-projects', JSON.stringify({state: {projects}, version: 6})), projects);
  const saved = id => page.evaluate(id => JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p => p.id === id), id);
  const capture = async name => {const path = `${out}/${name}.png`; await page.screenshot({path}); captures.push(path);};
  for (const example of checks.examples) {
    const plan = projects.find(p => p.id === `phase2-${example.name}-saved`);
    await page.goto(`${base}/workspace/${plan.id}`, {waitUntil: 'networkidle', timeout: 90000});
    await page.getByRole('button', {name: '2D Floor Plan', exact: true}).click();
    await page.getByLabel('Plan floor', {exact: true}).selectOption('site');
    await page.locator('[data-testid="architectural-floor-plan"]').waitFor();
    await capture(`${example.name}-master`);
    await page.getByLabel('Plan floor', {exact: true}).selectOption('0');
    await page.getByLabel('Plan building', {exact: true}).selectOption(example.buildings[0].id);
    await page.getByText('Review the architecture', {exact: true}).click();
    await capture(`${example.name}-floor-0`);
    if (example.buildings[0].storeys > 1) {
      await page.getByLabel('Plan floor', {exact: true}).selectOption('1');
      await capture(`${example.name}-floor-1`);
    }
    await page.reload({waitUntil: 'networkidle'});
    assert.equal((await saved(plan.id)).houseConfigJson, plan.houseConfigJson);
    assert.deepEqual((await saved(plan.id)).versions, plan.versions);
    const built = projects.find(p => p.id === `phase2-${example.name}-constructed`);
    await page.goto(`${base}/workspace/${built.id}`, {waitUntil: 'networkidle', timeout: 90000});
    await page.getByRole('button', {name: 'Finished House', exact: true}).click();
    await page.locator('canvas').waitFor();
    const webgl = await page.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      return gl ? {width: canvas.width, height: canvas.height, version: gl.getParameter(gl.VERSION)} : null;
    });
    assert(webgl && webgl.width > 0 && webgl.height > 0);
    await capture(`${example.name}-constructed`);
    assert.equal((await saved(built.id)).houseConfigJson, built.houseConfigJson);
    verified.push({name: example.name, isolatedSavedBlueprintReload: true, versionsUnchanged: true, planGeometryUnchanged: true, finishedGeometryUnchanged: true, webgl});
  }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
  writeFileSync(`${out}/checks.json`, JSON.stringify({result: 'PASS', providerCalls: 0, existingProjectsAccessed: false, errors, forbidden, verified, captures}, null, 2) + '\n');
  console.log(JSON.stringify({result: 'PASS', examples: verified.length, screenshots: captures.length, providerCalls: 0}));
} finally {await browser.close();}
