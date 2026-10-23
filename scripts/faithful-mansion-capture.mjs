// Exact recovered design in an isolated production workspace. Never call generation.
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(`${process.env.PLAYWRIGHT_DIR}/node_modules/`),{chromium}=require('playwright');
const source=process.argv[2],out=process.argv[3],root=JSON.parse(readFileSync(source,'utf8'));
if(root.v3Scene?.metadata?.architecturalValidation?.status!=='draft')throw Error('Expected exact mansion draft');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']}),errors=[],blocked=[],captures=[];
try{
  const page=await browser.newPage({viewport:{width:1800,height:1120}}),base=process.env.REPLAY_URL??'http://127.0.0.1:3107';
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',r=>{const u=new URL(r.request().url());return /\/api\/ai|\/api\/projects/.test(u.pathname)||!['127.0.0.1','localhost'].includes(u.hostname)?(blocked.push(u.origin+u.pathname),r.abort()):r.continue();});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(root=>{
    const json=JSON.stringify(root),project={id:'offline-faithful-mansion',name:'Recovered Belvedere House — offline Draft',projectType:'house',generationMode:'v3-scene',v3TerrainMode:'flat',houseConfigJson:json,createdAt:1,updatedAt:1,timeOfDay:'midday',versions:[{id:'offline-original',createdAt:1,summary:'Recovered original mansion',houseConfigJson:json}],currentVersionIndex:0};
    localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[project]},version:6}));
  },root);
  await page.goto(`${base}/workspace/offline-faithful-mansion`,{waitUntil:'networkidle'});
  await page.getByText('Draft — Needs Refinement',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('canvas')?.width>1000);
  const capture=async(name)=>{
    await page.waitForTimeout(1800);
    const webgl=await page.locator('canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');return gl?{width:c.width,height:c.height,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER)}:null;});
    if(!webgl)throw Error('No production WebGL');
    const path=`${out}/${name}.jpg`;await page.screenshot({path,quality:94});captures.push({name,path,webgl});
  };
  await capture('whole-property');
  const canvas=page.locator('canvas'),box=await canvas.boundingBox();
  // Ordinary production orbit controls, without a second renderer or a debug camera hook.
  await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55);
  await page.mouse.down();await page.mouse.move(box.x+box.width*.90,box.y+box.height*.58,{steps:40});await page.mouse.up();
  for(let i=0;i<5;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(90);}
  await capture('ocean-facades-pool-and-guest');
  await page.getByTitle('Full site view',{exact:true}).click();await page.waitForTimeout(1400);
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);for(let i=0;i<10;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(90);}
  await capture('entrances-and-roofs');
  await page.getByTitle('Top-down / plan',{exact:true}).click();await capture('property-plan');
  await page.getByTitle('Full site view',{exact:true}).click();await page.waitForTimeout(1200);
  const saved=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects[0].houseConfigJson));
  if(JSON.stringify(saved.v3Scene)!==JSON.stringify(root.v3Scene))throw Error('Workspace loading changed the saved mansion');
  await page.reload({waitUntil:'networkidle'});
  await page.getByText('Draft — Needs Refinement',{exact:true}).waitFor();await capture('reloaded-mansion-draft');
  const reloaded=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects[0].houseConfigJson));
  if(JSON.stringify(saved)!==JSON.stringify(reloaded))throw Error('Reload changed persisted construction');
  // Exercise the ordinary production editor and persistence after the original
  // five captures; only this temporary browser project receives the finish edit.
  const edited=structuredClone(reloaded);
  edited.v3Scene.objects.find(o=>o.id==='guest-pavilion').material.color='#514d47';
  await page.locator('textarea').first().fill(JSON.stringify(edited));
  await page.waitForFunction(()=>{
    const p=JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects[0];
    return JSON.parse(p.houseConfigJson).v3Scene.objects.find(o=>o.id==='guest-pavilion').material.color==='#514d47';
  });
  await page.getByRole('button',{name:'Revalidate construction',exact:true}).click();
  await page.waitForFunction(()=>{
    const p=JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects[0];
    return p.versions.length===2&&p.versions.at(-1).houseConfigJson===p.houseConfigJson;
  });
  await capture('workspace-finish-edited');
  await page.reload({waitUntil:'networkidle'});
  await page.getByText('Draft — Needs Refinement',{exact:true}).waitFor();
  const editedReload=await page.evaluate(()=>JSON.parse(JSON.parse(localStorage.getItem('ai-architect-projects')).state.projects[0].houseConfigJson));
  if(editedReload.v3Scene.objects.find(o=>o.id==='guest-pavilion').material.color!=='#514d47')throw Error('Production finish edit did not persist');
  const geometry=s=>JSON.stringify([s.objects.map(o=>[o.id,o.architecture,o.composition,o.levels]),s.interior,s.estatePlan]);
  if(geometry(editedReload.v3Scene)!==geometry(root.v3Scene))throw Error('Finish edit changed architectural geometry');
  await capture('workspace-edited-reloaded');
  writeFileSync(`${out}/capture.json`,JSON.stringify({runtime:'next start (optimized production build)',input:source,inputSha256:createHash('sha256').update(readFileSync(source)).digest('hex'),renderer:'Ordinary production workspace, PrimitiveMesh, PBR, edge detail, lighting and PostFx',providerCalls:0,isolatedStorage:true,reloadIdentical:true,workspaceEdit:{finish:'#514d47',revalidationVersionConsistent:true,reloadPreserved:true,architecturalGeometryUnchanged:true},objects:root.v3Scene.objects.map(o=>o.id),captures,errors,blockedRequests:blocked},null,2)+'\n');
  console.log(JSON.stringify({captures:captures.length,errors,blocked}));
  if(errors.length||blocked.length)process.exitCode=1;
}finally{await browser.close();}
