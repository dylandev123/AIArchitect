import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/terra-direct-scene';mkdirSync(dir,{recursive:true});
const ladera=JSON.parse(readFileSync('docs/villa-playground/scene-operations/ladera.scene.json','utf8'));
const elements=[];
const add=(id,kind,at,size,extra={})=>elements.push({id,label:id,kind,at,size,...extra});
for(let i=0;i<5;i++){
 const parent=`floor-${i}`;add(parent,'plate',[(i%2)*3,i*3.3,0],[12,.3,9],{rotation:.22+i*.09,material:'limestone'});
 add(`back-${i}`,'wall',[0,1.65,-4.35],[12,3,.3],{parent,opening:{x:0,sill:.6,width:7,height:1.8,glazed:true}});
 add(`west-${i}`,'wall',[-5.85,1.65,0],[8.4,3,.3],{parent,rotation:Math.PI/2,material:'timber'});
 add(`front-${i}`,'glazing',[0,1.65,4.35],[11.6,3,.06],{parent,panels:6});
 add(`east-${i}`,'glazing',[5.85,1.65,0],[8.4,3,.06],{parent,rotation:Math.PI/2});
 add(`shade-${i}`,'roof',[0,3.18,0],[13,.25,10],{parent});
 add(`deck-${i}`,'plate',[0,0,5.4],[12,.3,2.2],{parent,material:'timber'});
 add(`rail-${i}`,'balcony',[0,.7,6.4],[12,1.1,.05],{parent});
}
add('entry','entrance',[0,1.6,4.4],[1.4,2.9,.15],{parent:'floor-0',material:'timber'});
add('privacy','screen',[-5,1.6,5.5],[2.2,2.8,.15],{parent:'floor-0',material:'bronze'});
add('sky-bridge','plate',[16,9.8,0],[20,.35,3],{rotation:.4,material:'limestone'});
const output={name:'Five-level Turning Lantern',summary:'Five offset rotated storeys with a diagonal elevated bridge',unsupported:['Stair circulation and structural engineering are not generated.'],operations:elements.map(element=>({op:'add',element}))};
writeFileSync(`${dir}/turning-lantern.operations.json`,JSON.stringify(output,null,2));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[];let mocks=0;
try{
 const page=await browser.newPage({viewport:{width:1600,height:1050}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname)){blocked.push(url.href);return route.abort();}if(url.pathname.startsWith('/api/ai/')){
 assert.equal(url.pathname,'/api/ai/scene');const input=route.request().postDataJSON();mocks++;
 const body=input.mode==='edit'?{name:'Edited lantern',summary:'Move one screen',unsupported:[],operations:[{op:'move',id:'privacy',at:[-3,1.6,5.5]}]}:mocks===1?{name:ladera.name,summary:'Casa replay',unsupported:[],operations:ladera.elements.map(element=>({op:'add',element}))}:output;
 return route.fulfill({json:body});}return route.continue();});
 const base=process.env.SCENE_PROOF_URL||'http://localhost:3000';
 await page.goto(`${base}/dev/villa-playground?scene=ladera`,{waitUntil:'networkidle',timeout:120000});
 await page.getByLabel('Terra design brief').fill('Replay Casa Ladera');await page.getByRole('button',{name:'Generate villa',exact:true}).click();await page.waitForTimeout(5000);
 await page.screenshot({path:`${dir}/ladera-terra-replay.png`});
 await page.getByLabel('Terra design brief').fill('Design five freely rotated offset floors and a diagonal sky bridge');await page.getByRole('button',{name:'Generate villa',exact:true}).click();await page.waitForTimeout(3000);
 await page.getByRole('button',{name:'Aerial',exact:true}).click();await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/turning-lantern-aerial.png`});
 await page.getByRole('button',{name:'Poolside',exact:true}).click();await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/turning-lantern-poolside.png`});
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('terra-direct-scene-1')));
 const rendered=()=>page.locator('canvas').evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){const parts=[];s.scene.traverse(o=>{if(o.name.startsWith('operation:'))parts.push({name:o.name,uuid:o.uuid,parent:o.parent?.name,children:o.children.map(c=>c.userData.id||c.name)});});return parts;}h=h.next;}f=f.return;}return [];});
 const meshesBefore=await rendered();assert.equal(meshesBefore.length,43);assert.equal(meshesBefore.find(e=>e.name==='operation:back-0').parent,'operation:floor-0');assert(meshesBefore.find(e=>e.name==='operation:back-0').children.includes('villa-back-0-left'));
 const before=await saved();assert.equal(before.elements.length,43);assert.equal(before.elements.filter(e=>e.kind==='wall'&&e.opening).length,5);
 await page.getByLabel('Terra design brief').fill('Move privacy screen only');await page.getByRole('button',{name:'Apply change',exact:true}).click();await page.waitForTimeout(700);
 const meshesAfter=await rendered();assert.deepEqual(meshesAfter.map(e=>e.uuid),meshesBefore.map(e=>e.uuid));
 const after=await saved();assert.deepEqual(after.elements.find(e=>e.id==='privacy').at,[-3,1.6,5.5]);assert.deepEqual(after.elements.filter(e=>e.id!=='privacy'),before.elements.filter(e=>e.id!=='privacy'));
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await saved(),before);
 await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(1500);assert.equal(await page.getByRole('heading',{level:1}).textContent(),output.name);assert.deepEqual(await saved(),before);
 writeFileSync(`${dir}/turning-lantern.scene.json`,JSON.stringify(before,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.equal(mocks,3);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({providerCalls:0,mockedRequests:mocks,errors,blocked,checks:['Casa Ladera generated through Terra UI contract','five noncardinal split levels','wall openings and parent attachments','actual Three.js groups and meshes: 43 stable UUIDs, nested attachments, wall opening segments','targeted edit preserves all unrelated elements','undo restores persisted scene','reload restores editable scene']},null,2));
}finally{await browser.close();}
