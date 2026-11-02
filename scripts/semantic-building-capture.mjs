import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const experimental=process.argv.includes('--semantic-generation');
const dir=experimental?'docs/architecture/semantic-generation':'docs/architecture/semantic-building-proof';
const snapshot=async page=>await page.locator('canvas').evaluate(c=>{
 let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
 while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const elements=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))elements.push({id:o.name.slice(10),at:o.position.toArray(),rotation:o.rotation.y});});return {elements,camera:s.camera.position.toArray(),contextLost:s.gl.getContext().isContextLost()};}h=h.next;}f=f.return;}throw Error('R3F state missing');});
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
try{
 const captures=[];
 for(const name of experimental?['family','luxury']:['estate','compact']){
 const page=await browser.newPage({viewport:{width:1600,height:1150}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());return !['localhost','127.0.0.1'].includes(u.hostname)||u.pathname.startsWith('/api/')?r.abort():r.continue();});
 await page.goto(experimental?'http://127.0.0.1:3015/dev/semantic-generation':`http://127.0.0.1:3015/dev/semantic-building?case=${name}`,{waitUntil:'networkidle',timeout:120000});
 if(experimental){await page.getByRole('button',{name:name==='family'?'Family mock':'Luxury mock',exact:true}).click();await page.getByRole('button',{name:'Construct planning response',exact:true}).click();}
 await page.locator('canvas').waitFor({timeout:60000});
 const scene=JSON.parse(readFileSync(`${dir}/${name}.scene.json`,'utf8'));
 for(const view of ['Arrival','Aerial','Garden','Poolside']){
 await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(2200);
 const rendered=await snapshot(page);
 assert.equal(rendered.contextLost,false);assert.deepEqual(rendered.elements.map(e=>e.id).sort(),scene.elements.map(e=>e.id).sort());
 for(const e of rendered.elements){const original=scene.elements.find(o=>o.id===e.id);assert.deepEqual(e.at,original.at);assert.equal(e.rotation,original.rotation);}
 const png=await page.locator('canvas').evaluate(c=>c.toDataURL('image/png').split(',')[1]);writeFileSync(`${dir}/${name}.${view.toLowerCase()}.png`,Buffer.from(png,'base64'));captures.push({name,view,...rendered});
 }
 if(experimental){
  const before=await snapshot(page),proposal=JSON.parse(await page.getByLabel('Semantic planning response',{exact:true}).inputValue());
  proposal.intent.portals.find(p=>p.id==='front-door').offset+=.15;
  await page.getByLabel('Semantic planning response',{exact:true}).fill(JSON.stringify(proposal));
  await page.getByRole('button',{name:'Apply explicit revision',exact:true}).click();await page.waitForTimeout(500);
  const after=await snapshot(page);assert.notDeepEqual(after.elements.find(e=>e.id==='front-door'),before.elements.find(e=>e.id==='front-door'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(500);assert.deepEqual((await snapshot(page)).elements,before.elements);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForTimeout(500);assert.deepEqual((await snapshot(page)).elements,after.elements);
  await page.getByRole('button',{name:'Save checkpoint locally',exact:true}).click();
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Reload checkpoint',exact:true}).click();await page.locator('canvas').waitFor();await page.waitForTimeout(1000);
  assert.deepEqual((await snapshot(page)).elements,after.elements);
  const unsupported={status:'decision-required',decisions:['Requested curved roof needs an unsupported design representation.']};
  await page.getByLabel('Semantic planning response',{exact:true}).fill(JSON.stringify(unsupported));await page.getByRole('button',{name:'Apply explicit revision',exact:true}).click();
  await page.getByText(unsupported.decisions[0],{exact:true}).waitFor();assert.deepEqual((await snapshot(page)).elements,after.elements);
  captures.push({name,lifecycle:'revision, actual project Undo/Redo, save, full-page reload, unsupported decision preserves geometry',passed:true});
 }
 assert.deepEqual(errors,[]);
 const drawings=experimental?['plan-ground','plan-upper','section']:name==='compact'?['plan-street','plan-sleep','section']:['plan-garden-datum','section'];
 for(const drawing of drawings){await page.setContent(readFileSync(`${dir}/${name}.${drawing}.svg`,'utf8'));await page.locator('svg').screenshot({path:`${dir}/${name}.${drawing}.png`});}
 await page.close();
 }
 writeFileSync(`${dir}/browser-result.json`,JSON.stringify({providerCalls:0,errors:[],captures},null,2));
}finally{await browser.close();}
