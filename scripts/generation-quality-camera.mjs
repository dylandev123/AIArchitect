/** Exercise the actual studio with offline developer responses, never model evidence. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/generation-quality';
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const evidence=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 page.on('pageerror',e=>errors.push(String(e)));
 let response;
 await page.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.pathname==='/api/ai/scene')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r.request().method()==='POST'?response:{currentModel:'OFFLINE — no model call'})});
  if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname.startsWith('/api/'))return r.abort();
  return r.continue();
 });
 await page.goto('http://127.0.0.1:3015/dev/villa-playground',{waitUntil:'networkidle',timeout:120000});
 await page.locator('canvas').waitFor({timeout:60000});
 const state=()=>page.locator('canvas').evaluate(c=>{
  let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
  while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const elements=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))elements.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y});});return {elements,camera:s.camera.position.toArray(),target:s.controls.target.toArray(),contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('R3F state missing');
 });
 for(const study of ['compact','shifted']){
  response=JSON.parse(readFileSync(`${dir}/${study}.mock-response.json`,'utf8'));
  await page.getByLabel('Terra design brief',{exact:true}).fill('OFFLINE developer camera test — not generated architecture');
  await page.getByRole('button',{name:'Generate villa',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);
  await page.waitForTimeout(3500);
  const rendered=await state();assert.equal(rendered.contextLost,false);
  assert.deepEqual(rendered.elements.map(e=>e.id).sort(),response.scene.elements.map(e=>e.id).sort());
  for(const e of rendered.elements){const original=response.scene.elements.find(o=>o.id===e.id);assert.deepEqual(e.at,original.at);assert.equal(e.rotation,original.rotation);}
  if(study==='shifted')assert(rendered.target[0]>35,'New house must reframe away from origin');
  await page.screenshot({path:`${dir}/camera-${study}.DEVELOPER.png`});
  evidence.push({study,...rendered});
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/camera.browser-result.json`,JSON.stringify({providerCalls:0,source:'Offline developer fixtures through actual OperationStudio; no live AI or external resources',errors,evidence},null,2));
}finally{await browser.close();}
