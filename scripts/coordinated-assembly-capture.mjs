/** Offline actual workspace viewer capture; all AI and external requests blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/coordinated-assemblies';
const bundle=JSON.parse(readFileSync('docs/architecture/completion-network-restored/capture-bundle.UNAPPROVED.json'));
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[],editChecks=[];
try{
 const context=await browser.newContext({viewport:{width:1800,height:1200}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')console.log('console',m.text());});page.on('requestfailed',r=>console.log('failed',r.url(),r.failure()));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto('http://127.0.0.1:3001',{waitUntil:'networkidle',timeout:120000});
 const cameras={aerial:{position:[42,38,52],target:[0,1,2]},arrival:{position:[28,15,46],target:[0,1,0]}};
 async function capture(name,scene){for(const [view,cam]of Object.entries(cameras)){
  const state=await page.locator('canvas').evaluate((c,cam)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.minDistance=.1;s.controls.target.set(...cam.target);s.camera.position.set(...cam.position);s.controls.update();s.invalidate();const ids=[],invalid=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh&&o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);});return {position:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov,ids,invalid};}h=h.next;}f=f.return;}},cam);
  assert.deepEqual(state.ids.sort(),scene.elements.map(e=>e.id).sort());assert.deepEqual(state.invalid,[]);await page.waitForTimeout(1000);await page.locator('canvas').screenshot({path:`${dir}/${name}-${view}.png`});captures.push({name,view,...state});
 }}
 const sources={tropical:`${dir}/tropical.scene.json`,mediterranean:`${dir}/mediterranean.scene.json`};
 for(const [name,source] of Object.entries(sources)){
 const houseConfigJson=readFileSync(source,'utf8');
 const version={...bundle.project.versions[0],houseConfigJson};
 const project={...bundle.project,versions:[version],currentVersionIndex:0,houseConfigJson};
 await page.evaluate(project=>{localStorage.setItem('ai-architect-projects',JSON.stringify({version:6,state:{projects:[project]}}));},project);
 await page.goto(`http://127.0.0.1:3001/workspace/${project.id}`,{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('button',{name:'Redesign',exact:true}).waitFor().catch(async e=>{console.log((await page.locator('body').innerText()).slice(0,4000),errors,blocked,await page.evaluate(()=>({storage:localStorage.getItem('ai-architect-projects')?.slice(0,200),scripts:[...document.scripts].map(s=>s.src)})));throw e;});
 await page.waitForTimeout(2000);
 await capture(name,JSON.parse(project.houseConfigJson));
 if(name==='mediterranean'){
  await page.getByLabel('Element',{exact:true}).selectOption('north-glass-0');
  await page.getByLabel('Finish',{exact:true}).selectOption('bronze');
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.getByLabel('Finish',{exact:true}).inputValue(),'limestone');
  await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await page.getByLabel('Finish',{exact:true}).inputValue(),'bronze');
  await page.getByLabel('Element',{exact:true}).selectOption('north-roof');await page.getByLabel('Roof form',{exact:true}).selectOption('gable');
  let mocked=0;
  await page.route('**/api/ai/scene',async r=>{mocked++;const request=r.request().postDataJSON();assert.equal(request.mode,'edit');assert.equal(request.editIntent,'refine');await r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'OFFLINE EDIT PROOF',summary:'Offline mocked operation response; no Terra call.',unsupported:[],operations:[{op:'move',id:'north',at:[1,.1,-12]},{op:'scale-assembly',id:'north',factors:[1.1,1,1.1]}]})});});
  await page.getByLabel('Terra design brief',{exact:true}).fill('OFFLINE MOCK: move and scale north wing');await page.getByRole('button',{name:'Refine',exact:true}).click();
  await page.getByRole('button',{name:'Refine',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>document.body.innerText.includes('Offline mocked operation response'));
  await page.getByLabel('Element',{exact:true}).selectOption('north');assert(Math.abs(Number(await page.getByLabel('Width',{exact:true}).inputValue())-24.2)<1e-8);assert.equal(Number(await page.getByLabel('Position x',{exact:true}).inputValue()),1);
  await page.reload({waitUntil:'networkidle'});await page.getByLabel('Element',{exact:true}).selectOption('north');assert(Math.abs(Number(await page.getByLabel('Width',{exact:true}).inputValue())-24.2)<1e-8);
  await page.getByLabel('Element',{exact:true}).selectOption('north-glass-0');assert.equal(await page.getByLabel('Finish',{exact:true}).inputValue(),'bronze');
  await page.getByLabel('Element',{exact:true}).selectOption('north-roof');assert.equal(await page.getByLabel('Roof form',{exact:true}).inputValue(),'gable');
  assert.equal(mocked,1);editChecks.push({childSelection:true,material:true,roofProperties:true,undoRedo:true,wholeWingMoveAndScale:true,reload:true,mockedLocalResponses:mocked,liveCalls:0});
 }

 }
 for(const view of Object.keys(cameras)){const group=captures.filter(c=>c.view===view);for(const c of group.slice(1))for(const k of ['position','target','fov'])assert.deepEqual(c[k],group[0][k]);}
 assert.deepEqual(errors,[]);assert(blocked.every(u=>new URL(u).pathname==='/api/assets'));
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,matchedCameras:true,errors,blocked,captures,editChecks},null,2));
 console.log('4 actual viewer assembly screenshots; API and external requests blocked.');
}finally{await browser.close();}
