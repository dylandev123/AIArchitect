// Actual optimized production UI, route, model adapter and SDK; offline transport only.
// PRODUCTION_ROOT=/isolated/build PLAYWRIGHT_MODULE=/path/to/playwright-core node scripts/plan-capture-integration.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const source=process.cwd(),root=process.env.PRODUCTION_ROOT;
assert(root&&resolve(root)!==source,'Use a separate production build so real captures/projects remain untouched');
const out=resolve(process.env.CAPTURE_CHECK_OUT??'docs/architecture/architectural-blueprint-pipeline/final-2d-capture');
mkdirSync(out,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const original=JSON.parse(readFileSync(resolve(source,'src/lib/v3/__tests__/fixtures/plan-first-estate.plan.json'),'utf8'));
const rejected=structuredClone(original);rejected.connections[0].to={kind:'surface',objectId:'long-pool',local:[0,0]};
const success=structuredClone(original);
for(const f of success.features)f.type=({courtyard:'paved arrival court',terrace:'paved terrace',pool:'swimming pool','landscape-zone':'lawn'})[f.type]??f.type;
const scenarios=[
  {name:'rejected',raw:' \n'+JSON.stringify(rejected,null,2)+'\n',status:422},
  {name:'malformed',raw:' \r\n{ "name": "Cour élégante", "buildings": [',status:502},
  {name:'redacted',raw:'{ "format":"invalid", "api_key":"offline-private-value", "label":"Bearer offline-echoed-credential" }',status:422},
  {name:'success',raw:' \r\n'+JSON.stringify(success,null,2)+'\n',status:200},
];
const inputs=scenarios.map(s=>{const file=resolve(out,`offline-${s.name}.txt`);writeFileSync(file,s.raw);return file;});
const log=resolve(out,'provider.jsonl');writeFileSync(log,'');
const fd=openSync(resolve(out,'server.log'),'w'),port=process.env.REPLAY_PORT??'3167',base=`http://127.0.0.1:${port}`;
let server,browser;const errors=[],forbidden=[],captures=[],results=[];
const calls=()=>readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const start=async enabled=>{
  server=spawn(process.execPath,['--import',resolve(source,'scripts/offline-blueprint-provider.mjs'),resolve(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',port],{cwd:root,env:{...process.env,AI_V3_PLAN_EVALUATION:enabled?'1':'0',OFFLINE_BLUEPRINT_INPUTS:JSON.stringify(inputs),OFFLINE_BLUEPRINT_LOG:log},stdio:['ignore',fd,fd]});
  for(let i=0;i<100;i++){
    if(server.exitCode!==null)throw Error('Production server exited');
    try{const r=await fetch(base+'/api/ai/plan');if(r.ok)return r.json();}catch{}
    await delay(300);
  }
  throw Error('Production server not ready');
};
const stop=async()=>{if(server&&server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}};
try{
  assert.equal((await start(false)).enabled,false);
  const disabled=await fetch(base+'/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(disabled.status,403);assert.equal(calls().length,0);
  await stop();const config=await start(true);assert.equal(config.enabled,true);assert.equal(config.maxProviderCalls,1);assert.equal(config.model,'gpt-5.6-terra');
  browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1800,height:1400},acceptDownloads:true}),page=await context.newPage();
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
  const sentinel={id:'offline-capture-preservation-sentinel',name:'Existing project must remain identical',generationMode:'v3-scene',projectType:'house',houseConfigJson:JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:{version:3,site:{width:180,depth:180},objects:[],relationships:[],metadata:{keep:'exact'}}}),versions:[],currentVersionIndex:0,createdAt:1,updatedAt:1};
  await page.evaluate(s=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[s]},version:6})),sentinel);
  await page.reload({waitUntil:'networkidle'});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects);
  const capture=async name=>{const file=resolve(out,`${name}.jpg`);await page.screenshot({path:file,quality:90});captures.push(file);};
  const download=async recovery=>{
    const pending=page.waitForEvent('download');
    await page.getByRole('link',{name:`Download ${recovery.redacted?'redacted':'original'} response · SHA-256 ${recovery.sha256}`,exact:true}).click();
    const item=await pending;assert.equal(item.suggestedFilename(),`plan-response-${recovery.sha256}.json`);
    const bytes=readFileSync(await item.path());assert.equal(bytes.toString('utf8'),recovery.rawResponse);assert.equal(hash(bytes),recovery.sha256);
  };
  let accepted,project;
  for(const [index,s] of scenarios.entries()){
    const prior=await saved();
    await page.getByLabel('2D architectural brief',{exact:true}).fill(`Offline ${s.name}: independent courtyard estate`);
    const pending=page.waitForResponse(r=>r.url()===base+'/api/ai/plan'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Design 2D Plan',exact:true}).click();
    const response=await pending,body=await response.json();assert.equal(response.status(),s.status,JSON.stringify(body));
    const evidence=body.recovery;assert(evidence);assert.equal(evidence.originalSha256,hash(s.raw));assert.equal(evidence.originalBytes,Buffer.byteLength(s.raw));
    assert.equal(evidence.sha256,hash(evidence.rawResponse));assert.equal(evidence.bytes,Buffer.byteLength(evidence.rawResponse));
    assert.equal(evidence.redacted,s.name==='redacted');
    if(!evidence.redacted)assert.equal(evidence.rawResponse,s.raw);
    else {assert(!JSON.stringify(evidence).includes('offline-private-value'));assert(!JSON.stringify(evidence).includes('offline-echoed-credential'));}
    assert.equal(readFileSync(resolve(root,`.v3-debug/plan-evaluations/${evidence.sha256}.response.json`),'utf8'),evidence.rawResponse);
    assert.deepEqual(JSON.parse(readFileSync(resolve(root,`.v3-debug/plan-evaluations/${evidence.sha256}.capture.json`),'utf8')),evidence);
    if(s.status===200){
      await page.waitForURL('**/workspace/**');await page.getByTestId('architectural-floor-plan').waitFor();accepted=evidence;
      project=(await saved()).find(p=>!prior.some(old=>old.id===p.id));
      assert.equal(JSON.parse(project.houseConfigJson).v3Scene.metadata.planResponseSha256,evidence.sha256);
      assert.equal(project.architecturalView.mode,'floor-plan');assert.equal(await page.locator('canvas').count(),0);
    }else{
      assert(!body.json);await page.getByRole('alert').filter({hasText:'PlanEvaluationError'}).waitFor();
    }
    await download(evidence);await capture(`${index+1}-${s.name}`);
    const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),`ai-architect-plan-response:${evidence.sha256}`);assert.deepEqual(stored,evidence);
    const after=await saved();for(const old of prior)assert.deepEqual(after.find(p=>p.id===old.id),old);
    assert.equal(calls().length,index+1);assert.equal(body.providerCalls,1);
    results.push({scenario:s.name,status:s.status,sha256:evidence.sha256,originalSha256:evidence.originalSha256,redacted:evidence.redacted,exactCapture:!evidence.redacted,downloadVerified:true,providerCalls:1});
  }
  await page.getByLabel('Plan floor',{exact:true}).selectOption('0');
  await page.getByRole('button',{name:'Edit and save 2D plan',exact:true}).click();
  const plan=JSON.parse(await page.getByLabel('2D evaluation plan JSON',{exact:true}).inputValue());
  plan.buildings.find(b=>b.id==='orchard-atelier').plan={kind:'rectangle',width:13,depth:10};
  await page.getByLabel('2D evaluation plan JSON',{exact:true}).fill(JSON.stringify(plan,null,2));await page.getByRole('button',{name:'Save 2D plan',exact:true}).click();
  const edited=(await saved()).find(p=>p.id===project.id);
  assert.equal(JSON.parse(edited.houseConfigJson).v3Scene.objects.find(o=>o.id==='orchard-atelier').architecture.width,13);
  await page.getByTitle('Undo',{exact:true}).click();assert.equal(JSON.parse((await saved()).find(p=>p.id===project.id).houseConfigJson).v3Scene.objects.find(o=>o.id==='orchard-atelier').architecture.width,12);
  await page.getByTitle('Redo',{exact:true}).click();assert.equal((await saved()).find(p=>p.id===project.id).houseConfigJson,edited.houseConfigJson);
  await page.reload({waitUntil:'networkidle'});await page.getByTestId('architectural-floor-plan').waitFor();
  assert.equal((await saved()).find(p=>p.id===project.id).houseConfigJson,edited.houseConfigJson);await download(accepted);await capture('5-edited-reloaded');
  assert.deepEqual((await saved()).find(p=>p.id===sentinel.id),sentinel);
  assert.equal(await page.locator('canvas').count(),0);assert.equal(calls().length,scenarios.length);
  assert(calls().every(c=>c.model==='gpt-5.6-terra'&&c.maxOutputTokens===10000&&c.format==='json_object'));
  assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
  // Production usage persistence requires Postgres. Credentials remain deliberately
  // absent here; capture files and browser storage are verified independently.
  writeFileSync(resolve(out,'proof.json'),JSON.stringify({result:'PASS',runtime:'next build --webpack + next start, isolated source copy',productionRoute:'/api/ai/plan',flag:'AI_V3_PLAN_EVALUATION=1',realProviderCalls:0,mockedProviderCalls:calls().length,perEvaluationProviderCalls:1,automaticRetries:0,automaticRepairs:0,elaborationCalls:0,disabledByDefault:true,captureBeforeSdkParsing:true,captureBeforeNormalization:true,successfulCaptureDownloadAfterEditAndReload:true,floorPlanEditUndoRedoReload:true,existingProjectsUnchanged:true,isolatedBrowserStorage:true,productionUsageDatabase:'Intentionally disconnected for this offline check',results,errors,forbidden,captures},null,2)+'\n');
  rmSync(resolve(out,'failure.json'),{force:true});
  console.log('PASS: production 2D captures, malformed/rejected/success downloads, secret redaction, SHA-256, editing/reload; one mocked call per evaluation, zero external calls.');
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({error:String(error),errors,forbidden,results},null,2));throw error;}
finally{if(browser)await browser.close();await stop();closeSync(fd);}
