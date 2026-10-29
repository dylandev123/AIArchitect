import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const dir='docs/villa-playground/scene-operations',errors=[],blocked=[],checks=[];
const base=process.env.SCENE_PROOF_URL||'http://localhost:3005';
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto(`${base}/dev/villa-playground?scene=ladera`,{waitUntil:'networkidle',timeout:120000});
 await page.waitForTimeout(9000);
 for(const v of ['Poolside','Arrival','Aerial','Garden']){await page.getByRole('button',{name:v,exact:true}).click();await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/ladera-${v.toLowerCase()}.png`});}
 await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(1800);
 const read=()=>page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const parts=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))parts.push({name:o.name,uuid:o.uuid,at:o.position.toArray()});});return parts;}h=h.next;}f=f.return;}return [];});
 const before=await read();assert(before.length>50);
 await page.getByRole('button',{name:'Extend suite roof',exact:true}).click();await page.getByRole('button',{name:'Slide privacy screen',exact:true}).click();await page.waitForTimeout(1500);
 const after=await read();assert.equal(before.length,after.length);assert(before.every((p,i)=>p.uuid===after[i].uuid));assert.deepEqual(after.find(p=>p.name==='operation:suite-screen').at,[3.8,6.5,1.3]);
 await page.screenshot({path:`${dir}/ladera-edited.png`});checks.push({before,after,stableObjectIds:true});
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).find(p=>p.name==='operation:suite-screen').at,[-3.4,6.5,1.3]);
 await page.getByLabel('Comparison',{exact:true}).selectOption('solana');await page.waitForTimeout(2500);await page.screenshot({path:`${dir}/solana-poolside.png`});
 for(const id of ['angular-volumes-before','branching-levels-before']){
 await page.goto(`${base}/dev/villa-playground?offline=${id}`,{waitUntil:'networkidle',timeout:120000});await page.waitForTimeout(5000);await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/${id}.png`});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({errors,blocked,providerCalls:0,checks},null,2));
}finally{await browser.close();}
