/** Offline UI regression: no paid endpoints or database access. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('/Users/dylandevaux/Desktop/pawsitive-eats-shop/node_modules/playwright-core');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl']});
const scene=JSON.parse(readFileSync('docs/architecture/staged-villa/stage5-site/terra-stage5.scene.json','utf8'));
const json=JSON.stringify(scene),id='offline-studio-regression';
const project={id,name:'Offline Studio regression',projectType:'villa',generationMode:'direct-scene',createdAt:1,updatedAt:1,houseConfigJson:json,versions:[{id:'initial',createdAt:1,summary:'Test baseline',houseConfigJson:json}],currentVersionIndex:0};
const page=await browser.newPage({viewport:{width:1450,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',r=>{const u=new URL(r.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname))return r.abort();if(u.pathname.startsWith('/api/')&&u.pathname!=='/api/ai/staged-rehearsal')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({catalog:[],queue:[],glbIds:[]})});return r.continue();});
try{
 await page.goto('http://localhost:3015');await page.evaluate(p=>localStorage.setItem('ai-architect-projects',JSON.stringify({state:{projects:[p]},version:0})),project);
 await page.goto(`http://localhost:3015/workspace/${id}`);await page.getByText('Staged generation · local rehearsal',{exact:true}).waitFor({timeout:120000});
 await page.getByRole('button',{name:'Start staged rehearsal',exact:true}).click();await page.getByText('Stage 2 validated.',{exact:false}).waitFor();
 for(const stage of [3,4,5]){await page.getByRole('button',{name:'Continue next stage',exact:true}).click();await page.getByText(`Stage ${stage} validated.`,{exact:false}).waitFor();}
 await page.getByRole('button',{name:'Inspect stage 3:',exact:false}).click();
 await page.getByRole('button',{name:'Inspect stage 5:',exact:false}).click();
 await page.getByRole('button',{name:'Save staged house',exact:true}).click();await page.getByText('Saved in browser project history.',{exact:false}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Reopen staged house',exact:true}).click();await page.getByText('Reopened staged source',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Validate and preview pool edit',exact:true}).click();await page.getByRole('button',{name:'Reject pool edit',exact:true}).click();
 await page.getByRole('button',{name:'Validate and preview pool edit',exact:true}).click();await page.getByRole('button',{name:'Accept pool edit',exact:true}).click();
 await page.getByText('Saved in browser project history.',{exact:false}).waitFor();await page.reload();
 await page.getByRole('button',{name:'Reopen staged house',exact:true}).click();await page.getByText('Reopened staged source',{exact:false}).waitFor();
 const stored=await page.evaluate(()=>localStorage.getItem('ai-architect-projects'));assert(stored.includes('Accepted mock pool edit'));assert.deepEqual(errors,[]);
 await page.screenshot({path:'docs/architecture/studio-staged-integration/studio.png'});
 writeFileSync('docs/architecture/studio-staged-integration/browser.json',JSON.stringify({passed:true,flow:['stages 2–5','inspect intermediate','save','reload','reopen','preview','reject','preview','accept','reload edited house'],pageErrors:errors,paidCalls:0},null,2));
 console.log('Studio browser workflow passed');
}finally{await browser.close();}
