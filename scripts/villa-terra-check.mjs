// MANUAL ONLY: exactly one paid generation; no edit, retry or repair request.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
if(!process.argv.includes('--live-generation')) throw new Error('Manual authorization required: pass --live-generation for ONE real Terra generation.');
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory='docs/villa-playground/terra-compositions';
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const requests=[],errors=[];
try {
  const page=await browser.newPage({viewport:{width:1500,height:1050}});page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(String(e)));
  // Count and block any unexpected second request before it reaches the server.
  await page.route('**/api/ai/**',async route=>{
    requests.push(route.request().url());
    if(requests.length>1 || !route.request().url().endsWith('/api/ai/villa')) return route.abort();
    return route.continue();
  });
  await page.goto(process.env.VILLA_URL ?? 'http://127.0.0.1:3107/dev/villa-playground',{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('canvas').waitFor();
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('canvas');if(!canvas) return false;
    let fiber=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
    while(fiber){let hook=fiber.memoizedState;while(hook){const state=hook.memoizedState?.current;if(state?.scene?.isScene){let meshes=0;state.scene.traverse(o=>{if(o.isMesh)meshes++;});return meshes>100;}hook=hook.next;}fiber=fiber.return;}return false;
  });
  const prompt=process.env.VILLA_BRIEF ?? 'Design an elegant asymmetric Caribbean villa with a two-storey main hall, a lower living wing connected by a shaded gallery, one detached guest pavilion and a long rectangular pool. Use generous clearances and an open garden terrace.';
  await page.getByLabel('Villa brief',{exact:true}).fill(prompt);
  const waiting=page.waitForResponse(r=>r.url().endsWith('/api/ai/villa'),{timeout:180000});
  await page.getByRole('button',{name:/Generate villa/}).click();
  const response=await waiting, body=await response.json();
  writeFileSync(`${directory}/manual-live-generation.json`,JSON.stringify({provenance:'Manually authorized live provider response.',prompt,status:response.status(),body},null,2)+'\n');
  assert(response.ok(),`Terra rejected the request (${body.code ?? response.status()}); see saved diagnostics. No retry was made.`);
  assert.equal(body.providerCalls,1);assert.equal(body.config.version,1);assert(body.config.wings.length>=1);
  await page.getByRole('heading',{name:body.config.name,exact:false}).waitFor();
  await page.waitForTimeout(3500);
  await page.screenshot({path:`${directory}/manual-live-generation.jpg`,type:'jpeg',quality:90});
  assert.equal(requests.length,1);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({live:true,providerCalls:1,model:body.model,wingCount:body.config.wings.length,errors}));
} finally {await browser.close();}
