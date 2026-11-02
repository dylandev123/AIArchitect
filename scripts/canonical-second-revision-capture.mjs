import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/Users/dylandevaux/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const dir='docs/architecture/canonical-redesign-revision-2026-11-02';
const snapshot=async page=>await page.locator('canvas').evaluate(c=>{
 let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
 while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const elements=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:')){const shapes=[];o.traverse(m=>{if(m.isMesh&&m.geometry){m.geometry.computeBoundingBox();shapes.push({at:m.position.toArray(),bounds:[m.geometry.boundingBox.min.toArray(),m.geometry.boundingBox.max.toArray()]});}});elements.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y,shapes});}});return {elements,camera:s.camera.position.toArray(),contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('R3F state missing');});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const scene=JSON.parse(readFileSync(`${dir}/scene.accepted-for-review.json`,'utf8'));
try{
 const captures=[],page=await browser.newPage({viewport:{width:1600,height:1150}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());return !['localhost','127.0.0.1'].includes(u.hostname)||u.pathname.startsWith('/api/')?r.abort():r.continue();});
 await page.goto('http://127.0.0.1:3015/dev/canonical-second-revision',{waitUntil:'networkidle',timeout:120000});
 await page.locator('canvas').waitFor({timeout:60000});
 for(const view of ['Arrival','Aerial','Garden','Poolside']){
  await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1800);
  const rendered=await snapshot(page);
  assert.equal(rendered.contextLost,false);assert.deepEqual(rendered.elements.map(e=>e.id).sort(),scene.elements.map(e=>e.id).sort());
  for(const e of rendered.elements){const o=scene.elements.find(x=>x.id===e.id);assert.deepEqual(e.at,o.at);assert.equal(e.rotation,o.rotation);}
  const png=await page.locator('canvas').evaluate(c=>c.toDataURL('image/png').split(',')[1]);writeFileSync(`${dir}/render.${view.toLowerCase()}.png`,Buffer.from(png,'base64'),{flag:'wx'});captures.push({view,elementCount:rendered.elements.length,contextLost:rendered.contextLost});
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,pageErrors:errors,apisBlocked:true,captures},null,2),{flag:'wx'});
}finally{await browser.close();}
