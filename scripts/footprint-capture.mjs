import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??'/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir=process.env.CAPTURE_DIR??'/private/tmp/footprint-browser';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],aiRequests=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});page.on('pageerror',e=>errors.push(String(e)));await page.route('**/api/ai/**',r=>{aiRequests.push(r.request().url());return r.abort();});
 for(const id of ['ocean-arc','asymmetric-crescent','articulated-house']){
  await page.goto(`${process.env.VILLA_URL??'http://localhost:3000/dev/villa-playground'}?composition=${id}`,{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);await page.waitForTimeout(5000);
  const inspect=async()=>page.locator('canvas').evaluate(canvas=>{
   let f=canvas[Object.keys(canvas).find(k=>k.startsWith('__reactFiber$'))];
   while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){let meshes=0,finite=true;const forms=[],plates=[];s.scene.traverse(o=>{if(o.name.startsWith('Footprint building'))forms.push(o.name);if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);if(o.name.startsWith('footprint-'))plates.push({name:o.name,position:o.position.toArray(),vertices:a?.count});}});return {meshes,finite,forms,plates,postprocessCalls:s.gl.info.render.calls};}h=h.next;}f=f.return;}return null;
  });
  const data=await inspect();assert(data?.finite&&data.forms.length===1,JSON.stringify({data,errors}));
  for(const view of ['Poolside','Above','Garden']){await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1800);await page.screenshot({path:`${dir}/${id}-${view.toLowerCase()}.png`});}
  const measurement=page.evaluate(()=>new Promise(resolve=>{const samples=[];let prior=performance.now();function frame(now){samples.push(now-prior);prior=now;if(samples.length<90)requestAnimationFrame(frame);else{samples.sort((a,b)=>a-b);resolve({medianFrameMs:samples[45],p95FrameMs:samples[85]});}}requestAnimationFrame(frame);}));
  await page.mouse.move(1100,650);await page.mouse.down();await page.mouse.move(1200,700,{steps:30});await page.mouse.up();
  const perf=await measurement;
  checks.push({id,...data,...perf,orbitDragCompleted:true});console.log(id,JSON.stringify(checks.at(-1)));
 }
 for(const label of ['Modern Contemporary','Caribbean Tropical','Spanish Hacienda','Tuscan Estate','Compact L','Courtyard U','Pavilion estate']){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(700);}
 await page.getByRole('button',{name:'Solana original',exact:true}).click();await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/solana-preserved.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(aiRequests,[]);writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({errors,aiRequests,checks},null,2));
}finally{await browser.close();}
