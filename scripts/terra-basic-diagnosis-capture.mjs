import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/terra-basic-diagnosis';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],evidence={};
try{
const page=await browser.newPage({viewport:{width:1800,height:1200}});
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
for(const name of ['failed','study','ladera','solana']){
const scene=JSON.parse(readFileSync(`${dir}/${name==='solana'?'ladera':name}.scene.json`));
await page.addInitScript(s=>localStorage.setItem('terra-direct-scene-1',JSON.stringify(s)),scene);
await page.goto('http://localhost:3000/dev/villa-playground?scene=ladera',{waitUntil:'networkidle',timeout:120000});
await page.waitForTimeout(5000);
if(name==='solana')await page.getByLabel('Comparison',{exact:true}).selectOption('solana');
for(const view of ['Poolside','Arrival','Aerial']){
await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1500);
await page.screenshot({path:`${dir}/${name}-${view.toLowerCase()}.png`});
}
await page.waitForTimeout(2000);
const fixed=await page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.target.set(0,5,-5);s.camera.position.set(60,35,65);s.controls.update();return {position:s.camera.position.toArray(),target:s.controls.target.toArray()};}h=h.next;}f=f.return;}});
await page.waitForTimeout(500);await page.screenshot({path:`${dir}/${name}-fixed-camera.png`});
evidence[name]=await page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){let ops=[],meshes=0,architectureMeshes=0;const root=s.scene.getObjectByName('Villa Solana · fixed architectural composition')??s.scene.getObjectByName('Declarative architectural scene');s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ops.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y});if(o.isMesh)meshes++;});root?.traverse(o=>{if(o.isMesh)architectureMeshes++;});return {ops,meshes,architectureMeshes,camera:s.camera.position.toArray()};}h=h.next;}f=f.return;}return null;});
evidence[name].fixedCamera=fixed;
if(name!=='solana')assert.equal(evidence[name].ops.length,scene.elements.length);
}
assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
writeFileSync(`${dir}/browser-evidence.json`,JSON.stringify({providerCalls:0,blocked,errors,evidence},null,2));
}finally{await browser.close();}
