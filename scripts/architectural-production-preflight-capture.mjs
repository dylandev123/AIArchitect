// Isolated offline browser; production meshes/materials/PostFx. No provider/project requests.
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const productionRoot=JSON.parse(readFileSync(process.env.ARCHITECTURAL_PREFLIGHT_SCENE,'utf8'));
if(productionRoot.v3Scene?.metadata?.architecturalValidation?.status!=='draft')throw Error('Expected actual route draft artifact');
const require=createRequire(`${process.env.PLAYWRIGHT_DIR??process.cwd()}/node_modules/`);
const {chromium}=require('playwright');
const productionRuntime=process.env.ARCHITECTURAL_PREFLIGHT_RUNTIME==='production';
const baseUrl=process.env.ARCHITECTURAL_PREFLIGHT_URL??'http://127.0.0.1:3000';
const output=`docs/architecture/architectural-blueprint-pipeline/final-preflight${productionRuntime?'-production':''}-webgl`;mkdirSync(output,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],captures=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1050}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',route=>{const u=new URL(route.request().url());return /\/api\/ai|\/api\/projects/i.test(u.pathname)||/openai|terra/i.test(u.hostname)?(blocked.push(u.origin+u.pathname),route.abort()):route.continue();});
  const workspaceCapture=async(name)=>{
    const webgl=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});
    if(!webgl)throw Error('Missing workspace WebGL context');
    const path=`${output}/${name}.jpg`;await page.screenshot({path,quality:92});
    const state=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects[0].houseConfigJson).v3Scene.metadata.architecturalValidation);
    captures.push({name,path,webgl,status:state.status,diagnostics:state.diagnostics.map(f=>({code:f.code,targetIds:f.targetIds}))});
  };
  if(!productionRuntime){
  await page.goto(baseUrl+'/dev/architectural-blueprint',{waitUntil:'networkidle',timeout:180000});
  await page.getByRole('button',{name:'draft-door',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="fixture"]')?.textContent==='draft-door');
  await page.getByRole('button',{name:'Validate blueprint',exact:true}).click();
  await page.waitForFunction(()=>/^(Blueprint approved|Planning rejected)/.test(document.querySelector('[data-testid="pipeline-status"]')?.textContent??''));
  if(await page.getByRole('button',{name:'Construct V3',exact:true}).isDisabled())throw Error(await page.getByTestId('pipeline-status').textContent());
  await page.getByRole('button',{name:'Construct V3',exact:true}).click();
  const capture=async(name,expected)=>{
    await page.waitForFunction(()=>document.querySelector('canvas')?.width>1000);
    await page.waitForTimeout(2000);
    const status=await page.getByTestId('pipeline-status').textContent();if(!status.startsWith(expected))throw Error(status);
    const webgl=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});
    if(!webgl)throw Error('Missing production WebGL context');
    const path=`${output}/${name}.jpg`;await page.screenshot({path,quality:92});captures.push({name,path,status,webgl});
  };
  await capture('draft-estate','Draft — Needs Refinement');
  await page.getByRole('button',{name:'Reload editable draft',exact:true}).click();await capture('draft-reloaded','Draft — Needs Refinement');
  await page.getByRole('button',{name:'Toggle interior section',exact:true}).click();await capture('draft-interior','Draft — Needs Refinement');
  // Section mode changes the fixture label; repairs still act on the current scene.
  await page.getByRole('button',{name:'draft-door',exact:true}).click();
  await page.getByRole('button',{name:'Validate blueprint',exact:true}).click();await page.getByRole('button',{name:'Construct V3',exact:true}).click();
  await page.getByRole('button',{name:'Repair draft door',exact:true}).click();await capture('promoted-complete','Complete:');
  // Also verify the actual workspace label, semantic inspector and project-store
  // persistence in this isolated browser context, never the user's browser.
  await page.evaluate(()=>{
    const scene=JSON.parse(localStorage.getItem('ai-architect-offline-draft-proof'));
    const json=JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:scene});
    const project={id:'offline-draft-ui-proof',name:'Offline draft UI proof',projectType:'house',generationMode:'v3-scene',v3TerrainMode:'flat',houseConfigJson:json,createdAt:Date.now(),updatedAt:Date.now(),versions:[{id:'offline-version',createdAt:Date.now(),summary:'Draft — Needs Refinement',houseConfigJson:json}],currentVersionIndex:0};
    localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[project]},version:6}));
  });
  await page.goto(baseUrl+'/workspace/offline-draft-ui-proof',{waitUntil:'networkidle',timeout:180000});
  await page.getByText('Draft — Needs Refinement',{exact:true}).waitFor();
  await page.waitForTimeout(2000);
  await workspaceCapture('workspace-draft');
  await page.getByText(/^Object diagnostics \(/).click();
  await page.getByRole('button',{name:'service-door',exact:true}).first().click();
  await page.getByRole('button',{name:/Advanced Properties/}).click();
  await page.getByRole('spinbutton',{name:'Door offset',exact:true}).fill('3');
  await page.getByText('Complete',{exact:true}).waitFor();
  await workspaceCapture('workspace-repaired');
  await page.reload({waitUntil:'networkidle'});
  await page.getByText('Complete',{exact:true}).waitFor();
  await workspaceCapture('workspace-reloaded-complete');
  }else{await page.goto(baseUrl,{waitUntil:'networkidle'});}
  // Load the ordinary JSON returned by the actual production route/SDK test.
  await page.evaluate(root=>{
    const json=JSON.stringify(root),project={id:'offline-production-estate',name:'Production route luxury-estate draft',projectType:'house',generationMode:'v3-scene',v3TerrainMode:'flat',houseConfigJson:json,createdAt:Date.now(),updatedAt:Date.now(),versions:[{id:'route-version',createdAt:Date.now(),summary:'Draft — Needs Refinement',houseConfigJson:json}],currentVersionIndex:0};
    localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[project]},version:6}));
  },productionRoot);
  await page.goto(baseUrl+'/workspace/offline-production-estate',{waitUntil:'networkidle'});
  await page.getByText('Draft — Needs Refinement',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas')?.width>1000);
  await page.waitForTimeout(2500);
  await workspaceCapture('production-route-combined-draft');
  await page.reload({waitUntil:'networkidle'});
  await page.getByText('Draft — Needs Refinement',{exact:true}).waitFor();
  await page.waitForTimeout(2000);
  await workspaceCapture('production-route-combined-reloaded');
  writeFileSync(`${output}/capture.json`,JSON.stringify({runtime:productionRuntime?'next start (optimized build)':'next dev',renderer:'Production PrimitiveMesh/PBR, edge detail, lighting and PostFx',captures,errors,blockedRequests:blocked},null,2)+'\n');
  console.log(JSON.stringify({captures:captures.length,errors,blockedRequests:blocked}));if(errors.length)process.exitCode=1;
}catch(e){console.error(JSON.stringify({errors,blockedRequests:blocked}));throw e;}finally{await browser.close();}
