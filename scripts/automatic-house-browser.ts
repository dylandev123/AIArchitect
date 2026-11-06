/** OFFLINE browser + real authentication/ownership/store/HTTP service. Provider is an injected test double.
 * Isolated temp store and browser; no real account, approval, API key or provider traffic. */
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {StudioStore} from '@/lib/privateStudio/store';
import {startStudioWorker} from '@/lib/privateStudio/worker';
import {PrivateStudioService} from '@/lib/privateStudio/service';
import {privateHandlers} from '@/lib/privateStudio/http';
import {approvePrivateRun} from '@/lib/privateStudio/approval';
import {FIRST_BRIEF} from '@/lib/privateStudio/policy';
import {PromptMockDesigner,MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const dir=await mkdtemp(path.join(os.tmpdir(),'studio-browser-')),store=new StudioStore(dir);
let mockCalls=0;let scenario='complete';
const designer=new PromptMockDesigner(MOCK_BRIEFS[0]);
const service=new PrivateStudioService(store,observe=>({label:'Offline browser double',design:async(stage,ctx)=>{mockCalls++;await new Promise(r=>setTimeout(r,1500));const r=await designer.design(stage,ctx);if(stage===4){const v=r.value as {roofs:Record<string,{color:string}>;exterior:{verandas:unknown[]}};v.roofs.house.color='#B65A36';v.exterior.verandas=[{id:'covered-veranda',block:'house',side:'s',from:-9,to:9,depth:3,columns:5,roofMaterial:'timber',deckMaterial:'limestone'}];}if(scenario==='failure'&&stage===4)(r.value as {roofs:object}).roofs={};await observe({usage:r.usage,providerUsage:{inputTokens:0,outputTokens:0},requestId:`offline-${stage}`,finishReason:'stop'});return r;},correct:async()=>{throw Error('No retries');}}));
const http=privateHandlers(store,service);
const stopWorker=startStudioWorker(service);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(String(e)));
 await page.route('**/*',async(route: {request:()=>{url:()=>string;method:()=>string;allHeaders:()=>Promise<Record<string,string>>;postData:()=>string|null};abort:()=>Promise<void>;continue:()=>Promise<void>;fulfill:(v:unknown)=>Promise<void>})=>{
  const req=route.request(),u=new URL(req.url());
  if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();
  if(u.pathname==='/api/private-studio'){
   const request=new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),...(req.method()==='POST'?{body:req.postData()}: {})});
   const response=await (req.method()==='GET'?http.GET(request):http.POST(request));
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  if(u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({catalog:[],queue:[],glbIds:[]})});
  return route.continue();
 });
 const json=await readFile('docs/architecture/prompt-staged-generation/compact.scene.json','utf8'),id='secure-live-offline';
 const project={id,name:'Secure Studio offline check',projectType:'house',generationMode:'direct-scene',createdAt:1,updatedAt:1,houseConfigJson:json,versions:[{id:'initial',createdAt:1,summary:'Offline baseline',houseConfigJson:json}],currentVersionIndex:0};
 await page.goto('http://localhost:3015');
 await page.evaluate((p:unknown)=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[p]},version:0})),project);
 await page.goto(`http://localhost:3015/workspace/${id}`);
 await page.getByLabel('Private Studio setup code',{exact:true}).waitFor({timeout:120000});
 await page.getByLabel('Private Studio setup code',{exact:true}).fill(await readFile(path.join(dir,'setup-code'),'utf8'));
 await page.getByLabel('Private Studio password',{exact:true}).fill('offline-browser-test-password');
 await page.getByRole('button',{name:'Set up private Studio',exact:true}).click();
 await page.getByText('Signed in. Paid execution awaits explicit approval.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Create owned server project',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Generate House',exact:true}).isDisabled(),true);assert.equal(mockCalls,0);
 // Isolated mock approval only. The application's real local store is never touched.
 await approvePrivateRun(store,FIRST_BRIEF);
 await page.reload();await page.getByText('Signed in. An exact-brief approval is available.',{exact:true}).waitFor();
 await page.getByLabel('Private live architectural description',{exact:true}).fill(FIRST_BRIEF);
 await page.getByRole('button',{name:'Generate House',exact:true}).click();
 await page.getByRole('region',{name:'House generation progress'}).waitFor();
 await page.getByText('Establishing your design direction',{exact:true}).waitFor();
 await page.getByRole('region',{name:'House generation progress'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'docs/architecture/automatic-house/running.png'});
 await page.reload();
 await page.getByText('Your house is ready',{exact:true}).waitFor({timeout:120000});
 assert.equal(await page.getByText('5 of 5 stages completed',{exact:true}).count(),1);
 await page.getByRole('button',{name:'Inspect live stage 2',exact:true}).click();
 await page.getByRole('button',{name:'Inspect live stage 5',exact:true}).click();
 await page.reload();
 await page.getByText('Your house is ready',{exact:true}).waitFor();
 await page.getByText('Stage 5 · complete',{exact:false}).waitFor();
 assert.equal(mockCalls,5);assert.deepEqual(errors,[]);
 const raw=await store.transaction(s=>structuredClone(s));const run=Object.values(raw.runs)[0];assert.equal(run.source.input.brief,FIRST_BRIEF);
 assert.equal(raw.projects[run.projectId].save,(run.lastResponse as {save:string}).save);
 const version=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')!).state.projects[0].versions.at(-1));assert.equal(version.summary,'Live prompt-driven staged house');
 await page.getByRole('region',{name:'House generation progress'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'docs/architecture/automatic-house/browser.png'});
 // Failure must show its own stage, preserve accepted rooms and survive refresh.
 scenario='failure';
 await page.getByRole('button',{name:'Create owned server project',exact:true}).click();
 await approvePrivateRun(store,FIRST_BRIEF);
 await page.reload();await page.getByRole('button',{name:'Generate House',exact:true}).waitFor();
 // Reload selects the first owned project; choose the newest one explicitly.
 const failedProject=await store.transaction(s=>Object.keys(s.projects).at(-1)!);
 await page.getByLabel('Private server project',{exact:true}).selectOption(failedProject);
 await page.getByRole('button',{name:'Generate House',exact:true}).click();
 await page.getByText('Generation stopped',{exact:true}).waitFor({timeout:120000});
 await page.reload();await page.getByLabel('Private server project',{exact:true}).selectOption(failedProject);
 await page.getByText('Generation stopped',{exact:true}).waitFor();
 const region=page.getByRole('region',{name:'House generation progress'});
 assert.equal(await region.getByText('3 of 5 stages completed',{exact:true}).count(),1);
 assert.equal(await region.locator('li[data-state="failed"]').innerText().then((t:string)=>t.includes('Exterior architecture')),true);
 await region.scrollIntoViewIfNeeded();await page.screenshot({path:'docs/architecture/automatic-house/failed.png'});
 scenario='cancel';
 await page.getByRole('button',{name:'Create owned server project',exact:true}).click();
 await approvePrivateRun(store,FIRST_BRIEF);
 const cancelledProject=await store.transaction(s=>Object.keys(s.projects).at(-1)!);
 await page.reload();await page.getByLabel('Private server project',{exact:true}).selectOption(cancelledProject);
 await page.getByRole('button',{name:'Generate House',exact:true}).click();
 await page.getByRole('button',{name:'Cancel future stages',exact:true}).click();
 await page.getByText('Generation cancelled',{exact:true}).waitFor({timeout:30000});
 const cancelled=await store.transaction(s=>s.runs[s.projects[cancelledProject].runId!]);
 assert.equal(cancelled.cancelRequested,true);assert.equal(cancelled.state,'cancelled');
 assert.ok(cancelled.callIds.length<=1);
 assert.deepEqual(errors,[]);
 await writeFile('docs/architecture/automatic-house/browser.json',JSON.stringify({passed:true,provenance:'OFFLINE injected provider double; real private auth/store/HTTP handlers; isolated temporary account and approval',flow:['bootstrap sign-in','create owned project','reject unapproved request before calls','grant isolated MOCK approval','one Generate House click','refresh during generation','automatic stages 1–5','automatic editable import','inspect','server save','import editable source','reload','reopen server run','failed stage after refresh','cancel future stages'],mockCalls,pageErrors:errors,paidCalls:0},null,2));
 console.log('Automatic Studio browser checks passed: completion, refresh, failure, cancellation; zero paid calls');
}finally{stopWorker();await browser.close();await rm(dir,{recursive:true,force:true});}
