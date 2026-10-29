import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/automatic-creation',fixture=JSON.parse(readFileSync(`${dir}/offline-fixtures.json`,'utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],requests=[],checks=[];
try {
 const page=await browser.newPage({viewport:{width:1560,height:1100}});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(String(e)));
 let next=fixture.created;
 await page.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}
  if(u.pathname.startsWith('/api/ai/')) {
   assert.equal(u.pathname,'/api/ai/villa');requests.push(r.request().postDataJSON());
   return r.fulfill({status:next.error?422:200,contentType:'application/json',body:JSON.stringify(next)});
  }
  if(u.pathname==='/api/dev/villa-candidates')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({candidates:[fixture.experimental]})});
  return r.continue();
 });
 async function inspect(){return page.locator('canvas').evaluate(c=>{
  let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
  while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;
   if(s?.scene?.isScene){let meshes=0,finite=true;const canopies=[];s.scene.traverse(o=>{if(o.name.startsWith('Created component'))canopies.push({name:o.name,position:o.position.toArray(),rotation:o.rotation.y});if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);}});return {meshes,finite,canopies};}h=h.next;}f=f.return;}return null;
 });}
 await page.goto('http://localhost:3000/dev/villa-playground',{waitUntil:'networkidle'});
 await page.locator('canvas').waitFor();await page.waitForTimeout(2500);
 const original=await inspect();assert(original.finite&&original.canopies.length===0);
 await page.screenshot({path:`${dir}/solana-preserved.png`});checks.push({case:'Solana original',...original});
 await page.getByRole('button',{name:'✦ Terra',exact:true}).click();
 async function generate(prompt){await page.getByLabel('Villa brief').fill(prompt);await page.getByRole('button',{name:'Generate villa ↗',exact:true}).click();await page.getByRole('button',{name:'Generate villa ↗',exact:true}).waitFor();await page.waitForTimeout(2500);}
 await generate(fixture.prompt);
 let scene=await inspect();assert(scene.finite&&scene.canopies.length===1,JSON.stringify(scene));
 assert.equal(scene.canopies[0].rotation,25*Math.PI/180);
 checks.push({case:'Automatic creation through normal prompt',...scene});
 await page.getByRole('button',{name:'Terra response',exact:true}).click();
 await page.getByText(/Flared Sail · experimental/).waitFor();
 await page.screenshot({path:`${dir}/automatic-created-status.png`});
 await page.getByRole('button',{name:'Dismiss Terra response',exact:true}).click();
 await page.getByRole('button',{name:'Close Terra',exact:true}).click();
 await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(1600);
 await page.screenshot({path:`${dir}/automatic-created-poolside.png`});
 await page.getByRole('button',{name:'Above',exact:true}).click();await page.waitForTimeout(1600);
 await page.screenshot({path:`${dir}/automatic-created-above.png`});
 // Conversational editing carries the complete pinned component snapshot.
 next=fixture.edited;await page.getByRole('button',{name:'✦ Terra',exact:true}).click();
 await page.getByRole('button',{name:'Refine villa',exact:true}).click();
 await page.getByLabel('Villa brief').fill('Rotate the existing garden sail to 35 degrees.');
 await page.getByRole('button',{name:'Apply change ↗',exact:true}).click();await page.waitForTimeout(2500);
 scene=await inspect();assert.equal(scene.canopies[0].rotation,35*Math.PI/180);assert.equal(requests.at(-1).current.createdComponents[0].candidateVersion,1);
 checks.push({case:'Conversational placement edit retains geometry and version',...scene});
 // A rejected generation must retain the current property.
 next={error:'Unsupported component placement. Your current villa is preserved.',findings:[{path:'componentRequests',message:'Fixed site cannot fit the new canopy.'}]};
 await page.getByRole('button',{name:'New design',exact:true}).click();await generate('Build a canopy outside the fixed lot.');
 assert.deepEqual(await inspect(),scene);await page.getByRole('button',{name:'Terra needs attention',exact:true}).click();
 await page.screenshot({path:`${dir}/failure-preserves-property.png`});await page.getByRole('button',{name:'Dismiss Terra response',exact:true}).click();
 next=fixture.reused;await generate('Reuse the reviewed bronze sail on a new house.');
 scene=await inspect();assert(scene.finite&&scene.canopies.length===1);checks.push({case:'Approved candidate reused without a create request',...scene});
 await page.screenshot({path:`${dir}/approved-reuse.png`});
 next=fixture.plain;await generate('Design a normal Caribbean house with existing components.');scene=await inspect();assert(scene.finite&&scene.canopies.length===0);checks.push({case:'Normal generation without creation',...scene});
 await page.screenshot({path:`${dir}/normal-house-no-creation.png`});
 // The automatic experimental candidate remains reviewable in the optional Studio.
 await page.goto('http://localhost:3000/dev/villa-playground/create-component',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Review candidate 1',exact:true}).click();await page.waitForTimeout(2000);
 await page.getByLabel('Architectural brief').waitFor();
 assert.equal(await page.getByLabel('Architectural brief').inputValue(),fixture.prompt);
 assert(await page.getByRole('button',{name:'Approve saved candidate for local reuse',exact:true}).isDisabled());
 await page.screenshot({path:`${dir}/experimental-candidate-review.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({errors,blocked,requests:requests.map(r=>({mode:r.mode,prompt:r.prompt,hasCurrentCreatedComponent:!!r.current?.createdComponents?.length})),checks,providerCalls:0,note:'API responses mocked at the browser boundary; endpoint and SDK covered separately offline. Approval is synthetic in a temporary evidence library.'},null,2));
}finally{await browser.close();}
