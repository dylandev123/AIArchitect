/** Offline actual workspace viewer capture; all AI and external requests blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/terra-coordination-experiment';
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const selectedView=process.argv[2];
const previous=selectedView?JSON.parse(readFileSync(`${dir}/browser-result.json`)):undefined;
const errors=[],blocked=[],captures=previous?previous.captures.filter(c=>c.view!==selectedView):[];
try{
 const context=await browser.newContext({viewport:{width:1800,height:1200}}),page=await context.newPage();page.on('pageerror',e=>{errors.push(String(e));console.log('PAGE ERROR',String(e));});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 
 const cameras={arrival:{position:[35,16,40],target:[0,3,0]},aerial:{position:[28,48,-35],target:[0,2,0]},entrance:{position:[6,5,23],target:[0,2,7]},poolside:{position:[24,12,-34],target:[0,3,-3]},interior:{position:[7.2,2.1,2.5],target:[2.1,2,1]},upper:{position:[1.75,5,1.3],target:[1.75,5,-4.8]},pooldetail:{position:[11,4,-20],target:[0,.3,-14]},loggia:{position:[6,2,-10.4],target:[0,2,-7]}};
 async function capture(name,scene){for(const [view,cam]of Object.entries(cameras).filter(([view])=>!selectedView||view===selectedView)){
  const state=await page.locator('canvas').evaluate((c,cam)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.controls.enableDamping=false;s.controls.minDistance=.1;s.controls.target.set(...cam.target);s.camera.position.set(...cam.position);s.controls.update();s.invalidate();const ids=[],invalid=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh&&o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);});return {position:s.camera.position.toArray(),target:s.controls.target.toArray(),fov:s.camera.fov,ids,invalid};}h=h.next;}f=f.return;}},cam);
  assert.deepEqual(state.ids.sort(),scene.elements.map(e=>e.id).sort());assert.deepEqual(state.invalid,[]);await page.waitForTimeout(1000);await page.locator('canvas').screenshot({path:`${dir}/${name}-${view}.png`});captures.push({name,view,...state});
 }}
 const sources={before:`${dir}/before.json`,after:`${dir}/after.UNAPPROVED.json`};
 for(const [name,source] of Object.entries(sources)){console.log("loading",name);
 const houseConfigJson=readFileSync(source,'utf8');
 await page.goto(`http://127.0.0.1:3004/scripts/terra-coordination-preview/index.html?${name}`,{waitUntil:'networkidle',timeout:120000});
 console.log('navigated',await page.title(),page.url());console.log((await page.locator('body').innerText()).slice(0,1000));await page.locator('canvas').first().waitFor({timeout:60000}).catch(async e=>{writeFileSync(`${dir}/capture-debug.txt`,await page.locator('body').innerText());await page.screenshot({path:`${dir}/capture-debug.png`});throw e;});
 await page.waitForTimeout(5000);
 console.log("capturing",name);await capture(name,JSON.parse(houseConfigJson));
 }
 for(const view of Object.keys(cameras)){const group=captures.filter(c=>c.view===view);for(const c of group.slice(1))for(const k of ['position','target','fov'])assert.deepEqual(c[k],group[0][k]);}
 assert.deepEqual(errors,[]);assert(blocked.every(u=>new URL(u).pathname==='/api/assets'));
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,matchedCameras:true,errors,blocked,captures},null,2));
 console.log('16 matched actual viewer screenshots; zero API or external requests allowed.');
}finally{await browser.close();}
