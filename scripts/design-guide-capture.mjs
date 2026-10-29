// Offline homepage generation controls, never a live quality evaluation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/architecture/design-guide';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],checks=[];let mocks=0;
try {
 for(const name of ['failed','study']) {
  const fixture=JSON.parse(readFileSync(`docs/villa-playground/terra-basic-diagnosis/${name}.scene.json`,'utf8'));
  const context=await browser.newContext({viewport:{width:1600,height:1050}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(!['localhost','127.0.0.1'].includes(url.hostname)){blocked.push(url.origin);return route.abort();}
   if(url.pathname==='/api/ai/plan'&&route.request().method()==='GET')return route.fulfill({json:{enabled:false}});
   if(url.pathname.startsWith('/api/ai/')) {
    assert.equal(url.pathname,'/api/ai/scene');mocks++;
    const input=route.request().postDataJSON();
    return route.fulfill({json:{name:fixture.name,summary:'Offline architectural capability control',unsupported:[],operations:input.mode==='edit'?[{op:'finish',id:fixture.elements[0].id,material:'bronze'}]:fixture.elements.map(element=>({op:'add',element}))}});
   }
   return route.continue();
  });
  await page.goto('http://localhost:3000',{waitUntil:'networkidle',timeout:120000});
  await page.getByLabel('Describe your dream home').fill('A coherent detailed tropical luxury residence');
  await page.getByRole('button',{name:'Generate',exact:true}).click();await page.waitForURL('**/workspace/**');
  await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor({timeout:120000});
  const id=new URL(page.url()).pathname.split('/').at(-1);
  const saved=()=>page.evaluate(id=>JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects.find(p=>p.id===id).houseConfigJson),id);
  assert.deepEqual((await saved()).elements,fixture.elements);
  for(const view of ['Arrival','Poolside','Aerial']) {
   await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1800);
   await page.screenshot({path:`${dir}/${name}-${view.toLowerCase()}.png`});
  }
  const rendered=await page.locator('canvas').evaluate(c=>{
   let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
   while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){let parts=0,meshes=0;s.scene.traverse(o=>{if(o.name.startsWith('operation:'))parts++;if(o.isMesh)meshes++;});return {parts,meshes};}h=h.next;}f=f.return;}return null;
  });
  assert.equal(rendered.parts,fixture.elements.length);assert.ok(rendered.meshes>rendered.parts);
  await page.getByLabel('Terra design brief').fill('Change the first element finish only');await page.getByRole('button',{name:'Edit scene',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Offline architectural capability control'}).waitFor();
  await page.waitForTimeout(500);
  const after=await saved();assert.equal(after.elements[0].material,'bronze');assert.deepEqual(after.elements.slice(1),fixture.elements.slice(1));
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await saved()).elements,fixture.elements);
  await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await saved(),after);
  await page.reload({waitUntil:'networkidle'});assert.deepEqual(await saved(),after);
  checks.push({name,elements:fixture.elements.length,rendered,edited:true,undoRedo:true,reloaded:true});await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,mockedRequests:mocks,checks,errors,blocked},null,2));
 console.log(JSON.stringify(checks,null,2));
}finally{await browser.close();}
