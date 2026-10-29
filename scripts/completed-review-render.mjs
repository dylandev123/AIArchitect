import {createRequire} from 'node:module';import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/completed-review',after=process.argv.includes('--after'),name=after?'after':'before';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
try{const page=await browser.newPage({viewport:{width:800,height:650}}),errors=[],blocked=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.pathname);return r.abort();}return r.continue();});
await page.goto('http://localhost:3000/dev/villa-playground/completed-review-capture'+(after?'?after=1':''),{waitUntil:'domcontentloaded',timeout:60000});console.log('Isolated preview loaded');
await page.waitForFunction(()=>document.querySelector('#done')?.textContent==='Complete'||document.querySelector('#capture-error')?.textContent,null,{timeout:60000});
assert.equal(await page.locator('#capture-error').textContent(),'');const shots=JSON.parse(await page.locator('#captures').textContent());assert.equal(shots.length,3);
writeFileSync(`${dir}/${name}-captures.json`,JSON.stringify(shots,null,2));for(const s of shots)writeFileSync(`${dir}/${name}-${s.view.toLowerCase()}.png`,Buffer.from(s.image.split(',')[1],'base64'));

writeFileSync(`${dir}/${name}-render-checks.json`,JSON.stringify({errors,blocked,providerCalls:0},null,2));assert.deepEqual(errors,[]);assert(blocked.every(p=>p==='/api/assets'));console.log('Retained '+name+' renders; zero API calls.');
}finally{await browser.close();}
