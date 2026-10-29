import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/cascade-improvement',url='http://127.0.0.1:3000/dev/villa-playground?response=322247c40a2c1eb0b3e667280d7f9551759779cb4b753e6c925c386e99664036';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],checks=[];
const cameras={aerial:{position:[38,34,44],target:[0,6,0]},arrival:{position:[30,15,49],target:[0,6,0]},opposite:{position:[-30,15,-49],target:[0,6,0]},human:{position:[9,1.7,48],target:[0,6,0]}};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto(url,{waitUntil:'networkidle',timeout:120000});await page.locator('canvas').first().waitFor();await page.waitForTimeout(6000);
 // Isolated browser state only: use the existing Playground authored-state setter. Never save or accept into the user's villa.
 for(const name of ['original','revised']){
 const config=JSON.parse(readFileSync(`${dir}/${name}.config.json`));
 const loaded=await page.locator('canvas').first().evaluate((c,{config,name})=>{
  let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
  while(f){if(f.type?.name==='VillaPlayground'){
   let h=f.memoizedState;while(h){if(h.memoizedState?.id==='cascade-skyline-residence'&&h.queue?.dispatch){if(name==='original'){if(JSON.stringify(h.memoizedState)!==JSON.stringify(config))throw Error('Retained replay mismatch');}else h.queue.dispatch(config);return true;}h=h.next;}
  }f=f.return;}return false;
 },{config,name});assert(loaded,'Playground state missing');
 await page.waitForTimeout(3500);
 // Hide UI overlays for evidence, without modifying any rendered geometry or materials.
 await page.addStyleTag({content:'main > :not([aria-label="Interactive 3D villa. Drag to orbit, scroll to zoom, right-drag to pan."]) { visibility: hidden !important; }'});
 for(const [view,pose] of Object.entries(cameras)){
 const state=await page.locator('canvas').first().evaluate((c,pose)=>{
 let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.enableDamping=false;s.controls.minPolarAngle=0;s.controls.maxPolarAngle=Math.PI;s.controls.target.set(...pose.target);s.camera.position.set(...pose.position);s.camera.fov=39;s.camera.updateProjectionMatrix();s.controls.update();s.invalidate();let meshes=0,finite=true;const levels=[];s.scene.traverse(o=>{if(o.name.startsWith('Stack volume'))levels.push(o.name);if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);}});return{meshes,finite,levels,camera:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov,contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('Scene missing');},pose);
 assert(state.finite&&!state.contextLost&&state.levels.length===4);await page.waitForTimeout(2200);
 await page.locator('canvas').first().screenshot({path:`${dir}/${name}-${view}.png`});checks.push({name,view,...state});
 }
 console.log('Captured',name);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 for(const view of Object.keys(cameras)){
 const a=checks.find(c=>c.name==='original'&&c.view===view),b=checks.find(c=>c.name==='revised'&&c.view===view);
 assert.equal(a.fov,b.fov);for(const key of ['camera','target'])a[key].forEach((v,i)=>assert(Math.abs(v-b[key][i])<1e-8));
 }
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({url,errors,blocked,checks,lighting:'Daylight',materials:'Unchanged original palette',providerCalls:0},null,2));
 // Browser-built contact sheet from unmodified screenshots, no image generation.
 await page.route('**/evidence/*.png',async r=>{const file=r.request().url().split('/').at(-1);await r.fulfill({contentType:'image/png',body:readFileSync(`${dir}/${file}`)});});
 const sheet=await browser.newPage({viewport:{width:1800,height:2800}});
 await sheet.route('**/evidence/*.png',async r=>{const file=r.request().url().split('/').at(-1);await r.fulfill({contentType:'image/png',body:readFileSync(`${dir}/${file}`)});});
 await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#eeece6;color:#282b29;font:20px Arial}header{padding:24px 28px;height:110px}h1{font-size:28px;margin:0 0 10px}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 24px;margin-bottom:18px}.cell{margin:0}img{width:100%;display:block}figcaption{padding:10px;background:white}small{font-size:16px}</style><header><h1>Cascade Skyline — retained original / local architectural revision</h1><small>Matching cameras · daylight · original material palette · four levels · zero provider calls</small></header>${Object.keys(cameras).map(view=>`<div class="row">${['original','revised'].map(name=>`<figure class="cell"><figcaption>${name.toUpperCase()} · ${view}</figcaption><img src="http://127.0.0.1:3000/evidence/${name}-${view}.png"></figure>`).join('')}</div>`).join('')}`);
 await sheet.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await sheet.screenshot({path:`${dir}/comparison.png`,clip:{x:0,y:0,width:1800,height:2780}});
}finally{await browser.close();}
