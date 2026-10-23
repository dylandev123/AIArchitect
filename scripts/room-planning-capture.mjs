/** Isolated browser context; only local GETs. No provider or project API writes. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright-core');
const base=process.env.ROOM_STUDIO_URL??'http://127.0.0.1:3178';
const root='docs/architecture/architectural-blueprint-pipeline/phase-2b',out=`${root}/ui`;mkdirSync(out,{recursive:true});
const evidence=JSON.parse(readFileSync(`${root}/checks.json`,'utf8'));
const names=evidence.examples.flatMap(e=>[`${e.name}.saved`,`${e.name}.constructed`]).concat(['unresolved.saved','natural-original.saved','natural-proposal.saved']);
const projects=names.map((name,i)=>{
 const houseConfigJson=readFileSync(`${root}/${name}.json`,'utf8');
 return {id:`phase2b-${name}`,name:`Offline ${name}`,projectType:'house',generationMode:'v3-scene',v3TerrainMode:'flat',createdAt:i+1,updatedAt:i+1,houseConfigJson,versions:[{id:`initial-${i}`,createdAt:1,summary:'Isolated offline floor test',houseConfigJson}],currentVersionIndex:0};
});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],forbidden=[],captures=[],verified=[];
try{
 const context=await browser.newContext({viewport:{width:1800,height:1120}}),page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base||request.method()!=='GET'){forbidden.push(`${request.method()} ${url.origin}${url.pathname}`);return route.abort();}
  if(url.pathname==='/api/ai/plan')return route.fulfill({json:{enabled:false,model:'offline-only',maxOutputTokens:10000,pricing:null}});
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{assets:[],catalog:[],queue:[],glbIds:[],admin:false}});
  return route.continue();
 });
 const saved=id=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),id);
 const capture=async name=>{const path=`${out}/${name}.png`;await page.screenshot({path});captures.push(path);};
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(projects=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects},version:6})),projects);
 for(const example of evidence.examples){
  const id=`phase2b-${example.name}.saved`,project=projects.find(p=>p.id===id);
  await page.goto(`${base}/workspace/${id}`,{waitUntil:'networkidle',timeout:90000});
  await page.getByLabel('Plan floor',{exact:true}).selectOption('0');
  await page.getByLabel('Plan building',{exact:true}).selectOption(example.buildings[0].id);
  await page.locator('[data-testid="architectural-floor-plan"]').waitFor();await capture(`${example.name}-floor-0`);
  for(let level=1;level<example.buildings[0].storeys;level++){await page.getByLabel('Plan floor',{exact:true}).selectOption(String(level));await capture(`${example.name}-floor-${level}`);}
  await page.reload({waitUntil:'networkidle'});assert.equal((await saved(id)).houseConfigJson,project.houseConfigJson);assert.deepEqual((await saved(id)).versions,project.versions);
  const builtId=`phase2b-${example.name}.constructed`;
  await page.goto(`${base}/workspace/${builtId}`,{waitUntil:'networkidle',timeout:90000});
  await page.getByRole('button',{name:'Finished House',exact:true}).click();await page.locator('canvas').waitFor();
  const webgl=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION)}:null;});assert(webgl?.width>0);
  await capture(`${example.name}-constructed`);assert.equal((await saved(builtId)).houseConfigJson,projects.find(p=>p.id===builtId).houseConfigJson);
  verified.push({name:example.name,reloadLossless:true,versionsUnchanged:true,webgl});
 }
 // A developed room is an ordinary editable datum; changing it must survive a
 // real UI commit and reload rather than being replayed from a hidden recipe.
 const editId='phase2b-garden-home.saved';
 await page.goto(`${base}/workspace/${editId}`,{waitUntil:'networkidle'});
 await page.getByLabel('Plan floor',{exact:true}).selectOption('0');
 await page.getByRole('button',{name:'garden living',exact:true}).click();
 const roomAdvanced=page.getByRole('button',{name:/Advanced Properties/});if(await roomAdvanced.count())await roomAdvanced.click();
 await page.getByLabel('Room width',{exact:true}).fill('7.6');
 await page.waitForFunction(id=>JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id).houseConfigJson).v3Scene.interior.rooms.find(r=>r.id==='garden-living').footprint.width===7.6,editId);
 const edited=await saved(editId);await capture('garden-home-edited');await page.reload({waitUntil:'networkidle'});assert.equal((await saved(editId)).houseConfigJson,edited.houseConfigJson);
 const draftId='phase2b-unresolved.saved';
 await page.goto(`${base}/workspace/${draftId}`,{waitUntil:'networkidle'});
 await page.getByLabel('Plan floor',{exact:true}).selectOption('0');
 await page.getByRole('button',{name:'Garden home',exact:true}).click();
 const advanced=page.getByRole('button',{name:/Advanced Properties/});if(await advanced.count())await advanced.click();
 await page.getByRole('button',{name:/Garden floor ·/}).click();
 const storeyAdvanced=page.getByRole('button',{name:/Advanced Properties/});if(await storeyAdvanced.count())await storeyAdvanced.click();
 const textarea=page.getByLabel('Draft room organization',{exact:true});await textarea.waitFor();
 const intent=JSON.parse(await textarea.inputValue());delete intent.spaces[0].size;await textarea.fill(JSON.stringify(intent,null,2));
 await page.getByRole('button',{name:'Develop room boundaries',exact:true}).click();
 await page.waitForFunction(id=>JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id).houseConfigJson).v3Scene.interior.rooms.length===7,draftId);
 const fixed=await saved(draftId);assert.deepEqual(JSON.parse(fixed.houseConfigJson).v3Scene.metadata.roomLayoutDrafts,[]);
 await capture('draft-resolved-in-editor');await page.reload({waitUntil:'networkidle'});assert.equal((await saved(draftId)).houseConfigJson,fixed.houseConfigJson);
 // Opening and reloading the paid fixture never changes its captured geometry.
 for(const suffix of ['natural-original.saved','natural-proposal.saved']){
  const id=`phase2b-${suffix}`;await page.goto(`${base}/workspace/${id}`,{waitUntil:'networkidle'});
  await page.getByLabel('Plan floor',{exact:true}).selectOption('0');await page.getByLabel('Plan building',{exact:true}).selectOption('main-villa');await capture(suffix);
  await page.reload({waitUntil:'networkidle'});assert.equal((await saved(id)).houseConfigJson,projects.find(p=>p.id===id).houseConfigJson);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 writeFileSync(`${out}/checks.json`,JSON.stringify({result:'PASS',providerCalls:0,existingProjectsAccessed:false,errors,forbidden,verified,roomEditReload:true,draftIntentEditorRefinement:true,naturalOriginalUnchanged:true,captures},null,2)+'\n');
 console.log(JSON.stringify({result:'PASS',examples:verified.length,screenshots:captures.length,roomEditReload:true,draftIntentEditorRefinement:true,providerCalls:0}));
}catch(error){writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(error),errors,forbidden,captures},null,2));throw error;}finally{await browser.close();}
