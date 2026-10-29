import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const root='docs/architecture/programme-construction';mkdirSync(root,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',ignoreDefaultArgs:['--headless=old'],args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
let aiRequests=0;const errors=[];
try {
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/api/ai/')){aiRequests++;return route.abort();}if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();return route.continue();});
 await page.goto('http://localhost:3000/dev/villa-playground?scene=ladera',{waitUntil:'networkidle',timeout:120000});
 await page.getByText('Visual review',{exact:true}).click();
 const downloadPromise=page.waitForEvent('download',{timeout:120000});
 await page.getByRole('button',{name:'Export diagnostic screenshots (offline)',exact:true}).click();
 const download=await downloadPromise;await download.saveAs(`${root}/screenshot-export.json`);
 const artifact=JSON.parse(readFileSync(`${root}/screenshot-export.json`));
 assert.equal(artifact.captures.length,4);
 for(const shot of artifact.captures){assert(shot.image.startsWith('data:image/png;base64,'));assert(shot.camera);assert(Buffer.from(shot.image.split(',')[1],'base64').length>1000);}
 assert.deepEqual(artifact.captures.map(s=>s.view),['Aerial','Arrival','Poolside','Facade']);
 await page.screenshot({path:`${root}/export-smoke.png`});
 assert.equal(aiRequests,0);assert.deepEqual(errors,[]);
 writeFileSync(`${root}/browser-result.json`,JSON.stringify({passed:true,aiRequests,errors,views:artifact.captures.map(s=>s.view),responseId:artifact.responseId},null,2));
} finally {await browser.close();}
