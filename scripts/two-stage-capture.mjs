import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const dir='docs/villa-playground/two-stage',checks=[],blocked=[],errors=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
try{
const page=await browser.newPage({viewport:{width:1800,height:1200}});
page.on('pageerror',e=>errors.push(String(e)));
// Fulfil only recorded offline edits. All other AI and external requests are blocked.
let fixture;
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname==='/api/ai/scene'&&fixture){const f=fixture;fixture=undefined;return r.fulfill({status:f.status??200,contentType:'application/json',body:JSON.stringify(f.body)});}if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
const load=n=>JSON.parse(readFileSync(`${dir}/${n}.json`));
async function inspect(camera){return page.locator('canvas').evaluate((c,camera)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){if(camera){s.controls.target.set(...camera.target);s.camera.position.set(...camera.position);s.controls.update();s.invalidate();}const ops=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ops.push({id:o.name.slice(10),uuid:o.uuid});});return {ops,position:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov};}h=h.next;}f=f.return;}},camera);}
const cameras={arrival:{position:[44,23,-58],target:[0,4,0]},poolside:{position:[43,24,59],target:[0,4,0]},aerial:{position:[45,60,48],target:[0,3,0]}};
async function capture(name){for(const [view,cam]of Object.entries(cameras)){const matched=name.startsWith('study')?{...cam,position:[cam.position[0],cam.position[1],-cam.position[2]]}:cam;const state=await inspect(matched);await page.waitForTimeout(700);await page.locator('canvas').screenshot({path:`${dir}/${name}-${view}.png`});checks.push({name,view,...state});}}
for(const name of ['retained','study']){
 const before=load(`${name}.before`),after=load(`${name}.after`),operations=load(`${name}.operations`);
 
 await page.goto('http://localhost:3000/dev/villa-playground?scene=ladera',{waitUntil:'networkidle',timeout:120000});
 await page.getByLabel('Import scene JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await page.waitForTimeout(2500);
 if(name==='retained'){
 await page.getByLabel('Import scene JSON',{exact:true}).setInputFiles({name:'original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(load('retained.original')))});await page.waitForTimeout(1500);await capture('retained-original');
 await page.getByLabel('Import scene JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await page.waitForTimeout(1500);
 }
 await capture(`${name}-composition`);const idsBefore=(await inspect()).ops;
 fixture={body:{name:before.name,summary:'Offline fixture applied',unsupported:[],operations}};
 await page.getByLabel('Terra design brief',{exact:true}).fill('Offline architectural development fixture');
 await page.getByRole('button',{name:'Apply change',exact:true}).click();await page.waitForTimeout(2000);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.deepEqual(saved.elements,after.elements);
 const idsAfter=(await inspect()).ops;
 const reparented=new Set(operations.filter(o=>o.op==='replace'&&o.element.parent!==before.elements.find(e=>e.id===o.id)?.parent).map(o=>o.id));
 assert(idsBefore.every(e=>idsAfter.some(a=>a.id===e.id)));
 assert(idsBefore.filter(e=>!reparented.has(e.id)).every(e=>idsAfter.find(a=>a.id===e.id)?.uuid===e.uuid));
 await capture(`${name}-developed`);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')).elements),before.elements);
 fixture={body:{name:before.name,summary:'Offline fixture reapplied',unsupported:[],operations}};await page.getByRole('button',{name:'Apply change',exact:true}).click();await page.waitForTimeout(500);
 await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(1600);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')).elements),after.elements);
 fixture={status:422,body:{error:'Offline simulated provider construction failure',recoverableDraft:before}};
 await page.getByLabel('Terra design brief',{exact:true}).fill('Offline failure fixture');await page.getByRole('button',{name:'Apply change',exact:true}).click();await page.waitForTimeout(500);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')).elements),after.elements);
 await page.getByRole('button',{name:'Download recoverable draft',exact:true}).waitFor();
 checks.push({name,stableRenderIds:true,undo:true,reload:true,failedResponsePreservedScene:true,recoveryDownload:true});
}
for(const name of ['retained','study'])for(const view of Object.keys(cameras)){const a=checks.find(c=>c.name===`${name}-composition`&&c.view===view),b=checks.find(c=>c.name===`${name}-developed`&&c.view===view);for(const key of ['position','target','fov'])assert.deepEqual(a[key],b[key]);}
assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
writeFileSync(`${dir}/browser-evidence.json`,JSON.stringify({providerCalls:0,mockedEditResponses:true,blocked,errors,checks},null,2));
}finally{await browser.close();}
