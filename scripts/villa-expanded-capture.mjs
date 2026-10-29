// All AI requests are intercepted. This checks the real R3F renderer and client executor, not a live model.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory=process.env.ESTATE_EVIDENCE_DIR ?? 'docs/villa-playground/expanded-limits';
mkdirSync(directory,{recursive:true});
const configurations=JSON.parse(readFileSync('docs/villa-playground/expanded-limits/examples.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],requests=[],checks=process.env.VILLA_CAPTURE_IDS?JSON.parse(readFileSync(`${directory}/browser-checks.json`,'utf8')).checks.filter(c=>!process.env.VILLA_CAPTURE_IDS.split(',').includes(c.id)):[];
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
            });return {groups,wings,meshes,invalid,finalPostProcessDrawCalls:state.gl.info.render.calls,finalPostProcessTriangles:state.gl.info.render.triangles,camera:state.camera.position.toArray(),far:state.camera.far,target:state.controls?.target.toArray(),geometries:state.gl.info.memory.geometries,textures:state.gl.info.memory.textures};
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
      page.waitForResponse(r=>r.url().endsWith('/api/ai/villa'),{timeout:45000}),
      page.getByRole('button',{name:/Generate villa|Apply change/}).evaluate(n=>n.click()),
    ]);
    await page.waitForTimeout(1200);
  }
  for(let i=0;i<160;i++){if((await scene())?.meshes>100)break;await page.waitForTimeout(500);}
  assert((await scene())?.meshes>100,'Initial scene is hydrated');
  for(const c of configurations.filter(c=>!process.env.VILLA_CAPTURE_IDS || process.env.VILLA_CAPTURE_IDS.split(',').includes(c.id))) {
    await page.getByRole('button',{name:'New design',exact:true}).click();
    await submit('Offline estate response '+c.id,c);
    const rendered=await waitScene(c.id,c.wings.length+c.connections.length);
    if(c.estateLandscape)assert(rendered.groups.includes('Estate landscape · estate-landscape@1'));
    await page.waitForTimeout(4000);
    const timing=await page.evaluate(async()=>{const times=[];let prev=performance.now();for(let i=0;i<60;i++)await new Promise(resolve=>requestAnimationFrame(t=>{times.push(t-prev);prev=t;resolve();}));times.sort((a,b)=>a-b);return {medianFrameMs:times[30],p95FrameMs:times[57]};});
    const final=await scene();assert.deepEqual(final.invalid,[]);
    for(const view of ['Above','Poolside']) {await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1500);await page.screenshot({path:`${directory}/${c.id}-${view.toLowerCase()}.png`});const captureStyle=await page.addStyleTag({content:'header,nav,section,footer,[class*=terraDock],[class*=moods],[class*=hints],[class*=credit],[class*=customizeToggle],nextjs-portal{visibility:hidden!important}'});await page.screenshot({path:`${directory}/${c.id}-${view.toLowerCase()}-clear.png`});await captureStyle.evaluate(s=>s.remove());}
    checks.push({id:c.id,...final,finiteGeometry:true,...timing});console.log(c.id,final.meshes,timing);
    writeFileSync(`${directory}/browser-checks.json`,JSON.stringify({providerCalls:0,checks,errors},null,2)+'\n');
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${directory}/browser-checks.json`,JSON.stringify({providerCalls:0,checks,errors},null,2)+'\n');
} catch(error) {const p=browser.contexts().flatMap(c=>c.pages())[0];if(p){console.log(await p.locator('body').innerText());await p.screenshot({path:`${directory}/capture-failure.png`});}throw error;} finally {await browser.close();}
