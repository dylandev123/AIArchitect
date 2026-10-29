import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_CORE_PATH || '/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/villa-playground/property-value-development',checks=[],blocked=[],errors=[];
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
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

const before=load('before');
await page.goto('http://localhost:3000/dev/villa-playground?scene=ladera',{waitUntil:'networkidle',timeout:120000});
await page.getByLabel('Import scene JSON',{exact:true}).setInputFiles({name:'before.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});
await page.waitForTimeout(2000);await capture('before');
const after=load('after'),operations=load('operations');
fixture={body:{name:after.name,summary:'Retained single live response replayed offline',unsupported:[],operations}};
await page.getByLabel('Terra design brief',{exact:true}).fill('Offline replay of retained one-call development');
await page.getByRole('button',{name:'Apply change',exact:true}).click();await page.waitForTimeout(1500);
assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')).elements),after.elements);
await capture('after');
await page.getByRole('button',{name:'Undo',exact:true}).click();
assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')).elements),before.elements);
await page.getByLabel('Import scene JSON',{exact:true}).setInputFiles({name:'candidate.UNAPPROVED.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});
await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(1500);
assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')).elements),after.elements);
for(const view of Object.keys(cameras)){const a=checks.find(c=>c.name==='before'&&c.view===view),b=checks.find(c=>c.name==='after'&&c.view===view);for(const key of ['position','target','fov'])assert.deepEqual(a[key],b[key]);}
assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
writeFileSync(`${dir}/browser-evidence.json`,JSON.stringify({providerCalls:0,offlineReplay:true,undo:true,reload:true,errors,blocked,checks},null,2));
}finally{await browser.close();}
