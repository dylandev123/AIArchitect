import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[];
try{
 const page=await browser.newPage({viewport:{width:1500,height:1100}});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto('http://127.0.0.1:3000/dev/villa-playground?composition=freedom-sky',{waitUntil:'networkidle',timeout:120000});
 await page.getByRole('button',{name:'Customize this villa',exact:true}).click();
 await page.getByText('Experimental building library · offline',{exact:true}).click();
 await page.getByRole('button',{name:'Snapshot building',exact:true}).click();
 const field=page.getByRole('textbox',{name:'Architectural candidate JSON'}),first=JSON.parse(await field.inputValue());assert.equal(first.version,1);assert.equal(first.form.levels.length,4);
 await page.getByRole('button',{name:'Save private version',exact:true}).click();
 assert(await page.evaluate(()=>Object.keys(localStorage).some(k=>k==='villa-architecture:sky-court@1')));
 first.form.material='sand';await field.fill(JSON.stringify(first));await page.getByRole('button',{name:'Save private version',exact:true}).click();
 await page.getByText('Error: This version already exists. Create a new snapshot version.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Snapshot building',exact:true}).click();const second=JSON.parse(await field.inputValue());assert.equal(second.version,2);
 await page.getByRole('button',{name:'Preview on selected building',exact:true}).click();await page.getByRole('button',{name:'Apply preview',exact:true}).waitFor();
 console.log('Preview staged');
 for(const view of ['Arrival','Aerial','Poolside']){
  await page.getByLabel('Review view',{exact:true}).selectOption(view);
  await page.getByRole('button',{name:'Capture this view · offline',exact:true}).click();
  const retain=page.getByRole('button',{name:'Retain reviewed capture',exact:true});await retain.waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Retain reviewed capture'&&!b.disabled));await retain.click();console.log('Retained',view);
 }
 const reviewed=JSON.parse(await field.inputValue());assert.equal(reviewed.status,'reviewed');assert.equal(reviewed.evidence.length,3);
 await page.getByRole('button',{name:'Save private version',exact:true}).click();
 await page.getByRole('button',{name:'Apply preview',exact:true}).click();
 await page.getByText('Applied through the existing validated editing executor.',{exact:true}).waitFor();
 await page.screenshot({path:'docs/villa-playground/architectural-freedom/library-workflow.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync('docs/villa-playground/architectural-freedom/library-checks.json',JSON.stringify({providerCalls:0,errors,blocked,checks:['snapshot preserves four independent upper volumes','immutable version overwrite rejected','new version increments','validated local preview','three existing bounded captures retained after manual review','reviewed snapshot saved','applied using existing executor']},null,2));
 writeFileSync('docs/villa-playground/architectural-freedom/reviewed-building.architecture.json',JSON.stringify(reviewed,null,2));console.log('Offline building library passed');
}finally{await browser.close();}
