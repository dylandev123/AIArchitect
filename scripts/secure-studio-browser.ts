/** OFFLINE browser + real authentication/ownership/store/HTTP service. Provider is an injected test double.
 * Isolated temp store and browser; no real account, approval, API key or provider traffic. */
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {StudioStore} from '@/lib/privateStudio/store';
import {PrivateStudioService} from '@/lib/privateStudio/service';
import {privateHandlers} from '@/lib/privateStudio/http';
import {approvePrivateRun} from '@/lib/privateStudio/approval';
import {FIRST_BRIEF} from '@/lib/privateStudio/policy';
import {PromptMockDesigner,MOCK_BRIEFS} from '@/lib/villa/staged/promptMocks';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const dir=await mkdtemp(path.join(os.tmpdir(),'studio-browser-')),store=new StudioStore(dir);
let mockCalls=0;
const designer=new PromptMockDesigner(MOCK_BRIEFS[0]);
const http=privateHandlers(store,new PrivateStudioService(store,observe=>({label:'Offline browser double',design:async(stage,ctx)=>{mockCalls++;const r=await designer.design(stage,ctx);await observe({usage:r.usage,providerUsage:{inputTokens:0,outputTokens:0},requestId:`offline-${stage}`,finishReason:'stop'});return r;},correct:async()=>{throw Error('No retries');}})));
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
 await page.getByRole('button',{name:'Start approved live generation',exact:true}).click();
 await page.getByText('No explicit live approval for this exact description',{exact:false}).waitFor();assert.equal(mockCalls,0);
 // Isolated mock approval only. The application's real local store is never touched.
 await approvePrivateRun(store,FIRST_BRIEF);
 await page.reload();await page.getByText('Signed in. An exact-brief approval is available.',{exact:true}).waitFor();
 await page.getByLabel('Private live architectural description',{exact:true}).fill(FIRST_BRIEF);
 await page.getByRole('button',{name:'Start approved live generation',exact:true}).click();
 await page.getByText('Stage 1 · ready',{exact:false}).waitFor();
 for(let stage=2;stage<=5;stage++){
  await page.getByRole('button',{name:'Run next live stage',exact:true}).click();
  await page.getByText(`Stage ${stage} · ${stage===5?'complete':'ready'}`,{exact:false}).waitFor();
 }
 await page.getByRole('button',{name:'Inspect live stage 2',exact:true}).click();
 await page.getByRole('button',{name:'Inspect live stage 5',exact:true}).click();
 await page.getByRole('button',{name:'Import completed live house into Studio',exact:true}).click();
 await page.getByText('Live staged source saved on the server',{exact:false}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Read saved live run',exact:true}).click();
 await page.getByText('Stage 5 · complete',{exact:false}).waitFor();
 assert.equal(mockCalls,5);assert.deepEqual(errors,[]);
 const raw=await store.transaction(s=>structuredClone(s));const run=Object.values(raw.runs)[0];assert.equal(run.source.input.brief,FIRST_BRIEF);
 assert.equal(raw.projects[run.projectId].save,(run.lastResponse as {save:string}).save);
 const version=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-architect-projects')!).state.projects[0].versions.at(-1));assert.equal(version.summary,'Live prompt-driven staged house');
 await page.screenshot({path:'docs/architecture/secure-live-studio/offline-browser.png'});
 await writeFile('docs/architecture/secure-live-studio/browser.json',JSON.stringify({passed:true,provenance:'OFFLINE injected provider double; real private auth/store/HTTP handlers; isolated temporary account and approval',flow:['bootstrap sign-in','create owned project','reject unapproved request before calls','grant isolated MOCK approval','new description stages 1–5','inspect','server save','import editable source','reload','reopen server run'],mockCalls,pageErrors:errors,paidCalls:0},null,2));
 console.log('Secure Studio offline browser workflow passed; five mock calls, zero paid calls');
}finally{await browser.close();await rm(dir,{recursive:true,force:true});}
