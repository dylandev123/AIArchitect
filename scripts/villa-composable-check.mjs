// All AI requests are intercepted. This checks the real R3F renderer and client executor, not a live model.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory='docs/villa-playground/terra-compositions';
mkdirSync(directory,{recursive:true});
const {configurations}=JSON.parse(readFileSync(`${directory}/deterministic-configurations.json`,'utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],requests=[],checks=[];
try {
  const page=await browser.newPage({viewport:{width:1500,height:1050}});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(String(e)));
  let output;
  await page.route('**/api/ai/**',async route=>{
    const request=route.request();console.log('Intercepted offline villa request');requests.push(JSON.parse(request.postData()));
    assert(request.url().endsWith('/api/ai/villa'),'Unexpected AI endpoint');
    assert(output,'Unplanned AI request');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...output,providerCalls:0,model:'offline-browser-fixture'})});
  });
  await page.goto(process.env.VILLA_URL ?? 'http://127.0.0.1:3107/dev/villa-playground',{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('canvas').waitFor();
  async function scene() {
    return page.locator('canvas').evaluate(c=>{
      let fiber=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
      while(fiber) {let hook=fiber.memoizedState;
        while(hook) {const state=hook.memoizedState?.current;
          if(state?.scene?.isScene) {const groups=[],wings=[],invalid=[];let meshes=0;
            state.scene.traverse(o=>{
              if(o.isGroup&&o.name) {groups.push(o.name);if(o.name.startsWith('Wing ')) wings.push({name:o.name,position:o.position.toArray(),rotation:o.rotation.y});}
              if(o.isMesh){meshes++;const positions=o.geometry?.attributes?.position?.array;if(positions && !positions.every(Number.isFinite)) invalid.push(o.name||'unnamed mesh');}
            });return {groups,wings,meshes,invalid};
          }hook=hook.next;
        }fiber=fiber.return;
      }return null;
    });
  }
  async function waitScene(id,count) {
    await page.waitForFunction(()=>document.querySelector('canvas'));
    for(let i=0;i<160;i++) {const s=await scene();if(s?.groups.includes(`Local composition · ${id}`)&&s.wings.length===count&&s.meshes>100){assert.deepEqual(s.invalid,[]);return s;}await page.waitForTimeout(500);}
    throw Error(`Scene missing: ${id}/${count}`);
  }
  async function submit(prompt,changes) {
    console.log(`Submitting fixture: ${prompt}`);
    output={changes,summary:'Deterministic fixture applied.',unsupported:[]};
    await page.getByLabel('Villa brief',{exact:true}).fill(prompt);
    for(let i=0;i<100 && await page.getByRole('button',{name:/Generate villa|Apply change/}).isDisabled();i++) await page.waitForTimeout(200);
    await Promise.all([
      page.waitForResponse(r=>r.url().endsWith('/api/ai/villa'),{timeout:15000}),
      page.getByRole('button',{name:/Generate villa|Apply change/}).click({force:true,timeout:10000}),
    ]);
    await page.waitForTimeout(1200);
  }
  for(let i=0;i<180;i++) {const s=await scene();if(s?.groups.includes('Villa Solana · fixed architectural composition') && s.meshes>100) break;await page.waitForTimeout(500);}
  assert((await scene())?.groups.includes('Villa Solana · fixed architectural composition'));
  const sentinel='composable-villa-storage-sentinel';
  await page.evaluate(v=>localStorage.setItem('ai-architect-projects',v),sentinel);
  for(const c of configurations) {
    await page.getByRole('button',{name:'New design',exact:true}).click();
    await submit(`Offline fixture ${c.id}`,c);
    const s=await waitScene(c.id,c.wings.length+c.connections.length);
    for(const w of c.wings) {const mounted=s.wings.find(o=>o.name.startsWith(`Wing ${w.id} ·`));assert(mounted);assert.deepEqual(mounted.position,[w.x,0,w.z]);assert(Math.abs(mounted.rotation-w.orientation*Math.PI/180)<1e-6);}
    for(const view of ['Poolside','Above']) {
      await page.getByRole('button',{name:view,exact:true}).click({force:true});await page.waitForTimeout(3500);
      await page.screenshot({path:`${directory}/${c.id}-${view.toLowerCase()}.jpg`,type:'jpeg',quality:90});
    }
    checks.push({id:c.id,buildingWings:c.wings.length,galleries:c.connections.length,mountedWings:s.wings,meshes:s.meshes,finiteGeometry:true});
  }
  const current=configurations[2];
  await page.getByRole('button',{name:'Customize this villa',exact:true}).click({force:true});
  const editor=page.getByRole('complementary',{name:'Composition customization'});
  await editor.getByText('main · main',{exact:true}).click();
  await page.getByLabel('main height',{exact:true}).fill('4.3');
  await page.getByLabel('Composition exterior',{exact:true}).selectOption('limestone');
  await page.getByRole('button',{name:'Apply composition changes',exact:true}).click();
  await page.getByRole('button',{name:'Close customization',exact:true}).click({force:true});
  await page.getByRole('button',{name:'Refine villa',exact:true}).click();
  const guest={...current.wings[3],id:'east-guest',x:18,z:14,width:7,depth:5,orientation:180};
  await submit('Add a detached guest pavilion',{wings:[{type:'add',wing:guest}]});
  await waitScene(current.id,current.wings.length+current.connections.length+1);
  assert.equal(requests.at(-1).current.appearance.exterior,'limestone');assert.equal(requests.at(-1).current.wings[0].storeyHeight,4.3);
  const court=current.terraces[0];
  await submit('Enlarge the courtyard',{wings:[{type:'adjust',id:'west',changes:{x:-11}},{type:'adjust',id:'east',changes:{x:12}}],terraces:[{type:'put',terrace:{...court,width:12}}]});
  const enlarged=await waitScene(current.id,7);
  assert.equal(enlarged.wings.find(w=>w.name.startsWith('Wing west ·')).position[0],-11);
  // Return an invalid 200 payload to prove the client also validates and keeps the accepted scene.
  await submit('Invalid overlapping wing',{wings:[{type:'adjust',id:'east-guest',changes:{x:0,z:-10}}]});
  await page.getByRole('alert').filter({hasText:/Overlapping/}).waitFor();
  assert.deepEqual((await scene()).wings,enlarged.wings);
  await page.screenshot({path:`${directory}/rejected-edit-preserves-composition.jpg`,type:'jpeg',quality:90});
  await submit('Remove the pool',{pool:null});
  assert(!(await scene()).groups.includes('Seventeen metre swimming pool with sun shelf'));
  const beforeRestore=requests.at(-1).current;
  assert.equal(beforeRestore.appearance.exterior,'limestone');assert.equal(beforeRestore.wings[0].storeyHeight,4.3);assert.equal(beforeRestore.terraces[0].width,12);assert.equal(beforeRestore.wings.find(w=>w.id==='east-guest').x,18);
  await submit('Restore the pool',{pool:current.pool});
  assert((await scene()).groups.includes('Seventeen metre swimming pool with sun shelf'));
  assert.equal(await page.evaluate(()=>localStorage.getItem('ai-architect-projects')),sentinel);
  assert.deepEqual(errors,[]);
  const result={provenance:'Deterministic responses intercepted in browser. Real local R3F WebGL meshes. No live AI.',checks,manualHeightAndMaterialPreserved:true,addGuest:true,enlargeCourtyard:true,invalidEditRollback:true,poolToggle:true,projectStorageUnchanged:true,browserFixtureRequests:requests.length,liveProviderCalls:0,errors};
  writeFileSync(`${directory}/browser-checks.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} catch(error) { console.log(JSON.stringify({errors,requests})); const pages=browser.contexts().flatMap(c=>c.pages()); if(pages[0]) {console.log(await pages[0].locator('body').innerText());await pages[0].screenshot({path:`${directory}/browser-failure.jpg`});} throw error; } finally {await browser.close();}
