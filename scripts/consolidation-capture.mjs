import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const production=process.env.SCENE_PROOF_PRODUCTION==='1';
const dir=production?'docs/consolidation/homepage-production':'docs/consolidation/homepage';mkdirSync(dir,{recursive:true});
const fixture=JSON.parse(readFileSync('docs/villa-playground/terra-direct-scene/turning-lantern.operations.json','utf8'));
const ladera=JSON.parse(readFileSync('docs/villa-playground/scene-operations/ladera.scene.json','utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
let mocks=0;const errors=[],unexpected=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}});
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['localhost','127.0.0.1'].includes(url.hostname)){unexpected.push(url.origin);return route.abort();}
  if(url.pathname==='/api/ai/plan'&&route.request().method()==='GET')return route.fulfill({json:{enabled:false}});
  if(url.pathname.startsWith('/api/ai/')){
   if(url.pathname!=='/api/ai/scene'){unexpected.push(url.pathname);return route.abort();}
   mocks++;const input=route.request().postDataJSON();
   const body=input.mode==='edit'?{name:fixture.name,summary:'Moved only privacy screen',unsupported:[],operations:[{op:'move',id:'privacy',at:[-3,1.6,5.5]}]}:fixture;
   return route.fulfill({json:body});
  }
  return route.continue();
 });
 const base=process.env.SCENE_PROOF_URL||'http://localhost:3000';
 await page.goto(base,{waitUntil:'networkidle',timeout:120000});
 assert.equal(await page.getByText('Experimental V3 scene mode',{exact:true}).count(),0);
 assert.equal(await page.getByRole('checkbox').count(),0);
 assert.equal(await page.getByRole('button',{name:'Generate',exact:true}).count(),1);
 await page.screenshot({path:`${dir}/00-homepage.png`});
 await page.getByLabel('Describe your dream home').fill('Five rotated split-level floors and a diagonal sky bridge');
 await page.getByRole('button',{name:'Generate',exact:true}).click();
 await page.waitForURL('**/workspace/**');await page.getByRole('heading',{name:fixture.name}).waitFor({timeout:120000});
 await page.waitForTimeout(3000);
 const projectId=new URL(page.url()).pathname.split('/').at(-1);
 const saved=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),projectId);
 const scene=async()=>JSON.parse((await saved()).houseConfigJson);
 assert.equal((await saved()).generationMode,'direct-scene');assert.equal(mocks,1);
 const before=await scene();assert.equal(before.elements.length,43);checks.push('home Generate -> normal workspace -> canonical scene API');
 await page.getByRole('button',{name:'Aerial',exact:true}).click();await page.waitForTimeout(1200);
 await page.screenshot({path:`${dir}/01-home-generation.png`});
 await page.getByLabel('Terra design brief').fill('Move the privacy screen only');await page.getByRole('button',{name:'Edit scene',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Moved only privacy screen'}).waitFor();
 const after=await scene();assert.deepEqual(after.elements.find(e=>e.id==='privacy').at,[-3,1.6,5.5]);assert.deepEqual(after.elements.filter(e=>e.id!=='privacy'),before.elements.filter(e=>e.id!=='privacy'));checks.push('targeted conversational edit preserves every unrelated element and ID');
 await page.getByLabel('Element',{exact:true}).selectOption('privacy');await page.screenshot({path:`${dir}/02-targeted-edit.png`});
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await scene(),before);
 await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await scene(),after);
 await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:fixture.name}).waitFor();assert.deepEqual(await scene(),after);assert.equal(mocks,2);checks.push('undo, redo and reload use durable project versions with no regeneration');
 await page.getByRole('link',{name:'All projects'}).click();await page.getByRole('link').filter({hasText:'Five rotated split-level'}).click();await page.getByRole('heading',{name:fixture.name}).waitFor();assert.deepEqual(await scene(),after);checks.push('reopen from normal recent projects');
 await page.getByLabel('Import scene JSON').setInputFiles({name:'ladera.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(ladera))});await page.getByRole('heading',{name:ladera.name}).waitFor();assert.deepEqual(await scene(),ladera);checks.push('Casa Ladera imported losslessly into normal project history');
 await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(1800);await page.screenshot({path:`${dir}/03-casa-ladera.png`});
 await page.getByLabel('Element',{exact:true}).selectOption('salon-roof');await page.getByLabel('Roof form').selectOption('gable');
 const pitched=await scene();assert.equal(pitched.elements.find(e=>e.id==='salon-roof').roofForm,'gable');assert.deepEqual(pitched.elements.filter(e=>e.id!=='salon-roof'),ladera.elements.filter(e=>e.id!=='salon-roof'));
 await page.waitForTimeout(1400);await page.screenshot({path:`${dir}/06-reused-gable-roof.png`});checks.push('shared legacy gable roof builder renders under a targeted editable scene element');
 await page.getByText('Advanced Terrain & Elevation',{exact:true}).click();
 await page.getByLabel('Enable advanced terrain').check();
 const withTerrain=await scene();assert.equal(withTerrain.terrain.grade,.05);assert.deepEqual(withTerrain.elements,pitched.elements);
 await page.getByLabel('Terrain grade').fill('0.08');
 assert.equal((await scene()).terrain.grade,.08);
 await page.waitForTimeout(1200);await page.screenshot({path:`${dir}/08-shared-terrain.png`});
 await page.reload({waitUntil:'networkidle'});assert.equal((await scene()).terrain.grade,.08);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await scene()).terrain.grade,.05);
 checks.push('optional terrain reuses existing natural-ground compiler; save, reload and undo preserve architecture');
 const legacyJson=JSON.stringify({house:{width:12,depth:9,floors:1,roof:'gable'},windows:[{wall:'north',level:0,offset:2,width:2,height:1.5,sill:1}],doors:[],garages:[],balconies:[],patios:[],pools:[],driveways:[],rooms:[],buildings:[],roads:[],parking:[],landscaping:[],decks:[]});
 await page.evaluate(json=>{const raw=JSON.parse(localStorage.getItem('ai-architect-projects'));const now=Date.now();raw.state.projects.push({id:'legacy-proof',name:'Legacy cottage proof',createdAt:now,updatedAt:now,projectType:'house',generationMode:'v2-architectural',houseConfigJson:json,versions:[{id:'legacy-version',createdAt:now,summary:'Existing design',houseConfigJson:json}],currentVersionIndex:0});localStorage.setItem('ai-architect-projects',JSON.stringify(raw));},legacyJson);
 await page.goto(`${base}/workspace/legacy-proof`,{waitUntil:'networkidle'});await page.waitForTimeout(2200);await page.screenshot({path:`${dir}/07-legacy-saved-house.png`});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id==='legacy-proof').houseConfigJson),legacyJson);checks.push('legacy saved house opens normal workspace with source JSON unchanged');
 const legacyV3Json=readFileSync('docs/consolidation/homepage/recovered-planning-scene.json','utf8');
 await page.evaluate(json=>{const raw=JSON.parse(localStorage.getItem('ai-architect-projects'));const now=Date.now();raw.state.projects.push({id:'legacy-v3-proof',name:'Recovered legacy V3 plan',createdAt:now,updatedAt:now,projectType:'house',generationMode:'v3-scene',v3TerrainMode:'flat',houseConfigJson:json,versions:[{id:'v3-legacy-version',createdAt:now,summary:'Retained planning scene',houseConfigJson:json}],currentVersionIndex:0});localStorage.setItem('ai-architect-projects',JSON.stringify(raw));},legacyV3Json);
 await page.goto(`${base}/workspace/legacy-v3-proof`,{waitUntil:'networkidle'});await page.waitForTimeout(1800);
 await page.screenshot({path:`${dir}/09-legacy-v3-plan.png`});
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id==='legacy-v3-proof').houseConfigJson),legacyV3Json);
 checks.push('recovered legacy V3 planning project opens without regeneration or source conversion');
 if(!production){
 await page.goto(`${base}/dev/villa-playground?scene=legacy`,{waitUntil:'networkidle'});await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/04-solana-compatibility.png`});checks.push('existing Villa Solana playground renderer opens');
 await page.goto(`${base}/dev/villa-playground/image-first`,{waitUntil:'networkidle'});await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/05-image-first-compatibility.png`});checks.push('image-first primary studio opens');
 await page.goto(`${base}/dev/villa-playground/image-first?compatibility=1`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:/Image-first/}).waitFor();checks.push('retained offline image-first compatibility replay opens');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,mockedRequests:mocks,errors,unexpected,checks},null,2));
 console.log(JSON.stringify({mocks,errors,unexpected,checks},null,2));
}finally{await browser.close();}
