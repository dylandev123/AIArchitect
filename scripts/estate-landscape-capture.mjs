import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/estate-creativity';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:`${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const controlsOnly=process.env.ESTATE_CONTROLS_ONLY==='1';
const errors=[],requests=[],checks=controlsOnly?JSON.parse(readFileSync(`${dir}/browser-checks.json`,'utf8')).checks.filter(c=>c.id!=='solana-preserved'):[],controls=[];
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
try {
 const page=await browser.newPage({viewport:{width:1700,height:1150},deviceScaleFactor:1});
 page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/api/ai/**',r=>{requests.push(r.request().url());return r.abort();});
 async function inspect(){return page.locator('canvas').evaluate(canvas=>{
  let f=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
  while(f){let h=f.memoizedState;while(h){const ref=h.memoizedState?.current;const s=ref?.get?ref.get():ref;if(s?.scene?.isScene){let meshes=0,pendingPlanting=0;const groups=[],invalid=[],wings=[];s.scene.updateMatrixWorld(true);s.scene.traverse(o=>{if(o.isGroup&&o.name)groups.push(o.name);if(o.name==='Path border planting'||o.name==='Arrival avenue planting'){let hasMesh=false;o.traverse(p=>{if(p.isMesh)hasMesh=true;});if(!hasMesh)pendingPlanting++;}if(o.name.startsWith('Wing ')){const parts=['Floating limestone roof with teak soffit','Pierced facade with coordinated window bays','Shaded timber veranda'].map(name=>{const p=o.getObjectByName(name);return p?{name,quaternion:p.getWorldQuaternion(p.quaternion.clone()).toArray()}:null;}).filter(Boolean);wings.push({name:o.name,rotation:o.rotation.y,parts});}if(o.isMesh){meshes++;const a=o.geometry.attributes.position?.array;if(a&&!Array.from(a).every(Number.isFinite))invalid.push(o.name);}});return{meshes,pendingPlanting,groups,invalid,wings,camera:s.camera.position.toArray(),target:s.controls?.target.toArray()};}h=h.next;}f=f.return;}return null;
 });}
 await page.goto(`http://localhost:3000/dev/villa-playground?composition=${controlsOnly?'estate-splay':'estate-palmhaven'}`,{waitUntil:'domcontentloaded',timeout:120000});
 console.log('Playground loaded');
 await page.evaluate(async()=>{const m=await fetch('/models/vegetation/manifest.json').then(r=>r.json());await Promise.all(m.models.map(m=>fetch('/models/vegetation/'+m.file).then(r=>r.arrayBuffer())));});
 for(const [id] of (controlsOnly?[]:[['estate-palmhaven','Palmhaven'],['estate-splay','Splay House'],['estate-cortile','Cortile']])) {
  if(id!=='estate-palmhaven')await page.goto(`http://localhost:3000/dev/villa-playground?composition=${id}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('canvas').waitFor({timeout:120000});
  let ready=false;for(let i=0;i<120;i++){const s=await inspect();if(s?.groups.includes(`Local composition · ${id}`)&&s.meshes>100&&s.pendingPlanting===0){ready=true;break;}await page.waitForTimeout(500);}assert(ready,id);
  await page.waitForTimeout(6000);
  let prior=0,stable=0;for(let i=0;i<30;i++){const n=(await inspect()).meshes;if(n===prior)stable++;else stable=0;prior=n;if(stable>=3)break;await page.waitForTimeout(1000);}
  for(const view of ['Above','Arrival','Poolside']) {
   await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(2600);
   await page.evaluate(()=>window.scrollTo(0,0));
   const layout=await page.locator('canvas').boundingBox();assert(layout&&Math.abs(layout.width-1700)<2&&Math.abs(layout.height-1150)<2,'Full viewport stylesheet must be loaded');
   const s=await inspect();assert.deepEqual(s.invalid,[]);assert.equal(s.pendingPlanting,0);checks.push({id,view,...s});
   if(id==='estate-splay')for(const w of s.wings)for(const p of w.parts){const q=p.quaternion;assert(Math.abs(q[1]*Math.sin(w.rotation/2)+q[3]*Math.cos(w.rotation/2))>1-1e-8,p.name);}
   await page.screenshot({path:`${dir}/${id}-${view.toLowerCase()}.png`});
   await page.evaluate(()=>{for(const el of document.querySelectorAll('[class*=terraDock], [class*=intro], [class*=footer], [class*=hints], [class*=header], [class*=styleBar], [class*=compositionBar], [class*=moods], [class*=customizeToggle], [class*=credit], nextjs-portal')){el.dataset.captureVisibility=el.style.visibility;el.style.visibility='hidden';}});
   await page.screenshot({path:`${dir}/${id}-${view.toLowerCase()}-clear.png`});
   await page.evaluate(()=>{for(const el of document.querySelectorAll('[data-capture-visibility]')){el.style.visibility=el.dataset.captureVisibility;delete el.dataset.captureVisibility;}});
   console.log(`Captured ${id} ${view}: ${s.meshes} meshes`);
  }
 }
 // Exercise the real manual editor and client validator. These actions call no endpoints.
 if(!controlsOnly)await page.goto('http://localhost:3000/dev/villa-playground?composition=estate-splay',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForTimeout(5000);
 await page.getByRole('button',{name:'Customize this villa',exact:true}).click();
 await page.getByText('west-salon · detached',{exact:true}).click();
 assert.equal(await page.getByLabel('west-salon orientation',{exact:true}).inputValue(),'330');
 await page.screenshot({path:`${dir}/rotated-wing-controls.png`});
 await page.getByRole('button',{name:'Apply composition changes',exact:true}).evaluate(n=>n.click());await page.waitForTimeout(1800);
 assert.deepEqual((await inspect()).wings.map(w=>w.rotation),[0,330*Math.PI/180,30*Math.PI/180]);
 controls.push({id:'manual-apply-preserves-rotations',passed:true});
 await page.goto('http://localhost:3000/dev/villa-playground?composition=estate-palmhaven',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForTimeout(5000);
 await page.getByRole('button',{name:'Arrival',exact:true}).click();await page.waitForTimeout(2200);
 await page.getByRole('button',{name:'Customize this villa',exact:true}).click();
 async function openDetails(text){const summary=page.locator('summary').filter({hasText:new RegExp('^'+text+'$')});if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();}
 async function apply(){await page.getByRole('button',{name:'Apply composition changes',exact:true}).evaluate(n=>n.click());await page.waitForTimeout(1600);}
 await openDetails('Arrival and garden circulation');await openDetails('Motor court');
 const preserved=await inspect();
 await page.getByLabel('Court islandWidth',{exact:true}).fill('20');await apply();
 await page.getByRole('alert').filter({hasText:'3.5 m'}).waitFor();
 await page.getByRole('alert').filter({hasText:'3.5 m'}).scrollIntoViewIfNeeded();
 assert.deepEqual((await inspect()).groups,preserved.groups);
 await page.screenshot({path:`${dir}/validation-court-lane.png`});controls.push({id:'invalid-lane-preserves-estate',passed:true});
 await page.getByLabel('Court islandWidth',{exact:true}).fill('6');
 await page.getByLabel('Court centre',{exact:true}).selectOption('none');await apply();
 assert((await inspect()).groups.some(g=>g==='Oval motor court · 22 × 18m · none'));
 await page.getByRole('button',{name:'Close customization',exact:true}).click();await page.screenshot({path:`${dir}/court-without-island.png`});controls.push({id:'optional-island-none',passed:true});
 await page.getByRole('button',{name:'Customize this villa',exact:true}).click();await openDetails('Arrival and garden circulation');await openDetails('Motor court');
 await page.getByLabel('Court centre',{exact:true}).selectOption('planted');await apply();
 assert((await inspect()).groups.some(g=>g==='Oval motor court · 22 × 18m · planted'));
 await page.getByRole('button',{name:'Close customization',exact:true}).click();await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/court-with-planted-island.png`});controls.push({id:'optional-island-planted',passed:true});
 await page.getByRole('button',{name:'Customize this villa',exact:true}).click();await openDetails('Arrival and garden circulation');await openDetails('Motor court');
 await page.getByLabel('Court centre',{exact:true}).selectOption('fountain');await apply();
 await openDetails('Arrival and garden circulation');await openDetails('palm-avenue · driveway');
 await page.getByLabel('palm-avenue route width',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/arrival-path-controls.png`});
 await openDetails('Site boundary');await page.getByLabel('Set fixed boundary',{exact:true}).check();
 for(const [field,value] of [['x','0'],['z','-5'],['width','70'],['depth','75']])await page.getByLabel(`Boundary ${field}`,{exact:true}).fill(value);
 await apply();await page.getByRole('alert').filter({hasText:'fixed site'}).waitFor();
 await page.getByRole('alert').filter({hasText:'fixed site'}).scrollIntoViewIfNeeded();
 const afterFixedReject=await inspect();assert(afterFixedReject.groups.some(g=>g==='Oval motor court · 22 × 18m · fountain'));
 await page.screenshot({path:`${dir}/validation-fixed-site.png`});controls.push({id:'fixed-site-rejection-preserves-estate',passed:true});
 for(const [field,value] of [['x','-2'],['z','-15'],['width','100'],['depth','110']])await page.getByLabel(`Boundary ${field}`,{exact:true}).fill(value);
 await apply();await page.getByText('100.0 × 110.0 m fixed site',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Close customization',exact:true}).click();await page.screenshot({path:`${dir}/fixed-site-accepted.png`});controls.push({id:'fixed-site-exact-boundary-accepted',passed:true});
 await page.getByRole('button',{name:'Solana original',exact:true}).click();await page.waitForTimeout(3000);
 const original=await inspect();assert(original.groups.includes('Villa Solana · fixed architectural composition'));assert(!original.groups.includes('Estate landscape · estate-landscape@1'));
 checks.push({id:'solana-preserved',...original});await page.screenshot({path:`${dir}/solana-preserved.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({provenance:'Actual Chromium WebGL screenshots; all /api/ai endpoints blocked; zero provider calls. Files ending -clear temporarily hide interface overlays in place; scene pixels are unedited.',errors,requests,controls,checks},null,2)+'\n');
} finally {await browser.close();}
