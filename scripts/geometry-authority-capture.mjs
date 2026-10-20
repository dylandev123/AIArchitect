// Offline DEV fixtures, production WebGL rendering, provider requests blocked.
import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
const require=createRequire(`${process.env.PLAYWRIGHT_DIR??process.cwd()}/node_modules/`);
const {chromium}=require('playwright');
const output='docs/architecture/geometry-authority/webgl';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],captures=[],blocked=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return /\/api\/ai|\/api\/projects/i.test(u.pathname)||/openai|terra/i.test(u.hostname)?(blocked.push(u.origin+u.pathname),route.abort()):route.continue();});
 await page.goto('http://127.0.0.1:3000/dev/geometry-authority',{waitUntil:'networkidle',timeout:180000});
 for(const fixture of ['straight','l-shaped','u-shaped','spiral','spiral-left','roof-deck','blocked','tiny']){
  await page.getByRole('button',{name:fixture,exact:true}).click();
  await page.waitForFunction(f=>document.querySelector('strong')?.textContent?.endsWith(f),fixture);
  await page.waitForFunction(()=>document.querySelector('canvas')?.width>=1000);
  await page.waitForTimeout(1600);
  const status=await page.getByTestId('usability').textContent();
  if(!['blocked','tiny'].includes(fixture)&&!status.startsWith('Usable'))throw new Error(`${fixture}: ${status}`);
  if(['blocked','tiny'].includes(fixture)&&status.startsWith('Usable'))throw new Error(`${fixture} was not rejected`);
  const webgl=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});
  if(!webgl)throw new Error('No WebGL context');
  const path=`${output}/${fixture}.jpg`;await page.screenshot({path,quality:90});captures.push({fixture,path,status,webgl});
 }
 writeFileSync(`${output}/capture.json`,JSON.stringify({renderer:'Production PrimitiveMesh + edge finishing + environment, sun/shadows and PostFx, section at y=3.85m (roof deck y=3.55m)',captures,errors,blockedRequests:blocked},null,2)+'\n');
 console.log(JSON.stringify({captures:captures.length,errors,blockedRequests:blocked}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
