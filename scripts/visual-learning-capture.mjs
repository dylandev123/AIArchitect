/** Actual renderer -> review -> existing operations -> same-camera comparison.
 * Provider routes are fulfilled locally. No feedback here is model-generated. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/visual-learning';mkdirSync(dir,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const cases=[
 {id:'25m',source:'docs/villa-playground/redesign-strict-live/after.UNAPPROVED.json',brief:'Offline diagnostic context: $25m contemporary waterfront estate; retained original brief not fully available',operations:read('docs/villa-playground/redesign-technical-review/repair.operations.json')},
 {id:'10m',source:'docs/architecture/spatial-root-cause/7702f28d-6098-4bf4-b08a-b12fc68ae93b.scene.json',brief:'Offline diagnostic context: $10m Caribbean beach house mansion with pool and shaded terraces',operations:[{op:'resize',id:'pool-terrace',size:[18,.2,4.5]},{op:'move',id:'pool-terrace',at:[0,.1,-7.25]}]},
];
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const results=[];
try{for(const c of cases){
 const context=await browser.newContext({viewport:{width:1400,height:1100}}),page=await context.newPage();
 const errors=[],blocked=[];let reviewCalls=0,editCalls=0,lessonCalls=0;
 const original=read(c.source),sha=createHash('sha256').update(readFileSync(c.source)).digest('hex');
 await context.addInitScript(scene=>localStorage.setItem('terra-direct-scene-1',JSON.stringify(scene)),original);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['localhost','127.0.0.1'].includes(url.hostname)){blocked.push(url.href);return route.abort();}
  if(url.pathname==='/api/ai/villa/visual-review'){
   reviewCalls++;const payload=route.request().postDataJSON();
   assert.deepEqual(payload.current,original);assert.equal(payload.images.length,4);
   for(let i=0;i<4;i++)writeFileSync(`${dir}/${c.id}-before-${i}.png`,Buffer.from(payload.images[i].split(',')[1],'base64'));
   writeFileSync(`${dir}/${c.id}-request-evidence.json`,JSON.stringify({brief:payload.brief,imageCount:4,unresolved:payload.unresolved,sceneSha256:sha,feedbackOrigin:'deterministic mock, not a visual model assessment'},null,2));
   return route.fulfill({json:{review:{weaknesses:[`SIMULATED finding for ${c.id}; geometric diagnostic only`],improvement:'Apply the retained deterministic geometric correction only.',scope:[...new Set(c.operations.map(o=>'element:'+o.id))],editIntent:'refine'},providerCalls:0}});
  }
  if(url.pathname==='/api/ai/scene'){
   editCalls++;return route.fulfill({json:{name:original.name,summary:'Offline fixture correction; architectural quality unverified',unsupported:[],operations:c.operations,providerCalls:0}});
  }
  if(url.pathname==='/api/dev/villa-design-lessons'){lessonCalls++;return route.abort();}
  if(url.pathname.startsWith('/api/ai/')){blocked.push(url.href);return route.abort();}
  return route.continue();
 });
 await page.goto('http://localhost:3000/dev/villa-playground',{waitUntil:'networkidle',timeout:120000});
 await page.getByLabel('Terra design brief').fill(c.brief);
 await page.locator('summary').filter({hasText:'Visual review'}).click();
 assert.equal(await page.getByRole('button',{name:'Evaluate scene',exact:true}).isDisabled(),true);
 await page.getByLabel('Authorize one paid visual review and at most one paid revision; no retries').check();
 await page.getByRole('button',{name:'Evaluate scene',exact:true}).click();
 await page.getByText('Before / proposed · architectural improvement remains unverified until human review',{exact:true}).waitFor({timeout:120000});
 const shots=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>/before|proposed/.test(i.alt)).map(i=>({alt:i.alt,image:i.src})));
 assert.equal(shots.length,8);
 for(const shot of shots)writeFileSync(`${dir}/${c.id}-${shot.alt.toLowerCase().replaceAll(' ','-')}.png`,Buffer.from(shot.image.split(',')[1],'base64'));
 await page.screenshot({path:`${dir}/${c.id}-comparison.png`,fullPage:true});
 assert.equal(reviewCalls,1);assert.equal(editCalls,1);assert.equal(lessonCalls,0);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 assert.equal(createHash('sha256').update(readFileSync(c.source)).digest('hex'),sha);
 results.push({id:c.id,source:c.source,sha256:sha,providerCalls:0,mockReviewRequests:reviewCalls,mockEditRequests:editCalls,lessonWrites:lessonCalls,actualSceneCaptures:shots.length,preserved:true,errors,blocked});
 await context.close();console.log(`${c.id}: eight actual renderer captures, one mocked review/revision, original preserved.`);
}}finally{await browser.close();}
writeFileSync(`${dir}/browser-evidence.json`,JSON.stringify({providerCalls:0,feedbackOrigin:'deterministic mocks',results},null,2));
