/** Local Studio UI verification. Network permits only local UI and offline stage requests. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl']});
const dir='docs/architecture/prompt-staged-generation';
const scene=JSON.parse(readFileSync(`${dir}/compact.scene.json`,'utf8'));
const json=JSON.stringify(scene),id='offline-prompt-studio';
const project={id,name:'Offline prompt Studio test',projectType:'house',generationMode:'direct-scene',createdAt:1,updatedAt:1,houseConfigJson:json,versions:[{id:'initial',createdAt:1,summary:'Offline test baseline',houseConfigJson:json}],currentVersionIndex:0};
const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[],apiRequests=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.addInitScript(()=>{window.__promptWebglLost=false;document.addEventListener('webglcontextlost',()=>{window.__promptWebglLost=true;},true);});
await page.route('**/*',r=>{
 const u=new URL(r.request().url());
 if(!['localhost','127.0.0.1'].includes(u.hostname))return r.abort();
 if(u.pathname.startsWith('/api/')){
  apiRequests.push({path:u.pathname,method:r.request().method()});
  if(u.pathname==='/api/dev/staged-generation')return r.continue();
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({catalog:[],queue:[],glbIds:[]})});
 }
 return r.continue();
});
try{
 await page.goto('http://localhost:3015');
 await page.evaluate(p=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[p]},version:0})),project);
 await page.goto(`http://localhost:3015/workspace/${id}`);
 await page.getByText('Prompt-driven staged generation',{exact:true}).waitFor({timeout:120000});
 for(const [index,name] of ['compact','spanish','estate'].entries()){
  await page.getByRole('button',{name:`Offline sample ${index+1}:`,exact:false}).click();
  await page.getByRole('button',{name:'Start offline prompt test',exact:true}).click();
  await page.getByText('Design direction accepted.',{exact:false}).waitFor();
  for(const stage of ['Massing','Room programme','Exterior','Materials and grounds']){
   await page.getByRole('button',{name:'Continue next stage',exact:true}).click();
   await page.getByText(`${stage} accepted.`,{exact:false}).waitFor();
  }
  await page.getByRole('button',{name:'Inspect Massing',exact:true}).click();
  await page.getByRole('button',{name:'Inspect Materials and grounds',exact:true}).click();
  await page.getByRole('button',{name:'Save prompt-generated mock house',exact:true}).click();
  await page.getByText('Saved editable scene and staged source',{exact:false}).waitFor();
  const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('ai-architect-projects')));
  const p=stored.state.projects.find(p=>p.id===id),version=p.versions[p.currentVersionIndex];
  const expected=JSON.parse(readFileSync(`${dir}/${name}.scene.json`,'utf8'));
  assert.deepEqual(JSON.parse(version.houseConfigJson).elements,expected.elements);
  assert.match(version.stagedStudio.brief,new RegExp(['three-bedroom','four bedrooms','six-bedroom'][index]));
  assert.equal(await page.locator('canvas').count(),1);
  assert.equal(await page.evaluate(()=>window.__promptWebglLost),false);
  await page.screenshot({path:`${dir}/${name}.studio.png`});
  await page.reload();
  await page.getByRole('button',{name:'Reopen saved staged source',exact:true}).click();
  await page.getByText('Reopened editable staged source',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Reset prompt run',exact:true}).click();
 }
 assert.deepEqual(errors,[]);
 assert(!apiRequests.some(p=>p.path.startsWith('/api/ai/')&&p.method!=='GET'),'No AI mutation route may be requested by the mock browser flow');
 writeFileSync(`${dir}/browser.json`,JSON.stringify({passed:true,cases:['compact','spanish','estate'],flow:['stages 1–5','inspect massing','inspect finished','save exact scene and editable source','reload','reopen'],pageErrors:errors,webglContextLoss:false,offlineStageRequests:apiRequests.filter(p=>p.path==='/api/dev/staged-generation').length,paidCalls:0},null,2));
 console.log('Three prompt Studio workflows passed');
}finally{await browser.close();}
