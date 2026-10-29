import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/flat-main-house',original=JSON.parse(readFileSync(`${dir}/original.scene.json`)),corrected=JSON.parse(readFileSync(`${dir}/corrected.scene.json`));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[];let aiRequests=0;
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}});page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')){aiRequests++;return r.abort();}if(!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.origin);return r.abort();}return r.continue();});
 await page.goto('http://localhost:3000/dev/villa-playground?scene=ladera',{waitUntil:'networkidle',timeout:120000});
 const load=async scene=>{await page.getByLabel('Import scene JSON').setInputFiles({name:'scene.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scene))});await page.waitForTimeout(2000);};
 await load(original);await page.getByRole('button',{name:'Arrival',exact:true}).click();await page.waitForTimeout(1200);await page.screenshot({path:`${dir}/original-front.png`});
 await load(corrected);
 for(const [view,name] of [['Arrival','front'],['Garden','rear'],['Poolside','poolside'],['Aerial','aerial']]){await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1600);if(name==='poolside') {await page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.camera.position.set(28,8,-32);s.controls?.target.set(0,2,-4);s.controls?.update();return;}h=h.next;}f=f.return;}});await page.waitForTimeout(200);}await page.screenshot({path:`${dir}/${name}.png`});}
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.deepEqual(await saved(),corrected);
 await page.getByLabel('Element',{exact:true}).selectOption('grand-entry');
 console.log(await page.locator('input').evaluateAll(es=>es.map(e=>({label:e.getAttribute('aria-label'),type:e.type,value:e.value}))));
 await page.getByLabel('Position x',{exact:true}).fill('0.5');
 const after=await saved();assert.equal(after.elements.find(e=>e.id==='grand-entry').at[0],.5);assert.deepEqual(after.elements.filter(e=>e.id!=='grand-entry'),corrected.elements.filter(e=>e.id!=='grand-entry'));
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await saved(),corrected);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await saved(),corrected);
 await load(original);await page.reload({waitUntil:'networkidle'});assert.deepEqual(await saved(),original);
 assert.deepEqual(errors,[]);assert.equal(aiRequests,0);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,aiRequests,errors,blocked,checks:['exact retained terrain scene replay','four corrected views','targeted edit preserves unrelated elements','undo restores corrected scene','reload persists corrected scene','original terrain scene reloads unchanged']},null,2));
}finally{await browser.close();}
