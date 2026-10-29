// All AI requests are intercepted. This checks the real R3F renderer and client executor, not a live model.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory=process.env.ESTATE_EVIDENCE_DIR ?? 'docs/villa-playground/terra-estate-integration';
mkdirSync(directory,{recursive:true});
const configurations=JSON.parse(readFileSync('docs/villa-playground/estate-creativity/examples.json','utf8'));
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
  await page.goto(process.env.VILLA_URL ?? 'http://127.0.0.1:3000/dev/villa-playground',{waitUntil:'domcontentloaded',timeout:120000});
  await page.locator('canvas').waitFor();
  async function scene() {
    return page.locator('canvas').evaluate(c=>{
      let fiber=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
      while(fiber) {let hook=fiber.memoizedState;
        while(hook) {const ref=hook.memoizedState?.current; const state=ref?.get?ref.get():ref;
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
      page.getByRole('button',{name:/Generate villa|Apply change/}).evaluate(n=>n.click()),
    ]);
    await page.waitForTimeout(1200);
  }
  for(let i=0;i<160;i++){if((await scene())?.meshes>100)break;await page.waitForTimeout(500);}
  assert((await scene())?.meshes>100,'Initial scene is hydrated');
  for(const c of configurations) {
    await page.getByRole('button',{name:'New design',exact:true}).click();
    await submit('Offline estate response '+c.id,c);
    const rendered=await waitScene(c.id,c.wings.length+c.connections.length);
    assert(rendered.groups.includes('Estate landscape · estate-landscape@1'));
    checks.push({id:c.id,meshes:rendered.meshes,finiteGeometry:true});
  }
  await page.getByRole('button',{name:'New design',exact:true}).click();
  await submit('Offline arrival estate',configurations[0]);
  await waitScene(configurations[0].id,4);
  await page.getByRole('button',{name:'Refine villa',exact:true}).click();
  await submit('Move the fountain closer to the main entrance',{estateLandscapeChanges:{court:{z:-24}}});
  await submit('Keep the property unchanged',{});
  const edited=requests.at(-1).current;
  assert.equal(edited.estateLandscape.court.z,-24);
  assert.deepEqual(edited.estateLandscape.routes,configurations[0].estateLandscape.routes);
  assert.deepEqual(edited.wings,configurations[0].wings);
  const preserved=await scene();
  await submit('Invalid fountain lane',{estateLandscapeChanges:{court:{islandDepth:12}}});
  await page.getByRole('alert').filter({hasText:'3.5 m'}).waitFor();
  assert.deepEqual((await scene()).groups,preserved.groups);
  await page.getByRole('button',{name:'New design',exact:true}).click();
  await submit('Invalid generation must preserve property',{...configurations[1],siteMode:'fixed',garden:{x:0,z:0,width:12,depth:12}});
  await page.getByRole('alert').filter({hasText:/outside/}).waitFor();
  assert.deepEqual((await scene()).groups,preserved.groups);
  await page.screenshot({path:`${directory}/offline-response-rollback.png`});
  assert.deepEqual(errors,[]);
  const result={providerCalls:0,interceptedRequests:requests.length,checks,targetedCourtEdit:true,unrelatedFeaturesPreserved:true,editRollback:true,generationRollback:true,errors};
  writeFileSync(`${directory}/offline-responses.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} catch(error) { const p=browser.contexts().flatMap(c=>c.pages())[0];if(p){console.log(await p.locator('body').innerText());await p.screenshot({path:`${directory}/offline-failure.png`});}throw error;} finally {await browser.close();}
