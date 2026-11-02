import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/Users/dylandevaux/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const dir='docs/architecture/canonical-schema-compatibility';
const snapshot=async page=>await page.locator('canvas').evaluate(c=>{
 let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
 while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const elements=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:')){const shapes=[];o.traverse(m=>{if(m.isMesh&&m.geometry){m.geometry.computeBoundingBox();shapes.push({at:m.position.toArray(),bounds:[m.geometry.boundingBox.min.toArray(),m.geometry.boundingBox.max.toArray()]});}});elements.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y,shapes});}});return {elements,camera:s.camera.position.toArray(),contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('R3F state missing');});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
try{
 const captures=[];
 for(const name of ['compact','waterfront']){
  const page=await browser.newPage({viewport:{width:1600,height:1150}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>{const u=new URL(r.request().url());return !['localhost','127.0.0.1'].includes(u.hostname)||u.pathname.startsWith('/api/')?r.abort():r.continue();});
  await page.goto(`http://127.0.0.1:3015/dev/canonical-expressiveness?case=${name}`,{waitUntil:'networkidle',timeout:120000});
  await page.locator('canvas').waitFor({timeout:60000});
  const scene=JSON.parse(readFileSync(`${dir}/${name}.scene.json`,'utf8'));
  await page.evaluate(scene=>localStorage.setItem('canonical-fixture-save',JSON.stringify(scene)),scene);
  await page.getByRole('button',{name:'Reload saved geometry',exact:true}).click();
  for(const view of ['Arrival','Aerial','Garden','Poolside']){
   await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1800);
   const rendered=await snapshot(page);
   assert.equal(rendered.contextLost,false);assert.deepEqual(rendered.elements.map(e=>e.id).sort(),scene.elements.map(e=>e.id).sort());
   for(const e of rendered.elements){const original=scene.elements.find(o=>o.id===e.id);assert.deepEqual(e.at,original.at);assert.equal(e.rotation,original.rotation);}
   const png=await page.locator('canvas').evaluate(c=>c.toDataURL('image/png').split(',')[1]);writeFileSync(`${dir}/${name}.${view.toLowerCase()}.png`,Buffer.from(png,'base64'));captures.push({name,view,...rendered});
  }
  const before=(await snapshot(page)).elements;
  await page.getByRole('button',{name:'Revise fixture plan',exact:true}).click();await page.waitForTimeout(500);
  const after=(await snapshot(page)).elements;assert.notDeepEqual(after,before);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(500);assert.deepEqual((await snapshot(page)).elements,before);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForTimeout(500);assert.deepEqual((await snapshot(page)).elements,after);
  await page.getByRole('button',{name:'Save locally',exact:true}).click();
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Reload saved geometry',exact:true}).click();await page.waitForTimeout(1000);
  assert.deepEqual((await snapshot(page)).elements,after);assert.deepEqual(errors,[]);
  captures.push({name,lifecycle:'explicit fixture plan change, actual project Undo/Redo, local save and full-page reload without recompilation',passed:true});
  await page.close();
 }
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,errors:[],captures},null,2));
}finally{await browser.close();}
