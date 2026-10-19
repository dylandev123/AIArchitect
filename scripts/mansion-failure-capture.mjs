// Offline fixture only; provider endpoints are blocked in the browser.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(`${process.env.PLAYWRIGHT_DIR??process.cwd()}/node_modules/`);
const {chromium}=require('playwright');
const out=process.env.MANSION_CAPTURE_OUTPUT??'docs/architecture/mansion-failure/webgl';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],captures=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const url=new URL(route.request().url());return /\/api\/ai/i.test(url.pathname)||/openai|terra/i.test(url.hostname)?route.abort():route.continue();});
 for(const attempt of [0,1]){
  await page.goto(`http://localhost:3000/dev/mansion-failure?attempt=${attempt}`,{waitUntil:'networkidle',timeout:180000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);
  for(const view of (process.env.MANSION_CAPTURE_VIEWS??'overview,arrival,pool,plan,recess,section').split(',')){
   await page.getByRole('button',{name:view,exact:true}).click();
   await page.waitForTimeout(1800);
   const path=`${out}/attempt-${attempt}-${view}.jpg`;
   await page.screenshot({path,quality:88});captures.push(path);
  }
 }
 writeFileSync(`${out}/capture.json`,JSON.stringify({captures,errors},null,2));
 console.log(JSON.stringify({captures,errors}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
