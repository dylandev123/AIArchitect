/** Exact AI candidate only, original camera poses; provider and all API access blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/full-house-investigation/network-verified-intelligence';
const captureDir=process.env.REFERENCE_CAPTURE_DIR ?? `${dir}/render-verified`;
mkdirSync(captureDir,{recursive:true});
const original=JSON.parse(readFileSync(`${dir}/review.input.json`));
const poses=JSON.parse(readFileSync('docs/architecture/retained-visual-review/record.json')).beforeCaptures;
const candidate=JSON.parse(readFileSync(`${dir}/refined.scene.json`));
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[];
try {
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname.startsWith('/api/')){blocked.push({method:route.request().method(),path:u.pathname});return route.abort();}return route.continue();});
 await page.goto('http://127.0.0.1:3016/dev/retained-visual-review',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>!!window.retainedReviewCapture);
 for(const stage of ['before','after'])for(const prior of poses) {
  const shot=await page.evaluate(({scene,view,pose})=>Promise.race([window.retainedReviewCapture(scene,view,pose),new Promise((_,reject)=>setTimeout(()=>reject(Error('Capture timeout')),30000))]),{scene:stage==='before'?original.current:candidate,view:prior.view,pose:prior.camera});
  assert([...prior.camera.position,...prior.camera.target].every((v,i)=>Math.abs(v-[...shot.camera.position,...shot.camera.target][i])<=1e-7));
  writeFileSync(`${captureDir}/${stage}-${shot.view.toLowerCase()}.png`,Buffer.from(shot.image.split(',')[1],'base64'),{flag:'wx'});
  captures.push({stage,...shot});
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${captureDir}/matching-captures.json`,JSON.stringify(captures),{flag:'wx'});
 writeFileSync(`${captureDir}/browser-result.json`,JSON.stringify({providerCalls:0,errors,blocked,exactHistoricalCameraPoses:true,renderer:'Unmodified ReviewPreview / OperationScene / VillaScene; exact element identities and transforms, nonblank pixels, WebGL health checked by renderer',captures:captures.map(({image:_image,...shot})=>shot)},null,2),{flag:'wx'});
 console.log('Eight matching-camera captures; zero provider calls.');
} finally {await browser.close();}
