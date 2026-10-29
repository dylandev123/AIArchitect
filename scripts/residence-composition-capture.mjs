import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 for(const [id,query] of [...['dramatic-layered','flowing-contemporary','grand-multiwing'].map(id=>[id,'?composition='+id]),['retained-horizon','?response=1b1a4c3a3770dd1fc0b790dcf26c5fd4504b524e0191c8296d746e05d0f70034'],['retained-tide','?response=d814528a67dd5ae6201c725dad3f6c23b12ed32487b7fa471f1a09dacf243d9f'],['solana','']]){
  await page.goto('http://localhost:3000/dev/villa-playground'+query,{waitUntil:'networkidle',timeout:120000});
  await page.getByRole('button',{name:'House only',exact:true}).click();
  await page.waitForTimeout(6000);
  const result=await page.locator('canvas').evaluate(c=>{
   let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
   while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){
    let finite=true,meshes=0;const names=[];s.scene.traverse(o=>{if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);}if(/Footprint building|Wing |Grounds|Curved pavilion|Created/.test(o.name))names.push(o.name);});
    const t=s.controls.target;s.camera.position.set(t.x+48,t.y+24,t.z+62);s.controls.update();s.invalidate();return {finite,meshes,names};
   }h=h.next;}f=f.return;}return null;
  });
  assert(result?.finite&&result.meshes>50);if(id==='retained-horizon')assert(result.names.includes('Footprint building · horizon-residence'));if(id==='retained-tide')assert(result.names.includes('Footprint building · ocean-crown-residence'));assert(!result.names.some(n=>n.startsWith('Grounds')));checks.push({id,...result});
  await page.waitForTimeout(2500);await page.locator('canvas').screenshot({path:`docs/villa-playground/residence-composition/${id}.png`});console.log('Captured',id);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync('docs/villa-playground/residence-composition/browser-checks.json',JSON.stringify({errors,blocked,checks},null,2));
}finally{await browser.close();}
