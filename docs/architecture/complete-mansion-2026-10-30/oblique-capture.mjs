/** Unchanged fresh output through the normal renderer. No API calls in capture. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const fixture=process.argv.includes('--fixture');
const root='docs/architecture/complete-mansion-2026-10-30';
const dir=fixture?`${root}/preparation-render`:root;
const {mkdirSync,existsSync}=await import('node:fs');
const {createHash}=await import('node:crypto');
mkdirSync(dir,{recursive:true});
for(const name of ['aerial-oblique.png','oblique-browser-result.json'])assert(!existsSync(`${dir}/${name}`),'Never overwrite captures');
const result=fixture?null:JSON.parse(readFileSync(`${root}/route-response.json`,'utf8'));
const scene=fixture?JSON.parse(readFileSync('docs/architecture/generation-quality/final-family/scene.json','utf8')):result.scene??result.recoverableDraft;
assert(scene,'No actual constructed scene available');
const sceneHash=createHash('sha256').update(JSON.stringify(scene)).digest('hex');
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],captures=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname.startsWith('/api/'))return r.abort();return r.continue();});
 await page.goto(`http://127.0.0.1:3015/dev/complete-mansion${fixture?'?fixture=1':''}`,{waitUntil:'networkidle',timeout:120000});
 await page.locator('canvas').waitFor({timeout:60000});
 for(const view of ['Aerial']){
  await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(3000);
  await page.locator('canvas').evaluate(c=>{
   let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
   while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.camera.position.set(52,27,-58);s.controls.target.set(0,1.5,0);s.controls.update();return;}h=h.next;}f=f.return;}throw Error('R3F state missing');
  });
  await page.waitForTimeout(500);

  const rendered=await page.locator('canvas').evaluate(c=>{
   let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
   while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const elements=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))elements.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y});});return {elements,camera:s.camera.position.toArray(),target:s.controls.target.toArray(),contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('R3F state missing');
  });
  assert.equal(rendered.contextLost,false);
  assert.deepEqual(rendered.elements.map(e=>e.id).sort(),scene.elements.map(e=>e.id).sort());
  for(const e of rendered.elements){const original=scene.elements.find(o=>o.id===e.id);assert.deepEqual(e.at,original.at);assert.equal(e.rotation,original.rotation);}
  await page.locator('canvas').screenshot({path:`${dir}/aerial-oblique.png`});captures.push({view,...rendered});
 }
 assert.deepEqual(errors,[]);writeFileSync(`${dir}/oblique-browser-result.json`,JSON.stringify({fixture,provenance:fixture?'Historical family fixture; no new generation':'Unchanged mansion experiment',sceneHash,captureProviderCalls:0,errors,captures},null,2),{flag:'wx'});
}finally{await browser.close();}
