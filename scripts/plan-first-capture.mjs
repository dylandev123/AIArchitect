// Isolated production workspace, actual V3 renderer, no provider/project network calls.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.STUDIO_URL??'http://127.0.0.1:3000',out='docs/architecture/architectural-blueprint-pipeline/plan-first';mkdirSync(out,{recursive:true});
const roots=['01-plan','03-finished'].map(name=>({name,json:readFileSync(`${out}/${name}.json`,'utf8')}));
const projects=roots.map((r,i)=>({id:`offline-planfirst-${i}`,name:`Plan-first proof · ${r.name}`,generationMode:'v3-scene',projectType:'villa',createdAt:Date.now()+i,updatedAt:Date.now(),houseConfigJson:r.json,versions:[{id:`initial-${i}`,summary:'Offline stage checkpoint',createdAt:Date.now(),houseConfigJson:r.json}],currentVersionIndex:0,architecturalView:{mode:'floor-plan',floor:null,buildingId:null,cutaway:false}}));
const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],forbidden=[],captures=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1800,height:1120}}),page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(/\/api\/(ai|projects)|openai|terra/i.test(u.pathname)||/openai|terra/i.test(u.hostname)){forbidden.push(u.origin+u.pathname);return route.abort();}
   if(u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({assets:[],catalog:[],queue:[],glbIds:[],admin:false})});
   return route.continue();
 });
 const saved=async id=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),id);
 const mode=async label=>{await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');};
 const capture=async name=>{await page.waitForTimeout(700);const path=`${out}/${name}.jpg`;await page.screenshot({path,quality:92});captures.push({name,path});};
 const mounted=()=>page.locator('canvas').evaluate(c=>{
   let fiber=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
   while(fiber){let hook=fiber.memoizedState;while(hook){const state=hook.memoizedState?.current;if(state?.scene?.isScene){const meshes=[];state.scene.traverse(o=>{if(o.isMesh&&o.visible&&o.userData?.id)meshes.push({id:o.userData.id,position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],vertices:Array.from(o.geometry.attributes.position.array)});});return {sceneId:state.scene.uuid,meshes};}hook=hook.next;}fiber=fiber.return;}return null;
 });
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(projects=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects},version:6})),projects);
 await page.goto(`${base}/workspace/${projects[0].id}`,{waitUntil:'networkidle',timeout:90000});
 await page.getByRole('button',{name:'2D Floor Plan',exact:true}).waitFor();await capture('estate-master-plan');
 await page.getByLabel('Plan floor',{exact:true}).selectOption('0');await page.getByLabel('Plan building',{exact:true}).selectOption('crescent-house');await capture('ground-floor');
 await page.getByLabel('Plan floor',{exact:true}).selectOption('1');await capture('upper-floor');
 // The initial PLAN project contains no explicit roof object, authored finishes or facade assemblies.
 const planned=await saved(projects[0].id);assert(!JSON.parse(planned.houseConfigJson).v3Scene.objects.some(o=>o.type==='roof-form'));
 await mode('3D Massing');await capture('massing');const massing=await mounted();assert(massing.meshes.length>20);
 assert.equal((await saved(projects[0].id)).houseConfigJson,planned.houseConfigJson);
 await page.goto(`${base}/workspace/${projects[1].id}`,{waitUntil:'networkidle',timeout:90000});
 const before=await saved(projects[1].id);
 await mode('3D Massing');await capture('finished-source-massing');
 await mode('3D Blueprint');await capture('exterior-blueprint');const blueprint=await mounted();
 await mode('Finished House');await capture('finished-exterior');const finished=await mounted();
 const common=blueprint.meshes.filter(a=>finished.meshes.some(b=>b.id===a.id));assert(common.length>30);
 for(const a of common){const b=finished.meshes.find(b=>b.id===a.id);assert.deepEqual(b.position,a.position);assert.deepEqual(b.rotation,a.rotation);assert.deepEqual(b.vertices,a.vertices);}
 const switched=await saved(projects[1].id);assert.equal(switched.houseConfigJson,before.houseConfigJson);assert.deepEqual(switched.versions,before.versions);
 // Actual 2D selection → footprint editor → replan → undo/redo → persisted reload.
 await mode('2D Floor Plan');await page.getByLabel('Plan floor',{exact:true}).selectOption('site');await page.getByLabel('Plan building',{exact:true}).selectOption('site');
 await page.getByRole('button',{name:'Orchard atelier',exact:true}).click();await page.getByRole('button',{name:/Advanced Properties/}).click();
 await page.getByText('Edit 2D footprint',{exact:true}).click();
 await page.getByLabel('2D footprint JSON',{exact:true}).fill(JSON.stringify({kind:'rectangle',width:13,depth:10},null,2));
 await page.getByRole('button',{name:'Apply footprint',exact:true}).click();
 const edited=await saved(projects[1].id),scene=JSON.parse(edited.houseConfigJson).v3Scene;
 assert.equal(scene.objects.find(o=>o.id==='orchard-atelier').architecture.width,13);assert.equal(scene.objects.find(o=>o.id==='atelier-roof').architecture.width,13);
 assert.equal(edited.versions.length,before.versions.length+1);await capture('edited-footprint-plan');
 await page.getByTitle('Undo',{exact:true}).click();assert.equal(JSON.parse((await saved(projects[1].id)).houseConfigJson).v3Scene.objects.find(o=>o.id==='orchard-atelier').architecture.width,12);
 await page.getByTitle('Redo',{exact:true}).click();assert.equal(JSON.parse((await saved(projects[1].id)).houseConfigJson).v3Scene.objects.find(o=>o.id==='atelier-roof').architecture.width,13);
 await mode('3D Massing');await capture('edited-footprint-massing');await mode('Finished House');await capture('edited-footprint-finished');
 await page.reload({waitUntil:'networkidle'});const loaded=await saved(projects[1].id);assert.equal(loaded.houseConfigJson,edited.houseConfigJson);assert.equal(loaded.architecturalView.mode,'finished');
 checks.push({initialPlanHasNoExplicitRoofs:true,productionMassingMeshes:massing.meshes.length,synchronizedBlueprintFinishedMeshes:common.length,viewSwitchPreservesExactScene:true,viewSwitchPreservesHistory:true,footprintEditUpdatesHostAndRoof:true,undoRedo:true,reloadPreservesExactDesignAndView:true});
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 writeFileSync(`${out}/capture.json`,JSON.stringify({productionWorkspace:true,isolatedBrowserStorage:true,providerCalls:0,errors,forbidden,captures,checks},null,2)+'\n');console.log(JSON.stringify({captures:captures.length,checks}));
}catch(e){writeFileSync(`${out}/capture-failure.json`,JSON.stringify({message:String(e),errors,forbidden,captures,checks},null,2));throw e;}finally{await browser.close();}
