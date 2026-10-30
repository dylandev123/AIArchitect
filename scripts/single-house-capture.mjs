/** Render rejected diagnostic geometry only. All APIs and external resources are blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/single-house';
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],captures=[];
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return !['localhost','127.0.0.1'].includes(u.hostname)||u.pathname.startsWith('/api/')?route.abort():route.continue();});
 await page.goto('http://127.0.0.1:3015/dev/retained-visual-review',{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>!!window.retainedReviewCapture);
 for(const stage of ['before','after']) {
  const scene=JSON.parse(readFileSync(stage==='before'?'docs/architecture/retained-visual-review/original.scene.json':`${dir}/construction.scene.json`,'utf8'));
  for(const view of ['Aerial','Arrival','Garden','Poolside']) {
   const pose=stage==='after'?captures.find(s=>s.stage==='before'&&s.view===view).camera:undefined;
   const shot=await page.evaluate(({scene,view,pose})=>window.retainedReviewCapture(scene,view,pose),{scene,view,pose});
   if(pose) assert([...pose.position,...pose.target].every((v,i)=>Math.abs(v-[...shot.camera.position,...shot.camera.target][i])<=1e-7));
   writeFileSync(`${dir}/${stage}-${view.toLowerCase()}.png`,Buffer.from(shot.image.split(',')[1],'base64'));
   captures.push({stage,view,camera:shot.camera,width:shot.width,height:shot.height});
  }
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,errors,captures},null,2));
}finally {await browser.close();}
