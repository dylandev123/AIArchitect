import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/component-creation';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],paidRequests=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1560,height:1150}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){paidRequests.push(u.href);return r.abort();}return r.continue();});
 console.log('Opening workshop');
 await page.goto('http://localhost:3000/dev/villa-playground/create-component',{waitUntil:'networkidle'});
 console.log('Proposing mock');
 await page.getByRole('button',{name:'Propose deterministic wave',exact:true}).click();
 await page.locator('canvas').waitFor();await page.waitForTimeout(4000);
 async function inspect(){return page.locator('canvas').evaluate(c=>{
   let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
   while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){let meshes=0,finite=true,created=0,triangles=0;const canopies=[];s.scene.traverse(o=>{if(o.name.startsWith('Created component')){created++;o.traverse(child=>{if(child.isMesh){const g=child.geometry;triangles+=g.index?g.index.count/3:g.attributes.position.count/3;}});canopies.push({name:o.name,position:o.position.toArray(),rotation:o.rotation.y});}if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);}});return {meshes,finite,created,triangles,canopies};}h=h.next;}f=f.return;}return null;
 });}
 for(const [index,id] of [[0,'horizon'],[1,'breeze']]){
  console.log('Preview',id);
  await page.getByLabel('Villa composition').selectOption(String(index));await page.waitForTimeout(3500);
  const scene=await inspect();assert(scene?.finite&&scene.created===1&&scene.meshes>100,JSON.stringify({scene,errors}));
  console.log('Inspected',scene);
  await page.getByRole('button',{name:'Capture current villa preview',exact:true}).click();
  await page.getByLabel('I reviewed proportions, orientation, supports, clearance and material appearance').waitFor({timeout:35000});
  await page.screenshot({path:`${dir}/tidal-${id}.png`,fullPage:true});
  const image=await page.getByAltText('Current captured preview').getAttribute('src');writeFileSync(`${dir}/tidal-${id}-scene.png`,Buffer.from(image.split(',')[1],'base64'));
  await page.getByLabel('I reviewed proportions, orientation, supports, clearance and material appearance').check();await page.getByRole('button',{name:'Retain reviewed evidence',exact:true}).click();
  const frameTiming=await page.evaluate(()=>new Promise(resolve=>{const times=[];let previous=performance.now();function tick(now){times.push(now-previous);previous=now;if(times.length<30)requestAnimationFrame(tick);else resolve({meanFrameMs:times.reduce((a,b)=>a+b,0)/times.length,samples:times.length});}requestAnimationFrame(tick);}));
  checks.push({id,...scene,frameTiming});
 }
 console.log('Saving candidate');
 await page.getByRole('button',{name:'Save experimental candidate',exact:true}).click();await page.getByText(/Selected: tidal-ribbon@\d+ · experimental/).waitFor();
 await page.getByRole('button',{name:'Approve saved candidate for local reuse',exact:true}).click();await page.getByText(/Selected: tidal-ribbon@\d+ · approved/).waitFor();
 await page.getByLabel('Preview framing',{exact:true}).selectOption('detail');await page.waitForTimeout(2200);await page.locator('canvas').screenshot({path:`${dir}/tidal-detail.png`});await page.getByLabel('Preview framing',{exact:true}).selectOption('composition');
 const selected=await page.getByText(/Selected: tidal-ribbon@\d+ · approved/).textContent();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export version-pinned villa study',exact:true}).click()]);await download.saveAs(`${dir}/pinned-villa-study.json`);
 await page.reload({waitUntil:'networkidle'});
 const approved=page.getByRole('button',{name:/Reuse version/}).filter({hasNotText:'impossible'});await approved.last().click();await page.locator('canvas').waitFor();await page.waitForTimeout(3000);assert.equal((await inspect()).created,1);
 await page.getByLabel('Reload pinned villa study').setInputFiles(`${dir}/pinned-villa-study.json`);await page.waitForTimeout(3000);assert.equal((await inspect()).canopies[0].rotation,25*Math.PI/180);
 await page.screenshot({path:`${dir}/approved-pinned-reuse.png`,fullPage:true});
 await page.getByLabel('length',{exact:true}).fill('8');await page.getByLabel('length',{exact:true}).press('Tab');assert.equal(JSON.parse(await page.getByLabel('Editable proposal JSON').inputValue()).geometry.length,8);
 const invalid=JSON.parse(await page.getByLabel('Editable proposal JSON').inputValue());invalid.geometry.builder='freeform-code@1';await page.getByLabel('Editable proposal JSON').fill(JSON.stringify(invalid));await page.getByRole('button',{name:'Validate and apply geometry',exact:true}).click();await page.getByText(/Capability gap \/ invalid proposal/).waitFor();assert.equal((await inspect()).created,1);
 await page.screenshot({path:`${dir}/unsupported-preserves-preview.png`,fullPage:true});
 await page.getByRole('button',{name:'Propose deterministic fan',exact:true}).click();await page.waitForTimeout(3000);assert.equal((await inspect()).created,1);await page.screenshot({path:`${dir}/flared-sail.png`,fullPage:true});
 checks.push({id:'fan',...await inspect()});
 await page.getByLabel('Preview framing',{exact:true}).selectOption('detail');await page.waitForTimeout(2200);await page.locator('canvas').screenshot({path:`${dir}/flared-detail.png`});
 // Real regression scenes, same browser and no AI network access.
 for(const [id,query] of [['solana',''],['estate','?composition=estate-palmhaven']]){
  await page.goto('http://localhost:3000/dev/villa-playground'+query,{waitUntil:'networkidle'});await page.locator('canvas').waitFor();await page.waitForTimeout(3500);await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(1500);
  const scene=await inspect();assert(scene?.finite&&scene.meshes>100&&scene.created===0,JSON.stringify(scene));await page.screenshot({path:`${dir}/regression-${id}.png`});checks.push({id,...scene});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(paidRequests,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({errors,paidRequests,selected,checks,notes:'Review checkboxes exercised by automation; human architectural approval remains a separate judgment.'},null,2));
}finally{await browser.close();}
