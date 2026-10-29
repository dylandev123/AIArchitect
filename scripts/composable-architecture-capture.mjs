import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH || '/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const root='docs/architecture/composable-knowledge';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',ignoreDefaultArgs:['--headless=old'],args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],results=[];let aiRequests=0;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')){aiRequests++;return r.abort();}if(!['localhost','127.0.0.1'].includes(u.hostname))return r.abort();return r.continue();});
 await page.goto('http://localhost:3000/dev/villa-playground?scene=ladera',{waitUntil:'networkidle',timeout:120000});
 for(const id of ['caribbean','compact','mediterranean','family-pool','spa-pool']){
  const scene=JSON.parse(readFileSync(`${root}/${id}.scene.json`));
  await page.getByLabel('Import scene JSON').setInputFiles({name:'scene.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scene))});
  await page.getByRole('button',{name:'Aerial',exact:true}).click();await page.waitForTimeout(1500);
  await page.screenshot({path:`${root}/${id}-aerial.png`});
  await page.getByRole('button',{name:'Arrival',exact:true}).click();await page.waitForTimeout(1000);
  await page.screenshot({path:`${root}/${id}-arrival.png`});
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));assert.deepEqual(stored,scene);
  await page.getByLabel('Element',{exact:true}).selectOption(scene.elements[0].id);
  await page.getByLabel('Position x',{exact:true}).fill(String(scene.elements[0].at[0]+.1));
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1'))),scene);
  await page.reload({waitUntil:'networkidle'});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1'))),scene);
  results.push({id,imported:true,editUndoReload:true,screenshot:`${id}-aerial.png`});
 }
 assert.equal(aiRequests,0);assert.deepEqual(errors,[]);
 writeFileSync(`${root}/browser.json`,JSON.stringify({aiRequests,errors,results},null,2));
}finally{await browser.close();}
