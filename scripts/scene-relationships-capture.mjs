/** Offline browser proof. All AI endpoints are intercepted; all external traffic is blocked. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/construction-relationships';mkdirSync(dir,{recursive:true});
const ladera=JSON.parse(readFileSync('docs/villa-playground/scene-operations/ladera.scene.json','utf8'));
const retained=JSON.parse(readFileSync('docs/villa-playground/flat-main-house/original.scene.json','utf8'));
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
   return r.fulfill({json:{name:ladera.name,summary:'Offline relationship replay',unsupported:[],operations:input.mode==='generate'?ladera.elements.map(element=>({op:'add',element})):editOperations}});
  }
  return r.continue();
 });
 await page.goto('http://localhost:3000',{waitUntil:'networkidle',timeout:120000});
 await page.waitForTimeout(1800);
 await page.getByLabel('Describe your dream home').fill('Offline supported Casa Ladera construction proof');
 await page.getByRole('button',{name:'Generate',exact:true}).click();
 await page.waitForURL('**/workspace/**');await page.getByRole('heading',{name:ladera.name}).waitFor({timeout:120000});
 const projectId=new URL(page.url()).pathname.split('/').at(-1);
 const saved=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id),projectId);
 const scene=async()=>JSON.parse((await saved()).houseConfigJson);
 assert.deepEqual(await scene(),ladera);checks.push('homepage generation accepts unchanged supported Casa Ladera via mocked shared contract');
 await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(1800);await page.screenshot({path:`${dir}/01-ladera.png`});
 async function edit(ops,message){editOperations=ops;await page.getByLabel('Terra design brief').fill(message);await page.getByRole('button',{name:'Edit scene',exact:true}).click();}
 for(const [ops,message,expected] of [
  [[{op:'move',id:'balcony-deck',at:[30,14.85,2.15]}],'Float terrace away from support','needs contact'],
  [[{op:'resize',id:'balcony-rail',size:[13,1.1,2.1]}],'Use railing as terrace floor','railing only'],
  [[{op:'resize',id:'salon-east',size:[.16,3.8,9.5]}],'Swap side glazing axes','Glazing renders along local X'],
  [[{op:'resize',id:'suite-screen',size:[.22,3.1,6.3]}],'Swap screen axes','Screen slats distribute along local X'],
 ]) {
  const previous=await saved();await edit(ops,message);
  await page.getByRole('status').filter({hasText:expected}).waitFor();
  assert.deepEqual(await saved(),previous);checks.push(`${message}: rejected atomically, no saved version`);
 }
 await page.screenshot({path:`${dir}/02-rejected-edit.png`});
 await edit([{op:'move',id:'suite-screen',at:[3.8,6.5,1.3]}],'Slide supported privacy screen');
 await page.getByRole('status').filter({hasText:'Offline relationship replay'}).waitFor();
 const after=await scene();assert.deepEqual(after.elements.find(e=>e.id==='suite-screen').at,[3.8,6.5,1.3]);assert.deepEqual(after.elements.filter(e=>e.id!=='suite-screen'),ladera.elements.filter(e=>e.id!=='suite-screen'));
 await page.waitForTimeout(1000);await page.screenshot({path:`${dir}/03-targeted-edit.png`});
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await scene(),ladera);
 await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await scene(),after);
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await scene(),after);
 checks.push('targeted screen edit preserves unrelated elements; undo, redo and reload preserve exact JSON');
 await page.getByLabel('Import scene JSON').setInputFiles({name:'retained.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(retained))});
 await page.getByRole('heading',{name:retained.name}).waitFor();assert.deepEqual(await scene(),retained);
 await page.getByRole('button',{name:'Aerial',exact:true}).click();await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/04-retained-terrain.png`});
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await scene(),retained);
 await page.getByLabel('Element',{exact:true}).selectOption('salon-roof');await page.getByLabel('Finish',{exact:true}).selectOption('timber');
 const finished=await scene();assert.deepEqual(finished.terrain,retained.terrain);assert.deepEqual(finished.elements.filter(e=>e.id!=='salon-roof'),retained.elements.filter(e=>e.id!=='salon-roof'));
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await scene(),retained);
 checks.push('exact retained invalid terrain scene loads and reloads unchanged; unrelated finish and undo remain available');
 await page.goto('http://localhost:3000/dev/villa-playground?scene=legacy',{waitUntil:'networkidle'});await page.waitForTimeout(1800);await page.screenshot({path:`${dir}/05-solana.png`});
 checks.push('legacy Solana composition still renders');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,mockedSceneRequests:mocks,errors,external,checks},null,2));
 console.log(JSON.stringify({providerCalls:0,mockedSceneRequests:mocks,checks},null,2));
}finally{await browser.close();}
