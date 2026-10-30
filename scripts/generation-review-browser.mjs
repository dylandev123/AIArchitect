/** Offline transport fixtures exercise actual Generate, WebGL capture and version history. */
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH ?? '/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir = 'docs/architecture/generation-visual-loop'; mkdirSync(dir, { recursive: true });
const fixture = JSON.parse(readFileSync('docs/architecture/generation-quality/compact.mock-response.json', 'utf8'));
const target = fixture.scene.elements.find(e => e.kind === 'roof').id;
const categories = ['massing hierarchy','arrival facade','facade depth','roof composition','door and window quality','material coordination','pool and terrace relationship','garden/landscape completeness','camera composition','unfinished or disconnected elements'];
const browser = await chromium.launch({ headless: false, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist'] });
const calls = [], errors = [];
try {
 const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true });
 page.on('pageerror', error => errors.push(String(error)));
 await page.route('**/*', async route => {
  const u = new URL(route.request().url());
  const respond = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (u.pathname === '/api/ai/scene') return respond(route.request().method() === 'POST' ? fixture : { currentModel: 'OFFLINE FIXTURE' });
  if (u.pathname === '/api/ai/scene/visual-review') {
   const input = route.request().postDataJSON();
   calls.push({ phase: input.phase, pass: input.pass, ids: input.current.elements.map(e=>e.id), images: input.images?.length, previousImages: input.previousImages?.length });
   if (input.phase === 'review') {
    assert.equal(input.images.length, 4); assert(input.images.every(i=>i.startsWith('data:image/png;base64,')));
    return respond({ output: { assessments: categories.map(category=>({category,observation:'Offline fixture observation; no architectural quality claim.'})), findings: [{category:'material coordination',severity:'minor',targetIds:[target],observation:'Offline fixture finish correction',suggestedChange:'Change selected roof finish'}],refinement:{findingIndex:0,targetIds:[target],instruction:`Finish ${target} with ${input.pass === 1 ? 'timber' : 'bronze'}`} } });
   }
   if (input.phase === 'refine') return respond({ output: { name: input.current.name, summary:'Offline scoped finish fixture',unsupported:[],operations:[{op:'finish',id:target,material:input.pass===1?'timber':'bronze'}] } });
   assert.equal(input.images.length,4); assert.equal(input.previousImages.length,4);
   return respond({ output: { verdict:'prefer revised',reason:'Offline acceptance fixture, not model judgment.',regressions:[] } });
  }
  if (!['127.0.0.1','localhost'].includes(u.hostname) || u.pathname.startsWith('/api/')) return route.abort();
  return route.continue();
 });
 await page.goto('http://127.0.0.1:3015/dev/villa-playground', { waitUntil:'networkidle', timeout:120000 });
 await page.locator('canvas').first().waitFor({timeout:60000});
 await page.getByLabel('Terra design brief',{exact:true}).fill('OFFLINE visual loop integration fixture');
 await page.getByRole('button',{name:'Generate villa',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled, undefined, {timeout:180000});
 await page.locator('summary').filter({hasText:/^Generation visual review/}).click();
 assert.deepEqual(calls.map(c=>`${c.pass}:${c.phase}`),['1:review','1:refine','1:compare','2:review','2:refine','2:compare']);
 const persisted = await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.equal(persisted.elements.find(e=>e.id===target).material,'bronze');
 assert.deepEqual(persisted.elements.map(e=>e.id),fixture.scene.elements.map(e=>e.id));
 assert.deepEqual(persisted.elements.filter(e=>e.id!==target),fixture.scene.elements.filter(e=>e.id!==target));
 const downloadPromise = page.waitForEvent('download');
 await page.getByRole('button',{name:'Export review evidence',exact:true}).click();
 const download = await downloadPromise;
 await download.saveAs(`${dir}/browser-evidence.json`);
 const evidence = JSON.parse(readFileSync(`${dir}/browser-evidence.json`,'utf8'));
 assert.equal(evidence.length,2); assert(evidence.every(r=>r.accepted));
 for(const r of evidence) { assert.deepEqual(r.beforeCaptures.map(s=>s.view),['Aerial','Arrival','Garden','Poolside']); for (let i=0;i<4;i++) { const a=r.beforeCaptures[i].camera,b=r.afterCaptures[i].camera; assert([...a.position,...a.target].every((v,j)=>Math.abs(v-[...b.position,...b.target][j])<=1e-7)); } }
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 const undone = await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.equal(undone.elements.find(e=>e.id===target).material,'timber');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 const original = await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.deepEqual(original.elements,fixture.scene.elements);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:`${dir}/studio.png`});
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,source:'Mock provider transport; actual Generate UI, WebGL renderer, PNG captures, scope validation, comparisons and Undo. Not AI quality evidence.',calls,errors,accepted:evidence.map(r=>({pass:r.pass,ids:r.diff.changedElementIds,camerasMatch:true})),undoRestoredOriginal:true},null,2));
} finally { await browser.close(); }
