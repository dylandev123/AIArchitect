/** Offline replay/capture only. All AI/provider traffic is blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/villa-playground/redesign-live',read=n=>JSON.parse(readFileSync(`${dir}/${n}.json`));
const before=read('before'),accepted=existsSync(`${dir}/after.json`);
const draft=existsSync(`${dir}/recoverable-draft.UNAPPROVED.json`),noCandidate=!accepted&&!draft;
const after=accepted?read('after'):draft?read('recoverable-draft.UNAPPROVED'):before,response=accepted?read('response'):null;
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const requests=[],errors=[],blocked=[],captures=[];let replay=false;
try{
 const context=await browser.newContext({viewport:{width:1800,height:1200}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.pathname==='/api/ai/scene'&&replay){replay=false;requests.push(r.request().postDataJSON());return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response.output)});}if(u.pathname==='/api/ai/scene'&&noCandidate){requests.push(r.request().postDataJSON());return r.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'Retained single live response rejected: missing name, summary, unsupported and operations.',providerCalls:0})});}if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 const projectId='controlled-redesign-25m-unapproved';
 const original={id:'original-retained-raw',createdAt:Date.now(),summary:'Original retained $25m mansion, unchanged',houseConfigJson:JSON.stringify(before)};
 await page.goto('http://localhost:3000',{waitUntil:'networkidle',timeout:120000});
 await page.evaluate(({before,projectId,original})=>{const now=Date.now();localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[{id:projectId,name:before.name,createdAt:now,updatedAt:now,projectType:'house',generationMode:'direct-scene',houseConfigJson:JSON.stringify(before),versions:[original],currentVersionIndex:0}]},version:0}));},{before,projectId,original});
 await page.goto(`http://localhost:3000/workspace/${projectId}`,{waitUntil:'networkidle',timeout:120000});
 const project=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),projectId);
 const cameras={arrival:{position:[44,23,58],target:[0,4,0]},aerial:{position:[45,60,-48],target:[0,3,0]},poolside:{position:[43,24,-59],target:[0,4,0]}};
 async function capture(name,scene){for(const [view,cam]of Object.entries(cameras)){
  const state=await page.locator('canvas').evaluate((c,cam)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.target.set(...cam.target);s.camera.position.set(...cam.position);s.controls.update();s.invalidate();const ids=[],invalid=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh&&o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);});return {position:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov,ids,invalid};}h=h.next;}f=f.return;}},cam);
  assert.deepEqual(state.ids.sort(),scene.elements.map(e=>e.id).sort());assert.deepEqual(state.invalid,[]);await page.waitForTimeout(1000);await page.locator('canvas').screenshot({path:`${dir}/${name}-${view}.png`});captures.push({name,view,...state});
 }}
 await page.getByRole('heading',{name:before.name,exact:true}).waitFor();await capture('before',before);
 if(accepted){
  await page.getByLabel('Terra design brief',{exact:true}).fill(read('request').prompt);replay=true;
  await page.getByRole('button',{name:'Redesign',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id)?.versions.length===2,projectId,{timeout:30000});
  const revised=await project();assert.deepEqual(JSON.parse(revised.houseConfigJson).elements,after.elements);assert.deepEqual(revised.versions[0],original);
  assert.equal(requests.length,1);assert.equal(requests[0].editIntent,'redesign');assert.deepEqual(requests[0].current,before);
  await capture('after',after);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(JSON.parse((await project()).houseConfigJson),before);
  await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(JSON.parse((await project()).houseConfigJson).elements,after.elements);
  await page.reload({waitUntil:'networkidle'});assert.deepEqual(JSON.parse((await project()).houseConfigJson).elements,after.elements);
  const persisted=await project();writeFileSync(`${dir}/workspace-replay-project.UNAPPROVED.json`,JSON.stringify(persisted,null,2));
  writeFileSync(`${dir}/client-metadata-check.json`,JSON.stringify({serverKnowledgeEvidence:after.knowledgeEvidence,clientKnowledgeEvidence:JSON.parse(persisted.houseConfigJson).knowledgeEvidence??[],geometryExact:true},null,2));
 }else if(noCandidate){
  await page.getByLabel('Terra design brief',{exact:true}).fill(read('request').prompt);
  await page.getByRole('button',{name:'Redesign',exact:true}).click();
  await page.getByText('Error: Retained single live response rejected: missing name, summary, unsupported and operations.',{exact:true}).waitFor();
  const preserved=await project();assert.deepEqual(preserved.versions,[original]);assert.deepEqual(JSON.parse(preserved.houseConfigJson),before);
  await capture('after-UNCHANGED-NO-CANDIDATE',before);
 }else{
  await page.evaluate(({after,projectId})=>{const raw=JSON.parse(localStorage.getItem('ai-architect-projects')),p=raw.state.projects.find(p=>p.id===projectId);p.versions.push({id:'unapproved-invalid-draft',createdAt:Date.now(),summary:'UNAPPROVED rejected construction draft, inspection only',houseConfigJson:JSON.stringify(after)});p.currentVersionIndex=1;p.houseConfigJson=JSON.stringify(after);localStorage.setItem('ai-architect-projects',JSON.stringify(raw));},{after,projectId});
  await page.reload({waitUntil:'networkidle'});await capture('after-DRAFT-REJECTED',after);
 }
 const afterName=accepted?'after':noCandidate?'after-UNCHANGED-NO-CANDIDATE':'after-DRAFT-REJECTED';for(const view of Object.keys(cameras)){const a=captures.find(c=>c.name==='before'&&c.view===view),b=captures.find(c=>c.name===afterName&&c.view===view);for(const key of ['position','target','fov'])assert.deepEqual(a[key],b[key]);}
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 const now=Date.now(),version={id:'terra-redesign-unapproved',createdAt:now,summary:accepted?'Terra Redesign — UNAPPROVED candidate':'Terra Redesign — UNAPPROVED rejected draft',houseConfigJson:JSON.stringify(after)};
 writeFileSync(`${dir}/preserved-versions.UNAPPROVED.json`,JSON.stringify({approval:noCandidate?'NO_CANDIDATE':'UNAPPROVED',project:{id:projectId,name:before.name,createdAt:now,updatedAt:now,projectType:'house',generationMode:'direct-scene',houseConfigJson:JSON.stringify(after),versions:noCandidate?[original]:[original,version],currentVersionIndex:noCandidate?0:1}},null,2));
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,offlineReplay:true,accepted,noCandidate,matchedCameras:true,undoRedoReload:accepted,originalVersionUnchanged:true,errors,blocked,captures},null,2));
 console.log(noCandidate?'Matched unchanged views captured; rejection preserves the original version; no candidate; zero provider calls.':'Matched views captured; original preserved separately; candidate remains unapproved; zero provider calls.');
}finally{await browser.close();}
