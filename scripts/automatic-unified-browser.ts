/* eslint-disable @typescript-eslint/no-explicit-any -- offline browser harness: untyped mock answers and Playwright routes */
/** OFFLINE browser check of the unified automatic workflow: real Private Studio auth/ownership/store/HTTP/service
 * and worker with an injected provider double (no SDK, no network, no real account or approval). The prepared
 * correction policy is used ONLY inside this isolated temporary store; it is not active anywhere else. */
import {createRequire} from 'node:module';
import {existsSync,mkdirSync} from 'node:fs';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {StudioStore} from '@/lib/privateStudio/store';
import {startStudioWorker} from '@/lib/privateStudio/worker';
import {PrivateStudioService} from '@/lib/privateStudio/service';
import {privateHandlers} from '@/lib/privateStudio/http';
import {approvePrivateRun} from '@/lib/privateStudio/approval';
import {LIVE_POLICY} from '@/lib/privateStudio/policy';
import {PromptMockDesigner,MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
import type {StageNo} from '@/lib/villa/staged/pipeline';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const out=`docs/architecture/automatic-house/${process.argv[2]??'unified-offline-browser'}`;
assert(!existsSync(out),'Choose a new output folder; evidence exists.');mkdirSync(out,{recursive:true});
const brief=MOCK_BRIEFS[1],policy=LIVE_POLICY;
const dir=await mkdtemp(path.join(os.tmpdir(),'studio-unified-')),store=new StudioStore(dir);
let scenario:'repair'|'failure'='repair';const calls:{scenario:string;stage:number;correction:boolean}[]=[];
const designer=new PromptMockDesigner(brief);
const answer=(stage:StageNo,value:any,correction:boolean)=>scenario==='repair'&&stage===3&&!correction?{...value,rooms:value.rooms.map((r:any)=>r.id==='kitchen-hall'?{...r,type:'foyer'}:r)}
 :scenario==='failure'&&stage===5?{...value,pool:{...value.pool,scale:'none'}}:value;
const service=new PrivateStudioService(store,observe=>{
 const run=async(stage:StageNo,ctx:any,correction:boolean)=>{
  calls.push({scenario,stage,correction});await new Promise(r=>setTimeout(r,1200));
  const value=answer(stage,(await designer.design(stage,ctx)).value,correction),raw=JSON.stringify(value),usage={model:policy.model,inputTokens:1000,outputTokens:200,costUsd:.0044};
  await observe({raw,request:{system:'offline double',prompt:ctx.brief},usage,finishReason:'stop'});
  return {value,raw,usage,finishReason:'stop'};
 };
 return {label:'OFFLINE browser double',design:(stage,ctx)=>run(stage,ctx,false),correct:(stage,ctx)=>run(stage,ctx,true)};
},policy);
const http=privateHandlers(store,service),stopWorker=startStudioWorker(service);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl']});
const errors:string[]=[],progress:string[]=[];
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}});
 page.on('pageerror',(e:Error)=>errors.push(String(e)));
 await page.route('**/*',async(route:any)=>{
  const req=route.request(),u=new URL(req.url());
  if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();
  if(u.pathname==='/api/private-studio'){
   const request=new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),...(req.method()==='POST'?{body:req.postData()}:{})});
   const response=await (req.method()==='GET'?http.GET(request):http.POST(request));
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({catalog:[],queue:[],glbIds:[]})});
  return route.continue();
 });
 const json=await readFile('docs/architecture/prompt-staged-generation/compact.scene.json','utf8'),id='unified-offline-project';
 const project={id,name:'Unified automatic offline check',projectType:'house',generationMode:'direct-scene',createdAt:1,updatedAt:1,houseConfigJson:json,versions:[{id:'initial',createdAt:1,summary:'Offline baseline',houseConfigJson:json}],currentVersionIndex:0};
 await page.goto('http://localhost:3015');
 await page.evaluate((p:unknown)=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[p]},version:0})),project);
 await page.goto(`http://localhost:3015/workspace/${id}`);
 await page.getByLabel('Private Studio setup code',{exact:true}).waitFor({timeout:120000});
 await page.getByLabel('Private Studio setup code',{exact:true}).fill(await readFile(path.join(dir,'setup-code'),'utf8'));
 await page.getByLabel('Private Studio password',{exact:true}).fill('offline-unified-browser-password');
 await page.getByRole('button',{name:'Set up private Studio',exact:true}).click();
 await page.getByRole('button',{name:'Create owned server project',exact:true}).click();
 await page.getByText('plus up to 5 targeted corrections',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Generate House',exact:true}).isDisabled(),true);assert.equal(calls.length,0);
 await approvePrivateRun(store,brief,undefined,policy);
 await page.reload();
 await page.getByLabel('Private live architectural description',{exact:true}).fill(brief);
 await page.getByRole('button',{name:'Generate House',exact:true}).click();
 const region=page.getByRole('region',{name:'House generation progress'});
 await region.waitFor();
 await page.getByText('Applying one targeted correction from the measured problems',{exact:true}).waitFor({timeout:60000});
 progress.push('correction visible');await region.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/correcting.png`});
 await page.reload();progress.push('refreshed during generation');
 await page.getByText('Your house is ready',{exact:true}).waitFor({timeout:120000});
 assert.equal(await page.getByText('5 of 5 stages completed',{exact:true}).count(),1);
 const raw=await store.transaction(s=>structuredClone(s)),run=Object.values(raw.runs)[0];
 assert.deepEqual(run.callIds.map(i=>`${raw.calls[i].stage}:${raw.calls[i].purpose}`),['1:design','2:design','3:design','3:correction','4:design','5:design']);
 assert.equal(raw.projects[run.projectId].save,(run.lastResponse as {save:string}).save);
 const version=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')!).state.projects[0].versions.at(-1));
 assert.equal(version.summary,'Live prompt-driven staged house');assert.equal(version.stagedStudio.save,(run.lastResponse as {save:string}).save);
 await page.reload();await page.getByText('Your house is ready',{exact:true}).waitFor();progress.push('completed house reopened after reload');
 await region.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/complete.png`,fullPage:false});
 await page.locator('canvas').first().scrollIntoViewIfNeeded();await page.waitForTimeout(2500);await page.screenshot({path:`${out}/workspace-house.png`});
 // Failure after a correction that did not resolve it: exact stage status, accepted stages preserved, survives refresh.
 scenario='failure';
 await page.getByRole('button',{name:'Create owned server project',exact:true}).click();
 const failedProject=await store.transaction(s=>Object.keys(s.projects).at(-1)!);
 await approvePrivateRun(store,brief,failedProject,policy);
 await page.reload();await page.getByLabel('Private server project',{exact:true}).selectOption(failedProject);
 await page.getByLabel('Private live architectural description',{exact:true}).fill(brief);
 await page.getByRole('button',{name:'Generate House',exact:true}).click();
 await page.getByText('Generation stopped',{exact:true}).waitFor({timeout:120000});
 await page.reload();await page.getByLabel('Private server project',{exact:true}).selectOption(failedProject);
 await page.getByText('Generation stopped',{exact:true}).waitFor();
 assert.equal(await region.getByText('4 of 5 stages completed',{exact:true}).count(),1);
 assert.equal(await region.locator('li[data-state="failed"]').innerText().then((t:string)=>t.includes('Pool and landscaping')),true);
 await page.getByText('the one targeted correction did not resolve it.',{exact:false}).waitFor();
 const failed=await store.transaction(s=>s.runs[s.projects[failedProject].runId!]);
 assert.equal(failed.state,'failed');assert.equal(failed.source.result!.lastGood!.stage,4);
 await region.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/failed-after-correction.png`});progress.push('failure after correction preserved stages 1-4');
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/browser.json`,JSON.stringify({passed:true,provenance:'OFFLINE injected provider double; real private auth/store/HTTP/service/worker; isolated temporary account; prepared correction policy used only inside this temporary store',brief,progress,calls,pageErrors:errors,paidCalls:0},null,1));
 console.log('Unified Studio browser checks passed:',progress.join(' | '));
}finally{stopWorker();await browser.close();await rm(dir,{recursive:true,force:true});}
