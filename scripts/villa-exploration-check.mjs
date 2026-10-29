import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const dir='docs/villa-playground/unobstructed', errors=[],results=[];let aiRequests=0;
const cases=[['retained-estate','?response=6d31056837d287b9b8ea01707a43bcc6db1bc39dd36fccb668a52ebb32429f5d'],['ocean-crescent','?response=8100bca24525c07e1319837d172478ea71557c45a367dc1d49b99a4bbd6a6483'],['solana',''],['family','?composition=family-breeze']].filter(([id])=>!process.env.VILLA_CASE || process.env.VILLA_CASE===id);
async function inspect(page) {
 return page.locator('canvas').evaluate(c=>{
  let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
  while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const names=[];s.scene.traverse(o=>{if(o.isGroup&&o.name)names.push(o.name)});const camera=s.camera;const root=s.scene.getObjectByName('Property architecture');
 const projected={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
 if(root) root.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;if(!b)return;
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
 const v=o.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld).project(camera);
 projected.minZ=Math.min(projected.minZ,v.z);projected.maxZ=Math.max(projected.maxZ,v.z);
 projected.minX=Math.min(projected.minX,v.x);projected.maxX=Math.max(projected.maxX,v.x);projected.minY=Math.min(projected.minY,v.y);projected.maxY=Math.max(projected.maxY,v.y);
 }});return {projected,names,position:camera.position.toArray(),aspect:camera.aspect,meshes:(()=>{let n=0;s.scene.traverse(o=>{if(o.isMesh)n++});return n})()};}h=h.next;}f=f.return;}return null;
 });
}
async function authored(page){return page.locator('main').evaluate(el=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f){if(f.type?.name==='VillaPlayground'){let h=f.memoizedState;while(h){if(h.memoizedState?.version===1)return JSON.stringify(h.memoizedState);h=h.next;}}f=f.return;}return null;});}
try{
 for(const mobile of [false,true].filter(value=>!process.env.VILLA_VIEW || (process.env.VILLA_VIEW==='mobile')===value)){
 for(const [id,query]of cases){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1500,height:1000},isMobile:mobile,hasTouch:mobile});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));await page.route('**/api/ai/**',route=>{aiRequests++;return route.abort();});
 console.log('Checking',id,mobile?'mobile':'desktop');
 await page.goto('http://localhost:3000/dev/villa-playground'+query,{waitUntil:'networkidle',timeout:120000});await page.locator('canvas').waitFor();
 for(let i=0;i<100;i++){if((await inspect(page))?.meshes>100)break;await page.waitForTimeout(300)}await page.waitForTimeout(2000);
 assert((await inspect(page))?.meshes>100);
 assert.equal(await page.getByRole('form',{name:'Design with Terra'}).isVisible(),false);
 assert.equal(await page.getByRole('navigation',{name:'Architectural styles'}).isVisible(),false);
 const initial=await authored(page);if(id!=='solana')assert(initial,'Authored draft must be inspectable');const sceneBefore=await inspect(page);
 const customize=page.getByRole('button',{name:'Customize this villa',exact:true});
 if(await customize.count()){await customize.click();await page.getByRole('button',{name:'Close customization',exact:true}).click();}

 await page.screenshot({path:`${dir}/${id}-${mobile?'mobile':'desktop'}.png`});
 await page.getByRole('button',{name:'✦ Terra',exact:true}).click();await page.getByLabel('Villa brief',{exact:true}).fill('Preserve this unsent brief');
 await page.getByRole('button',{name:'Close Terra',exact:true}).click();assert.equal(await page.getByLabel('Villa brief',{exact:true}).isVisible(),false);
 await page.getByRole('button',{name:'✦ Terra',exact:true}).click();assert.equal(await page.getByLabel('Villa brief',{exact:true}).inputValue(),'Preserve this unsent brief');await page.getByRole('button',{name:'Close Terra',exact:true}).click();
 let warnings=false;
 const status=page.getByRole('button',{name:/^\d+ unresolved items$/});
 if(await status.count()){
 warnings=true;await status.click();await page.getByText('Complete estate approval is pending.',{exact:false}).waitFor();
 await page.screenshot({path:`${dir}/${id}-${mobile?'mobile':'desktop'}-warnings.png`});
 await page.getByRole('button',{name:'Dismiss Terra response'}).click();assert.equal(await page.getByText('Complete estate approval is pending.',{exact:false}).isVisible(),false);
 assert.equal(await authored(page),initial);assert.deepEqual((await inspect(page)).names,sceneBefore.names);
 await page.getByRole('button',{name:'Design status',exact:true}).click();await page.getByText('Complete estate approval is pending.',{exact:false}).waitFor();await page.getByRole('button',{name:'Dismiss status',exact:true}).click();
 }
 const cameras={};
 for(const view of ['Focus House','Arrival','Poolside','Aerial','Fit Property']){
 await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(1700);const camera=await inspect(page);cameras[view]={position:camera.position,projected:camera.projected};
 assert(camera.projected.minZ>=-1 && camera.projected.maxZ<=1 && camera.projected.minX>=-1 && camera.projected.maxX<=1 && camera.projected.minY>=-1 && camera.projected.maxY<=1,`${id}/${view}: entire architecture must fit`);
 if(!mobile && id==='retained-estate') await page.screenshot({path:`${dir}/${id}-${view.toLowerCase().replaceAll(' ','-')}.png`});
 }
 await page.getByRole('button',{name:'Focus House',exact:true}).click();await page.waitForTimeout(1700);
 await page.getByRole('button',{name:'Fullscreen',exact:true}).click();await page.waitForTimeout(1700);assert.equal(await page.getByRole('heading',{level:1}).isVisible(),false);await page.screenshot({path:`${dir}/${id}-${mobile?'mobile':'desktop'}-fullscreen.png`});await page.getByRole('button',{name:'Exit exploration'}).click();
 assert.equal(await authored(page),initial);
 results.push({id,mobile,warnings,draftPreserved:true,terraCollapseReopen:true,fullscreen:true,meshes:sceneBefore.meshes,cameras});
 await page.context().close();
 }
 }
 assert.equal(aiRequests,0);assert.deepEqual(errors,[]);
 const checkedCount=results.length;
 if(process.env.VILLA_CASE || process.env.VILLA_VIEW){
 const previous=JSON.parse(readFileSync(`${dir}/results.json`,'utf8'));
 for(const result of previous.results)if(!results.some(r=>r.id===result.id && r.mobile===result.mobile))results.push(result);
 }
 writeFileSync(`${dir}/results.json`,JSON.stringify({aiRequests,errors,results},null,2));console.log('PASS',checkedCount,'views checked; evidence contains',results.length,'views');
}catch(error){
 for(const [i,page]of browser.contexts().flatMap(c=>c.pages()).entries()){console.log((await page.locator('body').innerText()).slice(0,5000));await page.screenshot({path:`${dir}/failure-${i}.png`});}
 console.log({errors,aiRequests});throw error;
}finally{await browser.close()}
