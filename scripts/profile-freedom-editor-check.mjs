/** Actual studio edit/export/reload. All API and external resources blocked. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH ?? '/private/tmp/claude-501/-Users-dylandevaux-Desktop-co-villa-cash/764eb911-b629-4498-8e93-253cd2495a7b/scratchpad/pw/node_modules/playwright-core');
const dir='docs/architecture/profile-freedom',original=JSON.parse(readFileSync(`${dir}/flowing.DEVELOPER.json`,'utf8'));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new','--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname.startsWith('/api/')){blocked.push(u.href);return r.abort();}return r.continue();});
 await page.goto('http://127.0.0.1:3015/dev/villa-playground',{waitUntil:'networkidle',timeout:120000});
 await page.getByLabel('Import scene JSON',{exact:true}).setInputFiles(resolve(`${dir}/flowing.DEVELOPER.json`));
 await page.getByLabel('Element',{exact:true}).selectOption('courtyard-roof');
 await page.getByText('Profile vertices and curves',{exact:true}).click();
 const geometry={...original.elements.find(e=>e.id==='courtyard-roof').geometry,innerRatio:.55,segments:32};
 await page.getByLabel('Profile geometry',{exact:true}).fill(JSON.stringify(geometry));await page.getByRole('button',{name:'Apply profile',exact:true}).click();
 await page.getByLabel('Position x',{exact:true}).fill('0.5');
 await page.getByLabel('Width',{exact:true}).fill('26');
 await page.getByLabel('Element rotation',{exact:true}).fill('0.15');
 await page.getByLabel('Element color',{exact:true}).fill('#a65932');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export scene JSON',exact:true}).click();const download=await downloadPromise;
 const exported=JSON.parse(readFileSync(await download.path(),'utf8')),target=exported.elements.find(e=>e.id==='courtyard-roof');
 assert.deepEqual(target.geometry,geometry);assert.equal(target.at[0],.5);assert.equal(target.size[0],26);assert.equal(target.rotation,.15);assert.equal(target.color,'#a65932');
 assert.deepEqual(exported.elements.filter(e=>e.id!=='courtyard-roof'),original.elements.filter(e=>e.id!=='courtyard-roof'));
 assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('terra-direct-scene-1'))),exported);
 await page.reload({waitUntil:'networkidle'});await page.getByLabel('Element',{exact:true}).selectOption('courtyard-roof');
 assert.equal(await page.getByLabel('Position x',{exact:true}).inputValue(),'0.5');assert.equal(await page.getByLabel('Width',{exact:true}).inputValue(),'26');
 assert.equal(await page.getByLabel('Element color',{exact:true}).inputValue(),'#a65932');
 assert.deepEqual(errors,[]);writeFileSync(`${dir}/studio-edited.json`,JSON.stringify(exported,null,2));
 writeFileSync(`${dir}/studio.browser-result.json`,JSON.stringify({providerCalls:0,errors,blocked,imported:original.elements.length,unchangedSiblings:original.elements.length-1,edited:target,exportAndLocalStorageMatch:true,reloadVerified:true},null,2));
}finally{await browser.close();}
