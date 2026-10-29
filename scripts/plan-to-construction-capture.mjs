import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/plan-to-construction',original=JSON.parse(readFileSync('docs/villa-playground/25m-mansion-recovery/corrected.scene.json')),corrected=JSON.parse(readFileSync(`${dir}/corrected.scene.json`));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[];let aiRequests=0;
try{
 const context=await browser.newContext({viewport:{width:1600,height:1050},storageState:{cookies:[],origins:[]}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')){aiRequests++;return r.abort();}if(!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.origin);return r.abort();}return r.continue();});
 await page.goto('http://localhost:3000/dev/villa-playground?scene=ladera',{waitUntil:'networkidle',timeout:120000});
 const load=async scene=>{await page.getByLabel('Import scene JSON').setInputFiles({name:'scene.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scene))});await page.waitForTimeout(2000);};

 for(const [label,scene] of [['before',original],['after',corrected]]){
 await load(scene);
 for(const view of ['Arrival','Garden','Poolside','Aerial']){
 await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1200);
 await page.screenshot({path:`${dir}/${label}-${view.toLowerCase()}.png`});
 }
 }
 await load(corrected);
 const rendered=await page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const ids=[],invalid=[];let meshes=0;s.scene.traverse(o=>{if(o.name.startsWith('operation:'))ids.push(o.name.slice(10));if(o.isMesh){meshes++;if(o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);}});return {ids,meshes,invalid};}h=h.next;}f=f.return;}return null;});
 assert.deepEqual(rendered.ids.sort(),corrected.elements.map(e=>e.id).sort());assert.deepEqual(rendered.invalid,[]);
 for(const [view,name] of [['Arrival','front'],['Garden','rear'],['Poolside','poolside'],['Aerial','aerial']]){await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1600);if(name==='poolside') {await page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){s.camera.position.set(28,8,-32);s.controls?.target.set(0,2,-4);s.controls?.update();return;}h=h.next;}f=f.return;}});await page.waitForTimeout(200);}await page.screenshot({path:`${dir}/${name}.png`});}
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.deepEqual(await saved(),corrected);
 await page.getByLabel('Element',{exact:true}).selectOption('main-entrance');

 await page.getByLabel('Position x',{exact:true}).fill('0.5');
 const after=await saved();assert.equal(after.elements.find(e=>e.id==='main-entrance').at[0],.5);assert.deepEqual(after.elements.filter(e=>e.id!=='main-entrance'),corrected.elements.filter(e=>e.id!=='main-entrance'));
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await saved(),corrected);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await saved(),corrected);

 const projectId='offline-plan-to-construction',json=JSON.stringify(corrected);
 // Fresh nonpersistent context; append and verify rather than replace project records.
 await page.evaluate(({projectId,json,name})=>{const key='ai-architect-projects';const raw=JSON.parse(localStorage.getItem(key)||'{"state":{"projects":[]},"version":0}');if(raw.state.projects.some(p=>p.id===projectId))throw Error('Test ID already exists');const before=JSON.stringify(raw.state.projects);const now=Date.now();raw.state.projects.push({id:projectId,name,createdAt:now,updatedAt:now,projectType:'house',generationMode:'direct-scene',houseConfigJson:json,versions:[{id:'offline-recovery-version',createdAt:now,summary:'Offline railing elevation recovery',houseConfigJson:json}],currentVersionIndex:0});localStorage.setItem(key,JSON.stringify(raw));if(JSON.stringify(JSON.parse(localStorage.getItem(key)).state.projects.filter(p=>p.id!==projectId))!==before)throw Error('Existing projects changed');},{projectId,json,name:corrected.name});
 await page.goto(`http://localhost:3000/workspace/${projectId}`,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:corrected.name}).waitFor();
 const project=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),projectId);
 assert.deepEqual(JSON.parse((await project()).houseConfigJson),corrected);
 await page.getByLabel('Element',{exact:true}).selectOption('main-entrance');
 await page.getByLabel('Position x',{exact:true}).fill('0.5');
 assert.equal(JSON.parse((await project()).houseConfigJson).elements.find(e=>e.id==='main-entrance').at[0],.5);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(JSON.parse((await project()).houseConfigJson),corrected);
 await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(JSON.parse((await project()).houseConfigJson).elements.find(e=>e.id==='main-entrance').at[0],.5);
 await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:corrected.name}).waitFor();
 assert.equal(JSON.parse((await project()).houseConfigJson).elements.find(e=>e.id==='main-entrance').at[0],.5);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(JSON.parse((await project()).houseConfigJson),corrected);
 await page.getByRole('button',{name:'Arrival',exact:true}).click();await page.waitForTimeout(1200);await page.screenshot({path:`${dir}/workspace-entrance.png`});
 assert.deepEqual(errors,[]);assert.equal(aiRequests,0);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,aiRequests,errors,blocked,rendered,checks:['65-element coordinated scene replay','four corrected views','targeted edit preserves unrelated elements','undo restores corrected scene','reload persists corrected scene','normal workspace edit, undo, redo, reload and undo after reload']},null,2));
}finally{await browser.close();}
