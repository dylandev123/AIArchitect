import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/terra-intelligence';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],checks=[];
try{
 let page;
 async function makePage(){
  const next=await browser.newPage({viewport:{width:1500,height:1000}});next.setDefaultTimeout(90000);
  next.on('pageerror',e=>errors.push(String(e)));
  await next.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
  return next;
 }
 for(const id of ['reference-window','angular-volumes','branching-levels'])for(const phase of ['before','after']){
  if(page)await page.close();page=await makePage();
  await page.goto(`http://localhost:3000/dev/villa-playground?offline=${id}-${phase}`,{waitUntil:'networkidle',timeout:120000});
  await page.locator('canvas').first().waitFor();await page.waitForTimeout(3000);
  for(const view of ['Arrival','Poolside','Aerial']){
   await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1800);
   let ready=false;
   for(let attempt=0;attempt<120&&!ready;attempt++){
    ready=await page.locator('canvas').first().evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene)return !!s.scene.getObjectByName('Property architecture');h=h.next;}f=f.return;}return false;});
    if(!ready)await page.waitForTimeout(500);
   }
   if(!ready)await page.screenshot({path:`${dir}/render-failure-${id}-${phase}.png`});
   assert(ready,JSON.stringify({id,phase,view,errors}));
   if(phase==='after'){
    const pose=checks.find(c=>c.id===id&&c.phase==='before'&&c.view===view).camera;
    await page.locator('canvas').first().evaluate((c,pose)=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.camera.position.fromArray(pose.position);s.controls.target.fromArray(pose.target);s.controls.update();s.invalidate();return;}h=h.next;}f=f.return;}},pose);
    await page.waitForTimeout(500);
   }
   const result=await page.locator('canvas').first().evaluate(c=>{
    let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){let meshes=0,finite=true,precise=[];s.scene.traverse(o=>{if(o.name.startsWith('Precise window')||o.name.startsWith('Precise door'))precise.push(o.name);if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);}});return {meshes,finite,precise,camera:{position:s.camera.position.toArray(),target:s.controls.target.toArray()}};}h=h.next;}f=f.return;}return null;
   });
   assert(result?.finite&&result.meshes>100);if(phase==='after')assert(result.precise.length>0);
   if(phase==='after'){const baseline=checks.find(c=>c.id===id&&c.phase==='before'&&c.view===view);assert([...result.camera.position,...result.camera.target].every((v,i)=>Math.abs(v-[...baseline.camera.position,...baseline.camera.target][i])<1e-5));}
   await page.screenshot({path:`${dir}/${id}-${phase}-${view.toLowerCase()}.png`});checks.push({id,phase,view,...result});
  }
  console.log('Captured',id,phase);
 }
 // Exercise existing paid-review workflow with deterministic mock only.
 await page.goto('http://localhost:3000/dev/villa-playground?offline=reference-window-after',{waitUntil:'networkidle'});
 await page.getByText('Development Tools',{exact:true}).click();
 await page.getByText('Visual review experiment',{exact:true}).click();
 await page.getByRole('button',{name:'Evaluate deterministic mock',exact:true}).click();
 await page.getByRole('button',{name:'Accept visually reviewed improvement',exact:true}).waitFor({timeout:120000});
 assert(await page.getByRole('button',{name:'Accept visually reviewed improvement',exact:true}).isDisabled());
 await page.getByLabel('Visual comparison findings').fill('Rejected offline mock: changing wall tone does not correct the roof orientation or patio relationship to the visible reference.');
 await page.getByRole('button',{name:'Save rejection and keep original',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Reviewed lesson saved:'}).waitFor();
 await page.screenshot({path:`${dir}/reviewed-rejection.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({errors,blocked,providerCalls:0,checks,learning:'Mock rejection saved through UI; original retained. No successful lesson claimed.'},null,2));
}finally{await browser.close();}
