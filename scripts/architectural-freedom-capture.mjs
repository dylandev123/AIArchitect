import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/architectural-freedom',base='http://127.0.0.1:3000';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 const cases=['freedom-sky','freedom-estate','freedom-fold','freedom-river','solana','cascade'];
 const selected=process.env.CAPTURE_STUDIES?.split(',')??cases;
 for(const id of selected){
  await page.goto(base+'/dev/villa-playground'+(id==='solana'?'':id==='cascade'?'?response=322247c40a2c1eb0b3e667280d7f9551759779cb4b753e6c925c386e99664036':'?composition='+id),{waitUntil:'networkidle',timeout:120000});
  await page.locator('canvas').first().waitFor();await page.waitForTimeout(3000);
  await page.getByRole('button',{name:'House only',exact:true}).click();await page.waitForTimeout(2500);
  await page.addStyleTag({content:'main > :not([aria-label="Interactive 3D villa. Drag to orbit, scroll to zoom, right-drag to pan."]) { visibility: hidden !important; }'});
  for(const [view,direction] of [['arrival',[-1,.4,-1]],['poolside',[1,.45,1]],['aerial',[.35,1.4,.45]]]){
   const state=await page.locator('canvas').first().evaluate((c,direction)=>{
    let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){
     // Match the existing fitted house framing for each view; retain relative distance.
     const target=s.controls.target.clone(),distance=s.camera.position.distanceTo(target),d=target.clone().set(...direction).normalize();s.controls.enableDamping=false;s.camera.position.copy(target).addScaledVector(d,distance);s.controls.update();s.invalidate();
     let meshes=0,finite=true;const names=[];s.scene.traverse(o=>{if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);}if(/Architectural volume|Wing |Stack volume/.test(o.name))names.push(o.name);});
     return {meshes,finite,names,camera:s.camera.position.toArray(),target:target.toArray(),contextLost:s.gl.getContext().isContextLost()};
    }h=h.next;}f=f.return;}throw Error('No scene');
   },direction);
   assert(state.finite&&!state.contextLost&&state.meshes>50);if(id==='freedom-sky')assert(state.names.some(n=>n.includes('storey 4')));
   await page.waitForTimeout(1800);await page.locator('canvas').first().screenshot({path:`${dir}/${id}-${view}.png`});checks.push({id,view,...state});
  }
  console.log('Captured',id);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 const retained=selected.length===cases.length?[]:JSON.parse(readFileSync(`${dir}/browser-checks.json`)).checks.filter(c=>!selected.includes(c.id));
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,errors,blocked,checks:[...retained,...checks]},null,2));
 const sheet=await browser.newPage({viewport:{width:1800,height:2200}});
 await sheet.route('**/evidence/*.png',r=>r.fulfill({contentType:'image/png',body:readFileSync(`${dir}/${r.request().url().split('/').at(-1)}`)}));
 await sheet.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#eeece6;font:20px Arial;color:#282b29}h1{margin:24px}.grid{padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%;display:block}figcaption{padding:10px;background:white}</style><h1>Architectural freedom · offline WebGL studies / Solana / Cascade</h1><div class="grid">${cases.map(id=>`<figure><figcaption>${id}</figcaption><img src="${base}/evidence/${id}-poolside.png"></figure>`).join('')}</div>`);
 await sheet.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await sheet.screenshot({path:`${dir}/comparison.png`,fullPage:true});
}finally{await browser.close();}
