import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/sol-high-once';
assert(!existsSync(`${dir}/attempt.json`),'One attempt only');
const original=JSON.parse(readFileSync('docs/architecture/distinct-houses/A/request.json','utf8'));
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();
let calls=0;let finish;
const done=new Promise(r=>finish=r);
await page.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();
 if(u.pathname.startsWith('/api/ai/')&&req.method()==='POST'){
  if(u.pathname!=='/api/ai/scene'||++calls!==1)return route.abort();
  const input=req.postDataJSON();assert.deepEqual(input,original);
  input.testing={model:'gpt-6.1-sol',reasoningEffort:'high'};
  writeFileSync(`${dir}/attempt.json`,JSON.stringify({startedAt:new Date().toISOString(),maxCalls:1,input},null,2),{flag:'wx'});
  try{const response=await route.fetch({postData:JSON.stringify(input),timeout:660000,maxRetries:0});
   const body=await response.text();writeFileSync(`${dir}/homepage-response.json`,body,{flag:'wx'});
   writeFileSync(`${dir}/http.json`,JSON.stringify({status:response.status(),calls}),{flag:'wx'});
   await route.fulfill({response,body});finish(JSON.parse(body));
  }catch(e){writeFileSync(`${dir}/transport-error.txt`,String(e));await route.abort();finish({error:String(e)});}return;
 }
 return route.continue();
});
try{
 await page.goto('http://localhost:3000',{waitUntil:'networkidle',timeout:120000});
 const text=page.locator('textarea');await text.fill(original.prompt);
 await page.getByRole('button',{name:'Generate',exact:true}).click();
 const output=await done;console.log(JSON.stringify({responseId:output.responseId,error:output.error,experiment:output.experiment}));
 await page.waitForTimeout(3000);
 writeFileSync(`${dir}/browser-storage.UNAPPROVED.json`,JSON.stringify(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)))),{flag:'wx'});
 await page.screenshot({path:`${dir}/homepage-result.png`});
}finally{await browser.close();}
