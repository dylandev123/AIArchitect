// Offline acceptance: production PrimitiveMesh, lighting and PostFx. No generation calls.
// PLAYWRIGHT_DIR points to an existing Playwright installation.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(`${process.env.PLAYWRIGHT_DIR??process.cwd()}/node_modules/`);
const {chromium}=require('playwright');
const out=process.argv[2]??'docs/architecture/parity/nonrectangular';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const results=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>/\/api\/ai|openai|terra/i.test(route.request().url())?(errors.push(`Blocked provider request: ${route.request().url()}`),route.abort()):route.continue());
 for(const fixture of ['l-residence','u-courtyard','chamfered']){
  await page.goto(`${process.env.PARITY_URL??'http://localhost:3000'}/dev/nonrectangular?fixture=${fixture}`,{waitUntil:'networkidle',timeout:180000});
  await page.waitForFunction(()=>document.querySelector('canvas')?.width>0);
  for(const view of ['overview','plan','section','facade']){
   await page.getByRole('button',{name:view,exact:true}).click();
   await page.waitForTimeout(4000);
   await page.screenshot({path:`${out}/${fixture}-${view}.jpg`,quality:88});
  }
  results.push({fixture,summary:await page.locator('p').last().textContent()});
  if(fixture==='l-residence'){
   await page.getByRole('button',{name:'overview',exact:true}).click();
   await page.getByRole('button',{name:'Edit footprint',exact:true}).click();
   await page.waitForTimeout(4000);
   await page.screenshot({path:`${out}/${fixture}-edited.jpg`,quality:88});
  }
 }
 writeFileSync(`${out}/capture.json`,JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({results,errors}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
