/** Offline UI check. Every AI endpoint is intercepted; external traffic is aborted. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/villa-playground/redesign-construction-fix';
const before=JSON.parse(readFileSync('docs/villa-playground/redesign-live/before.json','utf8'));
const output=JSON.parse(readFileSync(`${dir}/developer-study.output.json`,'utf8'));
const after=JSON.parse(readFileSync(`${dir}/developer-study.scene.json`,'utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const requests=[],errors=[],blocked=[];let scenario='complete';
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/api/ai/scene'){
   const request=route.request().postDataJSON();requests.push({scenario,request});assert.equal(request.editIntent,'redesign');assert.equal(request.mode,'edit');
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(scenario==='complete'?output:{architecturalPlan:output.architecturalPlan})});
  }
  if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return route.abort();}
  return route.continue();
 });
 const id='developer-redesign-contract-offline';
 await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
 await page.evaluate(({id,before})=>{const now=Date.now(),json=JSON.stringify(before);localStorage.setItem('ai-architect-projects',JSON.stringify({version:6,state:{projects:[{id,name:'Offline contract check',projectType:'house',generationMode:'direct-scene',createdAt:now,updatedAt:now,houseConfigJson:json,versions:[{id:'original',createdAt:now,summary:'Original',houseConfigJson:json}],currentVersionIndex:0}]}}));},{id,before});
 await page.reload({waitUntil:'networkidle'});
 
 await page.getByText('Offline contract check',{exact:true}).click();
 await page.getByRole('button',{name:'Redesign',exact:true}).waitFor();
 assert(page.url().includes(`/workspace/${id}`));
 const project=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),id);
 const original=(await project()).versions[0];
 await page.getByLabel('Terra design brief',{exact:true}).fill('Execute the developer-authored offline construction study.');
 await page.getByRole('button',{name:'Redesign',exact:true}).click();
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id).versions.length===2,id);
 const saved=await project();assert.deepEqual(saved.versions[0],original);assert.deepEqual(JSON.parse(saved.houseConfigJson).elements,after.elements);
 await page.locator('canvas').screenshot({path:`${dir}/developer-study.browser.png`});
 // Finite mesh check and independently editable element identities.
 const render=await page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const ids=[],invalid=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh&&o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);});return {ids,invalid};}h=h.next;}f=f.return;}});
 assert.deepEqual(render.ids.sort(),after.elements.map(e=>e.id).sort());assert.deepEqual(render.invalid,[]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(JSON.parse((await project()).houseConfigJson),before);
 await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(JSON.parse((await project()).houseConfigJson).elements,after.elements);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(JSON.parse((await project()).houseConfigJson).elements,after.elements);
 scenario='concept-only';const snapshot=await project();
 await page.getByLabel('Terra design brief',{exact:true}).fill('Concept-only mock must be rejected.');
 await page.getByRole('button',{name:'Redesign',exact:true}).click();
 await page.getByText(/expected string/).waitFor();assert.deepEqual(await project(),snapshot);
 assert.equal(requests.length,2);assert.deepEqual(requests[0].request.current,before);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync(`${dir}/browser.json`,JSON.stringify({providerCalls:0,homepageProjectEntry:true,canonicalEndpoint:'/api/ai/scene',redesignIntent:true,successVersion:true,originalUnchanged:true,undoRedoReload:true,conceptOnlyRejected:true,render,errors,blocked,requests},null,2));
 console.log('Homepage → workspace Redesign: valid candidate, undo/redo/reload, concept-only rejection; zero provider calls.');
}finally{await browser.close();}
