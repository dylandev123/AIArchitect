// Optimized production workspace; isolated storage and all nonlocal/API provider traffic blocked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const out='docs/architecture/architectural-blueprint-pipeline/design-restrictions',base=process.env.STUDIO_URL??'http://127.0.0.1:3133';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const detail=process.env.AUDIT_DETAIL==='1';
const prior=detail?JSON.parse(readFileSync(`${out}/capture.json`,'utf8')):null;
const captures=prior?.captures??[],checks=prior?.checks??[],errors=[],forbidden=[],assetsFailed=[];
const projects=['2026-10-20','2026-10-21'].flatMap(date=>['before','after'].map(phase=>{
 const json=readFileSync(`${out}/${date}-${phase}.json`,'utf8');return {id:`audit-${date}-${phase}`,name:`${date} · ${phase==='before'?'Recovered original':'Separately authored alternative'}`,generationMode:'v3-scene',projectType:'villa',createdAt:1,updatedAt:1,timeOfDay:'midday',houseConfigJson:json,versions:[{id:'original',summary:'Immutable comparison checkpoint',createdAt:1,houseConfigJson:json}],currentVersionIndex:0,architecturalView:{mode:'floor-plan',floor:null,buildingId:null,cutaway:false}};
}));
try{
 const context=await browser.newContext({viewport:{width:1800,height:1120}}),page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)assetsFailed.push({url:r.url(),status:r.status()});});
 await page.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(!['127.0.0.1','localhost'].includes(u.hostname)||/^\/api\/(ai|projects)/.test(u.pathname)){forbidden.push(u.origin+u.pathname);return r.abort();}
  if(u.pathname.startsWith('/api/'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({assets:[],catalog:[],queue:[],glbIds:[],admin:false})});
  return r.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});
 await page.evaluate(projects=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects},version:6})),projects);
 const saved=id=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),id);
 const mode=async label=>{await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');};
 // Read the existing production renderer's mounted state; set identical camera/target
 // across before/after. No replacement renderer, temporary UI or design mutation.
 const state=async(action,payload)=>page.locator('canvas').evaluate((canvas,{action,payload})=>{
  let fiber=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
  while(fiber){let hook=fiber.memoizedState;while(hook){const candidate=hook.memoizedState?.current,s=candidate?.get?.()??candidate;if(s?.scene?.isScene){
   if(action==='camera'){s.controls.maxPolarAngle=Math.PI;s.controls.enableDamping=false;s.camera.position.set(...payload.position);s.controls.target.set(...payload.target);s.controls.update();s.camera.updateProjectionMatrix();s.invalidate();}
   const meshes=[];s.scene.traverse(o=>{if(o.isMesh&&o.visible&&o.userData?.id)meshes.push({id:o.userData.id,position:o.position.toArray(),rotation:[o.rotation.x,o.rotation.y,o.rotation.z],vertices:Array.from(o.geometry.attributes.position.array)});});
   return {camera:s.camera.position.toArray(),target:s.controls.target.toArray(),meshes};
  }hook=hook.next;}fiber=fiber.return;}return null;
 },{action,payload});
 const capture=async(name,extra={})=>{await page.waitForTimeout(1000);if(extra.camera){const pose=await state('read');for(let i=0;i<3;i++){assert(Math.abs(pose.camera[i]-extra.camera.position[i])<.001,'Camera drift');assert(Math.abs(pose.target[i]-extra.camera.target[i])<.001,'Camera target drift');}}const path=`${out}/${name}.jpg`;await page.screenshot({path,quality:93});captures.push({name,path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),...extra});console.log(`Captured ${name}`);};
 for(const project of projects){
  if(detail&&!project.id.includes('2026-10-21'))continue;
  await page.goto(`${base}/workspace/${project.id}`,{waitUntil:'networkidle',timeout:90000});await page.getByRole('button',{name:'2D Floor Plan',exact:true}).waitFor();
  const before=await saved(project.id),scene=JSON.parse(before.houseConfigJson).v3Scene;
  const date=project.id.includes('2026-10-20')?'2026-10-20':'2026-10-21',prefix=project.id.replace('audit-','');
  if(detail){
   const camera={position:[-scene.site.width*.62,scene.site.depth*.65,-scene.site.depth*.72],target:[-10,0,0]};
   for(const [label,suffix] of [['3D Massing','massing'],['3D Blueprint','blueprint'],['Finished House','finished']]){
    await mode(label);await page.waitForTimeout(1600);await state('camera',camera);await capture(`${prefix}-northwest-${suffix}`,{camera});
   }
   const after=await saved(project.id);assert.equal(after.houseConfigJson,before.houseConfigJson);assert.deepEqual(after.versions,before.versions);
   checks.push({id:project.id,northwestDetail:true,sceneUnchanged:true,historyUnchanged:true});continue;
  }
  await capture(`${prefix}-plan`);
  await page.getByLabel('Plan floor',{exact:true}).selectOption('0');await page.getByLabel('Plan building',{exact:true}).selectOption('main-villa');await capture(`${prefix}-ground`);
  await page.getByLabel('Plan floor',{exact:true}).selectOption('1');await capture(`${prefix}-upper`);
  const camera={position:[scene.site.width*.62,scene.site.depth*.65,scene.site.depth*.72],target:[0,0,0]};
  await mode('3D Massing');await page.waitForTimeout(1600);await state('camera',camera);await capture(`${prefix}-massing`,{camera});
  await mode('3D Blueprint');await page.waitForTimeout(1600);await state('camera',camera);await capture(`${prefix}-blueprint`,{camera});const blueprint=await state('read');
  await mode('Finished House');await page.waitForTimeout(1600);await state('camera',camera);await capture(`${prefix}-finished`,{camera});const finished=await state('read');
  const common=blueprint.meshes.filter(a=>finished.meshes.some(b=>b.id===a.id));assert(common.length>30);
  for(const a of common){const b=finished.meshes.find(b=>b.id===a.id);assert.deepEqual([a.position,a.rotation,a.vertices],[b.position,b.rotation,b.vertices]);}
  const living=date.endsWith('20')?{position:[10,1.7,-45],target:[-5,3,-4]}:{position:[-44,1.7,34],target:[-10,3,0]};
  await state('camera',living);await capture(`${prefix}-outdoor-eye-level`,{camera:living});
  const arrival=date.endsWith('20')?{position:[9,1.7,36],target:[-5,3,-3]}:{position:[30,1.7,14],target:[-10,3,0]};
  await state('camera',arrival);await capture(`${prefix}-arrival-eye-level`,{camera:arrival});
  const after=await saved(project.id);assert.equal(after.houseConfigJson,before.houseConfigJson);assert.deepEqual(after.versions,before.versions);
  await page.reload({waitUntil:'networkidle'});assert.equal((await saved(project.id)).houseConfigJson,before.houseConfigJson);
  checks.push({id:project.id,sameGeometryBlueprintFinished:common.length,sceneUnchanged:true,historyUnchanged:true,reloadIdentical:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);assert.deepEqual(assetsFailed,[]);
 writeFileSync(`${out}/capture.json`,JSON.stringify({runtime:'next start: optimized production build',renderer:'Ordinary workspace Canvas/HouseRenderer/PrimitiveMesh, unchanged production materials and lighting',providerCalls:0,isolatedStorage:true,matchingCameras:true,captures,checks,errors,forbidden,assetsFailed},null,2)+'\n');
 console.log(JSON.stringify({captures:captures.length,checks,errors,forbidden,assetsFailed}));
}catch(e){writeFileSync(`${out}/capture-failure.json`,JSON.stringify({message:String(e),captures,checks,errors,forbidden,assetsFailed},null,2)+'\n');throw e;}finally{await browser.close();}
