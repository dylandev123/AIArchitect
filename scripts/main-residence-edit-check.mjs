import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const dir='docs/villa-playground/main-residences',errors=[],blocked=[];let mocked=0;
async function authored(page){return page.locator('main').evaluate(el=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){if(h.memoizedState?.version===1&&h.memoizedState?.forms)return JSON.parse(JSON.stringify(h.memoizedState));h=h.next;}f=f.return;}return null;});}
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)||u.pathname.startsWith('/api/ai/')){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.route('**/api/ai/villa',async r=>{
  mocked++;const body=r.request().postDataJSON();assert.equal(body.mode,'edit');
  const f=structuredClone(body.current.forms[0]);
  if(mocked===1)f.upper.height=4.6;
  else f.upper.points=[{x:-39,z:-39},{x:39,z:-39},{x:39,z:39},{x:-39,z:39}];
  await r.fulfill({json:{changes:{forms:[{type:'put',form:f}]},summary:mocked===1?'Offline crown edit accepted':'Offline invalid proposal',unsupported:[]}});
 });
 await page.goto('http://localhost:3000/dev/villa-playground?composition=crescent-crown',{waitUntil:'networkidle',timeout:120000});await page.waitForTimeout(2500);
 const before=await authored(page);assert(before);
 await page.getByRole('button',{name:'✦ Terra',exact:true}).click();await page.getByRole('button',{name:'Refine villa',exact:true}).click();
 await page.getByLabel('Villa brief',{exact:true}).fill('Offline test: raise upper floor');await page.getByRole('button',{name:'Apply change ↗',exact:true}).click();
 await page.getByRole('button',{name:'Apply change ↗',exact:true}).waitFor();
 const after=await authored(page);assert.equal(after.forms[0].upper.height,4.6);
 for(const key of ['estateLandscape','terraces','components','pool'])assert.deepEqual(after[key],before[key]);
 await page.getByLabel('Villa brief',{exact:true}).fill('Offline test: unsupported upper floor');await page.getByRole('button',{name:'Apply change ↗',exact:true}).click();
 await page.getByRole('button',{name:'Apply change ↗',exact:true}).waitFor();await page.getByRole('button',{name:/^\d+ unresolved items$/}).click();await page.getByText(/Footprint needs|Upper storey|exceeds 180/).first().waitFor();assert.deepEqual(await authored(page),after);
 await page.screenshot({path:`${dir}/rejected-edit-preserves-residence.png`});assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.equal(mocked,2);
 writeFileSync(`${dir}/edit-checks.json`,JSON.stringify({mockedLocalResponses:mocked,liveProviderCalls:0,errors,blocked,acceptedHeight:after.forms[0].upper.height,landscapePreserved:true,rejectedEditAtomic:true},null,2));console.log('PASS: real conversational UI accepted crown edit and atomically rejected unsupported geometry');
}finally{await browser.close();}
