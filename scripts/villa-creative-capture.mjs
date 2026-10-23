import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory='docs/villa-playground/creative-freedom';mkdirSync(directory,{recursive:true});
const responses=JSON.parse(readFileSync(`${directory}/offline-responses.json`,'utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],checks=[],replays=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/api/ai/**',route=>{blocked.push(route.request().url());return route.abort();});
  let pending;
  await page.route('**/api/ai/villa',route=>{
    assert(pending,'Unexpected provider request');
    replays.push(route.request().postDataJSON());
    return route.fulfill({status:pending.status ?? 200,contentType:'application/json',body:JSON.stringify(pending.body ?? pending)});
  });
  async function scene(action='inspect') {
    return page.locator('canvas').evaluate((canvas,action)=>{
      let f=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
      while(f){let h=f.memoizedState;while(h){const ref=h.memoizedState?.current;const state=ref?.get ? ref.get() : ref;if(state?.scene?.isScene){
        const groups=[],forms=[],invalid=[];let meshes=0,triangles=0;
        state.scene.updateMatrixWorld(true);
        state.scene.traverse(o=>{
          if(o.isGroup&&o.name)groups.push(o.name);
          if(o.name.includes('curved-pavilion@1'))forms.push(o);
          if(o.isMesh){meshes++;const p=o.geometry.attributes.position;triangles+=(o.geometry.index?.count ?? p?.count ?? 0)/3;if(p&&!Array.from(p.array).every(Number.isFinite))invalid.push(o.name);}
        });
        if(action==='detail' && forms[0]) {
          const p=forms[0],x=p.position.x,z=p.position.z,a=p.rotation.y;
          state.camera.position.set(x+Math.sin(a)*12+Math.cos(a)*3,5.2,z+Math.cos(a)*12-Math.sin(a)*3);
          state.controls?.target.set(x,2,z);state.controls?.update();state.camera.lookAt(x,2,z);state.invalidate();
        }
        return {meshes,triangles,groups,invalid,forms:forms.map(p=>({position:p.position.toArray(),yaw:p.rotation.y})),camera:state.camera.position.toArray(),ready:meshes>100};
      }h=h.next;}f=f.return;}return null;
    },action);
  }
  async function waitGroup(prefix) {
    for(let i=0;i<180;i++){const data=await scene();if(data?.ready&&data.groups.some(g=>g.startsWith(prefix)))return data;await page.waitForTimeout(500);}
    throw Error(`Scene group not ready: ${prefix}`);
  }
  async function ready(id) {
    for(let i=0;i<180;i++){const data=await scene();if(data?.ready&&data.groups.includes(`Local composition · ${id}`))return data;await page.waitForTimeout(500);}
    throw Error(`Scene not ready: ${id}`);
  }
  await page.goto(`${process.env.VILLA_URL ?? 'http://localhost:3000/dev/villa-playground'}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('canvas').waitFor();
  // Warm local vegetation files before recording mesh counts; the existing loader is async.
  await page.evaluate(async()=>{
    const manifest=await fetch('/models/vegetation/manifest.json').then(r=>r.json());
    await Promise.all(manifest.models.map(m=>fetch(`/models/vegetation/${m.file}`).then(r=>r.arrayBuffer())));
  });
  await page.waitForTimeout(6000);
  const solana=await waitGroup('Villa Solana · fixed architectural composition');assert(solana.ready);checks.push({id:'solana-original',...solana});
  for(const fixture of responses) {
    const c=fixture.changes;pending=fixture;
    console.log(`Offline generation: ${c.id}`);
    await page.getByRole('button',{name:'New design',exact:true}).click();
    await page.getByRole('textbox',{name:'Villa brief'}).fill(`Offline deterministic ${c.name}`);
    await page.getByRole('button',{name:'Generate villa ↗',exact:true}).click();
    await page.getByRole('heading',{name:c.name,exact:false}).waitFor();
    let data=await ready(c.id);
    assert.equal(data.groups.filter(g=>g.startsWith('Wing ')).length,c.wings.length+c.connections.length);
    assert.equal(data.forms.length,c.components?.length ?? 0);assert.deepEqual(data.invalid,[]);
    await page.getByRole('button',{name:'Dismiss Terra response'}).click();
    await page.waitForTimeout(2500);
    for(const view of ['Poolside','Arrival','Garden','Above']) {
      await page.getByRole('button',{name:view,exact:true}).click({force:true});await page.waitForTimeout(2400);
      await page.screenshot({path:`${directory}/${c.id}-${view.toLowerCase()}.png`});
      checks.push({id:c.id,view,...await scene()});console.log(`Captured ${c.id} / ${view}`);
    }
    if(c.components?.length){await scene('detail');await page.waitForTimeout(2500);await page.screenshot({path:`${directory}/${c.id}-pavilion.png`});checks.push({id:c.id,view:'pavilion-detail',...await scene()});}
  }
  // Exercise scoped component editing in the same real client handler.
  await page.getByRole('button',{name:'Caribbean estate',exact:true}).click();await ready('caribbean-grande');
  await page.getByRole('button',{name:'Refine villa',exact:true}).click();
  pending={changes:{components:[{type:'adjust',id:'elliptical-lounge',changes:{material:'ivory'}}]},summary:'Only the lounge shell finish changed.',unsupported:[]};
  await page.getByRole('textbox',{name:'Villa brief'}).fill('Change only the elliptical lounge to ivory');await page.getByRole('button',{name:'Apply change ↗',exact:true}).click();
  await page.getByText('Only the lounge shell finish changed.',{exact:true}).waitFor();
  const preserved=await scene();
  pending={status:422,body:{error:'Offline rejected geometry. Current estate preserved.',findings:[{path:'pool',message:'Pool furniture intersects the main residence.'}],providerCalls:0}};
  await page.getByRole('textbox',{name:'Villa brief'}).fill('Offline invalid geometry test');await page.getByRole('button',{name:'Apply change ↗',exact:true}).click();
  await page.getByText('Offline rejected geometry.',{exact:false}).waitFor();
  const after=await scene();assert.deepEqual(after.groups,preserved.groups);assert.equal(after.meshes,preserved.meshes);
  const submitted=replays.at(-1).current,original=responses[1].changes;
  for(const key of ['wings','connections','terraces','appearance','pool'])assert.deepEqual(submitted[key],original[key]);
  assert.equal(submitted.components[0].material,'ivory');
  await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(2400);
  await page.screenshot({path:`${directory}/failed-edit-preserves-estate.png`});
  checks.push({id:'failed-edit-preserves-estate',...after});
  // Client-side validation must reject a falsely successful response too.
  pending={changes:{components:[{type:'adjust',id:'elliptical-lounge',changes:{x:0,z:-18}}]},summary:'Invalid placement',unsupported:[]};
  await page.getByRole('textbox',{name:'Villa brief'}).fill('Offline invalid successful response test');await page.getByRole('button',{name:'Apply change ↗',exact:true}).click();
  await page.getByText('clearance',{exact:false}).waitFor();assert.deepEqual((await scene()).groups,preserved.groups);
  for(const style of ['Modern Contemporary','Caribbean Tropical','Spanish Hacienda','Tuscan Estate']) {
    await page.getByRole('button',{name:style,exact:true}).click();await page.waitForTimeout(1400);
    const styleId=style.split(' ')[0].toLowerCase();
    const data=await waitGroup(`${styleId} / `);assert(data.ready);assert.equal(data.forms.length,0);checks.push({style,meshes:data.meshes});
  }
  await page.getByRole('button',{name:'Solana original',exact:true}).click();await page.waitForTimeout(2200);
  const restored=await waitGroup('Villa Solana · fixed architectural composition');assert.equal(restored.meshes,solana.meshes);await page.screenshot({path:`${directory}/solana-preserved.png`});
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
  assert.equal(replays.length,6);
  writeFileSync(`${directory}/browser-checks.json`,JSON.stringify({provenance:'Actual Chromium WebGL screenshots. All AI endpoints intercepted or blocked. Six local response replays; zero live provider calls.',errors,blocked,replayCount:replays.length,checks},null,2)+'\n');
  console.log(JSON.stringify({errors,blocked,replayCount:replays.length,checks:checks.map(({groups:_groups,...c})=>c)}));
} finally {await browser.close();}
