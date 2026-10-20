// Offline proof through the actual production WebGL renderer; all AI/project API access is blocked.
import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
const require=createRequire(`${process.env.PLAYWRIGHT_DIR??process.cwd()}/node_modules/`);
const {chromium}=require('playwright');
const output='docs/architecture/architectural-blueprint-pipeline/full-property-webgl';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[];
try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=new URL(route.request().url());return /\/api\/ai|\/api\/projects/i.test(u.pathname)||/openai|terra/i.test(u.hostname)?(blocked.push(u.origin+u.pathname),route.abort()):route.continue();});
  await page.goto('http://127.0.0.1:3000/dev/architectural-blueprint',{waitUntil:'networkidle',timeout:180000});
  const capture=async(name)=>{
    await page.waitForFunction(()=>document.querySelector('canvas')?.width>1000);await page.waitForTimeout(1800);
    const canvas=page.locator('canvas'),webgl=await canvas.evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});
    if(!webgl)throw Error('Missing production WebGL context');
    const path=`${output}/${name}.jpg`;await page.screenshot({path,quality:92});captures.push({name,path,status:await page.getByTestId('pipeline-status').textContent(),webgl});
  };
  await page.getByRole('button',{name:'full-property',exact:true}).click();
  await page.getByRole('button',{name:'Validate blueprint',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="pipeline-status"]')?.textContent?.startsWith('Blueprint approved'));
  await page.getByRole('button',{name:'Construct V3',exact:true}).click();await capture('estate');
  for(const view of ['balcony','portico','outdoor']){await page.getByRole('button',{name:`${view} view`,exact:true}).click();await capture(view);}
  await page.getByRole('button',{name:'estate view',exact:true}).click();
  await page.getByRole('button',{name:'Move residence +3m',exact:true}).click();await capture('host-edit');
  await page.getByRole('button',{name:'Edit and reload V3',exact:true}).click();await capture('material-reload');
  await page.getByRole('button',{name:'Toggle interior section',exact:true}).click();await capture('interior');
  writeFileSync(`${output}/capture.json`,JSON.stringify({renderer:'Production PrimitiveMesh, PBR/edge finishing, environment, shadows and PostFx',captures,errors,blockedRequests:blocked},null,2)+'\n');
  console.log(JSON.stringify({captures:captures.length,errors,blockedRequests:blocked}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
