/** Local renderer only: deny all APIs and non-loopback resources. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH ?? '/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir=['ambitious','latest'].includes(process.argv[2])?'docs/architecture/architectural-bottleneck':'docs/architecture/exterior-first';
const selectedExample=process.argv[2]??'layered';assert(['compact','layered','ambitious','latest'].includes(selectedExample));
const label=selectedExample==='latest'?'RETAINED':'DEVELOPER';
const scene=JSON.parse(readFileSync(`${dir}/${selectedExample}.${label}.json`,'utf8'));
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[];
try {
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname.startsWith('/api/')){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto(`http://127.0.0.1:3015/dev/exterior-first?study=${selectedExample}`,{waitUntil:'networkidle',timeout:120000});
 await page.locator('canvas').waitFor({timeout:60000});
 for(const view of ['aerial','arrival','garden','poolside']) {
  await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(3000);
  const rendered=await page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const elements=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))elements.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y});});return {elements,camera:s.camera.position.toArray(),target:s.controls.target.toArray(),contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('R3F state missing');});
  assert.equal(rendered.contextLost,false);assert.deepEqual(rendered.elements.map(e=>e.id).sort(),scene.elements.map(e=>e.id).sort());
  for(const e of rendered.elements){const original=scene.elements.find(o=>o.id===e.id);assert.deepEqual(e.at,original.at);assert.equal(e.rotation,original.rotation);}
  await page.screenshot({path:`${dir}/${selectedExample}.${label}-${view}.png`});captures.push({view,...rendered});
 }
 assert.deepEqual(errors,[]);writeFileSync(`${dir}/${selectedExample}.browser-result.json`,JSON.stringify({providerCalls:0,errors,blocked,captures},null,2));
} finally {await browser.close();}
