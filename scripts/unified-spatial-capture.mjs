// Offline recovered fixtures only. No project writes or provider calls.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(`${process.env.PLAYWRIGHT_DIR??process.cwd()}/node_modules/`);
const {chromium}=require('playwright');
const output='docs/architecture/unified-spatial/webgl';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],captures=[],blocked=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(/\/api\/ai/i.test(u.pathname)||/openai|terra/i.test(u.hostname)){blocked.push(u.origin+u.pathname);return route.abort();}return route.continue();});
 for(const [estate,attempt,views] of [
  ['canopy',0,['overview']],['canopy',1,['overview']],
  ['cloister',0,['plan','pavilions','arrival']],['cloister',1,['plan','pavilions']],
  ['corrected',1,['plan','pavilions','arrival']],
 ]){
  await page.goto(`http://localhost:3000/dev/mansion-failure?estate=${estate}&attempt=${attempt}`,{waitUntil:'networkidle',timeout:180000});
  await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c&&c.width>=1000&&c.height>=700;},{},{timeout:45000});
  for(const view of views){
   await page.getByRole('button',{name:view,exact:true}).click();
   await page.waitForFunction(v=>document.querySelector('strong')?.textContent?.endsWith(v),view);
   await page.waitForFunction(()=>document.querySelector('canvas')?.width>=1000);
   await page.waitForTimeout(1800);
   const webgl=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});
   if(!webgl)throw new Error('No WebGL context');
   const path=`${output}/${estate}-${attempt}-${view}.jpg`;
   await page.screenshot({path,quality:88});captures.push({path,webgl});
  }
 }
 writeFileSync(`${output}/capture.json`,JSON.stringify({renderer:'Production PrimitiveMesh, edge detail, Sky, SceneEnvironment, SunLight, PostFx on dev-only offline fixture page',captures,errors,blockedProviderRequests:blocked},null,2)+'\n');
 console.log(JSON.stringify({captures:captures.length,errors,blockedProviderRequests:blocked}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
