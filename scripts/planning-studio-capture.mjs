// Production workspace only. Isolated browser storage seeded with offline constructed V3 fixtures.
// No AI route/replay/provider calls. Usage: PLAYWRIGHT_MODULE=... CHROMIUM_EXECUTABLE=... node scripts/planning-studio-capture.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.STUDIO_URL??'http://127.0.0.1:3148';
const fixtureDir=process.env.STUDIO_FIXTURES??'/tmp/architectural-planning-studio';
const out='docs/architecture/architectural-blueprint-pipeline/planning-studio';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync(`${fixtureDir}/manifest.json`,'utf8'));
const projects=manifest.fixtures.map((f,i)=>{const json=readFileSync(f.path,'utf8');return {id:`offline-studio-${f.id}`,name:`${f.id==='improved'?'Hand-authored Lantern Garden':`Recovered Terra estate ${f.id}`} · offline studio`,projectType:'villa',generationMode:'v3-scene',v3TerrainMode:'flat',createdAt:Date.now()+i,updatedAt:Date.now(),houseConfigJson:json,versions:[{id:`initial-${i}`,createdAt:Date.now(),summary:'Offline original',houseConfigJson:json}],currentVersionIndex:0};});
const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],forbiddenRequests=[],captures=[],checks=[];
try {
 const context=await browser.newContext({viewport:{width:1800,height:1120}}),page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(/\/api\/(ai|projects)|openai|terra/i.test(u.pathname)||/openai|terra/i.test(u.hostname)){forbiddenRequests.push(u.origin+u.pathname);return route.abort();}
   if(u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({assets:[],catalog:[],queue:[],glbIds:[],admin:false})});
   return route.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(projects=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects},version:6})),projects);
 const mounted=()=>page.locator('canvas').evaluate(c=>{
   let fiber=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
   while(fiber){let hook=fiber.memoizedState;while(hook){const state=hook.memoizedState?.current;if(state?.scene?.isScene){const meshes=[];state.scene.traverse(o=>{if(o.isMesh&&o.visible&&o.userData?.id)meshes.push({id:o.userData.id,uuid:o.uuid,clippingPlaneCount:o.material?.clippingPlanes?.length??0,edgeClipCounts:o.children.filter(c=>c.isLineSegments2).map(c=>c.material?.clippingPlanes?.length??0),position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],vertices:Array.from(o.geometry.attributes.position.array)});});return {sceneId:state.scene.uuid,meshes};}hook=hook.next;}fiber=fiber.return;}return null;
 });
 const saved=async id=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),id);
 const capture=async name=>{
   await page.waitForTimeout(750);
   const path=`${out}/${name}.jpg`;await page.screenshot({path,quality:92});captures.push({name,path});
 };
 for(const project of projects) {
   const fixture=manifest.fixtures.find(f=>project.id.endsWith(f.id)),scene=JSON.parse(project.houseConfigJson).v3Scene;
   const main=scene.objects.find(o=>o.type==='building-mass');
   await page.goto(`${base}/workspace/${project.id}`,{waitUntil:'networkidle',timeout:90000});
   await page.getByRole('button',{name:'2D Floor Plan',exact:true}).waitFor();
   const before=await saved(project.id);
   const timings=[];
   const mode=async label=>{const start=performance.now();await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed').then(v=>assert.equal(v,'true'));timings.push({label,elapsedMs:performance.now()-start});};
   await mode('2D Floor Plan');
   await page.getByLabel('Plan floor',{exact:true}).selectOption('site');await capture(`${fixture.id}-master-plan`);
   await page.getByLabel('Plan floor',{exact:true}).selectOption('0');await page.getByLabel('Plan building',{exact:true}).selectOption(main.id);
   await page.locator('[data-testid="architectural-floor-plan"] svg').waitFor();await capture(`${fixture.id}-ground-floor`);
   await page.getByLabel('Plan floor',{exact:true}).selectOption('1');await capture(`${fixture.id}-upper-floor`);
   await mode('3D Blueprint');
   await page.getByLabel('Plan floor',{exact:true}).selectOption('0');
   await page.waitForTimeout(1000);
   const gl=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});assert(gl,'Production WebGL unavailable');
   await capture(`${fixture.id}-blueprint`);
   const cutawayMounted=await mounted();
   assert(cutawayMounted.meshes.some(m=>m.clippingPlaneCount===1));
   for(const m of cutawayMounted.meshes)for(const count of m.edgeClipCounts)assert.equal(count,m.clippingPlaneCount,'Edge linework ignored the solid cutaway');

   await page.getByLabel('Cutaway / hide roofs',{exact:true}).uncheck();await capture(`${fixture.id}-blueprint-roofs`);
   const blueprintMounted=await mounted();assert(blueprintMounted?.meshes.length>20,'Missing mounted production meshes');
   await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'3D Blueprint',exact:true}).getAttribute('aria-pressed'),'true');
   const reloadedBlueprint=await mounted();
   await mode('Finished House');await capture(`${fixture.id}-finished`);
   const finishedMounted=await mounted();assert.equal(finishedMounted.sceneId,reloadedBlueprint.sceneId,'View switch replaced the Three scene');
   const common=reloadedBlueprint.meshes.filter(a=>finishedMounted.meshes.some(b=>b.id===a.id));assert(common.length>20);
   for(const a of common){const b=finishedMounted.meshes.find(b=>b.id===a.id);assert.deepEqual(b.position,a.position);assert.deepEqual(b.rotation,a.rotation);assert.deepEqual(b.vertices,a.vertices);assert.equal(b.uuid,a.uuid,'Presentation switch remounted production mesh '+a.id);}

   const switched=await saved(project.id);assert.equal(switched.houseConfigJson,before.houseConfigJson);assert.deepEqual(switched.versions,before.versions);
   await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'Finished House',exact:true}).getAttribute('aria-pressed'),'true');
   await mode('2D Floor Plan');await page.getByLabel('Plan floor',{exact:true}).selectOption('1');await page.reload({waitUntil:'networkidle'});
   assert.equal(await page.getByRole('button',{name:'2D Floor Plan',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByLabel('Plan floor',{exact:true}).inputValue(),'1');
   checks.push({fixture:fixture.id,viewSwitchPreservesExactScene:true,viewSwitchPreservesVersions:true,reloadPreservesModeAndFloor:true,blueprintReload:true,sameThreeScene:true,identicalMountedGeometry:common.length,webgl:gl,timings});
 }
 // Exercise the real floor-plan selection, semantic inspector, version history and reload.
 const project=projects[2];await page.goto(`${base}/workspace/${project.id}`,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'2D Floor Plan',exact:true}).click();await page.getByLabel('Plan floor',{exact:true}).selectOption('0');await page.getByLabel('Plan building',{exact:true}).selectOption('orchard-atelier');
 await page.getByRole('button',{name:'Orchard studio',exact:true}).click();await page.getByRole('button',{name:/Advanced Properties/}).click();
 await page.getByRole('spinbutton',{name:'Room width',exact:true}).fill('9.8');
 const edited=await saved(project.id);assert.equal(JSON.parse(edited.houseConfigJson).v3Scene.interior.rooms.find(r=>r.id==='atelier-room').footprint.width,9.8);
 await capture('edited-room-plan');
 await page.getByTitle('Undo',{exact:true}).click();assert.equal(JSON.parse((await saved(project.id)).houseConfigJson).v3Scene.interior.rooms.find(r=>r.id==='atelier-room').footprint.width,10);
 await page.getByTitle('Redo',{exact:true}).click();assert.equal(JSON.parse((await saved(project.id)).houseConfigJson).v3Scene.interior.rooms.find(r=>r.id==='atelier-room').footprint.width,9.8);
 await page.reload({waitUntil:'networkidle'});assert.equal(JSON.parse((await saved(project.id)).houseConfigJson).v3Scene.interior.rooms.find(r=>r.id==='atelier-room').footprint.width,9.8);
 // Reopen the level inspector through its building identity; the same supported replan updates roof/slabs.
 await page.getByRole('button',{name:'2D Floor Plan',exact:true}).click();await page.getByLabel('Plan building',{exact:true}).selectOption('crescent-house');
 await page.getByRole('button',{name:'Garden salon and dining',exact:true}).click();await page.getByRole('button',{name:/Advanced Properties/}).click();
 await page.getByRole('button',{name:'Inspect this storey',exact:true}).click();await page.getByRole('button',{name:/Advanced Properties/}).click();
 await page.getByRole('spinbutton',{name:'Storey height',exact:true}).fill('4.3');
 assert.equal(JSON.parse((await saved(project.id)).houseConfigJson).v3Scene.objects.find(o=>o.id==='crescent-house').architecture.height,8.3);
 await page.getByRole('button',{name:'3D Blueprint',exact:true}).click();await capture('edited-storey-blueprint');
 await page.getByRole('button',{name:'Finished House',exact:true}).click();await capture('edited-storey-finished');
 await page.reload({waitUntil:'networkidle'});assert.equal(JSON.parse((await saved(project.id)).houseConfigJson).v3Scene.objects.find(o=>o.id==='crescent-house').architecture.height,8.3);
 // Move a building through the existing inspector's coordinated placement path.
 await page.getByRole('button',{name:'2D Floor Plan',exact:true}).click();await page.getByLabel('Plan floor',{exact:true}).selectOption('site');await page.getByLabel('Plan building',{exact:true}).selectOption('site');
 await page.getByRole('button',{name:'Orchard atelier',exact:true}).click();await page.getByRole('button',{name:/Advanced Properties/}).click();
 await page.getByRole('spinbutton',{name:'X',exact:true}).fill('-38');
 const movedScene=JSON.parse((await saved(project.id)).houseConfigJson).v3Scene;assert.equal(movedScene.objects.find(o=>o.id==='orchard-atelier').architecture.x,-38);assert.equal(movedScene.objects.find(o=>o.id==='atelier-roof').architecture.x,-38);
 await capture('edited-building-plan');await page.getByRole('button',{name:'3D Blueprint',exact:true}).click();await capture('edited-building-blueprint');await page.getByRole('button',{name:'Finished House',exact:true}).click();await capture('edited-building-finished');
 checks.push({buildingMoveAndDerivedRoof:true,floorPlanRoomSelection:true,numericRoomEdit:true,undoRedo:true,persistentReload:true,storeyReplan:true});
 const report={production:true,isolatedBrowserStorage:true,providerCalls:0,forbiddenRequests,errors,captures,checks,fixtures:manifest.fixtures};
 writeFileSync(`${out}/capture.json`,JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);assert.deepEqual(forbiddenRequests,[]);
 console.log(JSON.stringify({captures:captures.length,checks,errors,forbiddenRequests}));
} catch(e) {writeFileSync(`${out}/capture-failure.json`,JSON.stringify({message:String(e),errors,forbiddenRequests,captures,checks},null,2));throw e;} finally {await browser.close();}
