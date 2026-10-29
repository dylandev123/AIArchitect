/** Offline actual workspace viewer capture; all AI and external requests blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/code-driven',base=process.env.ARCHITECTURE_PREVIEW_URL ?? 'http://localhost:3000';
const bundle=JSON.parse(readFileSync('docs/architecture/completion-network-restored/capture-bundle.UNAPPROVED.json'));
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto(base,{waitUntil:'networkidle',timeout:120000});
 const cameras={overview:{position:[35,26,42],target:[0,3,0]}};
 async function capture(name,scene){for(const [view,cam]of Object.entries(cameras)){
  const state=await page.locator('canvas').evaluate((c,cam)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.minDistance=.1;s.controls.target.set(...cam.target);s.camera.position.set(...cam.position);s.controls.update();s.invalidate();const ids=[],invalid=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh&&o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);});return {position:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov,ids,invalid};}h=h.next;}f=f.return;}},cam);
  assert.deepEqual(state.ids.sort(),scene.elements.map(e=>e.id).sort());assert.deepEqual(state.invalid,[]);await page.waitForTimeout(1000);await page.locator('canvas').screenshot({path:`${dir}/${name}-${view}.png`});captures.push({name,view,...state});
 }}
 const sources={solana:`${dir}/solana.scene.json`,court:`${dir}/court.scene.json`,edited:`${dir}/edited.scene.json`};
 for(const [name,source] of Object.entries(sources)){
 const houseConfigJson=readFileSync(source,'utf8');
 const version={...bundle.project.versions[0],houseConfigJson};
 const project={...bundle.project,versions:[version],currentVersionIndex:0,houseConfigJson};
 await page.evaluate(project=>{localStorage.setItem('ai-architect-projects',JSON.stringify({version:6,state:{projects:[project]}})); localStorage.setItem('terra-direct-scene-1',project.houseConfigJson);},project);
 await page.goto(`${base}/workspace/${project.id}`,{waitUntil:'networkidle',timeout:120000});
 await page.waitForTimeout(1500); await page.getByRole('button',{name:'Redesign',exact:true}).waitFor();
 await page.getByRole('heading',{name:JSON.parse(houseConfigJson).name,exact:true}).waitFor({timeout:20000}); await page.waitForTimeout(2000);
 await capture(name,JSON.parse(project.houseConfigJson));
 if(name==='solana'){
   await page.getByLabel('Element',{exact:true}).selectOption('dining-roof');
   await page.getByLabel('Finish',{exact:true}).selectOption('limestone');
   await page.getByRole('button',{name:'Undo',exact:true}).click();
   assert.equal(await page.getByLabel('Finish',{exact:true}).inputValue(),'ivory');
   await page.getByRole('button',{name:'Redo',exact:true}).click();
   assert.equal(await page.getByLabel('Finish',{exact:true}).inputValue(),'limestone');
   await page.reload({waitUntil:'networkidle'});
   await page.getByLabel('Element',{exact:true}).selectOption('dining-roof');
   assert.equal(await page.getByLabel('Finish',{exact:true}).inputValue(),'limestone');
 }

 }
 await page.goto(`${base}/dev/villa-playground`,{waitUntil:'networkidle',timeout:120000});
 await page.getByLabel('Comparison',{exact:true}).selectOption('solana');
 await page.waitForTimeout(2000);
 await capture('original-solana',{elements:[]});
 for(const view of Object.keys(cameras)){const group=captures.filter(c=>c.view===view);for(const c of group.slice(1))for(const k of ['position','target','fov'])assert.deepEqual(c[k],group[0][k]);}
 assert.deepEqual(errors,[]);assert(blocked.every(u=>new URL(u).pathname==='/api/assets'));
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,matchedCameras:true,selectionUndoRedoReload:true,errors,blocked,captures},null,2));
 console.log('4 actual viewer architecture screenshots; API and external requests blocked.');
}finally{await browser.close();}
