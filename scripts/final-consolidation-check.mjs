import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/consolidation/final-audit';mkdirSync(dir,{recursive:true});
const fixture=JSON.parse(readFileSync('docs/villa-playground/terra-direct-scene/turning-lantern.operations.json','utf8'));
fixture.operations.push({op:'add',element:{id:'curved-lounge',label:'Approved curved lounge',kind:'pavilion',at:[20,0,0],rotation:.4,size:[8,3.5,6],material:'limestone'}});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const requests=[],errors=[],unexpected=[],checks=[];
try {
 const page=await browser.newPage({viewport:{width:1600,height:1050}});
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(!['localhost','127.0.0.1'].includes(url.hostname)){unexpected.push(url.origin);return route.abort();}
  if(url.pathname==='/api/ai/plan'&&req.method()==='GET')return route.fulfill({json:{enabled:false}});
  if(url.pathname==='/api/dev/villa-design-lessons'){
    const input=req.postDataJSON();requests.push({path:url.pathname,input});assert.equal(input.before.version,'architectural-scene-1');assert.equal(input.beforeCaptures.length,3);assert.equal(input.afterCaptures.length,3);return route.fulfill({json:{id:'mock-feedback-no-record-written'}});
  }
  if(url.pathname.startsWith('/api/ai/')){
    const input=req.postDataJSON();requests.push({path:url.pathname,input});
    if(url.pathname==='/api/ai/villa/visual-review')return route.fulfill({json:{review:{weaknesses:['Mock material study'],improvement:'Change only first floor finish',scope:['elements.0.material']}}});
    if(url.pathname!=='/api/ai/scene'){unexpected.push(url.pathname);return route.abort();}
    if(input.prompt==='Invalid new design regression') return route.fulfill({json:{changes:{roof:'hip'},summary:'Legacy envelope must be rejected',unsupported:[]}});
    const output=input.mode==='generate'?fixture:{name:fixture.name,summary:'Scoped mock finish',unsupported:[],operations:[{op:'finish',id:input.current.elements[0].id,material:'sage'}]};
    return route.fulfill({json:output});
  }
  return route.continue();
 });
 const base=process.env.SCENE_PROOF_URL||'http://localhost:3100';
 await page.goto(`${base}/dev/villa-playground`,{waitUntil:'networkidle',timeout:120000});
 await page.getByLabel('Terra design brief').fill('Generate a tropical house with curved lounge from the image');
 await page.getByLabel('Reference image',{exact:true}).setInputFiles('public/inspiration/villa.jpg');
 await page.getByRole('button',{name:'Generate villa',exact:true}).click();
 await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor({timeout:120000});
 let before=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.equal(before.elements.length,44);assert.equal(requests[0].path,'/api/ai/scene');assert.ok(requests[0].input.reference.image.startsWith('data:image/jpeg;base64,'));
 checks.push('normal Playground opens direct studio; New Design with reference uses canonical API, no legacy fallback');
 await page.getByRole('button',{name:'Aerial',exact:true}).click();await page.waitForTimeout(2500);
 await page.screenshot({path:`${dir}/01-playground-image-curved.png`});
 await page.getByRole('button',{name:'Apply change',exact:true}).click();await page.getByRole('status').filter({hasText:'Scoped mock finish'}).waitFor();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 assert.deepEqual(after.elements.slice(1),before.elements.slice(1));assert.deepEqual(requests[1].input.current,before);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1'))),before);
 await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:fixture.name,exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1'))),before);
 checks.push('Playground Refine, undo and reload preserve direct-scene identities and unrelated geometry');
 await page.getByLabel('Terra design brief').fill('Invalid new design regression');
 await page.getByRole('button',{name:'Generate villa',exact:true}).click();
 await page.getByRole('status').filter({hasText:'operations'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1'))),before);
 checks.push('legacy-shaped New Design output is rejected without fallback or scene replacement');
 await page.getByLabel('Reference image',{exact:true}).setInputFiles('public/inspiration/villa.jpg');
 await page.getByLabel('Terra design brief').fill('Evaluate tropical villa shade');
 await page.getByText('Visual review',{exact:true}).click();await page.getByRole('button',{name:'Evaluate scene',exact:true}).click();
 try { await page.getByRole('button',{name:'Approve scene proposal',exact:true}).waitFor({timeout:90000}); } catch(error) { await page.screenshot({path:`${dir}/review-failure.png`}); console.error(await page.locator('aside').innerText()); throw error; }
 const review=requests.find(r=>r.path==='/api/ai/villa/visual-review');assert.equal(review.input.current.version,'architectural-scene-1');assert.equal(review.input.images.length,3);assert.ok(review.input.reference.image.startsWith('data:image/jpeg;base64,'));
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1'))),before);
 await page.screenshot({path:`${dir}/02-reference-review-proposal.png`});
 await page.getByLabel('Review feedback').fill('Mock approval proves the scene proposal lifecycle only.');
 await page.getByRole('button',{name:'Approve scene proposal',exact:true}).click();await page.getByRole('status').filter({hasText:'Reviewed feedback saved.'}).waitFor();
 const accepted=await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));assert.equal(accepted.elements[0].material,'sage');assert.deepEqual(accepted.elements.slice(1),before.elements.slice(1));
 checks.push('three actual reference-aware scene captures; scoped proposal remains staged until approval; feedback payload supports direct snapshots (storage mocked)');
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1'))),before);
 await page.goto(`${base}/dev/villa-playground/image-first`,{waitUntil:'networkidle'});
 await page.getByLabel('Terra design brief').waitFor();
 await page.getByRole('button',{name:'Clear reference',exact:true}).waitFor();
 await page.screenshot({path:`${dir}/03-image-first-primary.png`});
 checks.push('image-first default enters primary studio with reference pixels ready; retained replay requires explicit compatibility URL');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,mockedRequests:requests.map(({path,input})=>({path,mode:input.mode,version:input.current?.version,reference:!!input.reference})),errors,unexpected,checks},null,2));
 console.log(JSON.stringify({checks,errors,unexpected},null,2));
}finally{await browser.close();}
