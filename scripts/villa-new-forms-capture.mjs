import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/new-forms';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
process.on('SIGINT',async()=>{await browser.close();process.exit(130);});
const errors=[],requests=[],checks=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
  // Hard block all model endpoints, including accidental form submission.
  await page.route('**/api/ai/**',r=>{requests.push(r.request().url());return r.abort();});
  async function scene(action,pavilion=false) {
    return page.locator('canvas').evaluate((canvas,{action,pavilion})=>{
      let f=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
      while(f){let h=f.memoizedState;while(h){const ref=h.memoizedState?.current;const state=ref?.get ? ref.get() : ref;if(state?.scene?.isScene){
        const groups=[],meshes=[],forms=[];state.scene.updateMatrixWorld(true);
        state.scene.traverse(o=>{if(o.isGroup&&o.name)groups.push(o.name);if(o.isMesh)meshes.push(o);if(o.name.startsWith('Experimental curved-pavilion@1'))forms.push(o);});
        if(action==='detail' && forms[0]) {
          const p=forms[0],x=p.position.x,z=p.position.z,a=p.rotation.y;
          state.camera.position.set(x+Math.sin(a)*10+Math.cos(a)*3,4.8,z+Math.cos(a)*10-Math.sin(a)*3);
          state.controls?.target.set(x,2,z);state.controls?.update();state.camera.lookAt(x,2,z);state.invalidate();
        }
        const form= forms[0];
        const envelope=[];
        if(form) form.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);envelope.push({name:o.name,min:b.min.toArray(),max:b.max.toArray(),vertices:o.geometry.attributes.position.count});}});
        return {meshes:meshes.length,groups,form:{position:form?.position.toArray(),rotation:form?.rotation.y,envelope},camera:state.camera.position.toArray(),ready:meshes.length>100&&(!pavilion||forms.length===1)};
      }h=h.next;}f=f.return;}return null;
    },{action,pavilion});
  }
  for(const id of ['curve-horizon','curve-breeze']) {
    console.log(`Rendering ${id}`);
    if(id==='curve-horizon') await page.goto(`${process.env.VILLA_URL ?? 'http://localhost:3000/dev/villa-playground'}?composition=${id}`,{waitUntil:'domcontentloaded',timeout:120000});
    else await page.getByRole('button',{name:'Curve / Island',exact:true}).click();
    await page.locator('canvas').waitFor();
    await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);
    let data;for(let i=0;i<180;i++){data=await scene('inspect',true);if(data?.ready && data.groups.includes(`Local composition · ${id}`))break;await page.waitForTimeout(500);}
    assert(data?.ready,JSON.stringify({id,errors,data}));
    await page.waitForTimeout(6000);
    for(const view of ['Poolside','Above']) {
      console.log(`Capturing ${id} / ${view}`);
      await page.getByRole('button',{name:view,exact:true}).click({force:true});await page.waitForTimeout(2200);
      await page.screenshot({path:`${dir}/${id}-${view.toLowerCase()}.png`});
      checks.push({id,view,...await scene('inspect',true)});
    }
    console.log(`Capturing ${id} / detail`);
    await scene('detail',true);await page.waitForTimeout(3000);
    await page.screenshot({path:`${dir}/${id}-detail.png`});checks.push({id,view:'detail',...await scene('inspect',true)});
  }
  console.log('Checking preserved designs');
  await page.getByRole('button',{name:'Solana original',exact:true}).click();await page.waitForTimeout(5000);
  const solana=await scene('inspect');assert(!solana.groups.some(g=>g.startsWith('Experimental curved-pavilion')));assert(solana.meshes>100);
  await page.screenshot({path:`${dir}/solana-preserved.png`});checks.push({id:'solana',...solana});
  for(const style of ['Modern Contemporary','Caribbean Tropical','Spanish Hacienda','Tuscan Estate']) {
    await page.getByRole('button',{name:style,exact:true}).click();await page.waitForTimeout(1200);
    const data=await scene('inspect');assert(data.meshes>100);assert(!data.groups.some(g=>g.startsWith('Experimental curved-pavilion')));checks.push({style,meshes:data.meshes});
  }
  for(const [id,label] of [['compact-l','Compact L'],['courtyard-u','Courtyard U'],['pavilion-estate','Pavilion estate']]) {
    await page.getByRole('button',{name:label,exact:true}).click();
    let data;for(let i=0;i<180;i++){data=await scene('inspect');if(data?.groups.includes(`Local composition · ${id}`))break;await page.waitForTimeout(500);}
    assert(data.groups.includes(`Local composition · ${id}`));assert(!data.groups.some(g=>g.startsWith('Experimental curved-pavilion')));checks.push({id,meshes:data.meshes});
  }
  // Replay one retained response through the real client handler, intercepting the route.
  // This exercises integration without calling Terra or an external mesh service.
  const replay=JSON.parse(readFileSync(`${dir}/boundary-replay.json`,'utf8'));
  let offlineReplayRequests=0;
  await page.route('**/api/ai/villa',route=>{offlineReplayRequests++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(replay)});});
  await page.getByRole('textbox',{name:'Villa brief'}).fill('Offline replay of the retained fictional Caribbean Crown Estate');
  await page.getByRole('button',{name:'Generate villa ↗',exact:true}).click();
  await page.getByRole('heading',{name:'Caribbean Crown Estate',exact:false}).waitFor();
  await page.getByRole('button',{name:'Garden',exact:true}).click();await page.waitForTimeout(3500);
  let recovered;for(let i=0;i<180;i++){recovered=await scene('inspect');if(recovered?.groups.includes('Local composition · saint-lucia-caribbean-crown'))break;await page.waitForTimeout(500);}
  assert(recovered.groups.includes('Local composition · saint-lucia-caribbean-crown'));assert(recovered.groups.filter(g=>g.startsWith('Wing ')).length===6);
  await page.screenshot({path:`${dir}/boundary-recovered.png`});checks.push({id:'boundary-replay',offlineReplayRequests,...recovered});
  assert.equal(offlineReplayRequests,1);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({provenance:'Actual local browser WebGL screenshots; model endpoints blocked; no synthetic or image-generated geometry',errors,aiRequests:requests,checks},null,2)+'\n');
  console.log(JSON.stringify({errors,aiRequests:requests,checks:checks.map(({id,style,view,meshes,form})=>({id,style,view,meshes,position:form?.position}))}));
} finally {await browser.close();}
