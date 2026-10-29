/** Offline actual workspace viewer capture; all AI and external requests blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/villa-playground/redesign-technical-review';
const bundle=JSON.parse(readFileSync(`${dir}/preserved-versions.UNAPPROVED.json`));
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[];
try{
 const context=await browser.newContext({viewport:{width:1800,height:1200}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto('http://localhost:3000',{waitUntil:'networkidle',timeout:120000});
 const cameras={arrival:{position:[35,16,40],target:[0,3,0]},aerial:{position:[28,48,-35],target:[0,2,0]},entrance:{position:[6,5,23],target:[0,2,7]},poolside:{position:[24,12,-34],target:[0,3,-3]}};
 async function capture(name,scene){for(const [view,cam]of Object.entries(cameras)){
  const state=await page.locator('canvas').evaluate((c,cam)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.target.set(...cam.target);s.camera.position.set(...cam.position);s.controls.update();s.invalidate();const ids=[],invalid=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh&&o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);});return {position:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov,ids,invalid};}h=h.next;}f=f.return;}},cam);
  assert.deepEqual(state.ids.sort(),scene.elements.map(e=>e.id).sort());assert.deepEqual(state.invalid,[]);await page.waitForTimeout(1000);await page.locator('canvas').screenshot({path:`${dir}/${name}-${view}.png`});captures.push({name,view,...state});
 }}
 for(let i=0;i<3;i++){
 const project={...bundle.project,currentVersionIndex:i,houseConfigJson:bundle.project.versions[i].houseConfigJson};
 await page.evaluate(project=>{localStorage.setItem('ai-architect-projects',JSON.stringify({version:6,state:{projects:[project]}}));},project);
 await page.goto(`http://localhost:3000/workspace/${project.id}`,{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('button',{name:'Redesign',exact:true}).waitFor();
 await page.waitForTimeout(2000);
 await capture(['original','terra','repaired'][i],JSON.parse(project.houseConfigJson));
 }
 for(const view of Object.keys(cameras)){const group=captures.filter(c=>c.view===view);for(const c of group.slice(1))for(const k of ['position','target','fov'])assert.deepEqual(c[k],group[0][k]);}
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,matchedCameras:true,errors,blocked,captures},null,2));
 console.log('12 matched actual viewer screenshots; zero AI traffic.');
}finally{await browser.close();}
