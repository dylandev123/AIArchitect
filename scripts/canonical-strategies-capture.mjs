/** Browser capture of the developer-authored whole-house strategy fixtures. No API calls (all /api blocked). */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/Users/dylandevaux/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const dir='docs/architecture/knowledge-to-construction-2026-11-03';
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],captures=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname.startsWith('/api/'))return r.abort();return r.continue();});
 for(const fixture of ['waterfront-pavilion','tropical-pavilion-court','courtyard-residence','stepped-multilevel','compact-two-volume']){const variant='composed';
  const scene=JSON.parse(readFileSync(`${dir}/${fixture}.scene.json`,'utf8'));
  await page.goto(`http://localhost:3015/dev/canonical-strategies?fixture=${fixture}`,{waitUntil:'networkidle',timeout:180000});
  await page.locator('canvas').waitFor({timeout:90000});
  for(const view of ['Arrival','Aerial','Garden','Poolside']){
   await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(3000);
   const rendered=await page.locator('canvas').evaluate(c=>{
    let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
    while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const elements=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))elements.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y});});return {elements,camera:s.camera.position.toArray(),target:s.controls.target.toArray(),contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('R3F state missing');
   });
   assert.equal(rendered.contextLost,false);
   assert.deepEqual(rendered.elements.map(e=>e.id).sort(),scene.elements.map(e=>e.id).sort());
   for(const e of rendered.elements){const o=scene.elements.find(x=>x.id===e.id);assert.deepEqual(e.at,o.at);assert.equal(e.rotation,o.rotation);}
   const file=`${fixture}-${view.toLowerCase()}.png`;
   await page.screenshot({path:`${dir}/${file}`});
   captures.push({fixture,variant,view,file,elements:rendered.elements.length,camera:rendered.camera,target:rendered.target});
  }
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({label:'DEVELOPER-AUTHORED FIXTURES — NOT TERRA OUTPUT',providerCalls:0,errors,captures},null,2));
 console.log(`${captures.length} captures, ${errors.length} page errors`);
}finally{await browser.close();}
