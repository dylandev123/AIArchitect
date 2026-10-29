/** Offline browser proof. All AI endpoints are intercepted; all external traffic is blocked. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/architecture/planning-boundary';mkdirSync(dir,{recursive:true});
const recovered=JSON.parse(readFileSync(`${dir}/recovered.scene.json`,'utf8'));
const original=JSON.parse(readFileSync('.data/scene-responses/437d25b1-ff69-462c-ab34-a8deb7861c67.json','utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],external=[],checks=[];let mocks=0,editOperations=[];
try {
 const page=await browser.newPage({viewport:{width:1600,height:1050}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(!['127.0.0.1','localhost'].includes(u.hostname)){external.push(u.origin);return r.abort();}
  if(u.pathname==='/api/ai/plan'&&r.request().method()==='GET')return r.fulfill({json:{enabled:false}});
  if(u.pathname.startsWith('/api/ai/')){
   assert.equal(u.pathname,'/api/ai/scene');mocks++;
   const input=r.request().postDataJSON();
   return r.fulfill({json:{architecturalPlan:input.mode==='generate'?original.output.architecturalPlan:undefined,name:recovered.name,summary:'Offline retained response replay',unsupported:[],operations:input.mode==='generate'?original.output.operations:editOperations}});
  }
  return r.continue();
 });
 await page.goto('http://localhost:3000',{waitUntil:'networkidle',timeout:120000});
 await page.getByLabel('Describe your dream home').fill('Offline retained mansion recovery');
 await page.getByRole('button',{name:'Generate',exact:true}).click();
 await page.waitForURL('**/workspace/**');await page.getByRole('heading',{name:recovered.name}).waitFor({timeout:120000});
 const projectId=new URL(page.url()).pathname.split('/').at(-1);
 const saved=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),projectId);
 const scene=async()=>JSON.parse((await saved()).houseConfigJson);
 assert.deepEqual(await scene(),recovered);
 await page.getByText('Great salon: salon-gallery-wall missing or wrong architectural kind.',{exact:true}).waitFor();
 await page.getByText(/pool-water: water surface exists/).waitFor();
 checks.push('Exact retained operations render; original intent and discrepancies persist visibly.');
 await page.locator('aside').evaluate(e=>e.scrollTop=0);await page.screenshot({path:`${dir}/warnings.png`});
 for(const [view,file] of [['Aerial','aerial'],['Arrival','entrance'],['Poolside','poolside']]){
  await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/${file}.png`});await page.locator('canvas').first().screenshot({path:`${dir}/${file}-view.png`});
 }
 await page.getByLabel('Element',{exact:true}).selectOption('salon-roof');
 await page.getByLabel('Finish',{exact:true}).selectOption('timber');
 const edited=await scene();assert.equal(edited.elements.find(e=>e.id==='salon-roof').material,'timber');
 assert.deepEqual(edited.elements.filter(e=>e.id!=='salon-roof'),recovered.elements.filter(e=>e.id!=='salon-roof'));
 assert.deepEqual(edited.architecturalPlan,original.output.architecturalPlan);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await scene(),recovered);
 await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await scene(),edited);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await scene(),edited);
 await page.getByText('Great salon: salon-gallery-wall missing or wrong architectural kind.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await scene(),recovered);
 checks.push('Inspector edit, atomic history, undo, redo, save and reload preserve geometry and original warnings.');
 editOperations=[{op:'move',id:'salon-roof',at:[100,30,100]}];
 await page.getByLabel('Terra design brief').fill('Invalid floating roof edit');
 // Existing relationship validator checks floor support; use a floating floor to exercise it.
 editOperations=[{op:'move',id:'salon-floor',at:[100,30,100]}];
 await page.getByRole('button',{name:'Edit scene',exact:true}).click();
 await page.getByRole('status').filter({hasText:'needs contact'}).waitFor();assert.deepEqual(await scene(),recovered);
 checks.push('Invalid construction edit rejected without changing saved house.');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,mockedSceneRequests:mocks,errors,external,checks},null,2));
 console.log(JSON.stringify({providerCalls:0,checks},null,2));
}finally{await browser.close();}
