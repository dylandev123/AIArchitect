// Optimized production UI + actual SDK/route, isolated browser storage, offline transport only.
// Build first. PRODUCTION_ROOT=/path/to/build PLAYWRIGHT_MODULE=/path/to/playwright node scripts/plan-evaluation-integration.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const source=process.cwd(),root=process.env.PRODUCTION_ROOT??source,out=resolve('docs/architecture/architectural-blueprint-pipeline/plan-evaluation');
mkdirSync(out,{recursive:true});
const log=resolve(out,'provider.jsonl');writeFileSync(log,'');
const fd=openSync(resolve(out,'server.log'),'w'),port=process.env.REPLAY_PORT??'3135',base=`http://127.0.0.1:${port}`;
const inputs=['plan','exterior'].map(stage=>resolve(source,`src/lib/v3/__tests__/fixtures/plan-first-estate.${stage}.json`));
let server,browser;const errors=[],forbidden=[],captures=[];
const start=async enabled=>{
 server=spawn(process.execPath,['--import',resolve(source,'scripts/offline-blueprint-provider.mjs'),resolve(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',port],{cwd:root,env:{...process.env,AI_V3_PLAN_EVALUATION:enabled?'1':'0',OFFLINE_BLUEPRINT_INPUTS:JSON.stringify(inputs),OFFLINE_BLUEPRINT_LOG:log},stdio:['ignore',fd,fd]});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Server failed');try{const r=await fetch(base+'/api/ai/plan');if(r.ok)return await r.json();}catch{}await delay(300);}
 throw Error('Server not ready');
};
const stop=async()=>{if(server&&server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}};
try{
 assert.equal((await start(false)).enabled,false);
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
 const context=await browser.newContext({viewport:{width:1800,height:1120}}),page=await context.newPage();page.setDefaultTimeout(40000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==base&&!['data:','blob:'].includes(u.protocol)){forbidden.push(u.origin+u.pathname);return route.abort();}
  if(u.pathname.startsWith('/api/')&&!['/api/ai/plan'].includes(u.pathname)){
   if(route.request().method()!=='GET'){forbidden.push(route.request().method()+' '+u.pathname);return route.abort();}
   return route.fulfill({json:{catalog:[],assets:[],queue:[],glbIds:[],materials:[],projects:[]}});
  }
  return route.continue();
 });
 await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'Design 2D Plan',exact:true}).count(),0);
 await stop();assert.equal((await start(true)).enabled,true);await page.reload({waitUntil:'networkidle'});
 const sentinel={id:'offline-preservation-sentinel',name:'Unrelated saved project',generationMode:'v3-scene',projectType:'house',houseConfigJson:JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:{version:3,site:{width:180,depth:180},objects:[],relationships:[],metadata:{keep:'exact'}}}),versions:[],currentVersionIndex:0,createdAt:1,updatedAt:1};
 await page.evaluate(s=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[s]},version:6})),sentinel);await page.reload({waitUntil:'networkidle'});
 const calls=()=>readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));
 const capture=async name=>{const path=resolve(out,name+'.jpg');await page.screenshot({path,quality:92});captures.push(path);};
 const saved=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects);
 await page.getByLabel('2D architectural brief',{exact:true}).fill('An independent courtyard estate with a curved residence, guest atelier, pool and private garden.');
 const initial=page.waitForResponse(r=>r.url()===base+'/api/ai/plan'&&r.request().method()==='POST');await page.getByRole('button',{name:'Design 2D Plan',exact:true}).click();const initialResponse=await initial;assert.equal(initialResponse.status(),200,JSON.stringify(await initialResponse.json()));
 await page.waitForURL('**/workspace/**');await page.getByTestId('architectural-floor-plan').waitFor();
 assert.equal(await page.locator('canvas').count(),0);assert.equal(calls().length,1);
 let projects=await saved(),p=projects.find(p=>p.id!==sentinel.id),before=JSON.parse(p.houseConfigJson).v3Scene;
 assert(before.objects.every(o=>o.type!=='roof-form'));assert.equal(p.architecturalView.mode,'floor-plan');
 await capture('01-estate-plan');
 await page.getByLabel('Plan floor',{exact:true}).selectOption('0');await capture('02-ground-zones');
 await page.getByRole('button',{name:'Edit and save 2D plan',exact:true}).click();let plan=JSON.parse(await page.getByLabel('2D evaluation plan JSON',{exact:true}).inputValue());
 const originalRoomX=plan.buildings[0].storeys[0].spaces[0].footprint.x;plan.buildings[0].storeys[0].spaces[0].footprint.x=100;
 await page.getByLabel('2D evaluation plan JSON',{exact:true}).fill(JSON.stringify(plan,null,2));await page.getByRole('button',{name:'Save 2D plan',exact:true}).click();
 await page.getByText(/2D diagnostics/).click();await page.getByText(/BLUEPRINT_SPACE_OUTSIDE_HOST/).first().waitFor();await capture('03-local-diagnostics');
 await page.getByRole('button',{name:'Edit and save 2D plan',exact:true}).click();plan=JSON.parse(await page.getByLabel('2D evaluation plan JSON',{exact:true}).inputValue());plan.buildings[0].storeys[0].spaces[0].footprint.x=originalRoomX;plan.buildings.find(b=>b.id==='orchard-atelier').plan={kind:'rectangle',width:13,depth:10};
 await page.getByLabel('2D evaluation plan JSON',{exact:true}).fill(JSON.stringify(plan,null,2));await page.getByRole('button',{name:'Save 2D plan',exact:true}).click();
 const edited=(await saved()).find(x=>x.id===p.id);assert.equal(JSON.parse(edited.houseConfigJson).v3Scene.objects.find(o=>o.id==='orchard-atelier').architecture.width,13);
 await page.getByTitle('Undo',{exact:true}).click();assert.equal(JSON.parse((await saved()).find(x=>x.id===p.id).houseConfigJson).v3Scene.objects.find(o=>o.id==='orchard-atelier').architecture.width,12);
 await page.getByTitle('Redo',{exact:true}).click();assert.equal((await saved()).find(x=>x.id===p.id).houseConfigJson,edited.houseConfigJson);
 await page.reload({waitUntil:'networkidle'});assert.equal((await saved()).find(x=>x.id===p.id).houseConfigJson,edited.houseConfigJson);assert.equal(calls().length,1);
 await page.getByRole('button',{name:'Build in 3D',exact:true}).click();await page.getByLabel('Missing exterior design decisions',{exact:true}).fill('Use copper and terracotta roofs, pale stone walls and shaded glazing. Develop only the deferred exterior details, retaining every approved plan decision.');
 await page.getByText(/Requires one additional AI call/).waitFor();assert.equal(calls().length,1);await capture('04-explicit-cost-and-decision');
 const pending=page.waitForResponse(r=>r.url()===base+'/api/ai/plan'&&r.request().method()==='POST');await page.getByRole('button',{name:'Confirm Build in 3D · 1 AI call',exact:true}).click();const built=await pending;assert.equal(built.status(),200,JSON.stringify(await built.json()));
 await page.getByRole('button',{name:'3D Blueprint',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);await delay(1200);await capture('05-built-exact-plan');
 const final=(await saved()).find(x=>x.id===p.id),scene=JSON.parse(final.houseConfigJson).v3Scene;
 for(const o of JSON.parse(edited.houseConfigJson).v3Scene.objects){const built=scene.objects.find(b=>b.id===o.id);assert.deepEqual(built.architecture,o.architecture);}
 assert.deepEqual(scene.interior.rooms,JSON.parse(edited.houseConfigJson).v3Scene.interior.rooms);
 assert.equal(calls().length,2);assert.equal(calls().filter(x=>x.blockedSocket||x.blockedFetch).length,0);assert.deepEqual((await saved()).find(x=>x.id===sentinel.id),sentinel);
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 writeFileSync(resolve(out,'proof.json'),JSON.stringify({productionWorkspace:true,optimizedBuild:'next build --webpack',isolatedBrowserStorage:true,realProviderCalls:0,mockedProviderCalls:calls().length,planCalls:1,explicitElaborationCalls:1,disabledByDefault:true,no3DCanvasDuringEvaluation:true,localDiagnostics:true,editSaveUndoRedoReload:true,unchangedGeometryThroughConstruction:true,unrelatedProjectPreserved:true,errors,forbidden,captures},null,2)+'\n');console.log('Production 2D evaluation passed: one plan response, one explicitly requested exterior response, zero external calls.');
}catch(e){writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(e),errors,forbidden,captures},null,2));throw e;}
finally{if(browser)await browser.close();await stop();closeSync(fd);}
