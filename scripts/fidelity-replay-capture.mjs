// Production workspace WebGL, fixed world cameras, original saved config. No provider access.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(`${process.env.PLAYWRIGHT_DIR}/node_modules/`);
const { chromium } = require('playwright');
const [cfgPath, out, mode = 'after'] = process.argv.slice(2), cfg = readFileSync(cfgPath, 'utf8');
mkdirSync(out, { recursive: true });
const id = 'fidelity-offline-replay', project = { id, name:'V3 fidelity replay', createdAt:1, updatedAt:1, projectType:'house', generationMode:'v3-scene', v3TerrainMode:'flat', houseConfigJson:cfg, versions:[{id:'v0',createdAt:1,summary:'unchanged capture',houseConfigJson:cfg}],currentVersionIndex:0,timeOfDay:'midday' };
const cameras = { arrival:{position:[-25,14,-42],target:[0,4,2]}, 'pool-garden':{position:[25,14,43],target:[0,4,5]}, aerial:{position:[-35,48,40],target:[0,0,3]} };
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']}), errors=[], blocked=[];
try {
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 if(mode==='baseline') await page.addInitScript(()=>{globalThis.__V3_FIDELITY_BASELINE__=true;});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>/\/api\/ai|openai|terra/i.test(r.request().url())?(blocked.push(r.request().url()),r.abort()):r.continue());
 const base=process.env.REPLAY_URL??'http://localhost:3000';
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.evaluate(p=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[p]},version:6})),project);
 await page.goto(`${base}/workspace/${id}`,{waitUntil:'networkidle',timeout:120000});
 await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);
 await page.waitForTimeout(8000);
 for(const [name,pose] of Object.entries(cameras)) {
  await page.evaluate(p=>window.dispatchEvent(new CustomEvent('v3-replay-camera',{detail:p})),pose);
  await page.waitForTimeout(2500);
  await page.screenshot({path:`${out}/${name}.jpg`,quality:92});
 }
 writeFileSync(`${out}/manifest.json`,JSON.stringify({fixture:cfgPath,mode,sha256:createHash('sha256').update(cfg).digest('hex'),cameras,errors,blocked},null,2));
 if(errors.length||blocked.length) throw Error(JSON.stringify({errors,blocked}));
} finally {await browser.close();}
