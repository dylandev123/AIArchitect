// Replays the ORIGINAL retained Terra response (no retargeting) through the optimized production route
// and the normal Planning Studio. Offline provider transport only; zero real Terra/OpenAI calls.
// PRODUCTION_ROOT=/isolated/build PLAYWRIGHT_MODULE=/path/to/playwright-core node scripts/plan-recovery-integration.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const source=process.cwd(),root=process.env.PRODUCTION_ROOT;
assert(root&&resolve(root)!==source,'Use a separate production build so real captures/projects remain untouched');
const out=resolve(process.env.RECOVERY_OUT??'docs/architecture/architectural-blueprint-pipeline/general-2d-recovery');
mkdirSync(out,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const SHA='9591e1203eb1b81f33d35fb709c31b14e982bfa002fb75ceb432e3869e2877fd';
const retained=resolve(source,`.v3-debug/plan-evaluations/${SHA}.response.json`);
const raw=readFileSync(process.env.REPLAY_RESPONSE??retained,'utf8');
assert.equal(hash(raw),SHA,'The replayed response must be the original paid response, byte for byte');
const input=resolve(out,'offline-original-response.txt');writeFileSync(input,raw);
const log=resolve(out,'provider.jsonl');writeFileSync(log,'');
const fd=openSync(resolve(out,'server.log'),'w'),port=process.env.REPLAY_PORT??'3171',base=`http://127.0.0.1:${port}`;
let server,browser;const errors=[],forbidden=[],captures=[],steps=[];
const calls=()=>readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const start=async()=>{
  server=spawn(process.execPath,['--import',resolve(source,'scripts/offline-blueprint-provider.mjs'),resolve(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',port],{cwd:root,env:{...process.env,AI_V3_PLAN_EVALUATION:'1',OFFLINE_BLUEPRINT_INPUTS:JSON.stringify([input]),OFFLINE_BLUEPRINT_LOG:log},stdio:['ignore',fd,fd]});
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error('Production server exited');
    try{const r=await fetch(base+'/api/ai/plan');if(r.ok)return r.json();}catch{}
    await delay(300);
  }
  throw Error('Production server not ready');
};
const stop=async()=>{if(server&&server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}};
try{
  const config=await start();assert.equal(config.enabled,true);assert.equal(config.maxProviderCalls,1);
  browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1800,height:1300},acceptDownloads:true}),page=await context.newPage();
  page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==base&&!['data:','blob:'].includes(u.protocol)){forbidden.push(u.origin+u.pathname);return route.abort();}
    if(u.pathname.startsWith('/api/')&&u.pathname!=='/api/ai/plan'){
      if(route.request().method()!=='GET'){forbidden.push(route.request().method()+' '+u.pathname);return route.abort();}
      return route.fulfill({json:{catalog:[],assets:[],queue:[],glbIds:[],materials:[],projects:[]}});
    }
    return route.continue();
  });
  await page.goto(base,{waitUntil:'networkidle'});
  const sentinel={id:'offline-recovery-preservation-sentinel',name:'Existing project must remain identical',generationMode:'v3-scene',projectType:'house',houseConfigJson:JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:{version:3,site:{width:180,depth:180,baseElevation:0},objects:[],relationships:[],metadata:{}}}),versions:[],createdAt:1,updatedAt:1};
  await page.evaluate(s=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[s]},version:6})),sentinel);
  await page.reload({waitUntil:'networkidle'});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects);
  const capture=async name=>{const file=resolve(out,`${name}.jpg`);await page.screenshot({path:file,quality:90});captures.push(`${name}.jpg`);};
  const sceneOf=async id=>JSON.parse((await saved()).find(p=>p.id===id).houseConfigJson).v3Scene;
  const unresolvedIds=async id=>(await sceneOf(id)).metadata.planUnresolved.map(i=>i.id).sort();

  // 1. The original response, unchanged, through the real route.
  await page.getByLabel('2D architectural brief',{exact:true}).fill('Offline replay of the original Saint Lucia estate response');
  const pending=page.waitForResponse(r=>r.url()===base+'/api/ai/plan'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Design 2D Plan',exact:true}).click();
  const response=await pending,body=await response.json();
  assert.equal(response.status(),200,JSON.stringify(body.failure??body.findings??body));
  assert.equal(body.recovery.sha256,SHA);assert.equal(body.recovery.rawResponse,raw);assert.equal(body.providerCalls,1);
  assert.match(body.summary,/3 plan objects could not be drawn/);
  await page.waitForURL('**/workspace/**');await page.getByTestId('architectural-floor-plan').waitFor();
  const project=(await saved()).find(p=>p.id!==sentinel.id);
  assert.deepEqual(await unresolvedIds(project.id),['arrival-route','guest-walk','pool-walk']);
  const first=await sceneOf(project.id);
  assert.equal(first.objects.filter(o=>o.type==='building-mass').length,2);
  assert.equal(first.interior.rooms.length,19);
  assert.equal(first.estatePlan.circulation.length,0);
  assert.equal(await page.locator('canvas').count(),0);
  steps.push({step:'original response displayed',status:200,unresolved:await unresolvedIds(project.id),buildings:2,rooms:first.interior.rooms.length});
  await page.getByText('3 unresolved plan objects · not drawn').waitFor();
  await page.getByText('is not a dry surface').first().waitFor();
  await capture('1-estate-master-plan-with-unresolved-diagnostics');
  await page.getByRole('button',{name:'Hide panel',exact:true}).click();await capture('1b-estate-master-plan-panel-hidden');
  await page.getByRole('button',{name:/Show 2D plan panel · 3 unresolved/}).click();
  await page.getByLabel('Plan floor',{exact:true}).selectOption('0');await capture('2-ground-floor-plan');
  await page.getByLabel('Plan floor',{exact:true}).selectOption('1');await capture('3-upper-floor-plan');
  await page.getByLabel('Plan floor',{exact:true}).selectOption('0');

  // 2. Edit, save, undo/redo, reload. The unresolved routes survive every step untouched.
  await page.getByRole('button',{name:'Edit and save 2D plan',exact:true}).click();
  const editor=page.getByLabel('2D evaluation plan JSON',{exact:true});
  const plan=JSON.parse(await editor.inputValue());
  const pool=plan.connections.find(c=>c.id==='pool-walk');
  assert.equal(pool.to.objectId,'infinity-pool');assert.deepEqual(pool.to.local,[0,5]);
  assert(plan.connections.some(c=>c.id==='arrival-route')&&plan.connections.some(c=>c.id==='guest-walk'));
  plan.buildings.find(b=>b.id==='guest-pavilion').plan={kind:'rectangle',width:26,depth:20};
  await editor.fill(JSON.stringify(plan,null,2));await page.getByRole('button',{name:'Save 2D plan',exact:true}).click();
  const edited=(await saved()).find(p=>p.id===project.id);
  assert.equal(JSON.parse(edited.houseConfigJson).v3Scene.objects.find(o=>o.id==='guest-pavilion').architecture.width,26);
  assert.deepEqual(await unresolvedIds(project.id),['arrival-route','guest-walk','pool-walk']);
  await page.getByTitle('Undo',{exact:true}).click();
  assert.equal((await sceneOf(project.id)).objects.find(o=>o.id==='guest-pavilion').architecture.width,24);
  await page.getByTitle('Redo',{exact:true}).click();
  assert.equal((await saved()).find(p=>p.id===project.id).houseConfigJson,edited.houseConfigJson);
  await page.reload({waitUntil:'networkidle'});await page.getByTestId('architectural-floor-plan').waitFor();
  assert.equal((await saved()).find(p=>p.id===project.id).houseConfigJson,edited.houseConfigJson);
  await page.getByText('3 unresolved plan objects · not drawn').waitFor();
  steps.push({step:'edit, save, undo, redo, reload',unresolvedPreserved:true,guestPavilionWidth:26});
  await capture('4-edited-and-reloaded');

  // 3. Subsequent correction by the author: only these two edits, nothing automatic.
  await page.getByRole('button',{name:'Edit and save 2D plan',exact:true}).click();
  const plan2=JSON.parse(await editor.inputValue());
  plan2.connections.find(c=>c.id==='pool-walk').to={kind:'surface',objectId:'sea-terrace',local:[0,0]};
  await editor.fill(JSON.stringify(plan2,null,2));await page.getByRole('button',{name:'Save 2D plan',exact:true}).click();
  assert.deepEqual(await unresolvedIds(project.id),['arrival-route','guest-walk']);
  assert.deepEqual((await sceneOf(project.id)).estatePlan.circulation.map(c=>c.id),['pool-walk']);
  steps.push({step:'author retargets pool-walk',unresolved:['arrival-route','guest-walk'],drawn:['pool-walk']});
  await capture('5-pool-walk-corrected');
  await page.getByRole('button',{name:'Edit and save 2D plan',exact:true}).click();
  const plan3=JSON.parse(await editor.inputValue());
  const door=plan3.buildings.find(b=>b.id==='main-house').accessOpenings.find(o=>o.id==='main-entry');door.start=.432;door.end=.568;
  await editor.fill(JSON.stringify(plan3,null,2));await page.getByRole('button',{name:'Save 2D plan',exact:true}).click();
  assert.deepEqual(await unresolvedIds(project.id),[]);
  assert.deepEqual((await sceneOf(project.id)).estatePlan.circulation.map(c=>c.id).sort(),['arrival-route','guest-walk','pool-walk']);
  steps.push({step:'author fits main-entry inside its recess',unresolved:[],drawn:['arrival-route','guest-walk','pool-walk']});
  await page.getByLabel('Plan floor',{exact:true}).selectOption('site');
  await capture('6-all-routes-resolved');
  await page.getByTitle('Undo',{exact:true}).click();await page.getByTitle('Undo',{exact:true}).click();
  assert.deepEqual(await unresolvedIds(project.id),['arrival-route','guest-walk','pool-walk']);
  await page.getByTitle('Redo',{exact:true}).click();await page.getByTitle('Redo',{exact:true}).click();
  assert.deepEqual(await unresolvedIds(project.id),[]);
  await page.reload({waitUntil:'networkidle'});await page.getByTestId('architectural-floor-plan').waitFor();
  assert.deepEqual(await unresolvedIds(project.id),[]);

  assert.deepEqual((await saved()).find(p=>p.id===sentinel.id),sentinel);
  assert.equal(await page.locator('canvas').count(),0);assert.equal(calls().length,1);
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
  writeFileSync(resolve(out,'proof.json'),JSON.stringify({result:'PASS',runtime:'next build --webpack + next start, isolated source copy',originalResponseSha256:SHA,replayedUnchanged:true,manualRetargeting:false,realProviderCalls:0,mockedProviderCalls:calls().length,steps,captures,pageErrors:errors,forbiddenRequests:forbidden},null,2)+'\n');
  console.log('PASS: original paid response displays with 3 unresolved routes; edit/undo/redo/reload/correction verified; one mocked call, zero external calls.');
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(error),errors,forbidden,steps},null,2));throw error;}
finally{if(browser)await browser.close();await stop();closeSync(fd);}
