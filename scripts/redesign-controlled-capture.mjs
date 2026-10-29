import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/villa-playground/redesign-live';mkdirSync(dir,{recursive:true});
const before=JSON.parse(readFileSync('docs/villa-playground/25m-mansion-recovery/original.scene.json'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const requests=[],errors=[],blocked=[];
try{
 const page=await browser.newPage({viewport:{width:1800,height:1200}});page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.pathname==='/api/ai/scene'){requests.push(r.request().postDataJSON());return r.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'Offline workflow verification: provider deliberately blocked',providerCalls:0})});}if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 const projectId='controlled-redesign-original-25m';
 await page.goto('http://localhost:3000',{waitUntil:'networkidle',timeout:120000});
 await page.evaluate(({before,projectId})=>{const now=Date.now(),json=JSON.stringify(before);localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[{id:projectId,name:before.name,createdAt:now,updatedAt:now,projectType:'house',generationMode:'direct-scene',houseConfigJson:json,versions:[{id:'original-retained-raw',createdAt:now,summary:'Original retained $25m mansion, unchanged',houseConfigJson:json}],currentVersionIndex:0}]},version:0}));},{before,projectId});
 await page.goto(`http://localhost:3000/workspace/${projectId}`,{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('heading',{name:before.name,exact:true}).waitFor();
 await page.getByLabel('Terra design brief',{exact:true}).fill('Fundamentally redesign the $25m main residence, including architectural volumes, entrances, roofs and facades.');
 await page.getByRole('button',{name:'Redesign',exact:true}).click();
 await page.getByText('Error: Offline workflow verification: provider deliberately blocked',{exact:true}).waitFor();
 assert.equal(requests.length,1);assert.equal(requests[0].editIntent,'redesign');assert.equal(requests[0].mode,'edit');assert.deepEqual(requests[0].current,before);assert(requests[0].prompt.includes('Substantial changes'));
 const project=await page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),projectId);assert.equal(project.versions.length,1);assert.deepEqual(JSON.parse(project.houseConfigJson),before);
 const cameras={arrival:{position:[44,23,58],target:[0,4,0]},aerial:{position:[45,60,-48],target:[0,3,0]},poolside:{position:[43,24,-59],target:[0,4,0]}};
 const captures=[];
 for(const [view,cam]of Object.entries(cameras)){
 const state=await page.locator('canvas').evaluate((c,cam)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.target.set(...cam.target);s.camera.position.set(...cam.position);s.controls.update();s.invalidate();const ids=[],invalid=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh&&o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);});return {position:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov,ids,invalid};}h=h.next;}f=f.return;}},cam);
 assert.deepEqual(state.ids.sort(),before.elements.map(e=>e.id).sort());assert.deepEqual(state.invalid,[]);await page.waitForTimeout(900);await page.locator('canvas').screenshot({path:`${dir}/before-${view}.png`});captures.push({view,...state});
 }
 assert.deepEqual(errors,[]);
 writeFileSync(`${dir}/browser-preflight.json`,JSON.stringify({providerCalls:0,requestIntercepted:true,workflow:'normal /workspace direct-scene OperationStudio → Redesign → /api/ai/scene',request:requests[0],originalVersionUnchanged:project,errors,blocked,captures},null,2));
 console.log('User-facing Redesign request verified; original version unchanged; three baseline views; zero provider calls.');
}finally{await browser.close();}
