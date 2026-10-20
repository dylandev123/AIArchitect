// Offline DEV harness, real production renderer. No provider/project access.
import { createRequire } from 'node:module';
import { mkdirSync,writeFileSync } from 'node:fs';
const require=createRequire(`${process.env.PLAYWRIGHT_DIR??process.cwd()}/node_modules/`);
const {chromium}=require('playwright');
const output='docs/architecture/architectural-blueprint-pipeline/webgl';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[];
try{
  const page=await browser.newPage({viewport:{width:1600,height:1050}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=new URL(route.request().url());return /\/api\/ai|\/api\/projects/i.test(u.pathname)||/openai|terra/i.test(u.hostname)?(blocked.push(u.origin+u.pathname),route.abort()):route.continue();});
  await page.goto('http://127.0.0.1:3000/dev/architectural-blueprint',{waitUntil:'networkidle',timeout:180000});
  const status=()=>page.getByTestId('pipeline-status').textContent();
  const capture=async(name,expected)=>{
    await page.waitForFunction(s=>document.querySelector('[data-testid="pipeline-status"]')?.textContent?.startsWith(s),expected);
    const canvas=page.locator('canvas');
    let webgl=null;
    if(await canvas.count()){
      await page.waitForFunction(()=>document.querySelector('canvas')?.width>1000);await page.waitForTimeout(1600);
      webgl=await canvas.evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});
      if(!webgl)throw Error(`${name}: missing WebGL context`);
    }
    const path=`${output}/${name}.jpg`;await page.screenshot({path,quality:92});captures.push({name,path,status:await status(),webgl});
  };
  // Visible boundary: independent JSON first, approval second, construction third.
  if(!await page.getByRole('button',{name:'Construct V3',exact:true}).isDisabled())throw Error('Construction enabled before planning');
  await capture('independent-blueprint','Independent');
  for(const name of ['crescent-estate','rotunda','courtyard-house','classical-villa']){
    await page.getByRole('button',{name,exact:true}).click();
    await page.getByRole('button',{name:'Validate blueprint',exact:true}).click();
    if(!(await status()).startsWith('Blueprint approved'))throw Error(await status());
    if(name==='crescent-estate')await capture('approved-before-construction','Blueprint approved');
    await page.getByRole('button',{name:'Construct V3',exact:true}).click();
    await capture(name,'Constructed editable V3');
    if(name==='crescent-estate'){
      await page.getByRole('button',{name:'Move residence +3m',exact:true}).click();await capture('moved-estate','Replanned +3m');
      await page.getByRole('button',{name:'Edit and reload V3',exact:true}).click();await capture('edit-reload','Existing V3 material edit survived');
      await page.getByRole('button',{name:'Toggle interior section',exact:true}).click();await capture('interior-section','Existing V3 material edit survived');
    }
  }
  await page.getByRole('button',{name:'unsupported-roof',exact:true}).click();await page.getByRole('button',{name:'Validate blueprint',exact:true}).click();
  if(!await page.getByRole('button',{name:'Construct V3',exact:true}).isDisabled())throw Error('Rejected architecture enabled construction');
  await capture('unsupported-roof','Planning rejected');
  writeFileSync(`${output}/capture.json`,JSON.stringify({renderer:'Existing production PrimitiveMesh, edge finishing, PBR materials, environment, shadows and PostFx',captures,errors,blockedRequests:blocked},null,2)+'\n');
  console.log(JSON.stringify({captures:captures.length,errors,blockedRequests:blocked}));if(errors.length)process.exitCode=1;
}finally{await browser.close();}
