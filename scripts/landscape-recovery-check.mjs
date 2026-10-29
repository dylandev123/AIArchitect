import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack || String(e)));
 await page.route('**/api/ai/**',r=>r.abort());
 await page.goto('http://localhost:3000/dev/villa-playground?response=8100bca24525c07e1319837d172478ea71557c45a367dc1d49b99a4bbd6a6483',{waitUntil:'networkidle',timeout:120000});
 await page.getByText('Design preview · Access unresolved',{exact:true}).waitFor();
 await page.waitForTimeout(8000);
 const scene=await page.locator('canvas').evaluate(c=>{
 let fiber=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
 while(fiber){let hook=fiber.memoizedState;while(hook){const ref=hook.memoizedState?.current,state=ref?.get?ref.get():ref;
 if(state?.scene?.isScene){const groups=[],invalid=[];let meshes=0;state.scene.traverse(o=>{if(o.name)groups.push(o.name);if(o.isMesh){meshes++;if(o.geometry?.attributes?.position?.array?.some(n=>!Number.isFinite(n)))invalid.push(o.name);}});return {groups,meshes,invalid};}hook=hook.next;}fiber=fiber.return;}return null;
 });
 assert(scene?.meshes>100);assert.deepEqual(scene.invalid,[]);if(errors.length)console.log(errors[0]);assert.deepEqual(errors.slice(0,1),[]);
 assert(scene.groups.some(n=>n.includes('crescent-residence')));
 assert(!scene.groups.some(n=>n.startsWith('Circulation arrival-walk')));
 assert(!scene.groups.includes('Formal garden · pavilion-garden'));
 await page.screenshot({path:'docs/villa-playground/landscape-recovery/preview.png',fullPage:true});
 writeFileSync('docs/villa-playground/landscape-recovery/browser.json',JSON.stringify({providerCalls:0,errors,...scene},null,2));
 console.log(JSON.stringify({providerCalls:0,meshes:scene.meshes,invalid:scene.invalid,errors}));
} finally {await browser.close();}
